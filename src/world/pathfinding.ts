import type { Cell } from "@/world/iso";
import type { Grid } from "@/world/Grid";

/**
 * Pathfinding A* sur la grille d'occupation.
 *  - 8 directions (diagonales autorisées, coût √2).
 *  - Pas de "corner cutting" : une diagonale est interdite si l'une des deux
 *    cases orthogonales adjacentes est bloquée (l'unité ne traverse pas les coins).
 *  - Heuristique octile (admissible pour du déplacement 8-directions).
 *
 * Retourne la liste des cases du chemin SANS la case de départ (première case =
 * premier pas), ou `null` si la cible est inatteignable.
 */

interface Dir {
  dc: number;
  dr: number;
  cost: number;
}

const DIRS: Dir[] = [
  { dc: 1, dr: 0, cost: 1 },
  { dc: -1, dr: 0, cost: 1 },
  { dc: 0, dr: 1, cost: 1 },
  { dc: 0, dr: -1, cost: 1 },
  { dc: 1, dr: 1, cost: Math.SQRT2 },
  { dc: 1, dr: -1, cost: Math.SQRT2 },
  { dc: -1, dr: 1, cost: Math.SQRT2 },
  { dc: -1, dr: -1, cost: Math.SQRT2 },
];

interface Node {
  col: number;
  row: number;
  g: number;
  f: number;
}

export function findPath(
  grid: Grid,
  start: Cell,
  goal: Cell,
  extraBlocked?: ReadonlySet<number>,
): Cell[] | null {
  const cols = grid.cols;
  const key = (c: number, r: number): number => r * cols + c;
  const walkable = (c: number, r: number): boolean =>
    grid.isWalkable(c, r) && !(extraBlocked !== undefined && extraBlocked.has(key(c, r)));

  if (!walkable(goal.col, goal.row)) return null;
  if (start.col === goal.col && start.row === goal.row) return [];
  const h = (c: number, r: number): number => {
    const dc = Math.abs(c - goal.col);
    const dr = Math.abs(r - goal.row);
    return dc + dr + (Math.SQRT2 - 2) * Math.min(dc, dr);
  };

  const openList: Node[] = [{ col: start.col, row: start.row, g: 0, f: h(start.col, start.row) }];
  const gScore = new Map<number, number>([[key(start.col, start.row), 0]]);
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();

  while (openList.length > 0) {
    // extrait le noeud de plus petit f (liste courte : scan linéaire suffisant)
    let best = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[best].f) best = i;
    }
    const cur = openList.splice(best, 1)[0];
    const ck = key(cur.col, cur.row);

    if (cur.col === goal.col && cur.row === goal.row) {
      const path: Cell[] = [];
      let k = ck;
      while (cameFrom.has(k)) {
        const c = k % cols;
        const r = (k - c) / cols;
        path.push({ col: c, row: r });
        k = cameFrom.get(k)!;
      }
      return path.reverse();
    }

    closed.add(ck);

    for (const d of DIRS) {
      const nc = cur.col + d.dc;
      const nr = cur.row + d.dr;
      if (!walkable(nc, nr)) continue;
      if (d.dc !== 0 && d.dr !== 0) {
        if (!walkable(cur.col + d.dc, cur.row)) continue;
        if (!walkable(cur.col, cur.row + d.dr)) continue;
      }
      const nk = key(nc, nr);
      if (closed.has(nk)) continue;

      const tentative = cur.g + d.cost;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, ck);
        gScore.set(nk, tentative);
        const f = tentative + h(nc, nr);
        const existing = openList.find((n) => n.col === nc && n.row === nr);
        if (existing) {
          existing.g = tentative;
          existing.f = f;
        } else {
          openList.push({ col: nc, row: nr, g: tentative, f });
        }
      }
    }
  }

  return null;
}
