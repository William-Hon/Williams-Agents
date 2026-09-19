export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export class Logger {
    constructor(private readonly workflowId: string) {}

    private format(level: LogLevel, component: string | undefined, message: string): string {
        const timestamp = new Date().toISOString();
        const prefix = component ? `[${this.workflowId}:${component}]` : `[${this.workflowId}]`;
        return `[${timestamp}] [${level}] ${prefix} ${message}`;
    }

    info(message: string, component?: string, metadata?: Record<string, unknown>) {
        console.log(this.format("INFO", component, message), metadata ? metadata : "");
    }

    warn(message: string, component?: string, metadata?: Record<string, unknown>) {
        console.warn(this.format("WARN", component, message), metadata ? metadata : "");
    }

    error(message: string, component?: string, error?: Error, metadata?: Record<string, unknown>) {
        console.error(this.format("ERROR", component, message), error || "", metadata ? metadata : "");
    }

    debug(message: string, component?: string, metadata?: Record<string, unknown>) {
        console.debug(this.format("DEBUG", component, message), metadata ? metadata : "");
    }
}
