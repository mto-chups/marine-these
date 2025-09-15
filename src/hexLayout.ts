export type Axial = { q: number; r: number };

export function axialToPixel(a: Axial, size: number) {
  const h = Math.sqrt(3) * size;       // height d'un hex
  const x = (3/2) * size * a.q;
  const y = h * (a.r + a.q/2);
  return { x, y };
}

/* vecteurs axiaux d’un pas (grille pointy-top) */
export type Side = "E" | "NE" | "NW" | "W" | "SW" | "SE";

const axialOffsets: Record<Side, readonly [number, number]> = {
  E:  [ +1,  0],
  NE: [ +1, -1],
  NW: [  0, -1],
  W:  [ -1,  0],
  SW: [ -1, +1],
  SE: [  0, +1],
};

/** Renvoie le vecteur pixel correspondant à 1 "pas" sur le côté demandé.
 *  `k` = distance en nombre de "pas" (1 = centres hex voisins).
 *  `size` = rayon de l'hex de référence (on prend celui de la primaire).
 */
export function sideVectorPx(side: Side, size: number, k = 1) {
  const offset = axialOffsets[side];
  if (!offset) {
    console.warn(`sideVectorPx: côté "${side}" inconnu`);
    return { dx: 0, dy: 0 };
  }
  const [dq, dr] = offset;
  const { x, y } = axialToPixel({ q: dq * k, r: dr * k }, size);
  return { dx: x, dy: y };
}

/**
 * Donne le côté "extérieur" pour une bulle primaire située en (q,r).
 * - (0,0) est le centre → retourne null (pas d’extérieur).
 * - Sinon on calcule l’angle et on choisit le secteur le plus proche.
 */
export function outwardSideFor(a: Axial): Side | null {
  if (a.q === 0 && a.r === 0) return null; // le centre n’a pas d’extérieur

  // Convertit en pixels (unitaires)
  const { x, y } = axialToPixel(a, 1);

  // angle en radians
  const ang = Math.atan2(y, x); // [-π, π]

  // secteur sur 6 directions (chaque secteur = 60° = π/3)
  let sector = Math.round(ang / (Math.PI / 3));

  // remet dans [0..5]
  sector = (sector + 6) % 6;

  // table adaptée pour hexagones "pointy-top"
  const table: Side[] = ["E", "SE", "SW", "W", "NW", "NE"];

  const result = table[sector];
  if (!result) {
    console.warn(`outwardSideFor: secteur invalide ${sector} (ang=${ang})`);
    return "E";
  }
  return result;
}

export function normalize(
  pts: { x: number; y: number }[],
  pad = 0
): { shiftX: number; shiftY: number; width: number; height: number } {
  if (!pts.length) return { shiftX: pad, shiftY: pad, width: pad * 2, height: pad * 2 };

  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const shiftX = pad - minX;
  const shiftY = pad - minY;
  const width  = (maxX - minX) + pad * 2;
  const height = (maxY - minY) + pad * 2;

  return { shiftX, shiftY, width, height };
}
