import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import type { Player, Match, TeamName, TournamentSettings, Gender, SkillLevel, InvoiceSettings } from './types';
import { PlayerManagement } from './components/PlayerManagement';
import { MatchList } from './components/MatchList';
import { Standings } from './components/Standings';
import { RulesModal } from './components/RulesModal';
import { ManualMatchSetup } from './components/ManualMatchSetup';
import { CustomModal } from './components/CustomModal';
import { useModal } from './hooks/useModal';
import { generateFullSchedule } from './utils/scheduleGenerator';
import { generateDemoPlayers } from './utils/demoData';
import { exportPlayerInvoicesExcel, exportCompactInvoicesPDF } from './utils/invoiceGenerator';
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

// Auto-distribute players to teams evenly
const autoDistributeTeams = (players: Player[]): Player[] => {
  const teams: TeamName[] = ['甲隊', '乙隊', '丙隊', '丁隊'];
  const teamMap: { [key: string]: TeamName } = {
    'A1': '甲隊', 'A2': '甲隊',
    'B1': '乙隊', 'B2': '乙隊',
    'C1': '丙隊', 'C2': '丙隊',
    'D1': '丁隊', 'D2': '丁隊',
  };
  
  // Separate captains and regular players
  const captains = players.filter(p => p.groupTag && teamMap[p.groupTag]);
  const regularPlayers = players.filter(p => !p.groupTag || !teamMap[p.groupTag]);
  
  // Assign captains to their designated teams
  captains.forEach(captain => {
    if (captain.groupTag && teamMap[captain.groupTag]) {
      captain.team = teamMap[captain.groupTag];
    }
  });
  
  // Separate regular players by gender for balanced distribution
  const femalePlayers = shuffleArray(regularPlayers.filter(p => p.gender === '女'));
  const malePlayers = shuffleArray(regularPlayers.filter(p => p.gender === '男'));
  
  // Distribute all regular players with continuous round-robin to ensure even team distribution
  let teamIndex = 0;
  
  // Distribute female players first to ensure balance (important for point 5 mixed doubles rule)
  femalePlayers.forEach((player) => {
    player.team = teams[teamIndex % 4];
    teamIndex++;
  });
  
  // Continue with male players using the same counter
  malePlayers.forEach((player) => {
    player.team = teams[teamIndex % 4];
    teamIndex++;
  });
  
  return [...captains, ...femalePlayers, ...malePlayers];
};

type View = 'setup' | 'players' | 'matches' | 'standings' | 'manual-setup';

