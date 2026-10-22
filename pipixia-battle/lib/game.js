import {
  TILE, COLS, ROWS, W, H, TANK_SIZE,
  EMPTY, BRICK, STEEL, WATER, GRASS,
} from "./constants";
import { sound } from "./sound";

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const SPAWNS = [{ c: 0, r: 0 }, { c: 9, r: 0 }, { c: 19, r: 0 }];
const BASE = { c: 9, r: 13 };

const TYPES = {
  basic: { speed: 62, hp: 1, delay: [1.4, 2.4], color: "#d24b3a", light: "#ff9d87", dark: "#7a2418", score: 100 },
  fast: { speed: 108, hp: 1, delay: [1.2, 2.0], color: "#3d8fc4", light: "#a3dcff", dark: "#1b4a6b", score: 150 },
  armored: { speed: 48, hp: 3, delay: [1.6, 2.6], color: "#9b6bc9", light: "#e2c6ff", dark: "#4d2c70", score: 250 },
  hunter: { speed: 78, hp: 2, delay: [0.9, 1.6], color: "#d99433", light: "#ffd894", dark: "#7a4c10", score: 200 },
};

const rand = (a, b) => a + Math.random() * (b - a);
const overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function generateMap(level = 1) {
  const map = Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
  const steel = Math.min(0.06 + level * 0.02, 0.2);
  const put = (r, c, t) => {
    for (let dr = 0; dr < 2; dr++) {
      for (let dc = 0; dc < 2; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) map[rr][cc] = t;
      }
    }
  };
  for (let r = 2; r <= 10; r += 2) {
    for (let c = 2; c <= 8; c += 2) {
      const roll = Math.random();
      let t = EMPTY;
      if (roll < 0.55) t = BRICK;
      else if (roll < 0.55 + steel) t = STEEL;
      else if (roll < 0.72) t = WATER;
      else if (roll < 0.82) t = GRASS;
      if (t !== EMPTY) {
        put(r, c, t);
        for (let dr = 0; dr < 2; dr++)
          for (let dc = 0; dc < 2; dc++) {
            const rr = r + dr, cc = COLS - 1 - (c + dc);
            if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) map[rr][cc] = t;
          }
      }
    }
  }
  // 保证通行的走廊
  for (let c = 0; c < COLS; c++) { map[1][c] = EMPTY; map[7][c] = EMPTY; }
  for (const c of [1, 6, 9, 10, 13, 18])
    for (let r = 0; r < ROWS; r++) map[r][c] = EMPTY;
  const clearBox = (c, r, w, h) => {
    for (let rr = r; rr < r + h; rr++)
      for (let cc = c; cc < c + w; cc++)
        if (map[rr] && map[rr][cc] !== undefined) map[rr][cc] = EMPTY;
  };
  clearBox(0, 0, 3, 3);
  clearBox(9, 0, 2, 2);
  clearBox(17, 0, 3, 3);
  clearBox(5, 12, 3, 3);
  clearBox(12, 12, 3, 3);
  // 基地围墙
  for (let c = 8; c <= 11; c++) map[12][c] = BRICK;
  for (let r = 13; r <= 14; r++) { map[r][8] = BRICK; map[r][11] = BRICK; }
  for (let r = 13; r <= 14; r++) for (let c = 9; c <= 10; c++) map[r][c] = EMPTY;
  return map;
}

export class Game {
  constructor() {
    this.input = { up: false, down: false, left: false, right: false, fire: false };
    this.time = 0;
    this.reset();
  }

  reset() {
    this.state = "ready";
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.map = generateMap(1);
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.powerups = [];
    this.baseAlive = true;
    this.baseRect = { x: BASE.c * TILE, y: BASE.r * TILE, w: TILE * 2, h: TILE * 2 };
    this.remainingToSpawn = 0;
    this.spawnTimer = 0;
    this.clearTimer = null;
    this.banner = null;
    this.shake = 0;
    this.maxOnScreen = 4;
    this.player = this.makePlayer();
  }

  makePlayer() {
    return {
      x: 6 * TILE + 2, y: 13 * TILE + 2, w: TANK_SIZE, h: TANK_SIZE,
      dir: 0, speed: 104, cooldown: 0, power: 0, shield: 2.5, rapid: 0,
      dead: false, respawn: 0, flash: 0,
      color: "#2f9e6a", light: "#8cf5bd", dark: "#12563a",
    };
  }

