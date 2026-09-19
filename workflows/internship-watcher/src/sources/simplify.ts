import { InternshipSource, SourceFetchResult } from "./source";
import { Logger } from "@autonomous-workflows/core";

export interface SimplifyRawJob {
    source: string;
    category?: string;
    company_name: string;
    id: string;
    title: string;
    active: boolean;
    terms?: string[];
    date_updated?: number;
    date_posted?: number;
    url: string;
    locations?: string[];
    company_url?: string;
    is_visible?: boolean;
    sponsorship?: string;
    degrees?: string[];
}

export function isSimplifyRawJob(value: any): value is SimplifyRawJob {
    if (!value || typeof value !== "object") return false;
    
    if (typeof value.source !== "string") return false;
    if (typeof value.company_name !== "string") return false;
    if (typeof value.id !== "string") return false;
    if (typeof value.title !== "string") return false;
    if (typeof value.url !== "string") return false;
    if (typeof value.active !== "boolean") return false;
    
    return true;
}

export class SimplifySource implements InternshipSource<SimplifyRawJob> {
    public readonly id = "simplify";
    private readonly url = "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/.github/scripts/listings.json";
    private readonly logger = new Logger("internship-watcher");

    async fetch(): Promise<SourceFetchResult<SimplifyRawJob>> {
        const startTime = Date.now();
        const result: SourceFetchResult<SimplifyRawJob> = {
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
            
            if (!Array.isArray(data)) {
                result.error = "Top-level structure is incompatible. Expected an array of jobs.";
                return result;
            }
            
            result.rawRecordCount = data.length;
            
            for (const item of data) {
                if (isSimplifyRawJob(item)) {
                    result.records.push(item);
                    result.validRecordCount++;
                } else {
                    result.invalidRecordCount++;
                    result.warnings.push(`Malformed record skipped. Missing required fields.`);
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
