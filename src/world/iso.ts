/**
 * Conversions grille logique <-> écran pour un rendu isométrique 2:1.
 *
 * Principe clé du projet : la SIMULATION raisonne en cases (col, row) sur une
 * grille abstraite, indépendamment de l'art. Le RENDU traduit ces cases en
 * pixels via ces helpers. On peut donc changer les assets sans toucher la logique.
 *
 * La grille est "diamant" : la case (0,0) est centrée sur `origin`, col augmente
 * vers le bas-droite, row vers le bas-gauche.
 *
 * La géométrie est portée par un objet `IsoGrid` (et non des constantes) pour
 * pouvoir CALIBRER la grille sur un décor peint donné.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Cell {
  col: number;
  row: number;
}

export interface IsoGrid {
  /** Largeur d'une case iso en pixels (diagonale horizontale du losange). */
  tileWidth: number;
  /** Hauteur d'une case iso en pixels (diagonale verticale du losange). */
  tileHeight: number;
  /** Position monde du centre de la case (0,0). */
  origin: Point;
}

/**
 * Grille calibrée sur le pack "Golbanc Homestead" (via l'outil de PocScene).
 * Les arêtes des losanges sont parallèles aux bords du décor peint.
 */
export const DEFAULT_GRID: IsoGrid = {
  tileWidth: 270,
  tileHeight: 156,
  origin: { x: 0, y: 0 },
};

/** Centre écran (en coordonnées monde) du centre de la case (col, row). */
export function cellToWorld(grid: IsoGrid, col: number, row: number): Point {
  return {
    x: grid.origin.x + (col - row) * (grid.tileWidth / 2),
    y: grid.origin.y + (col + row) * (grid.tileHeight / 2),
  };
}

/** Case (col, row) contenant le point monde (x, y). */
export function worldToCell(grid: IsoGrid, x: number, y: number): Cell {
  const dx = x - grid.origin.x;
  const dy = y - grid.origin.y;
  const col = (dx / (grid.tileWidth / 2) + dy / (grid.tileHeight / 2)) / 2;
  const row = (dy / (grid.tileHeight / 2) - dx / (grid.tileWidth / 2)) / 2;
  return { col: Math.floor(col), row: Math.floor(row) };
}

/** Les 4 sommets (monde) du losange d'une case — utile pour dessiner la grille. */
export function cellCorners(grid: IsoGrid, col: number, row: number): Point[] {
  const c = cellToWorld(grid, col, row);
  return [
    { x: c.x, y: c.y - grid.tileHeight / 2 }, // haut
    { x: c.x + grid.tileWidth / 2, y: c.y }, // droite
    { x: c.x, y: c.y + grid.tileHeight / 2 }, // bas
    { x: c.x - grid.tileWidth / 2, y: c.y }, // gauche
  ];
}
