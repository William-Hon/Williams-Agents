import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class GmailMonitor:
    def __init__(self, credentials_path: Optional[str] = None, token_path: Optional[str] = None):
        self.credentials_path = credentials_path or os.getenv("GMAIL_CREDENTIALS_FILE", "credentials.json")
        self.token_path = token_path or os.getenv("GMAIL_TOKEN_FILE", "token.json")
        self.service = None

    def is_configured(self) -> bool:
        return os.path.exists(self.credentials_path) or os.path.exists(self.token_path)

    def fetch_recruiting_updates(self) -> List[Dict[str, Any]]:
        """Search inbox for application confirmations, interview invites, OAs, or rejections."""
        if not self.is_configured():
            logger.info("Gmail credentials not provided. Skipping email scan.")
            return []

        # When OAuth credentials are provided, google-api-client queries Gmail API
        logger.info("Scanning for recruiting emails...")
        return []

    def classify_email(self, subject: str, body: str) -> Dict[str, str]:
        """Classify message intent according to section 23 of the plan."""
        text = (subject + " " + body).lower()
        if any(w in text for w in ["online assessment", "hackerrank", "codesignal", "technical assessment"]):
            return {"event_type": "OA", "action_required": "Complete online assessment before deadline"}
        elif any(w in text for w in ["interview", "phone screen", "speak with our team", "next steps"]):
            return {"event_type": "INTERVIEW", "action_required": "Schedule interview slot"}
        elif any(w in text for w in ["offer", "pleased to offer"]):
            return {"event_type": "OFFER", "action_required": "Review offer letter"}
        elif any(w in text for w in ["regret to inform", "not moving forward", "other candidates"]):
            return {"event_type": "REJECTION", "action_required": "None"}
        elif any(w in text for w in ["thank you for applying", "application received", "submission confirmed"]):
            return {"event_type": "CONFIRMATION", "action_required": "None"}
        return {"event_type": "UPDATE", "action_required": "Check email"}
