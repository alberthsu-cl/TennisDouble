import { useState, useEffect } from 'react';
import type { Player, Match, TeamName, TournamentSettings } from './types';
import { PlayerManagement } from './components/PlayerManagement';
import { MatchList } from './components/MatchList';
import { Standings } from './components/Standings';
import { RulesModal } from './components/RulesModal';
import { ManualMatchSetup } from './components/ManualMatchSetup';
import { generateFullSchedule } from './utils/scheduleGenerator';
import { generateDemoPlayers } from './utils/demoData';
import './App.css';

type View = 'setup' | 'players' | 'matches' | 'standings' | 'manual-setup';

function App() {
  const [currentView, setCurrentView] = useState<View>('setup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [filterRound, setFilterRound] = useState<number | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'in-progress' | 'completed'>('all');
  const [showRulesModal, setShowRulesModal] = useState(false);
  
  // Tournament settings
  const [settings, setSettings] = useState<TournamentSettings>({
    playersPerTeam: 10,
    pointsPerRound: 5,
    totalRounds: 3,
    minMatchesPerPlayer: 2,
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

  const handleStartTournament = () => {
    const regularPlayers = players.filter(p => !p.isAlternate);
    const requiredPlayers = settings.playersPerTeam * 4;
    
    if (regularPlayers.length !== requiredPlayers) {
      alert(`請確保有正好${requiredPlayers}名正式選手（每隊${settings.playersPerTeam}人）`);
      return;
    }

    const teams: { [key in TeamName]: Player[] } = {
      '甲隊': regularPlayers.filter(p => p.team === '甲隊'),
      '乙隊': regularPlayers.filter(p => p.team === '乙隊'),
      '丙隊': regularPlayers.filter(p => p.team === '丙隊'),
      '丁隊': regularPlayers.filter(p => p.team === '丁隊'),
    };

    // 檢查每隊人數（至少需要指定人數）
    for (const [teamName, teamPlayers] of Object.entries(teams)) {
      if (teamPlayers.length < settings.playersPerTeam) {
        alert(`${teamName}目前只有${teamPlayers.length}人，需要至少${settings.playersPerTeam}人`);
        return;
      }
    }

    try {
      const schedule = generateFullSchedule(teams, settings);
      setMatches(schedule);
      setTournamentStarted(true);
      setCurrentView('matches');
      alert('賽程已生成！共 ' + schedule.length + ' 場比賽');
    } catch (error) {
      console.error('生成賽程失敗:', error);
      alert('生成賽程時發生錯誤，請檢查選手資料');
    }
  };

  const handleStartManualSetup = () => {
    const regularPlayers = players.filter(p => !p.isAlternate);
    const requiredPlayers = settings.playersPerTeam * 4;
    
    if (regularPlayers.length !== requiredPlayers) {
      alert(`請確保有正好${requiredPlayers}名正式選手（每隊${settings.playersPerTeam}人）`);
      return;
    }

    const teams: { [key in TeamName]: Player[] } = {
      '甲隊': regularPlayers.filter(p => p.team === '甲隊'),
      '乙隊': regularPlayers.filter(p => p.team === '乙隊'),
      '丙隊': regularPlayers.filter(p => p.team === '丙隊'),
      '丁隊': regularPlayers.filter(p => p.team === '丁隊'),
    };

    // 檢查每隊人數（至少需要指定人數）
    for (const [teamName, teamPlayers] of Object.entries(teams)) {
      if (teamPlayers.length < settings.playersPerTeam) {
        alert(`${teamName}目前只有${teamPlayers.length}人，需要至少${settings.playersPerTeam}人`);
        return;
      }
    }

    setCurrentView('manual-setup');
  };

  const handleManualMatchesGenerated = (generatedMatches: Match[]) => {
    setMatches(generatedMatches);
    setTournamentStarted(true);
    setCurrentView('matches');
    alert('手動配對已完成！共 ' + generatedMatches.length + ' 場比賽');
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
      const player = updatedPlayers.find(p => p.id === matchPlayer.id);
      if (player && player.matchesPlayed < settings.totalRounds) {
        player.matchesPlayed++;
      }
    });
    setPlayers(updatedPlayers);
  };

  const handleResetTournament = () => {
    if (confirm('確定要重置整個賽事嗎？這將清除所有選手和比賽資料。')) {
      setPlayers([]);
      setMatches([]);
      setTournamentStarted(false);
      setCurrentView('setup');
      localStorage.clear();
    }
  };

  const handleLoadDemoData = () => {
    if (players.length > 0 && !confirm('這將覆蓋現有選手資料，確定要載入示範資料嗎？')) {
      return;
    }
    const demoPlayers = generateDemoPlayers(settings.playersPerTeam);
    setPlayers(demoPlayers);
    alert(`已載入${demoPlayers.length}名示範選手！請到「選手管理」查看或前往「賽事設定」開始賽事。`);
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

  const handleImportPlayers = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported) && imported.length > 0) {
          if (players.length > 0 && !confirm('這將覆蓋現有選手資料，確定要匯入嗎？')) {
            return;
          }
          setPlayers(imported);
          alert(`成功匯入 ${imported.length} 名選手！`);
        } else {
          alert('無效的選手資料格式');
        }
      } catch (error) {
        alert('匯入失敗：檔案格式錯誤');
      }
    };
    reader.readAsText(file);
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

  const handleImportMatches = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported) && imported.length > 0) {
          if (matches.length > 0 && !confirm('這將覆蓋現有比賽資料，確定要匯入嗎？')) {
            return;
          }
          setMatches(imported);
          setTournamentStarted(true);
          alert(`成功匯入 ${imported.length} 場比賽！`);
        } else {
          alert('無效的比賽資料格式');
        }
      } catch (error) {
        alert('匯入失敗：檔案格式錯誤');
      }
    };
    reader.readAsText(file);
  };

  const getTeamCount = (teamName: TeamName) => {
    return players.filter(p => p.team === teamName && !p.isAlternate).length;
  };

  const totalRounds = matches.length > 0 ? Math.max(...matches.map(m => m.roundNumber)) : 0;
  const regularPlayersCount = players.filter(p => !p.isAlternate).length;
  const alternatePlayersCount = players.filter(p => p.isAlternate).length;

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
          disabled={tournamentStarted}
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
          title="查看賽事規則"
        >
          📋 規則說明
        </button>
      </nav>

      <main className="app-main">
        {currentView === 'setup' && (
          <div className="setup-view">
            {!tournamentStarted && (
              <div className="settings-panel">
                <h2>⚙️ 賽事設定</h2>
                <div className="settings-grid">
                  <div className="setting-item">
                    <label>每隊人數：</label>
                    <input
                      type="number"
                      min="4"
                      max="20"
                      value={settings.playersPerTeam}
                      onChange={(e) => setSettings({ ...settings, playersPerTeam: parseInt(e.target.value) || 10 })}
                    />
                    <span className="setting-note">總人數: {settings.playersPerTeam * 4}</span>
                  </div>
                  
                  <div className="setting-item">
                    <label>每輪點數：</label>
                    <input
                      type="number"
                      min="3"
                      max="10"
                      value={settings.pointsPerRound}
                      onChange={(e) => setSettings({ ...settings, pointsPerRound: parseInt(e.target.value) || 5 })}
                    />
                    <span className="setting-note">每場對戰打幾點</span>
                  </div>
                  
                  <div className="setting-item">
                    <label>總輪數：</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={settings.totalRounds}
                      onChange={(e) => setSettings({ ...settings, totalRounds: parseInt(e.target.value) || 3 })}
                    />
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
            )}
            
            <h2>賽事規則說明</h2>
            <div className="rules-box">
              <h3>本次會內賽比賽規則：</h3>
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
                      disabled={regularPlayersCount !== settings.playersPerTeam * 4}
                    >
                      自動生成賽程
                    </button>
                    <button 
                      className="btn-primary btn-large btn-manual"
                      onClick={handleStartManualSetup}
                      disabled={regularPlayersCount !== settings.playersPerTeam * 4}
                    >
                      手動配對設定
                    </button>
                  </div>
                  <button 
                    className="btn-secondary btn-large"
                    onClick={handleLoadDemoData}
                    style={{ marginTop: '1rem' }}
                  >
                    載入示範資料
                  </button>
                  {regularPlayersCount !== settings.playersPerTeam * 4 && (
                    <p className="warning">
                      請先新增所有{settings.playersPerTeam * 4}名正式選手（目前：{regularPlayersCount}/{settings.playersPerTeam * 4}）
                      {alternatePlayersCount > 0 && ` [另有${alternatePlayersCount}名候補]`}
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
            onImportPlayers={handleImportPlayers}
          />
        )}

        {currentView === 'matches' && tournamentStarted && (
          <div className="matches-view">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>比賽列表</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" onClick={handleExportMatches}>
                  📤 匯出比賽
                </button>
                <button className="btn-secondary" onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleImportMatches(file);
                  };
                  input.click();
                }}>
                  📂 匯入比賽
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
              filterRound={filterRound}
              filterStatus={filterStatus}
            />
          </div>
        )}

        {currentView === 'standings' && tournamentStarted && (
          <Standings matches={matches} players={players} settings={settings} />
        )}

        {currentView === 'manual-setup' && (
          <ManualMatchSetup
            players={players}
            settings={settings}
            onGenerateMatches={handleManualMatchesGenerated}
            onBack={() => setCurrentView('setup')}
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
    </div>
  );
}

export default App;
