import Phaser from "phaser";
import {
  DEFAULT_GRID,
  cellCorners,
  worldToCell,
  cellToWorld,
  type IsoGrid,
} from "@/world/iso";
import { Grid } from "@/world/Grid";
import { findPath } from "@/world/pathfinding";
import { Unit } from "@/entities/Unit";

/**
 * Phase 1 — prototype moteur (avec pathfinding A*).
 *  - Terrain peint (pack Golbanc) + grille logique iso calibrée.
 *  - Grille d'occupation : le décor et un mur de démo bloquent des cases.
 *  - Unité (placeholder) : clic gauche = sélection, clic droit = ordre de
 *    déplacement -> A* calcule un chemin qui CONTOURNE les obstacles.
 *  - Depth-sorting iso + caméra pan/zoom.
 */

const GRID_COLS = 20;
const GRID_ROWS = 20;
const DRAG_THRESHOLD = 6;

interface PropDef {
  key: string;
  col: number;
  row: number;
  scale: number;
  /** footprint bloqué (cases) */
  fw: number;
  fh: number;
  /** origine du sprite (centre X, base) — mesurée sur l'image */
  ox: number;
  oy: number;
}

const PROPS: PropDef[] = [
  { key: "building-a", col: 6, row: 5, scale: 0.5, fw: 2, fh: 2, ox: 0.506, oy: 0.976 },
  { key: "tree-b", col: 9, row: 8, scale: 0.4, fw: 1, fh: 1, ox: 0.488, oy: 0.953 },
  { key: "rock-a", col: 5, row: 9, scale: 0.4, fw: 1, fh: 1, ox: 0.495, oy: 0.955 },
];

export class GameScene extends Phaser.Scene {
  private grid: IsoGrid = structuredClone(DEFAULT_GRID);
  private nav!: Grid;

  private blockedGfx!: Phaser.GameObjects.Graphics;
  private gridGfx!: Phaser.GameObjects.Graphics;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private pathGfx!: Phaser.GameObjects.Graphics;
  private selectionGfx!: Phaser.GameObjects.Graphics;
  private gridVisible = true;

  private units: Unit[] = [];
  private selected: Unit | null = null;

  private leftDown = false;
  private downX = 0;
  private downY = 0;
  private camStartX = 0;
  private camStartY = 0;
  private movedPastThreshold = false;

  constructor() {
    super({ key: "GameScene" });
  }

  preload(): void {
    this.load.setPath("assets/golbanc");
    this.load.image("ground", "ground-green.png");
    this.load.image("building-a", "building-a.png");
    this.load.image("tree-b", "tree-b.png");
    this.load.image("rock-a", "rock-a.png");
    // Test perso (top-down) sur sol iso — spritesheets 128px, 8 dir x 14 frames :
    this.load.spritesheet("survivor-idle", "../units/survivor-idle.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet("survivor-run", "../units/survivor-run.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
  }

  create(): void {
    this.add.image(0, 0, "ground").setOrigin(0.5, 0.5).setDepth(-100000);

    // Centre la grille de jeu sur le terrain peint (monde 0,0).
    const midCol = (GRID_COLS - 1) / 2;
    const midRow = (GRID_ROWS - 1) / 2;
    this.grid.origin = {
      x: -((midCol - midRow) * this.grid.tileWidth) / 2,
      y: -((midCol + midRow) * this.grid.tileHeight) / 2,
    };

    // --- Grille d'occupation logique ---
    this.nav = new Grid(GRID_COLS, GRID_ROWS);
    for (const p of PROPS) this.nav.blockRect(p.col, p.row, p.fw, p.fh);
    // Mur de démo (vertical) avec une ouverture en row 8 -> force le contournement.
    for (let r = 2; r < 15; r++) if (r !== 8) this.nav.setBlocked(14, r);

    // --- Calques de rendu ---
    this.blockedGfx = this.add.graphics().setDepth(-95000);
    this.gridGfx = this.add.graphics().setDepth(-90000);
    this.hoverGfx = this.add.graphics().setDepth(-80000);
    this.pathGfx = this.add.graphics().setDepth(60000);
    this.selectionGfx = this.add.graphics().setDepth(70000);
    this.drawBlocked();
    this.drawGrid();

    for (const p of PROPS) this.placeProp(p);

    // Animations du survivant : 8 directions x (idle, run). 14 frames/rangée.
    for (let r = 0; r < 8; r++) {
      this.anims.create({
        key: `surv-idle-${r}`,
        frames: this.anims.generateFrameNumbers("survivor-idle", {
          start: r * 14,
          end: r * 14 + 13,
        }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: `surv-run-${r}`,
        frames: this.anims.generateFrameNumbers("survivor-run", {
          start: r * 14,
          end: r * 14 + 13,
        }),
        frameRate: 14,
        repeat: -1,
      });
    }

    this.units.push(new Unit(this, this.grid, { col: 10, row: 10 }, "surv"));

    this.setupCamera();
    this.setupInput();
    this.addHud();
  }

  override update(_time: number, delta: number): void {
    for (const u of this.units) u.update(delta);
    this.drawPath();
    this.drawSelection();
  }

  // --- Rendu ---

  private placeProp(def: PropDef): void {
    // place au CENTRE du footprint (et non sur la case "haute")
    const fc = def.col + (def.fw - 1) / 2;
    const fr = def.row + (def.fh - 1) / 2;
    const w = cellToWorld(this.grid, fc, fr);
    this.add
      .image(w.x, w.y, def.key)
      .setOrigin(def.ox, def.oy)
      .setScale(def.scale)
      .setDepth(w.y);
  }

  private tracePath(gfx: Phaser.GameObjects.Graphics, col: number, row: number): void {
    const c = cellCorners(this.grid, col, row);
    gfx.beginPath();
    gfx.moveTo(c[0].x, c[0].y);
    for (let i = 1; i < c.length; i++) gfx.lineTo(c[i].x, c[i].y);
    gfx.closePath();
  }

  private drawBlocked(): void {
    this.blockedGfx.clear();
    this.blockedGfx.fillStyle(0xff3355, 0.22);
    this.blockedGfx.lineStyle(1, 0xff3355, 0.4);
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        if (!this.nav.isBlocked(col, row)) continue;
        this.tracePath(this.blockedGfx, col, row);
        this.blockedGfx.fillPath();
        this.blockedGfx.strokePath();
      }
    }
  }

