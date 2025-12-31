import type { Player, TeamName, Pair, Match, PointType, TournamentSettings } from '../types';

/**
 * Fisher-Yates shuffle algorithm for randomization
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 生成所有可能的雙打配對
 */
export function generatePairs(players: Player[]): Pair[] {
  const pairs: Pair[] = [];
  
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      pairs.push({
        player1: players[i],
        player2: players[j],
        totalAge: players[i].age + players[j].age,
      });
    }
  }
  
  return pairs;
}

/**
 * 檢查配對是否符合最後一點的規則（混雙或女雙）
 */
function isValidLastPointPair(pair: Pair): boolean {
  // Check if players exist
  if (!pair.player1 || !pair.player2) return false;
  
  // 女雙：兩位都是女性
  const isWomensDouble = pair.player1.gender === '女' && pair.player2.gender === '女';
  
  // 混雙：一男一女
  const isMixedDouble = (pair.player1.gender === '男' && pair.player2.gender === '女') ||
                        (pair.player1.gender === '女' && pair.player2.gender === '男');
  
  return isWomensDouble || isMixedDouble;
}

/**
 * 檢查選手是否可以再出賽（檢查最少出賽次數）
 */
function canPlayMore(player: Player, minMatches: number, scheduledMatches: Map<string, number>): boolean {
  const scheduled = scheduledMatches.get(player.id) || 0;
  return scheduled < (minMatches + 1);
}

/**
 * 為指定的點數和兩個隊伍找到合適的配對
 */
function findPairForPoint(
  pointNumber: PointType,
  teamPlayers: Player[],
  usedPairs: Set<string>,
  existingPairs: Pair[] | null = null,
  settings: TournamentSettings,
  scheduledMatches: Map<string, number>
): Pair | null {
  // Shuffle players to randomize pairing priority
  const shuffledPlayers = shuffleArray(teamPlayers);
  const availablePlayers = shuffledPlayers.filter(p => canPlayMore(p, settings.minMatchesPerPlayer, scheduledMatches));
  const allPairs = generatePairs(availablePlayers);
  
  // 根據點數過濾配對
  let validPairs = allPairs.filter(pair => {
    const pairKey = getPairKey(pair);
    if (usedPairs.has(pairKey)) return false;
    
    if (pointNumber === settings.pointsPerRound) {
      return isValidLastPointPair(pair);
    }
    return true;
  });
  
  if (validPairs.length === 0) return null;
  
  // 如果不是最後一點，需要按年齡排序
  if (pointNumber < settings.pointsPerRound) {
    validPairs.sort((a, b) => a.totalAge - b.totalAge);
    
    // 如果已經有其他點的配對，要確保年齡遞增
    if (existingPairs && existingPairs.length > 0) {
      const maxExistingAge = Math.max(...existingPairs.map(p => p.totalAge));
      validPairs = validPairs.filter(p => p.totalAge > maxExistingAge);
    }
    
    // 從符合年齡條件的前N個配對中隨機選擇，確保公平性
    if (validPairs.length > 0) {
      const topCandidates = validPairs.slice(0, Math.min(5, validPairs.length));
      const randomIndex = Math.floor(Math.random() * topCandidates.length);
      return topCandidates[randomIndex];
    }
  } else {
    // 最後一點（混雙或女雙）：從所有符合規則的配對中隨機選擇
    validPairs = shuffleArray(validPairs);
  }
  
  return validPairs[0] || null;
}

/**
 * 生成配對的唯一鍵
 */
function getPairKey(pair: Pair): string {
  if (!pair.player1 || !pair.player2) return '';
  const ids = [pair.player1.id, pair.player2.id].sort();
  return `${ids[0]}-${ids[1]}`;
}

/**
 * 生成一輪比賽
 */
