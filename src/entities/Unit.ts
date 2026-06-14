import Phaser from "phaser";
import { cellToWorld, type Cell, type IsoGrid, type Point } from "@/world/iso";

/**
 * Unité jouable — Phase 1.
 *
 * Rendu : sprite animé 8 directions (Idle / Run). Logique définitive : l'unité
 * suit un CHEMIN de cases (A*), interpolé case par case, et s'oriente selon son
 * déplacement à l'écran.
 *
 * Mapping rangée du spritesheet -> orientation écran (déduit du montage) :
 *   0=O, 1=SO, 2=S, 3=SE, 4=E, 5=NE, 6=N, 7=NO
 */

const SPEED = 240; // pixels monde / seconde
const ARRIVE_EPS = 2;
const PICK_RADIUS = 40;
const SCALE = 1.8;

/**
 * Convertit une direction écran (dx, dy) en index de rangée du spritesheet.
 * Mapping résolu empiriquement : rangée = k (8 secteurs, 0=E,1=SE,...,7=NE).
 */
function dirToRow(dx: number, dy: number): number {
  const angle = Math.atan2(dy, dx); // 0 = Est, +pi/2 = Sud (y vers le bas)
  return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
}

export class Unit {
  readonly body: Phaser.GameObjects.Sprite;
  cell: Cell;
  private grid: IsoGrid;
  private path: Cell[] = [];
  private target: Point;
  private animBase: string;
  private facing = 2; // rangée de direction courante (S par défaut)

  constructor(scene: Phaser.Scene, grid: IsoGrid, cell: Cell, animBase: string) {
    this.grid = grid;
    this.cell = { ...cell };
    this.animBase = animBase;
    const w = cellToWorld(grid, cell.col, cell.row);
    this.target = { x: w.x, y: w.y };
    this.body = scene.add
      .sprite(w.x, w.y, `${animBase}-idle-${this.facing}`)
      .setOrigin(0.485, 0.695) // pieds réels du perso (mesurés)
      .setScale(SCALE);
    this.body.setDepth(w.y);
    this.setAnim("idle", this.facing);
  }

  setPath(path: Cell[]): void {
    this.path = path.slice();
    this.advanceTarget();
  }

  get isMoving(): boolean {
    return this.path.length > 0;
  }

  get remainingPath(): readonly Cell[] {
    return this.path;
  }

  update(deltaMs: number): void {
    if (this.path.length === 0) return;

    const dx = this.target.x - this.body.x;
    const dy = this.target.y - this.body.y;
    const dist = Math.hypot(dx, dy);
    const step = (SPEED * deltaMs) / 1000;

    // oriente l'unité selon sa direction de déplacement
    if (dist > ARRIVE_EPS) {
      const row = dirToRow(dx, dy);
      this.setAnim("run", row);
    }

    if (dist <= ARRIVE_EPS || dist <= step) {
      this.body.setPosition(this.target.x, this.target.y);
      this.cell = this.path.shift()!;
      this.advanceTarget();
      if (this.path.length === 0) this.setAnim("idle", this.facing);
    } else {
      this.body.x += (dx / dist) * step;
      this.body.y += (dy / dist) * step;
    }
    this.body.setDepth(this.body.y); // tri de profondeur iso
  }

  hitTest(x: number, y: number): boolean {
    return (
      Phaser.Math.Distance.Between(x, y, this.body.x, this.body.y) <= PICK_RADIUS
    );
  }

  private setAnim(kind: "idle" | "run", row: number): void {
    this.facing = row;
    const key = `${this.animBase}-${kind}-${row}`;
    if (this.body.anims.currentAnim?.key !== key) this.body.play(key);
  }

  private advanceTarget(): void {
    const next = this.path[0];
    if (next) {
      const w = cellToWorld(this.grid, next.col, next.row);
      this.target = { x: w.x, y: w.y };
    } else {
      this.target = { x: this.body.x, y: this.body.y };
    }
  }
}