function App() {
  const [currentView, setCurrentView] = useState<View>('setup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [filterRound, setFilterRound] = useState<number | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'in-progress' | 'completed'>('all');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(true);
  
  // Custom modal
  const modal = useModal();
  
  // Tournament settings
  const [settings, setSettings] = useState<TournamentSettings>({
    playersPerTeam: 10,
    pointsPerRound: 5,
    totalRounds: 3,
    minMatchesPerPlayer: 2,
    enforceRules: true,
  });

  // 從 localStorage 載入資料
  useEffect(() => {
    const savedPlayers = localStorage.getItem('tennisPlayers');
    const savedMatches = localStorage.getItem('tennisMatches');
    const savedStarted = localStorage.getItem('tournamentStarted');
    const savedSettings = localStorage.getItem('tournamentSettings');

    if (savedPlayers) setPlayers(JSON.parse(savedPlayers));
    if (savedMatches) setMatches(JSON.parse(savedMatches));
    if (savedStarted) setTournamentStarted(JSON.parse(savedStarted));
    if (savedSettings) setSettings(JSON.parse(savedSettings));
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
    // 總輪數就代表對戰的對手數（3輪 = 對戰3個對手）
    // 一隊的總選手位置數 = 總輪數 × 每輪點數 × 每場2名選手
    const totalPlayerSlotsPerTeam = settings.totalRounds * settings.pointsPerRound * 2;
    
    // 計算平均每人出賽次數，向下取整作為最低要求
    // 這是為了確保公平競賽，防止只讓強者出賽
    const minMatches = Math.floor(totalPlayerSlotsPerTeam / settings.playersPerTeam);
    
    setSettings(prev => ({
      ...prev,
      minMatchesPerPlayer: Math.max(1, minMatches),
    }));
  }, [settings.playersPerTeam, settings.pointsPerRound, settings.totalRounds]);

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
    const distributedPlayers = autoDistributeTeams(demoPlayers);
    setPlayers(distributedPlayers);
    await modal.showAlert(`已載入${distributedPlayers.length}名示範選手！請到「選手管理」查看或前往「賽事設定」開始賽事。`);
  };

  const handleImportDemoData = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported) && imported.length > 0) {
          if (players.length > 0) {
            const confirmed = await modal.showConfirm('這將覆蓋現有選手資料，確定要從檔案載入示範資料嗎？');
            if (!confirmed) return;
          }
          // Check if any player has team assigned
          const hasTeamAssigned = imported.some(p => p.team && p.team !== '甲隊');
          
          // If no teams assigned, auto-distribute; otherwise shuffle with existing teams
          const finalPlayers = hasTeamAssigned ? shuffleArray(imported) : autoDistributeTeams(imported);
          setPlayers(finalPlayers);
          await modal.showAlert(`成功從檔案載入 ${imported.length} 名示範選手！`);
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
          
          return {
            id: `demo-player-${Date.now()}-${index}`,
            name: row['姓名'] || '',
            age: age,
            gender: (row['性別'] === '女' ? '女' : '男') as Gender,
            skillLevel: (row['技術等級'] || 'B') as SkillLevel,
            team: row['隊伍'] ? (row['隊伍'] as TeamName) : '甲隊', // Temporary assignment
            matchesPlayed: 0,
            groupTag: row['分組標籤'] ? String(row['分組標籤']).trim() : undefined,
          };
        });
        
        if (imported.length > 0) {
          if (players.length > 0) {
            const confirmed = await modal.showConfirm('這將覆蓋現有選手資料，確定要從Excel載入示範資料嗎？');
            if (!confirmed) return;
          }
          // Check if any player has team assigned
          const hasTeamAssigned = imported.some(p => jsonData[imported.indexOf(p)]['隊伍']);
          
          // If no teams assigned, auto-distribute; otherwise shuffle with existing teams
          const finalPlayers = hasTeamAssigned ? shuffleArray(imported) : autoDistributeTeams(imported);
          setPlayers(finalPlayers);
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
    const dataStr = JSON.stringify(players, null, 2);
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
    const format = prompt('選擇年齡格式：\n1 - 年齡（實際年齡）\n2 - 年次（民國）', '1');
    if (!format || (format !== '1' && format !== '2')) return;
    
    const currentYear = new Date().getFullYear();
    const rocYear = currentYear - 1911;
    
    const exportData = players.map(p => {
      const data: any = {
        '姓名': p.name,
        '性別': p.gender,
        '技術等級': p.skillLevel,
        '隊伍': p.team,
        '分組標籤': p.groupTag || '',
      };
      
      // Add age or 年次 column based on user choice
      if (format === '2') {
        // Export as 年次 (ROC birth year)
        data['年次'] = rocYear - p.age;
      } else {
        // Export as 年齡 (age)
        data['年齡'] = p.age;
      }
      
      return data;
    });
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '選手名單');
    XLSX.writeFile(wb, `選手名單_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImportPlayers = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported) && imported.length > 0) {
          if (players.length > 0) {
            const confirmed = await modal.showConfirm('這將覆蓋現有選手資料，確定要匯入嗎？');
            if (!confirmed) return;
          }
          // Auto-distribute teams to ensure balanced distribution
          const distributedPlayers = autoDistributeTeams(imported);
          setPlayers(distributedPlayers);
          await modal.showAlert(`成功匯入 ${imported.length} 名選手！`);
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
          
          let gender: Gender = '男';
          if (genderValue === '女' || genderValue === 'W' || genderValue === 'WOMAN' || 
              genderValue === 'F' || genderValue === 'FEMALE') {
            gender = '女';
          } else if (genderValue === '男' || genderValue === 'M' || genderValue === 'MAN' || 
                     genderValue === 'MALE') {
            gender = '男';
          }
          
          // Handle skill level: A/B/C or default to B
          const skillValue = String(row['技術等級'] || 'B').toUpperCase().trim();
          let skillLevel: SkillLevel = 'B';
          if (skillValue === 'A' || skillValue === 'B' || skillValue === 'C') {
            skillLevel = skillValue as SkillLevel;
          }
          
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
          
          return {
            id: `imported-player-${Date.now()}-${index}`,
            name: row['姓名'] || '',
            age: age,
            gender,
            skillLevel,
            team: (row['隊伍'] || '甲隊') as TeamName,
            matchesPlayed: 0,
            groupTag: row['分組標籤'] ? String(row['分組標籤']).trim() : undefined,
          };
        });
        
        if (imported.length > 0) {
          if (players.length > 0) {
            const confirmed = await modal.showConfirm('這將覆蓋現有選手資料，確定要匯入嗎？');
            if (!confirmed) return;
          }
          // Auto-distribute teams to ensure balanced distribution
          const distributedPlayers = autoDistributeTeams(imported);
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
              <div className="settings-grid">
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
                </div>
                
                <div className="settings-summary">
                  <h4>賽事總覽</h4>
                  <p>• 總比賽數：{settings.totalRounds * 2 * settings.pointsPerRound} 場</p>
                  <p>• 每輪對戰組合：2 組（循環賽制，每隊每輪打1場）</p>
                  <p>• 每組對戰點數：{settings.pointsPerRound} 點</p>
                  <p>• 每位選手每輪出賽：1 場（共{settings.totalRounds}場）</p>
                </div>
              </div>
            
            <h2>賽事規則說明</h2>
            <div className="rules-box">
              <div className="rules-header">
                <h3>本次會內賽比賽規則：</h3>
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
              </div>
              <ul>
                <li>參賽共{settings.playersPerTeam * 4}名，分成四隊：每隊{settings.playersPerTeam}人</li>
                <li>打{settings.pointsPerRound}點雙打：
                  <ul>
                    <li>第1點至第{settings.pointsPerRound - 1}點：兩人歲數遞增</li>
                    <li>第{settings.pointsPerRound}點：必須安排混雙或女雙出賽，歲數沒有限制</li>
                  </ul>
                </li>
                <li>每位正式選手至少須出賽{settings.minMatchesPerPlayer}場</li>
                <li>可設定候補選手，不計入隊伍{settings.playersPerTeam}人名額</li>
                <li>比賽採5局NO-AD制，先達5局獲勝</li>
                <li>4:4時則Tie-break搶7決勝</li>
              </ul>
            </div>

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

            <div className="setup-actions">
              {!tournamentStarted ? (
                <>
                  <div className="start-options">
                    <button 
                      className="btn-primary btn-large"
                      onClick={handleStartTournament}
                      disabled={totalPlayersCount < settings.playersPerTeam * 4}
                    >
                      自動生成賽程
                    </button>
                    <button 
                      className="btn-primary btn-large btn-manual"
                      onClick={handleStartManualSetup}
                      disabled={totalPlayersCount < settings.playersPerTeam * 4}
                    >
                      手動配對設定
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
