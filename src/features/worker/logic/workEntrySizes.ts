export const WORK_ENTRY_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '30', '32', '34', '36', '40'] as const;

export const MAX_WORK_ENTRY_SIZE_LENGTH = 100;

export function normalizeWorkEntrySizes(values: readonly string[] | null | undefined): string[] {
  const unique = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique];
}

export function formatWorkEntrySizes(values: readonly string[] | null | undefined): string {
  return values?.length ? values.join(', ') : 'No size';
}
