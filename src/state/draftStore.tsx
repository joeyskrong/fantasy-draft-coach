import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DraftState, HighlightColor, LeagueSettings, Player, Screen } from "../types";
import { PLAYER_POOL } from "../data/players";
import { defaultSettings } from "../data/defaults";
import { buildBoard, firstOpenOverall } from "../engine/draftOrder";
import { cpuPick } from "../engine/recommend";

const STORAGE_KEY = "fdc.draft.v2";

function uid(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function clonePlayers(): Player[] {
  return PLAYER_POOL.map((p) => ({ ...p, stats: { ...p.stats }, handcuffIds: [...p.handcuffIds] }));
}

export function createDraft(settings: LeagueSettings, players = clonePlayers()): DraftState {
  const picks = buildBoard(settings);
  return {
    id: uid(),
    settings,
    players,
    picks,
    currentOverall: firstOpenOverall(picks),
    highlights: {},
    createdAt: new Date().toISOString(),
  };
}

type Store = {
  screen: Screen;
  settings: LeagueSettings;
  draft: DraftState | null;
  setScreen: (s: Screen) => void;
  setSettings: (s: LeagueSettings) => void;
  startDraft: (s?: LeagueSettings) => void;
  pickPlayer: (playerId: string) => void;
  undo: () => void;
  resetDraft: () => void;
  mockToMe: () => void;
  mockRest: () => void;
  highlight: (playerId: string, color: HighlightColor | null) => void;
  updatePlayer: (playerId: string, patch: Partial<Player>) => void;
  loadDraft: (d: DraftState) => void;
};

const Ctx = createContext<Store | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>("home");
  const [settings, setSettings] = useState<LeagueSettings>(defaultSettings);
  const [draft, setDraft] = useState<DraftState | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { screen: Screen; settings: LeagueSettings; draft: DraftState | null };
      if (parsed.settings) setSettings(parsed.settings);
      if (parsed.draft) {
        setDraft(parsed.draft);
        setScreen(parsed.screen === "home" ? "draft" : parsed.screen);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ screen, settings, draft }));
  }, [screen, settings, draft]);

  const api = useMemo<Store>(
    () => ({
      screen,
      settings,
      draft,
      setScreen,
      setSettings,
      startDraft: (s) => {
        const next = createDraft(s ?? settings);
        setSettings(next.settings);
        setDraft(next);
        setScreen("draft");
      },
      pickPlayer: (playerId) => {
        setDraft((prev) => {
          if (!prev) return prev;
          const idx = prev.picks.findIndex((p) => p.overall === prev.currentOverall && !p.playerId);
          if (idx < 0) return prev;
          const picks = prev.picks.map((p, i) => (i === idx ? { ...p, playerId } : p));
          return { ...prev, picks, currentOverall: firstOpenOverall(picks) };
        });
      },
      undo: () => {
        setDraft((prev) => {
          if (!prev) return prev;
          const last = [...prev.picks].reverse().find((p) => p.playerId && !p.keeper);
          if (!last) return prev;
          const picks = prev.picks.map((p) => (p.overall === last.overall ? { ...p, playerId: null } : p));
          return { ...prev, picks, currentOverall: firstOpenOverall(picks) };
        });
      },
      resetDraft: () => {
        setDraft((prev) => {
          if (!prev) return prev;
          const picks = prev.picks.map((p) => (p.keeper ? p : { ...p, playerId: null }));
          return { ...prev, picks, currentOverall: firstOpenOverall(picks), highlights: {} };
        });
      },
      mockToMe: () => {
        setDraft((prev) => {
          if (!prev) return prev;
          let next = prev;
          while (true) {
            const pick = next.picks.find((p) => p.overall === next.currentOverall);
            if (!pick || pick.teamIndex === next.settings.userPick) break;
            const taken = new Set(next.picks.filter((p) => p.playerId).map((p) => p.playerId as string));
            const available = next.players.filter((p) => !taken.has(p.id));
            if (!available.length) break;
            const cpu = cpuPick(available, next.settings.scoring);
            const picks = next.picks.map((p) => (p.overall === next.currentOverall ? { ...p, playerId: cpu.id } : p));
            next = { ...next, picks, currentOverall: firstOpenOverall(picks) };
          }
          return next;
        });
      },
      mockRest: () => {
        setDraft((prev) => {
          if (!prev) return prev;
          let next = prev;
          for (let i = 0; i < 400; i++) {
            const pick = next.picks.find((p) => p.overall === next.currentOverall);
            if (!pick) break;
            const taken = new Set(next.picks.filter((p) => p.playerId).map((p) => p.playerId as string));
            const available = next.players.filter((p) => !taken.has(p.id));
            if (!available.length) break;
            const cpu = cpuPick(available, next.settings.scoring);
            const picks = next.picks.map((p) => (p.overall === next.currentOverall ? { ...p, playerId: cpu.id } : p));
            next = { ...next, picks, currentOverall: firstOpenOverall(picks) };
          }
          return next;
        });
      },
      highlight: (playerId, color) => {
        setDraft((prev) => {
          if (!prev) return prev;
          const highlights = { ...prev.highlights };
          if (!color) delete highlights[playerId];
          else highlights[playerId] = color;
          return { ...prev, highlights };
        });
      },
      updatePlayer: (playerId, patch) => {
        setDraft((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map((p) => (p.id === playerId ? { ...p, ...patch, stats: patch.stats ?? p.stats } : p)),
          };
        });
      },
      loadDraft: (d) => {
        setDraft(d);
        setSettings(d.settings);
        setScreen("draft");
      },
    }),
    [screen, settings, draft],
  );

  return createElement(Ctx.Provider, { value: api }, children);
}

export function useDraft() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDraft must be used within DraftProvider");
  return ctx;
}
