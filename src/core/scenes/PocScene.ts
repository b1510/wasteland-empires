import Phaser from "phaser";
import {
  cellToWorld,
  worldToCell,
  cellCorners,
  type IsoGrid,
  type Point,
} from "@/world/iso";

/**
 * POC + outil de CALIBRAGE du pack iso "Golbanc Homestead".
 *
 * Objectif : aligner la grille logique iso sur le décor peint. Comme le sol est
 * une image peinte (pas une tuile unitaire), on ajuste à la main les paramètres
 * de la grille (taille de case + origine) jusqu'à ce que la grille "colle" à la
 * route du fond, puis on lit les valeurs affichées.
 *
 * Contrôles :
 *   Glisser            : déplacer la caméra
 *   Molette            : zoom
 *   G                  : grille on/off
 *   Flèches            : déplacer l'origine de la grille (Shift = gros pas)
 *   A / D              : largeur de case -/+        (Shift = gros pas)
 *   W / S              : hauteur de case +/-        (Shift = gros pas)
 *   R                  : reset des valeurs
 *   C                  : copier les valeurs calibrées dans la console
 */

const GRID_COLS = 24;
const GRID_ROWS = 24;

const START_GRID: IsoGrid = {
  tileWidth: 256,
  tileHeight: 128,
  origin: { x: 0, y: 0 },
};

interface PropDef {
  key: string;
  col: number;
  row: number;
  scale: number;
}

export class PocScene extends Phaser.Scene {
  private grid: IsoGrid = structuredClone(START_GRID);
  private gridGfx!: Phaser.GameObjects.Graphics;
  private highlightGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Text;
  private gridVisible = true;
  private props: Phaser.GameObjects.Image[] = [];
  private propDefs: PropDef[] = [];

  // pan caméra
  private dragging = false;
  private dragStart = { x: 0, y: 0 };
  private camStart = { x: 0, y: 0 };

  constructor() {
    super({ key: "PocScene" });
  }

  preload(): void {
    this.load.setPath("assets/golbanc");
    this.load.image("ground", "ground-roads.png");
    this.load.image("building-a", "building-a.png");
    this.load.image("building-b", "building-b.png");
    this.load.image("tree-a", "tree-a.png");
    this.load.image("tree-b", "tree-b.png");
    this.load.image("rock-a", "rock-a.png");
    this.load.image("crate", "crate.png");
  }