  private drawGrid(): void {
    this.gridGfx.clear();
    if (!this.gridVisible) return;
    this.gridGfx.lineStyle(1, 0x00ffcc, 0.15);
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        this.tracePath(this.gridGfx, col, row);
        this.gridGfx.strokePath();
      }
    }
  }

  private drawHover(col: number, row: number): void {
    this.hoverGfx.clear();
    if (!this.nav.inBounds(col, row)) return;
    this.hoverGfx.fillStyle(this.nav.isWalkable(col, row) ? 0xffffff : 0xff0000, 0.15);
    this.tracePath(this.hoverGfx, col, row);
    this.hoverGfx.fillPath();
  }

  private drawPath(): void {
    this.pathGfx.clear();
    if (!this.selected || !this.selected.isMoving) return;
    const cells = this.selected.remainingPath;
    this.pathGfx.lineStyle(3, 0xffe14d, 0.85);
    this.pathGfx.beginPath();
    const start = this.selected.body;
    this.pathGfx.moveTo(start.x, start.y);
    for (const c of cells) {
      const w = cellToWorld(this.grid, c.col, c.row);
      this.pathGfx.lineTo(w.x, w.y);
    }
    this.pathGfx.strokePath();
  }

  private drawSelection(): void {
    this.selectionGfx.clear();
    if (!this.selected) return;
    const b = this.selected.body;
    this.selectionGfx.lineStyle(2, 0xffe14d, 0.95);
    this.selectionGfx.strokeEllipse(b.x, b.y, 46, 28);
  }

  // --- Caméra & input ---

  private setupCamera(): void {
    this.cameras.main.setZoom(0.9);
    this.cameras.main.centerOn(0, 200);
  }

  private setupInput(): void {
    const cam = this.cameras.main;
    this.input.mouse?.disableContextMenu();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        this.commandMove(p);
        return;
      }
      this.leftDown = true;
      this.movedPastThreshold = false;
      this.downX = p.x;
      this.downY = p.y;
      this.camStartX = cam.scrollX;
      this.camStartY = cam.scrollY;
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.leftDown) {
        if (Phaser.Math.Distance.Between(this.downX, this.downY, p.x, p.y) > DRAG_THRESHOLD) {
          this.movedPastThreshold = true;
        }
        if (this.movedPastThreshold) {
          cam.scrollX = this.camStartX - (p.x - this.downX) / cam.zoom;
          cam.scrollY = this.camStartY - (p.y - this.downY) / cam.zoom;
        }
      }
      const w = cam.getWorldPoint(p.x, p.y);
      const cell = worldToCell(this.grid, w.x, w.y);
      this.drawHover(cell.col, cell.row);
    });

    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (p.button === 0 && this.leftDown && !this.movedPastThreshold) {
        this.commandSelect(p);
      }
      this.leftDown = false;
    });

    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.2, 2));
      },
    );

    this.input.keyboard?.on("keydown-G", () => {
      this.gridVisible = !this.gridVisible;
      this.drawGrid();
    });
  }

  private commandSelect(p: Phaser.Input.Pointer): void {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    this.selected = this.units.find((u) => u.hitTest(w.x, w.y)) ?? null;
  }

  private commandMove(p: Phaser.Input.Pointer): void {
    if (!this.selected) return;
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const goal = worldToCell(this.grid, w.x, w.y);
    if (!this.nav.isWalkable(goal.col, goal.row)) return; // cible bloquée
    const path = findPath(this.nav, this.selected.cell, goal);
    if (path) this.selected.setPath(path);
  }

  private addHud(): void {
    this.add
      .text(
        12,
        12,
        [
          "Phase 1 — pathfinding A* + 8 directions",
          "Clic gauche : sélectionner   |   Clic droit : déplacer (contourne les obstacles)",
          "Glisser : caméra · Molette : zoom · G : grille",
        ],
        {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#c9f7e8",
          backgroundColor: "#000000cc",
          padding: { x: 8, y: 6 },
        },
      )
      .setScrollFactor(0)
      .setDepth(1000000);
  }
}
