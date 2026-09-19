export function cleanString(val: string | null | undefined): string | null {
  if (!val || typeof val !== 'string') return null;
  const cleaned = val.trim().replace(/\s+/g, ' ');
  return cleaned.length > 0 ? cleaned : null;
}

export function cleanUrl(url: string | null | undefined): string | null {
  const cleaned = cleanString(url);
  if (!cleaned) return null;
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
