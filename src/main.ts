// src/main.ts
import { loadJSON } from "./utils";
import { parseRoute, toHash } from "./router";
import { renderSlide } from "./render";
import { parseDeck, safeParseDeck, type Deck } from "./types";
import { th } from "zod/v4/locales";

const app = document.getElementById("app")!;
const pos = document.getElementById("pos")!;
const prevBtn = document.getElementById("prevBtn") as HTMLButtonElement;
const nextBtn = document.getElementById("nextBtn") as HTMLButtonElement;

let deck: Deck;
let currentIdx = 0;

async function fetchDeck(): Promise<unknown> {
  // Vite sert /public/* à la racine => /slides.json
  // Si ton projet a été codé avec /public/slides.json, on essaie en fallback.
  const urls = ["/slides.json", "/public/slides.json"];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const data = await loadJSON<unknown>(url);
      console.info(`[deck] Chargé depuis ${url}`);
      return data;
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[deck] Échec ${url}: ${msg}`);
      errors.push(`${url}: ${msg}`);
    }
  }
  throw new Error(`Impossible de charger le deck.\n${errors.join("\n")}`);
}

function showError(message: string, details?: string[]) {
  const pre = document.createElement("pre");
  pre.style.whiteSpace = "pre-wrap";
  pre.style.background = "#fff0f0";
  pre.style.border = "1px solid #ffd0d0";
  pre.style.padding = "12px";
  pre.style.borderRadius = "8px";
  pre.textContent = message + (details?.length ? `\n\nDétails:\n- ${details.join("\n- ")}` : "");
  app.replaceChildren(pre);
}

async function init() {
  try {
    const raw = await fetchDeck();

    // Utilise safeParse pour afficher les issues Zod si invalide
    const parsed = safeParseDeck(raw);
    if (!parsed.success) {
      const issueLines = parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"} → ${i.message}`
      );
      console.error("[Zod] Deck invalide:", parsed.error);
      showError("Erreur : le JSON des slides ne valide pas le schéma Zod.", issueLines);

      // Astuce souvent utile :
      // - Si tu utilises des chemins relatifs pour images/vidéos (ex: "img/foo.png"),
      //   modifie le schéma pour accepter des strings non vides (min(1)) au lieu de .url().
      // - Vérifie que toutes les bulles cliquables ont modalContent non vide,
      //   et que les bulles non cliquables ont tooltip.text défini.
      return;
    }

    deck = parsed.data;

  } catch (e: any) {
    console.error("Erreur de chargement/validation du deck:", e);
    showError("Erreur : deck JSON introuvable ou illisible.", [String(e?.message ?? e)]);
    return;
  }

  if (!location.hash) location.hash = toHash(0);
  handleRouteChange();

  window.addEventListener("hashchange", handleRouteChange);
  prevBtn.addEventListener("click", () => navigate(-1));
  nextBtn.addEventListener("click", () => navigate(+1));

  // Navigation clavier (← / →)
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") navigate(-1);
    else if (e.key === "ArrowRight") navigate(+1);
  });
}

function handleRouteChange() {
  if (!deck) return;
  const { slideIdx } = parseRoute(location.hash);
  currentIdx = clamp(slideIdx, 0, deck.slides.length - 1);
  const slide = deck.slides[currentIdx];
  if (!slide) {throw new Error(`Slide index ${currentIdx} introuvable`); }
  renderSlide(slide, app);
  pos.textContent = `Slide ${currentIdx + 1}/${deck.slides.length}`;
  updateNavState();
}

function navigate(delta: number) {
  const next = clamp(currentIdx + delta, 0, deck.slides.length - 1);
  if (next !== currentIdx) location.hash = toHash(next);
}

function updateNavState() {
  prevBtn.disabled = currentIdx === 0;
  nextBtn.disabled = currentIdx === deck.slides.length - 1;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

init();
