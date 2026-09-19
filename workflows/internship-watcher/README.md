# Internship Watcher

**Overview:** An autonomous workflow that monitors community-maintained internship feeds (ApplyGuy, Simplify) for 2027 tech internships. It ingests thousands of raw listings, standardizes them, strictly filters out old or irrelevant data, and (soon) will alert the user to newly posted jobs.

## Current Architecture (3-Stage Pipeline)
The system operates on a highly resilient, crash-proof pipeline designed to handle unpredictable third-party data:

1. **Ingestion (Fetch):** Pulls raw JSON feeds concurrently. Uses strict TypeScript type-guards to isolate and drop individually malformed records without crashing the rest of the feed.
2. **Normalization:** Standardizes completely different JSON structures into a single, unified `JobCandidate` schema. It formats arrays, standardizes Dates into ISO strings, and safely parses application URLs.
3. **Filter Engine:** A strict gauntlet that applies your business logic to the normalized data. It accepts a job *only* if it passes these core rules:
   - **URL Validity:** Has a valid, clickable application URL.
   - **Active Status:** Is actively accepting applicants.
   - **Age Limit:** Was posted less than 30 days ago.
   - **Target Year:** Explicitly mentions "2027" (or "'27") in its tags or job title.

## Implementation Phases

### Completed
- [x] **Phase 0 (Skeleton):** Monorepo architecture separating shared core infrastructure from specific workflow logic.
- [x] **Phase 1 (Ingestion):** Fetching mechanisms for ApplyGuy and Simplify GitHub repos with error isolation.
- [x] **Phase 2 (Normalization & Filtering):** Standardization to the `JobCandidate` schema and implementation of the strict filter engine (URL, Active, Date, Year).
- [x] **Phase 3 (Persistence & Same-Source Deduplication):** Supabase Postgres integration to store filtered jobs and prevent re-insertion of identical listings across pipeline runs.

### Next Up
- [ ] **Phase 4 (Cross-Source Deduplication):** Utilizing normalized URLs to merge duplicate jobs across different repos and establishing a "baseline" to detect truly *new* jobs.
- [ ] **Phase 5 (Notifications):** Integrating `ntfy` to push real-time phone alerts when new jobs pass the filter.

### Future
- [ ] **Phase 6:** Complete the local pipeline orchestrator.
- [ ] **Phase 7:** Deploy to Supabase Edge Functions.
- [ ] **Phase 8:** Set up 15-minute automated cron scheduling.
- [ ] **Phase 9:** Reliability, health monitoring, and error alerting.
- [ ] **Phase 10:** Add direct ATS scraping sources beyond GitHub repos.

## Phase 3 Documentation (Persistence & Deduplication)

### Database Architecture
Jobs are permanently stored in Supabase Postgres (`job_listings` table). The table utilizes a **composite unique constraint** on `(source, source_job_id)`. This guarantees that if "ApplyGuy" and "Simplify" miraculously generate the identical ID `123`, they are stored safely as distinct rows without colliding.

### Same-Source Deduplication (UPSERT Cases)
When a pipeline run brings in thousands of jobs, the persistence layer determines the exact scenario for every single job using a custom Postgres RPC function (`upsert_job_listings`) to efficiently upsert without spamming thousands of individual API queries:
1. **CASE A (New Job):** If `(source, source_job_id)` is missing, it INSERTs a new row, setting `first_seen_at` and `last_seen_at` to right now.
2. **CASE B (Changed Job):** If the job exists but metadata (like title or active status) has changed, it UPDATEs the metadata and `last_seen_at`, while carefully preserving `first_seen_at`.
3. **CASE C (Identical Job):** If the job exists and its metadata matches the database exactly, it skips rewriting the identical metadata and *only* UPDATEs the `last_seen_at` timestamp.

### Setup Instructions
1. You must have a configured Supabase project. 
2. Populate the root `.env` file using the variables defined in `.env.example`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Execute the database migration located at `supabase/migrations/20260919000000_create_job_listings.sql` in your Supabase SQL editor (or via Supabase CLI).
4. Run the pipeline locally to see the deduplication in action:
   ```bash
   npm run dev:internship-filter
   ```
   *Run it twice! The first run will INSERT jobs. The second run will identify all jobs as UNCHANGED and purely update the `last_seen_at` timestamps.*

