export const RULES_VERSION = 7;

export interface GameRules {
  drops: number;
  maxWords: number;
  rackCapacity: number;
  minWordLength: number;
  blankChance: number;
  queueLength: number;
  visibleQueue: number;
  pegCount: number;
  topWordsForShare: number;
}

export const DEFAULT_RULES: GameRules = {
  drops: 5,
  maxWords: 5,
  rackCapacity: 10,
  minWordLength: 3,
  blankChance: 0.05,
  queueLength: 40,
  visibleQueue: 12,
  pegCount: 30,
  topWordsForShare: 3,
};
