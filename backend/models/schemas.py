from typing import Optional, List, Dict, Any
from pydantic import BaseModel, HttpUrl, Field


class ApplicationCreate(BaseModel):
    company: str
    role: str
    application_url: str
    job_url: Optional[str] = None
    location: Optional[str] = None
    compensation: Optional[str] = None
    notes: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: int
    company: str
    role: str
    job_url: Optional[str] = None
    application_url: str
    location: Optional[str] = None
    compensation: Optional[str] = None
    status: str
    fit_score: Optional[float] = None
    date_discovered: Optional[str] = None
    date_started: Optional[str] = None
    date_ready_for_review: Optional[str] = None
    date_submitted: Optional[str] = None
    resume_path: Optional[str] = None
    cover_letter_path: Optional[str] = None
    notes: Optional[str] = None


class QuestionAnswerRequest(BaseModel):
    answer: str
    save_as_reusable: bool = False
    category: Optional[str] = "custom"


class NotSubmittedRequest(BaseModel):
    reason: Optional[str] = "Decided not to apply"


class ApprovedAnswerCreate(BaseModel):
    question_pattern: str
    answer: str
    category: Optional[str] = "general"
    source: Optional[str] = "manual_entry"
