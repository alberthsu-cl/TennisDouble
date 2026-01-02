import React from 'react';
import * as XLSX from 'xlsx';
import type { TeamStats, Match, Player, TeamName, TournamentSettings } from '../types';

interface StandingsProps {
  matches: Match[];
  players: Player[];
  settings: TournamentSettings;
  showSensitiveInfo?: boolean;
}

export const Standings: React.FC<StandingsProps> = ({ matches, players, settings, showSensitiveInfo = true }) => {
  // 計算隊伍統計
  const calculateTeamStats = (): TeamStats[] => {
    const teams: TeamName[] = ['甲隊', '乙隊', '丙隊', '丁隊'];
    
    const stats: TeamStats[] = teams.map(teamName => ({
      teamName,
      matchesWon: 0,
      matchesLost: 0,
      gamesWon: 0,
      gamesLost: 0,
      points: 0,
    }));

    // 計算每個比賽的統計
    matches.forEach(match => {
      const team1Stats = stats.find(s => s.teamName === match.team1)!;
      const team2Stats = stats.find(s => s.teamName === match.team2)!;

      // 累計局數
      team1Stats.gamesWon += match.team1Games;
      team1Stats.gamesLost += match.team2Games;
      team2Stats.gamesWon += match.team2Games;
      team2Stats.gamesLost += match.team1Games;

      // 如果比賽已完成，計算勝負
      if (match.status === 'completed') {
        if (match.winner === match.team1) {
          team1Stats.matchesWon++;
          team2Stats.matchesLost++;
          team1Stats.points += 3; // 勝場得3分
        } else if (match.winner === match.team2) {
          team2Stats.matchesWon++;
          team1Stats.matchesLost++;
          team2Stats.points += 3;
        }
      }
    });

    // 排序：積分 > 勝場 > 淨勝局 > 總勝局
    return stats.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.matchesWon !== b.matchesWon) return b.matchesWon - a.matchesWon;
      const aNetGames = a.gamesWon - a.gamesLost;
      const bNetGames = b.gamesWon - b.gamesLost;
      if (aNetGames !== bNetGames) return bNetGames - aNetGames;
      return b.gamesWon - a.gamesWon;
    });
  };

  const teamStats = calculateTeamStats();

  // 計算比賽進度
  const completedMatches = matches.filter(m => m.status === 'completed').length;
  const totalMatches = matches.length;
  const progressPercentage = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;

  // 計算選手統計
  const getPlayerStats = (teamName: TeamName) => {
    return players
      .filter(p => p.team === teamName)
      .map(player => {
        let wins = 0;
        let losses = 0;
        let gamesWon = 0;
        let gamesLost = 0;

        matches.forEach(match => {
          if (match.status !== 'completed') return;

          const isInPair1 = match.pair1.player1?.id === player.id || match.pair1.player2?.id === player.id;
          const isInPair2 = match.pair2.player1?.id === player.id || match.pair2.player2?.id === player.id;

          if (isInPair1) {
            gamesWon += match.team1Games;
            gamesLost += match.team2Games;
            if (match.winner === match.team1) wins++;
            else losses++;
          } else if (isInPair2) {
            gamesWon += match.team2Games;
            gamesLost += match.team1Games;
            if (match.winner === match.team2) wins++;
            else losses++;
          }
        });

        return {
          player,
          wins,
          losses,
          gamesWon,
          gamesLost,
          matchesPlayed: player.matchesPlayed,
        };
      })
      .sort((a, b) => {
        if (a.wins !== b.wins) return b.wins - a.wins;
        const aNetGames = a.gamesWon - a.gamesLost;
        const bNetGames = b.gamesWon - b.gamesLost;
        return bNetGames - aNetGames;
      });
  };

  // Excel 匯出功能
  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // 定義邊框樣式
    const thinBorder = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    };

    // 為工作表的所有儲存格添加邊框
    const applyBorders = (worksheet: XLSX.WorkSheet, numRows: number, numCols: number) => {
      for (let R = 0; R < numRows; R++) {
        for (let C = 0; C < numCols; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[cellAddress]) continue;
          if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
          worksheet[cellAddress].s.border = thinBorder;
        }
      }
    };

    // 1. 隊伍排名工作表
    const teamRankingData = [
      ['隊伍排名'],
      ['排名', '隊伍', '積分', '勝場', '負場', '總勝局', '總失局', '淨勝局'],
      ...teamStats.map((stat, index) => [
        index + 1,
        stat.teamName,
        stat.points,
        stat.matchesWon,
        stat.matchesLost,
        stat.gamesWon,
        stat.gamesLost,
        stat.gamesWon - stat.gamesLost
      ])
    ];
    const teamSheet = XLSX.utils.aoa_to_sheet(teamRankingData);
    applyBorders(teamSheet, teamRankingData.length, 8);
    XLSX.utils.book_append_sheet(workbook, teamSheet, '隊伍排名');

    // 2. 選手表現工作表（每個隊伍）- 不包含敏感資訊
    teamStats.forEach(stat => {
      const playerStats = getPlayerStats(stat.teamName);
      const playerData = [
        [stat.teamName + ' - 選手表現'],
        ['選手', '性別', '出賽', '勝', '負', '勝局', '失局', '淨勝局'],
        ...playerStats.map(ps => [
          ps.player.name || '未知',
          ps.player.gender || '-',
          `${ps.matchesPlayed}/${settings.totalRounds}`,
          ps.wins,
          ps.losses,
          ps.gamesWon,
          ps.gamesLost,
          ps.gamesWon - ps.gamesLost
        ])
      ];
      const playerSheet = XLSX.utils.aoa_to_sheet(playerData);
      applyBorders(playerSheet, playerData.length, 8);
      XLSX.utils.book_append_sheet(workbook, playerSheet, stat.teamName);
    });

    // 3. 比賽詳情工作表
    const matchDetailsData = [
      ['比賽詳情'],
      ['輪次', '點數', '隊伍1', '選手1', '選手2', '比分', '隊伍2', '選手3', '選手4', '獲勝隊伍', '狀態'],
      ...matches.map(match => [
        `第${match.roundNumber}輪`,
        `第${match.pointNumber}點`,
        match.team1,
        match.pair1.player1?.name || '-',
        match.pair1.player2?.name || '-',
        `${match.team1Games}:${match.team2Games}`,
        match.team2,
        match.pair2.player1?.name || '-',
        match.pair2.player2?.name || '-',
        match.winner || '-',
        match.status === 'completed' ? '已完成' : match.status === 'in-progress' ? '進行中' : '未開始'
      ])
    ];
    const matchSheet = XLSX.utils.aoa_to_sheet(matchDetailsData);
    applyBorders(matchSheet, matchDetailsData.length, 11);
    XLSX.utils.book_append_sheet(workbook, matchSheet, '比賽詳情');

    // 4. 賽事統計工作表
    const statsData = [
      ['賽事統計'],
      ['項目', '數值'],
      ['總比賽數', totalMatches],
      ['已完成', completedMatches],
      ['進行中', matches.filter(m => m.status === 'in-progress').length],
      ['未開始', matches.filter(m => m.status === 'scheduled').length],
      ['完成進度', `${progressPercentage.toFixed(1)}%`],
      [''],
      ['賽事設定'],
      ['每隊人數', settings.playersPerTeam],
      ['每輪點數', settings.pointsPerRound],
      ['總輪數', settings.totalRounds],
      ['最少出賽場次', settings.minMatchesPerPlayer],
      ['強制規則', settings.enforceRules ? '是' : '否']
    ];
    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    applyBorders(statsSheet, statsData.length, 2);
    XLSX.utils.book_append_sheet(workbook, statsSheet, '賽事統計');

    // 生成文件名（包含日期時間）
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = `網球賽事結果_${dateStr}_${timeStr}.xlsx`;

    // 下載文件
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="standings">
      <div className="standings-header">
        <h2>即時排名</h2>
        <button 
          className="export-excel-btn"
          onClick={exportToExcel}
          title="匯出Excel報表"
        >
          📊 匯出Excel
        </button>
      </div>

      <div className="progress-section">
        <h3>比賽進度</h3>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="progress-text">
          已完成 {completedMatches} / {totalMatches} 場 ({progressPercentage.toFixed(1)}%)
        </div>
      </div>

      <div className="team-standings">
        <h3>隊伍排名</h3>
        <table className="standings-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>隊伍</th>
              <th>積分</th>
              <th>勝場</th>
              <th>負場</th>
              <th>總勝局</th>
              <th>總失局</th>
              <th>淨勝局</th>
            </tr>
          </thead>
          <tbody>
            {teamStats.map((stat, index) => (
              <tr key={stat.teamName} className={index === 0 ? 'first-place' : ''}>
                <td className="rank">{index + 1}</td>
                <td className="team-name">{stat.teamName}</td>
                <td className="points"><strong>{stat.points}</strong></td>
                <td>{stat.matchesWon}</td>
                <td>{stat.matchesLost}</td>
                <td>{stat.gamesWon}</td>
                <td>{stat.gamesLost}</td>
                <td className={stat.gamesWon - stat.gamesLost >= 0 ? 'positive' : 'negative'}>
                  {stat.gamesWon - stat.gamesLost >= 0 ? '+' : ''}
                  {stat.gamesWon - stat.gamesLost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="player-standings">
        <h3>選手表現</h3>
        {teamStats.map(stat => {
          const playerStats = getPlayerStats(stat.teamName);
          return (
            <div key={stat.teamName} className="team-player-stats">
              <h4>{stat.teamName}</h4>
              <table className="player-stats-table">
                <thead>
                  <tr>
                    <th>選手</th>
                    {showSensitiveInfo && <th>年齡</th>}
                    <th>性別</th>
                    <th>出賽</th>
                    <th>勝</th>
                    <th>負</th>
                    <th>勝局</th>
                    <th>失局</th>
                    <th>淨勝局</th>
                  </tr>
                </thead>
                <tbody>
                  {playerStats.map(ps => (
                    <tr key={ps.player.id}>
                      <td>{ps.player.name || '未知'}</td>
                      {showSensitiveInfo && <td>{ps.player.age || '-'}</td>}
                      <td>{ps.player.gender || '-'}</td>
                      <td>{ps.matchesPlayed}/{settings.totalRounds}</td>
                      <td>{ps.wins}</td>
                      <td>{ps.losses}</td>
                      <td>{ps.gamesWon}</td>
                      <td>{ps.gamesLost}</td>
                      <td className={ps.gamesWon - ps.gamesLost >= 0 ? 'positive' : 'negative'}>
                        {ps.gamesWon - ps.gamesLost >= 0 ? '+' : ''}
                        {ps.gamesWon - ps.gamesLost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
};
