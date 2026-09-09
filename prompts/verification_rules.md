# Verification and Guardrail Rules

## Guardrail Hierarchy
1. **Legal / Certifications / Disclaimers**: NEVER automatically accept arbitration, background checks, or export certifications without human flagging. Standard Privacy Policy / Terms of Service can be accepted per profile rule #14.
2. **Unsupported Fields**: Any question without explicit evidence in profile or approved answers must trigger `NEEDS_INPUT`.
3. **Assessments**: Never attempt automated completion of CodeSignal, HackerRank, HireVue, or personality tests.
4. **Final Submission Gate**: The automated workflow must STOP at the final review page. It must NEVER click final Submit.
