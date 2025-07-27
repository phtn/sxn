import type { HTMLProps } from "react";
export type ClassName = HTMLProps<HTMLElement>["className"];

export interface ResponseGameData {
  roundId?: number;
  profit: string;
  win: boolean;
  active: boolean;
  custom:
    | MinesCustom
    | Plinko
    | KenoCustom
    | ColorWheelCustom
    | CoinFlipCustom
    | LimboCustom;
}
export interface GameResult {
  timestamp: number;
  result: "win" | "loss";
  amount?: number;
  gameType?: string;
  multiplier?: number;
  winningChance?: number;
  url: string;
  gameData?: ResponseGameData;
}
export interface StoredData {
  results: GameResult[];
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
}
export interface CasinoResult {
  results: GameResult[];
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
}

export type MinesCustom = { mines: number[]; mineCount: number };
export type Plinko = {
  multislots: number[];
  multipath: number[];
  multiplierList: number[];
};
export type KenoCustom = {
  drawNumbers: number[];
  numberOfMatches: number;
};

export type ColorWheelCustom = {
  multiplier: number;
  slot: number;
};

export type CoinFlipCustom = {
  rounds: { targetFace?: "HEADS" | "TAILS"; result: "HEADS" | "TAILS" }[];
};

export type LimboCustom = {
  multiplier: number;
  winningChance: number;
};

export type DiceCustom = {
  result: number;
  winningChance: number;
};
