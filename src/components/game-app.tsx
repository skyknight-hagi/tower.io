import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import {
  Coins,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Combine,
  ArrowUp,
  Package,
  Lock,
  LockOpen,
} from "lucide-react";
import { GameEngine } from "@/game/engine";
import { hitCell, hitWorld, render, resizeCanvas } from "@/game/render";
import { isMuted, preloadAssets, resumeAudio, sfx, toggleMute, unlockAudio } from "@/game/audio";
import {
  axeFrenzyOn,
  barracksCap,
  CHAPTERS,
  DAMAGE_LABEL,
  DMG_UP,
  ENDLESS_ID,
  enemySkin,
  investedCost,
  RATE_UP,
  SELL_RATIO,
  TOWERS,
  towerDamage,
  towerRange,
  towerRate,
  TYPE_HINT,
  upgradeCost,
  vaultPayout,
  WAVES_PER_CHAPTER,
} from "@/game/config";
import type { ChapterInfo, EnemyInspect, HudSnap, Tower, TowerType } from "@/game/types";
import { cn } from "@/lib/utils";

let engineSingleton: GameEngine | null = null;
function getEngine() {
  if (!engineSingleton) engineSingleton = new GameEngine();
  return engineSingleton;
}

const DRAG_PX = 10;

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    towerId: number | null;
    moved: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  const engine = getEngine();
  const version = useSyncExternalStore(
    (cb) => engine.on(cb),
    () => engine.ui,
    () => 0,
  );
  const snap = engine.snapshot();
  void version;

  useEffect(() => {
    if (engine.screen !== "loading") return;
    let live = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    void (async () => {
      engine.setLoad(8, "Preparing the keep");
      const audio = preloadAssets();
      const steps: [number, string][] = [
        [36, "Bestiary"],
        [64, "Path plans"],
        [88, "Ready"],
      ];
      for (const [pct, label] of steps) {
        if (!live || engine.screen !== "loading") return;
        engine.setLoad(pct, label);
        await wait(40);
      }
      await Promise.race([audio, wait(280)]);
      if (live && engine.screen === "loading") {
        engine.setLoad(100, "Ready");
        engine.finishLoading();
      }
    })();
    return () => {
      live = false;
    };
  }, [engine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const onResize = () => resizeCanvas(canvas);
    onResize();
    const ro = new ResizeObserver(onResize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      engine.update(dt);
      render(ctx, engine);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const vis = () => {
      if (document.visibilityState === "visible") resumeAudio();
    };
    document.addEventListener("visibilitychange", vis);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (engine.screen === "playing") engine.pause();
        else if (engine.screen === "paused") engine.resume();
      }
      if (e.key === " " && engine.screen === "playing" && engine.phase === "prep") {
        e.preventDefault();
        engine.startWave();
      }
    };
    window.addEventListener("keydown", key);
    (window as unknown as { __game: GameEngine }).__game = engine;
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("keydown", key);
    };
  }, [engine]);

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || engine.screen !== "playing" || engine.shopPrompt) return;
    canvas.setPointerCapture(e.pointerId);
    const cell = hitCell(canvas, e.clientX, e.clientY);
    const occ = cell
      ? engine.towers.find((t) => t.placed && t.col === cell.col && t.row === cell.row)
      : undefined;
    dragRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      towerId: occ?.id ?? null,
      moved: false,
    };
    setDragging(false);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cell = hitCell(canvas, e.clientX, e.clientY);
    if (cell) engine.setHover(cell.col, cell.row);
    else engine.setHover(-1, -1);
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
    if (!drag.moved && dist >= DRAG_PX) {
      drag.moved = true;
      if (drag.towerId != null) {
        engine.setDrag(drag.towerId);
        engine.selectField(drag.towerId);
        setDragging(true);
      }
    }
  }

  function endPointer(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const drag = dragRef.current;
    if (canvas && drag && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    engine.setDrag(null);
    setDragging(false);
    if (engine.screen !== "playing" || engine.shopPrompt) return;
    const cell = canvas ? hitCell(canvas, e.clientX, e.clientY) : null;
    if (drag.moved && drag.towerId != null) {
      if (cell) engine.tryMove(drag.towerId, cell.col, cell.row);
      else sfx("deny");
      return;
    }
    if (drag.moved) return;
    const world = canvas ? hitWorld(canvas, e.clientX, e.clientY) : null;
    if (world && engine.selectedInv == null && drag.towerId == null) {
      const enemy = engine.enemyAt(world.x, world.y);
      if (enemy) {
        engine.inspectEnemy(enemy.id);
        return;
      }
    }
    if (drag.towerId != null) {
      engine.selectField(drag.towerId);
      return;
    }
    if (!cell) {
      engine.selectField(null);
      return;
    }
    if (engine.selectedInv != null) {
      engine.tryPlace(cell.col, cell.row);
      return;
    }
    engine.selectField(null);
  }

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-bg text-fg">
      <Hud snap={snap} engine={engine} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[220px] flex-1 touch-none">
          <canvas
            ref={canvasRef}
            className={cn("block h-full w-full", dragging ? "cursor-grabbing" : "cursor-grab")}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
          />
          {snap.screen === "playing" && (snap.selectedInv != null || dragging) && (
            <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-surface/90 px-4 py-2 text-sm text-muted">
              Drop on a matching tower to merge, or a clear tile
            </p>
          )}
        </div>
        <SidePanel snap={snap} engine={engine} />
      </div>
      {snap.screen !== "playing" && <ScreenOverlay snap={snap} engine={engine} />}
      {snap.screen === "playing" && snap.shopPrompt && <ShopLockPrompt engine={engine} />}
    </div>
  );
}

