import type { ImportProfile } from '../domain/profiles';

/**
 * Custom import profiles live in this browser's localStorage. Storage can be blocked or full
 * (private windows, quota), so nothing here ever throws: the page just works without it.
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'marea:accounting-profiles:v1';

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isProfile(value: unknown): value is ImportProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    typeof profile.mapping === 'object' &&
    profile.mapping !== null &&
    (profile.accountingMethod === 'accrual' || profile.accountingMethod === 'cash') &&
    (profile.taxMode === 'included' || profile.taxMode === 'excluded' || profile.taxMode === 'none') &&
    typeof profile.taxRate === 'number' &&
    (profile.incomeRule === 'all-rows' || profile.incomeRule === 'credit-column-only')
  );
}

export function loadProfiles(storage: KeyValueStorage | null = defaultStorage()): ImportProfile[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isProfile) : [];
  } catch {
    return [];
  }
}

function persist(profiles: readonly ImportProfile[], storage: KeyValueStorage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(KEY, JSON.stringify(profiles));
    return true;
  } catch {
    return false;
  }
}

/** Saves a profile, replacing any saved under the same id. Returns false if it could not be stored. */
export function saveProfile(profile: ImportProfile, storage: KeyValueStorage | null = defaultStorage()): boolean {
  const others = loadProfiles(storage).filter((existing) => existing.id !== profile.id);
  return persist([...others, profile], storage);
}

export function deleteProfile(id: string, storage: KeyValueStorage | null = defaultStorage()): void {
  persist(
    loadProfiles(storage).filter((profile) => profile.id !== id),
    storage,
  );
}
