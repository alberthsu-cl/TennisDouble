import type { SkillLevel } from '../types';

const SKILL_TIER_ORDER = ['A', 'B', 'C', 'D'] as const;

// B5 is a valid level positioned immediately below B4 and above C1.
export const SKILL_LEVELS: SkillLevel[] = [
  'A1', 'A2', 'A3', 'A4',
  'B1', 'B2', 'B3', 'B4', 'B5',
  'C1', 'C2', 'C3', 'C4',
  'D1', 'D2', 'D3', 'D4',
];

export function normalizeSkillLevel(raw: unknown, fallback: SkillLevel = 'B2'): SkillLevel {
  const value = String(raw ?? '').trim().toUpperCase();

  if (!value) return fallback;

  if (/^(?:[ACD][1-4]|B[1-5])$/.test(value)) {
    return value as SkillLevel;
  }

  return fallback;
}

export function getSkillRank(skillLevel: SkillLevel): number {
  const normalized = normalizeSkillLevel(skillLevel);
  const tier = normalized[0] as 'A' | 'B' | 'C' | 'D';
  const sub = Number(normalized[1]);

  const tierScore = (SKILL_TIER_ORDER.length - SKILL_TIER_ORDER.indexOf(tier)) * 10;
  const subScore = 5 - sub;

  return tierScore + subScore;
}

export function getSkillTier(skillLevel: SkillLevel): 'A' | 'B' | 'C' | 'D' {
  return normalizeSkillLevel(skillLevel)[0] as 'A' | 'B' | 'C' | 'D';
}
