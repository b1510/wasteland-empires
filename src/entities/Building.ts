import Phaser from "phaser";
import { cellToWorld, type Cell, type IsoGrid } from "@/world/iso";
import type { BuildingDef } from "@/content/buildings";

/**
 * Bâtiment posé sur la grille (Phase 2).
 *
 * Occupe un footprint de `def.cols × def.rows` cases (bloquées sur la grille de
 * nav par la scène). Rendu : sprite calé comme les props iso, depth-sorté.
 * Combat : HP + dégâts ; une tourelle est pilotée par la scène (cooldown / cible).
 */
export class Building {
  readonly def: BuildingDef;
  /** Coin haut-gauche du footprint. */
  readonly cell: Cell;
  readonly sprite: Phaser.GameObjects.Image;
  maxHp: number;
  hp: number;
  dead = false;
  /** Compte à rebours de tir (tourelles), piloté par la scène. */
  cooldown = 0;
  /** File de production (ids d'unités) et progression de la tête, pilotées par la scène. */
  queue: string[] = [];
  prodTimer = 0;
  /** Point de ralliement des unités produites. */
  rally: Cell | null = null;

  constructor(scene: Phaser.Scene, grid: IsoGrid, def: BuildingDef, cell: Cell) {
    this.def = def;
    this.cell = { ...cell };
    this.maxHp = def.hp;
    this.hp = def.hp;
    const fc = cell.col + (def.cols - 1) / 2;
    const fr = cell.row + (def.rows - 1) / 2;
    const w = cellToWorld(grid, fc, fr);
    this.sprite = scene.add
      .image(w.x, w.y, def.assetKey)
      .setOrigin(def.ox, def.oy)
      .setScale(def.scale)
      .setDepth(w.y);
    if (def.tint !== undefined) this.sprite.setTint(def.tint);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  /** Inflige des dégâts ; renvoie true si le bâtiment est détruit. */
  takeDamage(n: number): boolean {
    if (this.dead) return false;
    this.hp -= n;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      return true;
    }
    return false;
  }
}
