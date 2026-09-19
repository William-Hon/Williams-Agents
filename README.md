# Autonomous Workflows

This repository hosts a collection of independent autonomous workflows. 

## Architecture

This is **NOT** a single application or a massive generic agent framework. Instead, it is a clean hosting architecture that separates **shared platform infrastructure** from **workflow-specific business logic**.

Each workflow:
- Contains its own domain logic, configuration, and data models
- Runs independently on its own schedule (e.g., via Supabase Cron)
- Can fail gracefully without impacting other workflows
- May be entirely deterministic (fixed logic) or agentic (LLM-powered)

### Directory Structure

- `packages/core/` - Shared lightweight infrastructure (logging, workflow contracts, generic utilities). **No domain logic belongs here.**
- `workflows/` - The business logic for each independent workflow (e.g., `internship-watcher`, future workflows like `food-organizer`).
- `supabase/` - Planned Cloud infrastructure (Edge Functions, database migrations) for deploying and scheduling workflows.

## Workflows

1. **Internship Watcher** - (Active) Autonomously monitors structured feeds for Summer 2027 internships and pushes notifications to a phone. See `workflows/internship-watcher/README.md`.
2. *(Future)* Food Organizer
3. *(Future)* Finance Monitor

## Getting Started

```powershell
# Install dependencies
npm install

# Typecheck everything
npm run typecheck

# Run tests
npm test
```

See `docs/adding-a-workflow.md` for instructions on how to introduce new workflows to this repository.
