import os
import pytest
from pathlib import Path
from tools.database import (
    init_db,
    create_application,
    get_application,
    list_applications,
    update_application_status,
    add_question,
    get_questions_for_application,
    answer_question,
    register_document,
    get_documents_for_application,
    get_db_connection,
)
from tools.documents import load_application_profile, load_experiences
from agents.job_analyzer import JobAnalyzer
from agents.resume_agent import ResumeAgent
from agents.cover_letter_agent import CoverLetterAgent
from agents.verifier import Verifier
from workflows.tracker import ApplicationTracker

TEST_DB = "data/test_applications.db"


@pytest.fixture(autouse=True)
def setup_teardown():
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)
    init_db(TEST_DB)
    yield
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)


def test_schema_tables_exist():
    conn = get_db_connection(TEST_DB)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {r["name"] for r in cursor.fetchall()}
    conn.close()

    expected_tables = {
        "applications",
        "application_questions",
        "approved_answers",
        "generated_documents",
        "agent_runs",
        "field_actions",
        "email_events",
    }
    assert expected_tables.issubset(tables)


def test_profile_and_experiences():
    profile = load_application_profile()
    assert profile.get("first_name") == "William"
    assert profile.get("last_name") == "Hon"
    assert profile.get("school") == "Northeastern University"
    assert profile.get("gpa") == "3.8"

    experiences = load_experiences()
    assert len(experiences) >= 3
    bain = next(e for e in experiences if "Bain" in e["organization"])
    assert bain["role"] == "Software Engineer Co-op"


def test_crud_and_status():
    app_id = create_application(
        company="Scale AI",
        role="Software Engineering Intern",
        application_url="https://boards.greenhouse.io/scaleai/jobs/123",
        location="San Francisco, CA",
        compensation="$55 - $65/hr",
        db_path=TEST_DB,
    )
    assert app_id > 0

    app = get_application(app_id, db_path=TEST_DB)
    assert app["company"] == "Scale AI"
    assert app["status"] == "QUEUED"

    update_application_status(app_id, "READY_FOR_REVIEW", db_path=TEST_DB)
    updated = get_application(app_id, db_path=TEST_DB)
    assert updated["status"] == "READY_FOR_REVIEW"
    assert updated["date_ready_for_review"] is not None


def test_questions_and_answer_reuse():
    app_id = create_application(
        company="Cadence",
        role="Software Engineering Intern",
        application_url="https://cadence.wd1.myworkdayjobs.com/External/swe",
        db_path=TEST_DB,
    )
    qid = add_question(
        application_id=app_id,
        question_text="Have you previously interviewed with Cadence?",
        needs_human=True,
        db_path=TEST_DB,
    )

    qs = get_questions_for_application(app_id, db_path=TEST_DB)
    assert len(qs) == 1
    assert qs[0]["needs_human"] == 1

    answer_question(qid, "No, this is my first time interviewing.", save_as_reusable=True, db_path=TEST_DB)

    qs_after = get_questions_for_application(app_id, db_path=TEST_DB)
    assert qs_after[0]["answer"] == "No, this is my first time interviewing."
    assert qs_after[0]["needs_human"] == 0


def test_job_analyzer():
    analyzer = JobAnalyzer()
    jd_text = """
    We are looking for a Software Engineering Intern with experience in Python,
    TypeScript, React, Docker, and PostgreSQL. Pay is $50/hour in Boston, MA.
    """
    res = analyzer.analyze(jd_text, default_company="Scale AI", default_role="SWE Intern")
    assert "Python" in res["technologies"]
    assert "React" in res["technologies"]
    assert res["compensation"] == "$50/hour"


def test_verifier_guardrails():
    # Hard guardrails
    assert Verifier.classify_field("Submit Application") == "FINAL_SUBMISSION"
    can_fill, _ = Verifier.can_auto_fill("FINAL_SUBMISSION", 1.0)
    assert can_fill is False

    assert Verifier.classify_field("CodeSignal General Assessment") == "ASSESSMENT"
    can_fill, _ = Verifier.can_auto_fill("ASSESSMENT", 1.0)
    assert can_fill is False

    assert Verifier.classify_field("Binding Arbitration Agreement") == "LEGAL_SENSITIVE"
    can_fill, _ = Verifier.can_auto_fill("LEGAL_SENSITIVE", 1.0)
    assert can_fill is False

    assert Verifier.classify_field("First Name") == "SUPPORTED_FACTUAL"
    can_fill, _ = Verifier.can_auto_fill("SUPPORTED_FACTUAL", 0.99)
    assert can_fill is True
