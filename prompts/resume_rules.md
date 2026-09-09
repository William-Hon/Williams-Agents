# Resume Generation Rules

## Core Principles
1. **Absolute Truthfulness**: Never fabricate experience, metrics, companies, skills, or dates.
2. **Fact Constraint**: Use only experiences and bullets explicitly recorded in `data/experiences.json` and `data/application_profile.txt`.
3. **ATS Alignment**: Match genuine keywords from the job description with candidate verified capabilities.
4. **Action-Result Framing**: Structure bullet points with strong action verbs, technical context, and quantifiable results.
5. **No Invention**: If a skill or technology is mentioned in the JD that the candidate has not worked with, DO NOT add it to the resume.

## Layout and Length
- Exactly 1 page.
- Clean LaTeX formatting designed for ATS parsers (no multiple columns or unparseable tables).
- Section order: Education, Experience, Projects, Technical Skills.

## Output Target
- Relative path: `generated/<company-role-application_id>/William_Hon_Resume_<Company>.pdf`
