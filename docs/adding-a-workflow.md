# Adding a Workflow

To add a new workflow (e.g., a `food-organizer`):

1. **Create the Workspace:**
   Create a new directory under `workflows/food-organizer`.
   Initialize a `package.json` and `tsconfig.json` that references `@autonomous-workflows/core`.

2. **Implement Domain Logic:**
   Build your workflow-specific integrations, models, and logic inside `workflows/food-organizer/src`.
   Ensure you implement the `Workflow` interface from the core package.

3. **Logging & Results:**
   Use the shared core logger. Your workflow should gracefully return a `WorkflowRunResult` indicating `SUCCESS`, `PARTIAL_SUCCESS`, or `FAILED` alongside structured metrics and errors.

4. **Testing:**
   Add tests inside your workflow package (`workflows/food-organizer/tests`). 

5. **Deployment:**
   Create a thin entrypoint at `supabase/functions/food-organizer/index.ts` to host your workflow. 
   Add any required database migrations to `supabase/migrations`.

6. **Configuration:**
   Keep your configuration domain-specific (e.g., `FOOD_ORGANIZER_API_KEY`). Do not pollute the core infrastructure with your workflow's configuration.
