import React, { useState, useEffect } from 'react';
import type { Player, TeamName, PointType, Match, TournamentSettings } from '../types';

interface ManualMatchSetupProps {
  players: Player[];
  settings: TournamentSettings;
  existingMatches?: Match[];
  onGenerateMatches: (matches: Match[]) => void;
  onCancel: () => void;
  showSensitiveInfo?: boolean;
}

interface MatchAssignment {
  id: string;
  roundNumber: number;
  pointNumber: PointType;
  team1: TeamName;
  team2: TeamName;
  pair1: [Player | null, Player | null];
  pair2: [Player | null, Player | null];
}

interface SavedTemplate {
  name: string;
  date: string;
  settings: TournamentSettings;
  assignments: Array<{
    id: string;
    roundNumber: number;
    pointNumber: number;
    team1: TeamName;
    team2: TeamName;
    pair1PlayerIds: [string | null, string | null];
    pair2PlayerIds: [string | null, string | null];
  }>;
}

type SetupViewMode = 'edit' | 'preview';

export const ManualMatchSetup: React.FC<ManualMatchSetupProps> = ({
  players,
  settings,
  existingMatches,
  onGenerateMatches,
  onCancel,
  showSensitiveInfo = true,
}) => {
  const [currentRound, setCurrentRound] = useState(1);
  const [assignments, setAssignments] = useState<MatchAssignment[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamName | 'all'>('all');
  const [hasAutoAddedFirstMatch, setHasAutoAddedFirstMatch] = useState(false);
  const [viewMode, setViewMode] = useState<SetupViewMode>('edit');
  const [previewRound, setPreviewRound] = useState(1);
  useEffect(() => {
    setPreviewRound(currentRound);
  }, [currentRound]);


  const isLevelAPlayer = (player: Player | null | undefined) => !!player && player.skillLevel.startsWith('A') && player.gender === '男';
  const isPoint1ConstraintPoint = (pointNumber: number) => settings.point1LevelAConstraint && pointNumber === 1;
  const isAgeConstraintPoint = (pointNumber: number) => {
    const start = settings.point1LevelAConstraint ? 2 : 1;
    const end = settings.pointsPerRound - 1;
    return settings.points2To4AgeAscendingConstraint && pointNumber >= start && pointNumber <= end;
  };
  const isPoint5ConstraintPoint = (pointNumber: number) => settings.point5WomenOrMixedConstraint && pointNumber === settings.pointsPerRound;
  const isValidPoint5Pair = (pair: [Player | null, Player | null], teamPlayers: Player[]) => {
    if (!pair[0] || !pair[1]) return false;
    const isWomensDouble = pair[0].gender === '女' && pair[1].gender === '女';
    const isMixedDouble = pair[0].gender !== pair[1].gender;
    const teamFemaleCount = teamPlayers.filter(p => p.gender === '女').length;
    if (teamFemaleCount >= 2) return isWomensDouble;
    return isWomensDouble || isMixedDouble;
  };

  // 初始化所有對戰組合
  useEffect(() => {
    let matchups: [TeamName, TeamName][];
    
    if (settings.tournamentMode === 'inter-club') {
      // Inter-club mode: only cross-club matches
      matchups = [
        ['甲隊', '丙隊'],
        ['甲隊', '丁隊'],
        ['乙隊', '丙隊'],
        ['乙隊', '丁隊'],
      ];
    } else {
      // Internal mode: all team combinations
      matchups = [
        ['甲隊', '乙隊'],
        ['甲隊', '丙隊'],
        ['甲隊', '丁隊'],
        ['乙隊', '丙隊'],
        ['乙隊', '丁隊'],
        ['丙隊', '丁隊'],
      ];
    }

    const initialAssignments: MatchAssignment[] = [];
    
    // If there are existing matches, load them into assignments (excluding completed matches)
    if (existingMatches && existingMatches.length > 0) {
      existingMatches.forEach(match => {
        // Skip completed matches - they should not be editable
        if (match.status === 'completed') return;
        
        initialAssignments.push({
          id: match.id,
          roundNumber: match.roundNumber,
          pointNumber: match.pointNumber,
          team1: match.team1,
          team2: match.team2,
          pair1: [match.pair1.player1, match.pair1.player2],
          pair2: [match.pair2.player1, match.pair2.player2],
        });
      });
    } else {
      // In inter-club mode, don't pre-create assignments - let user add as needed
      if (settings.tournamentMode === 'inter-club') {
        // Start with empty assignments - user will add manually
      } else {
        // Internal mode: create all assignments based on settings
        for (let round = 1; round <= settings.totalRounds; round++) {
          matchups.forEach(([team1, team2]) => {
            for (let point = 1; point <= settings.pointsPerRound; point++) {
              initialAssignments.push({
                id: `R${round}-${team1}-${team2}-P${point}`,
                roundNumber: round,
                pointNumber: point,
                team1,
                team2,
                pair1: [null, null],
                pair2: [null, null],
              });
            }
          });
        }
      }
    }
    setAssignments(initialAssignments);
  }, [settings.totalRounds, settings.pointsPerRound, settings.tournamentMode, existingMatches]);

  // 驗證並清除違反硬性規則的配對
  useEffect(() => {
    if (!settings.point1LevelAConstraint && !settings.point5WomenOrMixedConstraint) return;
    
    setAssignments(prev => prev.map(a => {
      const updated = { ...a };

      if (isPoint1ConstraintPoint(a.pointNumber) && a.pair1[0] && a.pair1[1]) {
        if (!isLevelAPlayer(a.pair1[0]) || !isLevelAPlayer(a.pair1[1])) {
          updated.pair1 = [null, null];
        }
      }

      if (isPoint1ConstraintPoint(a.pointNumber) && a.pair2[0] && a.pair2[1]) {
        if (!isLevelAPlayer(a.pair2[0]) || !isLevelAPlayer(a.pair2[1])) {
          updated.pair2 = [null, null];
        }
      }

      if (isPoint5ConstraintPoint(a.pointNumber) && a.pair1[0] && a.pair1[1]) {
        const t1Players = players.filter(p => p.team === a.team1);
        if (!isValidPoint5Pair(a.pair1, t1Players)) {
          updated.pair1 = [null, null];
        }
      }

      if (isPoint5ConstraintPoint(a.pointNumber) && a.pair2[0] && a.pair2[1]) {
        const t2Players = players.filter(p => p.team === a.team2);
        if (!isValidPoint5Pair(a.pair2, t2Players)) {
          updated.pair2 = [null, null];
        }
      }
      
      return updated;
    }));
  }, [settings.point1LevelAConstraint, settings.point5WomenOrMixedConstraint]);

  // Auto-add first match in inter-club mode when starting with no matches
  useEffect(() => {
    if (settings.tournamentMode === 'inter-club' && 
        assignments.length === 0 && 
        !hasAutoAddedFirstMatch &&
        !existingMatches) {
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        const newMatchId = `match-${Date.now()}`;
        setAssignments([{
          id: newMatchId,
          roundNumber: 1,
          pointNumber: 1,
          team1: '甲隊',
          team2: '丙隊',
          pair1: [null, null],
          pair2: [null, null],
        }]);
        setHasAutoAddedFirstMatch(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [settings.tournamentMode, assignments.length, hasAutoAddedFirstMatch, existingMatches]);

  // 載入儲存的範本
  useEffect(() => {
    const saved = localStorage.getItem('matchTemplates');
    if (saved) {
      try {
        setSavedTemplates(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load templates:', e);
      }
    }
  }, []);

  // 儲存範本到 localStorage
  const saveTemplatesToStorage = (templates: SavedTemplate[]) => {
    localStorage.setItem('matchTemplates', JSON.stringify(templates));
    setSavedTemplates(templates);
  };

  const getTeamPlayers = (teamName: TeamName): Player[] => {
    return players.filter(p => p.team === teamName);
  };

  // Add new match (for inter-club mode)
  const addNewMatch = () => {
    const newMatchId = `match-${Date.now()}`;
    const matchupOptions: [TeamName, TeamName][] = [
      ['甲隊', '丙隊'],
      ['甲隊', '丁隊'],
      ['乙隊', '丙隊'],
      ['乙隊', '丁隊'],
    ];
    const [team1, team2] = matchupOptions[0]; // Default to first option
    
    setAssignments(prev => [...prev, {
      id: newMatchId,
      roundNumber: 1, // In inter-club mode, round doesn't matter
      pointNumber: prev.length + 1, // Just use sequential numbers
      team1,
      team2,
      pair1: [null, null],
      pair2: [null, null],
    }]);
  };

  // Remove match (for inter-club mode)
  const removeMatch = (matchId: string) => {
    setAssignments(prev => prev.filter(a => a.id !== matchId));
  };

  const updateAssignment = (
    assignmentId: string,
    team: 'pair1' | 'pair2',
    position: 0 | 1,
    playerId: string | null
  ) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== assignmentId) return a;
      
      const newPair: [Player | null, Player | null] = [...a[team]];
      if (playerId) {
        const player = players.find(p => p.id === playerId);
        newPair[position] = player || null;
      } else {
        newPair[position] = null;
      }
      
      return { ...a, [team]: newPair };
    }));
  };

  // 檢查選手是否可以在指定點數被選擇
  const canSelectPlayerForPoint = (player: Player, otherPlayer: Player | null, pointNumber: number, allTeamPlayers: Player[]): boolean => {
    if (otherPlayer && otherPlayer.id === player.id) return false;
    if (isPoint1ConstraintPoint(pointNumber) && !isLevelAPlayer(player)) {
      return false;
    }
    if (!isPoint5ConstraintPoint(pointNumber)) return true;
    const teamFemaleCount = allTeamPlayers.filter(p => p.gender === '女').length;
    if (!otherPlayer) {
      // 队伍女性足芵（2人以上）時，禁止選攮男性
      if (player.gender === '男' && teamFemaleCount >= 2) return false;
      return true;
    }
    const isWomensDouble = player.gender === '女' && otherPlayer.gender === '女';
    const isMixedDouble = player.gender !== otherPlayer.gender;
    if (teamFemaleCount >= 2) return isWomensDouble;
    return isWomensDouble || isMixedDouble;
  };

  // 計算選手出賽次數（包含已完成和當前設定的比賽）
  const getPlayerMatchCount = (playerId: string): number => {
    const matchIds = new Set<string>();
    
    // 計算已存在的比賽
    if (existingMatches) {
      existingMatches.forEach(match => {
        if (match.pair1.player1?.id === playerId || match.pair1.player2?.id === playerId ||
            match.pair2.player1?.id === playerId || match.pair2.player2?.id === playerId) {
          matchIds.add(match.id);
        }
      });
    }
    
    // 計算當前配對中的比賽
    assignments.forEach(assignment => {
      if (assignment.pair1[0]?.id === playerId || assignment.pair1[1]?.id === playerId ||
          assignment.pair2[0]?.id === playerId || assignment.pair2[1]?.id === playerId) {
        matchIds.add(assignment.id);
      }
    });
    
    return matchIds.size;
  };

  const validateAssignments = (): string[] => {
    // Skip validation in inter-club mode
    if (settings.tournamentMode === 'inter-club') {
      return [];
    }
    
    const errors: string[] = [];
    const currentAssignments = assignments.filter(a => a.roundNumber === currentRound);

    // 檢查每個對戰的配對是否都完成
    const matchupGroups = new Map<string, MatchAssignment[]>();
    currentAssignments.forEach(a => {
      const key = `${a.team1}-${a.team2}`;
      if (!matchupGroups.has(key)) matchupGroups.set(key, []);
      matchupGroups.get(key)!.push(a);
    });

    matchupGroups.forEach((matches, matchup) => {
      matches.forEach(match => {
        // 只對已配對完成的比賽檢查規則約束
        const team1Complete = match.pair1[0] && match.pair1[1];
        const team2Complete = match.pair2[0] && match.pair2[1];

        if (isPoint1ConstraintPoint(match.pointNumber)) {
          if (team1Complete && (!isLevelAPlayer(match.pair1[0]) || !isLevelAPlayer(match.pair1[1]))) {
            errors.push(`${matchup} 第1點 ${match.team1}必須為男雙A級選手`);
          }
          if (team2Complete && (!isLevelAPlayer(match.pair2[0]) || !isLevelAPlayer(match.pair2[1]))) {
            errors.push(`${matchup} 第1點 ${match.team2}必須為男雙A級選手`);
          }
        }

        // 檢查第N點是否為女雙（少於2位女性可混雙）
        if (isPoint5ConstraintPoint(match.pointNumber)) {
          const t1Players = players.filter(p => p.team === match.team1);
          const t2Players = players.filter(p => p.team === match.team2);
          if (team1Complete) {
            if (!isValidPoint5Pair(match.pair1, t1Players)) {
              errors.push(`${matchup} 第${settings.pointsPerRound}點 ${match.team1}必須為女雙（少於2位女性可混雙）`);
            }
          }
          if (team2Complete) {
            if (!isValidPoint5Pair(match.pair2, t2Players)) {
              errors.push(`${matchup} 第${settings.pointsPerRound}點 ${match.team2}必須為女雙（少於2位女性可混雙）`);
            }
          }
        }
      });

      // 檢查第2到4點年齡遞增（如果啟用規則約束）
      if (settings.points2To4AgeAscendingConstraint) {
        const sortedMatches = matches.filter(m => isAgeConstraintPoint(m.pointNumber)).sort((a, b) => a.pointNumber - b.pointNumber);
        for (let i = 1; i < sortedMatches.length; i++) {
          const prevMatch = sortedMatches[i - 1];
          const currMatch = sortedMatches[i];
          
          if (prevMatch.pair1[0] && prevMatch.pair1[1] && currMatch.pair1[0] && currMatch.pair1[1]) {
            const prevAge = prevMatch.pair1[0].age + prevMatch.pair1[1].age;
            const currAge = currMatch.pair1[0].age + currMatch.pair1[1].age;
            if (currAge <= prevAge) {
              errors.push(`${matchup} ${currMatch.team1} 第${currMatch.pointNumber}點年齡未遞增`);
            }
          }
          
          if (prevMatch.pair2[0] && prevMatch.pair2[1] && currMatch.pair2[0] && currMatch.pair2[1]) {
            const prevAge = prevMatch.pair2[0].age + prevMatch.pair2[1].age;
            const currAge = currMatch.pair2[0].age + currMatch.pair2[1].age;
            if (currAge <= prevAge) {
              errors.push(`${matchup} ${currMatch.team2} 第${currMatch.pointNumber}點年齡未遞增`);
            }
          }
        }
      }
    });

    return errors;
  };

  const handleNextRound = () => {
    const errors = validateAssignments();
    if (errors.length > 0) {
      const proceed = window.confirm(
        '發現以下問題：\n' + errors.join('\n') + 
        '\n\n是否仍要繼續？（未配對的比賽可稍後配對）'
      );
      if (!proceed) return;
    }
    
    if (currentRound < settings.totalRounds) {
      setCurrentRound(currentRound + 1);
    }
  };

  const handleFinishSetup = () => {
    const errors = validateAssignments();
    const unassignedCount = assignments.filter(a => !a.pair1[0] || !a.pair1[1] || !a.pair2[0] || !a.pair2[1]).length;
    
    if (errors.length > 0 || unassignedCount > 0) {
      const message = [
        errors.length > 0 ? '規則檢查問題：\n' + errors.join('\n') : '',
        unassignedCount > 0 ? `\n尚有 ${unassignedCount} 場比賽未配對完成` : '',
        '\n\n未配對的比賽將顯示為「待定(TBD)」，可在賽事進行中隨時配對。\n是否要開始賽事？'
      ].filter(Boolean).join('');
      
      const proceed = window.confirm(message);
      if (!proceed) return;
    }

    // 轉換為Match物件（包含未配對的TBD比賽）
    const matches: Match[] = assignments
      .map(a => ({
        id: a.id,
        roundNumber: a.roundNumber,
        pointNumber: a.pointNumber,
        team1: a.team1,
        team2: a.team2,
        pair1: {
          player1: a.pair1[0] || null,
          player2: a.pair1[1] || null,
          totalAge: (a.pair1[0] && a.pair1[1]) ? a.pair1[0].age + a.pair1[1].age : 0,
        },
        pair2: {
          player1: a.pair2[0] || null,
          player2: a.pair2[1] || null,
          totalAge: (a.pair2[0] && a.pair2[1]) ? a.pair2[0].age + a.pair2[1].age : 0,
        },
        team1Games: 0,
        team2Games: 0,
        status: 'scheduled' as const,
      }));

    onGenerateMatches(matches);
  };

  // 儲存當前配對為範本
  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      alert('請輸入範本名稱');
      return;
    }

    const template: SavedTemplate = {
      name: templateName,
      date: new Date().toISOString(),
      settings: settings,
      assignments: assignments.map(a => ({
        id: a.id,
        roundNumber: a.roundNumber,
        pointNumber: a.pointNumber,
        team1: a.team1,
        team2: a.team2,
        pair1PlayerIds: [a.pair1[0]?.id || null, a.pair1[1]?.id || null],
        pair2PlayerIds: [a.pair2[0]?.id || null, a.pair2[1]?.id || null],
      })),
    };

    const newTemplates = [...savedTemplates, template];
    saveTemplatesToStorage(newTemplates);
    setTemplateName('');
    setShowSaveDialog(false);
    alert(`範本「${template.name}」已儲存！`);
  };

  // 載入範本
  const handleLoadTemplate = (template: SavedTemplate) => {
    if (!confirm(`確定要載入範本「${template.name}」嗎？\n這將覆蓋目前的配對設定。`)) {
      return;
    }

    // 檢查設定是否相符
    if (
      template.settings.playersPerTeam !== settings.playersPerTeam ||
      template.settings.pointsPerRound !== settings.pointsPerRound ||
      template.settings.totalRounds !== settings.totalRounds
    ) {
      alert('警告：範本的賽事設定與目前設定不符！\n請確認是否要繼續載入。');
    }

    // 根據儲存的 ID 找到對應的選手
    const newAssignments = template.assignments.map(ta => {
      const pair1Player1 = ta.pair1PlayerIds[0] ? players.find(p => p.id === ta.pair1PlayerIds[0]) : null;
      const pair1Player2 = ta.pair1PlayerIds[1] ? players.find(p => p.id === ta.pair1PlayerIds[1]) : null;
      const pair2Player1 = ta.pair2PlayerIds[0] ? players.find(p => p.id === ta.pair2PlayerIds[0]) : null;
      const pair2Player2 = ta.pair2PlayerIds[1] ? players.find(p => p.id === ta.pair2PlayerIds[1]) : null;

      return {
        id: ta.id,
        roundNumber: ta.roundNumber,
        pointNumber: ta.pointNumber,
        team1: ta.team1,
        team2: ta.team2,
        pair1: [pair1Player1 || null, pair1Player2 || null] as [Player | null, Player | null],
        pair2: [pair2Player1 || null, pair2Player2 || null] as [Player | null, Player | null],
      };
    });

    setAssignments(newAssignments);
    setShowLoadDialog(false);
    alert(`範本「${template.name}」已載入！`);
  };

  // 刪除範本
  const handleDeleteTemplate = (templateName: string) => {
    if (!confirm(`確定要刪除範本「${templateName}」嗎？`)) {
      return;
    }

    const newTemplates = savedTemplates.filter(t => t.name !== templateName);
    saveTemplatesToStorage(newTemplates);
    alert(`範本「${templateName}」已刪除！`);
  };

  // 匯出配對設定
  const handleExport = () => {
    const exportData = {
      name: '配對設定',
      date: new Date().toISOString(),
      settings: settings,
      assignments: assignments.map(a => ({
        id: a.id,
        roundNumber: a.roundNumber,
        pointNumber: a.pointNumber,
        team1: a.team1,
        team2: a.team2,
        pair1: {
          player1: { id: a.pair1[0]?.id, name: a.pair1[0]?.name, age: a.pair1[0]?.age, gender: a.pair1[0]?.gender },
          player2: { id: a.pair1[1]?.id, name: a.pair1[1]?.name, age: a.pair1[1]?.age, gender: a.pair1[1]?.gender },
        },
        pair2: {
          player1: { id: a.pair2[0]?.id, name: a.pair2[0]?.name, age: a.pair2[0]?.age, gender: a.pair2[0]?.gender },
          player2: { id: a.pair2[1]?.id, name: a.pair2[1]?.name, age: a.pair2[1]?.age, gender: a.pair2[1]?.gender },
        },
      })),
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `配對設定_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    alert('配對設定已匯出！');
  };

  // 匯入配對設定
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        
        if (!confirm(`確定要匯入配對設定嗎？\n這將覆蓋目前的配對。`)) {
          return;
        }

        // 根據選手 ID 或姓名匹配
        const newAssignments = importData.assignments.map((ia: any) => {
          const findPlayer = (playerData: any) => {
            if (!playerData?.id) return null;
            return players.find(p => p.id === playerData.id || p.name === playerData.name) || null;
          };

          return {
            id: ia.id,
            roundNumber: ia.roundNumber,
            pointNumber: ia.pointNumber,
            team1: ia.team1,
            team2: ia.team2,
            pair1: [findPlayer(ia.pair1?.player1), findPlayer(ia.pair1?.player2)] as [Player | null, Player | null],
            pair2: [findPlayer(ia.pair2?.player1), findPlayer(ia.pair2?.player2)] as [Player | null, Player | null],
          };
        });

        setAssignments(newAssignments);
        alert('配對設定已匯入！');
      } catch (error) {
        console.error('Import error:', error);
        alert('匯入失敗：檔案格式錯誤');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // 清除文件選擇
  };

  const currentAssignments = assignments.filter(a => a.roundNumber === currentRound);
  const matchupGroups = new Map<string, MatchAssignment[]>();
  currentAssignments.forEach(a => {
    const key = `${a.team1}-${a.team2}`;
    if (!matchupGroups.has(key)) matchupGroups.set(key, []);
    matchupGroups.get(key)!.push(a);
  });

  const previewAssignments = settings.tournamentMode === 'internal'
    ? assignments.filter(a => a.roundNumber === previewRound)
    : assignments;

  const previewMatchupGroups = new Map<string, MatchAssignment[]>();
  previewAssignments.forEach(a => {
    const key = `${a.team1}-${a.team2}`;
    if (!previewMatchupGroups.has(key)) previewMatchupGroups.set(key, []);
    previewMatchupGroups.get(key)!.push(a);
  });

  const formatPreviewPlayer = (player: Player | null) => {
    if (!player) return 'TBD';
    return showSensitiveInfo
      ? `${player.name} (${player.age}歲 ${player.gender})`
      : `${player.name} (${player.gender})`;
  };

  return (
    <div className="manual-match-setup">
      <div className="setup-header">
        <h2>
          {settings.tournamentMode === 'inter-club'
            ? `配對設定 - ${settings.homeClubName} vs ${settings.awayClubName}`
            : viewMode === 'preview'
              ? `手動配對預覽 - 第 ${previewRound} 輪`
              : `手動配對設定 - 第 ${currentRound} 輪`}
        </h2>
        
        <div className="header-actions">
          <button className="btn-template" onClick={() => setShowSaveDialog(true)}>
            💾 儲存範本
          </button>
          <button className="btn-template" onClick={() => setShowLoadDialog(true)}>
            📂 載入範本
          </button>
          <button className="btn-template" onClick={handleExport}>
            📤 匯出設定
          </button>
          <label className="btn-template" style={{ cursor: 'pointer' }}>
            📥 匯入設定
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          {settings.tournamentMode === 'inter-club' && (
            <button className="btn-primary" onClick={addNewMatch}>
              ➕ 新增比賽
            </button>
          )}
        </div>

        <div className="mode-and-rounds-bar">
          <div className="view-mode-switch" role="tablist" aria-label="配對檢視模式">
            <button
              className={`view-mode-btn ${viewMode === 'edit' ? 'active' : ''}`}
              onClick={() => setViewMode('edit')}
            >
              編輯模式
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
            >
              預覽模式
            </button>
          </div>

          {settings.tournamentMode === 'internal' && viewMode === 'edit' && (
            <div className="round-tabs">
              {Array.from({ length: settings.totalRounds }, (_, i) => i + 1).map(round => (
                <button
                  key={round}
                  className={`round-tab ${currentRound === round ? 'active' : ''}`}
                  onClick={() => setCurrentRound(round)}
                >
                  第 {round} 輪
                </button>
              ))}
            </div>
          )}

          {settings.tournamentMode === 'internal' && viewMode === 'preview' && (
            <div className="preview-round-tabs">
              {Array.from({ length: settings.totalRounds }, (_, i) => i + 1).map(round => (
                <button
                  key={round}
                  className={`preview-round-btn ${previewRound === round ? 'active' : ''}`}
                  onClick={() => setPreviewRound(round)}
                >
                  第 {round} 輪
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 隊伍篩選按鈕 */}
        {settings.tournamentMode === 'internal' && viewMode === 'edit' && (
          <div className="team-filter">
            <button
              className={`filter-btn ${selectedTeam === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedTeam('all')}
            >
              顯示全部
            </button>
            {(['甲隊', '乙隊', '丙隊', '丁隊'] as const).map(team => (
              <button
                key={team}
                className={`filter-btn ${selectedTeam === team ? 'active' : ''}`}
                onClick={() => setSelectedTeam(team)}
              >
                {team}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 儲存範本對話框 */}
      {showSaveDialog && (
        <div className="modal-overlay" onClick={() => setShowSaveDialog(false)}>
          <div className="template-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>儲存配對範本</h3>
            <input
              type="text"
              placeholder="輸入範本名稱..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveTemplate()}
            />
            <div className="dialog-actions">
              <button className="btn-primary" onClick={handleSaveTemplate}>
                確定儲存
              </button>
              <button className="btn-secondary" onClick={() => setShowSaveDialog(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 載入範本對話框 */}
      {showLoadDialog && (
        <div className="modal-overlay" onClick={() => setShowLoadDialog(false)}>
          <div className="template-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>載入配對範本</h3>
            {savedTemplates.length === 0 ? (
              <p className="no-templates">尚無儲存的範本</p>
            ) : (
              <div className="template-list">
                {savedTemplates.map((template) => (
                  <div key={template.name} className="template-item">
                    <div className="template-info">
                      <strong>{template.name}</strong>
                      <span className="template-date">
                        {new Date(template.date).toLocaleString('zh-TW')}
                      </span>
                      <span className="template-settings">
                        {template.settings.playersPerTeam}人/{template.settings.pointsPerRound}點/{template.settings.totalRounds}輪
                      </span>
                    </div>
                    <div className="template-actions">
                      <button
                        className="btn-load"
                        onClick={() => handleLoadTemplate(template)}
                      >
                        載入
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteTemplate(template.name)}
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="dialog-actions">
              <button className="btn-secondary" onClick={() => setShowLoadDialog(false)}>
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="matchups-container">
        {viewMode === 'preview' ? (
          <div className="preview-mode">
            {settings.tournamentMode === 'internal' && (
              <div className="preview-round-summary">
                <span>第 {previewRound} 輪</span>
                <span>共 {previewMatchupGroups.size} 組對戰</span>
                <span>總計 {previewAssignments.length} 場</span>
              </div>
            )}

            {previewAssignments.length === 0 ? (
              <div className="empty-state">
                <p>目前尚無可預覽的配對資料</p>
              </div>
            ) : (
              Array.from(previewMatchupGroups.entries()).map(([matchup, matches]) => {
                const [team1, team2] = matchup.split('-') as [TeamName, TeamName];

                return (
                  <div key={matchup} className="preview-matchup-section">
                    <h3>{matchup}</h3>

                    <div className="preview-points-grid">
                      {matches.sort((a, b) => a.pointNumber - b.pointNumber).map(match => (
                        <div key={match.id} className="preview-point-card">
                          <div className="point-header">
                            <span className="point-badge">第 {match.pointNumber} 點</span>
                          </div>

                          <div className="preview-pair-layout">
                            <div className="preview-pair-block">
                              <h5>{settings.tournamentMode === 'inter-club' ? settings.homeClubName : team1}</h5>
                              <div className="preview-player-list">
                                <span>{formatPreviewPlayer(match.pair1[0])}</span>
                                <span>{formatPreviewPlayer(match.pair1[1])}</span>
                              </div>
                              {settings.points2To4AgeAscendingConstraint && isAgeConstraintPoint(match.pointNumber) && match.pair1[0] && match.pair1[1] && (
                                <div className="pair-info">
                                  總年齡: {match.pair1[0].age + match.pair1[1].age}
                                </div>
                              )}
                            </div>

                            <div className="vs-divider">VS</div>

                            <div className="preview-pair-block">
                              <h5>{settings.tournamentMode === 'inter-club' ? settings.awayClubName : team2}</h5>
                              <div className="preview-player-list">
                                <span>{formatPreviewPlayer(match.pair2[0])}</span>
                                <span>{formatPreviewPlayer(match.pair2[1])}</span>
                              </div>
                              {settings.points2To4AgeAscendingConstraint && isAgeConstraintPoint(match.pointNumber) && match.pair2[0] && match.pair2[1] && (
                                <div className="pair-info">
                                  總年齡: {match.pair2[0].age + match.pair2[1].age}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : settings.tournamentMode === 'inter-club' ? (
          // Inter-club mode: show all matches in a simple list
          <div className="interclub-matches">
            <h3>比賽列表（共 {assignments.length} 場）</h3>
            {assignments.length === 0 && (
              <div className="empty-state">
                <p>尚無比賽，請點擊上方「➕ 新增比賽」按鈕開始</p>
              </div>
            )}
            {assignments.map((match, index) => (
              <div key={match.id} className="interclub-match-card">
                <div className="match-header">
                  <h4>比賽 {index + 1}</h4>
                  <button className="btn-delete-small" onClick={() => removeMatch(match.id)}>
                    🗑️ 刪除
                  </button>
                </div>
                <div className="match-teams-display">
                  <h4>{settings.homeClubName}</h4>
                  <span>vs</span>
                  <h4>{settings.awayClubName}</h4>
                </div>
                <div className="match-pairs">
                  <div className="pair-section">
                    <h5>{settings.homeClubName}</h5>
                    <select
                      value={match.pair1[0]?.id || ''}
                      onChange={(e) => updateAssignment(match.id, 'pair1', 0, e.target.value || null)}
                    >
                      <option value="">選擇選手1</option>
                      {getTeamPlayers(match.team1).map(p => (
                        <option key={p.id} value={p.id} disabled={match.pair1[1]?.id === p.id}>
                          {p.name} ({p.gender}) - 已安排{getPlayerMatchCount(p.id)}場{match.pair1[1]?.id === p.id && ' ❌'}
                        </option>
                      ))}
                    </select>
                    <select
                      value={match.pair1[1]?.id || ''}
                      onChange={(e) => updateAssignment(match.id, 'pair1', 1, e.target.value || null)}
                    >
                      <option value="">選擇選手2</option>
                      {getTeamPlayers(match.team1).map(p => (
                        <option key={p.id} value={p.id} disabled={match.pair1[0]?.id === p.id}>
                          {p.name} ({p.gender}) - 已安排{getPlayerMatchCount(p.id)}場{match.pair1[0]?.id === p.id && ' ❌'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pair-section">
                    <h5>{settings.awayClubName}</h5>
                    <select
                      value={match.pair2[0]?.id || ''}
                      onChange={(e) => updateAssignment(match.id, 'pair2', 0, e.target.value || null)}
                    >
                      <option value="">選擇選手1</option>
                      {getTeamPlayers(match.team2).map(p => (
                        <option key={p.id} value={p.id} disabled={match.pair2[1]?.id === p.id}>
                          {p.name} ({p.gender}) - 已安排{getPlayerMatchCount(p.id)}場{match.pair2[1]?.id === p.id && ' ❌'}
                        </option>
                      ))}
                    </select>
                    <select
                      value={match.pair2[1]?.id || ''}
                      onChange={(e) => updateAssignment(match.id, 'pair2', 1, e.target.value || null)}
                    >
                      <option value="">選擇選手2</option>
                      {getTeamPlayers(match.team2).map(p => (
                        <option key={p.id} value={p.id} disabled={match.pair2[0]?.id === p.id}>
                          {p.name} ({p.gender}) - 已安排{getPlayerMatchCount(p.id)}場{match.pair2[0]?.id === p.id && ' ❌'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : selectedTeam !== 'all' ? (
          // Privacy-focused view: show only selected team's assignments
          <div className="team-focused-view">
            <h3>{selectedTeam} 配對設定</h3>
            
            {/* Group assignments by opponent team */}
            {Array.from(matchupGroups.entries())
              .filter(([matchup]) => matchup.includes(selectedTeam))
              .map(([matchup, matches]) => {
                const [team1, team2] = matchup.split('-') as [TeamName, TeamName];
                const isSelectedTeam1 = team1 === selectedTeam;
                const teamPlayers = getTeamPlayers(selectedTeam);
                const opponentTeam = isSelectedTeam1 ? team2 : team1;

                return (
                  <div key={matchup} className="team-matchup-section">
                    <h4>對戰 {opponentTeam}</h4>
                    
                    <div className="points-list">
                      {matches.sort((a, b) => a.pointNumber - b.pointNumber).map(match => {
                        const currentPair = isSelectedTeam1 ? match.pair1 : match.pair2;
                        
                        return (
                          <div key={match.id} className="point-assignment">
                            <div className="point-info">
                              <span className="point-badge">第 {match.pointNumber} 點</span>
                              {isPoint1ConstraintPoint(match.pointNumber) && <span className="rule-hint">男雙A級</span>}
                              {isPoint5ConstraintPoint(match.pointNumber) && <span className="rule-hint">女雙優先</span>}
                            </div>
                            
                            <div className="team-players-only">
                              {existingMatches && (
                                <div className="current-assignment">
                                  <span className="assignment-label">目前配對：</span>
                                  <span className="assignment-players">
                                    {currentPair[0]?.name || 'TBD'} & {currentPair[1]?.name || 'TBD'}
                                  </span>
                                </div>
                              )}
                              
                              <div className="player-selects">
                                <select
                                  value={currentPair[0]?.id || ''}
                                  onChange={(e) => updateAssignment(
                                    match.id,
                                    isSelectedTeam1 ? 'pair1' : 'pair2',
                                    0,
                                    e.target.value || null
                                  )}
                                >
                                  <option value="">選擇選手1</option>
                                  {teamPlayers.map(p => {
                                    const canSelect = canSelectPlayerForPoint(p, currentPair[1], match.pointNumber, teamPlayers);
                                    return (
                                      <option key={p.id} value={p.id} disabled={!canSelect}>
                                        {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}) - 已安排{getPlayerMatchCount(p.id)}場{!canSelect && ' ❌'}
                                      </option>
                                    );
                                  })}
                                </select>
                                <select
                                  value={currentPair[1]?.id || ''}
                                  onChange={(e) => updateAssignment(
                                    match.id,
                                    isSelectedTeam1 ? 'pair1' : 'pair2',
                                    1,
                                    e.target.value || null
                                  )}
                                >
                                  <option value="">選擇選手2</option>
                                  {teamPlayers.map(p => {
                                    const canSelect = canSelectPlayerForPoint(p, currentPair[0], match.pointNumber, teamPlayers);
                                    return (
                                      <option key={p.id} value={p.id} disabled={!canSelect}>
                                        {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}) - 已安排{getPlayerMatchCount(p.id)}場{!canSelect && ' ❌'}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                              
                              {currentPair[0] && currentPair[1] && (
                                <div className="pair-info">
                                  總年齡: {currentPair[0].age + currentPair[1].age}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          // Full view: show all matchups with both teams
          <>
            {Array.from(matchupGroups.entries()).map(([matchup, matches]) => {
              const [team1, team2] = matchup.split('-') as [TeamName, TeamName];
              const team1Players = getTeamPlayers(team1);
              const team2Players = getTeamPlayers(team2);

              return (
                <div key={matchup} className="matchup-setup-section">
                  <h3>{matchup}</h3>
                  
                  <div className="points-setup-grid">
                    {matches.sort((a, b) => a.pointNumber - b.pointNumber).map(match => (
                      <div key={match.id} className="point-setup-card">
                        <div className="point-header">
                          <span className="point-badge">第 {match.pointNumber} 點</span>
                          {isPoint1ConstraintPoint(match.pointNumber) && <span className="rule-hint">男雙A級</span>}
                          {isPoint5ConstraintPoint(match.pointNumber) && <span className="rule-hint">女雙優先</span>}
                        </div>

                        <div className="pair-setup">
                          <div className="team-pair-setup">
                            <h5>{team1}</h5>
                            {existingMatches && (
                              <div className="current-assignment">
                                <span className="assignment-label">目前配對：</span>
                                <span className="assignment-players">
                                  {match.pair1[0]?.name || 'TBD'} & {match.pair1[1]?.name || 'TBD'}
                                </span>
                              </div>
                            )}
                            <div className="player-selects">
                              <select
                                value={match.pair1[0]?.id || ''}
                                onChange={(e) => updateAssignment(match.id, 'pair1', 0, e.target.value || null)}
                              >
                                <option value="">選擇選手1</option>
                                {team1Players.map(p => {
                                  const canSelect = canSelectPlayerForPoint(p, match.pair1[1], match.pointNumber, team1Players);
                                  return (
                                    <option key={p.id} value={p.id} disabled={!canSelect}>
                                      {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}) - 已安排{getPlayerMatchCount(p.id)}場{!canSelect && ' ❌'}
                                    </option>
                                  );
                                })}
                              </select>
                              <select
                                value={match.pair1[1]?.id || ''}
                                onChange={(e) => updateAssignment(match.id, 'pair1', 1, e.target.value || null)}
                              >
                                <option value="">選擇選手2</option>
                                {team1Players.map(p => {
                                  const canSelect = canSelectPlayerForPoint(p, match.pair1[0], match.pointNumber, team1Players);
                                  return (
                                    <option key={p.id} value={p.id} disabled={!canSelect}>
                                      {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}) - 已安排{getPlayerMatchCount(p.id)}場{!canSelect && ' ❌'}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            {match.pair1[0] && match.pair1[1] && (
                              <div className="pair-info">
                                總年齡: {match.pair1[0].age + match.pair1[1].age}
                              </div>
                            )}
                          </div>

                          <div className="vs-divider">VS</div>

                          <div className="team-pair-setup">
                            <h5>{team2}</h5>
                            {existingMatches && (
                              <div className="current-assignment">
                                <span className="assignment-label">目前配對：</span>
                                <span className="assignment-players">
                                  {match.pair2[0]?.name || 'TBD'} & {match.pair2[1]?.name || 'TBD'}
                                </span>
                              </div>
                            )}
                            <div className="player-selects">
                              <select
                                value={match.pair2[0]?.id || ''}
                                onChange={(e) => updateAssignment(match.id, 'pair2', 0, e.target.value || null)}
                              >
                                <option value="">選擇選手1</option>
                                {team2Players.map(p => {
                                  const canSelect = canSelectPlayerForPoint(p, match.pair2[1], match.pointNumber, team2Players);
                                  return (
                                    <option key={p.id} value={p.id} disabled={!canSelect}>
                                      {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}) - 已安排{getPlayerMatchCount(p.id)}場{!canSelect && ' ❌'}
                                    </option>
                                  );
                                })}
                              </select>
                              <select
                                value={match.pair2[1]?.id || ''}
                                onChange={(e) => updateAssignment(match.id, 'pair2', 1, e.target.value || null)}
                              >
                                <option value="">選擇選手2</option>
                                {team2Players.map(p => {
                                  const canSelect = canSelectPlayerForPoint(p, match.pair2[0], match.pointNumber, team2Players);
                                  return (
                                    <option key={p.id} value={p.id} disabled={!canSelect}>
                                      {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}) - 已安排{getPlayerMatchCount(p.id)}場{!canSelect && ' ❌'}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            {match.pair2[0] && match.pair2[1] && (
                              <div className="pair-info">
                                總年齡: {match.pair2[0].age + match.pair2[1].age}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}  
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="setup-actions">
        <div className="setup-actions-left">
          <button className="btn-primary setup-action-btn" onClick={onCancel}>
            {existingMatches ? '返回比賽列表' : '返回'}
          </button>
          <button className="btn-primary setup-action-btn" onClick={handleFinishSetup}>
            {existingMatches ? '儲存調整' : '完成配對並開始賽事'}
          </button>
        </div>
        {settings.tournamentMode === 'internal' && currentRound < settings.totalRounds && viewMode === 'edit' && (
          <div className="setup-actions-right">
            <button className="btn-primary setup-action-btn" onClick={handleNextRound}>
              下一輪 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
