export const TILE = 32;
export const COLS = 20;
export const ROWS = 15;
export const W = TILE * COLS; // 640
export const H = TILE * ROWS; // 480

export const TANK_SIZE = 28;

// 地图格子类型
export const EMPTY = 0;
export const BRICK = 1; // 砖墙 - 可摧毁，阻挡坦克和子弹
export const STEEL = 2; // 钢墙 - 不可摧毁（强化子弹除外）
export const WATER = 3; // 河流 - 阻挡坦克，子弹可穿过
export const GRASS = 4; // 草丛 - 不阻挡，覆盖在坦克上方
