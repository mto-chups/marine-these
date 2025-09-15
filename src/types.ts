// src/types.ts
import { z } from "zod";

/* =========================================================
 * Media
 * =======================================================*/
export const TitleMediaSchema = z.object({
  kind: z.literal("title"),
  text: z.string().trim().min(1),
}).refine(m => !!m.text, {
  message: "Media.text: 'title' est requis",
});;

export const TextMediaSchema = z.object({
  kind: z.literal("text"),
  html: z.string().trim().min(1).optional(),
  markdown: z.string().trim().min(1).optional(),
}).refine(m => !!m.html || !!m.markdown, {
  message: "Media.text: 'html' ou 'markdown' est requis",
});

export const ImageMediaSchema = z.object({
  kind: z.literal("image"),
  src: z.string().url({ message: "image.src doit être une URL valide" }),
  alt: z.string().trim().optional(),
  caption: z.string().trim().optional(),
});

export const VideoMediaSchema = z.object({
  kind: z.literal("video"),
  src: z.string().url({ message: "video.src doit être une URL valide" }),
  poster: z.string().url().optional(),
  autoplay: z.boolean().optional(),
  controls: z.boolean().default(true).optional(),
  loop: z.boolean().optional(),
});

export const MediaSchema = z.discriminatedUnion("kind", [
  TitleMediaSchema,
  TextMediaSchema,
  ImageMediaSchema,
  VideoMediaSchema,
]);

export type Media = z.infer<typeof MediaSchema>;

// --- Layout grille au niveau du block ---
export const BubbleGridSchema = z.object({
  cols: z.number().int().positive(),           // nb colonnes
  rows: z.number().int().positive(),           // nb lignes
  gap: z.number().nonnegative().default(16).optional(), // px
  align: z.enum(["start","center","end","stretch"]).default("center").optional(),  // alignement global
  justify: z.enum(["start","center","end","stretch"]).default("center").optional()
});
export type BubbleGrid = z.infer<typeof BubbleGridSchema>;

// --- Position de bulle sur la grille ---
export const GridPosSchema = z.object({
  c: z.number().int().positive(),              // colonne de départ (1-based)
  r: z.number().int().positive(),              // ligne de départ (1-based)
  cs: z.number().int().positive().optional(),  // column span
  rs: z.number().int().positive().optional()   // row span
});
export type GridPos = z.infer<typeof GridPosSchema>;

/* =========================================================
 * Bubble Base
 * =======================================================*/
const PositionSchema = z.object({ x: z.number(), y: z.number() });

const TooltipSchema = z.object({
  text: z.string().optional(),
  html: z.string().optional(), 
}).refine(obj => obj.text || obj.html, {
  message: "Un tooltip doit avoir soit `text`, soit `html`",
});

const BubbleBaseRaw = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
  clickable: z.boolean(),
  color: z.string().optional(),// couleur CSS (ex: "#f5c842")
  position: PositionSchema.optional(),
  gridPos: GridPosSchema.optional(), 
  tooltip: TooltipSchema.optional(),
  modalContent: z.array(MediaSchema).optional(),
});

type BubbleBaseRaw = z.infer<typeof BubbleBaseRaw>;

// ✅ On factorise la règle pour la réutiliser
const bubbleBusinessRules = (b: BubbleBaseRaw, ctx: z.RefinementCtx) => {
  if (b.clickable) {
    if (!b.modalContent || b.modalContent.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bulle cliquable: 'modalContent' est requis et non vide.",
        path: ["modalContent"],
      });
    }
  } else {
    const hasTooltipText = Boolean(b.tooltip?.text && b.tooltip.text.trim().length > 0 || b.tooltip?.html && b.tooltip.html.trim().length > 0);
    if (!hasTooltipText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bulle non cliquable: 'tooltip.text' est requis (contenu au survol).",
        path: ["tooltip", "text"],
      });
    }
  }
};

// On garde BubbleBaseSchema si tu veux le réutiliser tel quel
export const BubbleBaseSchema = BubbleBaseRaw.superRefine(bubbleBusinessRules);
export type BubbleBase = z.infer<typeof BubbleBaseSchema>;

/* =========================================================
 * Bubbles (Primary / Secondary)
 * =======================================================*/
// 🔧 On étend d'abord le "raw", puis on applique la même règle
export const SecondaryBubbleSchema = BubbleBaseRaw
  .extend({
    kind: z.literal("secondary"),
    parentId: z.string().trim().min(1),
  })
   .superRefine((b, ctx) => {
    bubbleBusinessRules(b, ctx);
    if (b.clickable) {
      const hasTitle = typeof b.title === "string" && b.title.trim().length > 0;
      if (!hasTitle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Secondary cliquable : 'title' est requis.",
          path: ["title"],
        });
      }
    }
  });

