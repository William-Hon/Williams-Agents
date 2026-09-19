import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApplyGuySource } from "../src/sources/applyguy";
import { SimplifySource } from "../src/sources/simplify";
import * as fs from "fs";
import * as path from "path";

const applyguyValid = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/applyguy-valid.json"), "utf8"));
const applyguyMalformed = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/applyguy-malformed.json"), "utf8"));
const simplifyValid = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/simplify-valid.json"), "utf8"));
const simplifyMalformed = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/simplify-malformed.json"), "utf8"));

describe("Source Adapters", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("ApplyGuy handles valid response", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => applyguyValid
        });

        const source = new ApplyGuySource();
        const res = await source.fetch();

        expect(res.success).toBe(true);
        expect(res.rawRecordCount).toBe(1);
        expect(res.validRecordCount).toBe(1);
        expect(res.invalidRecordCount).toBe(0);
        expect(res.records[0].company).toBe("Bear Robotics");
    });

    it("ApplyGuy handles malformed individual records gracefully", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => applyguyMalformed
        });

        const source = new ApplyGuySource();
        const res = await source.fetch();

        expect(res.success).toBe(true);
        expect(res.rawRecordCount).toBe(1);
        expect(res.validRecordCount).toBe(0);
        expect(res.invalidRecordCount).toBe(1);
        expect(res.warnings.length).toBe(1);
    });

    it("ApplyGuy handles non-200 HTTP", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            headers: new Headers()
        });

        const source = new ApplyGuySource();
        const res = await source.fetch();

        expect(res.success).toBe(false);
        expect(res.error).toContain("HTTP Error: 500");
    });

    it("ApplyGuy handles completely invalid top-level JSON", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ([{ unexpected_array: true }])
        });

        const source = new ApplyGuySource();
        const res = await source.fetch();

        expect(res.success).toBe(false);
        expect(res.error).toContain("Top-level structure is incompatible");
    });

    it("Simplify handles valid response", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => simplifyValid
        });

        const source = new SimplifySource();
        const res = await source.fetch();

        expect(res.success).toBe(true);
        expect(res.rawRecordCount).toBe(1);
        expect(res.validRecordCount).toBe(1);
        expect(res.records[0].company_name).toBe("The Walt Disney Company");
    });

    it("Simplify handles malformed individual records", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => simplifyMalformed
        });

        const source = new SimplifySource();
        const res = await source.fetch();

        expect(res.success).toBe(true);
        expect(res.validRecordCount).toBe(0);
        expect(res.invalidRecordCount).toBe(1);
    });
});
