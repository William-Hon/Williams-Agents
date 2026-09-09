# Agentic Automation Workflow

A local-first, human-in-the-loop **Agentic Automation Workflow** for job applications.

This system automates repetitive application preparation—job requirements analysis, fact-constrained resume tailoring, targeted cover letter drafting, and browser navigation—while keeping factual accuracy, sensitive decisions, and final submission under explicit human control.

---

## Key Principles & Guardrails

1. **Zero Hallucination**: Factual information is retrieved strictly from verified sources (`data/application_profile.txt`, `data/experiences.json`, and explicitly approved prior answers). Unsupported fields trigger a `NEEDS_INPUT` flag instead of guessing.
2. **Dedicated Authenticated Session**: Browser automation runs inside a persistent Chrome profile (`data/browser_profile/`) preserving employer logins, cookies, and 2FA. Raw passwords are never stored.
3. **Manual Submission Gate**: Browser automation navigates each application to the final review page and **STOPS**. It never clicks final Submit.
4. **Human Feedback Loop**: Answers to unknown questions provided via the dashboard can optionally be saved as reusable approved answers for future applications.
5. **Local-First V1**: Runs completely on your laptop using local SQLite, local Ollama LLM, and local Playwright browser automation without requiring cloud databases or paid subscriptions.

---

## Repository Structure

```text
agentic-application-workflow/
|-- Agentic_Application_Workflow_Plan.md  # Master architecture & roadmap plan
|-- orchestrator.py                       # Coordinates workflows & runs application queue
|
|-- workflows/
|   |-- job_discovery.py                  # Discovers new eligible roles from job feeds/portals
|   |-- application.py                    # End-to-end preparation, tailoring, and filling pipeline
|   |-- email_monitor.py                  # Gmail monitoring & status matching
|   `-- tracker.py                        # Funnel analytics & auto-fill statistics
|
|-- agents/
|   |-- job_analyzer.py                   # Parses JD for skills, requirements & compensation
|   |-- resume_agent.py                   # Ranks verified experiences & compiles ATS resume
|   |-- cover_letter_agent.py             # Generates grounded, role-specific cover letter
|   |-- answer_agent.py                   # Resolves form questions from verified sources
|   `-- verifier.py                       # Field classification, guardrails & confidence checks
|
|-- tools/
|   |-- browser.py                        # Playwright wrapper for persistent Chrome sessions
|   |-- gmail.py                          # Gmail API client & message classification
|   |-- llm.py                            # Ollama local LLM interface with heuristic fallbacks
|   |-- documents.py                      # Profile, experience bank, & document storage manager
|   |-- database.py                       # SQLite database operations & queries
|   |-- pdf.py                            # LaTeX compilation & ATS PDF formatting
|   `-- notifications.py                  # Windows desktop toast alerts & system notifications
|
|-- backend/
|   |-- main.py                           # FastAPI server entry point
|   |-- routes/
|   |   |-- applications.py               # CRUD, run workflow, answer questions, submit gates
|   |   |-- profile.py                    # Profile & approved answers endpoints
|   |   `-- workflows.py                  # Batch queue, discovery, email check triggers
|   `-- models/
|       `-- schemas.py                    # Pydantic schemas for requests and responses
|
|-- dashboard/                            # React + TypeScript + Vite modern web UI
|   |-- src/
|   |   |-- components/                   # Stats, application list, modals & profile view
|   |   |-- App.tsx                       # Live polling, navigation & workflow triggers
|   |   `-- api.ts                        # Backend API integration
|   `-- package.json
|
|-- data/
|   |-- application_profile.txt           # Master verified candidate profile
|   |-- experiences.json                  # Structured bullet & experience bank
|   |-- approved_answers/                 # Human-approved reusable answers
|   |-- applications.db                   # Local SQLite persistent state
|   `-- browser_profile/                  # Persistent Chrome user data directory
|
|-- prompts/                              # Guardrail rules for resume, cover letter & answers
|-- generated/                            # Tailored resumes & cover letters per application
|-- output/logs/                          # Execution logs
|-- requirements.txt                      # Python dependencies
|-- .env                                  # Local environment configuration
`-- README.md
```

---

## Getting Started

### 1. Backend Setup

Activate the virtual environment and start the FastAPI server:

```powershell
cd C:\Users\32who\agentic-application-workflow
.\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000` with interactive Swagger docs at `http://localhost:8000/docs`.

### 2. Frontend Dashboard Setup

In a separate terminal, start the Vite development server:

```powershell
cd C:\Users\32who\agentic-application-workflow\dashboard
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### 3. Running Workflows Directly

To process all currently queued applications sequentially:

```powershell
.\.venv\Scripts\python.exe orchestrator.py
```

---

## Application State Machine

```text
QUEUED ──> ANALYZING ──> GENERATING_RESUME ──> GENERATING_COVER_LETTER ──> FILLING
                                                                             │
                    ┌────────────────────────────────────────────────────────┴─────────┐
                    ▼                                                                  ▼
               NEEDS_INPUT                                                      READY_FOR_REVIEW
                    │                                                                  │
              (Human answers)                                                   (Manual submit)
                    │                                                                  │
                    ▼                                                                  ▼
                 FILLING                                                      SUBMITTED / NOT_SUBMITTED
```
