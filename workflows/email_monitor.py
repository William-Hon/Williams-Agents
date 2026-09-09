import logging
from typing import List, Dict, Any
from tools.gmail import GmailMonitor
from tools.database import list_applications, update_application_status, log_agent_run, finish_agent_run
from tools.notifications import notify_user

logger = logging.getLogger(__name__)


class EmailMonitorWorkflow:
    def __init__(self):
        self.gmail = GmailMonitor()

    def run_monitor(self) -> List[Dict[str, Any]]:
        """Scan recruiting emails and match them to tracked applications."""
        run_id = log_agent_run("email_monitor", status="STARTED")
        logger.info("Executing recruiting email monitor...")

        updates = self.gmail.fetch_recruiting_updates()
        tracked_apps = list_applications()

        matched_events = []
        for update in updates:
            company = update.get("company", "").lower()
            event_type = update.get("event_type", "UPDATE")
            action_req = update.get("action_required", "")

            for app in tracked_apps:
                if app["company"].lower() in company:
                    logger.info("Matched email event %s to application %s", event_type, app["company"])
                    if event_type in ["OA", "INTERVIEW", "OFFER", "REJECTED"]:
                        update_application_status(app["id"], event_type)
                    notify_user(
                        f"Recruiting Update: {app['company']}",
                        f"New status: {event_type}. {action_req}",
                    )
                    matched_events.append(update)

        finish_agent_run(run_id, status="SUCCESS")
        return matched_events
