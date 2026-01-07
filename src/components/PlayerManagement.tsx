import React, { useState } from 'react';
import type { Player, TeamName, Gender, SkillLevel, TournamentSettings } from '../types';

interface PlayerManagementProps {
  players: Player[];
  settings: TournamentSettings;
  onAddPlayer: (player: Player) => void;
  onUpdatePlayer: (player: Player) => void;
  onDeletePlayer: (playerId: string) => void;
  onExportPlayers?: () => void;
  onExportPlayersExcel?: () => void;
  onImportPlayers?: (file: File) => void;
  onImportPlayersExcel?: (file: File) => void;
  onExportInvoices?: () => void;
  showSensitiveInfo?: boolean;
}

export const PlayerManagement: React.FC<PlayerManagementProps> = ({
  players,
  settings,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onExportPlayers,
  onExportPlayersExcel,
  onImportPlayers,
  onImportPlayersExcel,
  onExportInvoices,
  showSensitiveInfo = true,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('男');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('B');
  const [team, setTeam] = useState<TeamName>('甲隊');
  const [groupTag, setGroupTag] = useState('');
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
          groupTag: groupTag.trim() || undefined,
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
        groupTag: groupTag.trim() || undefined,
      };
      onAddPlayer(newPlayer);
    }

    // 清空表單
    setName('');
    setAge('');
    setGender('男');
    setSkillLevel('B');
    setGroupTag('');
  };

  const handleEdit = (player: Player) => {
    setEditingId(player.id);
    setName(player.name);
    setAge(player.age.toString());
    setGender(player.gender);
    setSkillLevel(player.skillLevel);
    setTeam(player.team);
    setGroupTag(player.groupTag || '');
    
    // Scroll to form smoothly
    setTimeout(() => {
      const form = document.querySelector('.player-form');
      if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setAge('');
    setGender('男');
    setSkillLevel('B');
    setGroupTag('');
  };

  const getTeamCount = (teamName: TeamName) => {
    return players.filter(p => p.team === teamName).length;
  };

  // Debug: 檢查 players 資料
  console.log('PlayerManagement - players:', players);
  console.log('PlayerManagement - players.length:', players.length);
  if (players.length > 0) {
    console.log('First player:', players[0]);
  }

  return (
    <div className="player-management">
      <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>選手管理</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {onExportInvoices && (
            <button className="btn-primary" onClick={onExportInvoices}>
              🧾 匯出收據
            </button>
          )}
          {(onExportPlayers || onExportPlayersExcel) && (
            <button className="btn-secondary" onClick={() => {
              const format = prompt('選擇匯出格式：\n1 - Excel\n2 - JSON', '1');
              if (format === '1' && onExportPlayersExcel) {
                onExportPlayersExcel();
              } else if (format === '2' && onExportPlayers) {
                onExportPlayers();
              }
            }}>
              📤 匯出
            </button>
          )}
          {(onImportPlayers || onImportPlayersExcel) && (
            <button className="btn-secondary" onClick={() => {
              const format = prompt('選擇匯入格式：\n1 - Excel\n2 - JSON', '1');
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = format === '1' ? '.xlsx,.xls' : '.json';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  if (format === '1' && onImportPlayersExcel) {
                    onImportPlayersExcel(file);
                  } else if (format === '2' && onImportPlayers) {
                    onImportPlayers(file);
                  }
                }
              };
              if (format === '1' || format === '2') {
                input.click();
              }
            }}>
              📂 匯入
            </button>
          )}
        </div>
      </div>
      
      <div className="players-summary">
        <h3>選手總覽 (選手：{players.length}/{settings.playersPerTeam * 4}+ 人)</h3>
        
        {teams.map(teamName => {
          const teamPlayers = players.filter(p => p.team === teamName);
          return (
            <div key={teamName} className="team-section">
              <h4>{teamName} ({teamPlayers.length} 人)</h4>
              <table className="players-table">
                <thead>
                  <tr>
                    <th>姓名</th>
                    {showSensitiveInfo && <th>年齡</th>}
                    <th>性別</th>
                    {showSensitiveInfo && <th>技術等級</th>}
                    <th>分組標籤</th>
                    <th>已出賽</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {teamPlayers.sort((a, b) => a.age - b.age).map(player => (
                    <tr key={player.id}>
                      <td>{player.name || '未知'}</td>
                      {showSensitiveInfo && <td>{player.age || '-'}</td>}
                      <td>{player.gender || '-'}</td>
                      {showSensitiveInfo && <td><span className={`skill-badge skill-${player.skillLevel || 'B'}`}>{player.skillLevel || 'B'}</span></td>}
                      <td>{player.groupTag ? <span className="group-tag-badge">{player.groupTag}</span> : '-'}</td>
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
              <option key={t} value={t}>
                {t} ({getTeamCount(t)}人)
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>分組標籤：</label>
          <input
            type="text"
            value={groupTag}
            onChange={(e) => setGroupTag(e.target.value)}
            placeholder="如 A1(甲隊領隊), B2(乙隊副領隊)"
            maxLength={10}
          />
          <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
            用於標記領隊、副領隊等，相同標籤的選手應分在同一組
          </small>
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
