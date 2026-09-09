import re
from typing import Dict, Any, Optional, Tuple
from tools.documents import load_application_profile, load_experiences
from tools.database import find_approved_answer, add_question
from tools.llm import default_llm


class AnswerAgent:
    def __init__(self, llm=None):
        self.profile = load_application_profile()
        self.experiences = load_experiences()
        self.llm = llm or default_llm

    def resolve_question(
        self,
        application_id: int,
        question_text: str,
        company: str,
        job_details: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Optional[str], float, bool, str]:
        """
        Returns: (answer, confidence, needs_human, source)
        """
        clean_q = question_text.strip().lower()

        # 1. Check approved answers database
        approved = find_approved_answer(question_text)
        if approved:
            qid = add_question(application_id, question_text, approved, "approved_answers", 1.0, False, True)
            return approved, 1.0, False, "approved_answers"

        # 2. Check standard profile answers
        if any(w in clean_q for w in ["authorized to work", "legally authorized", "work authorization"]):
            ans = "Yes"
            add_question(application_id, question_text, ans, "application_profile", 1.0, False, True)
            return ans, 1.0, False, "application_profile"

        if any(w in clean_q for w in ["require sponsorship", "require visa", "sponsorship now or in the future"]):
            ans = "No"
            add_question(application_id, question_text, ans, "application_profile", 1.0, False, True)
            return ans, 1.0, False, "application_profile"

        if any(w in clean_q for w in ["relocate", "willing to relocate"]):
            ans = "Yes"
            add_question(application_id, question_text, ans, "application_profile", 1.0, False, True)
            return ans, 1.0, False, "application_profile"

        if any(w in clean_q for w in ["hear about", "how did you hear"]):
            ans = "Company Career Site"
            add_question(application_id, question_text, ans, "application_profile", 1.0, False, True)
            return ans, 1.0, False, "application_profile"

        if any(w in clean_q for w in ["compensation", "salary expectation", "hourly rate", "desired pay"]):
            # Compensation rule per Section 9 of profile
            ans = "$30/hour"
            if job_details and job_details.get("compensation"):
                ans = str(job_details["compensation"])
            add_question(application_id, question_text, ans, "compensation_rule", 0.95, False, True)
            return ans, 0.95, False, "compensation_rule"

        # 3. Check hard unsupported questions -> MUST flag needs_human
        unsupported_triggers = [
            "previously interviewed",
            "previously employed",
            "family member",
            "relative",
            "security clearance",
            "clearance level",
            "driver's license",
            "travel percentage",
        ]
        if any(t in clean_q for t in unsupported_triggers):
            add_question(application_id, question_text, None, "unsupported_fact", 0.0, True, False)
            return None, 0.0, True, "unsupported_fact"

        # 4. Long-form / behavioral questions: check LLM or flag
        if any(w in clean_q for w in ["describe a project", "process you improved", "technical challenge"]):
            # Use Bain 01 process improvement example
            ans = (
                "At Bain & Company, I built an automated FinOps analytics platform using Azure Function Apps, "
                "PostgreSQL, and Terraform. By automating resource tracking and alerting pipelines for 12,000+ users, "
                "we reduced reporting turnaround time by 97% and drastically minimized manual operational overhead."
            )
            add_question(application_id, question_text, ans, "experience_bank", 0.92, False, True)
            return ans, 0.92, False, "experience_bank"

        # Default fallback: strictly flag for human input per rule #12
        add_question(application_id, question_text, None, "unknown_field", 0.0, True, False)
        return None, 0.0, True, "unknown_field"
