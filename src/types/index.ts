// 選手性別
export type Gender = '男' | '女';

// 技術等級
export type SkillLevel = 'A' | 'B' | 'C';

// 隊伍名稱
export type TeamName = '甲隊' | '乙隊' | '丙隊' | '丁隊';

// 選手資料
export interface Player {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  skillLevel: SkillLevel; // 技術等級 (A:最佳, B:良好, C:不错)
  team: TeamName;
  matchesPlayed: number; // 已出賽場次
}

// 雙打配對
export interface Pair {
  player1: Player;
  player2: Player;
  totalAge: number;
}

// 比賽點數類型 (動態，不再限制1-5)
export type PointType = number;

// 單場比賽
export interface Match {
  id: string;
  roundNumber: number; // 第幾輪
  pointNumber: PointType; // 第幾點 (1-5)
  team1: TeamName;
  team2: TeamName;
  pair1: Pair; // team1的配對
  pair2: Pair; // team2的配對
  team1Games: number; // team1贏得的局數
  team2Games: number; // team2贏得的局數
  team1TiebreakScore?: number; // Tie-break分數（如果4:4）
  team2TiebreakScore?: number;
  status: 'scheduled' | 'in-progress' | 'completed';
  winner?: TeamName;
}

// 比賽輪次
export interface Round {
  roundNumber: number;
  matches: Match[];
  completed: boolean;
}

// 隊伍統計
export interface TeamStats {
  teamName: TeamName;
  matchesWon: number;
  matchesLost: number;
  gamesWon: number;
  gamesLost: number;
  points: number; // 積分
}

// 賽事設定
export interface TournamentSettings {
  playersPerTeam: number;      // 每隊人數 (default: 10)
  pointsPerRound: number;      // 每輪點數 (default: 5)
  totalRounds: number;         // 總輪數 (default: 3)
  minMatchesPerPlayer: number; // 每人最少出賽場次（動態計算）
}

// 賽程設定
export interface TournamentConfig {
  totalPlayers: number; // 總人數
  playersPerTeam: number; // 每隊人數
  matchesPerPlayer: number; // 至少X場
  pointsPerRound: number; // 每輪點數
  gamesPerMatch: number; // 5局
  noAd: boolean; // NO-AD制
  tiebreakAt44: boolean; // 4:4時Tie-break
  totalRounds: number; // 總輪數
}

// 完整賽事資料
export interface Tournament {
  id: string;
  name: string;
  config: TournamentConfig;
  teams: {
    [key in TeamName]: Player[];
  };
  rounds: Round[];
  teamStats: TeamStats[];
  currentRound: number;
  isManualSetup: boolean; // 是否使用手動配對
}

// 賽程配對設定（手動模式用）
export interface MatchSetup {
  roundNumber: number;
  pointNumber: PointType;
  team1: TeamName;
  team2: TeamName;
  pair1Players?: [string, string]; // player IDs
  pair2Players?: [string, string]; // player IDs
}
