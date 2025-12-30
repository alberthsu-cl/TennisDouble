import React from 'react';
import type { TournamentSettings } from '../types';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TournamentSettings;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose, settings }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📋 賽事規則說明</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          <div className="rules-content">
            <h3>本次會內賽比賽規則：</h3>
            
            <div className="rule-section">
              <h4>🎯 參賽人數</h4>
              <ul>
                <li>參賽共{settings.playersPerTeam * 4}名</li>
                <li>分成四隊：甲隊{settings.playersPerTeam}人、乙隊{settings.playersPerTeam}人、丙隊{settings.playersPerTeam}人、丁隊{settings.playersPerTeam}人</li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>🎾 比賽形式</h4>
              <ul>
                <li>打{settings.pointsPerRound}點雙打</li>
                <li><strong>第1點至第{settings.pointsPerRound - 1}點：</strong>兩人歲數遞增<br/>
                    <span className="sub-rule">第1點 &lt; 第2點 &lt; 第3點 &lt; 第{settings.pointsPerRound - 1}點</span>
                </li>
                <li><strong>第{settings.pointsPerRound}點：</strong>必須安排混雙或女雙出賽<br/>
                    <span className="sub-rule">歲數沒有限制</span>
                </li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>👥 出賽規定</h4>
              <ul>
                <li>每位正式選手至少須出賽{settings.minMatchesPerPlayer}場</li>
                <li>可設定候補選手（不計入隊伍{settings.playersPerTeam}人名額）</li>
                <li>候補選手可隨時上場</li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>🏆 計分規則</h4>
              <ul>
                <li>比賽採5局NO-AD制</li>
                <li>先達5局者獲勝</li>
                <li>4:4時則Tie-break搶7決勝</li>
                <li>Tie-break：先達7分且領先2分以上者獲勝</li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>📊 排名規則</h4>
              <ul>
                <li>勝場得3分</li>
                <li>排名依據：積分 &gt; 勝場 &gt; 淨勝局 &gt; 總勝局</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            了解
          </button>
        </div>
      </div>
    </div>
  );
};
