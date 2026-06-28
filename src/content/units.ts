/**
 * Catalogue data-driven des types d'unités (Phase 2).
 *
 * Toutes partagent le spritesheet « survivor » pour l'instant (un seul jeu d'anims
 * intégré) ; elles se distinguent par leurs STATS et une teinte de rôle côté joueur.
 * Les ennemis ignorent la teinte de rôle (toujours rouges).
 *
 * `range` ≥ ~120 px ⇒ unité « à distance » (feedback visuel de tir).
 */

export interface UnitDef {
  id: string;
  name: string;
  /** Base d'animation (préfixe des clés d'anim, ex. "surv"). */
  animBase: string;
  /** Touche de production quand une caserne est sélectionnée. */
  hotkey: string;
  /** Coût en ferraille. */
  cost: number;
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
}

export const UNITS: Record<string, UnitDef> = {
  scout: {
    id: "scout",
    name: "Récupérateur",
    animBase: "surv",
    hotkey: "R",
    cost: 20,
    buildTime: 2500,
    maxHp: 45,
    speed: 300,
    damage: 6,
    range: 90,
    attackCd: 600,
    tint: 0xb9f0c4,
  },
  rifle: {
    id: "rifle",
    name: "Fusilier",
    animBase: "surv",
    hotkey: "F",
    cost: 35,
    buildTime: 4000,
    maxHp: 70,
    speed: 230,
    damage: 12,
    range: 155,
    attackCd: 750,
    tint: 0xffe8b0,
  },
  heavy: {
    id: "heavy",
    name: "Costaud",
    animBase: "surv",
    hotkey: "V",
    cost: 60,
    buildTime: 6000,
    maxHp: 140,
    speed: 165,
    damage: 22,
    range: 95,
    attackCd: 1000,
    tint: 0xb8ccff,
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
