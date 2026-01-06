import React from 'react';
import type { TournamentSettings } from '../types';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TournamentSettings;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose, settings }) => {
  if (!isOpen) return null;

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>網球雙打賽事系統 - 操作手冊</title>
        <style>
          @page { margin: 2cm; }
          body { font-family: "Microsoft JhengHei", "微軟正黑體", sans-serif; line-height: 1.6; color: #333; }
          h1 { color: #667eea; text-align: center; border-bottom: 3px solid #667eea; padding-bottom: 1rem; }
          h2 { color: #667eea; margin-top: 2rem; border-bottom: 2px solid #667eea; padding-bottom: 0.5rem; }
          ul { margin: 0.5rem 0; padding-left: 2rem; }
          li { margin: 0.5rem 0; }
          .sub-rule { display: block; color: #666; font-size: 0.9rem; margin-top: 0.25rem; margin-left: 1rem; }
          strong { color: #667eea; }
        </style>
      </head>
      <body>
        <h1>🎾 網球雙打賽事系統 - 操作手冊</h1>
        
        <h2>📥 如何匯入選手資料</h2>
        <ul>
          <li><strong>方式一：手動新增</strong><br/>
              <span class="sub-rule">在「選手管理」頁面填寫表單，包含姓名、年齡、性別、技術等級、隊伍、分組標籤</span>
          </li>
          <li><strong>方式二：Excel匯入</strong><br/>
              <span class="sub-rule">準備Excel檔案，包含欄位：姓名、年齡（或年次）、性別、技術等級、隊伍、分組標籤</span>
              <span class="sub-rule">點擊「匯入」→ 選擇「Excel」→ 選擇檔案</span>
          </li>
          <li><strong>年齡格式支援：</strong>可使用「年齡」或「年次」（民國年）<br/>
              <span class="sub-rule">年齡：直接填寫實際年齡（如：45）</span>
              <span class="sub-rule">年次：填寫民國出生年（如：68 表示民國68年生）</span>
          </li>
        </ul>

        <h2>👤 選手資料欄位說明</h2>
        <ul>
          <li><strong>必填欄位：</strong><br/>
              <span class="sub-rule">姓名：選手全名</span>
              <span class="sub-rule">年齡/年次：用於配對排序和規則檢查</span>
              <span class="sub-rule">性別：男/女（用於混雙/女雙規則）</span>
          </li>
          <li><strong>選填欄位（可留白）：</strong><br/>
              <span class="sub-rule">技術等級：A（最佳）、B（良好）、C（不错）- 預設為B</span>
              <span class="sub-rule">隊伍：甲隊、乙隊、丙隊、丁隊</span>
              <span class="sub-rule">分組標籤：用於標識特殊角色（如：A1、B2等）</span>
          </li>
        </ul>

        <h2>🏷️ 分組標籤使用說明</h2>
        <ul>
          <li><strong>標籤格式：</strong>A1、A2、A3、B1、B2、C1、D1 等<br/>
              <span class="sub-rule">字母（A/B/C/D）代表隊伍：甲隊/乙隊/丙隊/丁隊</span>
              <span class="sub-rule">數字（1/2/3...）代表隊內角色或順序</span>
          </li>
          <li><strong>常見用途：</strong><br/>
              <span class="sub-rule">A1/B1/C1/D1：各隊隊長或第一種子選手</span>
              <span class="sub-rule">A2/B2/C2/D2：各隊副隊長或第二種子選手</span>
              <span class="sub-rule">A3/B3/C3/D3：各隊第三種子選手</span>
          </li>
          <li><strong>自動配對考量：</strong>系統會優先使用<strong>技術等級（A/B/C）</strong>進行配對平衡<br/>
              <span class="sub-rule">分組標籤主要用於識別與管理，方便手動調整</span>
          </li>
        </ul>

        <h2>⭐ 技術等級定義（A/B/C）</h2>
        <ul>
          <li><strong>A級（最佳）：</strong>技術純熟、比賽經驗豐富<br/>
              <span class="sub-rule">能穩定發揮、戰術執行力強</span>
          </li>
          <li><strong>B級（良好）：</strong>技術良好、具備基本戰術<br/>
              <span class="sub-rule">一般選手水準，可穩定比賽（預設值）</span>
          </li>
          <li><strong>C級（不错）：</strong>技術尚可、仍在進步中<br/>
              <span class="sub-rule">新手或較少比賽經驗者</span>
          </li>
          <li><strong>系統用途：</strong>用於自動配對時的技術平衡<br/>
              <span class="sub-rule">確保各點配對實力相近，提升比賽公平性</span>
          </li>
        </ul>

        <h2>🎯 賽事設定建議</h2>
        <ul>
          <li><strong>每隊人數：</strong>建議10-12人<br/>
              <span class="sub-rule">確保每位選手都有足夠出賽機會</span>
          </li>
          <li><strong>總輪數：</strong>預設3輪（甲乙、丙丁、甲丙對戰）<br/>
              <span class="sub-rule">每隊與其他三隊各打一次</span>
          </li>
          <li><strong>每輪點數：</strong>建議5點<br/>
              <span class="sub-rule">前4點年齡遞增，第5點混雙/女雙</span>
          </li>
          <li><strong>點數規則說明：</strong>年齡遞增 + 最後一點混雙/女雙<br/>
              <span class="sub-rule">例如：3點制（前2點年齡遞增，第3點混雙/女雙）</span>
              <span class="sub-rule">例如：5點制（前4點年齡遞增，第5點混雙/女雙）</span>
              <span class="sub-rule">例如：7點制（前6點年齡遞增，第7點混雙/女雙）</span>
          </li>
          <li><strong>最少出賽：</strong>建議設定為輪數值<br/>
              <span class="sub-rule">確保每位選手至少出賽相應場次</span>
          </li>
        </ul>

        <h2>⚙️ 自動配對與手動配對</h2>
        <ul>
          <li><strong>自動配對：</strong>系統根據規則自動生成賽程<br/>
              <span class="sub-rule">適合快速開賽，符合年齡遞增、混雙/女雙規則</span>
          </li>
          <li><strong>手動配對：</strong>自行安排每場比賽配對<br/>
              <span class="sub-rule">適合有特殊需求或想精確控制配對</span>
              <span class="sub-rule">系統會檢查並提示違反規則的配對</span>
          </li>
          <li><strong>模板功能：</strong>可儲存/載入配對模板<br/>
              <span class="sub-rule">方便下次比賽快速套用相似配對</span>
          </li>
        </ul>

        <h2>🎾 比賽規則重點</h2>
        <ul>
          <li>假設打${settings.pointsPerRound}點雙打，前${settings.pointsPerRound - 1}點年齡遞增，第${settings.pointsPerRound}點混雙/女雙</li>
          <li>每位正式選手至少須出賽${settings.minMatchesPerPlayer}場</li>
          <li>比賽採5局NO-AD制，4:4時Tie-break搶7</li>
          <li>勝場得3分，排名依據：積分 > 勝場 > 淨勝局</li>
        </ul>

        <h2>🧾 匯出收據功能</h2>
        <ul>

          <li><strong>收據格式：</strong>支援PDF列印或Excel匯出<br/>
              <span class="sub-rule">PDF：信用卡大小，每頁10張（2x5排列）</span>
              <span class="sub-rule">Excel：每頁6張（2x3排列），方便後續編輯</span>
          </li>
          <li><strong>自訂資訊：</strong>可設定年份、賽事名稱、地點等</li>
        </ul>

        <h2>💾 資料備份與還原</h2>
        <ul>
          <li><strong>匯出功能：</strong>可匯出選手、比賽資料為JSON或Excel<br/>
              <span class="sub-rule">建議定期備份，避免資料遺失</span>
          </li>
          <li><strong>匯入功能：</strong>可還原先前匯出的資料<br/>
              <span class="sub-rule">支援跨裝置使用或恢復歷史賽事</span>
          </li>
        </ul>

        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>� 系統操作手冊</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          <div className="rules-content">
            
            <div className="rule-section">
              <h4>📥 如何匯入選手資料</h4>
              <ul>
                <li><strong>方式一：手動新增</strong><br/>
                    <span className="sub-rule">在「選手管理」頁面填寫表單，包含姓名、年齡、性別、技術等級、隊伍、分組標籤</span>
                </li>
                <li><strong>方式二：Excel匯入</strong><br/>
                    <span className="sub-rule">準備Excel檔案，包含欄位：姓名、年齡（或年次）、性別、技術等級、隊伍、分組標籤</span>
                    <span className="sub-rule">點擊「匯入」→ 選擇「Excel」→ 選擇檔案</span>
                </li>
                <li><strong>年齡格式支援：</strong>可使用「年齡」或「年次」（民國年）<br/>
                    <span className="sub-rule">年齡：直接填寫實際年齡（如：45）</span>
                    <span className="sub-rule">年次：填寫民國出生年（如：68 表示民國68年生）</span>
                </li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>👤 選手資料欄位說明</h4>
              <ul>
                <li><strong>必填欄位：</strong><br/>
                    <span className="sub-rule">姓名：選手全名</span>
                    <span className="sub-rule">年齡/年次：用於配對排序和規則檢查</span>
                    <span className="sub-rule">性別：男/女（用於混雙/女雙規則）</span>
                </li>
                <li><strong>選填欄位（可留白）：</strong><br/>
                    <span className="sub-rule">技術等級：A（最佳）、B（良好）、C（不错）- 預設為B</span>
                    <span className="sub-rule">隊伍：甲隊、乙隊、丙隊、丁隊</span>
                    <span className="sub-rule">分組標籤：用於標識特殊角色（如：A1、B2等）</span>
                </li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>🏷️ 分組標籤使用說明</h4>
              <ul>
                <li><strong>標籤格式：</strong>A1、A2、A3、B1、B2、C1、D1 等<br/>
                    <span className="sub-rule">字母（A/B/C/D）代表隊伍：甲隊/乙隊/丙隊/丁隊</span>
                    <span className="sub-rule">數字（1/2/3...）代表隊內角色或順序</span>
                </li>
                <li><strong>常見用途：</strong><br/>
                    <span className="sub-rule">A1/B1/C1/D1：各隊隊長或第一種子選手</span>
                    <span className="sub-rule">A2/B2/C2/D2：各隊副隊長或第二種子選手</span>
                    <span className="sub-rule">A3/B3/C3/D3：各隊第三種子選手</span>
                </li>
                <li><strong>自動配對考量：</strong>系統會優先使用<strong>技術等級（A/B/C）</strong>進行配對平衡
                </li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>⭐ 技術等級定義（A/B/C）</h4>
              <ul>
                <li><strong>A級（最佳）：</strong>技術純熟、比賽經驗豐富<br/>
                    <span className="sub-rule">能穩定發揮、戰術執行力強</span>
                </li>
                <li><strong>B級（良好）：</strong>技術良好、具備基本戰術<br/>
                    <span className="sub-rule">一般選手水準，可穩定比賽（預設值）</span>
                </li>
                <li><strong>C級（不错）：</strong>技術尚可、仍在進步中<br/>
                    <span className="sub-rule">新手或較少比賽經驗者</span>
                </li>
                <li><strong>系統用途：</strong>用於自動配對時的技術平衡<br/>
                    <span className="sub-rule">確保各點配對實力相近，提升比賽公平性</span>
                </li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>🎯 賽事設定建議</h4>
              <ul>
                <li><strong>每隊人數：</strong>建議10-12人<br/>
                    <span className="sub-rule">確保每位選手都有足夠出賽機會</span>
                </li>
                <li><strong>總輪數：</strong>預設3輪（甲乙、丙丁、甲丙對戰）<br/>
                    <span className="sub-rule">每隊與其他三隊各打一次</span>
                </li>
                <li><strong>每輪點數：</strong>建議5點<br/>
                    <span className="sub-rule">前4點年齡遞增，第5點混雙/女雙</span>
                </li>
                <li><strong>點數規則說明：</strong>年齡遞增 + 最後一點混雙/女雙<br/>
                    <span className="sub-rule">例如：3點制（前2點年齡遞增，第3點混雙/女雙）</span>
                    <span className="sub-rule">例如：5點制（前4點年齡遞增，第5點混雙/女雙）</span>
                    <span className="sub-rule">例如：7點制（前6點年齡遞增，第7點混雙/女雙）</span>
                </li>
                <li><strong>最少出賽：</strong>建議設定為輪數值<br/>
                    <span className="sub-rule">確保每位選手至少出賽相應場次</span>
                </li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>⚙️ 自動配對與手動配對</h4>
              <ul>
                <li><strong>自動配對：</strong>系統根據規則自動生成賽程<br/>
                    <span className="sub-rule">適合快速開賽，符合年齡遞增、混雙/女雙規則</span>
                </li>
                <li><strong>手動配對：</strong>自行安排每場比賽配對<br/>
                    <span className="sub-rule">適合有特殊需求或想精確控制配對</span>
                    <span className="sub-rule">系統會檢查並提示違反規則的配對</span>
                </li>
                <li><strong>模板功能：</strong>可儲存/載入配對模板<br/>
                    <span className="sub-rule">方便下次比賽快速套用相似配對</span>
                </li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>🎾 比賽規則重點</h4>
              <ul>
                <li>假設打{settings.pointsPerRound}點雙打，前{settings.pointsPerRound - 1}點年齡遞增，第{settings.pointsPerRound}點混雙/女雙</li>
                <li>每位正式選手至少須出賽{settings.minMatchesPerPlayer}場</li>
                <li>比賽採5局NO-AD制，4:4時Tie-break搶7</li>
                <li>勝場得3分，排名依據：積分 &gt; 勝場 &gt; 淨勝局</li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>🧾 匯出收據功能</h4>
              <ul>

                <li><strong>收據格式：</strong>支援PDF列印或Excel匯出<br/>
                    <span className="sub-rule">PDF：信用卡大小，每頁10張（2x5排列）</span>
                    <span className="sub-rule">Excel：每頁6張（2x3排列），方便後續編輯</span>
                </li>
                <li><strong>自訂資訊：</strong>可設定年份、賽事名稱、地點等</li>
              </ul>
            </div>

            <div className="rule-section">
              <h4>💾 資料備份與還原</h4>
              <ul>
                <li><strong>匯出功能：</strong>可匯出選手、比賽資料為JSON或Excel<br/>
                    <span className="sub-rule">建議定期備份，避免資料遺失</span>
                </li>
                <li><strong>匯入功能：</strong>可還原先前匯出的資料<br/>
                    <span className="sub-rule">支援跨裝置使用或恢復歷史賽事</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleExportPDF} style={{ marginRight: '0.5rem' }}>
            📄 匯出PDF
          </button>
          <button className="btn-primary" onClick={onClose}>
            了解
          </button>
        </div>
      </div>
    </div>
  );
};