  start() {
    this.reset();
    this.state = "playing";
    this.startLevel();
    sound.init();
  }

  startLevel() {
    this.map = generateMap(this.level);
    this.enemies = [];
    this.bullets = [];
    this.powerups = [];
    this.clearTimer = null;
    this.baseAlive = true;
    this.remainingToSpawn = 6 + this.level * 2;
    this.maxOnScreen = Math.min(3 + Math.ceil(this.level / 2), 6);
    this.spawnTimer = 1.2;
    const p = this.player;
    Object.assign(p, {
      x: 6 * TILE + 2, y: 13 * TILE + 2, dir: 0, dead: false,
      respawn: 0, cooldown: 0, power: 0, rapid: 0, shield: 2.5, flash: 0,
    });
    this.banner = { text: `第 ${this.level} 关`, sub: `敌军 ${this.remainingToSpawn} 辆`, timer: 2 };
  }

  getHud() {
    return {
      state: this.state, score: this.score, lives: Math.max(0, this.lives),
      level: this.level, enemies: this.remainingToSpawn + this.enemies.length,
    };
  }

  update(rawDt) {
    const dt = Math.min(rawDt, 0.05);
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.updateParticles(dt);
    if (this.state !== "playing") return;
    if (this.banner) { this.banner.timer -= dt; if (this.banner.timer <= 0) this.banner = null; }
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePowerups(dt);
    this.updateSpawn(dt);
    this.checkClear(dt);
    if (this.bullets.length) this.bulletVsBullet();
  }

