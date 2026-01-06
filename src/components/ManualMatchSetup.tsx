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

  // 初始化所有對戰組合
  useEffect(() => {
    const matchups: [TeamName, TeamName][] = [
      ['甲隊', '乙隊'],
      ['甲隊', '丙隊'],
      ['甲隊', '丁隊'],
      ['乙隊', '丙隊'],
      ['乙隊', '丁隊'],
      ['丙隊', '丁隊'],
    ];

    const initialAssignments: MatchAssignment[] = [];
    
    // If there are existing matches, load them into assignments
    if (existingMatches && existingMatches.length > 0) {
      existingMatches.forEach(match => {
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
      // Otherwise create new empty assignments
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
    setAssignments(initialAssignments);
  }, [settings.totalRounds, settings.pointsPerRound, existingMatches]);

  // 驗證並清除違反第5點規則的配對
  useEffect(() => {
    if (!settings.enforceRules) return;
    
    setAssignments(prev => prev.map(a => {
      // 只檢查第5點
      if (a.pointNumber !== settings.pointsPerRound) return a;
      
      const updated = { ...a };
      
      // 檢查並清除 pair1 如果違反規則（兩個男性）
      if (a.pair1[0] && a.pair1[1]) {
        const isMaleDouble = a.pair1[0].gender === '男' && a.pair1[1].gender === '男';
        if (isMaleDouble) {
          updated.pair1 = [null, null];
        }
      }
      
      // 檢查並清除 pair2 如果違反規則（兩個男性）
      if (a.pair2[0] && a.pair2[1]) {
        const isMaleDouble = a.pair2[0].gender === '男' && a.pair2[1].gender === '男';
        if (isMaleDouble) {
          updated.pair2 = [null, null];
        }
      }
      
      return updated;
    }));
  }, [settings.enforceRules, settings.pointsPerRound]);

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

  // 檢查選手是否可以在第5點被選擇（混雙或女雙規則）
  const canSelectPlayerForPoint5 = (player: Player, otherPlayer: Player | null, pointNumber: number): boolean => {
    // 如果不是第5點或規則未啟用，允許所有選手
    if (!settings.enforceRules || pointNumber !== settings.pointsPerRound) return true;
    
    // 如果還沒選擇另一位選手，允許所有選手
    if (!otherPlayer) return true;
    
    // 檢查組合是否為混雙或女雙
    const isWomensDouble = player.gender === '女' && otherPlayer.gender === '女';
    const isMixedDouble = player.gender !== otherPlayer.gender;
    
    return isWomensDouble || isMixedDouble;
  };

  const validateAssignments = (): string[] => {
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

        // 檢查最後一點是否為混雙或女雙（如果啟用規則約束且已配對）
        if (settings.enforceRules && match.pointNumber === settings.pointsPerRound) {
          if (team1Complete) {
            const isValid = 
              (match.pair1[0]!.gender === '女' && match.pair1[1]!.gender === '女') ||
              (match.pair1[0]!.gender !== match.pair1[1]!.gender);
            if (!isValid) {
              errors.push(`${matchup} 第${settings.pointsPerRound}點 ${match.team1}必須為混雙或女雙`);
            }
          }
          if (team2Complete) {
            const isValid = 
              (match.pair2[0]!.gender === '女' && match.pair2[1]!.gender === '女') ||
              (match.pair2[0]!.gender !== match.pair2[1]!.gender);
            if (!isValid) {
              errors.push(`${matchup} 第${settings.pointsPerRound}點 ${match.team2}必須為混雙或女雙`);
            }
          }
        }
      });

      // 檢查年齡遞增（第1到倒數第2點）（如果啟用規則約束）
      if (settings.enforceRules) {
        const sortedMatches = matches.filter(m => m.pointNumber < settings.pointsPerRound).sort((a, b) => a.pointNumber - b.pointNumber);
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

  return (
    <div className="manual-match-setup">
      <div className="setup-header">
        <h2>手動配對設定 - 第 {currentRound} 輪</h2>
        
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
        </div>
        
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

        {/* 隊伍篩選按鈕 */}
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
        {selectedTeam !== 'all' ? (
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
                              {settings.enforceRules && match.pointNumber === settings.pointsPerRound && (
                                <span className="rule-hint">混雙或女雙</span>
                              )}
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
                                    const canSelect = canSelectPlayerForPoint5(p, currentPair[1], match.pointNumber);
                                    return (
                                      <option key={p.id} value={p.id} disabled={!canSelect}>
                                        {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}){!canSelect && ' ❌'}
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
                                    const canSelect = canSelectPlayerForPoint5(p, currentPair[0], match.pointNumber);
                                    return (
                                      <option key={p.id} value={p.id} disabled={!canSelect}>
                                        {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}){!canSelect && ' ❌'}
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
                          {settings.enforceRules && match.pointNumber === settings.pointsPerRound && (
                            <span className="rule-hint">混雙或女雙</span>
                          )}
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
                                  const canSelect = canSelectPlayerForPoint5(p, match.pair1[1], match.pointNumber);
                                  return (
                                    <option key={p.id} value={p.id} disabled={!canSelect}>
                                      {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}){!canSelect && ' ❌'}
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
                                  const canSelect = canSelectPlayerForPoint5(p, match.pair1[0], match.pointNumber);
                                  return (
                                    <option key={p.id} value={p.id} disabled={!canSelect}>
                                      {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}){!canSelect && ' ❌'}
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
                                  const canSelect = canSelectPlayerForPoint5(p, match.pair2[1], match.pointNumber);
                                  return (
                                    <option key={p.id} value={p.id} disabled={!canSelect}>
                                      {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}){!canSelect && ' ❌'}
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
                                  const canSelect = canSelectPlayerForPoint5(p, match.pair2[0], match.pointNumber);
                                  return (
                                    <option key={p.id} value={p.id} disabled={!canSelect}>
                                      {p.name} ({showSensitiveInfo && `${p.age}歲 `}{p.gender}){!canSelect && ' ❌'}
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
        <button className="btn-secondary" onClick={onCancel}>
          {existingMatches ? '返回比賽列表' : '返回'}
        </button>
        {currentRound < settings.totalRounds ? (
          <button className="btn-primary" onClick={handleNextRound}>
            下一輪 →
          </button>
        ) : (
          <button className="btn-primary btn-large" onClick={handleFinishSetup}>
            {existingMatches ? '儲存調整' : '完成配對並開始賽事'}
          </button>
        )}
      </div>
    </div>
  );
};
