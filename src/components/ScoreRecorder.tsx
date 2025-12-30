import React, { useState } from 'react';
import type { Match } from '../types';

interface ScoreRecorderProps {
  match: Match;
  onUpdateScore: (match: Match) => void;
  onCompleteMatch: (match: Match) => void;
}

export const ScoreRecorder: React.FC<ScoreRecorderProps> = ({
  match,
  onUpdateScore,
  onCompleteMatch,
}) => {
  const [showTiebreak, setShowTiebreak] = useState(false);

  // 增加一方的局數
  const addGame = (team: 'team1' | 'team2') => {
    const updatedMatch = { ...match };
    
    if (team === 'team1') {
      updatedMatch.team1Games++;
    } else {
      updatedMatch.team2Games++;
    }

    // 檢查是否到達4:4（需要Tie-break）
    if (updatedMatch.team1Games === 4 && updatedMatch.team2Games === 4) {
      setShowTiebreak(true);
      updatedMatch.team1TiebreakScore = 0;
      updatedMatch.team2TiebreakScore = 0;
    }

    // 檢查是否有隊伍獲勝
    if (updatedMatch.team1Games === 5) {
      updatedMatch.status = 'completed';
      updatedMatch.winner = updatedMatch.team1;
      onCompleteMatch(updatedMatch);
    } else if (updatedMatch.team2Games === 5) {
      updatedMatch.status = 'completed';
      updatedMatch.winner = updatedMatch.team2;
      onCompleteMatch(updatedMatch);
    } else {
      onUpdateScore(updatedMatch);
    }
  };

  // 減少一方的局數
  const removeGame = (team: 'team1' | 'team2') => {
    const updatedMatch = { ...match };
    
    if (team === 'team1' && updatedMatch.team1Games > 0) {
      updatedMatch.team1Games--;
    } else if (team === 'team2' && updatedMatch.team2Games > 0) {
      updatedMatch.team2Games--;
    }

    // 如果從4:4回退，取消Tie-break
    if (showTiebreak && !(updatedMatch.team1Games === 4 && updatedMatch.team2Games === 4)) {
      setShowTiebreak(false);
      updatedMatch.team1TiebreakScore = undefined;
      updatedMatch.team2TiebreakScore = undefined;
    }

    onUpdateScore(updatedMatch);
  };

  // Tie-break計分
  const updateTiebreak = (team: 'team1' | 'team2', increment: boolean) => {
    const updatedMatch = { ...match };
    
    if (team === 'team1') {
      const current = updatedMatch.team1TiebreakScore || 0;
      updatedMatch.team1TiebreakScore = increment ? current + 1 : Math.max(0, current - 1);
      
      // 檢查是否獲勝（先到7分且領先2分以上）
      const team2Score = updatedMatch.team2TiebreakScore || 0;
      if (updatedMatch.team1TiebreakScore >= 7 && 
          updatedMatch.team1TiebreakScore - team2Score >= 2) {
        updatedMatch.team1Games = 5;
        updatedMatch.status = 'completed';
        updatedMatch.winner = updatedMatch.team1;
        onCompleteMatch(updatedMatch);
        return;
      }
    } else {
      const current = updatedMatch.team2TiebreakScore || 0;
      updatedMatch.team2TiebreakScore = increment ? current + 1 : Math.max(0, current - 1);
      
      // 檢查是否獲勝
      const team1Score = updatedMatch.team1TiebreakScore || 0;
      if (updatedMatch.team2TiebreakScore >= 7 && 
          updatedMatch.team2TiebreakScore - team1Score >= 2) {
        updatedMatch.team2Games = 5;
        updatedMatch.status = 'completed';
        updatedMatch.winner = updatedMatch.team2;
        onCompleteMatch(updatedMatch);
        return;
      }
    }

    onUpdateScore(updatedMatch);
  };

  const startMatch = () => {
    const updatedMatch = { ...match, status: 'in-progress' as const };
    onUpdateScore(updatedMatch);
  };

  if (match.status === 'completed') {
    return (
      <div className="score-recorder completed">
        <div className="match-info">
          <h3>第{match.roundNumber}輪 - 第{match.pointNumber}點</h3>
          <div className="teams">
            <div className={`team ${match.winner === match.team1 ? 'winner' : ''}`}>
              {match.team1}
            </div>
            <div className="vs">VS</div>
            <div className={`team ${match.winner === match.team2 ? 'winner' : ''}`}>
              {match.team2}
            </div>
          </div>
        </div>

        <div className="final-score">
          <div className="score-display">
            <div className={`team-score ${match.winner === match.team1 ? 'winner' : ''}`}>
              <div className="team-name">{match.team1}</div>
              <div className="score-large">{match.team1Games}</div>
              {match.team1TiebreakScore !== undefined && (
                <div className="tiebreak-score">({match.team1TiebreakScore})</div>
              )}
            </div>
            <div className="score-separator">-</div>
            <div className={`team-score ${match.winner === match.team2 ? 'winner' : ''}`}>
              <div className="team-name">{match.team2}</div>
              <div className="score-large">{match.team2Games}</div>
              {match.team2TiebreakScore !== undefined && (
                <div className="tiebreak-score">({match.team2TiebreakScore})</div>
              )}
            </div>
          </div>
        </div>

        <div className="players-info">
          <div className="team-players">
            <h4>{match.team1}</h4>
            <p>{match.pair1.player1.name} ({match.pair1.player1.age}歲 {match.pair1.player1.gender})</p>
            <p>{match.pair1.player2.name} ({match.pair1.player2.age}歲 {match.pair1.player2.gender})</p>
          </div>
          <div className="team-players">
            <h4>{match.team2}</h4>
            <p>{match.pair2.player1.name} ({match.pair2.player1.age}歲 {match.pair2.player1.gender})</p>
            <p>{match.pair2.player2.name} ({match.pair2.player2.age}歲 {match.pair2.player2.gender})</p>
          </div>
        </div>
      </div>
    );
  }

  if (match.status === 'scheduled') {
    return (
      <div className="score-recorder scheduled">
        <div className="match-info">
          <h3>第{match.roundNumber}輪 - 第{match.pointNumber}點</h3>
          <div className="teams">
            <div className="team">{match.team1}</div>
            <div className="vs">VS</div>
            <div className="team">{match.team2}</div>
          </div>
        </div>

        <div className="players-info">
          <div className="team-players">
            <h4>{match.team1}</h4>
            <p>{match.pair1.player1.name} ({match.pair1.player1.age}歲 {match.pair1.player1.gender})</p>
            <p>{match.pair1.player2.name} ({match.pair1.player2.age}歲 {match.pair1.player2.gender})</p>
          </div>
          <div className="team-players">
            <h4>{match.team2}</h4>
            <p>{match.pair2.player1.name} ({match.pair2.player1.age}歲 {match.pair2.player1.gender})</p>
            <p>{match.pair2.player2.name} ({match.pair2.player2.age}歲 {match.pair2.player2.gender})</p>
          </div>
        </div>

        <button className="btn-primary btn-large" onClick={startMatch}>
          開始比賽
        </button>
      </div>
    );
  }

  // 比賽進行中
  return (
    <div className="score-recorder in-progress">
      <div className="match-info">
        <h3>第{match.roundNumber}輪 - 第{match.pointNumber}點</h3>
        <div className="match-status">比賽進行中</div>
      </div>

      <div className="score-controls">
        <div className="team-control">
          <h4>{match.team1}</h4>
          <div className="players-compact">
            <div>{match.pair1.player1.name} & {match.pair1.player2.name}</div>
          </div>
          <div className="score-display-large">{match.team1Games}</div>
          <div className="control-buttons">
            <button className="btn-score btn-add" onClick={() => addGame('team1')}>
              + 1局
            </button>
            <button className="btn-score btn-remove" onClick={() => removeGame('team1')}>
              - 1局
            </button>
          </div>
        </div>

        <div className="score-separator-large">:</div>

        <div className="team-control">
          <h4>{match.team2}</h4>
          <div className="players-compact">
            <div>{match.pair2.player1.name} & {match.pair2.player2.name}</div>
          </div>
          <div className="score-display-large">{match.team2Games}</div>
          <div className="control-buttons">
            <button className="btn-score btn-add" onClick={() => addGame('team2')}>
              + 1局
            </button>
            <button className="btn-score btn-remove" onClick={() => removeGame('team2')}>
              - 1局
            </button>
          </div>
        </div>
      </div>

      {showTiebreak && (
        <div className="tiebreak-section">
          <h4>Tie-break 搶7</h4>
          <div className="tiebreak-controls">
            <div className="tiebreak-team">
              <div className="team-name">{match.team1}</div>
              <div className="tiebreak-score-large">{match.team1TiebreakScore || 0}</div>
              <div className="control-buttons">
                <button 
                  className="btn-tiebreak btn-add" 
                  onClick={() => updateTiebreak('team1', true)}
                >
                  +1
                </button>
                <button 
                  className="btn-tiebreak btn-remove" 
                  onClick={() => updateTiebreak('team1', false)}
                >
                  -1
                </button>
              </div>
            </div>

            <div className="tiebreak-separator">-</div>

            <div className="tiebreak-team">
              <div className="team-name">{match.team2}</div>
              <div className="tiebreak-score-large">{match.team2TiebreakScore || 0}</div>
              <div className="control-buttons">
                <button 
                  className="btn-tiebreak btn-add" 
                  onClick={() => updateTiebreak('team2', true)}
                >
                  +1
                </button>
                <button 
                  className="btn-tiebreak btn-remove" 
                  onClick={() => updateTiebreak('team2', false)}
                >
                  -1
                </button>
              </div>
            </div>
          </div>
          <div className="tiebreak-info">
            先達7分且領先2分以上者獲勝
          </div>
        </div>
      )}
    </div>
  );
};
