import type { Player, TeamName, SkillLevel } from '../types';

/**
 * 生成示範選手資料
 * @param playersPerTeam 每隊人數（默認10人）
 */
export function generateDemoPlayers(playersPerTeam: number = 10): Player[] {
  const demoPlayers: Player[] = [];
  
  const teams: TeamName[] = ['甲隊', '乙隊', '丙隊', '丁隊'];
  
  // 技術等級分布：20% A級, 50% B級, 30% C級
  const getSkillLevel = (index: number, total: number): SkillLevel => {
    const ratio = index / total;
    if (ratio < 0.2) return 'A';
    if (ratio < 0.7) return 'B';
    return 'C';
  };
  
  // 男性名字 (ATP球員)
  const maleNames = [
    '羅傑費德勒', '拉法納達爾', '諾瓦克喬科維奇', '安迪穆雷', '卡洛斯阿爾卡拉斯',
    '丹尼爾梅德韋傑夫', '斯特凡諾斯西西帕斯', '亞歷山大茲維列夫', '多米尼克蒂姆', '史坦瓦林卡',
    '胡安馬丁德爾波特羅', '馬林西利奇', '凱文安德森', '大衛高芬', '格里戈爾迪米特洛夫',
    '尼克基里奧斯', '丹尼斯沙波瓦洛夫', '亞歷克斯德米諾爾', '費利克斯奧傑阿里亞西姆', '揚尼克辛納',
    '霍伯特胡卡茨', '卡斯珀魯德', '馬泰奧貝雷蒂尼', '安德烈盧布列夫', '迭戈施瓦茨曼',
    '羅伯托包蒂斯塔阿古特', '法比奧福尼尼', '加埃爾蒙菲爾斯', '理查加斯奎特', '約翰伊斯內爾',
    '米洛斯拉奧尼奇', '傑克索克', '休伯特胡卡茲', '卡梅隆諾里', '弗朗西斯蒂亞弗',
    '洛倫佐穆塞蒂', '湯米保羅', '泰勒弗里茨', '塞巴斯蒂安柯達', '傑克德雷珀',
  ];
  
  // 女性名字 (WTA球員)
  const femaleNames = [
    '塞蕾娜威廉斯', '維納斯威廉斯', '大坂直美', '西蒙娜哈勒普', '伊加斯維亞特克',
    '阿琳娜薩巴倫卡', '可可高芙', '瑪麗亞莎拉波娃', '卡洛琳沃茲尼亞琪', '安潔莉克克柏',
    '佩特拉克維托娃', '加比涅穆古魯扎', '維多利亞阿扎倫卡', '耶萊娜奧斯塔彭科', '卡洛琳娜普利斯科娃',
    '艾莉絲梅爾滕斯', '斯隆斯蒂芬斯', '麥迪遜凱斯', '阿曼達安尼西莫娃', '比安卡安德萊斯庫',
    '艾希莉巴蒂', '貝琳達本西奇', '瑪麗亞薩卡莉', '奧恩斯賈巴爾', '芭芭拉克雷吉茨科娃',
    '艾蓮娜里巴基娜', '傑西卡佩古拉', '達莉亞卡薩金娜', '維羅妮卡庫德梅托娃', '卡洛琳加西亞',
    '艾莉森里斯克', '鄭欽文', '張帥', '王薔', '王欣瑜',
    '謝淑薇', '詹詠然', '詹皓晴', '彭帥', '李娜',
  ];
  
  let playerIndex = 0;
  
  // 計算男女比例：60% 男性，40% 女性（四捨五入）
  const maleCount = Math.round(playersPerTeam * 0.6);
  const femaleCount = playersPerTeam - maleCount;
  
  // 先創建所有選手（不分配隊伍）
  const allPlayers: Omit<Player, 'team'>[] = [];
  
  for (let i = 0; i < maleCount * 4; i++) {
    allPlayers.push({
      id: `demo-player-${playerIndex++}`,
      name: maleNames[i % maleNames.length],
      age: 25 + Math.floor(Math.random() * 30),
      gender: '男',
      skillLevel: getSkillLevel(i, maleCount * 4),
      matchesPlayed: 0,
      isAlternate: false,
    });
  }
  
  for (let i = 0; i < femaleCount * 4; i++) {
    allPlayers.push({
      id: `demo-player-${playerIndex++}`,
      name: femaleNames[i % femaleNames.length],
      age: 25 + Math.floor(Math.random() * 30),
      gender: '女',
      skillLevel: getSkillLevel(i, femaleCount * 4),
      matchesPlayed: 0,
      isAlternate: false,
    });
  }
  
  // 按技術等級分組
  const playersBySkill = {
    A: allPlayers.filter(p => p.skillLevel === 'A'),
    B: allPlayers.filter(p => p.skillLevel === 'B'),
    C: allPlayers.filter(p => p.skillLevel === 'C'),
  };
  
  // 平均分配到四隊
  const teamAssignments: Player[][] = [[], [], [], []];
  
  // 依序分配每個技術等級的選手到各隊
  ['A', 'B', 'C'].forEach(skill => {
    const players = playersBySkill[skill as SkillLevel];
    players.forEach((player, index) => {
      const teamIndex = index % 4;
      teamAssignments[teamIndex].push({
        ...player,
        team: teams[teamIndex],
      });
    });
  });
  
  // 合併所有隊伍的選手
  teamAssignments.forEach(teamPlayers => {
    demoPlayers.push(...teamPlayers);
  });
  
  // 隨機打亂每隊的選手順序（但保持隊伍分組）
  const shuffledPlayers: Player[] = [];
  teams.forEach(team => {
    const teamPlayers = demoPlayers.filter(p => p.team === team);
    shuffledPlayers.push(...teamPlayers);
  });
  
  return shuffledPlayers;
}