  // ---------- 通用碰撞 ----------
  canMove(tank, x, y) {
    if (x < 0 || y < 0 || x + TANK_SIZE > W || y + TANK_SIZE > H) return false;
    const c0 = Math.floor(x / TILE), c1 = Math.floor((x + TANK_SIZE - 0.01) / TILE);
    const r0 = Math.floor(y / TILE), r1 = Math.floor((y + TANK_SIZE - 0.01) / TILE);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const t = this.map[r]?.[c];
        if (t === BRICK || t === STEEL || t === WATER) return false;
      }
    const box = { x, y, w: TANK_SIZE, h: TANK_SIZE };
    if (this.baseAlive && overlap(box, this.baseRect)) return false;
    const others = [...this.enemies, this.player];
    for (const o of others) {
      if (!o || o === tank || o.dead) continue;
      if (overlap(box, o)) return false;
    }
    return true;
  }

  // ---------- 玩家 ----------
  updatePlayer(dt) {
    const p = this.player;
    p.shield = Math.max(0, p.shield - dt);
    p.rapid = Math.max(0, p.rapid - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.flash = Math.max(0, p.flash - dt);
    if (p.dead) {
      p.respawn -= dt;
      if (p.respawn <= 0) this.respawnPlayer();
      return;
    }
    const i = this.input;
    let dir = -1;
    if (i.up) dir = 0;
    else if (i.down) dir = 2;
    else if (i.left) dir = 3;
    else if (i.right) dir = 1;
    if (dir >= 0) {
      p.dir = dir;
      const v = DIRS[dir];
      const nx = p.x + v[0] * p.speed * dt;
      const ny = p.y + v[1] * p.speed * dt;
      if (this.canMove(p, nx, ny)) { p.x = nx; p.y = ny; }
    }
    if (i.fire && p.cooldown <= 0) this.playerShoot();
  }

  playerShoot() {
    const p = this.player;
    const count = this.bullets.filter((b) => b.team === "player").length;
    if (count >= 2 + p.power) return;
    p.cooldown = p.rapid > 0 ? 0.16 : 0.34;
    const v = DIRS[p.dir];
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    this.bullets.push({
      x: cx + v[0] * 18 - 4, y: cy + v[1] * 18 - 4, w: 8, h: 8,
      vx: v[0] * (300 + p.power * 60), vy: v[1] * (300 + p.power * 60),
      team: "player", power: 1 + p.power, life: 2.5,
    });
    sound.shoot();
    this.particles.push({
      x: cx + v[0] * 20, y: cy + v[1] * 20, vx: v[0] * 40, vy: v[1] * 40,
      life: 0.1, max: 0.1, size: 5, color: "#ffe9a8", gravity: 0,
    });
  }

  hitPlayer() {
    const p = this.player;
    if (p.dead) return;
    if (p.shield > 0) {
      this.sparks(p.x + p.w / 2, p.y + p.h / 2, "#7ee8ff", 10);
      sound.hit();
      return;
    }
    p.dead = true;
    p.respawn = 1.6;
    this.explode(p.x + p.w / 2, p.y + p.h / 2, 1.2);
    this.lives -= 1;
    if (this.lives <= 0) {
      this.state = "gameover";
      this.banner = null;
      sound.gameOver();
    }
  }

  respawnPlayer() {
    if (this.lives <= 0) return;
    const x = 6 * TILE + 2, y = 13 * TILE + 2;
    if (!this.canMove(null, x, y)) { this.player.respawn = 0.4; return; }
    Object.assign(this.player, {
      x, y, dead: false, dir: 0, shield: 2.5, power: 0,
      rapid: 0, cooldown: 0, flash: 0,
    });
    this.rings.push({ x: x + 14, y: y + 14, r: 6, max: 34, life: 0.35, maxLife: 0.35, color: "#7ee8ff" });
  }

  // ---------- 敌人 ----------
  updateEnemies(dt) {
    for (const e of this.enemies) {
      e.fireCd -= dt;
      e.decision -= dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.decision <= 0) {
        e.dir = this.chooseDir(e);
        e.decision = rand(0.7, 1.6);
      }
      const v = DIRS[e.dir];
      const nx = e.x + v[0] * e.speed * dt;
      const ny = e.y + v[1] * e.speed * dt;
      if (this.canMove(e, nx, ny)) {
        e.x = nx; e.y = ny; e.stuck = 0;
      } else {
        e.stuck += dt;
        if (e.stuck > 0.12) {
          e.dir = this.chooseDir(e);
          e.decision = rand(0.6, 1.2);
          e.stuck = 0;
        }
      }
      if (e.fireCd <= 0) {
        if (this.wantsFire(e)) {
          this.enemyShoot(e);
          e.fireCd = rand(e.delay[0], e.delay[1]);
        } else {
          e.fireCd = 0.3;
        }
      }
    }
  }

  chooseDir(e) {
    const ok = [0, 1, 2, 3].filter((d) => {
      const v = DIRS[d];
      return this.canMove(e, e.x + v[0] * 5, e.y + v[1] * 5);
    });
    if (!ok.length) return (e.dir + 2) % 4;
    const p = this.player;
    let tx, ty;
    if (!p.dead && Math.random() < 0.7) { tx = p.x + p.w / 2; ty = p.y + p.h / 2; }
    else { tx = this.baseRect.x + 32; ty = this.baseRect.y + 32; }
    const dx = tx - (e.x + e.w / 2), dy = ty - (e.y + e.h / 2);
    const pref = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
    if (ok.includes(pref) && Math.random() < 0.6) return pref;
    const noBack = ok.filter((d) => d !== (e.dir + 2) % 4);
    const pool = noBack.length ? noBack : ok;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  wantsFire(e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const targets = [];
    if (!this.player.dead) targets.push({ x: this.player.x + 14, y: this.player.y + 14 });
    if (this.baseAlive) targets.push({ x: this.baseRect.x + 32, y: this.baseRect.y + 32 });
    for (const t of targets) {
      const dx = t.x - cx, dy = t.y - cy;
      const aligned = Math.abs(dx) < 22 || Math.abs(dy) < 22;
      const facing =
        (e.dir === 0 && dy < 0) || (e.dir === 2 && dy > 0) ||
        (e.dir === 3 && dx < 0) || (e.dir === 1 && dx > 0);
      if (aligned && facing) return true;
    }
    return Math.random() < 0.12;
  }

  enemyShoot(e) {
    if (this.bullets.filter((b) => b.team === "enemy").length > 10) return;
    const v = DIRS[e.dir];
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    this.bullets.push({
      x: cx + v[0] * 18 - 4, y: cy + v[1] * 18 - 4, w: 8, h: 8,
      vx: v[0] * 240, vy: v[1] * 240,
      team: "enemy", power: 1, life: 2.5,
    });
    sound.enemyShoot();
  }

  updateSpawn(dt) {
    if (this.remainingToSpawn <= 0 || this.enemies.length >= this.maxOnScreen) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const free = SPAWNS.filter((s) => this.canMove(null, s.c * TILE + 2, s.r * TILE + 2));
    if (!free.length) return;
    const s = free[Math.floor(Math.random() * free.length)];
    const pool = ["basic", "basic", "basic", "fast"];
    if (this.level >= 2) pool.push("armored", "hunter");
    if (this.level >= 4) pool.push("armored", "hunter", "fast");
    const kind = pool[Math.floor(Math.random() * pool.length)];
    const t = TYPES[kind];
    this.enemies.push({
      x: s.c * TILE + 2, y: s.r * TILE + 2, w: TANK_SIZE, h: TANK_SIZE,
      kind: "enemy", dir: 2, speed: t.speed, hp: t.hp, maxHp: t.hp,
      fireCd: rand(0.8, 1.8), delay: t.delay, decision: 0, stuck: 0, flash: 0,
      color: t.color, light: t.light, dark: t.dark, score: t.score,
    });
    this.remainingToSpawn -= 1;
    this.spawnTimer = rand(0.9, 1.6);
    this.rings.push({ x: s.c * TILE + 16, y: s.r * TILE + 16, r: 4, max: 26, life: 0.3, maxLife: 0.3, color: "#ffb347" });
  }

  // ---------- 子弹 ----------
  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      if (b.life <= 0) { this.bullets.splice(i, 1); continue; }
      const dist = Math.hypot(b.vx, b.vy) * dt;
      const steps = Math.max(1, Math.ceil(dist / 6));
      const sx = (b.vx * dt) / steps;
      const sy = (b.vy * dt) / steps;
      let alive = true;
      for (let s = 0; s < steps && alive; s++) {
        b.x += sx;
        b.y += sy;
        alive = !this.bulletHit(b);
      }
      if (!alive) this.bullets.splice(i, 1);
    }
  }

  bulletHit(b) {
    if (b.x < -8 || b.x > W + 8 || b.y < -8 || b.y > H + 8) return true;
    // 基地
    if (this.baseAlive && b.team === "enemy" && overlap(b, this.baseRect)) {
      this.baseAlive = false;
      this.explode(this.baseRect.x + 32, this.baseRect.y + 32, 2);
      this.state = "gameover";
      this.banner = null;
      this.shake = 1;
      sound.gameOver();
      return true;
    }
    // 地形
    const c0 = Math.floor(b.x / TILE), c1 = Math.floor((b.x + b.w - 0.01) / TILE);
    const r0 = Math.floor(b.y / TILE), r1 = Math.floor((b.y + b.h - 0.01) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = this.map[r]?.[c];
        if (t === BRICK) {
          this.map[r][c] = EMPTY;
          this.explode(c * TILE + 16, r * TILE + 16, 0.45);
          return true;
        }
        if (t === STEEL) {
          if (b.power >= 2) {
            this.map[r][c] = EMPTY;
            this.explode(c * TILE + 16, r * TILE + 16, 0.6);
          } else {
            this.sparks(b.x + 4, b.y + 4, "#cbd5e1", 5);
            sound.hit();
          }
          return true;
        }
      }
    }
    // 坦克
    if (b.team === "player") {
      for (const e of this.enemies) {
        if (overlap(b, e)) { this.damageEnemy(e, b.power); return true; }
      }
    } else if (!this.player.dead && overlap(b, this.player)) {
      this.hitPlayer();
      return true;
    }
    return false;
  }

  bulletVsBullet() {
    const dead = new Set();
    for (let i = 0; i < this.bullets.length; i++) {
      for (let j = i + 1; j < this.bullets.length; j++) {
        const a = this.bullets[i], b = this.bullets[j];
        if (a.team === b.team || dead.has(a) || dead.has(b)) continue;
        if (overlap(a, b)) {
          dead.add(a);
          dead.add(b);
          this.sparks(a.x + 4, a.y + 4, "#ffe9a8", 6);
        }
      }
    }
    if (dead.size) this.bullets = this.bullets.filter((b) => !dead.has(b));
  }

  damageEnemy(e, dmg) {
    e.hp -= dmg;
    e.flash = 0.12;
    if (e.hp > 0) {
      this.sparks(e.x + 14, e.y + 14, "#ffd0a8", 6);
      sound.hit();
      return;
    }
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    const cx = e.x + 14, cy = e.y + 14;
    this.explode(cx, cy, 1.1);
    this.score += e.score;
    this.texts.push({ x: cx, y: cy - 8, text: `+${e.score}`, life: 0.9, max: 0.9, color: "#f6d365" });
    if (Math.random() < 0.2) {
      const kinds = ["shield", "rapid", "life", "star"];
      this.powerups.push({
        type: kinds[Math.floor(Math.random() * kinds.length)],
        x: Math.max(4, Math.min(W - 28, cx - 12)),
        y: Math.max(4, Math.min(H - 28, cy - 12)),
        w: 24, h: 24, life: 14, bob: Math.random() * 6,
      });
    }
  }

  updatePowerups(dt) {
    const p = this.player;
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.life -= dt;
      if (pu.life <= 0) { this.powerups.splice(i, 1); continue; }
      if (!p.dead && overlap(pu, p)) {
        this.powerups.splice(i, 1);
        this.applyPowerup(pu.type);
      }
    }
  }

  applyPowerup(type) {
    const p = this.player;
    if (type === "shield") p.shield = Math.max(p.shield, 8);
    else if (type === "rapid") p.rapid = 10;
    else if (type === "life") this.lives = Math.min(6, this.lives + 1);
    else if (type === "star") p.power = Math.min(2, p.power + 1);
    this.score += 50;
    this.texts.push({
      x: p.x + 14, y: p.y - 4,
      text: type === "shield" ? "护盾!" : type === "rapid" ? "速射!" : type === "life" ? "生命+1" : "火力+1",
      life: 1, max: 1, color: "#8cf5bd",
    });
    this.rings.push({ x: p.x + 14, y: p.y + 14, r: 6, max: 40, life: 0.4, maxLife: 0.4, color: "#8cf5bd" });
    sound.powerup();
  }

  checkClear(dt) {
    if (this.remainingToSpawn === 0 && this.enemies.length === 0 && !this.player.dead) {
      if (this.clearTimer === null) {
        this.clearTimer = 2.4;
        const bonus = 500 * this.level;
        this.score += bonus;
        this.banner = { text: `第 ${this.level} 关 完成`, sub: `奖励 +${bonus}`, timer: 2.4 };
        sound.levelUp();
      } else {
        this.clearTimer -= dt;
        if (this.clearTimer <= 0) {
          this.level += 1;
          this.startLevel();
        }
      }
    } else if (this.clearTimer !== null && this.enemies.length > 0) {
      this.clearTimer = null;
    }
  }

  // ---------- 特效 ----------
  explode(x, y, scale = 1) {
    for (let i = 0; i < 16 * scale; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (40 + Math.random() * 150) * scale;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.4, max: 0.7,
        size: 2 + Math.random() * 4, color: Math.random() < 0.5 ? "#ffb347" : "#ff6b3d",
        gravity: 60,
      });
    }
    this.rings.push({ x, y, r: 4, max: 30 * scale, life: 0.3, maxLife: 0.3, color: "#ffcf7a" });
    this.shake = Math.max(this.shake, 0.3 * scale);
    sound.explosion();
  }

  sparks(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 90;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.2 + Math.random() * 0.2, max: 0.4,
        size: 1.5 + Math.random() * 2, color, gravity: 0,
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy = p.vy * 0.97 + (p.gravity || 0) * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) { this.rings.splice(i, 1); continue; }
      r.r += (r.max - r.r) * Math.min(1, dt * 10);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 26 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  // ---------- 渲染 ----------
  draw(ctx) {
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake * 8, (Math.random() - 0.5) * this.shake * 8);
    }
    // 背景
    ctx.fillStyle = "#0f141c";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * TILE, 0); ctx.lineTo(c * TILE, H); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * TILE); ctx.lineTo(W, r * TILE); ctx.stroke();
    }

    this.drawMap(ctx, false);
    this.drawBase(ctx);
    this.drawPowerups(ctx);
    for (const e of this.enemies) this.drawTank(ctx, e);
    if (!this.player.dead) this.drawTank(ctx, this.player);
    this.drawMap(ctx, true); // 草丛覆盖
    this.drawBullets(ctx);
    this.drawParticles(ctx);
    this.drawTexts(ctx);
    this.drawBanner(ctx);
    ctx.restore();
  }

  drawMap(ctx, grassPass) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.map[r][c];
        const x = c * TILE, y = r * TILE;
        if (grassPass) {
          if (t === GRASS) this.drawGrass(ctx, x, y);
          continue;
        }
        if (t === BRICK) this.drawBrick(ctx, x, y);
        else if (t === STEEL) this.drawSteel(ctx, x, y);
        else if (t === WATER) this.drawWater(ctx, x, y);
      }
    }
  }

  drawBrick(ctx, x, y) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE, TILE);
    ctx.clip();
    ctx.fillStyle = "#4a1f16";
    ctx.fillRect(x, y, TILE, TILE);
    const bw = TILE / 2, bh = TILE / 4;
    for (let row = 0; row < 4; row++) {
      const off = row % 2 === 0 ? 0 : bw / 2;
      for (let col = -1; col < 3; col++) {
        const bx = x + col * bw + off;
        ctx.fillStyle = row % 2 === 0 ? "#9c4a30" : "#8a3e28";
        ctx.fillRect(bx + 1, y + row * bh + 1, bw - 2, bh - 2);
        ctx.fillStyle = "rgba(255,190,150,0.12)";
        ctx.fillRect(bx + 1, y + row * bh + 1, bw - 2, 1);
      }
    }
    ctx.restore();
  }

  drawSteel(ctx, x, y) {
    const g = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
    g.addColorStop(0, "#9aa4b2");
    g.addColorStop(0.5, "#6a7484");
    g.addColorStop(1, "#454d5a");
    ctx.fillStyle = g;
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x + 6, y + 6, 4, 4);
    ctx.fillRect(x + TILE - 10, y + 6, 4, 4);
    ctx.fillRect(x + 6, y + TILE - 10, 4, 4);
    ctx.fillRect(x + TILE - 10, y + TILE - 10, 4, 4);
  }

  drawWater(ctx, x, y) {
    ctx.fillStyle = "#0d3d5c";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE, TILE);
    ctx.clip();
    ctx.strokeStyle = "rgba(80,180,230,0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const yy = y + 6 + i * 10;
      ctx.beginPath();
      for (let px = 0; px <= TILE; px += 4) {
        const py = yy + Math.sin(px * 0.25 + this.time * 3 + i) * 2.2;
        if (px === 0) ctx.moveTo(x + px, py);
        else ctx.lineTo(x + px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGrass(ctx, x, y) {
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = "#1f5f2c";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#2f8a3f";
    for (let i = 0; i < 6; i++) {
      const gx = x + 3 + ((i * 11 + x * 7 + y * 3) % 26);
      const gy = y + 6 + ((i * 13) % 20);
      ctx.beginPath();
      ctx.moveTo(gx, gy + 8);
      ctx.lineTo(gx + 3, gy - 4);
      ctx.lineTo(gx + 6, gy + 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawBase(ctx) {
    const { x, y, w, h } = this.baseRect;
    if (!this.baseAlive) {
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#444";
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(x + 6 + (i * 13) % (w - 12), y + 8 + (i * 19) % (h - 16), 8, 6);
      }
      ctx.strokeStyle = "rgba(200,60,60,0.6)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - 12, y + h / 2 - 12);
      ctx.lineTo(x + w / 2 + 12, y + h / 2 + 12);
      ctx.moveTo(x + w / 2 + 12, y + h / 2 - 12);
      ctx.lineTo(x + w / 2 - 12, y + h / 2 + 12);
      ctx.stroke();
      return;
    }
    const pulse = 0.5 + Math.sin(this.time * 2) * 0.5;
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, w * 0.7);
    g.addColorStop(0, `rgba(246,211,101,${0.18 + pulse * 0.12})`);
    g.addColorStop(1, "rgba(246,211,101,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 12, y - 12, w + 24, h + 24);
    roundRect(ctx, x + 7, y + 7, w - 14, h - 14, 6);
    ctx.fillStyle = "#3a3225";
    ctx.fill();
    ctx.strokeStyle = "#f6d365";
    ctx.lineWidth = 2;
    ctx.stroke();
    this.drawStar(ctx, x + w / 2, y + h / 2, 5, 20, 9, "#f6d365");
  }

  drawStar(ctx, cx, cy, spikes, outer, inner, color) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(246,211,101,0.8)";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();
  }

  drawTank(ctx, t) {
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((t.dir * Math.PI) / 2);
    const h = t.w / 2;
    // 阴影
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    roundRect(ctx, -h + 2, -h + 3, h * 2, h * 2, 5);
    ctx.fill();
    // 履带
    ctx.fillStyle = "#20242b";
    roundRect(ctx, -h, -h, 8, h * 2, 3);
    ctx.fill();
    roundRect(ctx, h - 8, -h, 8, h * 2, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let i = 0; i < 5; i++) {
      const ty = -h + 2 + (i * (h * 2 - 4)) / 5;
      ctx.fillRect(-h + 1, ty, 6, 2);
      ctx.fillRect(h - 7, ty, 6, 2);
    }
    // 车身
    const g = ctx.createLinearGradient(-h, -h, h, h);
    g.addColorStop(0, t.light);
    g.addColorStop(0.55, t.color);
    g.addColorStop(1, t.dark);
    ctx.fillStyle = g;
    roundRect(ctx, -h + 6, -h + 2, h * 2 - 12, h * 2 - 4, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(-h + 9, -h + 6, h * 2 - 18, h * 2 - 12);
    // 炮塔
    ctx.beginPath();
    ctx.arc(0, 1, 7, 0, Math.PI * 2);
    ctx.fillStyle = t.light;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 1, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = t.dark;
    ctx.fill();
    // 炮管
    ctx.fillStyle = t.light;
    ctx.fillRect(-2.5, -h - 7, 5, 16);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(-2.5, -h - 7, 5, 3);
    ctx.restore();

    if (t.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, t.flash / 0.12) * 0.6;
      ctx.fillStyle = "#fff";
      roundRect(ctx, t.x, t.y, t.w, t.h, 5);
      ctx.fill();
      ctx.restore();
    }
    // 护盾
    if (t.kind === "player" && t.shield > 0) {
      const a = 0.35 + 0.25 * Math.sin(this.time * 10);
      ctx.strokeStyle = `rgba(110,220,255,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 敌人血条
    if (t.kind === "enemy" && t.maxHp > 1 && t.hp < t.maxHp) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(t.x + 3, t.y - 6, t.w - 6, 4);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(t.x + 3, t.y - 6, (t.w - 6) * (t.hp / t.maxHp), 4);
    }
  }

  drawBullets(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of this.bullets) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      ctx.fillStyle = b.team === "player" ? "rgba(140,245,189,0.35)" : "rgba(255,140,120,0.35)";
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.team === "player" ? "#d8ffe9" : "#ffd0b8";
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawParticles(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const r of this.rings) {
      ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.7;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPowerups(ctx) {
    const icon = { shield: "#4aa3df", rapid: "#f6d365", life: "#ff6b81", star: "#b07cd6" };
    for (const pu of this.powerups) {
      const bob = Math.sin(this.time * 4 + pu.bob) * 2;
      const x = pu.x, y = pu.y + bob;
      const alpha = pu.life < 2 ? 0.4 + 0.6 * Math.abs(Math.sin(pu.life * 8)) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = icon[pu.type];
      ctx.shadowBlur = 12;
      roundRect(ctx, x, y, pu.w, pu.h, 5);
      ctx.fillStyle = "rgba(15,20,28,0.92)";
      ctx.fill();
      ctx.strokeStyle = icon[pu.type];
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = icon[pu.type];
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = pu.type === "shield" ? "S" : pu.type === "rapid" ? "R" : pu.type === "life" ? "+" : "★";
      ctx.fillText(label, x + pu.w / 2, y + pu.h / 2 + 1);
      ctx.restore();
    }
  }

  drawTexts(ctx) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 13px sans-serif";
    for (const t of this.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.max);
      ctx.fillStyle = t.color;
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  drawBanner(ctx) {
    if (!this.banner) return;
    const a = Math.min(1, this.banner.timer * 2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#f6d365";
    ctx.font = "bold 34px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillText(this.banner.text, W / 2, H / 2 - 10);
    if (this.banner.sub) {
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "bold 16px 'PingFang SC', 'Microsoft YaHei', sans-serif";
      ctx.fillText(this.banner.sub, W / 2, H / 2 + 24);
    }
    ctx.restore();
  }
}