export function generateRound(
  roundNumber: number,
  teams: { [key in TeamName]: Player[] },
  settings: TournamentSettings,
  scheduledMatches: Map<string, number>
): Match[] {
  const matches: Match[] = [];
  const teamNames: TeamName[] = ['甲隊', '乙隊', '丙隊', '丁隊'];
  
  // 每輪只進行2場對戰（每隊打1場），循環賽制
  // Round 1: 甲vs乙, 丙vs丁
  // Round 2: 甲vs丙, 乙vs丁  
  // Round 3: 甲vs丁, 乙vs丙
  const roundMatchups: { [key: number]: [TeamName, TeamName][] } = {
    1: [['甲隊', '乙隊'], ['丙隊', '丁隊']],
    2: [['甲隊', '丙隊'], ['乙隊', '丁隊']],
    3: [['甲隊', '丁隊'], ['乙隊', '丙隊']],
  };
  
  // 獲取本輪的對戰組合（循環使用）
  const matchupIndex = ((roundNumber - 1) % 3) + 1;
  const matchups = roundMatchups[matchupIndex];
  
  // 追蹤已使用的配對
  const usedPairsInRound = new Map<TeamName, Set<string>>();
  teamNames.forEach(team => usedPairsInRound.set(team, new Set()));
  
  // 為每個對戰生成比賽
  for (const [team1, team2] of matchups) {
    const roundMatches: Match[] = [];
    
    for (let point = 1; point <= settings.pointsPerRound; point++) {
      const pointNumber = point;
      
      // 收集此對戰中已生成的配對（用於年齡遞增檢查）
      const team1ExistingPairs = roundMatches.map(m => m.pair1);
      const team2ExistingPairs = roundMatches.map(m => m.pair2);
      
      // 為team1找配對
      const pair1 = findPairForPoint(
        pointNumber,
        teams[team1],
        usedPairsInRound.get(team1)!,
        pointNumber >= 2 ? team1ExistingPairs : null,
        settings,
        scheduledMatches
      );
      
      if (!pair1) {
        console.warn(`無法為 ${team1} 找到第${point}點的配對`);
        continue;
      }
      
      // 為team2找配對
      const pair2 = findPairForPoint(
        pointNumber,
        teams[team2],
        usedPairsInRound.get(team2)!,
        pointNumber >= 2 ? team2ExistingPairs : null,
        settings,
        scheduledMatches
      );
      
      if (!pair2) {
        console.warn(`無法為 ${team2} 找到第${point}點的配對`);
        continue;
      }
      
      // 記錄已使用的配對
      usedPairsInRound.get(team1)!.add(getPairKey(pair1));
      usedPairsInRound.get(team2)!.add(getPairKey(pair2));
      
      // 創建比賽
      const match: Match = {
        id: `R${roundNumber}-${team1}-${team2}-P${point}`,
        roundNumber,
        pointNumber,
        team1,
        team2,
        pair1,
        pair2,
        team1Games: 0,
        team2Games: 0,
        status: 'scheduled',
      };
      
      roundMatches.push(match);
    }
    
    matches.push(...roundMatches);
  }
  
  return matches;
}

/**
 * 自動生成完整賽程
 */
export function generateFullSchedule(
  teams: { [key in TeamName]: Player[] },
  settings: TournamentSettings
): Match[] {
  const allMatches: Match[] = [];
  // Track scheduled matches per player during generation
  const scheduledMatches = new Map<string, number>();
  
  // Initialize counter for all players
  Object.values(teams).flat().forEach(player => {
    scheduledMatches.set(player.id, 0);
  });
  
  for (let round = 1; round <= settings.totalRounds; round++) {
    const roundMatches = generateRound(round, teams, settings, scheduledMatches);
    allMatches.push(...roundMatches);
    
    // Update scheduled match counts
    roundMatches.forEach(match => {
      [match.pair1.player1, match.pair1.player2, match.pair2.player1, match.pair2.player2].forEach(player => {
        if (player) {
          scheduledMatches.set(player.id, (scheduledMatches.get(player.id) || 0) + 1);
        }
      });
    });
  }
  
  return allMatches;
}

/**
 * 驗證賽程是否符合規則
 */
export function validateSchedule(matches: Match[], players: Player[], settings: TournamentSettings): string[] {
  const errors: string[] = [];
  
  // 檢查每位正式選手是否至少出賽指定場次
  const playerMatchCount = new Map<string, number>();
  matches.forEach(match => {
    [match.pair1.player1, match.pair1.player2, match.pair2.player1, match.pair2.player2].forEach(player => {
      if (player) {
        playerMatchCount.set(player.id, (playerMatchCount.get(player.id) || 0) + 1);
      }
    });
  });
  
  players.forEach(player => {
    const count = playerMatchCount.get(player.id) || 0;
    if (count < settings.minMatchesPerPlayer) {
      errors.push(`選手 ${player.name} 出賽 ${count} 場，應至少${settings.minMatchesPerPlayer}場`);
    }
  });
  
  // 檢查每場比賽的年齡規則
  const matchesByRound = new Map<string, Match[]>();
  matches.forEach(match => {
    const key = `${match.roundNumber}-${match.team1}-${match.team2}`;
    if (!matchesByRound.has(key)) {
      matchesByRound.set(key, []);
    }
    matchesByRound.get(key)!.push(match);
  });
  
  // 檢查規則約束（如果啟用）
  if (settings.enforceRules) {
    // 檢查年齡遞增規則
    matchesByRound.forEach((roundMatches, key) => {
      const sorted = roundMatches.filter(m => m.pointNumber <= 4).sort((a, b) => a.pointNumber - b.pointNumber);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].pair1.totalAge <= sorted[i-1].pair1.totalAge) {
          errors.push(`${key}: 第${sorted[i].pointNumber}點年齡未遞增`);
        }
      }
    });
    
    // 檢查最後一點是否為混雙或女雙
    matches.filter(m => m.pointNumber === settings.pointsPerRound).forEach(match => {
      if (!isValidLastPointPair(match.pair1) || !isValidLastPointPair(match.pair2)) {
        errors.push(`${match.id}: 第${settings.pointsPerRound}點必須為混雙或女雙`);
      }
    });
  }
  
  return errors;
}
