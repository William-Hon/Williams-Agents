import { JobSource } from "../types/job.ts";

export interface SourceFetchResult<T> {
    source: JobSource;
    success: boolean;
    records: T[];
    
    fetchedAt: string;
    durationMs: number;
    
    rawRecordCount: number;
    validRecordCount: number;
    invalidRecordCount: number;
    
    httpStatus: number | null;
    etag?: string;
    lastModified?: string;
    
    warnings: string[];
    error?: string;
}

export interface InternshipSource<T> {
    id: JobSource;
    fetch(): Promise<SourceFetchResult<T>>;
}
