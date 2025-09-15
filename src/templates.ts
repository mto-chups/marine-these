// templates.ts
export type Cell = { c: number; r: number; w?: number; h?: number };
export type Template = Cell[];
import { axialToPixel, type Axial, type Side } from "./hexLayout";

export type PatternKind = "rosace" | "staggered";

/** Détermine le pattern à partir de l'id du slide */
export function pickPatternKind(slideId: string): PatternKind {
  const id = slideId.toLowerCase();
  if (id.includes("staggered")) return "staggered";
  if (id.includes("rosace"))    return "rosace";
  // fallback au besoin :
  return "rosace";
}


/**
 * Exemple 7 bulles :
 *  center au milieu ; trois à gauche empilées et trois à droite, façon capture.
 *  Tu peux ajuster facilement en changeant les sides.
 */
// export const pattern7: Axial[] = [
//   { q: 0, r:  0 }, // 0 centre
//   { q: -0.75, r:  -0.75 }, // 1 W
//   { q: 0.75, r: -1.5 }, // 2 NW
//   { q:1.5, r:  -0.75 }, // 3 SW
//   { q: 0.25, r:  1 }, // 4 E
//   { q: -0.75, r:  1.5 }, // 5 SE
//   { q: -1.5, r: 0.75 }, // 6 NE
// ];

export const pattern7RosaceAxial: Axial[] = [
  { q: 0, r: 0 },   // 0 centre
  { q: +1, r: 0 },  // 1 E
  { q: +1, r: -1 }, // 2 NE
  { q: 0,  r: -1 }, // 3 NW
  { q: -1, r: 0 },  // 4 W
  { q: -1, r: +1 }, // 5 SW
  { q: 0,  r: +1 }, // 6 SE
];

export type PolarDef = { angle: number; radiusK: number };

const pattern7StaggeredPolar: PolarDef[] = [
  { angle:   0, radiusK: 0.0 }, // 0 centre
  { angle: 155, radiusK: 1.3 }, // 1 haut-gauche
  { angle: 180, radiusK: 2 }, // 2 gauche
  { angle: 205, radiusK: 1.3 }, // 3 bas-gauche
  { angle:  25, radiusK: 1.3 }, // 4 haut-droite (plus loin)
  { angle:   0, radiusK: 2 }, // 5 droite
  { angle: 335, radiusK: 1.3 }, // 6 bas-droite
];

export function getPrimaryPointsFor(
  kind: PatternKind,
  count: number,
  sizePrimary: number,
  ringK = 1.0
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];

  if (kind === "rosace") {
    const base = pattern7RosaceAxial.slice(0, Math.min(count, 7));
    const scaled = base.map((a, i) =>
      i === 0 ? a : ({ q: a.q * ringK, r: a.r * ringK })
    );
    for (const a of scaled) out.push(axialToPixel(a as any, sizePrimary));
    return out;
  }

  // kind === "staggered" : on calcule directement en polaire (pixels)
  // Distance de base = distance centre→centre vers un voisin d’hex :
  // L = √3 * size (démonstration : longueur du vecteur (E) en pointy-top)
  const baseRadius = Math.sqrt(3) * sizePrimary;

  const base = pattern7StaggeredPolar.slice(0, Math.min(count, 7));
  for (const p of base) {
    const r = baseRadius * p.radiusK;
    const rad = (p.angle * Math.PI) / 180;
    const x = Math.cos(rad) * r;
    const y = -Math.sin(rad) * r;        // CSS → Y+ vers le bas
    if (p.radiusK === 0) out.push({ x: 0, y: 0 });
    else out.push({ x, y });
  }
  return out;
}


/** ---------- TEMPLATE POLAIRE POUR LES SECONDARY ---------- */
/** angle en degrés (0 = +x droite, 90 = haut), distance = facteur (voir render) */
export type SecPolar = { angle: number; distance?: number };
export type SecPolarTemplate = Partial<Record<number, ReadonlyArray<SecPolar>>>;

export const secPolarRosace7: SecPolarTemplate = {
  0: [{ angle: 90, distance: -0.42 }, { angle: 90, distance: 0.42 }],
  1: [{ angle:   20, distance: 1 }, { angle: -20, distance: 1 }],
  2: [{ angle:  60, distance: 1 }, { angle:  0, distance: 1 }],
  3: [{ angle: 60, distance: 1 }, { angle: 120, distance: 1 }],
  4: [{ angle: 60, distance: 1 }, { angle: 120, distance: 1 }],
  5: [{ angle: 180, distance: 1 }, { angle: 240, distance: 1 }],
  6: [{ angle: 240, distance: 1 }, { angle: 300, distance: 1 }],
} as const;

export const secPolarStaggered7: SecPolarTemplate = {
  0: [{ angle: 90, distance: 0.75 }, { angle: 110, distance: 0.9}],
  1: [{ angle:   70, distance: 0.9 }, { angle: 110, distance: 0.9 }, { angle: 160, distance: 0.95 }],
  2: [{ angle:  130, distance: 0.9 }, { angle:  170, distance: 0.9}],
  3: [{ angle: 190, distance: 0.9 }, { angle: 230, distance: 0.9 }],
  4: [{ angle: 180, distance: 0.9 }, { angle: 120, distance: 0.9 }],
  5: [{ angle: 50, distance: 0.9 }, { angle: 10, distance: 0.9 }],
  6: [{ angle: 310, distance: 0.9 }, { angle: 350, distance: 0.9 }],
} as const;

export function pickSecPolarTemplate(kind: PatternKind): SecPolarTemplate {
  return kind === "staggered" ? secPolarStaggered7 : secPolarRosace7;
}
/* =========================================================


// /**
//  * Template 7 bulles (proche de ta capture) :
//  *  - 3 colonnes gauche
//  *  - 1 grande centrale (w=5, h=2)
//  *  - 3 colonnes droite
//  *
//  * Grille 12 colonnes; "c" = colonne de départ, "r" = ligne; "w/h" = spans.
//  */
// export const template7: Template = [
//   { c: 2,  r: 2, w: 3 },        // 1  Accueil
//   { c: 3,  r: 4, w: 3 },        // 2  Lexique
//   { c: 2,  r: 6, w: 4 },        // 3  Quelques chiffres (un peu plus large)
//   { c: 5,  r: 9, w: 5, h: 2 },  // 4  Multiples transitions (grosse violette)
//   { c: 9,  r: 6, w: 3 },        // 5  Transition sociale
//   { c: 10, r: 8, w: 3 },        // 6  Transition chirurgicale
//   { c: 9,  r: 10, w: 4 },       // 7  Transition administrative et juridique
// ];

// // Fallback simple si le nombre de bulles diffère
// export function pickTemplateByCount(count: number): Template {
//   if (count === 7) return template7;
//   // fallback : colonne auto (chaque holder sur une ligne)
//   return Array.from({ length: count }, (_, i) => ({ c: 2, r: i + 1, w: 4 }));
// }
