import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { Player, Gender } from '../types';
import { normalizeSkillLevel } from '../utils/skillLevel';

const TOURNAMENT_STATE_FILE_NAME_KEY = 'grandSlamLastStateFileName';
const TOURNAMENT_STATE_HANDLE_DB = 'grandSlamTournamentStateDb';
const TOURNAMENT_STATE_HANDLE_STORE = 'fileHandles';
const TOURNAMENT_STATE_HANDLE_KEY = 'lastTournamentStateFile';

interface RememberedTournamentFileHandle {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<{
    write: (data: Blob | BufferSource | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

interface SaveFilePickerOptionsLike {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
}

interface WindowWithFilePicker extends Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptionsLike) => Promise<RememberedTournamentFileHandle>;
}

const openTournamentStateHandleDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(TOURNAMENT_STATE_HANDLE_DB, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TOURNAMENT_STATE_HANDLE_STORE)) {
        db.createObjectStore(TOURNAMENT_STATE_HANDLE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('無法開啟存檔資料庫'));
  });
};

const saveRememberedTournamentFileHandle = async (handle: RememberedTournamentFileHandle) => {
  const db = await openTournamentStateHandleDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(TOURNAMENT_STATE_HANDLE_STORE, 'readwrite');
    const store = transaction.objectStore(TOURNAMENT_STATE_HANDLE_STORE);
    const request = store.put(handle, TOURNAMENT_STATE_HANDLE_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('無法儲存存檔位置'));
  });
  db.close();
};

const loadRememberedTournamentFileHandle = async (): Promise<RememberedTournamentFileHandle | null> => {
  const db = await openTournamentStateHandleDb();
  const handle = await new Promise<RememberedTournamentFileHandle | null>((resolve, reject) => {
    const transaction = db.transaction(TOURNAMENT_STATE_HANDLE_STORE, 'readonly');
    const store = transaction.objectStore(TOURNAMENT_STATE_HANDLE_STORE);
    const request = store.get(TOURNAMENT_STATE_HANDLE_KEY);

    request.onsuccess = () => resolve((request.result as RememberedTournamentFileHandle | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('無法讀取存檔位置'));
  });
  db.close();
  return handle;
};

const clearRememberedTournamentFileHandle = async () => {
  const db = await openTournamentStateHandleDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(TOURNAMENT_STATE_HANDLE_STORE, 'readwrite');
    const store = transaction.objectStore(TOURNAMENT_STATE_HANDLE_STORE);
    const request = store.delete(TOURNAMENT_STATE_HANDLE_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('無法清除存檔位置'));
  });
  db.close();
};

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

interface TournamentStateSnapshot {
  players: Player[];
  bracket: GrandSlamMatch[];
  currentRound: number;
  totalRounds: number;
  playersWithBye: Set<string>;
  tournamentStarted: boolean;
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
  const [lastSavedStateFileName, setLastSavedStateFileName] = useState('');
  const [hasRememberedStateFile, setHasRememberedStateFile] = useState(false);
  const mainTreeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const filePickerWindow = window as WindowWithFilePicker;
  const supportsRememberedStateFile = typeof filePickerWindow.showSaveFilePicker === 'function';

