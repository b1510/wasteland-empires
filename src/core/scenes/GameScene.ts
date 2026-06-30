import Phaser from "phaser";
import {
  DEFAULT_GRID,
  cellCorners,
  worldToCell,
  cellToWorld,
  type Cell,
  type IsoGrid,
} from "@/world/iso";
import { Grid } from "@/world/Grid";
import { findPath } from "@/world/pathfinding";
import { Unit, type Team } from "@/entities/Unit";
import { Building } from "@/entities/Building";
import {
  BUILDINGS,
  buildingByHotkey,
  PLAYER_HQ,
  ENEMY_HQ,
  type BuildingDef,
} from "@/content/buildings";
import {
  RESOURCES,
  RESOURCE_TYPES,
  canAfford,
  payCost,
  formatCost,
  type ResourceType,
} from "@/content/resources";
import { UNITS, isRanged } from "@/content/units";
import { ENEMY_AI } from "@/content/ai";

/**
 * Phase 1 — prototype moteur.
 *  - Terrain peint (Golbanc) + grille iso calibrée + grille d'occupation (A*).
 *  - PLUSIEURS unités : sélection simple (clic) ou multiple (rectangle au clic
 *    gauche glissé), ordres de groupe (clic droit) avec destinations en formation,
 *    séparation basique pour éviter qu'elles se superposent.
 *  - Caméra : clic-molette (glisser) ou flèches ; zoom molette.
 */

const GRID_COLS = 40;
const GRID_ROWS = 40;
const CLICK_THRESHOLD = 6;
const SEPARATION_DIST = 42; // px : distance mini entre deux unités
const SEP_STRENGTH = 200; // intensité de l'évitement (px/s)
const SEP_TANGENT = 0.7; // biais tangentiel : fait dévier sur le côté
const PAN_SPEED = 700; // px/s (flèches)

// Économie
const NODE_AMOUNT = 120; // ferraille par gisement
const CARRY_CAPACITY = 15; // ferraille transportée par voyage
const GATHER_TIME = 1200; // ms pour miner une charge

// Combat (les stats d'attaque par unité viennent de content/units.ts)
const AGGRO_RANGE = 320; // px : portée de détection des ennemis
const DEATH_REMOVE_MS = 1200; // délai avant disparition du corps

interface PropDef {
  key: string;
  col: number;
  row: number;
  scale: number;
  fw: number;
  fh: number;
  ox: number;
  oy: number;
}

// oy calibré visuellement (= bas de bbox - 0.33) pour poser la base sur la case.
// NB : ox/oy des nouveaux décors (crate, tree-a) sont approximés et pourront être
// affinés visuellement (cf. PocScene).
const TREE_PROP = { scale: 0.4, fw: 1, fh: 1, ox: 0.488, oy: 0.623 };
const ROCK_PROP = { scale: 0.4, fw: 1, fh: 1, ox: 0.495, oy: 0.625 };

/**
 * Barrière centrale = vrai CHOKE POINT. Mur en anti-diagonale (col+row = 39),
 * étanche grâce au « no corner cutting » du pathfinding, avec un PASSAGE unique au
 * centre (cases laissées libres autour de 19,20). Les deux bases (haut-gauche /
 * bas-droite) sont obligées d'y transiter — positionnement et tourelles décisifs.
 */
const BARRIER_CELLS: [number, number][] = [
  // aile basse-gauche
  [10, 29], [11, 28], [12, 27], [13, 26], [14, 25], [15, 24], [16, 23], [17, 22],
  // — passage : 18,21 · 19,20 · 20,19 · 21,18 laissés libres —
  // aile haute-droite
  [22, 17], [23, 16], [24, 15], [25, 14], [26, 13], [27, 12], [28, 11], [29, 10],
];

function barrierProp(col: number, row: number, i: number): PropDef {
  const even = i % 2 === 0;
  return even
    ? { key: "tree-a", col, row, ...TREE_PROP }
    : { key: "rock-a", col, row, ...ROCK_PROP };
}

const PROPS: PropDef[] = [
  // Décor base joueur (haut-gauche) — le QG lui-même est un Building, pas un prop
  { key: "crate", col: 9, row: 6, scale: 0.4, fw: 1, fh: 1, ox: 0.5, oy: 0.62 },
  { key: "tree-b", col: 4, row: 9, ...TREE_PROP },
  // Décor base ennemie (bas-droite)
  { key: "crate", col: 30, row: 34, scale: 0.4, fw: 1, fh: 1, ox: 0.5, oy: 0.62 },
  { key: "tree-a", col: 35, row: 30, ...TREE_PROP },
  // Décor épars (hors lignes de passage)
  { key: "rock-a", col: 11, row: 14, ...ROCK_PROP },
  { key: "tree-b", col: 28, row: 25, ...TREE_PROP },
  { key: "tree-a", col: 5, row: 20, ...TREE_PROP },
  { key: "rock-a", col: 34, row: 19, ...ROCK_PROP },
  // Mur central à passage unique
  ...BARRIER_CELLS.map(([c, r], i) => barrierProp(c, r, i)),
];

const START_CELLS: Cell[] = [
  { col: 8, row: 8 },
  { col: 9, row: 8 },
  { col: 10, row: 8 },
  { col: 8, row: 9 },
  { col: 9, row: 9 },
];

const ENEMY_CELLS: Cell[] = [
  { col: 30, row: 31 },
  { col: 31, row: 30 },
  { col: 34, row: 31 },
];

interface ResourceNode {
  type: ResourceType;
  col: number;
  row: number;
  amount: number;
  max: number;
  baseScale: number;
  sprite: Phaser.GameObjects.Image;
}

type HarvestState = "toNode" | "gather" | "toDepot";

interface HarvestJob {
  node: ResourceNode;
  state: HarvestState;
  timer: number;
  carrying: number;
  spot: number | null; // case réservée (clé), pour éviter que les unités s'empilent
}

export class GameScene extends Phaser.Scene {
  private grid: IsoGrid = structuredClone(DEFAULT_GRID);
  private nav!: Grid;

  private blockedGfx!: Phaser.GameObjects.Graphics;
  private gridGfx!: Phaser.GameObjects.Graphics;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private pathGfx!: Phaser.GameObjects.Graphics;
  private selectionGfx!: Phaser.GameObjects.Graphics;
  private selBoxGfx!: Phaser.GameObjects.Graphics;
  private hpGfx!: Phaser.GameObjects.Graphics;
  private gridVisible = true;

  private units: Unit[] = [];
  private selected: Unit[] = [];

  // Groupes de contrôle (Ctrl+[1-9] assigne, [1-9] rappelle, double-tap = centrer)
  private groups = new Map<number, Unit[]>();
  private lastGroupKey = -1;
  private lastGroupTime = 0;

  // Économie
  private nodes: ResourceNode[] = [];
  private jobs = new Map<Unit, HarvestJob>();
  private reserved = new Set<number>(); // cases réservées par les récolteurs
  private stock: Record<ResourceType, number> = { scrap: 0, fuel: 0, water: 0 };
  private readonly depotAnchor: Cell = { col: 7, row: 6 }; // case du bâtiment (HQ)

  // HUD — texts repositionnés/échelonnés chaque frame par layoutHud (lisible à tout zoom)
  private resChips: Phaser.GameObjects.Text[] = [];
  private helpText!: Phaser.GameObjects.Text;
  private helpVisible = true;

  // Production (file portée par chaque caserne ; ce texte reflète la sélection)
  private prodText!: Phaser.GameObjects.Text;

  // Construction
  private buildings: Building[] = [];
  private selectedBuilding: Building | null = null;
  private buildMode: BuildingDef | null = null;
  private ghost: Phaser.GameObjects.Image | null = null;
  private ghostCell: Cell = { col: 0, row: 0 };
  private ghostValid = false;
  private buildText!: Phaser.GameObjects.Text;
  private siegeTargets = new Map<Unit, Building>(); // ennemi -> bâtiment assiégé
  /** Ordres explicites du joueur : unité -> bâtiment ennemi à détruire (clic droit). */
  private attackOrders = new Map<Unit, Building>();

  // Quartiers généraux & fin de partie
  private playerHQ!: Building;
  private enemyHQ!: Building;
  private gameOver = false;
  private objText!: Phaser.GameObjects.Text;
  private overlayText!: Phaser.GameObjects.Text;

