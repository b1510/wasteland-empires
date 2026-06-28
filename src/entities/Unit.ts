import Phaser from "phaser";
import { cellToWorld, type Cell, type IsoGrid, type Point } from "@/world/iso";

/**
 * Unité jouable / ennemie — Phase 1+.
 *
 * Rendu : sprite animé 8 directions (idle / run / attack / die).
 * Logique : suit un CHEMIN de cases (A*), interpolé case par case ; combat et
 * IA orchestrés par la scène (qui pilote attackTarget / attacking).
 */

const SPEED = 240;
const ARRIVE_EPS = 4;
const WAYPOINT_RADIUS = 26; // rayon pour valider une case intermédiaire
const PICK_RADIUS = 40;
const SCALE = 1.8;

export type Team = "player" | "enemy";

function dirToRow(dx: number, dy: number): number {
  const angle = Math.atan2(dy, dx);
  return ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
}

export class Unit {
  readonly body: Phaser.GameObjects.Sprite;
  readonly team: Team;
  cell: Cell;
  maxHp = 60;
  hp = 60;
  dead = false;

  // combat (piloté par la scène)
  attackTarget: Unit | null = null;
  attacking = false;
  combatTimer = 0;
  chaseKey = -1;

  // anti-blocage (piloté par la scène)
  finalGoal: Cell | null = null;
  stuckMs = 0;
  lastX = 0;
  lastY = 0;

  private grid: IsoGrid;
  private path: Cell[] = [];
  private target: Point;
  private animBase: string;
  private facing = 2;

  constructor(scene: Phaser.Scene, grid: IsoGrid, cell: Cell, animBase: string, team: Team = "player") {
    this.grid = grid;
    this.team = team;
    this.cell = { ...cell };
    this.animBase = animBase;
    const w = cellToWorld(grid, cell.col, cell.row);
    this.target = { x: w.x, y: w.y };
    this.body = scene.add
      .sprite(w.x, w.y, `${animBase}-idle-${this.facing}`)
      .setOrigin(0.485, 0.695)
      .setScale(SCALE);
    this.body.setDepth(w.y);
    this.lastX = w.x;
    this.lastY = w.y;
    if (team === "enemy") this.body.setTint(0xff6b6b);
    this.setAnim("idle", this.facing);
  }

  setPath(path: Cell[]): void {
    this.path = path.slice();
    this.finalGoal = path.length > 0 ? { ...path[path.length - 1] } : null;
    this.advanceTarget();
  }

  stop(): void {
    this.path = [];
  }

  faceTo(dx: number, dy: number): void {
    this.facing = dirToRow(dx, dy);
  }

  get isMoving(): boolean {
    return this.path.length > 0;
  }

  get remainingPath(): readonly Cell[] {
    return this.path;
  }

  /** Inflige des dégâts ; renvoie true si l'unité meurt. */
  takeDamage(n: number): boolean {
    if (this.dead) return false;
    this.hp -= n;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return true;
    }
    return false;
  }

  private die(): void {
    this.dead = true;
    this.path = [];
    this.attacking = false;
    this.attackTarget = null;
    this.body.play(`${this.animBase}-die-${this.facing}`);
  }

  /**
   * @param sepX,sepY vélocité de séparation (évitement) fournie par la scène.
   * Le déplacement = vélocité de poursuite (vers la case) + séparation, intégrées
   * ensemble -> les unités contournent au lieu de se bloquer.
   */
  update(deltaMs: number, sepX = 0, sepY = 0): void {
    if (this.dead) return;
    const dt = deltaMs / 1000;

    let vx = 0;
    let vy = 0;
    let seeking = false;

    if (this.path.length > 0) {
      let dx = this.target.x - this.body.x;
      let dy = this.target.y - this.body.y;
      let dist = Math.hypot(dx, dy);
      const radius = this.path.length > 1 ? WAYPOINT_RADIUS : ARRIVE_EPS;
      if (dist <= radius) {
        this.cell = this.path.shift()!;
        this.advanceTarget();
        dx = this.target.x - this.body.x;
        dy = this.target.y - this.body.y;
        dist = Math.hypot(dx, dy);
      }
      if (this.path.length > 0 && dist > 0.001) {
        vx = (dx / dist) * SPEED;
        vy = (dy / dist) * SPEED;
        seeking = true;
      }
    }

    vx += sepX;
    vy += sepY;
    this.body.x += vx * dt;
    this.body.y += vy * dt;
    this.body.setDepth(this.body.y);

    if (seeking && Math.hypot(vx, vy) > 1) {
      this.setAnim("run", dirToRow(vx, vy));
    } else {
      this.setAnim(this.attacking ? "attack" : "idle", this.facing);
    }
  }

  hitTest(x: number, y: number): boolean {
    return Phaser.Math.Distance.Between(x, y, this.body.x, this.body.y) <= PICK_RADIUS;
  }

  private setAnim(kind: "idle" | "run" | "attack", row: number): void {
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
