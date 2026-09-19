import { expect, test, describe } from 'vitest';
import { normalizeApplyGuy } from '../src/normalization/applyguy';
import { normalizeSimplify } from '../src/normalization/simplify';

describe('Normalization', () => {
  describe('ApplyGuy', () => {
    test('standard record', () => {
      const raw = {
        id: "123",
        company: "Acme",
        title: "Software Eng Intern",
        category: "Engineering",
        location: "Boston, MA",
        season: "Summer 2027",
        posted: "2026-09-16",
        url: "https://aggregator.com",
        listingUrl: "https://acme.com/job"
      };
      const res = normalizeApplyGuy(raw);
      expect(res).not.toBeNull();
      expect(res?.source).toBe("applyguy");
      expect(res?.applyUrl).toBe("https://acme.com/job");
      expect(res?.terms).toEqual(["Summer 2027"]);
    });

    test('missing optional season', () => {
      const raw = {
        id: "123", company: "Acme", title: "SWE Intern",
        url: "https://acme.com/job"
      };
      const res = normalizeApplyGuy(raw);
      expect(res?.terms).toEqual([]);
    });
    
    test('fallback to url if listingUrl is missing', () => {
        const raw = { id: "1", company: "A", title: "B", url: "https://fallback.com" };
        const res = normalizeApplyGuy(raw);
        expect(res?.applyUrl).toBe("https://fallback.com/");
    });
    
    test('missing application url returns null', () => {
        const raw = { id: "1", company: "A", title: "B" };
        const res = normalizeApplyGuy(raw);
        expect(res).toBeNull();
    });
  });

  describe('Simplify', () => {
    test('standard record', () => {
      const raw = {
        id: "abc",
        company_name: "Tech Corp",
        title: "AI Intern",
        category: "AI/ML/Data",
        active: true,
        is_visible: true,
        terms: ["Summer 2027", "Fall 2027"],
        date_posted: 1768807345,
        url: "https://techcorp.com/job",
        locations: ["Remote", "New York, NY"]
      };
      const res = normalizeSimplify(raw);
      expect(res).not.toBeNull();
      expect(res?.company).toBe("Tech Corp");
      expect(res?.terms).toEqual(["Summer 2027", "Fall 2027"]);
      expect(res?.locations).toEqual(["Remote", "New York, NY"]);
      expect(res?.active).toBe(true);
    });

    test('inactive record', () => {
      const raw = { id: "1", url: "https://a.com", active: false };
      const res = normalizeSimplify(raw);
      expect(res?.active).toBe(false);
    });
  });
});
