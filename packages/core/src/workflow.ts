import { WorkflowRunResult } from "./result.ts";

export interface WorkflowContext {
    invocationId: string;
    trigger: "schedule" | "manual" | "event";
    timestamp: string;
}

export interface Workflow {
    id: string;
    name: string;
    run(context: WorkflowContext): Promise<WorkflowRunResult>;
}
