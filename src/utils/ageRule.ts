import type { Player, TournamentSettings } from '../types';

/**
 * Returns the age used only for the age-progression rule. The stored player
 * age remains unchanged; a configured bonus is applied once per female player.
 */
export function getRuleAge(player: Player, settings: TournamentSettings): number {
  return player.age + (player.gender === '女' ? (settings.femaleAgeBonus ?? 0) : 0);
}

export function getRulePairAge(
  player1: Player | null | undefined,
  player2: Player | null | undefined,
  settings: TournamentSettings,
): number {
  return (player1 ? getRuleAge(player1, settings) : 0)
    + (player2 ? getRuleAge(player2, settings) : 0);
}
