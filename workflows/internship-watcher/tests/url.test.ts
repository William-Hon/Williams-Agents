import { describe, test, expect } from "vitest";
import { normalizeApplicationUrl, isJobSpecificUrl } from "../src/normalization/url";

describe("URL Normalization & Classification", () => {
  describe("isJobSpecificUrl", () => {
    test("Recognizes Greenhouse gh_jid", () => {
      expect(isJobSpecificUrl("https://careers.withwaymo.com/jobs?gh_jid=8174099")).toBe(true);
    });

    test("Recognizes embedded tokens", () => {
      expect(isJobSpecificUrl("https://boards.greenhouse.io/embed/job_app?token=8106224")).toBe(true);
    });

    test("Recognizes Workday paths", () => {
      expect(isJobSpecificUrl("https://amgen.wd1.myworkdayjobs.com/en-US/Careers/job/US---Remote/Data-Engineer-Intern_R-11234")).toBe(true);
    });

    test("Recognizes Lever/Ashby roles", () => {
      expect(isJobSpecificUrl("https://jobs.ashbyhq.com/company/role/1234-5678")).toBe(true);
      expect(isJobSpecificUrl("https://jobs.lever.co/company/job/1234-5678")).toBe(true);
    });

    test("Recognizes generic careers pages as NOT job specific", () => {
      expect(isJobSpecificUrl("https://www.company.com/careers")).toBe(false);
      expect(isJobSpecificUrl("https://company.com/jobs")).toBe(false);
      expect(isJobSpecificUrl("https://company.com/open-roles")).toBe(false);
    });

    test("Handles malformed URLs gracefully", () => {
      expect(isJobSpecificUrl("not-a-url")).toBe(false);
      expect(isJobSpecificUrl("")).toBe(false);
    });
  });

  describe("normalizeApplicationUrl", () => {
    test("Removes standard tracking parameters like utm_source", () => {
      const url = "https://careers.withwaymo.com/jobs?gh_jid=8174099&utm_source=applyguy&utm_medium=web";
      expect(normalizeApplicationUrl(url)).toBe("https://careers.withwaymo.com/jobs?gh_jid=8174099");
    });

    test("Preserves unknown query parameters by default", () => {
      const url = "https://www.zipline.com/open-roles?gh_jid=7974890003&some_unknown_param=xyz";
      expect(normalizeApplicationUrl(url)).toBe("https://www.zipline.com/open-roles?gh_jid=7974890003&some_unknown_param=xyz");
    });

    test("Query parameter ordering does not change canonical identity", () => {
      const url1 = "https://careers.withwaymo.com/jobs?b=1&a=2";
      const url2 = "https://careers.withwaymo.com/jobs?a=2&b=1";
      expect(normalizeApplicationUrl(url1)).toBe(normalizeApplicationUrl(url2));
    });

    test("Different gh_jid values remain separate", () => {
      const url1 = normalizeApplicationUrl("https://careers.withwaymo.com/jobs?gh_jid=8174099");
      const url2 = normalizeApplicationUrl("https://careers.withwaymo.com/jobs?gh_jid=8174504");
      expect(url1).not.toBe(url2);
    });

    test("Different token values remain separate", () => {
      const url1 = normalizeApplicationUrl("https://boards.greenhouse.io/embed/job_app?token=8106224");
      const url2 = normalizeApplicationUrl("https://boards.greenhouse.io/embed/job_app?token=8168315");
      expect(url1).not.toBe(url2);
    });

    test("Different Zipline gh_jid values remain separate", () => {
      const url1 = normalizeApplicationUrl("https://www.zipline.com/open-roles?gh_jid=7974890003");
      const url2 = normalizeApplicationUrl("https://www.zipline.com/open-roles?gh_jid=7974897003");
      expect(url1).not.toBe(url2);
    });

    test("Strips URL hashes/fragments", () => {
      const url = "https://company.com/jobs?id=123#application-form";
      expect(normalizeApplicationUrl(url)).toBe("https://company.com/jobs?id=123");
    });

    test("Idempotent and stable for already normalized URLs", () => {
      const original = "https://company.com/jobs?id=123";
      const pass1 = normalizeApplicationUrl(original);
      const pass2 = normalizeApplicationUrl(pass1!);
      expect(pass1).toBe(original);
      expect(pass2).toBe(pass1);
    });

    test("Handles malformed URLs gracefully", () => {
      expect(normalizeApplicationUrl("invalid-url")).toBeNull();
    });
  });
});
