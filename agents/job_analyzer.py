import re
from typing import Dict, Any, List, Optional
from tools.llm import default_llm


class JobAnalyzer:
    def __init__(self, llm=None):
        self.llm = llm or default_llm

    def analyze(self, job_text: str, default_company: str = "", default_role: str = "") -> Dict[str, Any]:
        """Analyze job description text and extract structured requirements."""
        # Try structured LLM extraction first
        prompt = f"""Extract job details from the following posting:
---
{job_text[:3000]}
---
Return a JSON object with:
- company (string)
- role (string)
- location (string or null)
- term (string, e.g. "Summer 2027" or "Spring 2027")
- required_skills (list of strings)
- preferred_skills (list of strings)
- technologies (list of strings)
- compensation (string or null)
- graduation_eligible (boolean or null)
- sponsorship_available (boolean or null)
"""
        extracted = self.llm.generate_json(prompt, system_prompt="You are an expert ATS and job description parser.")
        if extracted and isinstance(extracted, dict) and extracted.get("company"):
            return extracted

        # Heuristic fallback parser
        return self._heuristic_analysis(job_text, default_company, default_role)

    def _heuristic_analysis(self, text: str, default_company: str, default_role: str) -> Dict[str, Any]:
        lower_text = text.lower()

        # Skill detection dictionary
        skill_catalog = [
            "Python", "TypeScript", "JavaScript", "C#", "C++", "Java", "SQL", "Go",
            "React", "Node.js", "FastAPI", "Docker", "Kubernetes", "AWS", "Azure",
            "PostgreSQL", "Terraform", "Git", "CI/CD", "NLP", "Machine Learning",
            "LLMs", "PyTorch", "Pandas", "KeyBERT", "Selenium", "Playwright"
        ]

        found_skills = [s for s in skill_catalog if re.search(rf"\b{re.escape(s.lower())}\b", lower_text)]

        # Compensation detection
        comp_match = re.search(r"(\$\d+[\d,]*(?:\.\d{2})?(?:\s*(?:-|to)\s*\$\d+[\d,]*(?:\.\d{2})?)?(?:\s*(?:/hr|/hour|per hour|/yr|/year|per year))?)", text, re.IGNORECASE)
        comp = comp_match.group(1).strip() if comp_match else None

        # Location heuristic
        location = "Boston, MA" if "boston" in lower_text else ("New York, NY" if "new york" in lower_text else ("San Francisco, CA" if "san francisco" in lower_text else "Remote"))

        return {
            "company": default_company or "Unknown Company",
            "role": default_role or "Software Engineering Intern",
            "location": location,
            "term": "Summer 2027" if "summer" in lower_text else "Spring 2027",
            "required_skills": found_skills[:5],
            "preferred_skills": found_skills[5:],
            "technologies": found_skills,
            "compensation": comp,
            "graduation_eligible": True,
            "sponsorship_available": False,
        }
