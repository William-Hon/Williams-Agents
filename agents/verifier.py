from typing import Dict, Any, Tuple


class Verifier:
    """Implements Phase H guardrails and field classification."""

    @staticmethod
    def classify_field(label: str) -> str:
        """
        Classify field category:
        - SUPPORTED_FACTUAL
        - JOB_DEPENDENT
        - GENERATED_WRITTEN
        - UNSUPPORTED_FACTUAL
        - LEGAL_SENSITIVE
        - ASSESSMENT
        - FINAL_SUBMISSION
        """
        lower = label.lower()

        if any(w in lower for w in ["submit application", "submit my application", "finish and submit"]):
            return "FINAL_SUBMISSION"

        if any(w in lower for w in ["codesignal", "hackerrank", "hirevue", "assessment", "take-home test"]):
            return "ASSESSMENT"

        if any(w in lower for w in ["arbitration", "background check authorization", "export control", "conflict of interest"]):
            return "LEGAL_SENSITIVE"

        if any(w in lower for w in ["first name", "last name", "email", "phone", "gpa", "degree", "major", "graduation"]):
            return "SUPPORTED_FACTUAL"

        if any(w in lower for w in ["compensation", "salary", "start date", "preferred location"]):
            return "JOB_DEPENDENT"

        if any(w in lower for w in ["why", "describe", "proud of", "tell me about", "challenge", "cover letter"]):
            return "GENERATED_WRITTEN"

        return "UNSUPPORTED_FACTUAL"

    @staticmethod
    def can_auto_fill(classification: str, confidence: float) -> Tuple[bool, str]:
        """Determine whether field can be automatically populated."""
        if classification == "FINAL_SUBMISSION":
            return False, "Playwright must never submit final application."

        if classification == "ASSESSMENT":
            return False, "Assessments require manual candidate completion."

        if classification == "LEGAL_SENSITIVE":
            return False, "Sensitive legal certifications require manual review."

        if classification == "UNSUPPORTED_FACTUAL":
            return False, "Factual information not found in verified candidate profile."

        if confidence < 0.85:
            return False, f"Confidence {confidence:.2f} is below 0.85 threshold."

        return True, "Approved for automated fill."
