import type { Player, TeamName } from '../types';

/**
 * 生成示範選手資料
 * @param playersPerTeam 每隊人數（默認10人）
 */
export function generateDemoPlayers(playersPerTeam: number = 10): Player[] {
  const demoPlayers: Player[] = [];
  
  const teams: TeamName[] = ['甲隊', '乙隊', '丙隊', '丁隊'];
  
  // 男性名字
  const maleNames = [
    '王建國', '李明華', '張偉強', '劉德華', '陳志明',
    '林俊傑', '吳宗憲', '周杰倫', '郭富城', '梁朝偉',
    '黃志偉', '楊明輝', '許文昌', '鄭成功', '謝明宏',
    '蔡英文', '賴清德', '蘇貞昌', '柯文哲', '侯友宜',
    '馬英九', '連戰', '宋楚瑜', '陳水扁', '呂秀蓮',
    '游錫堃', '蘇起', '唐鳳', '江啟臣', '朱立倫',
    '張善政', '盧秀燕', '林佳龍', '鄭文燦', '陳其邁',
    '黃偉哲', '林智堅', '徐永明', '時代力量', '邱顯智',
  ];
  
  // 女性名字
  const femaleNames = [
    '王小美', '李雅婷', '張惠妹', '劉若英', '陳怡君',
    '林志玲', '吳佩慈', '周慧敏', '郭雪芙', '梁詠琪',
    '黃美玲', '楊麗花', '許茹芸', '鄭秀文', '謝金燕',
    '蔡依林', '賴雅妍', '蘇慧倫', '柯佳嬿', '侯佩岑',
    '張韶涵', '楊丞琳', '田馥甄', '任家萱', '陳妍希',
    '郭采潔', '陳意涵', '桂綸鎂', '周迅', '章子怡',
    '范冰冰', '趙薇', '舒淇', '林心如', '劉嘉玲',
    '張曼玉', '王菲', '那英', '孫燕姿', '蕭亞軒',
  ];
  
  let playerIndex = 0;
  
  // 計算男女比例：60% 男性，40% 女性（四捨五入）
  const maleCount = Math.round(playersPerTeam * 0.6);
  const femaleCount = playersPerTeam - maleCount;
  
  teams.forEach((team, teamIndex) => {
    // 每隊按比例分配男女選手
    for (let i = 0; i < maleCount; i++) {
      const nameIndex = teamIndex * playersPerTeam + i;
      demoPlayers.push({
        id: `demo-player-${playerIndex++}`,
        name: maleNames[nameIndex % maleNames.length],
        age: 25 + Math.floor(Math.random() * 30), // 25-54歲
        gender: '男',
        team,
        matchesPlayed: 0,
        isAlternate: false,
      });
    }
    
    for (let i = 0; i < femaleCount; i++) {
      const nameIndex = teamIndex * playersPerTeam + i;
      demoPlayers.push({
        id: `demo-player-${playerIndex++}`,
        name: femaleNames[nameIndex % femaleNames.length],
        age: 25 + Math.floor(Math.random() * 30), // 25-54歲
        gender: '女',
        team,
        matchesPlayed: 0,
        isAlternate: false,
      });
    }
  });
  
  // 隨機打亂每隊的選手順序（但保持隊伍分組）
  const shuffledPlayers: Player[] = [];
  teams.forEach(team => {
    const teamPlayers = demoPlayers.filter(p => p.team === team);
    shuffledPlayers.push(...teamPlayers);
  });
  
  return shuffledPlayers;
}
