import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import type { Player, Match, TeamName, TournamentSettings, Gender, InvoiceSettings } from './types';
import { PlayerManagement } from './components/PlayerManagement';
import { MatchList } from './components/MatchList';
import { Standings } from './components/Standings';
import { RulesModal } from './components/RulesModal';
import { ManualMatchSetup } from './components/ManualMatchSetup';
import { CustomModal } from './components/CustomModal';
import { GrandSlamTournament } from './components/GrandSlamTournament';
import { useModal } from './hooks/useModal';
import { generateFullSchedule } from './utils/scheduleGenerator';
import { generateDemoPlayers } from './utils/demoData';
import { exportPlayerInvoicesExcel, exportCompactInvoicesPDF } from './utils/invoiceGenerator';
import { SKILL_LEVELS, normalizeSkillLevel } from './utils/skillLevel';
import './App.css';

// Fisher-Yates shuffle for randomization
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Normalize gender values from imports (e.g., 女/F/Female/W/女生)
const normalizeGender = (raw: unknown): Gender => {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return '男';

  const femaleTokens = ['女', 'female', 'woman', 'girl', 'f', 'w', '女生'];
  const maleTokens = ['男', 'male', 'man', 'boy', 'm'];

  if (femaleTokens.some(token => value.includes(token))) return '女';
  if (maleTokens.some(token => value.includes(token))) return '男';

  return '男';
};

const isInternalTeamName = (value: unknown): value is TeamName => {
  return value === '甲隊' || value === '乙隊' || value === '丙隊' || value === '丁隊';
};

type ClubBucket = 'home' | 'away';

const normalizeTeamToken = (raw: unknown): string => {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/隊$/u, '')
    .toUpperCase();
};

const resolveInterClubTeam = (
  rawTeam: unknown,
  settings: TournamentSettings,
  clubCounters: { home: number; away: number }
): TeamName | undefined => {
  const original = String(rawTeam ?? '').trim();
  if (!original) return undefined;

  if (isInternalTeamName(original)) {
    return original;
  }

  const normalized = normalizeTeamToken(original);
  const normalizedHome = normalizeTeamToken(settings.homeClubName || '主隊');
  const normalizedAway = normalizeTeamToken(settings.awayClubName || '客隊');

  let bucket: ClubBucket | null = null;

  if (normalized === normalizedHome || normalized === '主隊' || normalized === '主' || normalized === 'HOME' || normalized === 'A') {
    bucket = 'home';
  } else if (normalized === normalizedAway || normalized === '客隊' || normalized === '客' || normalized === 'AWAY' || normalized === 'B') {
    bucket = 'away';
  }

  if (!bucket) {
    return undefined;
  }

  if (bucket === 'home') {
    const team: TeamName = (clubCounters.home % 2 === 0) ? '甲隊' : '乙隊';
    clubCounters.home += 1;
    return team;
  }

  const team: TeamName = (clubCounters.away % 2 === 0) ? '丙隊' : '丁隊';
  clubCounters.away += 1;
  return team;
};

// Auto-distribute players to teams evenly
const autoDistributeTeams = (players: Player[], mode: 'internal' | 'inter-club' = 'internal'): Player[] => {
  // Helper: Sort players by skill with some randomness for variety
  const sortBySkillWithVariety = (playerList: Player[]): Player[] => {
    // Group by detailed skill levels (A1 -> D4), shuffle within each group for variety
    return SKILL_LEVELS.flatMap((level) =>
      shuffleArray(playerList.filter((player) => player.skillLevel === level))
    );
  };

  // Helper: Serpentine distribution (snake draft pattern)
  const distributeWithSerpentine = (playerList: Player[], teams: TeamName[]) => {
    const n = teams.length;
    playerList.forEach((player, idx) => {
      const cycle = Math.floor(idx / n);
      const posInCycle = idx % n;
      // Even cycles go forward (0,1,2,3), odd cycles go backward (3,2,1,0)
      const teamIndex = (cycle % 2 === 0) ? posInCycle : (n - 1 - posInCycle);
      player.team = teams[teamIndex];
    });
  };
  
  // Separate players with assigned teams from those without
  const playersWithTeams = players.filter(p => isInternalTeamName(p.team));
  const playersWithoutTeams = players.filter(p => !isInternalTeamName(p.team));
  
  // If no players need distribution, return as-is
  if (playersWithoutTeams.length === 0) {
    return players;
  }
  
  const maleSerpentineTeams: TeamName[] = ['甲隊', '乙隊', '丙隊', '丁隊'];
  const femaleSerpentineTeams: TeamName[] = ['丁隊', '丙隊', '乙隊', '甲隊'];

  if (mode === 'inter-club') {
    // Inter-club mode: keep gender-balanced serpentine assignment with opposite directions.
    
    // Separate players by gender, sort by skill
    const femalePlayers = sortBySkillWithVariety(playersWithoutTeams.filter(p => normalizeGender(p.gender) === '女'));
    const malePlayers = sortBySkillWithVariety(playersWithoutTeams.filter(p => normalizeGender(p.gender) === '男'));

    // Female order: 丁→丙→乙→甲→甲→乙→丙→丁...
    distributeWithSerpentine(femalePlayers, femaleSerpentineTeams);

    // Male order: 甲→乙→丙→丁→丁→丙→乙→甲...
    distributeWithSerpentine(malePlayers, maleSerpentineTeams);
    
    return [...playersWithTeams, ...femalePlayers, ...malePlayers];
  }
  
  // Internal mode: original 4-team distribution
  const teamMap: { [key: string]: TeamName } = {
    'A1': '甲隊', 'A2': '甲隊',
    'B1': '乙隊', 'B2': '乙隊',
    'C1': '丙隊', 'C2': '丙隊',
    'D1': '丁隊', 'D2': '丁隊',
  };
  
  // Separate captains and regular players (only from those without teams)
  const captains = playersWithoutTeams.filter(p => p.groupTag && teamMap[p.groupTag]);
  const regularPlayers = playersWithoutTeams.filter(p => !p.groupTag || !teamMap[p.groupTag]);
  
  // Assign captains to their designated teams
  captains.forEach(captain => {
    if (captain.groupTag && teamMap[captain.groupTag]) {
      captain.team = teamMap[captain.groupTag];
    }
  });
  
  // Separate regular players by gender, sort by skill
  const femalePlayers = sortBySkillWithVariety(regularPlayers.filter(p => normalizeGender(p.gender) === '女'));
  const malePlayers = sortBySkillWithVariety(regularPlayers.filter(p => normalizeGender(p.gender) === '男'));

  // Female order: 丁→丙→乙→甲→甲→乙→丙→丁...
  distributeWithSerpentine(femalePlayers, femaleSerpentineTeams);

  // Male order: 甲→乙→丙→丁→丁→丙→乙→甲...
  distributeWithSerpentine(malePlayers, maleSerpentineTeams);
  
  return [...playersWithTeams, ...captains, ...femalePlayers, ...malePlayers];
};

const getDeuceDecisionText = (settings: TournamentSettings) => {
  if (settings.gamesPerMatch === 4) {
    return settings.fourGameDeuceMode === 'extend-to-5'
      ? '3:3後延長，先達5局者獲勝'
      : '3:3時 Tie-break 搶7決勝';
  }

  return `平手至${settings.gamesPerMatch - 1}:${settings.gamesPerMatch - 1}時 Tie-break 搶7`;
};

