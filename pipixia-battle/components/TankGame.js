"use client";

import { useEffect, useRef, useState } from "react";
import { Game } from "@/lib/game";
import { W, H } from "@/lib/constants";
import { sound } from "@/lib/sound";

const KEYS = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right", Space: "fire",
};

const INITIAL_HUD = { state: "ready", score: 0, lives: 3, level: 1, enemies: 0 };

export default function TankGame() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const hudRef = useRef(INITIAL_HUD);
  const [hud, setHud] = useState(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  const syncHud = () => {
    const g = gameRef.current;
    if (!g) return;
    const next = g.getHud();
    hudRef.current = next;
    setHud(next);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const game = new Game();
    gameRef.current = game;
    hudRef.current = game.getHud();

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      game.update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      game.draw(ctx);
      acc += dt;
      if (acc > 0.1) {
        acc = 0;
        const h = game.getHud();
        if (JSON.stringify(h) !== JSON.stringify(hudRef.current)) {
          hudRef.current = h;
          setHud(h);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      const k = KEYS[e.code];
      if (k) game.input[k] = true;
      if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat) {
        if (game.state === "playing") game.state = "paused";
        else if (game.state === "paused") game.state = "playing";
      }
      if (e.code === "KeyM" && !e.repeat) {
        const next = !mutedRef.current;
        mutedRef.current = next;
        sound.setMuted(next);
        setMuted(next);
      }
      if (e.code === "Enter" && !e.repeat && game.state !== "playing") {
        sound.init();
        game.start();
        sound.setMuted(sound.muted);
      }
    };
    const onKeyUp = (e) => {
      const k = KEYS[e.code];
      if (k) game.input[k] = false;
    };
    const onBlur = () => {
      game.input = { up: false, down: false, left: false, right: false, fire: false };
      if (game.state === "playing") game.state = "paused";
    };
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const handleStart = () => {
    sound.init();
    sound.setMuted(muted);
    gameRef.current.start();
    syncHud();
  };

  const handleResume = () => {
    if (gameRef.current.state === "paused") gameRef.current.state = "playing";
    syncHud();
  };

  const toggleMute = () => {
    const next = !muted;
    mutedRef.current = next;
    setMuted(next);
    sound.setMuted(next);
    sound.init();
  };

  return (
    <div className="container">
      <h1 className="title">皮 皮 虾 大 战</h1>

      <div className="hud">
        <span>关卡 <b>{hud.level}</b></span>
        <span>分数 <b>{hud.score}</b></span>
        <span>敌军 <b>{hud.enemies}</b></span>
        <span>生命 <b>{"♥".repeat(hud.lives) || "—"}</b></span>
        <button className="icon-btn" onClick={toggleMute} title="静音 (M)">
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      <div className="game-wrapper">
        <canvas ref={canvasRef} />

        {hud.state === "ready" && (
          <div className="overlay">
            <h2>皮皮虾大战</h2>
            <p>消灭所有敌军皮皮虾，保护基地！</p>
            <button onClick={handleStart}>开始游戏</button>
            <p className="small">方向键 / WASD 移动 · 空格 开火 · P 暂停</p>
          </div>
        )}

        {hud.state === "paused" && (
          <div className="overlay">
            <h2>已暂停</h2>
            <p>当前分数 {hud.score}</p>
            <button onClick={handleResume}>继续游戏</button>
            <p className="small">按 P 继续 · 按 Enter 重新开始</p>
          </div>
        )}

        {hud.state === "gameover" && (
          <div className="overlay">
            <h2>游戏结束</h2>
            <p>最终得分 {hud.score} · 到达第 {hud.level} 关</p>
            <button onClick={handleStart}>再来一局</button>
            <p className="small">按 Enter 重新开始</p>
          </div>
        )}
      </div>

      <div className="hint">
        <kbd>↑↓←→</kbd> / <kbd>WASD</kbd> 移动 · <kbd>空格</kbd> 开火 ·{" "}
        <kbd>P</kbd> 暂停 · <kbd>M</kbd> 静音
      </div>
    </div>
  );
}