function Hud({ snap, engine }: { snap: HudSnap; engine: GameEngine }) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 sm:gap-4 sm:px-4">
      <div className="font-display text-xl tracking-tight sm:text-2xl">Rampart</div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Stat icon={<Heart className="size-3.5 text-danger" />} value={`${snap.lives}`} label="Lives" />
        {snap.screen === "playing" && (
          <button
            type="button"
            disabled={snap.lives >= snap.maxLives || snap.gold < snap.healCost}
            onClick={() => engine.heal()}
            className="h-11 shrink-0 rounded-full border border-border bg-surface px-3 text-sm text-fg disabled:opacity-40"
          >
            Heal {snap.healCost}G
          </button>
        )}
        <Stat icon={<Coins className="size-3.5 text-gold" />} value={`${snap.gold}`} label="Gold" />
        <Stat
          icon={<Play className="size-3.5 text-muted" />}
          value={
            snap.wave === 0
              ? "Prep"
              : snap.endless
                ? `${snap.wave}`
                : `${snap.wave}/${snap.totalWaves}`
          }
          label={
            snap.endless
              ? "Endless"
              : snap.screen === "playing" || snap.screen === "paused"
                ? `Ch. ${snap.chapter + 1}`
                : "Wave"
          }
        />
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full border border-border bg-surface text-fg"
          onClick={() => {
            toggleMute();
            engine.refresh();
          }}
          aria-label={isMuted() ? "Unmute" : "Mute"}
        >
          {isMuted() ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
        {snap.screen === "playing" && (
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-border bg-surface"
            onClick={() => engine.pause()}
            aria-label="Pause"
          >
            <Pause className="size-4" />
          </button>
        )}
      </div>
    </header>
  );
}

function Stat({ icon, value, label }: { icon: import("react").ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-1.5">
      {icon}
      <div className="leading-none">
        <div className="text-base font-medium tabular-nums">{value}</div>
        <div className="text-xs text-subtle">{label}</div>
      </div>
    </div>
  );
}