const getMatchFormatText = (settings: TournamentSettings) => {
  if (settings.gamesPerMatch === 4) {
    return settings.fourGameDeuceMode === 'extend-to-5'
      ? '先達 4 局；若 3:3，延長至先達 5 局'
      : '先達 4 局；若 3:3，Tie-break 搶7決勝';
  }

  return `先達 ${settings.gamesPerMatch} 局（${settings.gamesPerMatch - 1}:${settings.gamesPerMatch - 1} 時 Tie-break）`;
};

const getRulesFormatText = (settings: TournamentSettings) => {
  if (settings.gamesPerMatch === 4) {
    return settings.fourGameDeuceMode === 'extend-to-5'
      ? '比賽採4局NO-AD制，先達4局獲勝；若3:3則延長至先達5局'
      : '比賽採4局NO-AD制，先達4局獲勝；若3:3則Tie-break搶7決勝';
  }

  return `比賽採${settings.gamesPerMatch}局NO-AD制，先達${settings.gamesPerMatch}局獲勝；${settings.gamesPerMatch - 1}:${settings.gamesPerMatch - 1}時則Tie-break搶7決勝`;
};

type View = 'setup' | 'players' | 'matches' | 'standings' | 'manual-setup' | 'grand-slam';

function App() {
  const [currentView, setCurrentView] = useState<View>('setup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [filterRound, setFilterRound] = useState<number | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'in-progress' | 'completed'>('all');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);
  
  // Custom modal
  const modal = useModal();
  
  // Tournament settings
  const [settings, setSettings] = useState<TournamentSettings>({
    playersPerTeam: 10,
    pointsPerRound: 5,
    gamesPerMatch: 5,
    fourGameDeuceMode: 'tiebreak-7',
    totalRounds: 3,
    minMatchesPerPlayer: 2,
    enforceRules: true,
    tournamentMode: 'internal',
    homeClubName: '主隊',
    awayClubName: '客隊',
  });

  // 從 localStorage 載入資料
  useEffect(() => {
    const savedPlayers = localStorage.getItem('tennisPlayers');
    const savedMatches = localStorage.getItem('tennisMatches');
    const savedStarted = localStorage.getItem('tournamentStarted');
    const savedSettings = localStorage.getItem('tournamentSettings');

    const loadedPlayers: Player[] = savedPlayers
      ? (JSON.parse(savedPlayers) as Player[]).map((p) => ({
          ...p,
          gender: normalizeGender(p.gender),
        }))
      : [];
    if (savedPlayers) setPlayers(loadedPlayers);
    if (savedMatches) setMatches(JSON.parse(savedMatches));
    if (savedStarted) setTournamentStarted(JSON.parse(savedStarted));
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings) as TournamentSettings;
      const participantCount = parsedSettings.tournamentMode === 'internal'
        ? (loadedPlayers.length > 0 ? loadedPlayers.length : parsedSettings.playersPerTeam * 4)
        : loadedPlayers.length;
      const matchupsPerRound = parsedSettings.tournamentMode === 'inter-club' ? 4 : 2;
      const totalMatches = parsedSettings.totalRounds * matchupsPerRound * parsedSettings.pointsPerRound;
      const totalSlots = totalMatches * 4;
      const recalculatedMinMatches = participantCount > 0
        ? Math.max(1, Math.floor(totalSlots / participantCount))
        : 1;

      setSettings({
        ...parsedSettings,
        gamesPerMatch: Math.max(3, parsedSettings.gamesPerMatch || 5),
        fourGameDeuceMode: parsedSettings.fourGameDeuceMode === 'extend-to-5' ? 'extend-to-5' : 'tiebreak-7',
        minMatchesPerPlayer: recalculatedMinMatches,
      });
    }
  }, []);

  // 儲存資料到 localStorage
  useEffect(() => {
    localStorage.setItem('tennisPlayers', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('tennisMatches', JSON.stringify(matches));
  }, [matches]);

  useEffect(() => {
    localStorage.setItem('tournamentStarted', JSON.stringify(tournamentStarted));
  }, [tournamentStarted]);

  useEffect(() => {
    localStorage.setItem('tournamentSettings', JSON.stringify(settings));
  }, [settings]);

  // 計算每人最少出賽場次
  useEffect(() => {
    // 優先使用實際名單人數計算（含載入示範/匯入資料），無名單時才用設定人數預估
    const participantCount = settings.tournamentMode === 'internal'
      ? (players.length > 0 ? players.length : settings.playersPerTeam * 4)
      : players.length;

    if (participantCount === 0) {
      setSettings(prev => (prev.minMatchesPerPlayer === 1 ? prev : { ...prev, minMatchesPerPlayer: 1 }));
      return;
    }
    
    // 總比賽數 = 總輪數 × 每輪對戰組數 × 每輪點數
    // Internal mode: 4隊循環賽每輪有2場同時進行 (每隊打1場)
    // Round 1: 甲vs乙, 丙vs丁 (2場)
    // Round 2: 甲vs丙, 乙vs丁 (2場)
    // Round 3: 甲vs丁, 乙vs丙 (2場)
    const matchupsPerRound = settings.tournamentMode === 'inter-club' ? 4 : 2;
    const totalMatches = settings.totalRounds * matchupsPerRound * settings.pointsPerRound;
    
    // 總位置數 = 總比賽數 × 4（每場4個位置）
    const totalSlots = totalMatches * 4;
    
    // 計算平均每人出賽次數，向下取整作為最低要求
    const minMatches = Math.max(1, Math.floor(totalSlots / participantCount));

    setSettings(prev => (
      prev.minMatchesPerPlayer === minMatches
        ? prev
        : { ...prev, minMatchesPerPlayer: minMatches }
    ));
  }, [players, settings.playersPerTeam, settings.pointsPerRound, settings.totalRounds, settings.tournamentMode]);

  const handleAddPlayer = (player: Player) => {
    setPlayers([...players, player]);
  };

  const handleUpdatePlayer = (updatedPlayer: Player) => {
    setPlayers(players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
  };

  const handleDeletePlayer = (playerId: string) => {
    setPlayers(players.filter(p => p.id !== playerId));
  };

  const handleStartTournament = async () => {
    const requiredPlayers = settings.playersPerTeam * 4;
    
    if (players.length < requiredPlayers) {
      await modal.showAlert(`請確保至少有${requiredPlayers}名選手（每隊${settings.playersPerTeam}人）`);
      return;
    }

    const teams: { [key in TeamName]: Player[] } = {
      '甲隊': players.filter(p => p.team === '甲隊'),
      '乙隊': players.filter(p => p.team === '乙隊'),
      '丙隊': players.filter(p => p.team === '丙隊'),
      '丁隊': players.filter(p => p.team === '丁隊'),
    };

    // 檢查每隊人數（至少需要指定人數）
    for (const [teamName, teamPlayers] of Object.entries(teams)) {
      if (teamPlayers.length < settings.playersPerTeam) {
        await modal.showAlert(`${teamName}目前只有${teamPlayers.length}人，需要至少${settings.playersPerTeam}人`);
        return;
      }
    }

    try {
      const schedule = generateFullSchedule(teams, settings);
      setMatches(schedule);
      setTournamentStarted(true);
      setCurrentView('matches');
      await modal.showAlert('賽程已生成！共 ' + schedule.length + ' 場比賽');
    } catch (error) {
      console.error('生成賽程失敗:', error);
      await modal.showAlert('生成賽程時發生錯誤，請檢查選手資料');
    }
  };

  const handleStartManualSetup = async () => {
    // In inter-club mode, skip all validations - just need at least some players
    if (settings.tournamentMode === 'inter-club') {
      if (players.length < 4) {
        await modal.showAlert('請確保至少有4名選手（每隊至少2人）');
        return;
      }
      setCurrentView('manual-setup');
      return;
    }

    // Internal mode: Check required player counts
    const requiredPlayers = settings.playersPerTeam * 4;
    
    if (players.length < requiredPlayers) {
      await modal.showAlert(`請確保至少有${requiredPlayers}名選手（每隊${settings.playersPerTeam}人）`);
      return;
    }

    const teams: { [key in TeamName]: Player[] } = {
      '甲隊': players.filter(p => p.team === '甲隊'),
      '乙隊': players.filter(p => p.team === '乙隊'),
      '丙隊': players.filter(p => p.team === '丙隊'),
      '丁隊': players.filter(p => p.team === '丁隊'),
    };

    // 檢查每隊人數（至少需要指定人數）
    for (const [teamName, teamPlayers] of Object.entries(teams)) {
      if (teamPlayers.length < settings.playersPerTeam) {
        await modal.showAlert(`${teamName}目前只有${teamPlayers.length}人，需要至少${settings.playersPerTeam}人`);
        return;
      }
    }

    setCurrentView('manual-setup');
  };

  const handleManualMatchesGenerated = async (generatedMatches: Match[]) => {
    setMatches(generatedMatches);
    setTournamentStarted(true);
    setCurrentView('matches');
    await modal.showAlert('手動配對已完成！共 ' + generatedMatches.length + ' 場比賽');
  };

  const handleUpdateScore = (updatedMatch: Match) => {
    setMatches(matches.map(m => m.id === updatedMatch.id ? updatedMatch : m));
  };

  const handleCompleteMatch = (completedMatch: Match) => {
    // 更新比賽狀態
    setMatches(matches.map(m => m.id === completedMatch.id ? completedMatch : m));
    
    // 更新選手出賽次數
    const updatedPlayers = [...players];
    [completedMatch.pair1.player1, completedMatch.pair1.player2,
     completedMatch.pair2.player1, completedMatch.pair2.player2].forEach(matchPlayer => {
      if (matchPlayer) {
        const player = updatedPlayers.find(p => p.id === matchPlayer.id);
        if (player && player.matchesPlayed < settings.totalRounds) {
          player.matchesPlayed++;
        }
      }
    });
    setPlayers(updatedPlayers);
  };

  const handleResetMatch = async (matchToReset: Match) => {
    const confirmed = await modal.showConfirm('確定要重置這場比賽嗎？比分將清零並重新記錄。');
    if (!confirmed) {
      return;
    }

    // 重置比賽狀態為進行中，使可立即重新記錄
    const resetMatch: Match = {
      ...matchToReset,
      status: 'in-progress',
      team1Games: 0,
      team2Games: 0,
      team1TiebreakScore: undefined,
      team2TiebreakScore: undefined,
      winner: undefined,
    };
    setMatches(matches.map(m => m.id === matchToReset.id ? resetMatch : m));

    // 如果比賽之前已完成，減少選手出賽次數
    if (matchToReset.status === 'completed') {
      const updatedPlayers = [...players];
      [matchToReset.pair1.player1, matchToReset.pair1.player2,
       matchToReset.pair2.player1, matchToReset.pair2.player2].forEach(matchPlayer => {
        if (matchPlayer) {
          const player = updatedPlayers.find(p => p.id === matchPlayer.id);
          if (player && player.matchesPlayed > 0) {
            player.matchesPlayed--;
          }
        }
      });
      setPlayers(updatedPlayers);
    }
  };

  const handleResetTournament = async () => {
    const confirmed = await modal.showConfirm('確定要重置整個賽事嗎？這將清除所有選手和比賽資料。');
    if (confirmed) {
      setPlayers([]);
      setMatches([]);
      setTournamentStarted(false);
      setCurrentView('setup');
      localStorage.clear();
    }
  };

  const handleLoadDemoData = async () => {
    if (players.length > 0) {
      const confirmed = await modal.showConfirm('這將覆蓋現有選手資料，確定要載入示範資料嗎？');
      if (!confirmed) return;
    }
    const demoPlayers = generateDemoPlayers();
    const distributedPlayers = autoDistributeTeams(demoPlayers, settings.tournamentMode);
    setPlayers(distributedPlayers);
    await modal.showAlert(`已載入${distributedPlayers.length}名示範選手！請到「選手管理」查看或前往「賽事設定」開始賽事。`);
  };

  const handleImportDemoData = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported) && imported.length > 0) {
          const normalizedImported: Player[] = imported.map((row: any, index: number) => ({
            id: row.id || `demo-player-${Date.now()}-${index}`,
            name: row.name || row['姓名'] || '',
            age: Number(row.age || row['年齡'] || 25),
            gender: normalizeGender(row.gender || row['性別'] || row['Gender'] || row['性别']),
            skillLevel: normalizeSkillLevel(row.skillLevel || row['技術等級'] || 'B2'),
            team: row.team,
            matchesPlayed: Number(row.matchesPlayed || 0),
            groupTag: row.groupTag,
          }));
          if (players.length > 0) {
            const confirmed = await modal.showConfirm('這將覆蓋現有選手資料，確定要從檔案載入示範資料嗎？');
            if (!confirmed) return;
          }
          // Check if any player has team assigned
          const hasTeamAssigned = normalizedImported.some(p => p.team && p.team !== '甲隊');
          
          // If no teams assigned, auto-distribute; otherwise shuffle with existing teams
          const finalPlayers = hasTeamAssigned ? shuffleArray(normalizedImported) : autoDistributeTeams(normalizedImported);
          setPlayers(finalPlayers);
          await modal.showAlert(`成功從檔案載入 ${normalizedImported.length} 名示範選手！`);
        } else {
          await modal.showAlert('無效的示範資料格式');
        }
      } catch (error) {
        await modal.showAlert('載入失敗：檔案格式錯誤');
      }
    };
    reader.readAsText(file);
  };

  const handleImportDemoDataExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        const interClubCounters = { home: 0, away: 0 };
        const imported: Player[] = jsonData.map((row, index) => {
          // Handle age: support both 年齡 (age) and 年次 (ROC birth year)
          let age = 25; // default
          if (row['年齡']) {
            // Direct age column
            age = parseInt(row['年齡']) || 25;
          } else if (row['年次']) {
            // ROC birth year - convert to age
            const currentYear = new Date().getFullYear();
            const rocYear = currentYear - 1911;
            const birthYear = parseInt(row['年次']) || (rocYear - 25);
            age = rocYear - birthYear;
          }
          
          // Handle team: map club names to internal teams in inter-club mode
          const teamValue = row['隊伍'] || '';
          let team: TeamName | undefined = undefined; // default to undefined for auto-distribution
          
          if (settings.tournamentMode === 'inter-club') {
            // In inter-club mode, rely on the team field first (supports A/B, 主/客, club names)
            team = resolveInterClubTeam(teamValue, settings, interClubCounters);
            console.log(`[Import Demo Debug] Row ${index}: teamValue="${teamValue}" -> assigned "${team || 'auto'}"`);
          } else {
            // Internal mode: use team value directly or default
            if (isInternalTeamName(teamValue)) {
              team = teamValue as TeamName;
            } else if (teamValue.trim() !== '') {
              // Try to map custom names, otherwise empty for auto-distribution
              team = undefined;
            }
          }
          
          return {
            id: `demo-player-${Date.now()}-${index}`,
            name: row['姓名'] || '',
            age: age,
            gender: normalizeGender(row['性別'] || row['gender'] || row['Gender'] || row['性别']),
            skillLevel: normalizeSkillLevel(row['技術等級'] || row['skillLevel'] || row['等級'] || 'B2'),
            team: team,
            matchesPlayed: 0,
            groupTag: row['分組標籤'] ? String(row['分組標籤']).trim() : undefined,
          };
        });
        
        if (imported.length > 0) {
          console.log('[Import Demo Debug] Before auto-distribute:', imported.map(p => ({ name: p.name, team: p.team })));
          if (players.length > 0) {
            const confirmed = await modal.showConfirm('這將覆蓋現有選手資料，確定要從Excel載入示範資料嗎？');
            if (!confirmed) return;
          }
          // Auto-distribute teams to ensure balanced distribution
          const distributedPlayers = autoDistributeTeams(imported, settings.tournamentMode);
          console.log('[Import Demo Debug] After auto-distribute:', distributedPlayers.map(p => ({ name: p.name, team: p.team })));
          setPlayers(distributedPlayers);
          await modal.showAlert(`成功從Excel載入 ${imported.length} 名示範選手！`);
        } else {
          await modal.showAlert('無效的Excel資料格式');
        }
      } catch (error) {
        await modal.showAlert('載入失敗：Excel檔案格式錯誤');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportPlayers = () => {
    // Sort players by team before exporting
    const sortedPlayers = [...players].sort((a, b) => {
      const teamOrder = ['甲隊', '乙隊', '丙隊', '丁隊'];
      return teamOrder.indexOf(a.team || '甲隊') - teamOrder.indexOf(b.team || '甲隊');
    });
    
    // Map internal teams to club names in inter-club mode
    const exportData = sortedPlayers.map(p => {
      if (settings.tournamentMode === 'inter-club') {
        let teamName = p.team;
        if (p.team === '甲隊' || p.team === '乙隊') {
          teamName = settings.homeClubName as TeamName;
        } else if (p.team === '丙隊' || p.team === '丁隊') {
          teamName = settings.awayClubName as TeamName;
        }
        return { ...p, team: teamName };
      }
      return p;
    });
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `players_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPlayersExcel = async () => {
    // Ask user which format to use for age column
    const format = prompt('選擇年齡格式：\n1 - 年次（民國）\n2 - 年齡（實際年齡）', '1');
    if (!format || (format !== '1' && format !== '2')) return;
    
    const currentYear = new Date().getFullYear();
    const rocYear = currentYear - 1911;
    
    // Sort players by team before exporting
    const sortedPlayers = [...players].sort((a, b) => {
      const teamOrder = ['甲隊', '乙隊', '丙隊', '丁隊'];
      return teamOrder.indexOf(a.team || '甲隊') - teamOrder.indexOf(b.team || '甲隊');
    });
    
    const exportData = sortedPlayers.map(p => {
      // Map internal teams to club names in inter-club mode
      let teamName: string = p.team || '甲隊';
      if (settings.tournamentMode === 'inter-club') {
        if (p.team === '甲隊' || p.team === '乙隊') {
          teamName = settings.homeClubName;
        } else if (p.team === '丙隊' || p.team === '丁隊') {
          teamName = settings.awayClubName;
        }
      }
      
      const data: any = {};

      // Keep column order aligned with the requested header sequence.
      data['姓名'] = p.name;
      if (format === '1') {
        data['年次'] = rocYear - p.age;
      } else {
        data['年齡'] = p.age;
      }
      data['性別'] = p.gender;
      data['技術等級'] = p.skillLevel;
      data['隊伍'] = teamName;
      data['分組標籤'] = p.groupTag || '';
      
      return data;
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '選手名單');
    XLSX.writeFile(wb, `選手名單_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportArrangementTemplateExcel = () => {
    const rows: Array<{ round: number; point: number }> = [];
    for (let round = 1; round <= settings.totalRounds; round++) {
      for (let point = 1; point <= settings.pointsPerRound; point++) {
        rows.push({ round, point });
      }
    }

    const now = new Date();
    const dateText = now.toISOString().slice(0, 10);

    const tableRowsHtml = rows
      .map(({ round, point }) => `
        <tr>
          <td class="center">${round}</td>
          <td class="center">${point}</td>
          <td class="blank"></td>
          <td class="blank"></td>
        </tr>
      `)
      .join('');

    const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>空白排陣表</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 16mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      font-family: "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif;
      color: #111;
      font-size: 14px;
      line-height: 1.4;
    }
    .sheet {
      width: 94%;
      margin: 0 auto;
      min-height: calc(297mm - 24mm);
    }
    .header {
      margin-bottom: 8px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 6px 0;
    }
    .meta {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .meta-item {
      border-bottom: 1px solid #999;
      min-width: 170px;
      padding-bottom: 2px;
    }
    .hint {
      margin: 0 0 10px 0;
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    col.col-round { width: 12%; }
    col.col-point { width: 12%; }
    col.col-player { width: 38%; }
    th, td {
      border: 1px solid #333;
      padding: 6px;
      height: 42px;
      vertical-align: middle;
    }
    th {
      background: #f3f3f3;
      font-weight: 700;
      text-align: center;
      font-size: 15px;
    }
    td {
      font-size: 14px;
    }
    td.center {
      text-align: center;
      width: 52px;
    }
    td.blank {
      background: #fff;
    }
    .footer {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      color: #444;
    }
    @media print {
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <h1 class="title">空白排陣表</h1>
      <div class="meta">
        <div class="meta-item">隊伍：________________</div>
        <div class="meta-item">隊長：________________</div>
        <div class="meta-item">日期：________________</div>
      </div>
      <p class="hint">填寫方式：每列代表一個「輪次＋點數」，由隊長填入該點出賽的 2 位選手。</p>
    </div>

    <table>
      <colgroup>
        <col class="col-round" />
        <col class="col-point" />
        <col class="col-player" />
        <col class="col-player" />
      </colgroup>
      <thead>
        <tr>
          <th>輪次</th>
          <th>點數</th>
          <th>選手1</th>
          <th>選手2</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <div class="footer">
      <span>總輪數：${settings.totalRounds}</span>
      <span>每輪點數：${settings.pointsPerRound}</span>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `空白排陣表_A4_${dateText}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPlayers = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported) && imported.length > 0) {
          const normalizedImported: Player[] = imported.map((row: any, index: number) => ({
            id: row.id || `imported-player-${Date.now()}-${index}`,
            name: row.name || row['姓名'] || '',
            age: Number(row.age || row['年齡'] || 25),
            gender: normalizeGender(row.gender || row['性別'] || row['Gender'] || row['性别']),
            skillLevel: normalizeSkillLevel(row.skillLevel || row['技術等級'] || 'B2'),
            team: row.team,
            matchesPlayed: Number(row.matchesPlayed || 0),
            groupTag: row.groupTag,
          }));
          if (players.length > 0) {
            const confirmed = await modal.showConfirm('這將覆蓋現有選手資料，確定要匯入嗎？');
            if (!confirmed) return;
          }
          // Auto-distribute teams to ensure balanced distribution
          const distributedPlayers = autoDistributeTeams(normalizedImported, settings.tournamentMode);
          setPlayers(distributedPlayers);
          await modal.showAlert(`成功匯入 ${normalizedImported.length} 名選手！`);
        } else {
          await modal.showAlert('無效的選手資料格式');
        }
      } catch (error) {
        await modal.showAlert('匯入失敗：檔案格式錯誤');
      }
    };
    reader.readAsText(file);
  };

  const handleImportPlayersExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        // Debug: Log first row to see column names
        if (jsonData.length > 0) {
          console.log('Excel columns:', Object.keys(jsonData[0]));
          console.log('First 3 rows:', jsonData.slice(0, 3));
        }
        
        const interClubCounters = { home: 0, away: 0 };
        const imported: Player[] = jsonData.map((row, index) => {
          // Handle gender: support both Chinese (男/女) and English (M/W) formats
          // Check multiple possible column names for gender
          const genderRaw = row['性別'] || row['gender'] || row['Gender'] || row['性别'] || 
                            row['GENDER'] || row['SEX'] || row['sex'] || '';
          
          // Convert full-width to half-width and trim
          const genderValue = String(genderRaw)
            .replace(/Ｍ/g, '男')
            .replace(/Ｗ/g, '女')
            .replace(/Ｆ/g, '女')
            .replace(/男/g, '男')
            .replace(/女/g, '女')
            .trim()
            .toUpperCase();
          
          // Debug log for first 3 rows
          if (index < 3) {
            console.log(`Row ${index}: name="${row['姓名']}", Gender raw="${genderRaw}", processed="${genderValue}"`);
          }
          
          const gender: Gender = normalizeGender(genderValue);
          
          // Handle skill level: supports A1-D4
          const skillLevel = normalizeSkillLevel(row['技術等級'] || row['skillLevel'] || row['等級'] || 'B2');
          
          // Handle age: support both 年齡 (age) and 年次 (ROC birth year)
          let age = 25; // default
          if (row['年齡']) {
            // Direct age column
            age = parseInt(row['年齡']) || 25;
          } else if (row['年次']) {
            // ROC birth year - convert to age
            const currentYear = new Date().getFullYear();
            const rocYear = currentYear - 1911;
            const birthYear = parseInt(row['年次']) || (rocYear - 25);
            age = rocYear - birthYear;
          }
          
          // Handle team: map club names to internal teams in inter-club mode
          const teamValue = row['隊伍'] || '';
          let team: TeamName | undefined = undefined; // default to undefined for auto-distribution
          
          if (settings.tournamentMode === 'inter-club') {
            // In inter-club mode, rely on the team field first (supports A/B, 主/客, club names)
            team = resolveInterClubTeam(teamValue, settings, interClubCounters);
            console.log(`[Import Debug] Row ${index}: teamValue="${teamValue}" -> assigned "${team || 'auto'}"`);
          } else {
            // Internal mode: use team value directly or default
            if (isInternalTeamName(teamValue)) {
              team = teamValue as TeamName;
            } else if (teamValue.trim() !== '') {
              // Try to map custom names, otherwise empty for auto-distribution
              team = undefined;
            }
          }
          
          return {
            id: `imported-player-${Date.now()}-${index}`,
            name: row['姓名'] || '',
            age: age,
            gender,
            skillLevel,
            team: team,
            matchesPlayed: 0,
            groupTag: row['分組標籤'] ? String(row['分組標籤']).trim() : undefined,
          };
        });
        
        if (imported.length > 0) {
          console.log('[Import Debug] Before auto-distribute:', imported.map(p => ({ name: p.name, team: p.team })));
          if (players.length > 0) {
            const confirmed = await modal.showConfirm('這將覆蓋現有選手資料，確定要匯入嗎？');
            if (!confirmed) return;
          }
          // Auto-distribute teams to ensure balanced distribution
          const distributedPlayers = autoDistributeTeams(imported, settings.tournamentMode);
          console.log('[Import Debug] After auto-distribute:', distributedPlayers.map(p => ({ name: p.name, team: p.team })));
          setPlayers(distributedPlayers);
          await modal.showAlert(`成功匯入 ${imported.length} 名選手！`);
        } else {
          await modal.showAlert('無效的Excel檔案格式');
        }
      } catch (error) {
        await modal.showAlert('匯入失敗：Excel檔案格式錯誤');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportMatches = () => {
    const dataStr = JSON.stringify(matches, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `matches_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMatchesExcel = () => {
    const exportData = matches.map(m => ({
      '輪次': m.roundNumber,
      '點數': m.pointNumber,
      '對戰': `${m.team1} vs ${m.team2}`,
      '${m.team1}選手1': m.pair1.player1?.name || 'TBD',
      '${m.team1}選手2': m.pair1.player2?.name || 'TBD',
      '${m.team2}選手1': m.pair2.player1?.name || 'TBD',
      '${m.team2}選手2': m.pair2.player2?.name || 'TBD',
      '${m.team1}局數': m.team1Games,
      '${m.team2}局數': m.team2Games,
      '狀態': m.status === 'completed' ? '已完成' : '未開始',
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '比賽列表');
    XLSX.writeFile(wb, `比賽列表_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImportMatches = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported) && imported.length > 0) {
          if (matches.length > 0) {
            const confirmed = await modal.showConfirm('這將覆蓋現有比賽資料，確定要匯入嗎？');
            if (!confirmed) return;
          }
          setMatches(imported);
          setTournamentStarted(true);
          await modal.showAlert(`成功匯入 ${imported.length} 場比賽！`);
        } else {
          await modal.showAlert('無效的比賽資料格式');
        }
      } catch (error) {
        await modal.showAlert('匯入失敗：檔案格式錯誤');
      }
    };
    reader.readAsText(file);
  };

  const handleImportMatchesExcel = async (_file: File) => {
    await modal.showAlert('Excel匯入比賽功能建議使用JSON格式，因為比賽資料結構較複雜。請使用「匯出JSON」功能匯出後再匯入。');
  };

  const handleExportInvoices = async () => {
    if (players.length === 0) {
      await modal.showAlert('目前沒有選手資料，無法匯出收據');
      return;
    }

    // Get current year in ROC (Republic of China) calendar
    const currentYear = new Date().getFullYear();
    const rocYear = currentYear - 1911;

    // Prompt user for invoice settings
    const year = prompt('請輸入年份（例如：115）', rocYear.toString());
    if (!year) return;

    const type = prompt('請輸入費用類型（例如：會費）', '會費');
    if (!type) return;

    const expenseStr = prompt('請輸入金額（元）', '3600');
    if (!expenseStr) return;
    const expense = parseInt(expenseStr);
    if (isNaN(expense) || expense <= 0) {
      await modal.showAlert('請輸入有效的金額');
      return;
    }

    const organization = prompt('請輸入組織名稱', '新北市中和區錦和網球聯誼會');
    if (!organization) return;

    const invoiceSettings: InvoiceSettings = {
      year,
      type,
      expense,
      organization,
    };

    // Ask for export format
    const format = prompt('選擇匯出格式：\n1 - PDF/列印 (信用卡大小, 每頁10張)\n2 - Excel', '1');
    
    if (format === '1') {
      // Open print dialog for PDF export
      await exportCompactInvoicesPDF(players, invoiceSettings);
    } else if (format === '2') {
      // Export as Excel
      exportPlayerInvoicesExcel(players, invoiceSettings);
    }
  };

  const getTeamCount = (teamName: TeamName) => {
    return players.filter(p => p.team === teamName).length;
  };

  const totalRounds = matches.length > 0 ? Math.max(...matches.map(m => m.roundNumber)) : 0;
  const totalPlayersCount = players.length;

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎾 網球雙打賽事系統</h1>
        <p className="subtitle">Tennis Doubles Tournament System</p>
      </header>

      <nav className="app-nav">
        <button 
          className={currentView === 'setup' ? 'active' : ''} 
          onClick={() => setCurrentView('setup')}
        >
          賽事設定
        </button>
        <button 
          className={currentView === 'players' ? 'active' : ''} 
          onClick={() => setCurrentView('players')}
        >
          選手管理
        </button>
        <button 
          className={currentView === 'matches' ? 'active' : ''} 
          onClick={() => setCurrentView('matches')}
          disabled={!tournamentStarted}
        >
          比賽記錄
        </button>
        <button 
          className={currentView === 'standings' ? 'active' : ''} 
          onClick={() => setCurrentView('standings')}
          disabled={!tournamentStarted}
        >
          即時排名
        </button>
        <button 
          className={currentView === 'grand-slam' ? 'active' : ''} 
          onClick={() => setCurrentView('grand-slam')}
        >
          🏆 一球大滿貫
        </button>
        <button
          className="btn-rules"
          onClick={() => setShowRulesModal(true)}
          title="查看操作手冊與說明"
        >
          📘 操作手冊
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showSensitiveInfo}
              onChange={(e) => setShowSensitiveInfo(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            🔒 顯示敏感資訊
          </label>
        </div>
      </nav>

      <main className="app-main">
        {currentView === 'setup' && (
          <div className="setup-view">
            <div className="settings-panel">
              <h2>⚙️ 賽事設定</h2>
              
              {/* Tournament Mode Selector */}
              <div className="mode-selector">
                <h3>賽事模式</h3>
                <div className="mode-options">
                  <button
                    className={`mode-btn ${settings.tournamentMode === 'internal' ? 'active' : ''}`}
                    onClick={() => setSettings({ ...settings, tournamentMode: 'internal' })}
                  >
                    <span className="mode-icon">🏆</span>
                    <span className="mode-label">內部賽制</span>
                    <span className="mode-desc">4隊循環賽（甲乙丙丁）</span>
                  </button>
                  <button
                    className={`mode-btn ${settings.tournamentMode === 'inter-club' ? 'active' : ''}`}
                    onClick={() => setSettings({ ...settings, tournamentMode: 'inter-club' })}
                  >
                    <span className="mode-icon">🤝</span>
                    <span className="mode-label">友誼賽制</span>
                    <span className="mode-desc">2俱樂部對抗賽</span>
                  </button>
                </div>
              </div>

              {/* Club Names (Inter-Club Mode Only) */}
              {settings.tournamentMode === 'inter-club' && (
                <div className="club-names-setting">
                  <h3>俱樂部名稱設定</h3>
                  <div className="club-inputs">
                    <div className="club-input-group">
                      <label>主隊名稱：</label>
                      <input
                        type="text"
                        value={settings.homeClubName}
                        onChange={(e) => setSettings({ ...settings, homeClubName: e.target.value || '主隊' })}
                        placeholder="主隊"
                        maxLength={20}
                      />
                    </div>
                    <div className="club-input-group">
                      <label>客隊名稱：</label>
                      <input
                        type="text"
                        value={settings.awayClubName}
                        onChange={(e) => setSettings({ ...settings, awayClubName: e.target.value || '客隊' })}
                        placeholder="客隊"
                        maxLength={20}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="settings-grid">
                  {settings.tournamentMode === 'internal' && (
                    <>
                      <div className="setting-item">
                        <label>每隊人數(至少)：</label>
                        <div className="setting-control">
                          <button 
                            className="btn-adjust"
                            onClick={() => setSettings({ ...settings, playersPerTeam: Math.max(4, settings.playersPerTeam - 1) })}
                            disabled={settings.playersPerTeam <= 4}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="4"
                            max="20"
                            value={settings.playersPerTeam}
                            onChange={(e) => setSettings({ ...settings, playersPerTeam: parseInt(e.target.value) || 10 })}
                          />
                          <button 
                            className="btn-adjust"
                            onClick={() => setSettings({ ...settings, playersPerTeam: Math.min(20, settings.playersPerTeam + 1) })}
                            disabled={settings.playersPerTeam >= 20}
                          >
                            +
                          </button>
                        </div>
                        <span className="setting-note">總人數: {settings.playersPerTeam * 4}</span>
                      </div>
                      
                      <div className="setting-item">
                        <label>每輪點數：</label>
                        <div className="setting-control">
                          <button 
                            className="btn-adjust"
                            onClick={() => setSettings({ ...settings, pointsPerRound: Math.max(3, settings.pointsPerRound - 1) })}
                            disabled={settings.pointsPerRound <= 3}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="3"
                            max="10"
                            value={settings.pointsPerRound}
                            onChange={(e) => setSettings({ ...settings, pointsPerRound: parseInt(e.target.value) || 5 })}
                          />
                          <button 
                            className="btn-adjust"
                            onClick={() => setSettings({ ...settings, pointsPerRound: Math.min(10, settings.pointsPerRound + 1) })}
                            disabled={settings.pointsPerRound >= 10}
                          >
                            +
                          </button>
                        </div>
                        <span className="setting-note">每場對戰打幾點</span>
                      </div>
                      
                      <div className="setting-item">
                        <label>每場局數（先達）：</label>
                        <div className="setting-control">
                          <button
                            className="btn-adjust"
                            onClick={() => setSettings({ ...settings, gamesPerMatch: Math.max(3, settings.gamesPerMatch - 1) })}
                            disabled={settings.gamesPerMatch <= 3}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="3"
                            max="10"
                            value={settings.gamesPerMatch}
                            onChange={(e) => setSettings({ ...settings, gamesPerMatch: Math.max(3, Math.min(10, parseInt(e.target.value) || 5)) })}
                          />
                          <button
                            className="btn-adjust"
                            onClick={() => setSettings({ ...settings, gamesPerMatch: Math.min(10, settings.gamesPerMatch + 1) })}
                            disabled={settings.gamesPerMatch >= 10}
                          >
                            +
                          </button>
                        </div>
                        <span className="setting-note">{getDeuceDecisionText(settings)}</span>
                      </div>

                      {settings.gamesPerMatch === 4 && (
                        <div className="setting-item">
                          <label>4局制平手決勝：</label>
                          <div className="setting-control">
                            <select
                              value={settings.fourGameDeuceMode}
                              onChange={(e) => setSettings({
                                ...settings,
                                fourGameDeuceMode: e.target.value === 'extend-to-5' ? 'extend-to-5' : 'tiebreak-7',
                              })}
                            >
                              <option value="tiebreak-7">3:3 後 Tie-break 搶7</option>
                              <option value="extend-to-5">3:3 後延長到先達 5 局</option>
                            </select>
                          </div>
                          <span className="setting-note">只在每場局數設定為 4 局時生效</span>
                        </div>
                      )}

                      <div className="setting-item">
                        <label>總輪數：</label>
                        <div className="setting-control">
                          <button 
                            className="btn-adjust"
                            onClick={() => setSettings({ ...settings, totalRounds: Math.max(1, settings.totalRounds - 1) })}
                            disabled={settings.totalRounds <= 1}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={settings.totalRounds}
                            onChange={(e) => setSettings({ ...settings, totalRounds: parseInt(e.target.value) || 3 })}
                          />
                          <button 
                            className="btn-adjust"
                            onClick={() => setSettings({ ...settings, totalRounds: Math.min(5, settings.totalRounds + 1) })}
                            disabled={settings.totalRounds >= 5}
                          >
                            +
                          </button>
                        </div>
                        <span className="setting-note">全部打幾輪</span>
                      </div>
                      
                      <div className="setting-item highlight">
                        <label>每人最少出賽：</label>
                        <div className="calculated-value">{settings.minMatchesPerPlayer} 場</div>
                        <span className="setting-note">根據設定自動計算</span>
                      </div>
                    </>
                  )}

                  {settings.tournamentMode === 'inter-club' && (
                    <>
                      <div className="setting-item">
                        <label>每場局數（先達）：</label>
                        <div className="setting-control">
                          <button
                            className="btn-adjust"
                            onClick={() => setSettings({ ...settings, gamesPerMatch: Math.max(3, settings.gamesPerMatch - 1) })}
                            disabled={settings.gamesPerMatch <= 3}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="3"
                            max="10"
                            value={settings.gamesPerMatch}
                            onChange={(e) => setSettings({ ...settings, gamesPerMatch: Math.max(3, Math.min(10, parseInt(e.target.value) || 5)) })}
                          />
                          <button
                            className="btn-adjust"
                            onClick={() => setSettings({ ...settings, gamesPerMatch: Math.min(10, settings.gamesPerMatch + 1) })}
                            disabled={settings.gamesPerMatch >= 10}
                          >
                            +
                          </button>
                        </div>
                        <span className="setting-note">{getDeuceDecisionText(settings)}</span>
                      </div>

                      {settings.gamesPerMatch === 4 && (
                        <div className="setting-item">
                          <label>4局制平手決勝：</label>
                          <div className="setting-control">
                            <select
                              value={settings.fourGameDeuceMode}
                              onChange={(e) => setSettings({
                                ...settings,
                                fourGameDeuceMode: e.target.value === 'extend-to-5' ? 'extend-to-5' : 'tiebreak-7',
                              })}
                            >
                              <option value="tiebreak-7">3:3 後 Tie-break 搶7</option>
                              <option value="extend-to-5">3:3 後延長到先達 5 局</option>
                            </select>
                          </div>
                          <span className="setting-note">只在每場局數設定為 4 局時生效</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <div className="settings-summary">
                  <h4>賽事總覽</h4>
                  {settings.tournamentMode === 'inter-club' ? (
                    <>
                      <p>• 俱樂部對抗賽：{settings.homeClubName} vs {settings.awayClubName}</p>
                      <p>• 比賽安排：由管理者手動配對，無限制</p>
                      <p>• 單場賽制：{getMatchFormatText(settings)}</p>
                      <p>• 請使用「手動配對」功能建立比賽</p>
                    </>
                  ) : (
                    <>
                      <p>• 總比賽數：{settings.totalRounds * 2 * settings.pointsPerRound} 場</p>
                      <p>• 每組對戰點數：{settings.pointsPerRound} 點</p>
                      <p>• 單場賽制：{getMatchFormatText(settings)}</p>
                      <p>• 總位置數：{settings.totalRounds * 2 * settings.pointsPerRound * 4} 個（{settings.totalRounds}輪 × 2組 × {settings.pointsPerRound}點 × 4人）</p>
                      <p>• 每人最少出賽：{settings.minMatchesPerPlayer} 場（總位置數 ÷ 總人數）</p>
                    </>
                  )}
                </div>
              </div>
            
            <h2>賽事規則說明</h2>
            <div className="rules-box">
              <div className="rules-header">
                <h3>{settings.tournamentMode === 'inter-club' ? '友誼賽比賽規則：' : '本次會內賽比賽規則：'}</h3>
                {settings.tournamentMode === 'internal' && (
                  <div className="rules-toggle">
                    <label>規則約束：</label>
                    <button
                      className={`btn-toggle ${settings.enforceRules ? 'active' : ''}`}
                      onClick={() => setSettings({ ...settings, enforceRules: !settings.enforceRules })}
                    >
                      <span className="toggle-slider">
                        {settings.enforceRules ? '✓' : '✕'}
                      </span>
                      <span className="toggle-label">{settings.enforceRules ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                )}
              </div>
              <ul>
                {settings.tournamentMode === 'inter-club' ? (
                  <>
                    <li>{settings.homeClubName} vs {settings.awayClubName} 對抗賽</li>
                    <li>由管理者自由安排對戰配對，無人數、輪次限制</li>
                    <li>{getRulesFormatText(settings)}</li>
                    <li>請至「手動配對」功能建立比賽</li>
                  </>
                ) : (
                  <>
                    <li>打{settings.pointsPerRound}點雙打：
                      <ul>
                        <li>第1點至第{settings.pointsPerRound - 1}點：兩人歲數遞增</li>
                        <li>第{settings.pointsPerRound}點：必須安排混雙或女雙出賽，歲數沒有限制</li>
                      </ul>
                    </li>
                    <li>每位正式選手至少須出賽{settings.minMatchesPerPlayer}場</li>
                    <li>{getRulesFormatText(settings)}</li>
                  </>
                )}
              </ul>
            </div>

            <h2>🎯 自動分組規則</h2>
            <div className="rules-box">
              <p style={{ marginBottom: '0.5rem', fontWeight: '600' }}>匯入選手時，系統會自動分配到4隊（甲乙丙丁），遵循以下優先順序：</p>
              <ul style={{ marginTop: '0.5rem' }}>
                <li><strong>1️⃣ 預分配優先：</strong>已指定隊伍的選手保持原隊伍不變</li>
                {settings.tournamentMode === 'internal' && (
                  <li><strong>2️⃣ 領隊優先：</strong>具有分組標籤的選手分配到指定隊伍
                    <ul style={{ marginTop: '0.25rem' }}>
                      <li>A1, A2 → 甲隊</li>
                      <li>B1, B2 → 乙隊</li>
                      <li>C1, C2 → 丙隊</li>
                      <li>D1, D2 → 丁隊</li>
                    </ul>
                  </li>
                )}
                <li><strong>3️⃣ 技術等級平衡：</strong>使用蛇形分配確保各隊技術實力均衡
                  <ul style={{ marginTop: '0.25rem' }}>
                    <li>將選手按技術等級分組（A1～D4）</li>
                    <li>每個等級內隨機排序（增加變化性）</li>
                    <li>按順序分配：甲→乙→丙→丁→丁→丙→乙→甲（循環反轉）</li>
                    <li>性別分流蛇形順序：男（甲→乙→丙→丁→丁→丙→乙→甲）、女（丁→丙→乙→甲→甲→乙→丙→丁）</li>
                    <li>範例：A1會優先於A2、A3、A4；B/C/D級亦同</li>
                  </ul>
                </li>
                <li><strong>4️⃣ 性別平衡：</strong>女選手和男選手分別進行分組，確保各隊男女比例相近</li>
              </ul>
              <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#666' }}>
                💡 提示：技術等級請填 A1~D4（預設 B2）
              </p>
            </div>

            {settings.tournamentMode === 'internal' && (
              <div className="team-status">
                <h3>隊伍人數狀態</h3>
                <div className="teams-grid">
                  {(['甲隊', '乙隊', '丙隊', '丁隊'] as TeamName[]).map(team => (
                    <div key={team} className={`team-card ${getTeamCount(team) === settings.playersPerTeam ? 'complete' : ''}`}>
                      <h4>{team}</h4>
                      <div className="team-count">
                        {getTeamCount(team)} / {settings.playersPerTeam} 人
                      </div>
                      {getTeamCount(team) === settings.playersPerTeam && <div className="check-mark">✓</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {settings.tournamentMode === 'inter-club' && (
              <div className="team-status">
                <h3>俱樂部人數狀態</h3>
                <div className="teams-grid">
                  <div className="team-card club-card">
                    <h4>{settings.homeClubName}</h4>
                    <div className="team-count">
                      {getTeamCount('甲隊') + getTeamCount('乙隊')} 人
                    </div>
                  </div>
                  <div className="team-card club-card">
                    <h4>{settings.awayClubName}</h4>
                    <div className="team-count">
                      {getTeamCount('丙隊') + getTeamCount('丁隊')} 人
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="setup-actions">
              {!tournamentStarted ? (
                <>
                  <div className="start-options">
                    {settings.tournamentMode === 'internal' && (
                      <button 
                        className="btn-primary btn-large"
                        onClick={handleStartTournament}
                        disabled={totalPlayersCount < settings.playersPerTeam * 4}
                      >
                        自動生成賽程
                      </button>
                    )}
                    <button 
                      className="btn-primary btn-large btn-manual"
                      onClick={handleStartManualSetup}
                      disabled={settings.tournamentMode === 'internal' && totalPlayersCount < settings.playersPerTeam * 4}
                    >
                      {settings.tournamentMode === 'inter-club' ? '開始配對（手動）' : '手動配對設定'}
                    </button>
                  </div>
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                    <button 
                      className="btn-secondary btn-large"
                      onClick={handleLoadDemoData}
                    >
                      載入示範資料
                    </button>
                    <label className="btn-secondary btn-large" style={{ cursor: 'pointer', margin: 0 }}>
                      從Excel載入選手資料
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImportDemoDataExcel(file);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                    <label className="btn-secondary btn-large" style={{ cursor: 'pointer', margin: 0 }}>
                      從JSON載入選手資料
                      <input
                        type="file"
                        accept=".json"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImportDemoData(file);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                  {totalPlayersCount < settings.playersPerTeam * 4 && (
                    <p className="warning">
                      請至少新增{settings.playersPerTeam * 4}名選手（目前：{totalPlayersCount}/{settings.playersPerTeam * 4}）
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="tournament-info">
                    <p>✓ 賽事已開始</p>
                    <p>共 {matches.length} 場比賽，{totalRounds} 輪</p>
                  </div>
                  <button 
                    className="btn-danger"
                    onClick={handleResetTournament}
                  >
                    重置賽事
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {currentView === 'players' && (
          <PlayerManagement
            players={players}
            settings={settings}
            onAddPlayer={handleAddPlayer}
            onUpdatePlayer={handleUpdatePlayer}
            onDeletePlayer={handleDeletePlayer}
            onExportArrangementTemplateExcel={handleExportArrangementTemplateExcel}
            onExportPlayers={handleExportPlayers}
            onExportPlayersExcel={handleExportPlayersExcel}
            onImportPlayers={handleImportPlayers}
            onImportPlayersExcel={handleImportPlayersExcel}
            onExportInvoices={handleExportInvoices}
            showSensitiveInfo={showSensitiveInfo}
          />
        )}

        {currentView === 'matches' && tournamentStarted && (
          <div className="matches-view">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>比賽列表</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-primary" onClick={() => setCurrentView('manual-setup')}>
                  ✏️ 手動調整
                </button>
                <button className="btn-secondary" onClick={() => {
                  const format = prompt('選擇匯出格式：\n1 - Excel\n2 - JSON', '1');
                  if (format === '1') {
                    handleExportMatchesExcel();
                  } else if (format === '2') {
                    handleExportMatches();
                  }
                }}>
                  📤 匯出
                </button>
                <button className="btn-secondary" onClick={() => {
                  const format = prompt('選擇匯入格式：\n1 - Excel\n2 - JSON\n\n注意：Excel匯入比賽功能建議使用JSON格式', '1');
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = format === '1' ? '.xlsx,.xls' : '.json';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      if (format === '1') {
                        handleImportMatchesExcel(file);
                      } else if (format === '2') {
                        handleImportMatches(file);
                      }
                    }
                  };
                  if (format === '1' || format === '2') {
                    input.click();
                  }
                }}>
                  📂 匯入
                </button>
              </div>
            </div>
            <div className="filters">
              <div className="filter-group">
                <label>選擇輪次：</label>
                <select 
                  value={filterRound || ''} 
                  onChange={(e) => setFilterRound(e.target.value ? parseInt(e.target.value) : undefined)}
                >
                  <option value="">全部輪次</option>
                  {Array.from({ length: totalRounds }, (_, i) => i + 1).map(round => (
                    <option key={round} value={round}>第 {round} 輪</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>比賽狀態：</label>
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                >
                  <option value="all">全部</option>
                  <option value="scheduled">未開始</option>
                  <option value="in-progress">進行中</option>
                  <option value="completed">已完成</option>
                </select>
              </div>
            </div>

            <MatchList
              matches={matches}
              onUpdateScore={handleUpdateScore}
              onCompleteMatch={handleCompleteMatch}
              onResetMatch={handleResetMatch}
              filterRound={filterRound}
              filterStatus={filterStatus}
              gamesPerMatch={settings.gamesPerMatch}
              fourGameDeuceMode={settings.fourGameDeuceMode}
              showSensitiveInfo={showSensitiveInfo}
            />
          </div>
        )}

        {currentView === 'standings' && tournamentStarted && (
          <Standings matches={matches} players={players} settings={settings} showSensitiveInfo={showSensitiveInfo} />
        )}

        {currentView === 'manual-setup' && (
          <ManualMatchSetup
            players={players}
            settings={settings}
            existingMatches={tournamentStarted ? matches : undefined}
            onGenerateMatches={handleManualMatchesGenerated}
            onCancel={() => setCurrentView(tournamentStarted ? 'matches' : 'setup')}
            showSensitiveInfo={showSensitiveInfo}
          />
        )}

        {currentView === 'grand-slam' && (
          <GrandSlamTournament
            onBack={() => setCurrentView('setup')}
            showSensitiveInfo={showSensitiveInfo}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>© 2025 Tennis Doubles Tournament System</p>
      </footer>

      <RulesModal 
        isOpen={showRulesModal} 
        onClose={() => setShowRulesModal(false)} 
        settings={settings}
      />

      <CustomModal
        isOpen={modal.isOpen}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.handleConfirm}
        onCancel={modal.handleCancel}
      />
    </div>
  );
}

export default App;
