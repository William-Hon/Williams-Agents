import os
from pathlib import Path
from typing import Dict, Any, List
from tools.documents import load_application_profile, load_experiences, get_generated_dir, slugify
from tools.pdf import generate_resume_latex, compile_latex_to_pdf
from tools.database import register_document


class ResumeAgent:
    def __init__(self):
        self.profile = load_application_profile()
        self.experiences = load_experiences()

    def rank_experiences(self, jd_skills: List[str]) -> List[Dict[str, Any]]:
        """Rank candidate verified experiences by JD keyword overlap."""
        jd_skills_lower = {s.lower() for s in jd_skills}
        ranked = []
        for exp in self.experiences:
            score = 0
            for bullet in exp.get("bullets", []):
                bullet_skills = {s.lower() for s in bullet.get("skills", [])}
                overlap = len(bullet_skills.intersection(jd_skills_lower))
                score += overlap
            ranked.append((score, exp))

        ranked.sort(key=lambda x: x[0], reverse=True)
        return [exp for _, exp in ranked]

    def generate_tailored_resume(
        self,
        application_id: int,
        company: str,
        role: str,
        jd_skills: List[str],
    ) -> Path:
        """Generate role-specific resume without hallucinating facts."""
        ranked_exps = self.rank_experiences(jd_skills)
        latex_content = generate_resume_latex(
            profile=self.profile,
            experiences=ranked_exps,
            target_role=role,
            target_company=company,
        )

        app_dir = get_generated_dir(company, role, application_id)
        clean_company = re_clean = "".join(c for c in company if c.isalnum())
        file_name = f"William_Hon_Resume_{clean_company}.pdf"
        pdf_path = app_dir / file_name

        compile_latex_to_pdf(latex_content, pdf_path)

        # Register in SQLite with relative path
        rel_path = os.path.relpath(pdf_path, Path(".").resolve())
        register_document(
            application_id=application_id,
            document_type="resume",
            file_path=str(rel_path).replace("\\", "/"),
        )
        return pdf_path
