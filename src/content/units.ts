/**
 * Catalogue data-driven des types d'unités (Phase 2).
 *
 * Toutes partagent le spritesheet « survivor » pour l'instant (un seul jeu d'anims
 * intégré) ; elles se distinguent par leurs STATS et une teinte de rôle côté joueur.
 * Les ennemis ignorent la teinte de rôle (toujours rouges).
 *
 * `range` ≥ ~120 px ⇒ unité « à distance » (feedback visuel de tir).
 */

import type { Cost } from "@/content/resources";

export interface UnitDef {
  id: string;
  name: string;
  /** Base d'animation (préfixe des clés d'anim, ex. "surv"). */
  animBase: string;
  /** Touche de production quand une caserne est sélectionnée. */
  hotkey: string;
  /** Coût en ressources (ferraille + éventuellement carburant/eau). */
  cost: Cost;
  /** Temps de production (ms). */
  buildTime: number;
  maxHp: number;
  /** Vitesse de déplacement (px/s). */
  speed: number;
  damage: number;
  /** Portée d'attaque (px). */
  range: number;
  /** Délai entre deux coups (ms). */
  attackCd: number;
  /** Teinte de rôle (sprite joueur). */
  tint?: number;
  /** Multiplicateur de taille du sprite (silhouette distincte malgré le spritesheet partagé). */
  scale: number;
  /** Forme du badge affiché au-dessus de l'unité (identification rapide). */
  badge: "circle" | "square" | "diamond";
}

export const UNITS: Record<string, UnitDef> = {
  scout: {
    id: "scout",
    name: "Récupérateur",
    animBase: "surv",
    hotkey: "R",
    cost: { scrap: 20, fuel: 5 },
    buildTime: 2500,
    maxHp: 45,
    speed: 300,
    damage: 6,
    range: 90,
    attackCd: 600,
    tint: 0xb9f0c4,
    scale: 0.85,
    badge: "circle",
  },
  rifle: {
    id: "rifle",
    name: "Fusilier",
    animBase: "surv",
    hotkey: "F",
    cost: { scrap: 35, water: 5 },
    buildTime: 4000,
    maxHp: 70,
    speed: 230,
    damage: 12,
    range: 155,
    attackCd: 750,
    tint: 0xffe8b0,
    scale: 1,
    badge: "square",
  },
  heavy: {
    id: "heavy",
    name: "Costaud",
    animBase: "surv",
    hotkey: "V",
    cost: { scrap: 60, fuel: 15, water: 5 },
    buildTime: 6000,
    maxHp: 140,
    speed: 165,
    damage: 22,
    range: 95,
    attackCd: 1000,
    tint: 0xb8ccff,
    scale: 1.25,
    badge: "diamond",
  },
};

export const UNIT_LIST = Object.values(UNITS);

export function unitByHotkey(key: string): UnitDef | undefined {
  return UNIT_LIST.find((u) => u.hotkey === key);
}

/** Une unité à distance (déclenche un FX de tir). */
export function isRanged(def: UnitDef): boolean {
  return def.range >= 120;
}
