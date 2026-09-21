import { InternshipSource, SourceFetchResult } from "./source.ts";
import { WorkflowRunStatus } from "@autonomous-workflows/core";

export interface RunnerResult {
    status: WorkflowRunStatus;
    totalAttempted: number;
    totalSucceeded: number;
    totalFailed: number;
    totalValidRecords: number;
    fetchResults: SourceFetchResult<any>[];
}

export class SourceRunner {
    constructor(private readonly sources: InternshipSource<any>[]) {}

    async runAll(): Promise<RunnerResult> {
        const results = await Promise.allSettled(this.sources.map(s => s.fetch()));
        
        const fetchResults: SourceFetchResult<any>[] = results.map((r, i) => {
            if (r.status === "fulfilled") {
                return r.value;
            } else {
                return {
                    source: this.sources[i].id,
                    success: false,
                    records: [],
                    fetchedAt: new Date().toISOString(),
                    durationMs: 0,
                    rawRecordCount: 0,
                    validRecordCount: 0,
                    invalidRecordCount: 0,
                    httpStatus: null,
                    warnings: [],
                    error: r.reason instanceof Error ? r.reason.message : String(r.reason)
                };
            }
        });

        const totalSucceeded = fetchResults.filter(r => r.success).length;
        const totalFailed = this.sources.length - totalSucceeded;
        const totalValidRecords = fetchResults.reduce((acc, r) => acc + r.validRecordCount, 0);
        
        let status: WorkflowRunStatus;
        if (totalFailed === 0 && this.sources.length > 0) {
            status = "SUCCESS";
        } else if (totalSucceeded > 0) {
            status = "PARTIAL_SUCCESS";
        } else {
            status = "FAILED";
        }

        return {
            status,
            totalAttempted: this.sources.length,
            totalSucceeded,
            totalFailed,
            totalValidRecords,
            fetchResults
        };
    }
}
