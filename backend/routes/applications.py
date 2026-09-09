from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Optional, Dict, Any

from backend.models.schemas import (
    ApplicationCreate,
    ApplicationResponse,
    QuestionAnswerRequest,
    NotSubmittedRequest,
)
from tools.database import (
    create_application,
    get_application,
    list_applications,
    update_application_status,
    get_questions_for_application,
    answer_question,
    get_documents_for_application,
)
from workflows.application import ApplicationWorkflow

router = APIRouter(prefix="/applications", tags=["Applications"])
workflow = ApplicationWorkflow()


@router.get("", response_model=List[ApplicationResponse])
def get_applications(status: Optional[str] = None):
    return list_applications(status=status)


@router.post("", response_model=ApplicationResponse, status_code=201)
def add_application(payload: ApplicationCreate):
    app_id = create_application(
        company=payload.company,
        role=payload.role,
        application_url=payload.application_url,
        job_url=payload.job_url,
        location=payload.location,
        compensation=payload.compensation,
        notes=payload.notes,
    )
    return get_application(app_id)


@router.get("/{app_id}", response_model=ApplicationResponse)
def get_single_application(app_id: int):
    app = get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.post("/{app_id}/run")
async def run_application_workflow(app_id: int, background_tasks: BackgroundTasks):
    app = get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Run application asynchronously in background task
    background_tasks.add_task(workflow.run, app_id)
    return {"message": f"Workflow initiated for application {app_id}", "status": "QUEUED"}


@router.get("/{app_id}/questions")
def get_questions(app_id: int):
    return get_questions_for_application(app_id)


@router.post("/{app_id}/questions/{question_id}/answer")
def submit_question_answer(
    app_id: int,
    question_id: int,
    payload: QuestionAnswerRequest,
    background_tasks: BackgroundTasks,
):
    answer_question(
        question_id=question_id,
        answer=payload.answer,
        save_as_reusable=payload.save_as_reusable,
        category=payload.category,
    )
    # Check if remaining questions need human input
    questions = get_questions_for_application(app_id)
    remaining_unanswered = [q for q in questions if q.get("needs_human") and not q.get("answer")]

    if not remaining_unanswered:
        # Resume application workflow
        background_tasks.add_task(workflow.run, app_id)
        return {"message": "Question answered. Resuming workflow.", "resumed": True}

    return {"message": "Question answered. Awaiting remaining questions.", "resumed": False}


@router.post("/{app_id}/submitted")
def mark_application_submitted(app_id: int):
    app = get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    update_application_status(app_id, "SUBMITTED")
    return {"message": f"Application {app_id} marked as SUBMITTED", "status": "SUBMITTED"}


@router.post("/{app_id}/not-submitted")
def mark_application_not_submitted(app_id: int, payload: NotSubmittedRequest):
    app = get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    update_application_status(app_id, "NOT_SUBMITTED", notes=payload.reason)
    return {"message": f"Application {app_id} marked as NOT_SUBMITTED", "reason": payload.reason}


@router.get("/{app_id}/documents")
def get_documents(app_id: int):
    return get_documents_for_application(app_id)
