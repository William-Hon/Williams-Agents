# Master Implementation Plan: Agentic Application Workflow

> [!IMPORTANT]
> **SCOPE & ARCHITECTURE DIRECTIVES (Source of Truth)**:
> 1. **Human-in-the-Loop & Manual Submission Gate**: You handle logins, 2FA, accounts, reviewing applications, and clicking the final Submit button. The agent **never** automatically submits.
> 2. **Primary Browser Mode**: Attach to running, authenticated Chrome tabs via CDP (`127.0.0.1:9222`). Fallback: dedicated persistent profile (`data/browser_profile/`).
> 3. **LLM Strategy**: Provider-agnostic `tools/llm.py` starting with Ollama for V1, supporting OpenAI-compatible endpoints later.
> 4. **Deterministic First**: Normal code handles basic fields (name, email, phone, school, GPA, work authorization, EEO). LLM is used for ambiguous questions, section disambiguation, JD parsing, and resume tailoring.
> 5. **ATS Implementation Order**: 1. Greenhouse (First Live Slice), 2. Ashby, 3. Lever, 4. Workday later.
> 6. **Deferred Modules**: Job discovery and email checking are deferred for now.

---

## 1. System Components & Responsibilities

| Layer / File | Responsibility |
| :--- | :--- |
| **`tools/browser.py`** | CDP tab attachment (`127.0.0.1:9222`), open tab scanning, fallback persistent context, element typing/selection, file uploading, review page detection. |
| **`tools/ats/greenhouse.py`** | Dedicated Greenhouse adapter targeting standard field selectors, education fieldsets, file attachments, and custom question wrappers. |
| **`tools/llm.py`** | Provider-agnostic LLM interface (`generate`, `generate_structured`, `classify`) supporting Ollama and `/v1/chat/completions`. |
| **`agents/verifier.py`** | Hard guardrails: blocks final submit clicks, blocks sensitive legal/assessment fields, enforces confidence >= 0.85. |
| **`agents/answer_agent.py`** | Grounded question resolution using profile, experiences, and approved answers database. Flags unsupported questions as `NEEDS_INPUT`. |
| **`workflows/application.py`** | End-to-end single application preparation, tailoring, browser filling, and halting at review page. |
| **`orchestrator.py`** | Sequential queue runner; handles `NEEDS_INPUT` and error skips without crashing the loop. |
| **`backend/`** | FastAPI endpoints for Chrome tab scanning, application CRUD, async execution, question answering, and submission marking. |
| **`dashboard/`** | React + Vite UI with tab scanner, application queue, question modals, approved answers manager, and review modal. |

---

## 2. The First Vertical Slice Execution Steps

1. Launch Chrome with debugging enabled:
   `chrome.exe --remote-debugging-port=9222`
2. Open an authenticated Greenhouse job application in Chrome.
3. Open the local dashboard, click **Scan Open Chrome Tabs**, and select the tab to queue it.
4. Click **Run**:
   - Playwright attaches to the open tab over CDP.
   - Deterministic fields (Name, Email, Phone, Location) are filled.
   - Tailored resume and cover letter PDFs are compiled and uploaded.
   - Any unknown question triggers `NEEDS_INPUT` and pauses the application.
   - You answer in the dashboard modal ➔ click **Resume**.
   - Form reaches final review page ➔ status becomes `READY_FOR_REVIEW`.
   - Playwright halts without submitting.
5. You review in the browser and manually click Submit.
6. Click **Mark Submitted** in the dashboard ➔ updates SQLite with timestamp.
