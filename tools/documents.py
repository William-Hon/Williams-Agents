import os
import re
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", "."))


def get_project_root() -> Path:
    return DEFAULT_PROJECT_ROOT.resolve()


def load_application_profile(profile_path: Optional[str] = None) -> Dict[str, Any]:
    """Parse application_profile.txt into structured candidate data and hard rules."""
    root = get_project_root()
    path = Path(profile_path) if profile_path else root / "data" / "application_profile.txt"
    if not path.exists():
        return {}

    content = path.read_text(encoding="utf-8")
    profile: Dict[str, Any] = {
        "raw_text": content,
        "first_name": "William",
        "last_name": "Hon",
        "full_name": "William Hon",
        "pronouns": "He/Him",
        "primary_email": "hon.w@northeastern.edu",
        "secondary_email": "32whon@gmail.com",
        "phone": "8483093796",
        "linkedin": "https://www.linkedin.com/in/william-hon-b368a2301/",
        "github": "https://github.com/William-Hon",
        "portfolio": "https://www.williamhon.com/#projects",
        "school": "Northeastern University",
        "degree": "Bachelor of Science",
        "major": "Computer Science & Artificial Intelligence",
        "graduation_date": "May 1, 2028",
        "graduation_month": "May",
        "graduation_year": "2028",
        "gpa": "3.8",
        "gpa_scale": "4.0",
        "work_authorization": True,
        "requires_sponsorship_now": False,
        "requires_sponsorship_future": False,
        "citizenship": "U.S. citizen",
        "willing_to_relocate": True,
        "gender": "Male",
        "race_ethnicity": "Asian",
        "hispanic_latino": "No",
        "veteran_status": "I am not a veteran",
        "disability_status": "No",
        "security_clearance": "None",
        "fallback_hourly_rate": 30,
        "addresses": {
            "current": {
                "line1": "822 Parker St",
                "city": "Boston",
                "state": "Massachusetts",
                "state_abbr": "MA",
                "zip": "02120",
                "country": "United States of America",
            },
            "home": {
                "line1": "17 Genek Ct",
                "city": "Freehold",
                "state": "New Jersey",
                "state_abbr": "NJ",
                "zip": "07728",
                "country": "United States of America",
            },
        },
    }

    # Extract dynamic phone if updated
    phone_match = re.search(r"Cell/Mobile Phone:\s*(\d+)", content)
    if phone_match:
        profile["phone"] = phone_match.group(1).strip()

    email_match = re.search(r"Primary Email:\s*([^\r\n]+)", content)
    if email_match:
        profile["primary_email"] = email_match.group(1).strip()

    return profile


def load_experiences(experiences_path: Optional[str] = None) -> List[Dict[str, Any]]:
    root = get_project_root()
    path = Path(experiences_path) if experiences_path else root / "data" / "experiences.json"
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_prompt_rule(rule_name: str) -> str:
    root = get_project_root()
    path = root / "prompts" / f"{rule_name}.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def get_generated_dir(company: str, role: str, application_id: int) -> Path:
    root = get_project_root()
    slug = f"{slugify(company)}-{slugify(role)}-{application_id}"
    target_dir = root / "generated" / slug
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir


def slugify(value: str) -> str:
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    return re.sub(r"[-\s]+", "-", value)
