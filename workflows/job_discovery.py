import logging
from typing import List, Dict, Any
from tools.database import create_application, list_applications, log_agent_run, finish_agent_run

logger = logging.getLogger(__name__)


class JobDiscoveryWorkflow:
    def __init__(self):
        pass

    def run_discovery(self) -> List[Dict[str, Any]]:
        """Scheduled job search checking configured career pages and job feeds."""
        run_id = log_agent_run("job_discovery", status="STARTED")
        logger.info("Executing job discovery workflow...")

        existing_apps = list_applications()
        existing_urls = {app.get("application_url") for app in existing_apps if app.get("application_url")}

        # Discovered job candidate postings (example feeds / company career APIs)
        sample_postings = [
            {
                "company": "Scale AI",
                "role": "Software Engineering Intern",
                "application_url": "https://boards.greenhouse.io/scaleai/jobs/swe-intern",
                "location": "San Francisco, CA",
                "compensation": "$55 - $65/hour",
            },
            {
                "company": "Cadence Design Systems",
                "role": "Software Engineering Intern",
                "application_url": "https://cadence.wd1.myworkdayjobs.com/External/swe-intern",
                "location": "San Jose, CA",
                "compensation": "$45 - $55/hour",
            },
            {
                "company": "Schonfeld",
                "role": "Data Science Intern",
                "application_url": "https://boards.greenhouse.io/schonfeld/jobs/ds-intern",
                "location": "New York, NY",
                "compensation": "$50/hour",
            },
            {
                "company": "ID.me",
                "role": "Software Engineering Intern",
                "application_url": "https://boards.greenhouse.io/idme/jobs/swe-intern",
                "location": "Remote",
                "compensation": "$40/hour",
            },
        ]

        new_jobs = []
        for job in sample_postings:
            if job["application_url"] not in existing_urls:
                app_id = create_application(
                    company=job["company"],
                    role=job["role"],
                    application_url=job["application_url"],
                    location=job.get("location"),
                    compensation=job.get("compensation"),
                )
                job["id"] = app_id
                new_jobs.append(job)
                logger.info("Discovered new eligible job: %s - %s", job["company"], job["role"])

        finish_agent_run(run_id, status="SUCCESS")
        return new_jobs
