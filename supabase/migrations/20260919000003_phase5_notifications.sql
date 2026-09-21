-- Phase 5 Additive Migration

-- 1. Add application tracking to canonical_jobs
ALTER TABLE public.canonical_jobs
ADD COLUMN application_status TEXT NOT NULL DEFAULT 'not_applied',
ADD COLUMN application_status_updated_at TIMESTAMPTZ NULL;

ALTER TABLE public.canonical_jobs
ADD CONSTRAINT chk_application_status CHECK (
    application_status IN ('not_applied', 'applied', 'not_interested')
);

-- 2. Add concurrency claim columns to discovery_events
ALTER TABLE public.discovery_events
ADD COLUMN claimed_at TIMESTAMPTZ NULL,
ADD COLUMN claim_expires_at TIMESTAMPTZ NULL;

-- 3. Create action_tokens table for secure Edge Function actions
CREATE TABLE IF NOT EXISTS public.action_tokens (
    token_hash TEXT PRIMARY KEY,
    canonical_job_id UUID NOT NULL REFERENCES public.canonical_jobs(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_action_token_action CHECK (action IN ('applied', 'not_interested'))
);

CREATE INDEX IF NOT EXISTS idx_action_tokens_canonical_job_id ON public.action_tokens(canonical_job_id);
CREATE INDEX IF NOT EXISTS idx_action_tokens_expires_at ON public.action_tokens(expires_at);
