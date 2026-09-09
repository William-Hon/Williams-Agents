import os
import sys
import logging
import subprocess

logger = logging.getLogger(__name__)


def notify_user(title: str, message: str) -> None:
    """Send desktop toast notification on Windows or log to console."""
    logger.info("[NOTIFICATION] %s: %s", title, message)
    if os.getenv("ENABLE_DESKTOP_NOTIFICATIONS", "true").lower() != "true":
        return

    if sys.platform == "win32":
        try:
            # Native PowerShell balloon / toast notification without extra heavy pip deps
            ps_command = (
                f'[reflection.assembly]::loadwithpartialname("System.Windows.Forms"); '
                f'$notify = new-object system.windows.forms.notifyicon; '
                f'$notify.icon = [system.drawing.systemicons]::information; '
                f'$notify.visible = $true; '
                f'$notify.showballoontip(5000, "{title}", "{message}", [system.windows.forms.tooltipicon]::info);'
            )
            subprocess.Popen(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_command],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception as e:
            logger.debug("Failed to emit Windows notification: %s", e)


def notify_needs_input(company: str, role: str, question: str) -> None:
    notify_user(
        f"Input Needed: {company}",
        f"{role} application encountered an unanswered question:\n'{question}'",
    )


def notify_ready_for_review(company: str, role: str) -> None:
    notify_user(
        f"Ready for Review: {company}",
        f"{role} application reached final review page. Please inspect and submit.",
    )


def notify_queue_complete(ready_count: int, input_count: int, failure_count: int) -> None:
    notify_user(
        "Application Queue Complete",
        f"{ready_count} ready for review, {input_count} needs input, {failure_count} failures.",
    )
