from typing import Dict, Any
from tools.database import list_applications, get_db_connection


class ApplicationTracker:
    @staticmethod
    def get_summary_statistics() -> Dict[str, Any]:
        """Aggregate funnel metrics and status breakdowns."""
        apps = list_applications()
        total = len(apps)

        status_counts = {}
        for app in apps:
            st = app.get("status", "UNKNOWN")
            status_counts[st] = status_counts.get(st, 0) + 1

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM field_actions WHERE action = 'AUTO_FILLED'")
        auto_filled_cnt = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COUNT(*) as cnt FROM field_actions WHERE action = 'FLAGGED_NEEDS_INPUT'")
        needs_input_cnt = cursor.fetchone()["cnt"]

        cursor.execute("SELECT COUNT(*) as cnt FROM generated_documents")
        docs_cnt = cursor.fetchone()["cnt"]
        conn.close()

        total_actions = auto_filled_cnt + needs_input_cnt
        auto_fill_rate = round((auto_filled_cnt / total_actions) * 100, 1) if total_actions > 0 else 100.0

        return {
            "total_applications": total,
            "status_counts": status_counts,
            "auto_fill_rate_percent": auto_fill_rate,
            "generated_documents_count": docs_cnt,
            "queued": status_counts.get("QUEUED", 0),
            "ready_for_review": status_counts.get("READY_FOR_REVIEW", 0),
            "needs_input": status_counts.get("NEEDS_INPUT", 0),
            "submitted": status_counts.get("SUBMITTED", 0),
        }
