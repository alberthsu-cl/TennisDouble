import type { Player, TeamName, Pair, Match, PointType, TournamentSettings, SkillLevel } from '../types';

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
 * Calculate skill score for balancing (A=3, B=2, C=1)
 */
function getSkillScore(skillLevel: SkillLevel): number {
  const scores = { 'A': 3, 'B': 2, 'C': 1 };
  return scores[skillLevel];
}

/**
 * Calculate total skill score for a pair
 */
function getPairSkillScore(pair: Pair): number {
  if (!pair.player1 || !pair.player2) return 0;
  return getSkillScore(pair.player1.skillLevel) + getSkillScore(pair.player2.skillLevel);
}

/**
 * 生成所有可能的雙打配對
 */
export function generatePairs(players: Player[]): Pair[] {
  const pairs: Pair[] = [];
  
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const pair: Pair = {
        player1: players[i],
        player2: players[j],
        totalAge: players[i].age + players[j].age,
        skillScore: getSkillScore(players[i].skillLevel) + getSkillScore(players[j].skillLevel),
      };
      pairs.push(pair);
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
  // Priority 1: Players below minimum MUST play more
  if (scheduled < minMatches) {
    return true;
  }
  // Priority 2: Allow some players to play more to fill remaining slots
  // Use a generous upper limit to accommodate uneven team sizes
  return scheduled < Math.max(minMatches + 3, minMatches * 2.5);
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
  scheduledMatches: Map<string, number>,
  playersUsedInRound: Set<string>
): Pair | null {
  // Sort players by number of scheduled matches (STRONGLY prioritize those with fewer matches)
  const sortedPlayers = [...teamPlayers].sort((a, b) => {
    const aMatches = scheduledMatches.get(a.id) || 0;
    const bMatches = scheduledMatches.get(b.id) || 0;
    // Very strong priority for players below minimum (weight by 1000)
    if (aMatches < settings.minMatchesPerPlayer && bMatches >= settings.minMatchesPerPlayer) return -1000;
    if (bMatches < settings.minMatchesPerPlayer && aMatches >= settings.minMatchesPerPlayer) return 1000;
    // Then sort by match count
    return aMatches - bMatches;
  });
  
  // Strategy: Prioritize fair distribution over rule enforcement
  // Only enforce "one match per round" if we have enough players who haven't reached minimum
  const playersUnderMinimum = sortedPlayers.filter(p => (scheduledMatches.get(p.id) || 0) < settings.minMatchesPerPlayer);
  const shouldEnforceRoundLimit = settings.enforceRules && playersUnderMinimum.length < 2;
  
  let availablePlayers = sortedPlayers.filter(p => {
    const currentMatches = scheduledMatches.get(p.id) || 0;
    // Always include players below minimum, regardless of any constraints
    if (currentMatches < settings.minMatchesPerPlayer) {
      return true;
    }
    // For players at or above minimum, check if they can still play
    const canPlay = canPlayMore(p, settings.minMatchesPerPlayer, scheduledMatches);
    if (!canPlay) return false;
    
    // Only check round usage if we're enforcing AND we have enough players under minimum
    const notUsedInRound = shouldEnforceRoundLimit ? !playersUsedInRound.has(p.id) : true;
    return notUsedInRound;
  });
  
  // If still not enough, take ALL players
  if (availablePlayers.length < 2) {
    console.warn(`Not enough available players (${availablePlayers.length}), using all ${sortedPlayers.length} team players...`);
    availablePlayers = sortedPlayers;
  }
  
  const allPairs = generatePairs(availablePlayers);
  
  // 根據點數過濾配對
  let validPairs = allPairs.filter(pair => {
    const pairKey = getPairKey(pair);
    return !usedPairs.has(pairKey);
  });
  
  if (validPairs.length === 0) {
    console.warn(`No valid pairs available from ${allPairs.length} total pairs`);
    return null;
  }
  
  // 對於最後一點，優先選擇混雙或女雙，但允許男雙作為備選
  if (pointNumber === settings.pointsPerRound) {
    const preferredPairs = validPairs.filter(pair => isValidLastPointPair(pair));
    if (preferredPairs.length > 0) {
      // 優先使用符合規則的配對
      validPairs = preferredPairs;
    }
    // 如果沒有符合規則的配對，仍使用所有可用配對（允許男雙作為最後手段）
  }
  
  // 如果不是最後一點，需要按年齡排序
  if (pointNumber < settings.pointsPerRound) {
    validPairs.sort((a, b) => a.totalAge - b.totalAge);
    
    // 如果已經有其他點的配對，要確保年齡遞增
    if (existingPairs && existingPairs.length > 0) {
      const maxExistingAge = Math.max(...existingPairs.map(p => p.totalAge));
      const filteredByAge = validPairs.filter(p => p.totalAge > maxExistingAge);
      
      // Only apply age filter if we have enough pairs, otherwise skip age constraint
      if (filteredByAge.length > 0) {
        validPairs = filteredByAge;
      } else {
        console.warn(`No pairs satisfy age increasing constraint (max age: ${maxExistingAge}), using all valid pairs`);
      }
    }
    
    // 從符合年齡條件的配對中，優先選擇技術等級平衡的配對
    if (validPairs.length > 0) {
      // Calculate average skill score of existing pairs
      let targetSkillScore = 4; // Default target (B+B = 2+2)
      if (existingPairs && existingPairs.length > 0) {
        const existingScores = existingPairs.map(p => getPairSkillScore(p));
        targetSkillScore = existingScores.reduce((a, b) => a + b, 0) / existingScores.length;
      }
      
      // Sort by skill balance (closer to target) then by age
      validPairs.sort((a, b) => {
        const aSkillDiff = Math.abs((a.skillScore || 0) - targetSkillScore);
        const bSkillDiff = Math.abs((b.skillScore || 0) - targetSkillScore);
        if (Math.abs(aSkillDiff - bSkillDiff) > 0.5) {
          return aSkillDiff - bSkillDiff;
        }
        return a.totalAge - b.totalAge;
      });
      
      // 從技術等級平衡的前幾個配對中隨機選擇，確保公平性
      const topCandidates = validPairs.slice(0, Math.min(3, validPairs.length));
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
  
  let matchups: [TeamName, TeamName][];
  
  if (settings.tournamentMode === 'inter-club') {
    // Inter-club mode: Only matches between home club (甲+乙) vs away club (丙+丁)
    // Each round, create all possible inter-club matchups
    matchups = [
      ['甲隊', '丙隊'],
      ['甲隊', '丁隊'],
      ['乙隊', '丙隊'],
      ['乙隊', '丁隊'],
    ];
  } else {
    // Internal mode: Round-robin among 4 teams
    // Each round, each team plays once against different opponent
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
    matchups = roundMatchups[matchupIndex];
  }
  
  // 追蹤已使用的配對
  const usedPairsInRound = new Map<TeamName, Set<string>>();
  teamNames.forEach(team => usedPairsInRound.set(team, new Set()));
  
  // 追蹤本輪中每位選手已出賽的次數（確保每輪每人只出賽一次）
  const playersUsedInRound = new Set<string>();
  
  // 為每個對戰生成比賽
  for (const [team1, team2] of matchups) {
    // 如果啟用規則，先嘗試生成第5點（優先使用女性選手）
    const pointOrder = settings.enforceRules && settings.pointsPerRound >= 5
      ? [5, 1, 2, 3, 4].slice(0, settings.pointsPerRound)
      : Array.from({ length: settings.pointsPerRound }, (_, i) => i + 1);
    
    const generatedMatches = new Map<number, Match>();
    
    for (const point of pointOrder) {
      const pointNumber = point;
      
      // 收集此對戰中已生成的配對（用於年齡遞增檢查）
      const team1ExistingPairs = Array.from(generatedMatches.values())
        .filter(m => m.pointNumber < pointNumber)
        .map(m => m.pair1);
      const team2ExistingPairs = Array.from(generatedMatches.values())
        .filter(m => m.pointNumber < pointNumber)
        .map(m => m.pair2);
      
      // 為team1找配對
      let pair1 = findPairForPoint(
        pointNumber,
        teams[team1],
        usedPairsInRound.get(team1)!,
        pointNumber >= 2 ? team1ExistingPairs : null,
        settings,
        scheduledMatches,
        playersUsedInRound
      );
      
      // 如果找不到配對，嘗試放寬約束（不考慮年齡遞增）
      if (!pair1 && pointNumber >= 2) {
        console.warn(`無法為 ${team1} 找到第${point}點的配對（考慮年齡遞增），嘗試放寬約束...`);
        pair1 = findPairForPoint(
          pointNumber,
          teams[team1],
          usedPairsInRound.get(team1)!,
          null, // 不考慮年齡遞增約束
          settings,
          scheduledMatches,
          playersUsedInRound
        );
      }
      
      // Final fallback: ignore round usage constraint
      if (!pair1) {
        console.warn(`無法為 ${team1} 找到第${point}點的配對（所有約束），最後嘗試：忽略本輪出賽限制...`);
        pair1 = findPairForPoint(
          pointNumber,
          teams[team1],
          usedPairsInRound.get(team1)!,
          null,
          settings,
          scheduledMatches,
          new Set() // 不檢查本輪是否已出賽
        );
      }
      
      // Ultimate fallback: allow reusing pairs from this round
      if (!pair1) {
        console.warn(`無法為 ${team1} 找到第${point}點的配對，終極嘗試：允許重複配對...`);
        pair1 = findPairForPoint(
          pointNumber,
          teams[team1],
          new Set(), // 允許重複配對
          null,
          settings,
          scheduledMatches,
          new Set()
        );
      }
      
      if (!pair1) {
        console.error(`無法為 ${team1} 找到第${point}點的配對，跳過此點`);
        continue;
      }
      
      // 為team2找配對
      let pair2 = findPairForPoint(
        pointNumber,
        teams[team2],
        usedPairsInRound.get(team2)!,
        pointNumber >= 2 ? team2ExistingPairs : null,
        settings,
        scheduledMatches,
        playersUsedInRound
      );
      
      // 如果找不到配對，嘗試放寬約束（不考慮年齡遞增）
      if (!pair2 && pointNumber >= 2) {
        console.warn(`無法為 ${team2} 找到第${point}點的配對（考慮年齡遞增），嘗試放寬約束...`);
        pair2 = findPairForPoint(
          pointNumber,
          teams[team2],
          usedPairsInRound.get(team2)!,
          null, // 不考慮年齡遞增約束
          settings,
          scheduledMatches,
          playersUsedInRound
        );
      }
      
      // Final fallback: ignore round usage constraint
      if (!pair2) {
        console.warn(`無法為 ${team2} 找到第${point}點的配對（所有約束），最後嘗試：忽略本輪出賽限制...`);
        pair2 = findPairForPoint(
          pointNumber,
          teams[team2],
          usedPairsInRound.get(team2)!,
          null,
          settings,
          scheduledMatches,
          new Set() // 不檢查本輪是否已出賽
        );
      }
      
      // Ultimate fallback: allow reusing pairs from this round
      if (!pair2) {
        console.warn(`無法為 ${team2} 找到第${point}點的配對，終極嘗試：允許重複配對...`);
        pair2 = findPairForPoint(
          pointNumber,
          teams[team2],
          new Set(), // 允許重複配對
          null,
          settings,
          scheduledMatches,
          new Set()
        );
      }
      
      if (!pair2) {
        console.error(`無法為 ${team2} 找到第${pointNumber}點的配對，跳過此點`);
        continue;
      }
      
      // 記錄已使用的配對
      usedPairsInRound.get(team1)!.add(getPairKey(pair1));
      usedPairsInRound.get(team2)!.add(getPairKey(pair2));
      
      // 記錄本輪已出賽的選手（只在規則啟用時記錄）
      if (settings.enforceRules) {
        [pair1.player1, pair1.player2, pair2.player1, pair2.player2].forEach(player => {
          if (player) {
            playersUsedInRound.add(player.id);
          }
        });
      }
      
      // 創建比賽
      const match: Match = {
        id: `R${roundNumber}-${team1}-${team2}-P${pointNumber}`,
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
      
      generatedMatches.set(pointNumber, match);
    }
    
    // 按點數順序添加到結果中
    const sortedPoints = Array.from(generatedMatches.keys()).sort((a, b) => a - b);
    matches.push(...sortedPoints.map(p => generatedMatches.get(p)!));
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
  
  // Log team sizes for debugging
  console.log('=== Starting schedule generation ===');
  Object.entries(teams).forEach(([teamName, players]) => {
    console.log(`${teamName}: ${players.length} players`);
  });
  console.log(`Settings: ${settings.totalRounds} rounds, ${settings.pointsPerRound} points, min ${settings.minMatchesPerPlayer} matches per player`);
  
  for (let round = 1; round <= settings.totalRounds; round++) {
    console.log(`\n=== Generating Round ${round} ===`);
    const roundMatches = generateRound(round, teams, settings, scheduledMatches);
    console.log(`Round ${round}: Generated ${roundMatches.length} matches`);
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
  
  // Log final player match counts
  console.log('\n=== Final Schedule Summary ===');
  console.log(`Total matches generated: ${allMatches.length}`);
  const playerMatchCounts = new Map<string, { name: string, count: number }>();
  allMatches.forEach(match => {
    [match.pair1.player1, match.pair1.player2, match.pair2.player1, match.pair2.player2].forEach(player => {
      if (player) {
        const current = playerMatchCounts.get(player.id) || { name: player.name, count: 0 };
        current.count++;
        playerMatchCounts.set(player.id, current);
      }
    });
  });
  
  const playersWithZeroMatches: string[] = [];
  const playersWithOneMatch: string[] = [];
  
  Object.values(teams).flat().forEach(player => {
    const matchCount = playerMatchCounts.get(player.id)?.count || 0;
    if (matchCount === 0) {
      playersWithZeroMatches.push(player.name);
    } else if (matchCount < settings.minMatchesPerPlayer) {
      playersWithOneMatch.push(player.name);
    }
  });
  
  if (playersWithZeroMatches.length > 0) {
    console.error(`❌ Players with 0 matches (${playersWithZeroMatches.length}):`, playersWithZeroMatches);
  }
  if (playersWithOneMatch.length > 0) {
    console.warn(`⚠️ Players with < min matches (${playersWithOneMatch.length}):`, playersWithOneMatch);
  }
  console.log(`✓ Players with ${settings.minMatchesPerPlayer}+ matches: ${Object.values(teams).flat().length - playersWithZeroMatches.length - playersWithOneMatch.length}`);
  
  // Emergency pass: Force reschedule matches to include players below minimum
  if (playersWithZeroMatches.length > 0 || playersWithOneMatch.length > 0) {
    console.log(`\n=== Emergency Pass: Forcing reschedule for ${playersWithZeroMatches.length + playersWithOneMatch.length} players ===`);
    
    // Get all players who need more matches
    const allPlayers = Object.values(teams).flat();
    const playersNeedingMatches = allPlayers.filter(p => {
      const count = playerMatchCounts.get(p.id)?.count || 0;
      return count < settings.minMatchesPerPlayer;
    });
    
    // For each player needing matches, try to substitute them into existing matches
    for (const player of playersNeedingMatches) {
      const needed = settings.minMatchesPerPlayer - (playerMatchCounts.get(player.id)?.count || 0);
      let added = 0;
      
      // Find matches from player's team where we can substitute
      const teamMatches = allMatches.filter(m => 
        (m.team1 === player.team || m.team2 === player.team)
      );
      
      for (const match of teamMatches) {
        if (added >= needed) break;
        
        // Try to substitute this player into the match
        const isTeam1 = match.team1 === player.team;
        const pair = isTeam1 ? match.pair1 : match.pair2;
        
        // Skip if pair or players are null
        if (!pair.player1 || !pair.player2) continue;
        
        // Check if player is already in this match
        if (pair.player1.id === player.id || pair.player2.id === player.id) continue;
        
        // Find a player in this pair who has more than minimum matches
        const player1Count = playerMatchCounts.get(pair.player1.id)?.count || 0;
        const player2Count = playerMatchCounts.get(pair.player2.id)?.count || 0;
        
        if (player1Count > settings.minMatchesPerPlayer) {
          // Substitute player1
          if (isTeam1) {
            match.pair1 = { ...pair, player1: player };
          } else {
            match.pair2 = { ...pair, player1: player };
          }
          playerMatchCounts.set(player.id, { name: player.name, count: (playerMatchCounts.get(player.id)?.count || 0) + 1 });
          playerMatchCounts.set(pair.player1.id, { name: pair.player1.name, count: player1Count - 1 });
          added++;
          console.log(`  Substituted ${player.name} for ${pair.player1.name} in ${match.id}`);
        } else if (player2Count > settings.minMatchesPerPlayer) {
          // Substitute player2
          if (isTeam1) {
            match.pair1 = { ...pair, player2: player };
          } else {
            match.pair2 = { ...pair, player2: player };
          }
          playerMatchCounts.set(player.id, { name: player.name, count: (playerMatchCounts.get(player.id)?.count || 0) + 1 });
          playerMatchCounts.set(pair.player2.id, { name: pair.player2.name, count: player2Count - 1 });
          added++;
          console.log(`  Substituted ${player.name} for ${pair.player2.name} in ${match.id}`);
        }
      }
    }
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
    
    // 檢查最後一點是否為混雙或女雙（優先但非強制）
    // 如果女性選手不足，允許男雙
    const lastPointMatches = matches.filter(m => m.pointNumber === settings.pointsPerRound);
    const femalePlayerCount = players.filter(p => p.gender === '女').length;
    const minFemalesNeeded = lastPointMatches.length; // Each match needs at least 1 female for mixed
    
    // Only enforce mixed/women's doubles if there are enough female players
    if (femalePlayerCount >= minFemalesNeeded) {
      lastPointMatches.forEach(match => {
        if (!isValidLastPointPair(match.pair1)) {
          errors.push(`${match.id}: 第${settings.pointsPerRound}點 ${match.team1} 建議為混雙或女雙（女性選手充足時）`);
        }
        if (!isValidLastPointPair(match.pair2)) {
          errors.push(`${match.id}: 第${settings.pointsPerRound}點 ${match.team2} 建議為混雙或女雙（女性選手充足時）`);
        }
      });
    }
    
    // 檢查每輪中每位選手是否只出賽一次（只在規則啟用時檢查）
    if (settings.enforceRules) {
      const matchesByRoundNumber = new Map<number, Match[]>();
      matches.forEach(match => {
        if (!matchesByRoundNumber.has(match.roundNumber)) {
          matchesByRoundNumber.set(match.roundNumber, []);
        }
        matchesByRoundNumber.get(match.roundNumber)!.push(match);
      });
      
      matchesByRoundNumber.forEach((roundMatches, roundNum) => {
        const playerCountInRound = new Map<string, number>();
        roundMatches.forEach(match => {
          [match.pair1.player1, match.pair1.player2, match.pair2.player1, match.pair2.player2].forEach(player => {
            if (player) {
              playerCountInRound.set(player.id, (playerCountInRound.get(player.id) || 0) + 1);
            }
          });
        });
        
        playerCountInRound.forEach((count, playerId) => {
          if (count > 1) {
            const player = players.find(p => p.id === playerId);
            const playerName = player ? player.name : playerId;
            errors.push(`第${roundNum}輪：選手 ${playerName} 出賽 ${count} 次，應該只出賽一次`);
          }
        });
      });
    }
  }
  
  return errors;
}
