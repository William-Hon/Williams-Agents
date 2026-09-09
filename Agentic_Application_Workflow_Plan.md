# Agentic Application Automation Workflow
## Local-First Plan, Current State, Full User Flow, and Cloud Roadmap

> [!IMPORTANT]
> **CURRENT SCOPE FOCUS (Updated)**:
> Job search / discovery and email monitoring / Gmail integration are **deferred** for now.
> All development efforts are strictly focused on building and hardening the **Agentic Application Workflow** (accepting application URLs, analyzing requirements, retrieving grounded profile facts, tailoring resumes & cover letters, Playwright browser form filling, human input for unknown questions, review gate, and submission tracking).

## 1. Project Idea

Build a human-in-the-loop **Agentic Automation Workflow** for job applications.

The system should automate repetitive application work while keeping factual accuracy, sensitive decisions, and final submission under my control.

The system should:

- Accept application links that I have already opened and logged into manually.
- Analyze the job description and application.
- Use my verified application profile, experience records, resume facts, project details, transcript, prior approved answers, and writing rules as source material.
- Tailor my resume using truthful keywords, skills, technologies, and experience from the job description.
- Generate a role-specific cover letter.
- Generate grounded answers for application questions using my verified sources.
- Never infer unsupported factual information.
- Flag questions that require my input.
- Use Playwright to fill applications inside a dedicated Chrome session.
- Navigate each application to the final review page and stop there.
- Move on to the next queued application instead of waiting for me to review immediately.
- Notify me when applications are ready for review, need input, or fail.
- Let me return to a local dashboard to provide missing answers, mark applications as submitted or not submitted, and write those updates to the database.
- Save explicitly approved answers for future reuse when appropriate.

The goal is **not blind mass submission**. The goal is reliable application preparation and browser automation with a manual submission gate.

---

## 2. Current State

### Already established

A master application profile already exists containing:

- Personal information
- Cell/mobile phone number
- Addresses
- Availability
- Education
- Work preferences
- Work authorization
- Citizenship
- Security-clearance status
- Government-employment information
- Compensation rules
- Privacy/terms defaults
- EEO information
- Manual work-experience entries
- A hard rule not to infer blank or unsupported fields

Current source file:

`William_Hon_Application_Profile.txt`

### Architecture already planned

Local V1 stack:

- Python
- React + TypeScript
- Vite
- FastAPI
- Pydantic
- SQLite
- Playwright
- Chrome/Chromium
- Ollama + local LLM
- LaTeX + PDF generation
- Gmail API + OAuth 2.0
- APScheduler or Windows Task Scheduler
- Python logging
- Git
- Docker later

### Current implementation status

The project is still at the planning/specification stage.

Not yet implemented:

- Repository structure
- SQLite schema
- FastAPI backend
- React dashboard
- Playwright worker
- Local LLM wrapper
- Job parser
- Resume tailoring pipeline
- Cover-letter pipeline
- Application-answer pipeline
- Verification/guardrails
- Gmail monitoring
- Job discovery
- Notifications
- Scheduling
- Application queue
- Human feedback loop
- Submission tracking

---

## 3. Local-First Architecture

```text
                         MY LAPTOP

                    React Dashboard
                           |
                           v
                        FastAPI
                           |
                           v
                  Workflow Orchestrator
                           |
        +------------------+------------------+
        |                  |                  |
        v                  v                  v
 Job Discovery       Application        Email Monitor
   Workflow            Workflow            Workflow
        |                  |                  |
        +------------------+------------------+
                           |
                           v
                        SQLite
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
     Profile Data     Experience Data   Workflow State
          |                |                |
          +----------------+----------------+
                           |
                           v
                     Ollama / Local LLM
                           |
                           v
                      Playwright
                           |
                           v
               Dedicated Chrome Session
                           |
                           v
                    Human Review
                           |
                           v
                    Manual Submit
```

Everything in V1 runs locally.

No cloud database is required.
No cloud backend is required.
No paid ChatGPT subscription is required.

---

## 4. Recommended Repository Structure

