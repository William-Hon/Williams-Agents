-- Phase 4 Migration: Canonical Jobs, Deduplication, and Audit View

-- 1. Create canonical_jobs
CREATE TABLE IF NOT EXISTS public.canonical_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    apply_url TEXT NOT NULL,
    normalized_url TEXT,
    locations JSONB DEFAULT '[]'::jsonb,
    terms JSONB DEFAULT '[]'::jsonb,
    category TEXT,
    is_job_specific BOOLEAN NOT NULL DEFAULT FALSE,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index for concurrency safety on job-specific URLs
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_specific_url 
ON public.canonical_jobs(normalized_url) 
WHERE is_job_specific = TRUE;

-- 2. Alter job_listings to link to canonical_jobs
ALTER TABLE public.job_listings
ADD COLUMN canonical_job_id UUID REFERENCES public.canonical_jobs(id) ON DELETE SET NULL,
ADD COLUMN canonical_match_method TEXT;

ALTER TABLE public.job_listings
ADD CONSTRAINT chk_match_method CHECK (
    canonical_match_method IN ('created_canonical', 'exact_url', 'normalized_url', 'source_fallback')
);

CREATE INDEX IF NOT EXISTS idx_job_listings_canonical_job_id ON public.job_listings(canonical_job_id);
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_normalized_url ON public.canonical_jobs(normalized_url);
CREATE INDEX IF NOT EXISTS idx_canonical_jobs_apply_url ON public.canonical_jobs(apply_url);

-- 3. Create discovery_events
CREATE TABLE IF NOT EXISTS public.discovery_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_job_id UUID NOT NULL REFERENCES public.canonical_jobs(id) ON DELETE CASCADE UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_discovery_status CHECK (status IN ('pending', 'notified'))
);

-- 4. Create baseline_state
CREATE TABLE IF NOT EXISTS public.baseline_state (
    id INT PRIMARY KEY DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'not_initialized',
    completed_at TIMESTAMPTZ,
    
    CONSTRAINT chk_single_row CHECK (id = 1),
    CONSTRAINT chk_baseline_status CHECK (status IN ('not_initialized', 'in_progress', 'completed'))
);

INSERT INTO public.baseline_state (id, status) VALUES (1, 'not_initialized') ON CONFLICT (id) DO NOTHING;

-- 5. Extend the Phase 3 RPC to return inserted rows
CREATE OR REPLACE FUNCTION upsert_job_listings(payload JSONB)
RETURNS JSONB AS $$
DECLARE
    job JSONB;
    v_source TEXT;
    v_source_job_id TEXT;
    v_company TEXT;
    v_title TEXT;
    v_locations JSONB;
    v_apply_url TEXT;
    v_terms JSONB;
    v_category TEXT;
    v_source_url TEXT;
    v_posted_at TIMESTAMPTZ;
    v_active BOOLEAN;

    existing_record RECORD;
    inserted_count INT := 0;
    updated_count INT := 0;
    unchanged_count INT := 0;
    
    new_inserted_row JSONB;
    inserted_rows JSONB := '[]'::jsonb;
