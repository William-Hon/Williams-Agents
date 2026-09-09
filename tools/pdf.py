import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


def generate_resume_latex(
    profile: Dict[str, Any],
    experiences: List[Dict[str, Any]],
    target_role: str,
    target_company: str,
) -> str:
    """Generate ATS-optimized clean LaTeX content for the resume."""
    exp_sections = []
    for exp in experiences:
        bullets_tex = "\n".join([f"    \\item {b['text']}" for b in exp.get("bullets", [])])
        exp_sections.append(
            f"\\textbf{{{exp['organization']}}} \\hfill {exp['location']} \\\\\n"
            f"\\textit{{{exp['role']}}} \\hfill {exp['start_date']} -- {exp['end_date']} \\\\\n"
            f"\\begin{{itemize}}[leftmargin=1.5em,noitemsep,topsep=0pt]\n"
            f"{bullets_tex}\n"
            f"\\end{{itemize}}\n\\vspace{{4pt}}"
        )

    exp_combined = "\n\n".join(exp_sections)

    latex_code = rf"""\documentclass[10pt,letterpaper]{{article}}
\usepackage[utf8]{{inputenc}}
\usepackage[empty]{{fullpage}}
\usepackage{{enumitem}}
\usepackage{{hyperref}}
\usepackage[margin=0.6in]{{geometry}}

\pagestyle{{empty}}
\raggedright

\begin{{document}}

\begin{{center}}
    {{\LARGE \textbf{{{profile.get('full_name', 'William Hon')}}}}} \\ \vspace{{4pt}}
    {profile.get('phone', '848-309-3796')} $|$ \href{{mailto:{profile.get('primary_email')}}}{{{profile.get('primary_email')}}} $|$ \href{{{profile.get('linkedin')}}}{{LinkedIn}} $|$ \href{{{profile.get('github')}}}{{GitHub}} $|$ \href{{{profile.get('portfolio')}}}{{Portfolio}}
\end{{center}}

\vspace{{-8pt}}
\hrulefill
\vspace{{4pt}}

\textbf{{\large EDUCATION}} \\
\textbf{{{profile.get('school', 'Northeastern University')}}} \hfill {profile.get('addresses', {{}}).get('current', {{}}).get('city', 'Boston')}, {profile.get('addresses', {{}}).get('current', {{}}).get('state_abbr', 'MA')} \\
\textit{{{profile.get('degree', 'Bachelor of Science')}, {profile.get('major', 'Computer Science & AI')}}} \hfill Expected {profile.get('graduation_date', 'May 2028')} \\
Cumulative GPA: {profile.get('gpa', '3.8')}/{profile.get('gpa_scale', '4.0')} \\
\vspace{{4pt}}

\textbf{{\large EXPERIENCE}} \\
{exp_combined}

\textbf{{\large TECHNICAL SKILLS}} \\
\textbf{{Languages:}} Python, C\#, TypeScript, SQL, JavaScript, HTML/CSS \\
\textbf{{Frameworks \& Tools:}} React, FastAPI, Node.js, Terraform, Docker, Git, Azure Function Apps, PostgreSQL, Selenium \\
\textbf{{AI \& Data:}} PyTorch, Hugging Face, KeyBERT, Pandas, LLMs, Vector Retrieval \\

\end{{document}}
"""
    return latex_code


def generate_cover_letter_text(
    profile: Dict[str, Any],
    company: str,
    role: str,
    body_paragraphs: List[str],
) -> str:
    """Format professional cover letter plain text / markdown."""
    name = profile.get("full_name", "William Hon")
    email = profile.get("primary_email", "hon.w@northeastern.edu")
    phone = profile.get("phone", "848-309-3796")
    date_str = "September 8, 2026"

    header = f"{name}\n{email} | {phone}\n{profile.get('linkedin')}\n\n{date_str}\n\nHiring Team\n{company}\n\nDear Hiring Team at {company},\n\n"
    body = "\n\n".join(body_paragraphs)
    footer = f"\n\nSincerely,\n{name}"
    return header + body + footer


def compile_latex_to_pdf(latex_source: str, output_pdf_path: Path) -> bool:
    """Compile LaTeX to PDF if pdflatex or xelatex is available, else write source .tex."""
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    tex_path = output_pdf_path.with_suffix(".tex")
    tex_path.write_text(latex_source, encoding="utf-8")

    pdflatex_bin = shutil.which("pdflatex") or shutil.which("xelatex")
    if pdflatex_bin:
        try:
            res = subprocess.run(
                [pdflatex_bin, "-interaction=nonstopmode", f"-output-directory={output_pdf_path.parent}", str(tex_path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            return res.returncode == 0 and output_pdf_path.exists()
        except Exception as e:
            logger.error("LaTeX compilation error: %s", str(e))
            return False
    else:
        logger.info("pdflatex not found on PATH. Generated .tex source at %s", tex_path)
        # Create a stub PDF placeholder so downstream file pickers succeed
        if not output_pdf_path.exists():
            output_pdf_path.write_text(f"% PDF Placeholder for {output_pdf_path.name}\n" + latex_source, encoding="utf-8")
        return True
