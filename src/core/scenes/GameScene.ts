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
import { Unit } from "@/entities/Unit";

/**
 * Phase 1 — prototype moteur.
 *  - Terrain peint (Golbanc) + grille iso calibrée + grille d'occupation (A*).
 *  - PLUSIEURS unités : sélection simple (clic) ou multiple (rectangle au clic
 *    gauche glissé), ordres de groupe (clic droit) avec destinations en formation,
 *    séparation basique pour éviter qu'elles se superposent.
 *  - Caméra : clic-molette (glisser) ou flèches ; zoom molette.
 */

const GRID_COLS = 20;
const GRID_ROWS = 20;
const CLICK_THRESHOLD = 6;
const SEPARATION_DIST = 42; // px : distance mini entre deux unités
const PAN_SPEED = 700; // px/s (flèches)

// Économie
const NODE_AMOUNT = 120; // ferraille par gisement
const CARRY_CAPACITY = 15; // ferraille transportée par voyage
const GATHER_TIME = 1200; // ms pour miner une charge

// Production
const UNIT_COST = 20; // ferraille par unité
const BUILD_TIME = 3000; // ms de production

// Combat
const ATTACK_RANGE = 105; // px
const ATTACK_DAMAGE = 12;
const ATTACK_CD = 700; // ms entre deux coups
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
const PROPS: PropDef[] = [
  { key: "building-a", col: 6, row: 5, scale: 0.5, fw: 2, fh: 2, ox: 0.506, oy: 0.646 },
  { key: "tree-b", col: 9, row: 8, scale: 0.4, fw: 1, fh: 1, ox: 0.488, oy: 0.623 },
  { key: "rock-a", col: 5, row: 9, scale: 0.4, fw: 1, fh: 1, ox: 0.495, oy: 0.625 },
];

const SCRAP_OY = 0.576; // 0.906 - 0.33

const START_CELLS: Cell[] = [
  { col: 9, row: 11 },
  { col: 10, row: 11 },
  { col: 11, row: 11 },
  { col: 9, row: 12 },
  { col: 10, row: 12 },
];

interface ResourceNode {
  col: number;
  row: number;
  amount: number;
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

  // Économie
  private nodes: ResourceNode[] = [];
  private jobs = new Map<Unit, HarvestJob>();
  private reserved = new Set<number>(); // cases réservées par les récolteurs
  private scrap = 0;
  private scrapText!: Phaser.GameObjects.Text;
  private readonly depotAnchor: Cell = { col: 7, row: 6 }; // case du bâtiment (HQ)

  // Production
  private prodQueue = 0;
  private prodTimer = 0;
  private prodText!: Phaser.GameObjects.Text;

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
    this.load.image("tree-b", "tree-b.png");
    this.load.image("rock-a", "rock-a.png");
    this.load.image("scrap", "scrap.png");
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
    this.add.image(0, 0, "ground").setOrigin(0.5, 0.5).setDepth(-100000);

    const midCol = (GRID_COLS - 1) / 2;
    const midRow = (GRID_ROWS - 1) / 2;
    this.grid.origin = {
      x: -((midCol - midRow) * this.grid.tileWidth) / 2,
      y: -((midCol + midRow) * this.grid.tileHeight) / 2,
    };

    this.nav = new Grid(GRID_COLS, GRID_ROWS);
    for (const p of PROPS) this.nav.blockRect(p.col, p.row, p.fw, p.fh);
    for (let r = 2; r < 15; r++) if (r !== 8) this.nav.setBlocked(14, r);

    this.blockedGfx = this.add.graphics().setDepth(-95000);
    this.gridGfx = this.add.graphics().setDepth(-90000);
    this.hoverGfx = this.add.graphics().setDepth(-80000);
    this.pathGfx = this.add.graphics().setDepth(60000);
    this.selectionGfx = this.add.graphics().setDepth(70000);
    this.selBoxGfx = this.add.graphics().setDepth(80000);
    this.drawBlocked();
    this.drawGrid();

    for (const p of PROPS) this.placeProp(p);

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

