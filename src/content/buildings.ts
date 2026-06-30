/**
 * Catalogue data-driven des bâtiments (Phase 2).
 *
 * Convention projet : le contenu de jeu (footprint, coûts, stats) vit ici, pas en
 * dur dans la logique. La scène lit ce catalogue pour le mode construction.
 *
 * `cols`/`rows` = footprint (en cases) bloqué sur la grille de navigation.
 * `ox`/`oy`/`scale` = calage visuel du sprite (repris du calibrage des props iso).
 */

import type { Cost } from "@/content/resources";

export interface TurretSpec {
  /** Portée de tir en pixels monde. */
  range: number;
  /** Dégâts par salve. */
  damage: number;
  /** Délai entre deux salves (ms). */
  cooldown: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  /** Clé de texture chargée dans la scène. */
  assetKey: string;
  cols: number;
  rows: number;
  scale: number;
  ox: number;
  oy: number;
  /** Coût en ressources (ferraille + éventuellement carburant/eau). */
  cost: Cost;
  hp: number;
  /** Touche de raccourci pour entrer en mode construction. */
  hotkey: string;
  /** Teinte cosmétique du sprite (faute d'assets distincts pour l'instant). */
  tint?: number;
  /** Comportement défensif optionnel. */
  turret?: TurretSpec;
  /** Ids d'unités (cf. content/units.ts) que ce bâtiment peut produire. */
  produces?: string[];
  /** Quartier général : objectif de victoire/défaite, posé d'office (pas constructible). */
  isHQ?: boolean;
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: "barracks",
    name: "Caserne",
    assetKey: "building-a",
    cols: 2,
    rows: 2,
    scale: 0.5,
    ox: 0.506,
    oy: 0.646,
    cost: { scrap: 60 },
    hp: 320,
    hotkey: "C",
    tint: 0xa8c8ff,
    produces: ["scout", "rifle", "heavy"],
  },
  {
    id: "turret",
    name: "Tourelle",
    assetKey: "building-a",
    cols: 2,
    rows: 2,
    scale: 0.5,
    ox: 0.506,
    oy: 0.646,
    cost: { scrap: 40, fuel: 10 },
    hp: 220,
    hotkey: "B",
    tint: 0xffb0a0,
    turret: { range: 300, damage: 9, cooldown: 600 },
  },
  {
    id: "wall",
    name: "Mur",
    assetKey: "rock-a",
    cols: 1,
    rows: 1,
    scale: 0.4,
    ox: 0.495,
    oy: 0.625,
    cost: { scrap: 10 },
    hp: 160,
    hotkey: "N",
  },
];

export function buildingByHotkey(key: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.hotkey === key);
}

/**
 * Quartiers généraux — posés d'office au démarrage (pas dans le menu de construction).
 * Détruire le QG ennemi = victoire ; perdre le sien = défaite. Le QG joueur sert aussi
 * de dépôt et peut produire un récupérateur (relance d'économie si la caserne tombe).
 */
export const PLAYER_HQ: BuildingDef = {
  id: "hq-player",
  name: "QG",
  assetKey: "building-a",
  cols: 2,
  rows: 2,
  scale: 0.5,
  ox: 0.506,
  oy: 0.646,
  cost: {},
  hp: 900,
  hotkey: "",
  tint: 0x9fd0ff,
  isHQ: true,
  produces: ["scout"],
};

export const ENEMY_HQ: BuildingDef = {
  id: "hq-enemy",
  name: "QG ennemi",
  assetKey: "building-b",
  cols: 2,
  rows: 2,
  scale: 0.5,
  ox: 0.506,
  oy: 0.646,
  cost: {},
  hp: 1100,
  hotkey: "",
  tint: 0xff8a7a,
  isHQ: true,
  produces: ["scout", "rifle", "heavy"],
};