export type SecondaryBubble = z.infer<typeof SecondaryBubbleSchema>;

export const PrimaryBubbleSchema = BubbleBaseRaw
  .extend({
    kind: z.literal("primary"),
    secondaries: z.array(SecondaryBubbleSchema).optional(),
  })
  .superRefine((b, ctx) => {
    bubbleBusinessRules(b, ctx);
    const hasTitle = typeof b.title === "string" && b.title.trim().length > 0;
    if (!hasTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Primary : 'title' est requis.",
        path: ["title"],
      });
    }
  });

export type PrimaryBubble = z.infer<typeof PrimaryBubbleSchema>;

export const BubbleSchema = z.discriminatedUnion("kind", [
  PrimaryBubbleSchema,
  SecondaryBubbleSchema,
]);

export type Bubble = z.infer<typeof BubbleSchema>;


/* =========================================================
 * Blocks
 * =======================================================*/
export const TitleBlockSchema = z.object({
  type: z.literal("title"),
  text: z.string().trim().min(1),
});

export const SubTitleBlockSchema = z.object({
  type: z.literal("subtitle"),
  text: z.string().trim().min(1),
});

export const TextBlockSchema = z.object({
  type: z.literal("text"),
  html: z.string().trim().min(1).optional(),
  markdown: z.string().trim().min(1).optional(),
}).refine(b => !!b.html || !!b.markdown, {
  message: "Block text: 'html' ou 'markdown' requis",
});

export const ImageBlockSchema = z.object({
  type: z.literal("image"),
  src: z.string().url(),
  alt: z.string().trim().optional(),
  caption: z.string().trim().optional(),
  width: z.number().int().positive().optional(),
});

export const QuizBlockSchema = z.object({
  type: z.literal("quiz"),
  question: z.string().trim().min(1),
  choices: z.array(z.string().trim().min(1)).min(2, "Au moins 2 choix"),
  answerIndex: z.number().int().nonnegative(),
}).refine(b => b.answerIndex < b.choices.length, {
  message: "answerIndex doit référencer un choix existant",
  path: ["answerIndex"],
});

export const BubbleLayoutSchema = z.object({
  centerPadding: z.number().nonnegative().optional(),   // marge autour du centre
  primaryRingScale: z.number().positive().optional(),   // 0.8 par défaut
  secondaryRingScale: z.number().positive().optional(), // 0.18 par défaut
});
export type BubbleLayout = z.infer<typeof BubbleLayoutSchema>;

export const BubbleBlockSchema = z.object({
  type: z.literal("bubble-block"),
  // On stocke un tableau de primaires (avec secondaires optionnelles imbriquées)
  bubbles: z.array(PrimaryBubbleSchema).min(1, "Au moins une bulle primaire"),
  layout: BubbleLayoutSchema.optional(),
  grid: BubbleGridSchema.optional() 
});


export type BubbleBlock = z.infer<typeof BubbleBlockSchema>;

export const BlockSchema = z.discriminatedUnion("type", [
  TitleBlockSchema,
  SubTitleBlockSchema,
  TextBlockSchema,
  ImageBlockSchema,
  QuizBlockSchema,
  BubbleBlockSchema,
]);

export type Block = z.infer<typeof BlockSchema>;


/* =========================================================
 * Slide / Deck
 * =======================================================*/
export const SlideSchema = z.object({
  id: z.string().trim().min(1),
  blocks: z.array(BlockSchema).min(1),
});

export type Slide = z.infer<typeof SlideSchema>;

export const DeckSchema = z.object({
  title: z.string().trim().optional(),
  slides: z.array(SlideSchema).min(1, "Le deck doit contenir au moins une slide"),
})
/**
 * (Optionnel) Validation croisée:
 * S'assure que chaque SecondaryBubble.parentId pointe vers une PrimaryBubble existante
 * dans la même slide si tu les mets à plat; ici on a des secondaires imbriquées,
 * donc la contrainte est naturellement respectée. Si tu décides plus tard d'autoriser
 * des secondaires 'hors' de la propriété secondaries, il faudra ajouter une passe
 * de validation personnalisée pour vérifier les parentId.
 */
;

export type Deck = z.infer<typeof DeckSchema>;

/* =========================================================
 * Helpers
 * =======================================================*/

/** Valide et renvoie un Deck typé (throw si invalide) */
export function parseDeck(data: unknown): Deck {
  return DeckSchema.parse(data);
}

/** Essai de validation sans throw */
export function safeParseDeck(data: unknown) {
  return DeckSchema.safeParse(data);
}
