import { describe, it, expect } from "vitest";
import { InternshipWatcherWorkflow } from "../src/index";

describe("Internship Watcher Smoke Test", () => {
    it("Instantiates and runs without network activity", async () => {
        const workflow = new InternshipWatcherWorkflow();
        
        const result = await workflow.run({
            invocationId: "test-invocation",
            trigger: "manual",
            timestamp: new Date().toISOString()
        });

        expect(result.workflowId).toBe("internship-watcher");
        expect(result.status).toBe("SUCCESS");
    });
});
