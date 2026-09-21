-- Migration: Remove baseline_state table
-- Removes the permanent baseline state table to simplify the architecture, 
-- as requested in Phase 4 simplification.

DROP TABLE IF EXISTS public.baseline_state;
