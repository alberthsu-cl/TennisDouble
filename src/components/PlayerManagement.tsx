import React, { useState } from 'react';
import type { Player, TeamName, Gender, SkillLevel, TournamentSettings } from '../types';

interface PlayerManagementProps {
  players: Player[];
  settings: TournamentSettings;
  onAddPlayer: (player: Player) => void;
  onUpdatePlayer: (player: Player) => void;
  onDeletePlayer: (playerId: string) => void;
}

export const PlayerManagement: React.FC<PlayerManagementProps> = ({
  players,
  settings,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('男');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('B');
  const [team, setTeam] = useState<TeamName>('甲隊');
  const [isAlternate, setIsAlternate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const teams: TeamName[] = ['甲隊', '乙隊', '丙隊', '丁隊'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !age) {
      alert('請填寫選手姓名和年齡');
      return;
    }

    const ageNum = parseInt(age);
    if (ageNum <= 0 || ageNum > 120) {
      alert('請輸入有效的年齡');
      return;
    }

    // 檢查該隊是否已滿（不計候補）
    const teamPlayers = players.filter(p => p.team === team && p.id !== editingId && !p.isAlternate);
    if (!isAlternate && teamPlayers.length >= settings.playersPerTeam) {
      alert(`${team}已滿${settings.playersPerTeam}人，請選擇其他隊伍或設為候補`);
      return;
    }

    if (editingId) {
      // 更新現有選手
      const player = players.find(p => p.id === editingId);
      if (player) {
        onUpdatePlayer({
          ...player,
          name: name.trim(),
          age: ageNum,
          gender,
          skillLevel,
          team,
          isAlternate,
        });
      }
      setEditingId(null);
    } else {
      // 新增選手
      const newPlayer: Player = {
        id: `player-${Date.now()}-${Math.random()}`,
        name: name.trim(),
        age: ageNum,
        gender,
        skillLevel,
        team,
        matchesPlayed: 0,
        isAlternate,
      };
      onAddPlayer(newPlayer);
    }

    // 清空表單
    setName('');
    setAge('');
    setGender('男');
    setSkillLevel('B');
    setIsAlternate(false);
  };

  const handleEdit = (player: Player) => {
    setEditingId(player.id);
    setName(player.name);
    setAge(player.age.toString());
    setGender(player.gender);
    setSkillLevel(player.skillLevel);
    setTeam(player.team);
    setIsAlternate(player.isAlternate);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setAge('');
    setGender('男');
    setSkillLevel('B');
    setIsAlternate(false);
  };

  const getTeamCount = (teamName: TeamName) => {
    return players.filter(p => p.team === teamName && !p.isAlternate).length;
  };

  // Debug: 檢查 players 資料
  console.log('PlayerManagement - players:', players);
  console.log('PlayerManagement - players.length:', players.length);
  if (players.length > 0) {
    console.log('First player:', players[0]);
  }

  return (
    <div className="player-management">
      <h2>選手管理</h2>
      
      <div className="players-summary">
        <h3>選手總覽 (正式選手：{players.filter(p => !p.isAlternate).length}/{settings.playersPerTeam * 4} 人)</h3>
        
        {teams.map(teamName => {
          const teamPlayers = players.filter(p => p.team === teamName && !p.isAlternate);
          const alternatePlayers = players.filter(p => p.team === teamName && p.isAlternate);
          return (
            <div key={teamName} className="team-section">
              <h4>{teamName} ({teamPlayers.length}/{settings.playersPerTeam} 人{alternatePlayers.length > 0 ? ` + ${alternatePlayers.length}候補` : ''})</h4>
              <table className="players-table">
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>年齡</th>
                    <th>性別</th>
                    <th>技術等級</th>
                    <th>身份</th>
                    <th>已出賽</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {[...teamPlayers, ...alternatePlayers].sort((a, b) => {
                    if (a.isAlternate !== b.isAlternate) return a.isAlternate ? 1 : -1;
                    return a.age - b.age;
                  }).map(player => (
                    <tr key={player.id} className={player.isAlternate ? 'alternate-player' : ''}>
                      <td>{player.name || '未知'}</td>
                      <td>{player.age || '-'}</td>
                      <td>{player.gender || '-'}</td>
                      <td><span className={`skill-badge skill-${player.skillLevel || 'B'}`}>{player.skillLevel || 'B'}</span></td>
                      <td>{player.isAlternate ? '候補' : '正式'}</td>
                      <td>{player.matchesPlayed || 0}</td>
                      <td>
                        <button
                          className="btn-small btn-edit"
                          onClick={() => handleEdit(player)}
                        >
                          編輯
                        </button>
                        <button
                          className="btn-small btn-delete"
                          onClick={() => {
                            if (confirm(`確定要刪除選手 ${player.name} 嗎？`)) {
                              onDeletePlayer(player.id);
                            }
                          }}
                        >
                          刪除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="player-form">
        <h3>{editingId ? '編輯選手' : '新增選手'}</h3>
        
        <div className="form-group">
          <label>姓名：</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="請輸入選手姓名"
            required
          />
        </div>

        <div className="form-group">
          <label>年齡：</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="請輸入年齡"
            min="1"
            max="120"
            required
          />
        </div>

        <div className="form-group">
          <label>性別：</label>
          <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </div>

        <div className="form-group">
          <label>技術等級：</label>
          <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}>
            <option value="A">A - 最佳</option>
            <option value="B">B - 良好</option>
            <option value="C">C - 不错</option>
          </select>
        </div>

        <div className="form-group">
          <label>隊伍：</label>
          <select value={team} onChange={(e) => setTeam(e.target.value as TeamName)}>
            {teams.map(t => (
              <option key={t} value={t} disabled={getTeamCount(t) >= settings.playersPerTeam && !editingId && !isAlternate}>
                {t} ({getTeamCount(t)}/{settings.playersPerTeam}人)
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isAlternate}
              onChange={(e) => setIsAlternate(e.target.checked)}
            />
            <span>候補選手（不計入隊伍{settings.playersPerTeam}人名額）</span>
          </label>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editingId ? '更新選手' : '新增選手'}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={handleCancelEdit}>
              取消
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