BEGIN
    FOR job IN SELECT * FROM jsonb_array_elements(payload)
    LOOP
        v_source := job->>'source';
        v_source_job_id := job->>'sourceJobId';
        v_company := job->>'company';
        v_title := job->>'title';
        v_locations := job->'locations';
        v_apply_url := job->>'applyUrl';
        v_terms := job->'terms';
        v_category := job->>'category';
        v_source_url := job->>'sourceUrl';
        v_active := (job->>'active')::BOOLEAN;

        IF job->>'postedAt' IS NOT NULL THEN
            v_posted_at := (job->>'postedAt')::TIMESTAMPTZ;
        ELSE
            v_posted_at := NULL;
        END IF;

        SELECT * INTO existing_record FROM public.job_listings 
        WHERE source = v_source AND source_job_id = v_source_job_id FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO public.job_listings (
                source, source_job_id, company, title, locations, 
                apply_url, terms, category, source_url, posted_at, active
            ) VALUES (
                v_source, v_source_job_id, v_company, v_title, v_locations,
                v_apply_url, v_terms, v_category, v_source_url, v_posted_at, v_active
            ) RETURNING id, source, source_job_id INTO existing_record;
            
            inserted_count := inserted_count + 1;
            
            -- Keep track of precisely which records were newly inserted
            new_inserted_row := jsonb_build_object(
                'id', existing_record.id,
                'source', existing_record.source,
                'source_job_id', existing_record.source_job_id
            );
            inserted_rows := inserted_rows || new_inserted_row;
        ELSE
            IF existing_record.company IS DISTINCT FROM v_company OR
               existing_record.title IS DISTINCT FROM v_title OR
               existing_record.locations::jsonb IS DISTINCT FROM v_locations OR
               existing_record.apply_url IS DISTINCT FROM v_apply_url OR
               existing_record.terms::jsonb IS DISTINCT FROM v_terms OR
               existing_record.category IS DISTINCT FROM v_category OR
               existing_record.source_url IS DISTINCT FROM v_source_url OR
               existing_record.posted_at IS DISTINCT FROM v_posted_at OR
               existing_record.active IS DISTINCT FROM v_active THEN
               
               UPDATE public.job_listings SET
                    company = v_company,
                    title = v_title,
                    locations = v_locations,
                    apply_url = v_apply_url,
                    terms = v_terms,
                    category = v_category,
                    source_url = v_source_url,
                    posted_at = v_posted_at,
                    active = v_active,
                    last_seen_at = NOW()
               WHERE source = v_source AND source_job_id = v_source_job_id;
               updated_count := updated_count + 1;
            ELSE
               UPDATE public.job_listings SET
                    last_seen_at = NOW()
               WHERE source = v_source AND source_job_id = v_source_job_id;
               unchanged_count := unchanged_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'inserted', inserted_count,
        'updated', updated_count,
        'unchanged', unchanged_count,
        'inserted_rows', inserted_rows
    );
END;
$$ LANGUAGE plpgsql;

-- 6. Create canonical_jobs_inspection view
CREATE OR REPLACE VIEW public.canonical_jobs_inspection AS
SELECT 
    cj.id AS canonical_job_id,
    cj.company,
    cj.title,
    cj.apply_url,
    cj.normalized_url,
    cj.first_seen_at,
    COUNT(jl.id) > 1 AS is_deduplicated,
    COUNT(jl.id) AS source_record_count,
    COUNT(DISTINCT jl.source) AS distinct_source_count,
    COALESCE(
        array_agg(jl.id ORDER BY jl.source, jl.source_job_id) FILTER (WHERE jl.id IS NOT NULL), 
        '{}'::uuid[]
    ) AS linked_source_record_ids,
    COALESCE(
        array_agg(DISTINCT jl.source) FILTER (WHERE jl.source IS NOT NULL), 
        '{}'::text[]
    ) AS linked_sources,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', jl.id,
                'source', jl.source,
                'source_job_id', jl.source_job_id,
                'company', jl.company,
                'title', jl.title,
                'apply_url', jl.apply_url,
                'canonical_match_method', jl.canonical_match_method
            ) ORDER BY jl.source, jl.source_job_id
        ) FILTER (WHERE jl.id IS NOT NULL), 
        '[]'::jsonb
    ) AS linked_records
FROM 
    public.canonical_jobs cj
LEFT JOIN 
    public.job_listings jl ON jl.canonical_job_id = cj.id
GROUP BY 
    cj.id;

