/**
 * Catalogue data-driven des bâtiments (Phase 2).
 *
 * Convention projet : le contenu de jeu (footprint, coûts, stats) vit ici, pas en
 * dur dans la logique. La scène lit ce catalogue pour le mode construction.
 *
 * `cols`/`rows` = footprint (en cases) bloqué sur la grille de navigation.
 * `ox`/`oy`/`scale` = calage visuel du sprite (repris du calibrage des props iso).
 */

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
  /** Coût en ferraille. */
  cost: number;
  hp: number;
  /** Touche de raccourci pour entrer en mode construction. */
  hotkey: string;
  /** Comportement défensif optionnel. */
  turret?: TurretSpec;
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: "turret",
    name: "Tourelle",
    assetKey: "building-a",
    cols: 2,
    rows: 2,
    scale: 0.5,
    ox: 0.506,
    oy: 0.646,
    cost: 40,
    hp: 220,
    hotkey: "B",
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
    cost: 10,
    hp: 160,
    hotkey: "N",
  },
];

export function buildingByHotkey(key: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.hotkey === key);
}
