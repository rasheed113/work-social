export const WORK_ENTRY_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '40'] as const;

export const MAX_WORK_ENTRY_SIZE_LENGTH = 100;

function parsePersistedSizes(value: readonly string[] | string | null | undefined): readonly string[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];

  const trimmed = value.trim();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === 'string')) {
      return parsed;
    }
  } catch {
    // Some PostgREST/client configurations can surface a PostgreSQL text[] as its
    // array-literal form. Parse only that representation; never split ordinary
    // scalar size values such as "40" into characters.
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const body = trimmed.slice(1, -1).trim();
    if (!body) return [];
    return body.split(',').map((item) => item.trim().replace(/^"|"$/g, '').replace(/\\(["\\])/g, '$1'));
  }

  return [trimmed];
}

export function normalizeWorkEntrySizes(values: readonly string[] | string | null | undefined): string[] {
  const unique = new Set<string>();
  for (const value of parsePersistedSizes(values)) {
    const normalized = value.trim();
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique];
}

export function formatWorkEntrySizes(values: readonly string[] | string | null | undefined): string {
  const normalized = normalizeWorkEntrySizes(values);
  return normalized.length ? normalized.join(', ') : 'No size';
}
