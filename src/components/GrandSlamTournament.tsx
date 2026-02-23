import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { Player, Gender, SkillLevel } from '../types';

interface GrandSlamMatch {
  id: string;
  round: number;
  position: number;
  player1: Player | null;
  player2: Player | null;
  winner: Player | null;
  status: 'pending' | 'ready' | 'completed';
}

interface GrandSlamTournamentProps {
  onBack: () => void;
  showSensitiveInfo?: boolean;
}

export const GrandSlamTournament: React.FC<GrandSlamTournamentProps> = ({
  onBack,
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [bracket, setBracket] = useState<GrandSlamMatch[]>([]);
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(0);
  const [playersWithBye, setPlayersWithBye] = useState<Set<string>>(new Set());
  const [showBracketTree, setShowBracketTree] = useState(false);
  const [visibleRoundStart, setVisibleRoundStart] = useState(1);
  const [roundsPerView, setRoundsPerView] = useState(3);
  const mainTreeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate how many rounds can fit in viewport
  useEffect(() => {
    const calculateRoundsPerView = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        // Each round column: 250px width + 30px gap
        const roundWidth = 280;
        const padding = 40; // Account for container padding
        const availableWidth = containerWidth - padding;
        const rounds = Math.max(1, Math.floor(availableWidth / roundWidth));
        setRoundsPerView(rounds);
      }
    };

    if (showBracketTree) {
      calculateRoundsPerView();
      window.addEventListener('resize', calculateRoundsPerView);
      return () => window.removeEventListener('resize', calculateRoundsPerView);
    }
  }, [showBracketTree]);

  // Reset to first round when tree view is toggled
  useEffect(() => {
    if (showBracketTree) {
      setVisibleRoundStart(1);
    }
  }, [showBracketTree]);

  // Fisher-Yates shuffle
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Generate the initial bracket with given players
  const generateBracketWithPlayers = (playerList: Player[]) => {
    if (playerList.length < 2) {
      alert('至少需要2名選手才能開始比賽');
      return;
    }

    // Shuffle players randomly
    const shuffledPlayers = shuffleArray([...playerList]);
    
    // Only create the first round - subsequent rounds created dynamically as matches complete
    const matches: GrandSlamMatch[] = [];
    const byePlayerIds = new Set<string>();
    const numPlayers = shuffledPlayers.length;
    const hasOddPlayers = numPlayers % 2 === 1;
    
    // If odd number, select one player for bye (prefer players who haven't had a bye yet)
    let byePlayer: Player | null = null;
    let playersForMatches = shuffledPlayers;
    
    if (hasOddPlayers) {
      const byeIndex = Math.floor(Math.random() * numPlayers);
      byePlayer = shuffledPlayers[byeIndex];
      byePlayerIds.add(byePlayer.id);
      playersForMatches = shuffledPlayers.filter(p => p.id !== byePlayer!.id);
    }
    
    // Create matches for round 1
    const matchesInRound = Math.floor(playersForMatches.length / 2);
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        id: `r1-m${i}`,
        round: 1,
        position: i,
        player1: playersForMatches[i * 2],
        player2: playersForMatches[i * 2 + 1],
        winner: null,
        status: 'ready',
      });
    }
    
    // If there's a bye player, create a bye match
    if (byePlayer) {
      matches.push({
        id: `r1-m${matchesInRound}`,
        round: 1,
        position: matchesInRound,
        player1: byePlayer,
        player2: null,
        winner: byePlayer,
        status: 'completed',
      });
    }
    
    // Calculate estimated total rounds
    let estimatedRounds = 1;
    let remainingPlayers = matchesInRound + (byePlayer ? 1 : 0);
    while (remainingPlayers > 1) {
      remainingPlayers = Math.ceil(remainingPlayers / 2);
      estimatedRounds++;
    }
    
    setTotalRounds(estimatedRounds);
    setPlayersWithBye(byePlayerIds);
    setBracket(matches);
    setTournamentStarted(true);
    setCurrentRound(1);
  };

  // Handle match result
  const recordWinner = (matchId: string, winner: Player) => {
    let updatedBracket = bracket.map(m => ({ ...m }));
    const matchIndex = updatedBracket.findIndex(m => m.id === matchId);
    
    if (matchIndex === -1) return;

    const match = updatedBracket[matchIndex];
    updatedBracket[matchIndex] = {
      ...match,
      winner: winner,
      status: 'completed'
    };

    const currentRound = match.round;
    
    // Check if current round is complete
    const currentRoundMatches = updatedBracket.filter(m => m.round === currentRound);
    const roundComplete = currentRoundMatches.every(m => m.status === 'completed');
    
    if (roundComplete && currentRound < totalRounds) {
      // Get all winners from this round in order
      const winners = currentRoundMatches.map(m => m.winner!).filter(w => w !== null);
      
      // Create or update next round matches
      const nextRound = currentRound + 1;
      
      // Remove old next round matches if they exist
      updatedBracket = updatedBracket.filter(m => m.round !== nextRound);
      
      // Determine if next round has a bye (prefer players who haven't had one yet)
      const hasOddWinners = winners.length % 2 === 1;
      let byePlayer: Player | null = null;
      let playersForMatches = winners;
      
      if (hasOddWinners) {
        // Filter winners who haven't had a bye yet
        const winnersWithoutBye = winners.filter(p => !playersWithBye.has(p.id));
        
        if (winnersWithoutBye.length > 0) {
          // Prefer players who haven't had a bye
          const byeIndex = Math.floor(Math.random() * winnersWithoutBye.length);
          byePlayer = winnersWithoutBye[byeIndex];
        } else {
          // All winners have had a bye, pick any player
          const byeIndex = Math.floor(Math.random() * winners.length);
          byePlayer = winners[byeIndex];
        }
        
        playersForMatches = winners.filter(p => p.id !== byePlayer!.id);
        
        // Track this player as having had a bye
        setPlayersWithBye(prev => new Set([...prev, byePlayer!.id]));
      }
      
      // Create new matches for next round
      const matchesInNextRound = Math.floor(playersForMatches.length / 2);
      let nextMatchIdCounter = updatedBracket.filter(m => m.round <= currentRound).length;
      
      for (let i = 0; i < matchesInNextRound; i++) {
        updatedBracket.push({
          id: `r${nextRound}-m${nextMatchIdCounter++}`,
          round: nextRound,
          position: i,
          player1: playersForMatches[i * 2],
          player2: playersForMatches[i * 2 + 1],
          winner: null,
          status: 'ready',
        });
      }
      
      // If there's a bye player, create a bye match
      if (byePlayer) {
        updatedBracket.push({
          id: `r${nextRound}-m${nextMatchIdCounter++}`,
          round: nextRound,
          position: matchesInNextRound,
          player1: byePlayer,
          player2: null,
          winner: byePlayer,
          status: 'completed',
        });
      }
      
      // Update total rounds if we've extended beyond the estimate
      const maxRound = Math.max(...updatedBracket.map(m => m.round));
      if (maxRound > totalRounds) {
        setTotalRounds(maxRound);
      }
    }

    setBracket(updatedBracket);
  };

  // Get matches for a specific round
  const getMatchesForRound = (round: number): GrandSlamMatch[] => {
    return bracket.filter(m => m.round === round);
  };

  // Check if round is complete
  const isRoundComplete = (round: number): boolean => {
    const roundMatches = getMatchesForRound(round);
    return roundMatches.every(m => m.status === 'completed');
  };

  // Get round name
  const getRoundName = (round: number): string => {
    if (round === totalRounds) return '冠軍賽';
    if (round === totalRounds - 1) return '準決賽';
    if (round === totalRounds - 2) return '準準決賽';
    return `第 ${round} 輪`;
  };

  // Navigation for bracket tree rounds
  const navigateToPrevRounds = () => {
    setVisibleRoundStart(prev => Math.max(1, prev - roundsPerView));
  };

  const navigateToNextRounds = () => {
    setVisibleRoundStart(prev => Math.min(totalRounds - roundsPerView + 1, prev + roundsPerView));
  };

  const canNavigatePrev = visibleRoundStart > 1;
  const canNavigateNext = visibleRoundStart + roundsPerView <= totalRounds;

  // Clear all and restart
  const handleClearAll = () => {
    if (confirm('確定要清除所有資料（包含選手名單）嗎？')) {
      setPlayers([]);
      setBracket([]);
      setTournamentStarted(false);
      setCurrentRound(1);
      setTotalRounds(0);
      setPlayersWithBye(new Set());
    }
  };

  // Navigate rounds
  const goToNextRound = () => {
    if (currentRound < totalRounds) {
      setCurrentRound(currentRound + 1);
    }
  };

  const goToPrevRound = () => {
    if (currentRound > 1) {
      setCurrentRound(currentRound - 1);
    }
  };

  // Get tournament champion
  const getChampion = (): Player | null => {
    if (totalRounds === 0) return null;
    
    const finalMatch = bracket.find(m => m.round === totalRounds);
    
    // Only return champion if:
    // 1. Final match exists and is completed
    // 2. Final match had both players present (was an actual match, not a bye)
    // 3. A winner was determined
    if (finalMatch && 
        finalMatch.status === 'completed' && 
        finalMatch.player1 && 
        finalMatch.player2 && 
        finalMatch.winner) {
      return finalMatch.winner;
    }
    
    return null;
  };

  // Import players from Excel
  const handleImportExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Filter out empty rows (rows without name)
        const validRows = jsonData.filter(row => {
          const name = row['姓名'] || row['name'];
          return name && name.toString().trim() !== '';
        });

        const importedPlayers: Player[] = validRows.map((row, index) => ({
          id: `${index + 1}`,
          name: row['姓名'] || row['name'] || `選手${index + 1}`,
          age: parseInt(row['年齡'] || row['age']) || 30,
          gender: (row['性別'] || row['gender'] || '男') as Gender,
          skillLevel: (row['技術等級'] || row['skillLevel'] || row['等級'] || 'B') as SkillLevel,
          matchesPlayed: 0,
        }));

        setPlayers(importedPlayers);
        alert(`成功匯入 ${importedPlayers.length} 名選手`);
        
        // Auto-generate bracket after import
        setTimeout(() => {
          if (importedPlayers.length >= 2) {
            generateBracketWithPlayers(importedPlayers);
          }
        }, 100);
      } catch (error) {
        console.error('匯入失敗:', error);
        alert('匯入失敗，請檢查Excel格式是否正確');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Import players from CSV
  const handleImportCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Skip header line
        const dataLines = lines.slice(1);
        
        // Filter and map valid rows
        const importedPlayers: Player[] = dataLines
          .map((line, index) => {
            const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
            return {
              id: `${index + 1}`,
              name: values[0] || '',
              age: parseInt(values[1]) || 30,
              gender: (values[2] || '男') as Gender,
              skillLevel: (values[3] || 'B') as SkillLevel,
              matchesPlayed: 0,
            };
          })
          .filter(player => player.name.trim() !== '')
          .map((player, index) => ({
            ...player,
            id: `${index + 1}`,
            name: player.name || `選手${index + 1}`,
          }));

        setPlayers(importedPlayers);
        alert(`成功匯入 ${importedPlayers.length} 名選手`);
        
        // Auto-generate bracket after import
        setTimeout(() => {
          if (importedPlayers.length >= 2) {
            generateBracketWithPlayers(importedPlayers);
          }
        }, 100);
      } catch (error) {
        console.error('匯入失敗:', error);
        alert('匯入失敗，請檢查CSV格式是否正確');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const currentRoundMatches = getMatchesForRound(currentRound);
  const champion = getChampion();
  const tournamentComplete = totalRounds > 0 && isRoundComplete(totalRounds);

  return (
    <div className="grand-slam-tournament">
      <div className="section-header">
        <h2>🏆 一球大滿貫</h2>
        <div className="header-actions">
          <button className="btn-secondary" onClick={onBack}>
            返回
          </button>
        </div>
      </div>

      {!tournamentStarted ? (
        <div className="tournament-setup">
          {players.length === 0 ? (
            <div className="import-section">
              <h3>匯入選手名單</h3>
              <p>請匯入選手資料以開始比賽</p>
              <div className="import-buttons">
                <label className="btn-import">
                  📊 從 Excel 匯入
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImportExcel(file);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                <label className="btn-import">
                  📄 從 CSV 匯入
                  <input
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImportCSV(file);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="tournament-bracket">
          {/* Tournament Status */}
          <div className="tournament-status">
            <div className="status-info">
              <span>參賽選手：{players.length} 人</span>
              <span>總輪數：{totalRounds} 輪</span>
              <span>當前輪次：{getRoundName(currentRound)}</span>
            </div>
            <div className="status-actions">
              <button className="btn-danger" onClick={handleClearAll}>
                清除所有資料
              </button>
            </div>
          </div>

          {/* Champion Announcement */}
          {tournamentComplete && champion && (
            <div className="champion-announcement">
              <h2>🎉 恭喜冠軍！🎉</h2>
              <div className="champion-name">{champion.name}</div>
            </div>
          )}

          {/* Bracket Tree Toggle */}
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <button 
              className="btn-secondary" 
              onClick={() => setShowBracketTree(!showBracketTree)}
            >
              {showBracketTree ? '📋 賽程列表' : '🌳 對戰樹狀圖'}
            </button>
          </div>

          {/* Bracket Tree View */}
          {showBracketTree ? (
            <div ref={containerRef}>
              <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>完整對戰樹狀圖</h3>
              
              {/* Navigation controls */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '20px',
                marginBottom: '20px',
                padding: '15px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '10px',
                color: 'white'
              }}>
                <button 
                  className="btn-nav-tree"
                  onClick={navigateToPrevRounds}
                  disabled={!canNavigatePrev}
                >
                  ⬅ 前幾輪
                </button>
                <span style={{ fontWeight: '600', fontSize: '1.1em' }}>
                  顯示第 {visibleRoundStart}-{Math.min(visibleRoundStart + roundsPerView - 1, totalRounds)} 輪 (共 {totalRounds} 輪)
                </span>
                <button 
                  className="btn-nav-tree"
                  onClick={navigateToNextRounds}
                  disabled={!canNavigateNext}
                >
                  後幾輪 ➡
                </button>
              </div>
              
              {/* Main bracket tree */}
              <div 
                ref={mainTreeRef}
                className="bracket-tree"
              >
                <div className="bracket-rounds">
                {Array.from({ length: roundsPerView }, (_, i) => visibleRoundStart + i)
                  .filter(round => round <= totalRounds)
                  .map(round => {
                  const roundMatches = getMatchesForRound(round);
                  if (roundMatches.length === 0) return null;
                  
                  return (
                    <div key={round} className="bracket-round-column">
                      <h4 className="bracket-round-title">{getRoundName(round)}</h4>
                      <div className="bracket-matches">
                        {roundMatches.filter(m => m.player1 || m.player2).map(match => (
                          <div key={match.id} className={`bracket-match ${match.status}`}>
                            <div className={`bracket-player ${match.winner?.id === match.player1?.id ? 'winner' : ''}`}>
                              {match.player1?.name || '待定'}
                            </div>
                            <div className="bracket-vs">vs</div>
                            <div className={`bracket-player ${match.winner?.id === match.player2?.id ? 'winner' : ''}`}>
                              {match.player2?.name || '輪空'}
                            </div>
                            {match.winner && (
                              <div className="bracket-winner-indicator">
                                ➜ {match.winner.name}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          ) : (
            <>
              {/* Round Navigation */}
              <div className="round-navigation">
            <button 
              className="btn-nav" 
              onClick={goToPrevRound}
              disabled={currentRound === 1}
            >
              ← 上一輪
            </button>
            <h3>{getRoundName(currentRound)}</h3>
            <button 
              className="btn-nav" 
              onClick={goToNextRound}
              disabled={currentRound === totalRounds}
            >
              下一輪 →
            </button>
          </div>

          {/* Matches Grid */}
          <div className="matches-grid">
            {currentRoundMatches.filter(m => m.player1 || m.player2).length === 0 ? (
              <div className="no-matches">此輪次沒有比賽</div>
            ) : (
              currentRoundMatches.filter(m => m.player1 || m.player2).map((match) => (
                <div 
                  key={match.id} 
                  className={`match-card ${match.status}`}
                >
                  <div className="match-header">
                    <span className="match-number">第 {match.position + 1} 場</span>
                    <span className={`match-status-badge ${match.status}`}>
                      {match.status === 'pending' ? '等待中' : 
                       match.status === 'ready' ? '可比賽' : '已完成'}
                    </span>
                  </div>

                  <div className="match-players">
                    <div className={`player-slot ${match.winner?.id === match.player1?.id ? 'winner' : ''}`}>
                      {match.player1 ? (
                        <>
                          <span className="player-name">
                            {match.player1.name}
                          </span>
                          {match.status === 'ready' && !match.winner && (
                            <button 
                              className="btn-win"
                              onClick={() => recordWinner(match.id, match.player1!)}
                            >
                              獲勝
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="player-empty">輪空</span>
                      )}
                    </div>

                    <div className="vs-divider">VS</div>

                    <div className={`player-slot ${match.winner?.id === match.player2?.id ? 'winner' : ''}`}>
                      {match.player2 ? (
                        <>
                          <span className="player-name">
                            {match.player2.name}
                          </span>
                          {match.status === 'ready' && !match.winner && (
                            <button 
                              className="btn-win"
                              onClick={() => recordWinner(match.id, match.player2!)}
                            >
                              獲勝
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="player-empty">輪空</span>
                      )}
                    </div>
                  </div>

                  {match.winner && (
                    <div className="match-result">
                      晉級：{match.winner.name}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Round Status */}
          {isRoundComplete(currentRound) && currentRound < totalRounds && (
            <div className="round-complete-notice">
              ✅ {getRoundName(currentRound)}已完成，可查看下一輪對陣
            </div>
          )}
            </>
          )}
        </div>
      )}

      <style>{`
        .grand-slam-tournament {
          padding: 20px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }

        .tournament-setup {
          max-width: 600px;
          margin: 0 auto;
          text-align: center;
        }

        .info-box {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 30px;
          margin-bottom: 30px;
          text-align: left;
        }

        .info-box h3 {
          margin-top: 0;
          color: #2c3e50;
          margin-bottom: 20px;
        }

        .info-box ul {
          list-style: none;
          padding: 0;
        }

        .info-box li {
          padding: 10px 0;
          border-bottom: 1px solid #dee2e6;
        }

        .info-box li:last-child {
          border-bottom: none;
        }

        .warning-box {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          color: #856404;
        }

        .tournament-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8f9fa;
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .status-info {
          display: flex;
          gap: 30px;
          font-weight: 500;
        }

        .status-actions {
          display: flex;
          gap: 10px;
        }

        .import-section {
          text-align: center;
          padding: 40px 20px;
        }

        .import-section h3 {
          margin-bottom: 10px;
          color: #2c3e50;
        }

        .import-section p {
          color: #6c757d;
          margin-bottom: 30px;
        }

        .import-buttons {
          display: flex;
          gap: 20px;
          justify-content: center;
          margin-bottom: 30px;
        }

        .btn-import {
          padding: 15px 30px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1.1em;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s;
          display: inline-block;
        }

        .btn-import:hover {
          background: #0056b3;
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0,0,0,0.2);
        }

        .format-info {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          text-align: left;
          max-width: 500px;
          margin: 0 auto;
        }

        .format-info h4 {
          margin-top: 0;
          color: #2c3e50;
        }

        .format-info ul {
          margin: 10px 0 0 0;
          padding-left: 20px;
        }

        .format-info li {
          margin: 5px 0;
        }

        .start-section {
          display: flex;
          flex-direction: column;
          gap: 30px;
          align-items: center;
        }

        .player-list-preview {
          width: 100%;
          max-width: 600px;
        }

        .player-list-preview h4 {
          margin-bottom: 15px;
          color: #2c3e50;
        }

        .player-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
        }

        .player-preview-item {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 6px;
          text-align: center;
          border: 1px solid #dee2e6;
        }

        .action-buttons {
          display: flex;
          gap: 15px;
        }

        .champion-announcement {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px;
          border-radius: 12px;
          text-align: center;
          margin-bottom: 30px;
          box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        }

        .champion-announcement h2 {
          margin: 0 0 20px 0;
          font-size: 2em;
        }

        .champion-name {
          font-size: 2.5em;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .champion-details {
          font-size: 1.1em;
          opacity: 0.9;
        }

        .round-navigation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .round-navigation h3 {
          margin: 0;
          font-size: 1.5em;
          color: #2c3e50;
        }

        .btn-nav {
          padding: 10px 20px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1em;
          transition: all 0.3s;
        }

        .btn-nav:hover:not(:disabled) {
          background: #2980b9;
          transform: translateY(-2px);
        }

        .btn-nav:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
          transform: none;
        }

        .matches-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .match-card {
          background: white;
          border: 2px solid #dee2e6;
          border-radius: 10px;
          padding: 20px;
          transition: all 0.3s;
        }

        .match-card.ready {
          border-color: #28a745;
          box-shadow: 0 4px 8px rgba(40, 167, 69, 0.2);
        }

        .match-card.completed {
          border-color: #6c757d;
          background: #f8f9fa;
        }

        .match-card.pending {
          border-color: #ffc107;
          opacity: 0.7;
        }

        .match-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #dee2e6;
        }

        .match-number {
          font-weight: bold;
          color: #2c3e50;
        }

        .match-status-badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.85em;
          font-weight: 500;
        }

        .match-status-badge.ready {
          background: #d4edda;
          color: #155724;
        }

        .match-status-badge.completed {
          background: #d1ecf1;
          color: #0c5460;
        }

        .match-status-badge.pending {
          background: #fff3cd;
          color: #856404;
        }

        .match-players {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .player-slot {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 2px solid transparent;
          transition: all 0.3s;
        }

        .player-slot.winner {
          background: #d4edda;
          border-color: #28a745;
        }

        .player-name {
          font-weight: bold;
          font-size: 1.1em;
          color: #2c3e50;
        }

        .player-info {
          font-size: 0.9em;
          color: #6c757d;
        }

        .player-empty {
          color: #adb5bd;
          font-style: italic;
        }

        .vs-divider {
          text-align: center;
          font-weight: bold;
          color: #6c757d;
          margin: 5px 0;
        }

        .btn-win {
          padding: 8px 16px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s;
          align-self: flex-start;
        }

        .btn-win:hover {
          background: #218838;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        .match-result {
          margin-top: 15px;
          padding: 12px;
          background: #e8f5e9;
          border-radius: 6px;
          text-align: center;
          font-weight: bold;
          color: #2e7d32;
        }

        .round-complete-notice {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
          padding: 15px;
          border-radius: 8px;
          text-align: center;
          font-weight: 500;
        }

        .no-matches {
          text-align: center;
          color: #6c757d;
          padding: 40px;
          font-size: 1.1em;
        }

        .btn-primary {
          padding: 15px 40px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1.1em;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-primary:hover {
          background: #0056b3;
          transform: translateY(-2px);
          box-shadow: 0 6px 12px rgba(0,0,0,0.2);
        }

        .btn-secondary {
          padding: 10px 20px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s;
          display: inline-block;
        }

        .btn-secondary:hover {
          background: #5a6268;
        }

        .btn-danger {
          padding: 10px 20px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-danger:hover {
          background: #c82333;
        }

        @media (max-width: 768px) {
          .matches-grid {
            grid-template-columns: 1fr;
          }

          .status-info {
            flex-direction: column;
            gap: 10px;
          }

          .champion-name {
            font-size: 1.8em;
          }

          .import-buttons {
            flex-direction: column;
          }

          .action-buttons {
            flex-direction: column;
            width: 100%;
          }
        }

        /* Navigation Button Styles */
        .btn-nav-tree {
          background: white;
          color: #667eea;
          border: 2px solid white;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1.1em;
          font-weight: 600;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .btn-nav-tree:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.95);
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .btn-nav-tree:active:not(:disabled) {
          transform: scale(0.98);
        }
        .btn-nav-tree:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Bracket Tree Styles */
        .bracket-tree {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          overflow: visible;
          max-width: 100%;
        }

        .bracket-rounds {
          display: flex;
          gap: 30px;
          justify-content: center;
          padding: 20px;
        }

        .bracket-round-column {
          flex: 0 0 auto;
          min-width: 250px;
          max-width: 250px;
        }

        .bracket-round-title {
          text-align: center;
          margin-bottom: 15px;
          color: #2c3e50;
          font-size: 1.1em;
          font-weight: 600;
          padding: 10px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 8px;
        }

        .bracket-matches {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .bracket-match {
          background: #f8f9fa;
          border: 2px solid #dee2e6;
          border-radius: 8px;
          padding: 12px;
          transition: all 0.3s;
        }

        .bracket-match.completed {
          border-color: #28a745;
          background: #f8fff9;
        }

        .bracket-match.ready {
          border-color: #007bff;
          background: #f0f8ff;
        }

        .bracket-player {
          padding: 8px 12px;
          background: white;
          border-radius: 6px;
          margin: 5px 0;
          font-weight: 500;
          color: #2c3e50;
          font-size: 0.95em;
          transition: all 0.3s;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }

        .bracket-player.winner {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-weight: 600;
          transform: scale(1.05);
        }

        .bracket-vs {
          text-align: center;
          font-size: 0.9em;
          color: #6c757d;
          margin: 3px 0;
        }

        .bracket-winner-indicator {
          margin-top: 8px;
          padding: 6px;
          background: #28a745;
          color: white;
          border-radius: 6px;
          text-align: center;
          font-size: 0.9em;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};