```text
agentic-application-workflow/
|
|-- orchestrator.py
|
|-- workflows/
|   |-- job_discovery.py
|   |-- application.py
|   |-- email_monitor.py
|   `-- tracker.py
|
|-- agents/
|   |-- job_analyzer.py
|   |-- resume_agent.py
|   |-- cover_letter_agent.py
|   |-- answer_agent.py
|   `-- verifier.py
|
|-- tools/
|   |-- browser.py
|   |-- gmail.py
|   |-- llm.py
|   |-- documents.py
|   |-- database.py
|   |-- pdf.py
|   `-- notifications.py
|
|-- backend/
|   |-- main.py
|   |-- routes/
|   `-- models/
|
|-- dashboard/
|   `-- React + TypeScript + Vite
|
|-- data/
|   |-- application_profile.txt
|   |-- experiences.json
|   |-- approved_answers/
|   |-- applications.db
|   `-- browser_profile/
|
|-- prompts/
|   |-- resume_rules.md
|   |-- cover_letter_rules.md
|   |-- application_answer_rules.md
|   `-- verification_rules.md
|
|-- generated/
|   |-- <company-role-application_id>/
|   |   |-- tailored resume PDF
|   |   `-- tailored cover letter PDF
|   `-- ...
|
|-- output/
|   `-- logs/
|
|-- requirements.txt
|-- .env
|-- .gitignore
`-- README.md
```

---

# 5. Full User Workflow

## Phase A: I create and log into application accounts

I remain responsible for authentication.

### My actions

1. Find jobs I want to apply to.
2. Open the employer application portal.
3. Create an account if required.
4. Complete email verification.
5. Enter passwords manually.
6. Complete 2FA manually.
7. Log into the portal.
8. Open the application.
9. Copy the open application URL into my local dashboard.

The system should never need to know or store my raw password.

Playwright should use an authenticated Chrome profile/session that I created manually.

---

## Phase B: Add applications to the dashboard

The dashboard should provide:

```text
Application URL:
[ https://... ]

[ Add Application ]
```

After I add a URL:

```text
Company: Scale AI
Role: Software Engineering Intern
Status: QUEUED
```

I should be able to queue multiple applications:

```text
Scale AI       QUEUED
Cadence        QUEUED
Schonfeld      QUEUED
ID.me          QUEUED
```

---

## Phase C: Analyze the job

The Job Analyzer extracts:

- Company
- Role
- Location
- Internship term
- Graduation requirements
- Work-authorization requirements
- Compensation
- Required skills
- Preferred skills
- Technologies
- Responsibilities
- Resume keywords
- Team/function when available
- Application-specific questions

Structured output example:

```json
{
  "company": "Scale AI",
  "role": "Software Engineering Intern",
  "required_skills": ["Python", "TypeScript", "React"],
  "preferred_skills": ["LLMs", "evaluations"],
  "graduation_eligible": true,
  "compensation": null
}
```

---

## Phase D: Retrieve verified information

The workflow reads only approved sources:

- Application profile
- Experience database
- Master resume facts
- Project descriptions
- Transcript
- Portfolio information
- Approved prior answers
- Cover-letter rules
- Resume rules
- Application-answer rules

Unsupported facts must never be invented.

---

## Phase E: Tailor the resume

The Resume Agent should:

1. Extract JD keywords.
2. Match them against verified skills.
3. Rank my verified experiences by relevance.
4. Select the strongest bullets.
5. Rephrase only while preserving facts.
6. Never add unsupported technologies or metrics.
7. Generate a role-specific resume.
8. Compile it to PDF through LaTeX.
9. Save the generated file into the workflow's managed local application folder.
10. Register the generated document in SQLite with the correct `application_id`.
11. Store the file path, document type, version, and creation time.
12. Let Playwright retrieve the path from the database for the correct application before uploading.

The workflow should NOT use the Downloads folder as permanent storage.

Recommended local root:

```text
C:\Users\William\Documents\ApplicationAgent\
```

Recommended generated-document structure:

```text
generated/
|
|-- scale-ai-swe-143/
|   |-- William_Hon_Resume_ScaleAI.pdf
|   `-- William_Hon_CoverLetter_ScaleAI.pdf
|
|-- cadence-swe-144/
|   |-- William_Hon_Resume_Cadence.pdf
|   `-- William_Hon_CoverLetter_Cadence.pdf
|
`-- schonfeld-ds-145/
    |-- William_Hon_Resume_Schonfeld.pdf
    `-- William_Hon_CoverLetter_Schonfeld.pdf
```

The application-specific folder should include a unique internal identifier, such as the `application_id`, to prevent file collisions when applying to multiple roles at the same company.

Example internal folder:

`generated/scale-ai-swe-143/`

Example user-facing resume filename:

`William_Hon_Resume_ScaleAI.pdf`

The resume should be ATS-aware but fact-constrained.

---

## Phase F: Generate the cover letter

The Cover Letter Agent should:

1. Read the JD.
2. Research the exact team/function when required.
3. Follow my existing cover-letter rules.
4. Use only verified personal examples.
5. Validate formatting/content constraints.
6. Generate the cover letter.
7. Compile/export it to PDF.
8. Save it in the same application-specific managed folder as the tailored resume.
9. Register the document in SQLite under the same `application_id`.
10. Store the document path, type, version, and creation time.
11. Let Playwright retrieve the exact registered cover-letter path before uploading.

Example:

`generated/scale-ai-swe-143/William_Hon_CoverLetter_ScaleAI.pdf`

---

## Phase G: Generate application answers

For written questions:

1. Read the question.
2. Classify its type.
3. Search verified profile/experience sources.
4. Search prior approved answers.
5. Retrieve the strongest relevant evidence.
6. Generate a concise answer.
7. Verify factual claims.
8. Store question, answer, sources, and confidence.

Example:

```text
Question:
Describe a process you improved.

Retrieved source:
Bain FinOps reporting workflow

Source IDs:
BAIN_01
BAIN_02

Confidence:
0.97
```

---

## Phase H: Field classification and guardrails

### Supported factual field
Examples:

- First name
- GPA
- Graduation date
- Work authorization
- Sponsorship

Action: auto-fill.

### Job-dependent factual field
Examples:

- Expected compensation
- Start date
- Location preference

Action: apply defined rules.

### Generated written answer
Examples:

- Why this company?
- Project you are proud of
- Describe a technical challenge

Action: generate from verified sources, then validate.

### Unsupported factual field
Example:

`Have you previously interviewed with this company?`

If not known:

Action: flag `NEEDS_INPUT`.

### Legal/sensitive certification
Examples:

- Arbitration
- Background-check authorization
- Export-control certification
- Conflict-of-interest certification

Action: manual review.

### Assessment
Examples:

- CodeSignal
- HackerRank
- HireVue
- Cognitive/personality assessment

Action: do not complete automatically.

---

# 5A. Generated File Storage and Upload Mapping

Generated resumes and cover letters should live on the local filesystem, while SQLite stores metadata and paths.

Do NOT store the PDF binary itself inside SQLite unless there is a future reason to do so.

Use:

```text
Filesystem
= actual generated PDF files

SQLite
= metadata + application relationship + file path
```

Recommended project storage:

```text
C:\Users\William\Documents\ApplicationAgent\
|
|-- generated/
|   |-- scale-ai-swe-143/
|   |   |-- William_Hon_Resume_ScaleAI.pdf
|   |   `-- William_Hon_CoverLetter_ScaleAI.pdf
|   |
|   |-- cadence-swe-144/
|   |   |-- William_Hon_Resume_Cadence.pdf
|   |   `-- William_Hon_CoverLetter_Cadence.pdf
|   |
|   `-- ...
|
`-- data/
    `-- applications.db
```

Prefer storing relative paths in SQLite when possible.

Example:

```text
generated/scale-ai-swe-143/William_Hon_Resume_ScaleAI.pdf
```

Then resolve against one project root in Python:

```python
PROJECT_ROOT = Path(r"C:\Users\William\Documents\ApplicationAgent")
full_path = PROJECT_ROOT / stored_path
```

This is cleaner than hardcoding full Windows paths throughout the codebase.

Each generated document should be linked to exactly one application record.

Example `generated_documents` row:

```text
id: 52
application_id: 143
document_type: resume
file_path: generated/scale-ai-swe-143/William_Hon_Resume_ScaleAI.pdf
version: 1
created_at: 2026-09-08 15:10
```

Playwright should never guess which file to upload.

The upload flow should be:

```text
Current application
      |
      v
application_id = 143
      |
      v
Query generated_documents
      |
      +--> document_type = resume
      |
      +--> document_type = cover_letter
      |
      v
Resolve stored relative paths
      |
      v
Verify files exist
      |
      v
Upload exact registered files
      |
      v
Log successful upload in field_actions
```

Conceptual Python flow:

```python
resume = db.get_document(
    application_id=143,
    document_type="resume"
)

cover_letter = db.get_document(
    application_id=143,
    document_type="cover_letter"
)

resume_path = PROJECT_ROOT / resume.file_path
cover_letter_path = PROJECT_ROOT / cover_letter.file_path

browser.upload_resume(resume_path)
browser.upload_cover_letter(cover_letter_path)
```

Optional future improvement:

Store a SHA-256 hash for each generated file so the workflow can verify exactly which file was uploaded.

Example:

```text
document_id: 52
application_id: 143
document_type: resume
sha256: <hash>
upload_status: success
```

This gives traceability without bloating the database with PDF binary data.

# 6. Playwright Application Workflow

Playwright should operate inside a dedicated authenticated Chrome/Chromium session.

For each queued application:

```text
Open application
      |
      v
Read current page
      |
      v
Detect fields
      |
      v
Resolve each field
      |
      +--> Verified answer --> Fill
      |
      +--> Generated answer --> Verify --> Fill
      |
      +--> Unknown --> Flag NEEDS_INPUT
      |
      +--> Legal/sensitive --> Flag
      |
      v
Upload tailored resume
      |
      v
Upload tailored cover letter
      |
      v
Continue through pages
      |
      v
Reach final review page
      |
      v
STOP
```

Playwright must **never click final Submit**.

---

# 7. Multiple Applications in One Chrome Session

The initial implementation should process applications sequentially.

Example:

```text
Scale AI
  -> completed
  -> final review page
  -> leave tab open

Cadence
  -> missing question
  -> mark NEEDS_INPUT
  -> continue to next application

Schonfeld
  -> completed
  -> final review page
  -> leave tab open

ID.me
  -> completed
  -> final review page
  -> leave tab open
```

Important behavior:

- Use one dedicated Chrome window/session.
- Maintain authenticated employer sessions.
- Keep ready-for-review applications in tabs where practical.
- If a tab cannot safely remain open, store the application URL and state so it can be reopened.
- Do not wait for me to review each application before beginning the next one.
- Do not run many browsers concurrently in V1.
- Prefer sequential processing for reliability.

---

# 8. Notifications

When the worker finishes a queue:

```text
Application workflow complete.

3 applications ready for review.
1 application needs input.
0 failures.
```

V1 notification options:

- Windows desktop toast
- Dashboard badge
- Local notification

Future:

- Email notification
- Mobile notification

---

# 9. Local Dashboard

The dashboard is the human-control layer.

Recommended V1 pages:

- Dashboard
- Applications
- Needs Input
- Ready for Review
- Submitted
- Profile
- Approved Answers

Dashboard example:

```text
APPLICATION WORKFLOW

Company       Role                  Status             Action

Scale AI      SWE Intern            READY FOR REVIEW   Open
Cadence       SWE Intern            NEEDS INPUT        Answer
Schonfeld     Data Science Intern   READY FOR REVIEW   Open
ID.me         SWE Intern            QUEUED             Run
Stripe        SWE Intern            SUBMITTED          View
```

---

# 10. Application Statuses

```text
QUEUED
ANALYZING
GENERATING_RESUME
GENERATING_COVER_LETTER
FILLING
NEEDS_INPUT
READY_FOR_REVIEW
SUBMITTED
NOT_SUBMITTED
OA
INTERVIEW
OFFER
REJECTED
WITHDRAWN
ERROR
```

---

# 11. Human Input Workflow

If the workflow cannot safely answer something:

```text
Cadence - Missing Information

Question:
Have you previously interviewed with Cadence?

Answer:
[ __________________________ ]

Save answer:
[ ] Only for this application
[ ] Save as reusable answer

[ Save & Resume ]
```

When I save:

1. Write the answer to SQLite.
2. Mark the question resolved.
3. Optionally add it to approved reusable knowledge.
4. Resume the application workflow.
5. Playwright fills the answer.
6. Continue to final review.
7. Mark `READY_FOR_REVIEW`.

Only explicit human-approved answers should become permanent reusable facts.

---

# 12. Manual Review and Submission

When status becomes `READY_FOR_REVIEW`:

1. Dashboard notifies me.
2. I open the application.
3. I inspect:
   - Personal information
   - Resume
   - Cover letter
   - Written answers
   - Compensation
   - Legal questions
   - All other fields
4. I manually click Submit on the employer site.

The application agent never submits.

---

# 13. Post-Submission Dashboard Flow

After I manually submit, I return to the dashboard.

```text
Scale AI
Software Engineering Intern

Current Status:
READY FOR REVIEW

Did you submit?

[ Mark Submitted ]
[ Mark Not Submitted ]
```

## Mark Submitted

Write to SQLite:

```text
status = SUBMITTED
date_submitted = current timestamp
```

Preserve:

- Resume used
- Cover letter used
- Answers used
- Job URL
- Application URL
- Compensation
- Location
- Notes

## Mark Not Submitted

Write:

```text
status = NOT_SUBMITTED
```

Optional reason:

- Decided not to apply
- Eligibility issue
- Application closed
- Duplicate
- Technical issue
- Other

---

# 14. Feedback Loop

New human answers can become reusable knowledge.

Example:

```text
Question:
Are you willing to travel up to 25%?

Answer:
Yes

Save as reusable profile answer:
YES
```

Workflow:

```text
Unknown question
      |
      v
Human answer
      |
      v
Approved-answer database
      |
      v
Future automatic resolution
```

Generated answers should never automatically become permanent profile facts.

---

# 15. Local SQLite Database

File:

`data/applications.db`

It is the local persistent state for the project.

## applications

```text
id
company
role
job_url
application_url
location
compensation
status
fit_score
date_discovered
date_started
date_ready_for_review
date_submitted
resume_path
cover_letter_path
notes
```

## application_questions

```text
id
application_id
question_text
answer
answer_source
confidence
needs_human
approved
created_at
updated_at
```

## approved_answers

```text
id
question_pattern
answer
category
source
created_at
last_used_at
```

## generated_documents

```text
id
application_id
document_type
file_path
version
sha256
created_at
```

The actual PDF stays on the local filesystem.

SQLite stores only metadata and the path needed to retrieve the correct document for the correct application.

## agent_runs

```text
id
application_id
workflow_name
started_at
finished_at
status
error_message
```

## field_actions

```text
id
application_id
field_label
resolved_value
source
confidence
action
timestamp
```

## email_events

```text
id
application_id
received_at
subject
event_type
action_required
```

---

# 16. Local Backend

Use:

`FastAPI + Pydantic`

FastAPI remains local in V1.

```text
React dashboard
      |
      v
http://localhost:8000
      |
      v
FastAPI
      |
      v
SQLite + workflows
```

Example endpoints:

```text
POST /applications
POST /applications/{id}/run
GET  /applications
GET  /applications/{id}
GET  /applications/{id}/questions
POST /applications/{id}/questions/{question_id}/answer
POST /applications/{id}/submitted
POST /applications/{id}/not-submitted
GET  /profile
POST /profile/answers
```

---

# 17. Local Frontend

Use:

`React + TypeScript + Vite`

Dashboard:

`http://localhost:3000`

Backend:

`http://localhost:8000`

For V1, the dashboard can poll FastAPI every few seconds.

WebSockets are not necessary initially.

---

# 18. Orchestrator

`orchestrator.py` coordinates workflows.

It should not contain all business logic.

```text
orchestrator.py

calls:
workflows/job_discovery.py
workflows/application.py
workflows/email_monitor.py
```

The application workflow calls:

```text
job_analyzer
resume_agent
cover_letter_agent
answer_agent
verifier
browser tool
database tool
notification tool
```

---

# 19. Tool Responsibilities

## browser.py
Wrap Playwright.

- Open URLs
- Read pages
- Detect fields
- Fill text
- Select dropdowns
- Upload files
- Click Next
- Detect review page
- Keep/reopen tabs
- Never click final Submit

## gmail.py
Use Gmail API + OAuth.

- Search recruiting emails
- Read messages
- Match company/role
- Classify updates
- Update application status

## llm.py
Single interface to local or future API models.

Initial:

`Ollama -> local LLM`

Use for:

- JD parsing
- Question classification
- Ambiguous field mapping
- Resume rewriting
- Cover letters
- Application answers

## documents.py

- Load application profile
- Load experience bank
- Load approved answers
- Load writing rules
- Save generated documents

## database.py

- Read/write SQLite
- Add applications
- Update statuses
- Save questions
- Save approved answers
- Log actions

## pdf.py

- Compile LaTeX
- Generate resume PDF
- Generate cover-letter PDF

## notifications.py

- Needs-input notifications
- Ready-for-review notifications
- Queue-complete notifications
- Error notifications

---

# 20. LLM Strategy

## V1

Use Ollama locally.

Benefits:

- No API key required
- No per-request cost
- Private local inference
- Good for extraction/classification
- Useful for drafting

Potential limitation:

- Weaker writing/reasoning than top cloud models

## Future hybrid model strategy

Local model:

- Field classification
- JD extraction
- Relevance ranking
- Basic mapping

Optional API model:

- Important cover letters
- Complex application answers
- Difficult reasoning

All model access should remain behind `tools/llm.py`.

---

# 21. Scheduling

## Local V1

### Job discovery
Run every hour while laptop is on/awake.

### Email monitor
Run every hour while laptop is on/awake.

### Application workflow
Trigger manually from dashboard.

This avoids unexpected browser windows opening.

Use:

- APScheduler, or
- Windows Task Scheduler

---

# 22. Job Discovery Workflow

Future local feature:

```text
Scheduled run
      |
      v
Check job sources
      |
      v
Find new postings
      |
      v
Parse JD
      |
      v
Check eligibility
      |
      v
Calculate fit
      |
      v
Deduplicate
      |
      v
Add strong matches to dashboard
```

Possible sources:

- Company career pages
- Greenhouse
- Ashby
- Lever
- Supported job feeds/APIs

Do not build CAPTCHA bypasses or access-control circumvention.

---

# 23. Email Monitoring Workflow

```text
Scheduled Gmail check
      |
      v
Find recruiting messages
      |
      v
Classify email
      |
      v
Extract:
company
role
status
deadline
action required
      |
      v
Match application
      |
      v
Update SQLite
      |
      v
Notify me
```

Possible classifications:

- Application confirmation
- OA
- Recruiter screen
- Interview
- Final round
- Offer
- Rejection
- Action required

---

# 24. Logging and Observability

Every meaningful action should be logged.

Example:

```text
14:20:01 JobAnalyzer
Detected Python requirement
Confidence: 1.00

14:20:05 ResumeAgent
Selected BAIN_01
Reason: Python + infrastructure relevance

14:20:11 FormAgent
Detected sponsorship field

14:20:11 ProfileResolver
Source: application_profile
Value: No
Confidence: 1.00

14:20:24 FormAgent
Unsupported question detected
Action: NEEDS_INPUT
```

V1:

- Python logging
- `agent_runs`
- `field_actions`

Future:

- OpenTelemetry

---

# 25. Privacy and Security

Keep local in V1:

- Browser cookies
- Chrome profile/session
- Gmail OAuth token
- Application profile
- Personal documents
- Generated application materials
- SQLite DB
- Local LLM

Never commit:

- `.env`
- OAuth tokens
- Browser profiles
- Personal application profile
- Transcripts
- Generated resumes
- Generated cover letters
- SQLite DB
- API keys

Use `.gitignore`.

Passwords and 2FA remain manual.

---

# 26. V1 Tech Stack

## Frontend
- React
- TypeScript
- Vite

## Backend
- Python
- FastAPI
- Pydantic

## Database
- SQLite

## Browser Automation
- Playwright
- Chromium/Chrome

## AI
- Ollama
- Local LLM

## Documents
- JSON
- Markdown
- TXT
- LaTeX
- PDF

## Email
- Gmail API
- OAuth 2.0

## Scheduling
- APScheduler or Windows Task Scheduler

## Logging
- Python logging

## Version Control
- Git / GitHub

## Infrastructure
- Docker after core local workflow works

---

# 27. V1 Build Order

1. Create repository structure. [Done]
2. Create SQLite schema. [Done]
3. Convert profile/experience data into structured files. [Done]
4. Build `database.py`. [Done]
5. Build FastAPI backend. [Done]
6. Build basic React dashboard. [Done]
7. Build Playwright browser wrapper. [In Progress - Deepen Form Interaction]
8. Build Ollama/LLM wrapper. [Done - with Fallback]
9. Build Job Analyzer. [Done]
10. Build factual field resolver. [Done]
11. Build application workflow. [In Progress - End-to-End browser filling]
12. Add resume generation. [Done]
13. Add cover-letter generation. [Done]
14. Add application-answer generation. [Done]
15. Add verifier/guardrails. [Done]
16. Add notifications. [Done]
17. **[DEFERRED FOR NOW]** Add Gmail monitoring.
18. **[DEFERRED FOR NOW]** Add job discovery.
19. Add tests and CI/CD. [In Progress]
20. Add Docker. [Future]

---

# 28. Recommended First Vertical Slice

Do **not** build everything at once.

First prove this:

```text
React dashboard
      |
      v
Add one Greenhouse application URL
      |
      v
FastAPI creates SQLite record
      |
      v
Click Run
      |
      v
Playwright opens application
      |
      v
Fill simple factual fields
      |
      v
Encounter unknown question
      |
      v
Dashboard shows NEEDS_INPUT
      |
      v
I answer it
      |
      v
Workflow resumes
      |
      v
Reach review page
      |
      v
Dashboard shows READY_FOR_REVIEW
      |
      v
I manually submit
      |
      v
I click MARK SUBMITTED
      |
      v
SQLite updates
```

If this works reliably, the core architecture is correct.

---

# 29. Expected V1 Limitations

Likely difficult areas:

- Workday
- iCIMS
- Custom portals
- Dynamic dropdowns
- CAPTCHA
- Session expiration
- 2FA
- File-upload variations
- ATS redesigns
- Local LLM mistakes
- Resume formatting overflow
- Matching email updates to the correct application

The system should fail safely and surface the issue in the dashboard.

---

# 30. Future Improvements

## Structured knowledge base
Move from one large TXT file toward structured records.

Store:

- Verified facts
- Skills
- Experiences
- Projects
- Metrics
- Approved answers
- Application defaults
- Question patterns

## RAG
Later add:

- Embeddings
- Semantic retrieval
- RAG
- pgvector or local vector storage

## Resume fact bank
Create a larger verified bullet bank.

Each bullet should have:

- Experience ID
- Text
- Skills
- Technologies
- Metrics
- Categories
- Verification status

## Claim verification
Add factual-claim extraction.

```text
Generated answer
      |
      v
Extract factual claims
      |
      v
Check source database
      |
      +--> Supported -> approve
      |
      `--> Unsupported -> flag
```

## ATS-specific adapters

```text
GreenhouseAdapter
AshbyAdapter
LeverAdapter
WorkdayAdapter
```

## Recovery logic

Handle:

- Expired login
- Page changed
- Browser crash
- Upload failure
- Unexpected required question
- Navigation failure

## Better observability

Add:

- OpenTelemetry
- Run history
- Failure metrics
- Human-intervention rate
- Auto-fill rate
- Time saved

---

# 31. Why Move to Cloud Later

Do not move to cloud until local execution is reliable.

The reason to move parts to cloud is **availability**, not scale.

Problems cloud can solve:

- Job discovery stops when laptop sleeps.
- Gmail monitoring stops when laptop sleeps.
- Local scheduling depends on laptop uptime.
- Dashboard is only accessible locally.
- SQLite is tied to one device.

---

# 32. Future Hybrid Cloud Architecture

Keep application/browser execution local.

Move always-on state and monitoring to cloud.

```text
                         CLOUD

                  FastAPI Backend
                         |
             +-----------+-----------+
             |           |           |
             v           v           v
        Job Discovery  Email Monitor Scheduler
             |           |           |
             +-----------+-----------+
                         |
                         v
                    PostgreSQL
                         |
                         v
                       HTTPS
                         |
                         v

                         LOCAL

                Application Worker
                         |
                    Playwright
                         |
               Authenticated Chrome
                         |
                 Resume / CL / RAG
                         |
                    Human Review
                         |
                        STOP
```

---

# 33. What Should Move to Cloud

## Cloud later

- PostgreSQL application tracker
- Job discovery
- Email monitoring
- Scheduler
- Job ranking
- Basic classification
- Centralized logs
- Optional dashboard backend

## Keep local

- Playwright form filling
- Authenticated Chrome
- Browser cookies
- Password/2FA interactions
- Sensitive documents initially
- Final review
- Final submission
- Local LLM if desired

---

# 34. Future Cloud Tech Stack

## Backend
FastAPI

## Database
PostgreSQL

Possible providers:

- Supabase
- Neon
- Railway
- Other managed Postgres provider

## Infrastructure
Docker

## Hosting
Possible options:

- Railway
- Render
- Fly.io
- VPS
- Azure/AWS later

## Local-to-cloud communication

Preferred:

```text
Local Application Agent
        |
        v
HTTPS REST API
        |
        v
Cloud FastAPI
        |
        v
PostgreSQL
```

This is preferable to giving the local browser worker direct database credentials long term.

---

# 35. Why Playwright Should Stay Local

Advantages:

- Existing authenticated sessions
- Passwords stay local
- 2FA stays manual
- CAPTCHA can be handled manually
- Easier debugging
- Easier final review
- Less risk from unfamiliar cloud IPs
- Better control over employer portals

---

# 36. Migration Roadmap

## Phase 1: Fully Local

```text
React
FastAPI
SQLite
Playwright
Ollama
Gmail API
LaTeX
```

Goal:

Prove the end-to-end workflow.

## Phase 2: Local Hardening

Add:

- Docker
- Tests
- CI/CD
- Better logging
- ATS adapters
- Better verification
- Better dashboard
- Job discovery
- Email monitoring

Goal:

Make the local system reliable.

## Phase 3: Hybrid Cloud

Move:

- SQLite -> PostgreSQL
- Job discovery -> cloud
- Email monitoring -> cloud
- Scheduler -> cloud
- Persistent backend state -> cloud

Keep:

- Playwright local
- Browser sessions local
- Human review local
- Final submission manual

Goal:

Allow monitoring to work even when my laptop is off.

## Phase 4: Optional Advanced Features

Potential:

- Hosted dashboard
- OpenTelemetry
- Queue service
- Background workers
- Better RAG
- Multi-agent orchestration
- Remote notifications
- Cross-device access

Only build these when they solve a real problem.

---

# 37. Metrics to Track

Once implemented, measure:

- Percentage of application fields auto-resolved
- Percentage requiring manual input
- Average preparation time
- Average manual review time
- Number of applications processed
- Number of tailored resumes generated
- Number of tailored cover letters generated
- Number of approved answers reused
- Workflow failure rate
- Browser recovery rate
- Email classification accuracy
- Job-discovery precision
- Time saved per application

Do not use resume metrics until they are actually measured.

---

# 38. Long-Term Project Positioning

Project name:

**Agentic Automation Workflow**

Technical themes demonstrated:

- Agentic AI
- Workflow orchestration
- Human-in-the-loop systems
- Browser automation
- Playwright
- RAG
- LLMs
- Local inference
- Structured retrieval
- Verification/guardrails
- Persistent workflow state
- SQLite/PostgreSQL
- FastAPI
- React/TypeScript
- OAuth
- Gmail API
- Docker
- CI/CD
- Observability
- Document generation
- ATS automation

The engineering value is not simply that the system fills applications.

The system demonstrates the ability to:

1. Retrieve verified personal evidence.
2. Analyze job requirements.
3. Tailor application materials.
4. Generate grounded written answers.
5. Automate browser workflows.
6. Persist application state.
7. Detect uncertainty.
8. Request human input.
9. Learn from explicitly approved answers.
10. Preserve human control over irreversible actions.
11. Eventually separate local browser execution from cloud-based monitoring and orchestration.
