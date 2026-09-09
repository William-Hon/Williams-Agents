import os
from pathlib import Path
from typing import Dict, Any, List
from tools.documents import load_application_profile, load_experiences, get_generated_dir
from tools.pdf import generate_cover_letter_text
from tools.database import register_document
from tools.llm import default_llm


class CoverLetterAgent:
    def __init__(self, llm=None):
        self.profile = load_application_profile()
        self.experiences = load_experiences()
        self.llm = llm or default_llm

    def generate_cover_letter(
        self,
        application_id: int,
        company: str,
        role: str,
        job_details: Dict[str, Any],
    ) -> Path:
        """Draft tailored cover letter and save to managed application folder."""
        # Check LLM or heuristic drafting
        prompt = f"""Write 3 body paragraphs for a cover letter for William Hon applying to {company} as {role}.
Candidate details:
- School: Northeastern University, B.S. in Computer Science & AI, GPA: 3.8
- Work Co-op: Bain & Company (Software Engineer Co-op): AI analytics platform (12K+ users), Terraform, Azure, PostgreSQL.
- Research: Khoury College: Supreme Court NLP pipeline, Gemma-2B, KeyBERT, Hugging Face LLMs.
Rules:
- Never fabricate skills or experience.
- Tone: professional, concise, enthusiastic about {company}.
- Respond with only the paragraphs separated by double newlines.
"""
        generated_body = self.llm.generate(prompt, system_prompt="You are a professional technical career coach.")
        if generated_body and len(generated_body.split("\n\n")) >= 2:
            paragraphs = [p.strip() for p in generated_body.split("\n\n") if p.strip()]
        else:
            # Fallback deterministic grounded paragraphs
            p1 = (
                f"I am writing to express my strong enthusiasm for the {role} position at {company}. "
                "As a Computer Science & Artificial Intelligence student at Northeastern University, "
                "I have developed hands-on technical experience designing reliable data engineering pipelines "
                "and production cloud infrastructure."
            )
            p2 = (
                "During my co-op as a Software Engineer at Bain & Company, I built and deployed an AI usage "
                "analytics platform serving over 12,000 users. I utilized Terraform Infrastructure as Code (IaC) "
                "and CI/CD pipelines to provision Azure Function Apps and relational PostgreSQL data models, "
                "slashing FinOps reporting time by 97%. Additionally, in my undergraduate research at Khoury College, "
                "I engineered an automated data extraction and NLP pipeline leveraging Gemma-2B and Hugging Face models, "
                "achieving 90% retrieval accuracy across legal publications."
            )
            p3 = (
                f"I am excited by {company}'s technical vision and would welcome the opportunity to bring my "
                "passion for scalable software systems, machine learning engineering, and reliable automation to your team. "
                "Thank you for your time and consideration."
            )
            paragraphs = [p1, p2, p3]

        text = generate_cover_letter_text(self.profile, company, role, paragraphs)

        app_dir = get_generated_dir(company, role, application_id)
        clean_company = "".join(c for c in company if c.isalnum())
        file_name = f"William_Hon_CoverLetter_{clean_company}.pdf"
        pdf_path = app_dir / file_name

        # Write text/pdf artifact
        pdf_path.write_text(text, encoding="utf-8")

        rel_path = os.path.relpath(pdf_path, Path(".").resolve())
        register_document(
            application_id=application_id,
            document_type="cover_letter",
            file_path=str(rel_path).replace("\\", "/"),
        )
        return pdf_path
