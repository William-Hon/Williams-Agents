import { describe, it, expect } from "vitest";
import { Logger } from "../src/logging/logger";
import { NotImplementedError } from "../src/errors";
import { getEnvVar } from "../src/config/env";

describe("Core tests", () => {
    it("Logger instantiates properly", () => {
        const logger = new Logger("test-workflow");
        expect(logger).toBeDefined();
    });

    it("NotImplementedError throws correctly", () => {
        expect(() => {
            throw new NotImplementedError();
        }).toThrowError("Not implemented yet");
    });

    it("getEnvVar handles missing required correctly", () => {
        expect(() => getEnvVar("MISSING_VAR_XYZ_123", true)).toThrowError();
    });
});