function SidePanel({ snap, engine }: { snap: HudSnap; engine: GameEngine }) {
  const selected =
    snap.selectedField != null
      ? engine.fieldTower(snap.selectedField)
      : snap.selectedInv != null
        ? (engine.towers.find((t) => t.id === snap.selectedInv) ?? null)
        : null;
  const playing = snap.screen === "playing";

  return (
    <aside className="flex max-h-[50vh] shrink-0 flex-col gap-3 overflow-y-auto border-t border-border bg-surface p-3 lg:max-h-none lg:w-96 lg:border-t-0 lg:border-l">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-subtle">
            {snap.phase === "combat" ? "This wave" : "Next wave"}
          </div>
          <div className="text-base font-medium">{snap.wavePreview}</div>
        </div>
        <button
          type="button"
          disabled={!playing || snap.phase !== "prep" || snap.shopPrompt}
          onClick={() => {
            unlockAudio();
            engine.startWave();
          }}
          className="h-12 rounded-3xl bg-accent px-4 text-base font-medium text-accent-fg disabled:opacity-40"
        >
          {snap.phase === "combat"
            ? `Left ${snap.enemiesLeft}`
            : "Start wave"}
        </button>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium tracking-wide text-muted">Shop</h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!playing}
              onClick={() => engine.toggleShopLock()}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-sm disabled:opacity-40",
                snap.shopLocked
                  ? "border-accent bg-surface-2 text-fg"
                  : "border-border bg-bg text-muted",
              )}
              aria-pressed={snap.shopLocked}
              aria-label={snap.shopLocked ? "Unlock restock" : "Lock restock"}
            >
              {snap.shopLocked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
              {snap.shopLocked ? "Locked" : "Lock"}
            </button>
            <button
              type="button"
              disabled={!playing || snap.gold < snap.restockCost}
              onClick={() => engine.restock()}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border px-3 text-sm text-fg disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" />
              Restock {snap.restockCost}
            </button>
          </div>
        </div>
        <p className="mb-2 text-sm leading-snug text-subtle">
          After each wave we ask whether to lock the shop. Lock keeps it; otherwise it restocks.
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {snap.shop.map((slot, i) => (
            <ShopSlotCard
              key={i}
              type={slot?.type ?? null}
              gold={snap.gold}
              disabled={!playing}
              onBuy={() => engine.buy(i)}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm font-medium tracking-wide text-muted">
            <Package className="size-4" />
            Bench {snap.inventory.length}/8
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm tabular-nums text-subtle">
              Placed {snap.placedCount}/{snap.slotCap}
            </span>
            <button
              type="button"
              disabled={!playing || snap.slotCost == null || snap.gold < (snap.slotCost ?? 0)}
              onClick={() => engine.expandSlots()}
              className="inline-flex h-10 items-center rounded-full border border-border px-3 text-sm disabled:opacity-40"
            >
              {snap.slotCost == null ? "Max slots" : `+1 slot · ${snap.slotCost}G`}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => {
            const t = snap.inventory[i];
            return (
              <button
                key={t ? t.id : `empty-${i}`}
                type="button"
                disabled={!t || !playing}
                onClick={() => t && engine.selectInv(t.id)}
                className={cn(
                  "min-h-14 rounded-2xl border text-sm font-medium",
                  t
                    ? snap.selectedInv === t.id
                      ? "border-accent bg-surface-2 text-fg"
                      : "border-border bg-bg text-fg"
                    : "border-border/60 bg-bg/40 text-subtle",
                )}
              >
                {t ? (
                  <span className="flex h-full flex-col items-center justify-center gap-0.5">
                    <span style={{ color: typeColor(t.type) }}>{TOWERS[t.type].name}</span>
                    <span className="text-subtle">{t.star}★</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {snap.merges.length > 0 && (
        <section className="rounded-3xl border border-border bg-bg p-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm text-muted">
            <Combine className="size-4" />
            Ready to merge
          </div>
          <div className="flex flex-col gap-1">
            {snap.merges.map((m) => (
              <button
                key={`${m.type}-${m.star}`}
                type="button"
                disabled={!playing}
                onClick={() => engine.merge(m.type, m.star)}
                className="flex h-12 items-center justify-between rounded-full bg-surface-2 px-3 text-sm"
              >
                <span>
                  {TOWERS[m.type].name} {m.star}★ ×{m.count}
                </span>
                <span className="text-accent">to {m.star + 1}★</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {snap.inspected && <EnemyPanel info={snap.inspected} />}
      {selected && <Inspector tower={selected} gold={snap.gold} playing={playing} engine={engine} />}
    </aside>
  );
}

function ShopSlotCard({
  type,
  gold,
  disabled,
  onBuy,
}: {
  type: TowerType | null;
  gold: number;
  disabled: boolean;
  onBuy: () => void;
}) {
  if (!type) {
    return <div className="h-28 rounded-3xl border border-dashed border-border bg-bg/50" />;
  }
  const def = TOWERS[type];
  const can = gold >= def.cost && !disabled;
  return (
    <button
      type="button"
      disabled={!can}
      onClick={onBuy}
      className="flex h-28 flex-col items-start justify-between rounded-3xl border border-border bg-bg p-2.5 text-left disabled:opacity-40"
    >
      <span className="text-sm font-medium" style={{ color: typeColor(type) }}>
        {def.name}
      </span>
      <span className="text-xs leading-tight text-subtle">{def.kind}</span>
      <span className="text-sm font-medium tabular-nums">{def.cost}</span>
    </button>
  );
}

function EnemyPanel({ info }: { info: EnemyInspect }) {
  const ratio = Math.max(0, info.hp / info.maxHp);
  return (
    <section className="rounded-3xl border border-border bg-bg p-3">
      <div className="text-base font-medium">{info.name}</div>
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between text-sm text-muted">
          <span>HP</span>
          <span className="tabular-nums text-fg">
            {Math.ceil(info.hp)} / {info.maxHp}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn("h-full rounded-full", ratio > 0.45 ? "bg-good" : "bg-danger")}
            style={{ width: `${Math.max(2, ratio * 100)}%` }}
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 text-sm">
        <div className="rounded-2xl border border-border bg-surface p-2.5">
          <div className="text-xs text-muted">Attack</div>
          <div className="mt-0.5 font-medium tabular-nums">{info.atk}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-2.5">
          <div className="text-xs text-muted">Rate</div>
          <div className="mt-0.5 font-medium tabular-nums">{info.atkRate.toFixed(2)}/s</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-2.5">
          <div className="text-xs text-good">2x damage</div>
          <div className="mt-0.5 font-medium">{info.weak.length ? info.weak.join(" · ") : "None"}</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-2.5">
          <div className="text-xs text-danger">Half</div>
          <div className="mt-0.5 font-medium">{info.resist.length ? info.resist.join(" · ") : "None"}</div>
        </div>
      </div>
    </section>
  );
}

function Inspector({
  tower,
  gold,
  playing,
  engine,
}: {
  tower: Tower;
  gold: number;
  playing: boolean;
  engine: GameEngine;
}) {
  const def = TOWERS[tower.type];
  const dmgCost = tower.dmgUp < 3 ? upgradeCost(tower.star, tower.dmgUp + 1) : null;
  const rateCost = tower.rateUp < 3 ? upgradeCost(tower.star, tower.rateUp + 1) : null;
  const sell = Math.round(investedCost(tower.type, tower.star, tower.dmgUp, tower.rateUp) * SELL_RATIO);
  const dmg = towerDamage(tower);
  const range = towerRange(tower);
  const rate = towerRate(tower);

  return (
    <section className="rounded-3xl border border-border bg-bg p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-base font-medium">
            {def.name} · {tower.star}★
          </div>
          <div className="text-sm text-muted">
            {DAMAGE_LABEL[def.damageType]} · {TYPE_HINT[tower.type]}
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-subtle">{def.desc}</p>
      {engine.phase === "combat" && axeFrenzyOn(tower) && (
        <p className="mt-1 text-sm text-warn">Frenzy · 5× attack speed</p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
        <div className="rounded-2xl border border-border bg-surface p-2.5">
          <div className="text-xs text-subtle">
            {tower.type === "vault" ? "Payout" : tower.type === "barracks" ? "Soldier dmg" : "Damage"}
          </div>
          <div className="mt-0.5 font-medium tabular-nums">
            {tower.type === "vault" ? `+${vaultPayout(tower)}G` : Math.round(dmg)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-2.5">
          <div className="text-xs text-subtle">
            {tower.type === "vault" ? "Interval" : tower.type === "barracks" ? "Cap" : "Range"}
          </div>
          <div className="mt-0.5 font-medium tabular-nums">
            {tower.type === "vault"
              ? `${(1 / Math.max(0.08, rate)).toFixed(1)}s`
              : tower.type === "barracks"
                ? `${barracksCap(tower.star)} · range ${range.toFixed(1)}`
                : range.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <UpgradeBtn
          label={tower.type === "barracks" ? "Soldiers" : "Damage"}
          level={tower.dmgUp}
          mul={DMG_UP[tower.dmgUp]}
          cost={dmgCost}
          gold={gold}
          disabled={!playing}
          onClick={() => engine.upgrade(tower.id, "dmg")}
        />
        <UpgradeBtn
          label={tower.type === "barracks" ? "Spawn" : "Rate"}
          level={tower.rateUp}
          mul={RATE_UP[tower.rateUp]}
          cost={rateCost}
          gold={gold}
          disabled={!playing}
          onClick={() => engine.upgrade(tower.id, "rate")}
        />
      </div>
      <div className="mt-2 flex gap-1.5">
        {tower.placed && (
          <button
            type="button"
            disabled={!playing}
            onClick={() => engine.pickup(tower.id)}
            className="h-11 flex-1 rounded-full border border-border text-sm"
          >
            Pick up
          </button>
        )}
        <button
          type="button"
          disabled={!playing}
          onClick={() => engine.sell(tower.id)}
          className="h-11 flex-1 rounded-full border border-border text-sm text-danger"
        >
          Sell {sell}
        </button>
      </div>
    </section>
  );
}

function UpgradeBtn({
  label,
  level,
  mul,
  cost,
  gold,
  disabled,
  onClick,
}: {
  label: string;
  level: number;
  mul: number;
  cost: number | null;
  gold: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const maxed = cost == null;
  const can = !disabled && !maxed && gold >= (cost ?? 0);
  return (
    <button
      type="button"
      disabled={!can}
      onClick={onClick}
      className="flex min-h-20 flex-col items-start justify-between rounded-2xl border border-border bg-surface p-2.5 text-left disabled:opacity-40"
    >
      <span className="inline-flex items-center gap-1 text-sm text-muted">
        <ArrowUp className="size-3.5" />
        {label} {level}/3
      </span>
      <span className="text-sm tabular-nums">×{mul.toFixed(2)}</span>
      <span className="text-sm text-subtle">{maxed ? "Max" : `${cost}G`}</span>
    </button>
  );
}

function ScreenOverlay({ snap, engine }: { snap: HudSnap; engine: GameEngine }) {
  if (snap.screen === "loading") {
    const pct = Math.round(snap.loadProgress);
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg p-6">
        <div className="w-full max-w-sm">
          <p className="text-sm tracking-[0.18em] text-muted">TOWER DEFENSE</p>
          <h1 className="font-display mt-1 text-4xl leading-none">Rampart</h1>
          <p className="mt-2 text-base text-muted">{snap.loadLabel}</p>
          <div className="mt-8">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm text-subtle">Loading</span>
              <span className="font-display text-2xl tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (snap.screen === "chapters") {
    return (
      <div className="absolute inset-0 z-20 overflow-y-auto bg-bg/85 p-3 backdrop-blur-[2px]">
        <div className="flex min-h-full items-center justify-center py-3">
        <div className="w-full max-w-xl rounded-3xl border border-border bg-surface px-4 py-5 shadow-lg sm:px-5 sm:py-6">
          <p className="text-sm tracking-[0.18em] text-muted">TOWER DEFENSE</p>
          <h1 className="font-display mt-1 text-3xl leading-none sm:text-4xl">Rampart</h1>
          <p className="mt-1.5 text-base text-muted">
            Each chapter is {WAVES_PER_CHAPTER} stages. Endless Watch is open anytime.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {snap.chapters.map((ch) => (
              <ChapterCard
                key={ch.id}
                chapter={ch}
                onSelect={() => {
                  unlockAudio();
                  sfx("click");
                  engine.startGame(ch.id);
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              unlockAudio();
              sfx("click");
              engine.startGame(ENDLESS_ID);
            }}
            className="mt-2 flex min-h-16 w-full flex-col items-start rounded-3xl border border-border bg-bg p-3 text-left"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-sm text-subtle">Endless</span>
              <span className="text-sm text-good">Open</span>
            </div>
            <div className="mt-1 font-display text-2xl leading-none">Endless Watch</div>
            <div className="mt-1 text-sm text-muted">
              Foes grow in number and strength each stage.
            </div>
          </button>
          <TypeChart />
        </div>
        </div>
      </div>
    );
  }

  if (snap.screen === "paused") {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/70 p-4">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6">
          <h2 className="font-display text-3xl">Paused</h2>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              className="h-14 rounded-3xl bg-accent text-base font-medium text-accent-fg"
              onClick={() => engine.resume()}
            >
              Resume
            </button>
            <button
              type="button"
              className="h-14 rounded-3xl border border-border text-base"
              onClick={() => {
                unlockAudio();
                engine.startGame(snap.endless ? ENDLESS_ID : snap.chapter);
              }}
            >
              Restart
            </button>
            <button
              type="button"
              className="h-14 rounded-3xl border border-border text-base"
              onClick={() => engine.openChapters()}
            >
              Chapters
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (snap.screen === "won" || snap.screen === "lost") {
    const won = snap.screen === "won";
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/80 p-4">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6">
          <p className="text-sm tracking-[0.18em] text-muted">{won ? "CLEAR" : "FALLEN"}</p>
          <h2 className="font-display mt-1 text-3xl">{won ? "The keep holds" : "The gate fell"}</h2>
          <p className="mt-2 text-base text-muted">
            {won
              ? `${snap.chapterName} · held ${snap.endless ? `${snap.wave} waves` : `${snap.totalWaves} stages`}.`
              : `${snap.chapterName} · out of lives on stage ${snap.wave}.`}
          </p>
          {won && snap.chapter === 3 && !snap.endless && (
            <p className="mt-1 text-base text-good">Endless Watch is open anytime.</p>
          )}
          <p className="mt-1 text-base text-subtle">Gold left {snap.gold}</p>
          <div className="mt-5 flex flex-col gap-2">
            {won && snap.chapter === 3 && !snap.endless && (
              <button
                type="button"
                className="h-14 w-full rounded-3xl bg-accent text-base font-medium text-accent-fg"
                onClick={() => {
                  unlockAudio();
                  engine.startGame(ENDLESS_ID);
                }}
              >
                Endless
              </button>
            )}
            {won && snap.chapter + 1 < snap.chapters.length && snap.chapters[snap.chapter + 1]?.unlocked && (
              <button
                type="button"
                className="h-14 w-full rounded-3xl bg-accent text-base font-medium text-accent-fg"
                onClick={() => {
                  unlockAudio();
                  engine.startGame(snap.chapter + 1);
                }}
              >
                Next chapter
              </button>
            )}
            <button
              type="button"
              className={cn(
                "h-14 w-full rounded-3xl text-base font-medium",
                (won && snap.chapter + 1 < snap.chapters.length && snap.chapters[snap.chapter + 1]?.unlocked) ||
                  (won && snap.chapter === 3 && !snap.endless)
                  ? "border border-border"
                  : "bg-accent text-accent-fg",
              )}
              onClick={() => {
                unlockAudio();
                if (won) engine.openChapters();
                else engine.startGame(snap.endless ? ENDLESS_ID : snap.chapter);
              }}
            >
              {won ? "Chapters" : "Retry"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function ChapterCard({
  chapter,
  onSelect,
}: {
  chapter: ChapterInfo;
  onSelect: () => void;
}) {
  const skins = CHAPTERS[chapter.id]?.enemies;
  return (
    <button
      type="button"
      disabled={!chapter.unlocked}
      onClick={onSelect}
      className={cn(
        "flex min-h-20 flex-col items-start rounded-3xl border p-3 text-left",
        chapter.unlocked ? "border-border bg-bg" : "border-border/70 bg-bg/50 opacity-50",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-sm text-subtle">
          Ch. {chapter.id + 1} · {WAVES_PER_CHAPTER} stages
        </span>
        {!chapter.unlocked ? (
          <Lock className="size-4 text-subtle" />
        ) : chapter.cleared ? (
          <span className="text-sm text-good">Cleared</span>
        ) : (
          <span className="text-sm text-muted">Open</span>
        )}
      </div>
      <div className="mt-1 font-display text-2xl leading-none">{chapter.name}</div>
      <div className="mt-1 text-sm text-muted">{chapter.subtitle}</div>
      {skins && (
        <div className="mt-3 flex gap-1">
          {(Object.keys(skins) as Array<keyof typeof skins>).map((k) => (
            <span
              key={k}
              className="size-2.5 rounded-full border border-border"
              style={{ background: skins[k].fill }}
              title={skins[k].name}
            />
          ))}
        </div>
      )}
    </button>
  );
}

function TypeChart() {
  const rows = [
    ["Footman", "2x", "—", "—", "½"],
    ["Swarm", "—", "2x", "—", "2x"],
    ["Armor", "½", "2x", "—", "—"],
    ["Wisp", "½", "½", "2x", "2x"],
    ["Warden", "½", "2x", "—", "—"],
  ];
  return (
    <div className="mt-3 overflow-hidden rounded-3xl border border-border">
      <table className="w-full text-center text-xs sm:text-sm">
        <thead className="bg-bg text-subtle">
          <tr>
            <th className="px-2 py-1.5 font-medium">Foe</th>
            <th className="px-2 py-1.5 font-medium">Phys</th>
            <th className="px-2 py-1.5 font-medium">Blast</th>
            <th className="px-2 py-1.5 font-medium">Hex</th>
            <th className="px-2 py-1.5 font-medium">Magic</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-t border-border">
              {r.map((c, i) => (
                <td
                  key={i}
                  className={cn(
                    "px-2 py-1.5",
                    c === "2x" && "text-good",
                    c === "½" && "text-danger",
                    i === 0 && "text-left text-muted",
                  )}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShopLockPrompt({ engine }: { engine: GameEngine }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/70 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6">
        <h2 className="font-display text-3xl">Shop</h2>
        <p className="mt-2 text-base text-muted">Lock the shop?</p>
        <p className="mt-1 text-sm text-subtle">Lock keeps this stock. Otherwise it restocks.</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="h-14 rounded-3xl bg-accent text-base font-medium text-accent-fg"
            onClick={() => engine.answerShopLock(true)}
          >
            Lock
          </button>
          <button
            type="button"
            className="h-14 rounded-3xl border border-border text-base"
            onClick={() => engine.answerShopLock(false)}
          >
            Restock
          </button>
        </div>
      </div>
    </div>
  );
}

function typeColor(type: TowerType) {
  switch (type) {
    case "crossbow":
    case "laser":
    case "axeman":
    case "barracks":
      return "var(--color-physical)";
    case "mortar":
      return "var(--color-explosive)";
    case "shaman":
      return "var(--color-shaman)";
    case "vault":
      return "var(--color-gold)";
    default:
      return "var(--color-magic)";
  }
}