  create(): void {
    // Terrain peint, centré sur le monde (0,0).
    this.add.image(0, 0, "ground").setOrigin(0.5, 0.5).setDepth(-100000);

    // Grille de debug DESSINÉE PAR-DESSUS le sol pour pouvoir l'aligner.
    this.gridGfx = this.add.graphics().setDepth(50000);
    this.highlightGfx = this.add.graphics().setDepth(60000);

    this.propDefs = [
      { key: "building-a", col: 6, row: 5, scale: 0.5 },
      { key: "tree-b", col: 7, row: 7, scale: 0.4 },
      { key: "rock-a", col: 5, row: 8, scale: 0.4 },
    ];
    this.rebuildProps();
    this.drawGrid();

    this.setupCamera();
    this.setupInput();
    this.hud = this.add
      .text(12, 12, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#c9f7e8",
        backgroundColor: "#000000cc",
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(1000000);
    this.updateHud();
  }

  // --- Rendu grille / props (recalculés à chaque changement de calibrage) ---

  private rebuildProps(): void {
    for (const p of this.props) p.destroy();
    this.props = this.propDefs.map((def) => {
      const w = cellToWorld(this.grid, def.col, def.row);
      const spr = this.add.image(w.x, w.y, def.key);
      spr.setOrigin(0.5, 1).setScale(def.scale).setDepth(w.y);
      return spr;
    });
  }

  private drawGrid(): void {
    this.gridGfx.clear();
    if (!this.gridVisible) return;
    this.gridGfx.lineStyle(1, 0x00ffcc, 0.45);
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        const c = cellCorners(this.grid, col, row);
        this.gridGfx.beginPath();
        this.gridGfx.moveTo(c[0].x, c[0].y);
        for (let i = 1; i < c.length; i++) this.gridGfx.lineTo(c[i].x, c[i].y);
        this.gridGfx.closePath();
        this.gridGfx.strokePath();
      }
    }
    // Marque la case (0,0) en rouge pour repérer l'origine.
    const o = cellCorners(this.grid, 0, 0);
    this.gridGfx.lineStyle(2, 0xff3355, 0.9);
    this.gridGfx.beginPath();
    this.gridGfx.moveTo(o[0].x, o[0].y);
    for (let i = 1; i < o.length; i++) this.gridGfx.lineTo(o[i].x, o[i].y);
    this.gridGfx.closePath();
    this.gridGfx.strokePath();
  }

  private highlightCell(col: number, row: number): void {
    this.highlightGfx.clear();
    if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) return;
    const c = cellCorners(this.grid, col, row);
    this.highlightGfx.fillStyle(0xffff00, 0.3);
    this.highlightGfx.beginPath();
    this.highlightGfx.moveTo(c[0].x, c[0].y);
    for (let i = 1; i < c.length; i++) this.highlightGfx.lineTo(c[i].x, c[i].y);
    this.highlightGfx.closePath();
    this.highlightGfx.fillPath();
  }

  private refresh(): void {
    this.drawGrid();
    this.rebuildProps();
    this.updateHud();
  }

  // --- Input ---

  private setupCamera(): void {
    this.cameras.main.setZoom(0.45);
    this.cameras.main.centerOn(0, 0);
  }

  private setupInput(): void {
    const cam = this.cameras.main;

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.dragStart = { x: p.x, y: p.y };
      this.camStart = { x: cam.scrollX, y: cam.scrollY };
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (this.dragging = false));
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.dragging) {
        cam.scrollX = this.camStart.x - (p.x - this.dragStart.x) / cam.zoom;
        cam.scrollY = this.camStart.y - (p.y - this.dragStart.y) / cam.zoom;
      }
      const w = cam.getWorldPoint(p.x, p.y);
      const cell = worldToCell(this.grid, w.x, w.y);
      this.highlightCell(cell.col, cell.row);
    });
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.15, 2.5));
      },
    );

    const kb = this.input.keyboard;
    if (!kb) return;

    kb.on("keydown-G", () => {
      this.gridVisible = !this.gridVisible;
      this.drawGrid();
    });
    kb.on("keydown-R", () => {
      this.grid = structuredClone(START_GRID);
      this.refresh();
    });
    kb.on("keydown-C", () => {
      const g = this.grid;
      // eslint-disable-next-line no-console
      console.log(
        `Calibrage iso => tileWidth: ${g.tileWidth}, tileHeight: ${g.tileHeight}, ` +
          `origin: { x: ${Math.round(g.origin.x)}, y: ${Math.round(g.origin.y)} }`,
      );
    });

    const step = (big: boolean): number => (big ? 16 : 2);
    const ostep = (big: boolean): number => (big ? 32 : 4);

    kb.on("keydown", (e: KeyboardEvent) => {
      const big = e.shiftKey;
      switch (e.code) {
        case "ArrowLeft":
          this.grid.origin.x -= ostep(big);
          break;
        case "ArrowRight":
          this.grid.origin.x += ostep(big);
          break;
        case "ArrowUp":
          this.grid.origin.y -= ostep(big);
          break;
        case "ArrowDown":
          this.grid.origin.y += ostep(big);
          break;
        case "KeyA":
          this.grid.tileWidth = Math.max(8, this.grid.tileWidth - step(big));
          break;
        case "KeyD":
          this.grid.tileWidth += step(big);
          break;
        case "KeyW":
          this.grid.tileHeight += step(big);
          break;
        case "KeyS":
          this.grid.tileHeight = Math.max(4, this.grid.tileHeight - step(big));
          break;
        default:
          return;
      }
      this.refresh();
    });
  }

  private updateHud(): void {
    const g = this.grid;
    const o: Point = g.origin;
    this.hud.setText([
      "CALIBRAGE GRILLE ISO — Golbanc Homestead",
      `tileWidth : ${g.tileWidth}   (A / D)`,
      `tileHeight: ${g.tileHeight}   (W / S)`,
      `origin    : x=${Math.round(o.x)}  y=${Math.round(o.y)}   (flèches)`,
      "Shift = gros pas · G grille · R reset · C copie console",
      "Glisser caméra · molette zoom",
      "→ Aligne les losanges sur la ROUTE peinte, puis appuie sur C",
    ]);
  }
}
