-- supabase/migrations/20260919000000_create_job_listings.sql

CREATE TABLE IF NOT EXISTS job_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    source_job_id TEXT NOT NULL,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    locations JSONB DEFAULT '[]'::jsonb,
    apply_url TEXT NOT NULL,
    terms JSONB DEFAULT '[]'::jsonb,
    category TEXT,
    source_url TEXT,
    posted_at TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_source_source_job_id UNIQUE (source, source_job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_listings_active ON job_listings(active);
CREATE INDEX IF NOT EXISTS idx_job_listings_source ON job_listings(source);

-- Create an RPC to handle the UPSERT and return counts/status cleanly.
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

        SELECT * INTO existing_record FROM job_listings 
        WHERE source = v_source AND source_job_id = v_source_job_id FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO job_listings (
                source, source_job_id, company, title, locations, 
                apply_url, terms, category, source_url, posted_at, active
            ) VALUES (
                v_source, v_source_job_id, v_company, v_title, v_locations,
                v_apply_url, v_terms, v_category, v_source_url, v_posted_at, v_active
            );
            inserted_count := inserted_count + 1;
        ELSE
            -- Check if metadata changed (excluding seen timestamps and generated id)
            IF existing_record.company IS DISTINCT FROM v_company OR
               existing_record.title IS DISTINCT FROM v_title OR
               existing_record.locations::jsonb IS DISTINCT FROM v_locations OR
               existing_record.apply_url IS DISTINCT FROM v_apply_url OR
               existing_record.terms::jsonb IS DISTINCT FROM v_terms OR
               existing_record.category IS DISTINCT FROM v_category OR
               existing_record.source_url IS DISTINCT FROM v_source_url OR
               existing_record.posted_at IS DISTINCT FROM v_posted_at OR
               existing_record.active IS DISTINCT FROM v_active THEN
               
               UPDATE job_listings SET
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
               UPDATE job_listings SET
                    last_seen_at = NOW()
               WHERE source = v_source AND source_job_id = v_source_job_id;
               unchanged_count := unchanged_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'inserted', inserted_count,
        'updated', updated_count,
        'unchanged', unchanged_count
    );
END;
$$ LANGUAGE plpgsql;