  // IA ennemie (cf. content/ai.ts) : budget, vagues, réserve d'unités au campement
  private aiBudget = 0;
  private aiElapsed = 0; // temps écoulé depuis le début (ms)
  private aiWaveTimer = 0; // temps depuis la dernière vague (ms)
  private aiWaveNumber = 0; // nombre de vagues déjà lancées
  private aiReserve = new Set<Unit>(); // unités ennemies au campement, en attente de vague
  private aiDefenseFund = 0; // ferraille mise de côté par l'IA pour ses tourelles

  // FX de tir (tourelles) : segments éphémères
  private fxGfx!: Phaser.GameObjects.Graphics;
  private shots: { x1: number; y1: number; x2: number; y2: number; ttl: number }[] = [];

  // sélection (clic gauche)
  private selecting = false;
  private selStart = { x: 0, y: 0 };
  private selCur = { x: 0, y: 0 };
  private downX = 0;
  private downY = 0;

  // pan caméra (clic molette)
  private panning = false;
  private panStart = { x: 0, y: 0 };
  private camStart = { x: 0, y: 0 };

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super({ key: "GameScene" });
  }

  preload(): void {
    this.load.setPath("assets/golbanc");
    this.load.image("ground", "ground-green.png");
    this.load.image("building-a", "building-a.png");
    this.load.image("building-b", "building-b.png");
    this.load.image("tree-a", "tree-a.png");
    this.load.image("tree-b", "tree-b.png");
    this.load.image("rock-a", "rock-a.png");
    this.load.image("crate", "crate.png");
    this.load.image("scrap", "scrap.png");
    this.load.image("fuel", "fuel.png");
    this.load.image("water", "water.png");
    this.load.spritesheet("survivor-idle", "../units/survivor-idle.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet("survivor-run", "../units/survivor-run.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet("survivor-attack", "../units/survivor-attack.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
    this.load.spritesheet("survivor-die", "../units/survivor-die.png", {
      frameWidth: 128,
      frameHeight: 128,
    });
  }

  create(): void {
    const midCol = (GRID_COLS - 1) / 2;
    const midRow = (GRID_ROWS - 1) / 2;
    this.grid.origin = {
      x: -((midCol - midRow) * this.grid.tileWidth) / 2,
      y: -((midCol + midRow) * this.grid.tileHeight) / 2,
    };

    this.addGround();

    this.nav = new Grid(GRID_COLS, GRID_ROWS);
    for (const p of PROPS) this.nav.blockRect(p.col, p.row, p.fw, p.fh);

    this.blockedGfx = this.add.graphics().setDepth(-95000);
    this.gridGfx = this.add.graphics().setDepth(-90000);
    this.hoverGfx = this.add.graphics().setDepth(-80000);
    this.pathGfx = this.add.graphics().setDepth(60000);
    this.selectionGfx = this.add.graphics().setDepth(70000);
    this.selBoxGfx = this.add.graphics().setDepth(80000);
    this.drawBlocked();
    this.drawGrid();

    for (const p of PROPS) this.placeProp(p);

    // Quartiers généraux (vrais Buildings : PV + objectifs de victoire/défaite).
    // Le QG joueur englobe la case-dépôt (depotAnchor) où la ferraille est rapportée.
    this.playerHQ = this.spawnBuilding(PLAYER_HQ, { col: 6, row: 5 }, "player");
    this.enemyHQ = this.spawnBuilding(ENEMY_HQ, { col: 32, row: 32 }, "enemy");

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
      this.anims.create({
        key: `surv-attack-${r}`,
        frames: this.anims.generateFrameNumbers("survivor-attack", {
          start: r * 14,
          end: r * 14 + 13,
        }),
        frameRate: 16,
        repeat: -1,
      });
      this.anims.create({
        key: `surv-die-${r}`,
        frames: this.anims.generateFrameNumbers("survivor-die", {
          start: r * 14,
          end: r * 14 + 13,
        }),
        frameRate: 12,
        repeat: 0,
      });
    }

    const startComp = ["scout", "scout", "rifle", "rifle", "heavy"];
    START_CELLS.forEach((c, i) => {
      this.units.push(new Unit(this, this.grid, c, UNITS[startComp[i] ?? "scout"], "player"));
    });
    // Garnison de départ volontairement légère (pas de costaud) : ce sont ces unités
    // qui composeront la toute première vague, avant même que l'IA ait pu acheter quoi
    // que ce soit — éviter de mettre un nouveau joueur face à un costaud dès le début.
    const enemyComp = ["scout", "scout", "rifle"];
    ENEMY_CELLS.forEach((c, i) => {
      const e = new Unit(this, this.grid, c, UNITS[enemyComp[i] ?? "rifle"], "enemy");
      this.units.push(e);
      this.aiReserve.add(e); // rejoindront la première vague
    });

    this.hpGfx = this.add.graphics().setDepth(90000);
    this.fxGfx = this.add.graphics().setDepth(85000);

    // Gisements : ferraille près des bases, carburant & eau au centre (contestés)
    this.addNode("scrap", 11, 7, NODE_AMOUNT);
    this.addNode("scrap", 6, 12, NODE_AMOUNT);
    this.addNode("scrap", 33, 29, NODE_AMOUNT);
    this.addNode("scrap", 29, 33, NODE_AMOUNT);
    this.addNode("fuel", 15, 25, NODE_AMOUNT);
    this.addNode("fuel", 25, 15, NODE_AMOUNT);
    this.addNode("water", 9, 23, NODE_AMOUNT);
    this.addNode("water", 30, 17, NODE_AMOUNT);
    // Gisements flanquant le passage du choke (hors cases de barrière/passage) :
    // point de contestation direct, juste devant le verrou, des deux côtés.
    this.addNode("scrap", 16, 21, NODE_AMOUNT);
    this.addNode("scrap", 23, 18, NODE_AMOUNT);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.setupCamera();
    this.setupInput();
    this.addHud();
  }

  override update(_time: number, delta: number): void {
    this.panWithKeys(delta);
    this.edgeScroll(delta);
    if (!this.gameOver) {
      this.processEnemyAI(delta);
      this.processCombat(delta);
      this.processEnemySiege(delta);
      this.processPlayerSiege(delta);
      this.processTurrets(delta);
      this.processProduction(delta);
      const sep = this.computeSeparation();
      for (let i = 0; i < this.units.length; i++) {
        this.units[i].update(delta, sep[i].x, sep[i].y);
      }
      this.processHarvest(delta);
      this.resolveStuck(delta);
    }
    this.drawPaths();
    this.drawSelection();
    this.drawHpBars();
    this.drawTurretFx(delta);
    this.updateObjText();
    this.layoutHud();
  }

  // --- Rendu ---

  /**
   * Fond peint mis à l'échelle pour couvrir toute la grille (la map est désormais
   * plus grande que l'image source 5178×3009, calibrée à l'origine pour 20×20).
   * Une seule image étirée = pas de coutures (léger flou assumé, backdrop temporaire).
   */
  private addGround(): void {
    const corners = [
      cellToWorld(this.grid, 0, 0),
      cellToWorld(this.grid, GRID_COLS - 1, 0),
      cellToWorld(this.grid, 0, GRID_ROWS - 1),
      cellToWorld(this.grid, GRID_COLS - 1, GRID_ROWS - 1),
    ];
    const halfW = this.grid.tileWidth / 2;
    const halfH = this.grid.tileHeight / 2;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const c of corners) {
      minX = Math.min(minX, c.x - halfW);
      maxX = Math.max(maxX, c.x + halfW);
      minY = Math.min(minY, c.y - halfH);
      maxY = Math.max(maxY, c.y + halfH);
    }
    const img = this.add
      .image((minX + maxX) / 2, (minY + maxY) / 2, "ground")
      .setOrigin(0.5, 0.5)
      .setDepth(-100000);
    const margin = 1.04; // léger débord pour éviter tout liseré aux bords
    img.setScale(Math.max((maxX - minX) / img.width, (maxY - minY) / img.height) * margin);
  }

  private placeProp(def: PropDef): void {
    const fc = def.col + (def.fw - 1) / 2;
    const fr = def.row + (def.fh - 1) / 2;
    const w = cellToWorld(this.grid, fc, fr);
    this.add
      .image(w.x, w.y, def.key)
      .setOrigin(def.ox, def.oy)
      .setScale(def.scale)
      .setDepth(w.y);
  }

  private traceCell(gfx: Phaser.GameObjects.Graphics, col: number, row: number): void {
    const c = cellCorners(this.grid, col, row);
    gfx.beginPath();
    gfx.moveTo(c[0].x, c[0].y);
    for (let i = 1; i < c.length; i++) gfx.lineTo(c[i].x, c[i].y);
    gfx.closePath();
  }

  private drawBlocked(): void {
    this.blockedGfx.clear();
    this.blockedGfx.fillStyle(0xff3355, 0.2);
    this.blockedGfx.lineStyle(1, 0xff3355, 0.4);
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        if (!this.nav.isBlocked(col, row)) continue;
        this.traceCell(this.blockedGfx, col, row);
        this.blockedGfx.fillPath();
        this.blockedGfx.strokePath();
      }
    }
  }

  private drawGrid(): void {
    this.gridGfx.clear();
    if (!this.gridVisible) return;
    this.gridGfx.lineStyle(1, 0x00ffcc, 0.13);
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS; row++) {
        this.traceCell(this.gridGfx, col, row);
        this.gridGfx.strokePath();
      }
    }
  }

  private drawHover(col: number, row: number): void {
    this.hoverGfx.clear();
    if (!this.nav.inBounds(col, row)) return;
    this.hoverGfx.fillStyle(this.nav.isWalkable(col, row) ? 0xffffff : 0xff0000, 0.12);
    this.traceCell(this.hoverGfx, col, row);
    this.hoverGfx.fillPath();
  }

  private drawPaths(): void {
    this.pathGfx.clear();
    this.pathGfx.lineStyle(2, 0xffe14d, 0.7);
    for (const u of this.selected) {
      if (!u.isMoving) continue;
      this.pathGfx.beginPath();
      this.pathGfx.moveTo(u.body.x, u.body.y);
      for (const c of u.remainingPath) {
        const w = cellToWorld(this.grid, c.col, c.row);
        this.pathGfx.lineTo(w.x, w.y);
      }
      this.pathGfx.strokePath();
    }
  }

  private drawSelection(): void {
    this.selectionGfx.clear();
    this.selectionGfx.lineStyle(2, 0xffe14d, 0.95);
    for (const u of this.selected) {
      this.selectionGfx.strokeEllipse(u.body.x, u.body.y, 44, 26);
    }
    this.drawBuildingSelection();
  }

  /** Contour iso du footprint du bâtiment sélectionné (+ marqueur de ralliement). */
  private drawBuildingSelection(): void {
    const b = this.selectedBuilding;
    if (!b || b.dead) return;
    const c0 = b.cell.col;
    const r0 = b.cell.row;
    const c1 = c0 + b.def.cols - 1;
    const r1 = r0 + b.def.rows - 1;
    const top = cellCorners(this.grid, c0, r0)[0];
    const right = cellCorners(this.grid, c1, r0)[1];
    const bottom = cellCorners(this.grid, c1, r1)[2];
    const left = cellCorners(this.grid, c0, r1)[3];
    this.selectionGfx.lineStyle(2, 0x9fd0ff, 0.95);
    this.selectionGfx.beginPath();
    this.selectionGfx.moveTo(top.x, top.y);
    this.selectionGfx.lineTo(right.x, right.y);
    this.selectionGfx.lineTo(bottom.x, bottom.y);
    this.selectionGfx.lineTo(left.x, left.y);
    this.selectionGfx.closePath();
    this.selectionGfx.strokePath();
    if (b.rally) {
      const w = cellToWorld(this.grid, b.rally.col, b.rally.row);
      this.selectionGfx.lineStyle(2, 0x9fd0ff, 0.8);
      this.selectionGfx.strokeEllipse(w.x, w.y, 22, 12);
    }
  }

  private drawSelBox(): void {
    this.selBoxGfx.clear();
    if (!this.selecting) return;
    const x = Math.min(this.selStart.x, this.selCur.x);
    const y = Math.min(this.selStart.y, this.selCur.y);
    const w = Math.abs(this.selCur.x - this.selStart.x);
    const h = Math.abs(this.selCur.y - this.selStart.y);
    this.selBoxGfx.fillStyle(0x39d4ff, 0.12);
    this.selBoxGfx.lineStyle(1.5, 0x39d4ff, 0.9);
    this.selBoxGfx.fillRect(x, y, w, h);
    this.selBoxGfx.strokeRect(x, y, w, h);
  }

  // --- Simulation ---

  /**
   * Vélocité de séparation par unité (évitement). Renvoie un tableau aligné sur
   * this.units. Inclut un biais TANGENTIEL pour que les unités se contournent
   * (même de face) et une asymétrie : une unité immobile n'est pas poussée par
   * une unité en mouvement (elle garde sa place, l'autre la contourne).
   */
  private computeSeparation(): { x: number; y: number }[] {
    const res = this.units.map(() => ({ x: 0, y: 0 }));
    const n = this.units.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.units[i].body;
        const b = this.units[j].body;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d <= 0 || d >= SEPARATION_DIST) continue;

        const force = ((SEPARATION_DIST - d) / SEPARATION_DIST) * SEP_STRENGTH;
        const nx = dx / d;
        const ny = dy / d;
        // composante radiale (éloigne) + tangentielle (fait dévier sur le côté)
        const ax = -(nx + -ny * SEP_TANGENT) * force;
        const ay = -(ny + nx * SEP_TANGENT) * force;

        const am = this.units[i].isMoving;
        const bm = this.units[j].isMoving;
        let si = 0.5;
        let sj = 0.5;
        if (am && !bm) {
          si = 1;
          sj = 0;
        } else if (!am && bm) {
          si = 0;
          sj = 1;
        }

        res[i].x += ax * si;
        res[i].y += ay * si;
        res[j].x -= ax * sj;
        res[j].y -= ay * sj;
      }
    }
    return res;
  }

  /** Une unité (à l'arrêt) occupe-t-elle cette case ? */
  private isOccupied(col: number, row: number): boolean {
    return this.units.some((u) => u.cell.col === col && u.cell.row === row);
  }

  /**
   * Détecte les unités coincées (qui n'avancent plus alors qu'elles ont un
   * chemin) et leur recalcule un trajet qui CONTOURNE les unités immobiles.
   */
  private resolveStuck(delta: number): void {
    const minProgress = (60 * delta) / 1000; // avance attendue mini (~vitesse/4)
    for (const u of this.units) {
      if (u.dead || !u.isMoving) {
        u.stuckMs = 0;
        u.lastX = u.body.x;
        u.lastY = u.body.y;
        continue;
      }
      const moved = Math.hypot(u.body.x - u.lastX, u.body.y - u.lastY);
      u.lastX = u.body.x;
      u.lastY = u.body.y;
      u.stuckMs = moved < minProgress ? u.stuckMs + delta : 0;
      if (u.stuckMs > 350) {
        u.stuckMs = 0;
        this.repathAround(u);
      }
    }
  }

  private repathAround(u: Unit): void {
    if (!u.finalGoal) return;
    const blocked = new Set<number>();
    for (const o of this.units) {
      if (o === u || o.dead || o.isMoving) continue; // seules les immobiles bloquent
      blocked.add(this.cellKey(o.cell.col, o.cell.row));
    }
    const path = findPath(this.nav, u.cell, u.finalGoal, blocked);
    if (path && path.length > 0) u.setPath(path);
  }

  /** N cases marchables et libres les plus proches d'un objectif (formation). */
  private freeCellsAround(goal: Cell, n: number): Cell[] {
    const result: Cell[] = [];
    const seen = new Set<number>();
    const queue: Cell[] = [goal];
    seen.add(goal.row * GRID_COLS + goal.col);
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];
    while (queue.length > 0 && result.length < n) {
      const c = queue.shift()!;
      if (this.nav.isWalkable(c.col, c.row) && !this.isOccupied(c.col, c.row)) {
        result.push(c);
      }
      for (const [dc, dr] of dirs) {
        const nc = c.col + dc;
        const nr = c.row + dr;
        const key = nr * GRID_COLS + nc;
        if (!seen.has(key) && this.nav.inBounds(nc, nr)) {
          seen.add(key);
          queue.push({ col: nc, row: nr });
        }
      }
    }
    return result;
  }

  // --- Production ---

  private processProduction(delta: number): void {
    for (const b of this.buildings) {
      if (b.dead || b.queue.length === 0) continue;
      const def = UNITS[b.queue[0]];
      b.prodTimer += delta;
      if (b.prodTimer >= def.buildTime) {
        b.prodTimer = 0;
        b.queue.shift();
        this.spawnFromBuilding(b, def.id);
      }
    }
    this.updateProdText();
  }

  /** Met un type d'unité en file sur la caserne sélectionnée (débite ses ressources). */
  private queueUnit(unitId: string): void {
    const b = this.selectedBuilding;
    if (!b || b.dead || !b.def.produces?.includes(unitId)) return;
    const def = UNITS[unitId];
    if (!canAfford(this.stock, def.cost)) return;
    payCost(this.stock, def.cost);
    this.updateResourceText();
    b.queue.push(unitId);
    this.updateProdText();
  }

  private spawnFromBuilding(b: Building, unitId: string): void {
    const exit: Cell = { col: b.cell.col, row: b.cell.row + b.def.rows };
    const spot = this.freeCellsAround(exit, 1)[0] ?? exit;
    const u = new Unit(this, this.grid, spot, UNITS[unitId], "player");
    this.units.push(u);
    if (b.rally) {
      const path = findPath(this.nav, u.cell, b.rally);
      if (path) u.setPath(path);
    }
  }

  private updateProdText(): void {
    const b = this.selectedBuilding;
    if (b && !b.dead && b.def.produces) {
      const menu = b.def.produces
        .map((id) => `${UNITS[id].hotkey}:${UNITS[id].name}(${formatCost(UNITS[id].cost)})`)
        .join("  ");
      let status = "—";
      if (b.queue.length > 0) {
        const pct = Math.floor((b.prodTimer / UNITS[b.queue[0]].buildTime) * 100);
        status = `${UNITS[b.queue[0]].name} ${pct}% (+${b.queue.length - 1} en file)`;
      }
      this.prodText.setText(`🏭 ${b.def.name} — ${menu}\n   En cours : ${status} · clic droit = ralliement`);
    } else {
      this.prodText.setText("🏭 Sélectionne une caserne (clic) pour produire des unités");
    }
  }

  // --- Combat ---

  private nearestFoe(u: Unit, range: number): Unit | null {
    let best: Unit | null = null;
    let bestD = range * range;
    for (const o of this.units) {
      if (o.dead || o.team === u.team) continue;
      const d = (o.body.x - u.body.x) ** 2 + (o.body.y - u.body.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private processCombat(delta: number): void {
    // IA ennemie : acquiert la cible joueur la plus proche
    for (const u of this.units) {
      if (u.dead || u.team !== "enemy") continue;
      if (!u.attackTarget || u.attackTarget.dead) {
        u.attackTarget = this.nearestFoe(u, AGGRO_RANGE);
      }
    }

    for (const u of this.units) {
      if (u.dead) continue;
      const t = u.attackTarget;
      if (!t || t.dead) {
        u.attackTarget = null;
        u.attacking = false;
        continue;
      }
      const dx = t.body.x - u.body.x;
      const dy = t.body.y - u.body.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= u.def.range) {
        u.attacking = true;
        if (u.isMoving) u.stop();
        u.faceTo(dx, dy);
        u.combatTimer -= delta;
        if (u.combatTimer <= 0) {
          u.combatTimer = u.def.attackCd;
          this.applyDamage(u, t);
        }
      } else {
        u.attacking = false;
        u.combatTimer = 0;
        const tcell = worldToCell(this.grid, t.body.x, t.body.y);
        const key = this.cellKey(tcell.col, tcell.row);
        if (key !== u.chaseKey || !u.isMoving) {
          u.chaseKey = key;
          const path = findPath(this.nav, u.cell, tcell);
          if (path) u.setPath(path);
        }
      }
    }
  }

  private applyDamage(attacker: Unit, target: Unit): void {
    // feedback visuel pour les unités à distance (réutilise le calque FX des tourelles)
    if (isRanged(attacker.def)) {
      this.shots.push({
        x1: attacker.body.x,
        y1: attacker.body.y - 36,
        x2: target.body.x,
        y2: target.body.y - 34,
        ttl: 80,
      });
    }
    const died = target.takeDamage(attacker.def.damage);
    // riposte : un joueur attaqué et oisif se défend
    if (
      target.team === "player" &&
      !target.attackTarget &&
      !this.jobs.has(target)
    ) {
      target.attackTarget = attacker;
    }
    if (died) this.onUnitDead(target);
  }

  private damageUnit(target: Unit, amount: number): void {
    if (target.takeDamage(amount)) this.onUnitDead(target);
  }

  private onUnitDead(u: Unit): void {
    this.selected = this.selected.filter((x) => x !== u);
    this.siegeTargets.delete(u);
    this.attackOrders.delete(u);
    this.aiReserve.delete(u);
    for (const [n, g] of this.groups) {
      if (g.includes(u)) this.groups.set(n, g.filter((x) => x !== u));
    }
    this.clearJob(u);
    for (const o of this.units) if (o.attackTarget === u) o.attackTarget = null;
    this.time.delayedCall(DEATH_REMOVE_MS, () => {
      this.units = this.units.filter((x) => x !== u);
      u.body.destroy();
    });
  }

  private drawHpBars(): void {
    this.hpGfx.clear();
    for (const u of this.units) {
      if (u.dead) continue;
      const w = 36;
      const h = 5;
      const x = u.body.x - w / 2;
      const y = u.body.y - 78;
      const ratio = Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1);
      this.hpGfx.fillStyle(0x000000, 0.6);
      this.hpGfx.fillRect(x - 1, y - 1, w + 2, h + 2);
      this.hpGfx.fillStyle(u.team === "enemy" ? 0xff5555 : 0x55dd55, 1);
      this.hpGfx.fillRect(x, y, w * ratio, h);
      this.drawUnitBadge(u, x + w / 2, y - 8);
    }
    // Bâtiments : barre affichée seulement s'ils sont endommagés
    for (const b of this.buildings) {
      if (b.dead || b.hp >= b.maxHp) continue;
      const w = 48;
      const h = 6;
      const top = b.sprite.getTopCenter();
      const x = top.x - w / 2;
      const y = top.y - 8;
      const ratio = Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
      this.hpGfx.fillStyle(0x000000, 0.6);
      this.hpGfx.fillRect(x - 1, y - 1, w + 2, h + 2);
      this.hpGfx.fillStyle(0x66ccff, 1);
      this.hpGfx.fillRect(x, y, w * ratio, h);
    }
  }

  /**
   * Badge de forme au-dessus de l'unité (cercle/carré/losange selon `def.badge`) :
   * identification rapide du type au combat, en complément de la teinte — le
   * spritesheet étant partagé entre les 3 types (aucun art distinct disponible).
   */
  private drawUnitBadge(u: Unit, cx: number, cy: number): void {
    const r = 5;
    const color = u.team === "enemy" ? 0xff8a7a : (u.def.tint ?? 0xffffff);
    this.hpGfx.fillStyle(0x000000, 0.55);
    this.hpGfx.fillCircle(cx, cy, r + 1.5);
    this.hpGfx.fillStyle(color, 1);
    switch (u.def.badge) {
      case "circle":
        this.hpGfx.fillCircle(cx, cy, r);
        break;
      case "square":
        this.hpGfx.fillRect(cx - r, cy - r, r * 2, r * 2);
        break;
      case "diamond":
        this.hpGfx.beginPath();
        this.hpGfx.moveTo(cx, cy - r);
        this.hpGfx.lineTo(cx + r, cy);
        this.hpGfx.lineTo(cx, cy + r);
        this.hpGfx.lineTo(cx - r, cy);
        this.hpGfx.closePath();
        this.hpGfx.fillPath();
        break;
    }
  }

  // --- Construction & défense ---

  private toggleBuild(hotkey: string): void {
    const def = buildingByHotkey(hotkey);
    if (!def) return;
    if (this.buildMode?.id === def.id) this.cancelBuild();
    else this.enterBuildMode(def);
  }

  private enterBuildMode(def: BuildingDef): void {
    this.buildMode = def;
    this.ghost?.destroy();
    this.ghost = this.add
      .image(0, 0, def.assetKey)
      .setOrigin(def.ox, def.oy)
      .setScale(def.scale)
      .setAlpha(0.55)
      .setDepth(95000);
    this.updateBuildText();
  }

  private cancelBuild(): void {
    this.buildMode = null;
    this.ghost?.destroy();
    this.ghost = null;
    this.updateBuildText();
  }

  private canPlace(def: BuildingDef, anchor: Cell): boolean {
    for (let r = 0; r < def.rows; r++) {
      for (let c = 0; c < def.cols; c++) {
        const col = anchor.col + c;
        const row = anchor.row + r;
        if (!this.nav.isWalkable(col, row) || this.isOccupied(col, row)) return false;
      }
    }
    return true;
  }

  private updateGhost(p: Phaser.Input.Pointer): void {
    if (!this.buildMode || !this.ghost) return;
    const def = this.buildMode;
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const anchor = worldToCell(this.grid, w.x, w.y);
    const fc = anchor.col + (def.cols - 1) / 2;
    const fr = anchor.row + (def.rows - 1) / 2;
    const cw = cellToWorld(this.grid, fc, fr);
    this.ghost.setPosition(cw.x, cw.y).setDepth(95000);
    this.ghostCell = anchor;
    this.ghostValid = this.canPlace(def, anchor) && canAfford(this.stock, def.cost);
    this.ghost.setTint(this.ghostValid ? 0x66ff88 : 0xff5566);
  }

  /** Crée un bâtiment, bloque son footprint sur la grille de nav, l'enregistre. */
  private spawnBuilding(def: BuildingDef, anchor: Cell, team: Team): Building {
    const b = new Building(this, this.grid, def, anchor, team);
    this.buildings.push(b);
    for (let r = 0; r < def.rows; r++) {
      for (let c = 0; c < def.cols; c++) {
        this.nav.setBlocked(anchor.col + c, anchor.row + r, true);
      }
    }
    this.drawBlocked();
    return b;
  }

  private tryPlace(p: Phaser.Input.Pointer): void {
    if (!this.buildMode) return;
    this.updateGhost(p);
    if (!this.ghostValid) return;
    const def = this.buildMode;
    payCost(this.stock, def.cost);
    this.updateResourceText();
    this.spawnBuilding(def, this.ghostCell, "player");
    this.updateGhost(p); // reste en mode construction (Échap / clic droit pour sortir)
  }

  private onBuildingDead(b: Building): void {
    for (let r = 0; r < b.def.rows; r++) {
      for (let c = 0; c < b.def.cols; c++) {
        this.nav.setBlocked(b.cell.col + c, b.cell.row + r, false);
      }
    }
    this.drawBlocked();
    for (const [u, tgt] of this.siegeTargets) if (tgt === b) this.siegeTargets.delete(u);
    for (const [u, tgt] of this.attackOrders) if (tgt === b) this.attackOrders.delete(u);
    if (this.selectedBuilding === b) this.setSelectedBuilding(null);
    this.buildings = this.buildings.filter((x) => x !== b);
    b.sprite.destroy();
    // QG détruit = fin de partie
    if (b === this.enemyHQ) this.endGame(true);
    else if (b === this.playerHQ) this.endGame(false);
  }

  /** Unité vivante du camp `team` la plus proche d'un point, dans `range`. */
  private nearestUnitOfTeam(x: number, y: number, range: number, team: Team): Unit | null {
    let best: Unit | null = null;
    let bestD = range * range;
    for (const o of this.units) {
      if (o.dead || o.team !== team) continue;
      const d = (o.body.x - x) ** 2 + (o.body.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private nearestPlayerBuilding(x: number, y: number, range: number): Building | null {
    let best: Building | null = null;
    let bestD = range * range;
    for (const b of this.buildings) {
      if (b.dead || b.team !== "player") continue;
      const d = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** Tourelles : acquièrent l'unité adverse la plus proche à portée et tirent (hitscan). */
  private processTurrets(delta: number): void {
    for (const b of this.buildings) {
      if (b.dead || !b.def.turret) continue;
      const spec = b.def.turret;
      b.cooldown -= delta;
      if (b.cooldown > 0) continue;
      const foeTeam: Team = b.team === "player" ? "enemy" : "player";
      const foe = this.nearestUnitOfTeam(b.x, b.y, spec.range, foeTeam);
      if (!foe) continue;
      b.cooldown = spec.cooldown;
      this.shots.push({ x1: b.x, y1: b.y - 46, x2: foe.body.x, y2: foe.body.y - 34, ttl: 90 });
      this.damageUnit(foe, spec.damage);
    }
  }

  /**
   * Siège : un ennemi sans cible-unité s'en prend au bâtiment joueur le plus
   * proche (s'approche puis frappe). C'est ce qui ferme la boucle attaque/défense.
   */
  private processEnemySiege(delta: number): void {
    for (const u of this.units) {
      if (u.dead || u.team !== "enemy") continue;
      if (u.attackTarget && !u.attackTarget.dead) {
        this.siegeTargets.delete(u);
        continue;
      }
      let b = this.siegeTargets.get(u);
      if (!b || b.dead) {
        b = this.nearestPlayerBuilding(u.body.x, u.body.y, AGGRO_RANGE) ?? undefined;
        if (b) this.siegeTargets.set(u, b);
        else {
          this.siegeTargets.delete(u);
          continue;
        }
      }
      this.siegeStep(u, b, delta);
    }
  }

  /**
   * Ordres explicites du joueur : les unités envoyées sur un bâtiment ennemi
   * (clic droit) s'en approchent et le frappent — symétrique du siège ennemi.
   * Détruire le QG ennemi via ce mécanisme = victoire.
   */
  private processPlayerSiege(delta: number): void {
    for (const [u, b] of this.attackOrders) {
      if (u.dead || b.dead) {
        this.attackOrders.delete(u);
        if (u.dead) continue;
        u.attacking = false;
        continue;
      }
      // engager une unité ennemie reste prioritaire (auto-défense en chemin)
      if (u.attackTarget && !u.attackTarget.dead) continue;
      this.siegeStep(u, b, delta);
    }
  }

  /**
   * Une unité s'approche d'un bâtiment et le frappe quand elle est à portée.
   * Mutualisé entre siège ennemi (auto) et ordres d'attaque joueur (explicites).
   */
  private siegeStep(u: Unit, b: Building, delta: number): void {
    const dx = b.x - u.body.x;
    const dy = b.y - u.body.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= u.def.range + 36) {
      if (u.isMoving) u.stop();
      u.faceTo(dx, dy);
      u.attacking = true;
      u.combatTimer -= delta;
      if (u.combatTimer <= 0) {
        u.combatTimer = u.def.attackCd;
        if (isRanged(u.def)) {
          this.shots.push({ x1: u.body.x, y1: u.body.y - 36, x2: b.x, y2: b.y - 40, ttl: 80 });
        }
        if (b.takeDamage(u.def.damage)) this.onBuildingDead(b);
      }
    } else {
      u.attacking = false;
      const tcell = worldToCell(this.grid, b.x, b.y);
      const key = this.cellKey(tcell.col, tcell.row);
      if (key !== u.chaseKey || !u.isMoving) {
        u.chaseKey = key;
        const approach = this.adjacentFreeCell(b.cell.col, b.cell.row, u.cell, null) ?? tcell;
        const path = findPath(this.nav, u.cell, approach);
        if (path) u.setPath(path);
      }
    }
  }

  // --- IA ennemie (cf. content/ai.ts) ---

  /**
   * Adversaire autonome : accumule un budget, achète des unités au QG ennemi, et
   * lance périodiquement des VAGUES d'assaut vers le QG joueur. La pression monte
   * (budget + effectif) à chaque vague. Simple mais crédible (priorité plan #4).
   */
  private processEnemyAI(delta: number): void {
    if (this.enemyHQ.dead) return;
    this.aiElapsed += delta;
    if (this.aiElapsed < ENEMY_AI.startDelay) return;

    // Budget (revenu passif, croissant avec les vagues déjà lancées)
    const rate = ENEMY_AI.budgetPerSec + ENEMY_AI.budgetGrowthPerWave * this.aiWaveNumber;
    this.aiBudget += (rate * delta) / 1000;

    // Fonds défensif (séparé) : l'IA fortifie son QG avec des tourelles
    this.aiDefenseFund += (ENEMY_AI.defense.fundPerSec * delta) / 1000;
    this.aiTryBuildTurret();

    // Achat : la plus chère abordable de la composition (un achat par frame max).
    // L'IA ne gère qu'un budget ferraille (pas d'économie carburant/eau séparée).
    if (this.aiReserve.size < 40) {
      for (const id of ENEMY_AI.composition) {
        const cost = UNITS[id].cost.scrap ?? 0;
        if (this.aiBudget >= cost) {
          this.aiBudget -= cost;
          this.spawnEnemyUnit(id);
          break;
        }
      }
    }

    // Déclenchement de vague
    this.aiWaveTimer += delta;
    const targetSize = Math.min(
      ENEMY_AI.firstWaveSize + ENEMY_AI.waveSizeGrowth * this.aiWaveNumber,
      ENEMY_AI.maxWaveSize,
    );
    const intervalReady = this.aiWaveNumber === 0 || this.aiWaveTimer >= ENEMY_AI.waveInterval;
    if (intervalReady && this.aiReserve.size >= targetSize) this.launchWave();
  }

  private spawnEnemyUnit(unitId: string): void {
    const hq = this.enemyHQ;
    const exit: Cell = { col: hq.cell.col, row: hq.cell.row - 1 }; // vers la carte
    const spot = this.freeCellsAround(exit, 1)[0] ?? exit;
    const u = new Unit(this, this.grid, spot, UNITS[unitId], "enemy");
    this.units.push(u);
    this.aiReserve.add(u);
  }

  /** Nombre de tourelles ennemies actuellement debout. */
  private enemyTurretCount(): number {
    let n = 0;
    for (const b of this.buildings) {
      if (!b.dead && b.team === "enemy" && b.def.turret) n++;
    }
    return n;
  }

  /**
   * L'IA fortifie son QG : dès qu'elle a de quoi payer une tourelle et qu'il en
   * manque, elle en pose une sur le flanc exposé (vers le centre de la carte, d'où
   * viennent les assauts joueur). Rend la prise du QG ennemi non triviale.
   */
  private aiTryBuildTurret(): void {
    const turret = BUILDINGS.find((b) => b.id === "turret");
    if (!turret) return;
    if (this.enemyTurretCount() >= ENEMY_AI.defense.maxTurrets) return;
    const turretCost = turret.cost.scrap ?? 0;
    if (this.aiDefenseFund < turretCost) return;
    const spot = this.findEnemyTurretSpot(turret);
    if (!spot) return;
    this.aiDefenseFund -= turretCost;
    this.spawnBuilding(turret, spot, "enemy");
  }

  /**
   * Cherche un emplacement valide pour une tourelle ennemie, sur le flanc du QG
   * tourné vers la menace (cases de col/row inférieures au QG), en anneaux croissants.
   */
  private findEnemyTurretSpot(def: BuildingDef): Cell | null {
    const hq = this.enemyHQ.cell;
    const radius = ENEMY_AI.defense.turretRadius;
    for (let d = 2; d <= radius; d++) {
      for (let dr = -d; dr <= d; dr++) {
        for (let dc = -d; dc <= d; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue; // anneau de Chebyshev
          // flanc exposé uniquement (vers le centre/joueur)
          if (dc > 0 && dr > 0) continue;
          const anchor: Cell = { col: hq.col + dc, row: hq.row + dr };
          if (this.canPlace(def, anchor)) return anchor;
        }
      }
    }
    return null;
  }

  /**
   * Envoie l'essentiel de la réserve vers le QG joueur, mais GARDE une garnison au
   * campement (elle défend passivement le QG via l'aggro auto). Évite la base vide
   * après chaque assaut, qui rendait une contre-attaque joueur trop facile.
   */
  private launchWave(): void {
    this.aiWaveNumber += 1;
    this.aiWaveTimer = 0;

    const reserve = [...this.aiReserve].filter((u) => !u.dead);
    const def = ENEMY_AI.defense;
    let keep = Math.floor(reserve.length * def.garrisonRatio);
    if (reserve.length > def.minGarrison) keep = Math.max(keep, def.minGarrison);
    const assault = reserve.slice(0, reserve.length - keep);
    const garrison = reserve.slice(reserve.length - keep);

    const hq = this.playerHQ;
    for (const u of assault) {
      u.attackTarget = null;
      const approach =
        this.adjacentFreeCell(hq.cell.col, hq.cell.row, u.cell, null) ??
        { col: hq.cell.col, row: hq.cell.row + hq.def.rows };
      const path = findPath(this.nav, u.cell, approach);
      if (path) u.setPath(path);
    }

    // La garnison reste en réserve pour la prochaine vague (et défend en attendant).
    this.aiReserve.clear();
    for (const u of garrison) this.aiReserve.add(u);
  }

  // --- Fin de partie ---

  private endGame(win: boolean): void {
    if (this.gameOver) return;
    this.gameOver = true;
    if (this.buildMode) this.cancelBuild();
    this.overlayText.setText(win ? "VICTOIRE" : "DÉFAITE");
    this.overlayText.setColor(win ? "#9dffa8" : "#ff8a8a");
    this.overlayText.setVisible(true);
  }

  private updateObjText(): void {
    if (this.gameOver) {
      this.objText.setText("");
      return;
    }
    if (this.aiElapsed < ENEMY_AI.startDelay) {
      const t = Math.ceil((ENEMY_AI.startDelay - this.aiElapsed) / 1000);
      this.objText.setText(`🎯 Ennemi en préparation (${t}s) · Objectif : détruire le QG ennemi`);
      return;
    }
    const next = Math.max(0, Math.ceil((ENEMY_AI.waveInterval - this.aiWaveTimer) / 1000));
    const turrets = this.enemyTurretCount();
    const def = turrets > 0 ? ` · défenses ennemies : ${turrets}🗼` : "";
    this.objText.setText(
      `🎯 Vagues lancées : ${this.aiWaveNumber} · campement ennemi : ${this.aiReserve.size}` +
        `${def} · prochaine ~${next}s · Objectif : QG ennemi`,
    );
  }

  private drawTurretFx(delta: number): void {
    this.fxGfx.clear();
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.ttl -= delta;
      if (s.ttl <= 0) {
        this.shots.splice(i, 1);
        continue;
      }
      this.fxGfx.lineStyle(2, 0xfff36b, Phaser.Math.Clamp(s.ttl / 90, 0, 1));
      this.fxGfx.lineBetween(s.x1, s.y1, s.x2, s.y2);
    }
  }

  private updateBuildText(): void {
    const list = BUILDINGS.map((b) => `${b.hotkey}:${b.name}(${formatCost(b.cost)})`).join("  ");
    const cur = this.buildMode
      ? ` — ${this.buildMode.name} : clic gauche pose · clic droit/Échap annule`
      : "";
    this.buildText.setText(`🏗 Construire — ${list}${cur}`);
  }

  // --- Économie ---

  private addNode(type: ResourceType, col: number, row: number, amount: number): void {
    const def = RESOURCES[type];
    const w = cellToWorld(this.grid, col, row);
    const sprite = this.add
      .image(w.x, w.y, def.assetKey)
      .setOrigin(def.ox, def.oy)
      .setScale(def.scale)
      // tuile plate (mare) : posée au sol, sous les unités ; sinon depth iso normal
      .setDepth(def.flat ? -90000 : w.y);
    this.nav.setBlocked(col, row);
    this.nodes.push({ type, col, row, amount, max: amount, baseScale: def.scale, sprite });
  }

  private nodeAt(cell: Cell, world: Phaser.Math.Vector2): ResourceNode | undefined {
    return this.nodes.find(
      (n) =>
        n.amount > 0 &&
        ((n.col === cell.col && n.row === cell.row) ||
          n.sprite.getBounds().contains(world.x, world.y)),
    );
  }

  private cellKey(col: number, row: number): number {
    return row * GRID_COLS + col;
  }

  /**
   * Case marchable adjacente à (col,row), la plus proche de `from`, en évitant
   * les cases déjà RÉSERVÉES par d'autres récolteurs (sauf `own` = la sienne).
   */
  private adjacentFreeCell(col: number, row: number, from: Cell, own: number | null): Cell | null {
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];
    let best: Cell | null = null;
    let bestD = Infinity;
    for (const [dc, dr] of dirs) {
      const nc = col + dc;
      const nr = row + dr;
      if (!this.nav.isWalkable(nc, nr)) continue;
      const key = this.cellKey(nc, nr);
      if (this.reserved.has(key) && key !== own) continue;
      if (this.isOccupied(nc, nr)) continue;
      const d = (nc - from.col) ** 2 + (nr - from.row) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { col: nc, row: nr };
      }
    }
    return best;
  }

  private freeReservation(job: HarvestJob): void {
    if (job.spot !== null) {
      this.reserved.delete(job.spot);
      job.spot = null;
    }
  }

  /** Réserve la case cible et y envoie l'unité (libère l'ancienne réservation). */
  private gotoReserve(job: HarvestJob, u: Unit, target: Cell | null): void {
    this.freeReservation(job);
    if (!target) return;
    job.spot = this.cellKey(target.col, target.row);
    this.reserved.add(job.spot);
    const path = findPath(this.nav, u.cell, target);
    if (path) u.setPath(path);
  }

  private clearJob(u: Unit): void {
    const job = this.jobs.get(u);
    if (job) this.freeReservation(job);
    this.jobs.delete(u);
  }

  private assignHarvest(u: Unit, node: ResourceNode): void {
    this.clearJob(u);
    u.attackTarget = null;
    const job: HarvestJob = { node, state: "toNode", timer: 0, carrying: 0, spot: null };
    this.jobs.set(u, job);
    this.gotoReserve(job, u, this.adjacentFreeCell(node.col, node.row, u.cell, job.spot));
  }

  private processHarvest(delta: number): void {
    this.jobs.forEach((job, u) => {
      switch (job.state) {
        case "toNode":
          if (u.isMoving) break;
          if (job.node.amount <= 0) {
            this.clearJob(u);
            break;
          }
          job.state = "gather";
          job.timer = GATHER_TIME;
          break;

        case "gather":
          job.timer -= delta;
          if (job.timer > 0) break;
          job.carrying = Math.min(CARRY_CAPACITY, job.node.amount);
          job.node.amount -= job.carrying;
          this.updateNodeSprite(job.node);
          job.state = "toDepot";
          this.gotoReserve(
            job,
            u,
            this.adjacentFreeCell(this.depotAnchor.col, this.depotAnchor.row, u.cell, job.spot),
          );
          break;

        case "toDepot":
          if (u.isMoving) break;
          this.stock[job.node.type] += job.carrying;
          job.carrying = 0;
          this.updateResourceText();
          if (job.node.amount > 0) {
            job.state = "toNode";
            this.gotoReserve(
              job,
              u,
              this.adjacentFreeCell(job.node.col, job.node.row, u.cell, job.spot),
            );
          } else {
            this.clearJob(u);
          }
          break;
      }
    });
  }

  private updateNodeSprite(node: ResourceNode): void {
    if (node.amount <= 0) {
      node.sprite.setVisible(false);
      this.nav.setBlocked(node.col, node.row, false);
    } else {
      node.sprite.setScale(node.baseScale * (0.5 + (0.5 * node.amount) / node.max));
    }
  }

  private updateResourceText(): void {
    RESOURCE_TYPES.forEach((t, i) =>
      this.resChips[i]?.setText(`${RESOURCES[t].icon} ${this.stock[t]}`),
    );
  }

  // --- Caméra & input ---

  private setupCamera(): void {
    this.cameras.main.setZoom(0.7);
    // Démarre sur la base du joueur (haut-gauche de la map)
    const c = cellToWorld(this.grid, 8, 8);
    this.cameras.main.centerOn(c.x, c.y);
  }

  private panWithKeys(delta: number): void {
    const cam = this.cameras.main;
    const d = (PAN_SPEED * delta) / 1000 / cam.zoom;
    if (this.cursors.left.isDown) cam.scrollX -= d;
    if (this.cursors.right.isDown) cam.scrollX += d;
    if (this.cursors.up.isDown) cam.scrollY -= d;
    if (this.cursors.down.isDown) cam.scrollY += d;
  }

  /** Défilement par les bords de l'écran (standard RTS). */
  private edgeScroll(delta: number): void {
    if (this.selecting || this.panning) return; // pas pendant une sélection/pan manuel
    const p = this.input.activePointer;
    const cam = this.cameras.main;
    const w = this.scale.width;
    const h = this.scale.height;
    if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) return; // souris hors fenêtre
    const margin = 28;
    const d = (PAN_SPEED * delta) / 1000 / cam.zoom;
    if (p.x < margin) cam.scrollX -= d;
    else if (p.x > w - margin) cam.scrollX += d;
    if (p.y < margin) cam.scrollY -= d;
    else if (p.y > h - margin) cam.scrollY += d;
  }

  private setupInput(): void {
    const cam = this.cameras.main;
    this.input.mouse?.disableContextMenu();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.buildMode) {
        if (p.leftButtonDown()) this.tryPlace(p);
        else if (p.rightButtonDown()) this.cancelBuild();
        return;
      }
      if (p.middleButtonDown()) {
        this.panning = true;
        this.panStart = { x: p.x, y: p.y };
        this.camStart = { x: cam.scrollX, y: cam.scrollY };
        return;
      }
      if (p.rightButtonDown()) {
        this.commandMove(p);
        return;
      }
      if (p.leftButtonDown()) {
        this.selecting = true;
        const w = cam.getWorldPoint(p.x, p.y);
        this.selStart = { x: w.x, y: w.y };
        this.selCur = { x: w.x, y: w.y };
        this.downX = p.x;
        this.downY = p.y;
      }
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.panning) {
        cam.scrollX = this.camStart.x - (p.x - this.panStart.x) / cam.zoom;
        cam.scrollY = this.camStart.y - (p.y - this.panStart.y) / cam.zoom;
      }
      if (this.selecting) {
        const w = cam.getWorldPoint(p.x, p.y);
        this.selCur = { x: w.x, y: w.y };
        this.drawSelBox();
      }
      const w = cam.getWorldPoint(p.x, p.y);
      const cell = worldToCell(this.grid, w.x, w.y);
      this.drawHover(cell.col, cell.row);
      if (this.buildMode) this.updateGhost(p);
    });

    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (p.button === 1) this.panning = false;
      if (p.button === 0 && this.selecting) {
        this.selecting = false;
        this.selBoxGfx.clear();
        const additive = (p.event as MouseEvent | undefined)?.shiftKey ?? false;
        const moved =
          Phaser.Math.Distance.Between(this.downX, this.downY, p.x, p.y) > CLICK_THRESHOLD;
        if (moved) this.selectInBox(additive);
        else this.selectSingle(p, additive);
      }
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

    // Production : chaque type d'unité a sa touche (active si une caserne est sélectionnée)
    for (const def of Object.values(UNITS)) {
      this.input.keyboard?.on(`keydown-${def.hotkey}`, () => this.queueUnit(def.id));
    }

    // Construction : raccourcis du catalogue (B tourelle, N mur…) + Échap pour annuler
    for (const b of BUILDINGS) {
      this.input.keyboard?.on(`keydown-${b.hotkey}`, () => this.toggleBuild(b.hotkey));
    }
    this.input.keyboard?.on("keydown-ESC", () => this.cancelBuild());

    // Aide : afficher/masquer le bandeau de contrôles
    this.input.keyboard?.on("keydown-H", () => {
      this.helpVisible = !this.helpVisible;
    });

    // Groupes de contrôle : Ctrl+[1-9] assigne, [1-9] rappelle (double-tap = centrer).
    // addCapture empêche le navigateur d'intercepter Ctrl+chiffre (changement d'onglet).
    this.input.keyboard?.addCapture("ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE");
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 9) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) this.assignGroup(n);
      else this.recallGroup(n);
    });
  }

  private selectSingle(p: Phaser.Input.Pointer, additive: boolean): void {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const u = this.units.find(
      (unit) => unit.team === "player" && !unit.dead && unit.hitTest(w.x, w.y),
    );
    if (additive) {
      if (!u) return;
      const i = this.selected.indexOf(u); // shift-clic : bascule l'unité
      if (i >= 0) this.selected.splice(i, 1);
      else this.selected.push(u);
      return;
    }
    if (u) {
      this.selected = [u];
      this.setSelectedBuilding(null);
      return;
    }
    // pas d'unité sous le curseur : tente la sélection d'un bâtiment joueur
    const b = this.buildingAt(w.x, w.y, "player");
    this.selected = [];
    this.setSelectedBuilding(b);
  }

  private buildingAt(x: number, y: number, team?: Team): Building | null {
    const cell = worldToCell(this.grid, x, y);
    for (const b of this.buildings) {
      if (b.dead) continue;
      if (team !== undefined && b.team !== team) continue;
      const inFootprint =
        cell.col >= b.cell.col &&
        cell.col < b.cell.col + b.def.cols &&
        cell.row >= b.cell.row &&
        cell.row < b.cell.row + b.def.rows;
      if (inFootprint || b.sprite.getBounds().contains(x, y)) return b;
    }
    return null;
  }

  private setSelectedBuilding(b: Building | null): void {
    this.selectedBuilding = b;
    this.updateProdText();
  }

  private selectInBox(additive: boolean): void {
    const x1 = Math.min(this.selStart.x, this.selCur.x);
    const x2 = Math.max(this.selStart.x, this.selCur.x);
    const y1 = Math.min(this.selStart.y, this.selCur.y);
    const y2 = Math.max(this.selStart.y, this.selCur.y);
    const inBox = this.units.filter(
      (u) =>
        u.team === "player" &&
        !u.dead &&
        u.body.x >= x1 &&
        u.body.x <= x2 &&
        u.body.y >= y1 &&
        u.body.y <= y2,
    );
    if (!additive) {
      this.selected = inBox;
      this.setSelectedBuilding(null);
      return;
    }
    for (const u of inBox) if (!this.selected.includes(u)) this.selected.push(u);
  }

  // --- Groupes de contrôle ---

  private assignGroup(n: number): void {
    this.groups.set(n, this.selected.slice());
  }

  private recallGroup(n: number): void {
    const g = (this.groups.get(n) ?? []).filter((u) => !u.dead);
    this.groups.set(n, g);
    if (g.length === 0) return;
    this.selected = g.slice();
    this.setSelectedBuilding(null);
    const now = this.time.now;
    if (this.lastGroupKey === n && now - this.lastGroupTime < 320) {
      this.centerOnUnits(g); // double-tap : recentre la caméra sur le groupe
    }
    this.lastGroupKey = n;
    this.lastGroupTime = now;
  }

  private centerOnUnits(us: Unit[]): void {
    let sx = 0;
    let sy = 0;
    for (const u of us) {
      sx += u.body.x;
      sy += u.body.y;
    }
    this.cameras.main.centerOn(sx / us.length, sy / us.length);
  }

  private commandMove(p: Phaser.Input.Pointer): void {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const goal = worldToCell(this.grid, w.x, w.y);

    // Aucune unité sélectionnée : clic droit = point de ralliement de la caserne
    if (this.selected.length === 0) {
      const b = this.selectedBuilding;
      if (b && !b.dead && b.def.produces && this.nav.isWalkable(goal.col, goal.row)) {
        b.rally = goal;
      }
      return;
    }

    // Clic sur un ennemi -> ordre d'attaque
    const foe = this.units.find(
      (u) => u.team === "enemy" && !u.dead && u.hitTest(w.x, w.y),
    );
    if (foe) {
      for (const u of this.selected) {
        this.clearJob(u);
        this.attackOrders.delete(u);
        u.attackTarget = foe;
      }
      return;
    }

    // Clic sur un bâtiment ennemi (ex. QG) -> ordre de siège
    const eb = this.buildingAt(w.x, w.y, "enemy");
    if (eb) {
      for (const u of this.selected) {
        this.clearJob(u);
        u.attackTarget = null;
        this.attackOrders.set(u, eb);
      }
      return;
    }

    // Clic sur un gisement -> ordre de récolte
    const node = this.nodeAt(goal, w);
    if (node) {
      for (const u of this.selected) {
        this.attackOrders.delete(u);
        this.assignHarvest(u, node);
      }
      return;
    }

    // Sinon déplacement de groupe (annule la récolte et l'ordre d'attaque en cours)
    if (!this.nav.isWalkable(goal.col, goal.row)) return;
    const dests = this.freeCellsAround(goal, this.selected.length);
    this.selected.forEach((u, i) => {
      this.clearJob(u);
      this.attackOrders.delete(u);
      u.attackTarget = null;
      const dest = dests[i] ?? goal;
      const path = findPath(this.nav, u.cell, dest);
      if (path) u.setPath(path);
    });
  }

  private addHud(): void {
    const panel = (size: number, color: string, bg = "#0c1218e6"): Phaser.GameObjects.Text =>
      this.add
        .text(0, 0, "", {
          fontFamily: "monospace",
          fontSize: `${size}px`,
          color,
          backgroundColor: bg,
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0, 0)
        .setDepth(1000000);

    // Bandeau ressources : une chip colorée par ressource
    this.resChips = RESOURCE_TYPES.map((t) => panel(20, RESOURCES[t].color));
    this.updateResourceText();

    this.prodText = panel(14, "#bcdcff");
    this.updateProdText();

    this.buildText = panel(14, "#e6caff");
    this.updateBuildText();

    this.objText = panel(15, "#ffd9a0");
    this.updateObjText();

    this.overlayText = this.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "64px",
        color: "#ffffff",
        backgroundColor: "#000000bb",
        padding: { x: 32, y: 20 },
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2000000)
      .setVisible(false);

    this.helpText = this.add
      .text(
        0,
        0,
        [
          "Sélection : clic · glisser · Maj+clic ajoute      Groupes : Ctrl+[1-9] puis [1-9]",
          "Clic droit : déplacer · récolter · attaquer (unité ou QG ennemi)      Construire : C caserne · B tourelle · N mur (Échap annule)",
          "Caserne/QG sélectionné : R/F/V produit · clic droit = ralliement      Caméra : bords · flèches · clic-molette · molette",
          "Objectif : détruire le QG ennemi · ne perds pas le tien      G : grille   H : aide",
        ],
        {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#9fb4c4",
          backgroundColor: "#0a0e12dd",
          padding: { x: 10, y: 6 },
          lineSpacing: 3,
        },
      )
      .setOrigin(0, 0)
      .setDepth(1000000);

    this.layoutHud();
  }

  /**
   * Positionne et met à l'échelle le HUD chaque frame selon le zoom caméra : chaque
   * élément est ancré à une position ÉCRAN (via getWorldPoint) et contre-scalé par
   * 1/zoom → taille de police constante, lisible quel que soit le dézoom.
   */
  private layoutHud(): void {
    const cam = this.cameras.main;
    const inv = 1 / cam.zoom;
    const place = (t: Phaser.GameObjects.Text, sx: number, sy: number): void => {
      t.setScale(inv);
      const w = cam.getWorldPoint(sx, sy);
      t.setPosition(w.x, w.y);
    };
    // width/height intrinsèques (non scalés) = dimensions écran, car scale·zoom = 1
    let x = 12;
    for (const chip of this.resChips) {
      place(chip, x, 12);
      x += chip.width + 8;
    }
    place(this.prodText, 12, 52);
    place(this.buildText, 12, 52 + this.prodText.height + 6);
    place(this.objText, 12, 52 + this.prodText.height + 6 + this.buildText.height + 6);
    this.helpText.setVisible(this.helpVisible);
    if (this.helpVisible) place(this.helpText, 12, cam.height - this.helpText.height - 12);

    // Overlay de fin : centré écran, contre-scalé
    if (this.overlayText.visible) {
      this.overlayText.setScale(inv);
      const c = cam.getWorldPoint(cam.width / 2, cam.height / 2);
      this.overlayText.setPosition(c.x, c.y);
    }
  }
}
