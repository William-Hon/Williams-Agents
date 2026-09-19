export type WorkflowRunStatus = "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";

export interface WorkflowError {
    component: string;
    message: string;
    stack?: string;
}

export interface WorkflowRunResult {
    workflowId: string;
    status: WorkflowRunStatus;
    
    startedAt: string;
    completedAt: string;
    
    metrics?: Record<string, number>;
    warnings?: string[];
    errors?: WorkflowError[];
}
