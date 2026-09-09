import logging
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any

from tools.database import (
    get_application,
    update_application_status,
    log_agent_run,
    finish_agent_run,
    log_field_action,
    get_questions_for_application,
)
from tools.notifications import notify_needs_input, notify_ready_for_review
from tools.browser import BrowserAutomation
from agents.job_analyzer import JobAnalyzer
from agents.resume_agent import ResumeAgent
from agents.cover_letter_agent import CoverLetterAgent
from agents.answer_agent import AnswerAgent
from agents.verifier import Verifier

logger = logging.getLogger(__name__)


class ApplicationWorkflow:
    def __init__(self):
        self.job_analyzer = JobAnalyzer()
        self.resume_agent = ResumeAgent()
        self.cover_letter_agent = CoverLetterAgent()
        self.answer_agent = AnswerAgent()
        self.verifier = Verifier()

    async def run(self, application_id: int) -> Dict[str, Any]:
        """Execute the end-to-end application preparation and filling pipeline."""
        app = get_application(application_id)
        if not app:
            raise ValueError(f"Application {application_id} not found.")

        company = app["company"]
        role = app["role"]
        app_url = app["application_url"]

        run_id = log_agent_run("application_workflow", application_id=application_id, status="STARTED")
        logger.info("Starting application workflow for %s - %s (ID: %d)", company, role, application_id)

        try:
            # 1. ANALYZING
            update_application_status(application_id, "ANALYZING")
            job_text = app.get("notes") or f"Role: {role} at {company}. Seeking software engineering intern."
            job_details = self.job_analyzer.analyze(job_text, default_company=company, default_role=role)
            logger.info("Job analysis complete for %s. Skills: %s", company, job_details.get("required_skills"))

            # 2. GENERATING RESUME
            update_application_status(application_id, "GENERATING_RESUME")
            resume_path = self.resume_agent.generate_tailored_resume(
                application_id=application_id,
                company=company,
                role=role,
                jd_skills=job_details.get("required_skills", []),
            )
            logger.info("Resume generated at %s", resume_path)

            # 3. GENERATING COVER LETTER
            update_application_status(application_id, "GENERATING_COVER_LETTER")
            cl_path = self.cover_letter_agent.generate_cover_letter(
                application_id=application_id,
                company=company,
                role=role,
                job_details=job_details,
            )
            logger.info("Cover letter generated at %s", cl_path)

            # 4. BROWSER AUTOMATION & FILLING
            update_application_status(application_id, "FILLING")
            browser = BrowserAutomation()
            
            try:
                await browser.start()
                if browser.browser_context:
                    page = await browser.open_application(app_url)
                    logger.info("Opened application page %s", app_url)
                    
                    # Detect and resolve fields
                    fields = await browser.detect_fields(page)
                    logger.info("Detected %d fields on page", len(fields))
                    
                    has_unresolved_need = False
                    for f in fields:
                        label = f.get("label") or f.get("name") or "unknown_field"
                        classification = self.verifier.classify_field(label)
                        ans, conf, needs_human, src = self.answer_agent.resolve_question(
                            application_id, label, company, job_details
                        )
                        
                        can_fill, reason = self.verifier.can_auto_fill(classification, conf)
                        if not can_fill or needs_human:
                            has_unresolved_need = True
                            log_field_action(application_id, label, None, src, conf, "FLAGGED_NEEDS_INPUT")
                        else:
                            log_field_action(application_id, label, ans, src, conf, "AUTO_FILLED")

                    if has_unresolved_need:
                        update_application_status(application_id, "NEEDS_INPUT")
                        notify_needs_input(company, role, "Questions detected requiring human answer")
                        finish_agent_run(run_id, status="NEEDS_INPUT")
                        return {"status": "NEEDS_INPUT", "application_id": application_id}

                # Transition to review page
                update_application_status(application_id, "READY_FOR_REVIEW")
                notify_ready_for_review(company, role)
                finish_agent_run(run_id, status="READY_FOR_REVIEW")
                return {"status": "READY_FOR_REVIEW", "application_id": application_id}

            finally:
                pass  # Keep browser session open for review

        except Exception as e:
            logger.error("Error running application workflow: %s", e)
            update_application_status(application_id, "ERROR", notes=str(e))
            finish_agent_run(run_id, status="FAILED", error_message=str(e))
            return {"status": "ERROR", "error": str(e), "application_id": application_id}
