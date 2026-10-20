import { autoMap, detectHeaderRow, type MatchConfidence } from './column-mapping';
import { AUTO_PROFILE, inferIncomeRule, pickBestProfile, resolveProfileMapping, type ImportProfile } from './profiles';
import type { CellValue, ColumnMapping, IncomeField, SheetRow } from './types';

export interface MappingSuggestion {
  mapping: ColumnMapping;
  confidence: Partial<Record<IncomeField, MatchConfidence>>;
}

export interface SetupSuggestion extends MappingSuggestion {
  headerRowIndex: number;
  headers: CellValue[];
  /** The saved profile that fits, or the automatic one. */
  profile: ImportProfile;
  /** True when a saved profile recognized the file. */
  matched: boolean;
  profileScore: number;
}

/**
 * Column choices for a set of headers: the profile's own header names first, then name
 * recognition for every field the profile does not cover (or all of them without a profile).
 */
export function mapWithProfile(headers: readonly CellValue[], profile: ImportProfile | null): MappingSuggestion {
  const detected = autoMap(headers);
  const mapping: ColumnMapping = {};
  const confidence: Partial<Record<IncomeField, MatchConfidence>> = {};
  const used = new Set<number>();

  if (profile) {
    const fromProfile = resolveProfileMapping(profile, headers);
    for (const [field, column] of Object.entries(fromProfile) as Array<[IncomeField, number]>) {
      mapping[field] = column;
      confidence[field] = 'exact';
      used.add(column);
    }
  }

  for (const [field, column] of Object.entries(detected.mapping) as Array<[IncomeField, number]>) {
    if (mapping[field] !== undefined || used.has(column)) continue;
    mapping[field] = column;
    confidence[field] = detected.confidence[field] ?? 'fuzzy';
    used.add(column);
  }
  return { mapping, confidence };
}

/**
 * First look at a sheet: where the headers are, which saved profile fits, and which column
 * each field comes from.
 */
export function suggestSetup(rows: readonly SheetRow[], profiles: readonly ImportProfile[]): SetupSuggestion {
  const headerRowIndex = detectHeaderRow(rows);
  const headers = [...(rows[headerRowIndex] ?? [])];
  const pick = pickBestProfile(headers, profiles);
  const { mapping, confidence } = mapWithProfile(headers, pick?.profile ?? null);
  const profile = pick ? pick.profile : { ...AUTO_PROFILE, incomeRule: inferIncomeRule(mapping) };
  return { headerRowIndex, headers, profile, matched: pick !== null, profileScore: pick?.score ?? 0, mapping, confidence };
}
