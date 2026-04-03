export const MAPILLARY_ACCESS_TOKEN = 'MLY|26902555199342476|88b7bc5fddb1d72b9907de39aceefa4e';

export const DEFAULT_SETTINGS = {
  totalRounds: 5,
  timePerRound: 60,
  category: 'all' as const,
};

export const CATEGORIES: Record<string, string> = {
  all: 'Весь мир',
  capitals: 'Столицы мира',
  europe: 'Европа',
  americas: 'Америка',
  russia: 'Россия',
  asia: 'Азия',
  landmarks: 'Достопримечательности',
  nature: 'Природа',
};

export const SCORE_MAX = 5000;
export const SCORE_DECAY = 2000;

export const PLAYER_COLORS = [
  '#00f0ff', // cyan
  '#ff00ff', // magenta
  '#00ff88', // green
  '#ffaa00', // orange
  '#ff4466', // red
  '#aa66ff', // purple
  '#ffff00', // yellow
  '#ff6600', // dark orange
];