    for (const c of START_CELLS) {
      this.units.push(new Unit(this, this.grid, c, "surv", "player"));
    }
    // Ennemis
    for (const c of [
      { col: 16, row: 15 },
      { col: 17, row: 16 },
      { col: 15, row: 16 },
    ]) {
      this.units.push(new Unit(this, this.grid, c, "surv", "enemy"));
    }

    this.hpGfx = this.add.graphics().setDepth(90000);

    // Gisements de ferraille
    this.addNode(13, 6, NODE_AMOUNT);
    this.addNode(4, 13, NODE_AMOUNT);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.setupCamera();
    this.setupInput();
    this.addHud();
  }

  override update(_time: number, delta: number): void {
    this.panWithKeys(delta);
    this.edgeScroll(delta);
    this.processCombat(delta);
    this.processProduction(delta);
    for (const u of this.units) u.update(delta);
    this.processHarvest(delta);
    this.resolveSeparation();
    this.drawPaths();
    this.drawSelection();
    this.drawHpBars();
  }

  // --- Rendu ---

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
   * Collision basique : repousse les unités trop proches. Asymétrique — seule
   * l'unité EN MOUVEMENT est déplacée si elle bute sur une unité à l'arrêt
   * (l'immobile garde sa place, celle qui bouge la contourne).
   */
  private resolveSeparation(): void {
    for (let i = 0; i < this.units.length; i++) {
      for (let j = i + 1; j < this.units.length; j++) {
        const ua = this.units[i];
        const ub = this.units[j];
        const a = ua.body;
        const b = ub.body;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d <= 0 || d >= SEPARATION_DIST) continue;

        const overlap = SEPARATION_DIST - d;
        const nx = dx / d;
        const ny = dy / d;
        const am = ua.isMoving;
        const bm = ub.isMoving;

        // part de poussée pour a et pour b
        let sa = 0.5;
        let sb = 0.5;
        if (am && !bm) {
          sa = 1;
          sb = 0;
        } else if (!am && bm) {
          sa = 0;
          sb = 1;
        }

        a.x -= nx * overlap * sa;
        a.y -= ny * overlap * sa;
        b.x += nx * overlap * sb;
        b.y += ny * overlap * sb;
        a.setDepth(a.y);
        b.setDepth(b.y);
      }
    }
  }

  /** Une unité (à l'arrêt) occupe-t-elle cette case ? */
  private isOccupied(col: number, row: number): boolean {
    return this.units.some((u) => u.cell.col === col && u.cell.row === row);
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
    if (this.prodQueue > 0) {
      this.prodTimer += delta;
      if (this.prodTimer >= BUILD_TIME) {
        this.prodTimer = 0;
        this.prodQueue--;
        this.spawnPlayerUnit();
      }
    } else {
      this.prodTimer = 0;
    }
    this.updateProdText();
  }

  private spawnPlayerUnit(): void {
    const spot =
      this.adjacentFreeCell(this.depotAnchor.col, this.depotAnchor.row, this.depotAnchor, null) ??
      { col: this.depotAnchor.col + 1, row: this.depotAnchor.row + 1 };
    this.units.push(new Unit(this, this.grid, spot, "surv", "player"));
  }

  private updateProdText(): void {
    const pct = this.prodQueue > 0 ? Math.floor((this.prodTimer / BUILD_TIME) * 100) : 0;
    const status = this.prodQueue > 0 ? `${this.prodQueue} en file — ${pct}%` : "—";
    this.prodText.setText(`🏭 Production : ${status}   (T = produire, ${UNIT_COST} ferraille)`);
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

      if (dist <= ATTACK_RANGE) {
        u.attacking = true;
        if (u.isMoving) u.stop();
        u.faceTo(dx, dy);
        u.combatTimer -= delta;
        if (u.combatTimer <= 0) {
          u.combatTimer = ATTACK_CD;
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
    const died = target.takeDamage(ATTACK_DAMAGE);
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

  private onUnitDead(u: Unit): void {
    this.selected = this.selected.filter((x) => x !== u);
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
    }
  }

  // --- Économie ---

  private addNode(col: number, row: number, amount: number): void {
    const w = cellToWorld(this.grid, col, row);
    const sprite = this.add
      .image(w.x, w.y, "scrap")
      .setOrigin(0.499, SCRAP_OY)
      .setScale(0.45)
      .setDepth(w.y);
    this.nav.setBlocked(col, row);
    this.nodes.push({ col, row, amount, sprite });
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
          this.scrap += job.carrying;
          job.carrying = 0;
          this.updateScrapText();
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
      node.sprite.setScale(0.45 * (0.5 + (0.5 * node.amount) / NODE_AMOUNT));
    }
  }

  private updateScrapText(): void {
    this.scrapText.setText(`⛏ Ferraille : ${this.scrap}`);
  }

  // --- Caméra & input ---

  private setupCamera(): void {
    this.cameras.main.setZoom(0.9);
    this.cameras.main.centerOn(0, 200);
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
    });

    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      if (p.button === 1) this.panning = false;
      if (p.button === 0 && this.selecting) {
        this.selecting = false;
        this.selBoxGfx.clear();
        const moved =
          Phaser.Math.Distance.Between(this.downX, this.downY, p.x, p.y) > CLICK_THRESHOLD;
        if (moved) this.selectInBox();
        else this.selectSingle(p);
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

    // Produire une unité (dépense de la ferraille)
    this.input.keyboard?.on("keydown-T", () => {
      if (this.scrap >= UNIT_COST) {
        this.scrap -= UNIT_COST;
        this.updateScrapText();
        this.prodQueue++;
      }
    });
  }

  private selectSingle(p: Phaser.Input.Pointer): void {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const u = this.units.find(
      (unit) => unit.team === "player" && !unit.dead && unit.hitTest(w.x, w.y),
    );
    this.selected = u ? [u] : [];
  }

  private selectInBox(): void {
    const x1 = Math.min(this.selStart.x, this.selCur.x);
    const x2 = Math.max(this.selStart.x, this.selCur.x);
    const y1 = Math.min(this.selStart.y, this.selCur.y);
    const y2 = Math.max(this.selStart.y, this.selCur.y);
    this.selected = this.units.filter(
      (u) =>
        u.team === "player" &&
        !u.dead &&
        u.body.x >= x1 &&
        u.body.x <= x2 &&
        u.body.y >= y1 &&
        u.body.y <= y2,
    );
  }

  private commandMove(p: Phaser.Input.Pointer): void {
    if (this.selected.length === 0) return;
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const goal = worldToCell(this.grid, w.x, w.y);

    // Clic sur un ennemi -> ordre d'attaque
    const foe = this.units.find(
      (u) => u.team === "enemy" && !u.dead && u.hitTest(w.x, w.y),
    );
    if (foe) {
      for (const u of this.selected) {
        this.clearJob(u);
        u.attackTarget = foe;
      }
      return;
    }

    // Clic sur un gisement -> ordre de récolte
    const node = this.nodeAt(goal, w);
    if (node) {
      for (const u of this.selected) this.assignHarvest(u, node);
      return;
    }

    // Sinon déplacement de groupe (annule la récolte en cours)
    if (!this.nav.isWalkable(goal.col, goal.row)) return;
    const dests = this.freeCellsAround(goal, this.selected.length);
    this.selected.forEach((u, i) => {
      this.clearJob(u);
      u.attackTarget = null;
      const dest = dests[i] ?? goal;
      const path = findPath(this.nav, u.cell, dest);
      if (path) u.setPath(path);
    });
  }

  private addHud(): void {
    this.add
      .text(
        12,
        12,
        [
          "Phase 1 — multi-unités, économie & combat",
          "Clic gauche : sélection · Clic droit : déplacer / récolter (ferraille) / attaquer (ennemi rouge)",
          "Les ennemis attaquent si tu t'approches. Barres de vie au-dessus des unités.",
          "Caméra : bords de l'écran, flèches, ou clic-molette · Molette : zoom · G : grille",
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

    this.scrapText = this.add
      .text(12, 92, "", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#e8c46a",
        backgroundColor: "#000000cc",
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(1000000);
    this.updateScrapText();

    this.prodText = this.add
      .text(12, 132, "", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#9fd0ff",
        backgroundColor: "#000000cc",
        padding: { x: 10, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(1000000);
    this.updateProdText();
  }
}
