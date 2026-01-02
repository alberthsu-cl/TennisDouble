import React from 'react';
import type { Match, TeamName } from '../types';
import { ScoreRecorder } from './ScoreRecorder';

interface MatchListProps {
  matches: Match[];
  onUpdateScore: (match: Match) => void;
  onCompleteMatch: (match: Match) => void;
  onResetMatch: (match: Match) => void;
  filterRound?: number;
  filterTeam?: TeamName;
  filterStatus?: 'all' | 'scheduled' | 'in-progress' | 'completed';
  showSensitiveInfo?: boolean;
}

export const MatchList: React.FC<MatchListProps> = ({
  matches,
  onUpdateScore,
  onCompleteMatch,
  onResetMatch,
  filterRound,
  filterTeam,
  filterStatus = 'all',
  showSensitiveInfo = true,
}) => {
  // 過濾比賽
  const filteredMatches = matches.filter(match => {
    if (filterRound && match.roundNumber !== filterRound) return false;
    if (filterTeam && match.team1 !== filterTeam && match.team2 !== filterTeam) return false;
    if (filterStatus !== 'all' && match.status !== filterStatus) return false;
    return true;
  });

  // 按輪次和點數分組
  const matchesByRound = new Map<number, Match[]>();
  filteredMatches.forEach(match => {
    if (!matchesByRound.has(match.roundNumber)) {
      matchesByRound.set(match.roundNumber, []);
    }
    matchesByRound.get(match.roundNumber)!.push(match);
  });

  // 排序輪次
  const sortedRounds = Array.from(matchesByRound.keys()).sort((a, b) => a - b);

  if (filteredMatches.length === 0) {
    return (
      <div className="match-list-empty">
        <p>目前沒有符合條件的比賽</p>
      </div>
    );
  }

  return (
    <div className="match-list">
      {sortedRounds.map(roundNum => {
        const roundMatches = matchesByRound.get(roundNum)!;
        
        // 按對戰組合分組
        const matchupMap = new Map<string, Match[]>();
        roundMatches.forEach(match => {
          const key = `${match.team1}-${match.team2}`;
          if (!matchupMap.has(key)) {
            matchupMap.set(key, []);
          }
          matchupMap.get(key)!.push(match);
        });

        return (
          <div key={roundNum} className="round-section">
            <h3>第 {roundNum} 輪</h3>
            
            {Array.from(matchupMap.entries()).map(([matchupKey, matchupMatches]) => {
              const sortedMatchup = matchupMatches.sort((a, b) => a.pointNumber - b.pointNumber);
              
              return (
                <div key={matchupKey} className="matchup-section">
                  <h4>{matchupKey}</h4>
                  
                  <div className="points-grid">
                    {sortedMatchup.map(match => (
                      <div key={match.id} className="match-card">
                        <div className="point-badge">第 {match.pointNumber} 點</div>
                        <ScoreRecorder
                          match={match}
                          onUpdateScore={onUpdateScore}
                          onCompleteMatch={onCompleteMatch}
                          onResetMatch={onResetMatch}
                          showSensitiveInfo={showSensitiveInfo}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
