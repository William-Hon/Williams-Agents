# Architecture

This repository adopts a isolated-workflow pattern on top of shared thin infrastructure.

## 1. Core Platform (`packages/core`)
The shared core should remain extremely small. It currently provides:
- A shared `Workflow` contract interface
- Structured `WorkflowRunResult` types (`SUCCESS`, `PARTIAL_SUCCESS`, `FAILED`)
- A standardized, lightweight console logger.

## 2. Workflows (`workflows/*`)
Workflows implement the actual domain logic. They must not depend on each other. If a future `food-organizer` is added, it will have zero knowledge of the `internship-watcher`.

## 3. Database
We share a single Supabase PostgreSQL instance, but tables are strongly domain-specific. Avoid generic "agent_data" tables. Keep schemas explicit and tied to the workflow that owns them.

## 4. Scheduling
Each workflow will eventually be deployed as an independent Supabase Edge Function and scheduled via `pg_cron`. They do not share a global event loop or monolithic scheduler.
