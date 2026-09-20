import { expect, test, describe } from 'vitest';
import { filterJob } from '../src/filtering/rules';
import { JobCandidate } from '../src/types/job';
import { classifyLocation } from '../src/filtering/location';

const baseJob: JobCandidate = {
  source: 'applyguy',
  sourceJobId: '123',
  company: 'Test Corp',
  title: 'Software Engineering Intern',
  category: 'Software Engineering',
  terms: ['Summer 2027'],
  locations: ['Boston, MA'],
  applyUrl: 'https://test.com/apply',
  sourceUrl: null,
  postedAt: null,
  active: true
};

describe('Filtering Rules', () => {
  test('ACCEPT: Software Engineering Intern — Boston, MA — 2027', () => {
    const res = filterJob(baseJob);
    expect(res.accepted).toBe(true);
  });

  test('ACCEPT: Product Management Intern (technical signal)', () => {
    const res = filterJob({ ...baseJob, title: 'Product Management Intern', category: 'Product' });
    expect(res.accepted).toBe(true);
  });

  test('REJECT: inactive Simplify listing', () => {
    const res = filterJob({ ...baseJob, source: 'simplify', active: false });
    expect(res.accepted).toBe(false);
    expect(res.reason).toBe('INACTIVE');
  });

  test('REJECT: Summer 2026 listing (Simplify)', () => {
    const res = filterJob({ ...baseJob, source: 'simplify', terms: ['Summer 2026'] });
    expect(res.accepted).toBe(false);
    expect(res.reason).toBe('TERM_MISMATCH');
  });

  test('REJECT: applyguy without season (Not specified)', () => {
    const res = filterJob({ ...baseJob, source: 'applyguy', terms: [] });
    expect(res.accepted).toBe(false);
    expect(res.reason).toBe('TERM_MISMATCH');
  });

  test('ACCEPT: London-only listing (Location filter was removed)', () => {
    const res = filterJob({ ...baseJob, locations: ['London, UK'] });
    expect(res.accepted).toBe(true);
  });
  
  test('ACCEPT: UNKNOWN location (Remote)', () => {
      const res = filterJob({ ...baseJob, locations: ['Remote'] });
      expect(res.accepted).toBe(true); 
  });

  test('ACCEPT: Marketing Intern (Role filter was removed)', () => {
    const res = filterJob({ ...baseJob, title: 'Marketing Intern', category: 'Marketing' });
    expect(res.accepted).toBe(true);
  });

  test('ACCEPT: Job posted 5 days ago', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const res = filterJob({ ...baseJob, postedAt: fiveDaysAgo });
    expect(res.accepted).toBe(true);
  });

  test('REJECT: Job posted 31 days ago', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const res = filterJob({ ...baseJob, postedAt: thirtyOneDaysAgo });
    expect(res.accepted).toBe(false);
    expect(res.reason).toBe('TOO_OLD');
  });
});

describe('Location Classification', () => {
  test('Remote -> UNKNOWN', () => expect(classifyLocation('Remote')).toBe('UNKNOWN'));
  test('Boston, MA -> US', () => expect(classifyLocation('Boston, MA')).toBe('US'));
  test('London, UK -> NON_US', () => expect(classifyLocation('London, UK')).toBe('NON_US'));
  test('Remote - US -> US', () => expect(classifyLocation('Remote - US')).toBe('US'));
});
