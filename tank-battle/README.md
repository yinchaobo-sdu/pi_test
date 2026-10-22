# 坦克大战 (Tank Battle)

使用 **Next.js 14 (App Router) + Canvas 2D** 编写的经典坦克大战小游戏，无任何图片/音频外部资源。

## 运行

```bash
npm install
npm run dev
```

打开 http://localhost:3000

生产构建：

```bash
npm run build
npm start
```

## 玩法

- 消灭所有敌方坦克即可进入下一关，保护底部的金色基地
- 基地被摧毁或生命耗尽则游戏结束

| 操作 | 按键 |
| --- | --- |
| 移动 | 方向键 / WASD |
| 开火 | 空格 |
| 暂停 | P / Esc |
| 静音 | M |

## 特性

- 可破坏砖墙、不可破坏钢墙、水域、草丛四种地形
- 4 种敌方坦克：普通 / 快速 / 装甲 / 猎手，各有速度、血量、射速差异
- 敌人 AI：会追踪玩家和基地、被阻挡后自动换向
- 道具掉落：`S` 护盾、`R` 速射、`+` 生命、`★` 火力强化（可打穿钢墙）
- 关卡无限递进，难度逐渐提高
- 粒子爆炸、屏幕震动、WebAudio 合成音效（无音频文件）
- 响应式布局，支持键盘操作

## 结构

```
app/
  layout.js        # 根布局
  page.js          # 页面入口
  globals.css      # 全局样式
components/
  TankGame.js      # 游戏 React 组件（画布、循环、输入、UI）
lib/
  constants.js     # 尺寸与地形常量
  game.js          # 游戏引擎（地图、坦克、子弹、AI、渲染）
  sound.js         # WebAudio 音效
```
