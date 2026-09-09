import os
import sqlite3
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_DB_PATH = os.getenv("DATABASE_PATH", "data/applications.db")


def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    target_path = Path(db_path or DEFAULT_DB_PATH)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(target_path))
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[str] = None) -> None:
    """Initialize SQLite database with all tables specified in Section 15 of the plan."""
    conn = get_db_connection(db_path)
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company TEXT NOT NULL,
            role TEXT NOT NULL,
            job_url TEXT,
            application_url TEXT NOT NULL,
            location TEXT,
            compensation TEXT,
            status TEXT NOT NULL DEFAULT 'QUEUED',
            fit_score REAL,
            date_discovered TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            date_started TIMESTAMP,
            date_ready_for_review TIMESTAMP,
            date_submitted TIMESTAMP,
            resume_path TEXT,
            cover_letter_path TEXT,
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS application_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
            question_text TEXT NOT NULL,
            answer TEXT,
            answer_source TEXT,
            confidence REAL,
            needs_human BOOLEAN DEFAULT 0,
            approved BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS approved_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_pattern TEXT NOT NULL UNIQUE,
            answer TEXT NOT NULL,
            category TEXT,
            source TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS generated_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
            document_type TEXT NOT NULL, -- 'resume', 'cover_letter'
            file_path TEXT NOT NULL,
            version INTEGER DEFAULT 1,
            sha256 TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS agent_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
            workflow_name TEXT NOT NULL,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at TIMESTAMP,
            status TEXT,
            error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS field_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
            field_label TEXT NOT NULL,
            resolved_value TEXT,
            source TEXT,
            confidence REAL,
            action TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS email_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
            received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            subject TEXT,
            event_type TEXT,
            action_required TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);
        CREATE INDEX IF NOT EXISTS idx_questions_app ON application_questions(application_id);
        CREATE INDEX IF NOT EXISTS idx_docs_app ON generated_documents(application_id);
        """)
    conn.close()


def create_application(
    company: str,
    role: str,
    application_url: str,
    job_url: Optional[str] = None,
    location: Optional[str] = None,
    compensation: Optional[str] = None,
    notes: Optional[str] = None,
    db_path: Optional[str] = None,
) -> int:
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO applications (company, role, application_url, job_url, location, compensation, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, 'QUEUED', ?)
            """,
            (company, role, application_url, job_url, location, compensation, notes),
        )
        app_id = cursor.lastrowid
    conn.close()
    return app_id


def get_application(app_id: int, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM applications WHERE id = ?", (app_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def list_applications(status: Optional[str] = None, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    if status:
        cursor.execute("SELECT * FROM applications WHERE status = ? ORDER BY id DESC", (status,))
    else:
        cursor.execute("SELECT * FROM applications ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_application_status(
    app_id: int,
    status: str,
    db_path: Optional[str] = None,
    **kwargs,
) -> None:
    conn = get_db_connection(db_path)
    now = datetime.now().isoformat()
    fields = ["status = ?"]
    params: List[Any] = [status]

    if status == "ANALYZING" or status == "FILLING":
        fields.append("date_started = COALESCE(date_started, ?)")
        params.append(now)
    elif status == "READY_FOR_REVIEW":
        fields.append("date_ready_for_review = ?")
        params.append(now)
    elif status == "SUBMITTED":
        fields.append("date_submitted = ?")
        params.append(now)

    for k, v in kwargs.items():
        fields.append(f"{k} = ?")
        params.append(v)

    params.append(app_id)
    query = f"UPDATE applications SET {', '.join(fields)} WHERE id = ?"

    with conn:
        conn.execute(query, params)
    conn.close()


def add_question(
    application_id: int,
    question_text: str,
    answer: Optional[str] = None,
    answer_source: Optional[str] = None,
    confidence: Optional[float] = None,
    needs_human: bool = False,
    approved: bool = False,
    db_path: Optional[str] = None,
) -> int:
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO application_questions (application_id, question_text, answer, answer_source, confidence, needs_human, approved)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (application_id, question_text, answer, answer_source, confidence, needs_human, approved),
        )
        qid = cursor.lastrowid
    conn.close()
    return qid


