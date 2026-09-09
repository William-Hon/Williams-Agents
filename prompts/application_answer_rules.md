# Application Answer Generation Rules

## Core Principles
1. **Source Grounding**: All answers must be grounded in verified sources (`application_profile.txt`, `experiences.json`, or `approved_answers/`).
2. **Confidence Threshold**: If confidence in factual accuracy is below 0.85 or the information is not present in profile sources, flag as `NEEDS_INPUT`.
3. **Conciseness**: Adhere strictly to word/character limits if specified. Deliver direct, high-signal answers.
4. **Style**: Use active voice, technical specificity, and STAR methodology (Situation, Task, Action, Result) for behavioral questions.
5. **No Speculation**: Questions regarding prior interviews, referrals, family at company, or security clearances must only be answered if known explicitly.