-- 7. RPC for Canonical Processing
CREATE OR REPLACE FUNCTION process_canonical_batch(payload JSONB, is_baseline BOOLEAN)
RETURNS JSONB AS $$
DECLARE
    item JSONB;
    v_jl_id UUID;
    v_norm_url TEXT;
    v_is_specific BOOLEAN;
    
    jl_row RECORD;
    cj_id UUID;
    v_match_method TEXT;
    v_created BOOLEAN;
    
    stats_exact INT := 0;
    stats_norm INT := 0;
    stats_fallback INT := 0;
    stats_created INT := 0;
    stats_linked INT := 0;
    stats_discovery INT := 0;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(payload)
    LOOP
        v_jl_id := (item->>'id')::UUID;
        v_norm_url := item->>'normalized_url';
        v_is_specific := (item->>'is_job_specific')::BOOLEAN;
        v_created := FALSE;
        
        -- Get the job listing
        SELECT * INTO jl_row FROM public.job_listings WHERE id = v_jl_id FOR UPDATE;
        CONTINUE WHEN jl_row.canonical_job_id IS NOT NULL; -- Skip already linked
        
        IF v_is_specific THEN
            -- Step 1: Exact Match
            SELECT id INTO cj_id FROM public.canonical_jobs WHERE apply_url = jl_row.apply_url AND is_job_specific = TRUE LIMIT 1;
            IF FOUND THEN
                v_match_method := 'exact_url';
                stats_exact := stats_exact + 1;
            ELSE
                -- Step 2: Normalized Match
                SELECT id INTO cj_id FROM public.canonical_jobs WHERE normalized_url = v_norm_url AND is_job_specific = TRUE LIMIT 1;
                IF FOUND THEN
                    v_match_method := 'normalized_url';
                    stats_norm := stats_norm + 1;
                ELSE
                    -- Create new canonical
                    INSERT INTO public.canonical_jobs (
                        company, title, apply_url, normalized_url, locations, terms, category, is_job_specific
                    ) VALUES (
                        jl_row.company, jl_row.title, jl_row.apply_url, v_norm_url, jl_row.locations, jl_row.terms, jl_row.category, TRUE
                    )
                    ON CONFLICT (normalized_url) WHERE is_job_specific = TRUE 
                    DO NOTHING
                    RETURNING id INTO cj_id;
                    
                    IF cj_id IS NULL THEN
                        -- Concurrency: another process just inserted it
                        SELECT id INTO cj_id FROM public.canonical_jobs WHERE normalized_url = v_norm_url AND is_job_specific = TRUE;
                        v_match_method := 'normalized_url';
                        stats_norm := stats_norm + 1;
                    ELSE
                        v_created := TRUE;
                        v_match_method := 'created_canonical';
                        stats_created := stats_created + 1;
                    END IF;
                END IF;
            END IF;
        ELSE
            -- Step 3: Source Fallback
            INSERT INTO public.canonical_jobs (
                company, title, apply_url, normalized_url, locations, terms, category, is_job_specific
            ) VALUES (
                jl_row.company, jl_row.title, jl_row.apply_url, v_norm_url, jl_row.locations, jl_row.terms, jl_row.category, FALSE
            ) RETURNING id INTO cj_id;
            
            v_created := TRUE;
            v_match_method := 'source_fallback';
            stats_fallback := stats_fallback + 1;
            stats_created := stats_created + 1;
        END IF;
        
        -- Link it
        UPDATE public.job_listings 
        SET canonical_job_id = cj_id, canonical_match_method = v_match_method
        WHERE id = v_jl_id;
        stats_linked := stats_linked + 1;
        
        -- Discovery Event
        IF v_created AND NOT is_baseline THEN
            INSERT INTO public.discovery_events (canonical_job_id, status) VALUES (cj_id, 'pending');
            stats_discovery := stats_discovery + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'exact', stats_exact,
        'normalized', stats_norm,
        'fallback', stats_fallback,
        'created', stats_created,
        'linked', stats_linked,
        'discovery_events', stats_discovery
    );
END;
$$ LANGUAGE plpgsql;
