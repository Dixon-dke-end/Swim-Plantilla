import { describe, expect, it } from 'vitest';
import { buildProfile } from '../domain/profiles';
import { deleteProfile, loadProfiles, saveProfile, type KeyValueStorage } from './profile-store';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const profile = buildProfile({
  name: 'Mi libro',
  headers: ['Día', 'Venta'],
  mapping: { date: 0, total: 1 },
  accountingMethod: 'cash',
  taxMode: 'none',
  taxRate: 0,
});

describe('profile store', () => {
  it('starts empty', () => {
    expect(loadProfiles(memoryStorage())).toEqual([]);
  });

  it('round-trips a profile', () => {
    const storage = memoryStorage();
    expect(saveProfile(profile, storage)).toBe(true);
    expect(loadProfiles(storage)).toEqual([profile]);
  });

  it('replaces a profile saved under the same name', () => {
    const storage = memoryStorage();
    saveProfile(profile, storage);
    saveProfile({ ...profile, taxMode: 'included', taxRate: 0.19 }, storage);
    const stored = loadProfiles(storage);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.taxMode).toBe('included');
  });

  it('deletes a profile', () => {
    const storage = memoryStorage();
    saveProfile(profile, storage);
    deleteProfile(profile.id, storage);
    expect(loadProfiles(storage)).toEqual([]);
  });

  it('ignores corrupt JSON and malformed entries', () => {
    expect(loadProfiles(memoryStorage({ 'marea:accounting-profiles:v1': '{oops' }))).toEqual([]);
    const mixed = JSON.stringify([profile, { id: 1 }, null, 'x']);
    expect(loadProfiles(memoryStorage({ 'marea:accounting-profiles:v1': mixed }))).toEqual([profile]);
  });

  it('never throws when storage is unavailable', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadProfiles(broken)).toEqual([]);
    expect(saveProfile(profile, broken)).toBe(false);
    expect(() => deleteProfile('x', broken)).not.toThrow();
  });
});
