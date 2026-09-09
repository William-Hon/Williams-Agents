import asyncio
import logging
from typing import List, Dict, Any

from tools.database import init_db, list_applications
from tools.notifications import notify_queue_complete
from workflows.application import ApplicationWorkflow
from workflows.job_discovery import JobDiscoveryWorkflow
from workflows.email_monitor import EmailMonitorWorkflow

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("orchestrator")


class WorkflowOrchestrator:
    def __init__(self):
        init_db()
        self.application_workflow = ApplicationWorkflow()
        self.job_discovery = JobDiscoveryWorkflow()
        self.email_monitor = EmailMonitorWorkflow()

    async def run_queued_applications(self) -> List[Dict[str, Any]]:
        """Process queued applications sequentially per Section 7 of the plan."""
        queued = list_applications(status="QUEUED")
        logger.info("Found %d queued applications to process", len(queued))

        results = []
        ready_count = 0
        needs_input_count = 0
        failure_count = 0

        for app in queued:
            app_id = app["id"]
            logger.info("Processing application %d: %s (%s)", app_id, app["company"], app["role"])
            try:
                res = await self.application_workflow.run(app_id)
                results.append(res)
                st = res.get("status")
                if st == "READY_FOR_REVIEW":
                    ready_count += 1
                elif st == "NEEDS_INPUT":
                    needs_input_count += 1
                else:
                    failure_count += 1
            except Exception as e:
                logger.error("Failed application %d: %s", app_id, e)
                failure_count += 1
                results.append({"status": "ERROR", "application_id": app_id, "error": str(e)})

        notify_queue_complete(ready_count, needs_input_count, failure_count)
        return results

    def run_discovery_cycle(self):
        """Trigger job discovery workflow."""
        return self.job_discovery.run_discovery()

    def run_email_cycle(self):
        """Trigger email check workflow."""
        return self.email_monitor.run_monitor()


if __name__ == "__main__":
    orchestrator = WorkflowOrchestrator()
    asyncio.run(orchestrator.run_queued_applications())
