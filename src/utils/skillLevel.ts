import type { SkillLevel } from '../types';

const SKILL_TIER_ORDER = ['A', 'B', 'C', 'D'] as const;
const SKILL_SUBLEVEL_ORDER = ['1', '2', '3', '4'] as const;

export const SKILL_LEVELS: SkillLevel[] = SKILL_TIER_ORDER.flatMap((tier) =>
  SKILL_SUBLEVEL_ORDER.map((sub) => `${tier}${sub}` as SkillLevel)
);

export function normalizeSkillLevel(raw: unknown, fallback: SkillLevel = 'B2'): SkillLevel {
  const value = String(raw ?? '').trim().toUpperCase();

  if (!value) return fallback;

  if (/^[ABCD][1-4]$/.test(value)) {
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