def get_questions_for_application(application_id: int, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM application_questions WHERE application_id = ? ORDER BY id ASC", (application_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def answer_question(
    question_id: int,
    answer: str,
    save_as_reusable: bool = False,
    category: Optional[str] = "custom",
    db_path: Optional[str] = None,
) -> None:
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE application_questions
            SET answer = ?, needs_human = 0, approved = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (answer, question_id),
        )
        if save_as_reusable:
            cursor.execute("SELECT question_text FROM application_questions WHERE id = ?", (question_id,))
            row = cursor.fetchone()
            if row:
                pattern = row["question_text"].strip()
                cursor.execute(
                    """
                    INSERT INTO approved_answers (question_pattern, answer, category, source, last_used_at)
                    VALUES (?, ?, ?, 'human_approval', CURRENT_TIMESTAMP)
                    ON CONFLICT(question_pattern) DO UPDATE SET
                        answer = excluded.answer,
                        last_used_at = CURRENT_TIMESTAMP
                    """,
                    (pattern, answer, category),
                )
    conn.close()


def find_approved_answer(question_text: str, db_path: Optional[str] = None) -> Optional[str]:
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    clean_text = question_text.strip().lower()
    cursor.execute("SELECT question_pattern, answer FROM approved_answers")
    rows = cursor.fetchall()
    conn.close()

    for r in rows:
        pattern = r["question_pattern"].strip().lower()
        if pattern == clean_text or pattern in clean_text or clean_text in pattern:
            return r["answer"]
    return None


def register_document(
    application_id: int,
    document_type: str,
    file_path: str,
    db_path: Optional[str] = None,
) -> int:
    conn = get_db_connection(db_path)
    sha256 = None
    if os.path.exists(file_path):
        with open(file_path, "rb") as f:
            sha256 = hashlib.sha256(f.read()).hexdigest()

    with conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO generated_documents (application_id, document_type, file_path, sha256)
            VALUES (?, ?, ?, ?)
            """,
            (application_id, document_type, file_path, sha256),
        )
        doc_id = cursor.lastrowid

        # Update application table convenience reference
        if document_type == "resume":
            conn.execute("UPDATE applications SET resume_path = ? WHERE id = ?", (file_path, application_id))
        elif document_type == "cover_letter":
            conn.execute("UPDATE applications SET cover_letter_path = ? WHERE id = ?", (file_path, application_id))
    conn.close()
    return doc_id


def get_documents_for_application(application_id: int, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM generated_documents WHERE application_id = ? ORDER BY version DESC", (application_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def log_field_action(
    application_id: int,
    field_label: str,
    resolved_value: Optional[str],
    source: str,
    confidence: float,
    action: str,
    db_path: Optional[str] = None,
) -> None:
    conn = get_db_connection(db_path)
    with conn:
        conn.execute(
            """
            INSERT INTO field_actions (application_id, field_label, resolved_value, source, confidence, action)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (application_id, field_label, resolved_value, source, confidence, action),
        )
    conn.close()


def log_agent_run(
    workflow_name: str,
    application_id: Optional[int] = None,
    status: str = "STARTED",
    error_message: Optional[str] = None,
    db_path: Optional[str] = None,
) -> int:
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO agent_runs (application_id, workflow_name, status, error_message)
            VALUES (?, ?, ?, ?)
            """,
            (application_id, workflow_name, status, error_message),
        )
        run_id = cursor.lastrowid
    conn.close()
    return run_id


def finish_agent_run(run_id: int, status: str = "SUCCESS", error_message: Optional[str] = None, db_path: Optional[str] = None) -> None:
    conn = get_db_connection(db_path)
    with conn:
        conn.execute(
            """
            UPDATE agent_runs
            SET finished_at = CURRENT_TIMESTAMP, status = ?, error_message = ?
            WHERE id = ?
            """,
            (status, error_message, run_id),
        )
    conn.close()