  const exportRoundMatchups = (round: number, bracketSource: GrandSlamMatch[] = bracket) => {
    const roundMatches = bracketSource.filter(m => m.round === round).filter(m => m.player1 || m.player2);
    const roundName = getRoundName(round);
    const today = new Date().toLocaleDateString('zh-TW');

    const rows = roundMatches.map((match, idx) => {
      const isBye = !match.player2;
      const p1 = match.player1?.name || '輪空';
      const p2 = isBye ? '' : (match.player2?.name ?? '');
      const p1Win = match.winner?.id === match.player1?.id;
      const p2Win = match.winner?.id === match.player2?.id;
      const result = match.winner
        ? `晉級：${match.winner.name}`
        : isBye
          ? `${p1} 直接晉級`
          : '待賽';
      return {
        場次: `第 ${idx + 1} 場`,
        選手甲: p1Win ? `${p1} 🏆` : p1,
        VS: isBye ? '輪空' : 'VS',
        選手乙: p2Win ? `${p2} 🏆` : p2,
        結果: result,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 10 },
      { wch: 16 },
      { wch: 6 },
      { wch: 16 },
      { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, roundName);
    XLSX.writeFile(wb, `一球大滿貫_${roundName}_${today.replace(/\//g, '')}.xlsx`);
  };

  const promptExportGeneratedRound = (
    round: number,
    bracketSource: GrandSlamMatch[],
    snapshot?: TournamentStateSnapshot,
  ) => {
    const roundMatches = bracketSource.filter(m => m.round === round).filter(m => m.player1 || m.player2);
    if (roundMatches.length === 0) return;

    void handleExportTournamentState(snapshot);
  };

  useEffect(() => {
    setLastSavedStateFileName(localStorage.getItem(TOURNAMENT_STATE_FILE_NAME_KEY) ?? '');

    if (!supportsRememberedStateFile) {
      setHasRememberedStateFile(false);
      return;
    }

    let isMounted = true;

    const loadStoredHandle = async () => {
      try {
        const handle = await loadRememberedTournamentFileHandle();
        if (isMounted) {
          setHasRememberedStateFile(handle !== null);
        }
      } catch (error) {
        console.error('讀取已記住的存檔位置失敗:', error);
        if (isMounted) {
          setHasRememberedStateFile(false);
        }
      }
    };

    loadStoredHandle();

    return () => {
      isMounted = false;
    };
  }, [supportsRememberedStateFile]);

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
    promptExportGeneratedRound(1, matches, {
      players: playerList,
      bracket: matches,
      currentRound: 1,
      totalRounds: estimatedRounds,
      playersWithBye: byePlayerIds,
      tournamentStarted: true,
    });
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
      const updatedPlayersWithBye = new Set(playersWithBye);
      
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
        updatedPlayersWithBye.add(byePlayer!.id);
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

      if (byePlayer) {
        setPlayersWithBye(updatedPlayersWithBye);
      }

      setCurrentRound(nextRound);
      promptExportGeneratedRound(nextRound, updatedBracket, {
        players,
        bracket: updatedBracket,
        currentRound: nextRound,
        totalRounds: Math.max(totalRounds, maxRound),
        playersWithBye: updatedPlayersWithBye,
        tournamentStarted: true,
      });
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

  // Undo/Reset a match result
  const undoMatchResult = (matchId: string) => {
    const matchToUndo = bracket.find(m => m.id === matchId);
    if (!matchToUndo || matchToUndo.status !== 'completed') return;

    if (!confirm(`確定要重設這場比賽的結果嗎？\n\n這將會清除第 ${matchToUndo.round + 1} 輪之後的所有賽程。`)) {
      return;
    }

    // Reset the match
    let updatedBracket = bracket.map(m => ({ ...m }));
    const matchIndex = updatedBracket.findIndex(m => m.id === matchId);
    
    if (matchIndex === -1) return;

    updatedBracket[matchIndex] = {
      ...updatedBracket[matchIndex],
      winner: null,
      status: 'ready'
    };

    // Remove all matches from subsequent rounds
    const resetRound = matchToUndo.round;
    updatedBracket = updatedBracket.filter(m => m.round <= resetRound);

    // Rebuild bye tracking by scanning all completed matches
    const newByePlayerIds = new Set<string>();
    updatedBracket.forEach(match => {
      if (match.status === 'completed' && match.player2 === null && match.player1) {
        newByePlayerIds.add(match.player1.id);
      }
    });
    setPlayersWithBye(newByePlayerIds);

    // Recalculate total rounds
    const currentRoundMatches = updatedBracket.filter(m => m.round === resetRound);
    const potentialWinners = currentRoundMatches.filter(m => m.status === 'completed').length;
    const incompleteMatches = currentRoundMatches.filter(m => m.status !== 'completed').length;
    
    let estimatedRounds = resetRound;
    let remainingPlayers = potentialWinners + incompleteMatches;
    while (remainingPlayers > 1) {
      remainingPlayers = Math.ceil(remainingPlayers / 2);
      estimatedRounds++;
    }
    setTotalRounds(estimatedRounds);

    setBracket(updatedBracket);
    
    // Navigate to the round where the match was reset
    setCurrentRound(resetRound);
  };

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
          skillLevel: normalizeSkillLevel(row['技術等級'] || row['skillLevel'] || row['等級'] || 'B2'),
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
              skillLevel: normalizeSkillLevel(values[3] || 'B2'),
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

  const buildTournamentStateWorkbook = (snapshot?: TournamentStateSnapshot) => {
    const sourcePlayers = snapshot?.players ?? players;
    const sourceBracket = snapshot?.bracket ?? bracket;
    const sourceCurrentRound = snapshot?.currentRound ?? currentRound;
    const sourceTotalRounds = snapshot?.totalRounds ?? totalRounds;
    const sourcePlayersWithBye = snapshot?.playersWithBye ?? playersWithBye;
    const sourceTournamentStarted = snapshot?.tournamentStarted ?? tournamentStarted;
    const wb = XLSX.utils.book_new();

    const metaRows = [
      { 項目: '當前輪次', 值: sourceCurrentRound },
      { 項目: '總輪數', 值: sourceTotalRounds },
      { 項目: '輪空選手IDs', 值: Array.from(sourcePlayersWithBye).join(',') },
      { 項目: '已開始', 值: sourceTournamentStarted ? '是' : '否' },
    ];
    const wsMeta = XLSX.utils.json_to_sheet(metaRows);
    wsMeta['!cols'] = [{ wch: 16 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsMeta, '賽事資訊');

    const playerRows = sourcePlayers.map(p => ({
      player_id: p.id,
      姓名: p.name,
      年齡: p.age,
      性別: p.gender,
      技術等級: p.skillLevel,
    }));
    const wsPlayers = XLSX.utils.json_to_sheet(playerRows);
    wsPlayers['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 6 }, { wch: 6 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsPlayers, '選手名單');

    const bracketRows = sourceBracket.map(m => ({
      match_id: m.id,
      輪次: m.round,
      位置: m.position,
      狀態: m.status,
      player1_id: m.player1?.id ?? '',
      選手甲: m.player1?.name ?? '',
      player2_id: m.player2?.id ?? '',
      選手乙: m.player2?.name ?? '',
      winner_id: m.winner?.id ?? '',
      晉級者: m.winner?.name ?? '',
    }));
    const wsBracket = XLSX.utils.json_to_sheet(bracketRows);
    wsBracket['!cols'] = [
      { wch: 12 }, { wch: 6 }, { wch: 6 }, { wch: 10 },
      { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
      { wch: 14 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsBracket, '賽程');

    return wb;
  };

  const restoreTournamentStateFromWorkbook = (workbook: XLSX.WorkBook) => {
    if (!workbook.Sheets['賽事資訊'] || !workbook.Sheets['選手名單'] || !workbook.Sheets['賽程']) {
      alert('無效的賽事存檔：請確認此檔案是由「💾 儲存可還原存檔」匯出的存檔');
      return;
    }

    const metaRows = XLSX.utils.sheet_to_json(workbook.Sheets['賽事資訊']) as { 項目: string; 值: string | number }[];
    const metaMap: Record<string, string> = {};
    metaRows.forEach(row => {
      metaMap[String(row.項目)] = String(row.值);
    });

    const savedCurrentRound = parseInt(metaMap['當前輪次']) || 1;
    const savedTotalRounds = parseInt(metaMap['總輪數']) || 0;
    const savedByeIds = (metaMap['輪空選手IDs'] || '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '');

    const playerRows = XLSX.utils.sheet_to_json(workbook.Sheets['選手名單']) as Array<Record<string, unknown>>;
    const restoredPlayers: Player[] = playerRows.map(row => ({
      id: String(row.player_id ?? ''),
      name: String(row['姓名'] ?? ''),
      age: parseInt(String(row['年齡'] ?? '30')) || 30,
      gender: (String(row['性別'] ?? '男')) as Gender,
      skillLevel: normalizeSkillLevel(String(row['技術等級'] ?? 'B2')),
      matchesPlayed: 0,
    }));

    const playerMap = new Map<string, Player>();
    restoredPlayers.forEach(player => playerMap.set(player.id, player));

    const bracketRows = XLSX.utils.sheet_to_json(workbook.Sheets['賽程']) as Array<Record<string, unknown>>;
    const restoredBracket: GrandSlamMatch[] = bracketRows.map(row => {
      const player1Id = String(row.player1_id ?? '');
      const player2Id = String(row.player2_id ?? '');
      const winnerId = String(row.winner_id ?? '');

      return {
        id: String(row.match_id ?? ''),
        round: parseInt(String(row['輪次'] ?? '1')) || 1,
        position: parseInt(String(row['位置'] ?? '0')) || 0,
        status: (String(row['狀態'] ?? 'pending')) as 'pending' | 'ready' | 'completed',
        player1: player1Id ? (playerMap.get(player1Id) ?? null) : null,
        player2: player2Id ? (playerMap.get(player2Id) ?? null) : null,
        winner: winnerId ? (playerMap.get(winnerId) ?? null) : null,
      };
    });

    setPlayers(restoredPlayers);
    setBracket(restoredBracket);
    setCurrentRound(savedCurrentRound);
    setTotalRounds(savedTotalRounds);
    setPlayersWithBye(new Set(savedByeIds));
    setTournamentStarted(true);

    alert(`✅ 賽事還原成功！\n選手：${restoredPlayers.length} 人\n總輪數：${savedTotalRounds} 輪\n當前輪次：第 ${savedCurrentRound} 輪`);
  };

  // Export full tournament state as Excel (for later restore)
  const handleExportTournamentState = async (snapshot?: TournamentStateSnapshot) => {
    const today = new Date().toLocaleDateString('zh-TW');
    const exportRound = Number.isFinite(snapshot?.currentRound)
      ? Math.max(1, Math.floor(snapshot!.currentRound))
      : Math.max(1, Math.floor(currentRound));
    const fileName = `一球大滿貫_賽事存檔_${today.replace(/\//g, '')}_R${exportRound}.xlsx`;
    const wb = buildTournamentStateWorkbook(snapshot);

    if (supportsRememberedStateFile) {
      try {
        const handle = await filePickerWindow.showSaveFilePicker?.({
          suggestedName: fileName,
          types: [
            {
              description: 'Excel 活頁簿',
              accept: {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              },
            },
          ],
        });

        if (handle) {
          const writable = await handle.createWritable();
          const workbookData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          await writable.write(workbookData);
          await writable.close();

          await saveRememberedTournamentFileHandle(handle);
          localStorage.setItem(TOURNAMENT_STATE_FILE_NAME_KEY, handle.name);
          setLastSavedStateFileName(handle.name);
          setHasRememberedStateFile(true);
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('使用記住位置的存檔方式失敗，改用一般下載:', error);
      }
    }

    XLSX.writeFile(wb, fileName);
  };

  // Import and restore tournament state from an exported state file
  const handleImportTournamentState = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        restoreTournamentStateFromWorkbook(workbook);
      } catch (error) {
        console.error('還原失敗:', error);
        alert('還原失敗，請確認檔案是大滿貫賽事存檔格式');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRestoreLastSavedTournamentState = async () => {
    try {
      const handle = await loadRememberedTournamentFileHandle();
      if (!handle) {
        setHasRememberedStateFile(false);
        alert('目前沒有可直接還原的上次存檔，請先手動選擇檔案。');
        return;
      }

      const currentPermission = await handle.queryPermission?.({ mode: 'read' });
      const grantedPermission = currentPermission === 'granted'
        ? 'granted'
        : await handle.requestPermission?.({ mode: 'read' });

      if (grantedPermission !== 'granted') {
        alert('未取得讀取上次存檔的權限。');
        return;
      }

      const file = await handle.getFile();
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      restoreTournamentStateFromWorkbook(workbook);
    } catch (error) {
      console.error('從上次存檔還原失敗:', error);
      await clearRememberedTournamentFileHandle();
      localStorage.removeItem(TOURNAMENT_STATE_FILE_NAME_KEY);
      setLastSavedStateFileName('');
      setHasRememberedStateFile(false);
      alert('找不到先前記住的存檔位置，可能檔案已搬移或瀏覽器權限已失效，請改用手動選擇檔案。');
    }
  };

  // Export current round matchups as Excel
  const handleExportCurrentRound = () => {
    exportRoundMatchups(currentRound);
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
                {supportsRememberedStateFile && hasRememberedStateFile && (
                  <button className="btn-import btn-import-last" onClick={handleRestoreLastSavedTournamentState}>
                    🕘 還原上次存檔
                  </button>
                )}
                <label className="btn-import btn-import-restore">
                  📂 還原賽事存檔
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImportTournamentState(file);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
                <label className="btn-import">
                  📊 從 Excel 匯入選手
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
              <p className="restore-hint">
                {supportsRememberedStateFile
                  ? lastSavedStateFileName
                    ? `💡 已記住上次存檔：${lastSavedStateFileName}`
                    : '💡 使用「💾 儲存可還原存檔」後，系統會記住上次存檔位置，可直接還原。'
                  : '💡 目前瀏覽器不支援記住實際存檔位置，仍可手動選擇存檔還原。'}
              </p>
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
              <button className="btn-secondary" onClick={handleExportCurrentRound}>
                📄 匯出本輪對陣
              </button>
              <button className="btn-save" onClick={() => { void handleExportTournamentState(); }}>
                💾 儲存可還原存檔
              </button>
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
                      <span>晉級：{match.winner.name}</span>
                      <button 
                        className="btn-edit"
                        onClick={() => undoMatchResult(match.id)}
                        title="重設比賽結果"
                      >
                        ✏️
                      </button>
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

        .btn-import-restore {
          background: linear-gradient(135deg, #28a745, #1e7e34);
        }

        .btn-import-restore:hover {
          background: linear-gradient(135deg, #1e7e34, #155724);
        }

        .btn-import-last {
          background: linear-gradient(135deg, #ff9800, #f57c00);
        }

        .btn-import-last:hover {
          background: linear-gradient(135deg, #f57c00, #ef6c00);
        }

        .btn-save {
          padding: 10px 20px;
          background: linear-gradient(135deg, #28a745, #1e7e34);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s;
        }

        .btn-save:hover {
          background: linear-gradient(135deg, #1e7e34, #155724);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(40,167,69,0.3);
        }

        .restore-hint {
          color: #6c757d;
          font-size: 0.9em;
          margin-top: 15px;
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
          margin-bottom: 16px;
          padding: 12px 14px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .round-navigation h3 {
          margin: 0;
          font-size: 1.2em;
          color: #2c3e50;
        }

        .btn-nav {
          padding: 8px 14px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.95em;
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
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 6px;
          margin-bottom: 10px;
        }

        .match-card {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 6px;
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
          margin-bottom: 4px;
          padding-bottom: 3px;
          border-bottom: 1px solid #dee2e6;
        }

        .match-number {
          font-weight: bold;
          font-size: 1.14em;
          color: #2c3e50;
        }

        .match-status-badge {
          padding: 1px 5px;
          border-radius: 20px;
          font-size: 1em;
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
          gap: 4px;
        }

        .player-slot {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 6px;
          background: #f8f9fa;
          border-radius: 6px;
          border: 1px solid transparent;
          transition: all 0.3s;
        }

        .player-slot.winner {
          background: #d4edda;
          border-color: #28a745;
        }

        .player-name {
          font-weight: bold;
          font-size: 1.24em;
          line-height: 1.2;
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
          text-align: left;
          font-weight: bold;
          color: #3498db;
          margin: 0;
          padding-left: 6px;
          font-size: 0.92em;
        }

        .btn-win {
          padding: 4px 8px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          font-size: 1.08em;
          transition: all 0.3s;
          align-self: flex-start;
        }

        .btn-win:hover {
          background: #218838;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        .match-result {
          margin-top: 4px;
          padding: 5px;
          background: #e8f5e9;
          border-radius: 6px;
          text-align: left;
          font-weight: bold;
          font-size: 1.16em;
          color: #2e7d32;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 4px;
        }

        .btn-edit {
          background: white;
          color: #667eea;
          border: 1px solid #667eea;
          padding: 3px 7px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 1.02em;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
        }
        .btn-edit:hover {
          background: #667eea;
          color: white;
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }
        .btn-edit:active {
          transform: scale(0.95);
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
