import { InternshipSource, SourceFetchResult } from "./source.ts";
import { Logger } from "@autonomous-workflows/core";

export interface ApplyGuyRawJob {
    id: string;
    company: string;
    title: string;
    category?: string;
    location?: string;
    season?: string;
    posted?: string;
    age?: string;
    url: string;
    listingUrl?: string;
}

export function isApplyGuyRawJob(value: any): value is ApplyGuyRawJob {
    if (!value || typeof value !== "object") return false;
    
    if (typeof value.id !== "string") return false;
    if (typeof value.company !== "string") return false;
    if (typeof value.title !== "string") return false;
    if (typeof value.url !== "string") return false;
    
    return true;
}

export class ApplyGuySource implements InternshipSource<ApplyGuyRawJob> {
    public readonly id = "applyguy";
    private readonly url = "https://raw.githubusercontent.com/ApplyGuy/2027-Internships/main/data/internships.json";
    private readonly logger = new Logger("internship-watcher");

    async fetch(): Promise<SourceFetchResult<ApplyGuyRawJob>> {
        const startTime = Date.now();
        const result: SourceFetchResult<ApplyGuyRawJob> = {
            source: this.id,
            success: false,
            records: [],
            fetchedAt: new Date().toISOString(),
            durationMs: 0,
            rawRecordCount: 0,
            validRecordCount: 0,
            invalidRecordCount: 0,
            httpStatus: null,
            warnings: []
        };
        
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(this.url, {
                signal: controller.signal
            });
            clearTimeout(timeout);
            
            result.httpStatus = response.status;
            result.etag = response.headers.get("etag") || undefined;
            result.lastModified = response.headers.get("last-modified") || undefined;
            
            if (!response.ok) {
                result.error = `HTTP Error: ${response.status} ${response.statusText}`;
                return result;
            }
            
            const data = await response.json();
            
            if (!data || !Array.isArray(data.jobs)) {
                result.error = "Top-level structure is incompatible. Expected { jobs: [] }";
                return result;
            }
            
            result.rawRecordCount = data.jobs.length;
            
            for (const item of data.jobs) {
                if (isApplyGuyRawJob(item)) {
                    result.records.push(item);
                    result.validRecordCount++;
                } else {
                    result.invalidRecordCount++;
                    result.warnings.push(`Malformed record skipped. Missing required id, company, title, or url.`);
                }
            }
            
            result.success = true;
        } catch (err: any) {
            result.error = err.name === "AbortError" ? "Fetch timed out after 10s" : err.message;
        } finally {
            result.durationMs = Date.now() - startTime;
        }
        
        return result;
    }
}
