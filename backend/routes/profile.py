from fastapi import APIRouter
from typing import Dict, Any, List
from tools.documents import load_application_profile, load_experiences
from tools.database import get_db_connection
from backend.models.schemas import ApprovedAnswerCreate

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("")
def get_profile():
    return load_application_profile()


@router.get("/experiences")
def get_experience_bank():
    return load_experiences()


@router.get("/answers")
def get_approved_answers():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM approved_answers ORDER BY last_used_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/answers")
def add_reusable_answer(payload: ApprovedAnswerCreate):
    conn = get_db_connection()
    with conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO approved_answers (question_pattern, answer, category, source)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(question_pattern) DO UPDATE SET
                answer = excluded.answer,
                last_used_at = CURRENT_TIMESTAMP
            """,
            (payload.question_pattern, payload.answer, payload.category, payload.source),
        )
        row_id = cursor.lastrowid
    conn.close()
    return {"id": row_id, "status": "SAVED"}
