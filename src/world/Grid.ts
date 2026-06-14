/**
 * Grille d'occupation logique : pour chaque case, marchable ou bloquée.
 *
 * C'est la couche de SIMULATION (indépendante du rendu) sur laquelle tournent le
 * pathfinding, le placement de bâtiments et plus tard le brouillard de guerre.
 */
export class Grid {
  readonly cols: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.blocked = new Uint8Array(cols * rows);
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  isWalkable(col: number, row: number): boolean {
    return this.inBounds(col, row) && this.blocked[row * this.cols + col] === 0;
  }

  isBlocked(col: number, row: number): boolean {
    return this.inBounds(col, row) && this.blocked[row * this.cols + col] === 1;
  }

  setBlocked(col: number, row: number, value = true): void {
    if (this.inBounds(col, row)) {
      this.blocked[row * this.cols + col] = value ? 1 : 0;
    }
  }

  /** Bloque un rectangle de cases (footprint d'un bâtiment, par ex.). */
  blockRect(col: number, row: number, w: number, h: number): void {
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) this.setBlocked(c, r);
    }
  }
}
