export type AccountMode = 'social' | 'salary_person' | 'contract' | 'contractor';

const STORAGE_PREFIX = 'work-social:last-account-mode:';
function storageKey(profileId: string) { return `${STORAGE_PREFIX}${profileId}`; }
export function getLastAccountMode(profileId: string): AccountMode | null { if (typeof window === 'undefined' || !profileId) return null; const value = window.localStorage.getItem(storageKey(profileId)); return value === 'social' || value === 'salary_person' || value === 'contract' || value === 'contractor' ? value : null; }
export function setLastAccountMode(profileId: string, mode: AccountMode) { if (typeof window === 'undefined' || !profileId) return; window.localStorage.setItem(storageKey(profileId), mode); }
export function accountModePath(mode: AccountMode): string { if (mode === 'contractor') return '/work/contractor?view=overview'; if (mode === 'salary_person' || mode === 'contract') return '/work'; return '/'; }
