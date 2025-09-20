import { ca } from "zod/v4/locales";
import type { Block, BubbleBlock, Bubble, PrimaryBubble, SecondaryBubble, Media, Slide } from "./types";
import { axialToPixel, normalize, sideVectorPx } from "./hexLayout";
import { SecPolar } from "./templates";
import { pickPatternKind, getPrimaryPointsFor, pickSecPolarTemplate } from "./templates";


const el = (tag: string, attrs: Record<string, any> = {}, ...children: (Node|string|undefined)[]) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;

    if (k === "class") node.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v as any);
    else if (k === "style" && typeof v === "object") {
      for (const [prop, val] of Object.entries(v)) {
        if (val == null) continue;
        if (prop.startsWith("--")) {
          node.style.setProperty(prop, String(val));   // ✅ custom properties
        } else {
          // @ts-ignore - assignation classique pour les props connues (camelCase ok)
          node.style[prop] = String(val);
        }
      }
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const c of children) if (c !== undefined) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
};


/* ---------- MODALE ---------- */
function openModal(title: string, media: Media[]) {
  const escHandler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
  const close = () => {
    document.removeEventListener("keydown", escHandler);
    backdrop.remove();
  };

  const content = el("div", { class: "media" },
    ...media.map(renderMedia)
  );

  const modal = el("div", { class: "modal", role: "dialog", "aria-modal": "true" },
    el("header", {},
      el("button", { class: "close", "aria-label": "Fermer", onclick: close }, "×")
    ),
    content
  );

  const backdrop = el("div", { class: "modal-backdrop", onclick: (e: MouseEvent) => { if (e.target === backdrop) close(); } }, modal);
  document.body.appendChild(backdrop);
  document.addEventListener("keydown", escHandler);
}

function renderMedia(m: Media): HTMLElement {
  switch (m.kind) {
    case "title":
      return el("h2", {}, m.text);
    case "text": {
      const div = el("div");
      // ⚠️ si tu utilises html, pense à DOMPurify si la source n’est pas 100% sûre.
      if (m.html) div.innerHTML = m.html;
      else div.textContent = m.markdown ?? ""; // tu peux brancher marked() + sanitization ici
      return div;
    }
    case "image":
      return el("figure", {},
        el("img", { src: m.src, alt: m.alt ?? "" }),
        m.caption ? el("figcaption", {}, m.caption) : undefined
      );
    case "video":
      return el("video", {
        src: m.src,
        poster: m.poster ?? "",
        autoplay: m.autoplay ? true : undefined,
        controls: m.controls ?? true,
        loop: m.loop ? true : undefined
      });
  }
}

/* ---------- BULLES ---------- */
function renderBubble(b: Bubble, abs = false): HTMLElement {
  const isSecondary = b.kind === "secondary";
  const ariaLabel = isSecondary ? (b.title ?? b.tooltip?.text ?? "Plus d'infos"): (b.title ?? "Bulle");

  const baseColor  = b.color ?? (isSecondary ? "#f5c842" : "#f55f63");
  const hoverColor = darken(baseColor, 0.88);

  // crée le bouton sans la classe bubble-abs (on l'appliquera au wrapper si besoin)
  const btn = el("button", {
    class: ["bubble", isSecondary ? "secondary" : "", b.clickable ? "clickable" : ""]
      .filter(Boolean).join(" "),
    type: "button",
    "data-abs": String(Boolean(b.position && abs)),
    "aria-label": ariaLabel,
    style: { "--bubble-bg": baseColor, "--hover-color": hoverColor } as any

  }, isSecondary ? "+" : (b.title ?? "")) as HTMLButtonElement;

  // ---------- Tooltip ----------
  const tooltipText = b.tooltip?.text;

  if (!isSecondary && (tooltipText || b.tooltip?.html)) {
    // Primaire avec tooltip → wrapper non clippé
    const wrap = el("div", { class: abs ? "bubble-wrap bubble-abs" : "bubble-wrap" });
    wrap.appendChild(btn); // le bouton est clippé, mais le wrap ne l’est pas

    const tip = el("div", { class: "tooltip-pop", role: "tooltip" });
    if (b.tooltip?.html) {
      tip.innerHTML = b.tooltip.html;   // ⚠️ si JSON non sûr → DOMPurify
    } else {
      tip.textContent = tooltipText!;
    }
    wrap.appendChild(tip);

    // Clic -> modale si clickable
    if (b.clickable && b.modalContent?.length) {
    wrap.addEventListener("click", () => openModal(b.title ?? ariaLabel, b.modalContent!));
      wrap.style.cursor = "pointer";
    }

    return wrap;
  }

  // Secondaire (ou primaire sans tooltip) → bouton direct
  if (abs) btn.classList.add("bubble-abs");

  if (b.clickable && b.modalContent?.length) {
    btn.addEventListener("click", () => openModal(b.title ?? ariaLabel, b.modalContent!));
  }

  return btn;
}


function renderBubbleBlock(block: BubbleBlock, slideId?: string): HTMLElement {
  const container = el("section", { class: "bubble-layer" });

  // ----- 1) Pattern primaire selon l'ID du slide -----
  const kind = pickPatternKind(slideId ?? ""); // "rosace" | "staggered"
  const sizePrimary   = 100;   // rayon visuel de la bulle primaire
  const ringK         = 1.25; // n'agit que pour la rosace (écarte l’anneau)

  // positions "centre" des primaires (en pixels, relatif au (0,0))
  const primaryPx = getPrimaryPointsFor(kind, block.bubbles.length, sizePrimary, ringK);

  // on translate pour tout mettre en coordonnées positives + padding
  const { shiftX, shiftY, width, height } = normalize(primaryPx, 30);
   (container as HTMLElement).style.width = `${width}px`;
  (container as HTMLElement).style.height = `${height}px`; 

  // ----- 2) Paramètres secondaires -----
  const sizeSecondary = 30;   // rayon visuel d’un "+"
  const margin        = 6;    // espace entre primaire et secondaire
  const baseDist      = sizePrimary + sizeSecondary + margin; // centre->centre de base
  const tooltipFactor = 1.6;  // tooltip plus loin que le "+"
  const secTemplate = pickSecPolarTemplate(kind);

  // ----- 3) Rendu -----
  block.bubbles.forEach((primary, i) => {
    const pPt = primaryPx[i];
    if (!pPt) return;

    // Holder global positionné au centre de la primaire
    const holder = el("div", { class: "bubble-holder" }) as HTMLDivElement;
    holder.style.left = `${pPt.x + shiftX}px`;
    holder.style.top  = `${pPt.y + shiftY}px`;

    // Repère local centré
    const node = el("div", { class: "bubble-node" });
    const pEl = renderBubble(primary, true);
    pEl.classList.add("bubble-abs");
    node.appendChild(pEl);

    // ----- Secondaires en polaire -----
    const defs: ReadonlyArray<SecPolar> = secTemplate[i] ?? [];
    const secs = primary.secondaries ?? [];
    const MAX_SECONDARIES = 4;
    const count = Math.min(MAX_SECONDARIES, defs.length, secs.length);

    for (let k = 0; k < count; k++) {
      const slot = defs[k];
      const sec  = secs[k];
      if (!slot || !sec) continue;

      const angle = slot.angle;
      const distance = slot.distance ?? 1;

      const rad  = (angle * Math.PI) / 180;
      const dist = baseDist * distance;

      // position du "+"
      const dx = Math.cos(rad) * dist;
      const dy = Math.sin(rad) * dist * -1; // Y CSS vers le bas

      const secWrap = el("div", { class: "sec-wrap" }) as HTMLDivElement;
      secWrap.style.left = `${dx}px`;
      secWrap.style.top  = `${dy}px`;

      const secBtn = renderBubble(sec, true);
      secBtn.classList.add("bubble-abs");
      secWrap.appendChild(secBtn);

      // tooltip secondaire sur le même angle, plus loin
      const tipText = sec.tooltip?.text;
      const tipHtml = sec.tooltip?.html;
      if (tipText || tipHtml) {
        const tipDist = dist * tooltipFactor;
        const tdx = Math.cos(rad) * (tipDist - dist);
        const tdy = Math.sin(rad) * (tipDist - dist) * -1;

        const tipEl = el("div", { class: "tooltip-abs", role: "tooltip" }) as HTMLDivElement;
        if (tipHtml) {
          tipEl.innerHTML = tipHtml;  // ⚠️ dompurify si besoin
        } else {
          tipEl.textContent = tipText!;
        }
        tipEl.style.left = `${tdx}px`;
        tipEl.style.top  = `${tdy}px`;
        secWrap.appendChild(tipEl);
      }

      node.appendChild(secWrap);
    }

    holder.appendChild(node);
    container.appendChild(holder);
  });

  (container as HTMLElement).style.minHeight = `${height}px`;
  return container;
}


/* ---------- Rendu slide global ---------- */
function renderBlock(b: Block, slideId?:string): HTMLElement {
  switch (b.type) {
    case "title": return el("h1", {}, b.text);
    case "subtitle": return el("h2", {}, b.text);
    case "text": {
      const div = el("div");
      if (b.html) div.innerHTML = b.html; else div.textContent = b.markdown ?? "";
      return div;
    }
    case "image":
      return el("figure", { style: b.width ? `max-width:${b.width}px` : "" },
        el("img", { src: b.src, alt: b.alt ?? "" }),
        b.caption ? el("figcaption", {}, b.caption) : undefined
      );
    case "quiz":
      return renderQuiz(b.question, b.choices, b.answerIndex);
    case "bubble-block":
      const stage = el("div", { class: "bubble-stage" });
      const layer = renderBubbleBlock(b, slideId); // renvoie <section class="bubble-layer">
      stage.appendChild(layer);
      return stage;
    default:
      return el("div"); 
  }
}

function renderQuiz(question: string, choices: string[], answerIndex: number): HTMLElement {
  const container = el("section", { class: "quiz" },
    el("h2", {}, question),
    el("ul", { role: "list" },
      ...choices.map((c, i) => {
        const li = el("li", {});
        const btn = el("button", { type: "button" }, c) as HTMLButtonElement;
        btn.addEventListener("click", () => {
          const correct = i === answerIndex;
          btn.setAttribute("aria-pressed", "true");
          btn.style.outline = "2px solid " + (correct ? "green" : "red");
        });
        li.appendChild(btn);
        return li;
      })
    )
  );
  return container;
}

export function renderSlide(slide: Slide, mount: HTMLElement) {
  mount.replaceChildren(...slide.blocks.map(b => renderBlock(b, slide.id)));
  fitBubbleLayer();
  // re-fit après images/polices
  window.requestAnimationFrame(fitBubbleLayer);
  document.fonts?.ready?.then(fitBubbleLayer).catch(()=>{});
}

function fitBubbleLayer() {
  const stage = document.querySelector('.bubble-stage') as HTMLElement | null;
  const layer = document.querySelector('.bubble-layer') as HTMLElement | null;
  if (!stage || !layer) return;

  // Mesure sans tenir compte du scale actuel
  layer.style.setProperty('--scale', '1');

  const contentW = layer.scrollWidth  || layer.getBoundingClientRect().width;
  const contentH = layer.scrollHeight || layer.getBoundingClientRect().height;

  const pad = 12;
  let availW = Math.max(1, stage.clientWidth  - pad * 2);
  let availH = Math.max(1, stage.clientHeight - pad * 2);

  if (window.visualViewport) {
    availW = Math.min(availW, window.visualViewport.width  - pad * 2);
    availH = Math.min(availH, window.visualViewport.height - pad * 2);
  }

  const sx = availW / contentW;
  const sy = availH / contentH;

  let scale = Math.min(sx, sy);

  // Si on a encore de la place (scale >= 1), on plafonne à 1
  if (scale >= 1) {
    scale = 1; // pas de shrink inutile
  } else {
    // Quand ça déborde, on applique une petite marge (genre 0.95)
    scale *= 0.95;
  }
  layer.style.setProperty('--scale', scale.toFixed(2));
}

/** Debounce basique */
function debounce<T extends (...args:any)=>void>(fn: T, ms = 100) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

const fitDebounced = debounce(fitBubbleLayer, 100);

window.addEventListener('resize', fitDebounced);
window.addEventListener('orientationchange', fitDebounced);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitDebounced);
  window.visualViewport.addEventListener('scroll', fitDebounced); // iOS fait bouger le viewport
}
window.addEventListener('resize', debounce(fitBubbleLayer, 100));

// Utils couleur
function parseColorToRGB(c: string): { r: number; g: number; b: number } {
  // #rgb
  if (/^#([0-9a-f]{3})$/i.test(c)) {
    const m = c.slice(1);
    if(!m || !m[0] || !m[1] || !m[2]) return { r: 245, g: 95, b: 99 };
    const r = parseInt(m[0] + m[0], 16);
    const g = parseInt(m[1] + m[1], 16);
    const b = parseInt(m[2] + m[2], 16);
    return { r, g, b };
  }
  // #rrggbb
  if (/^#([0-9a-f]{6})$/i.test(c)) {
    const n = parseInt(c.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  // rgb / rgba
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m && m[1] && m[2] && m[3]) return { r: +m[1], g: +m[2], b: +m[3] };
  // fallback neutre
  return { r: 245, g: 95, b: 99 }; // proche de #f55f63
}

function darken(c: string, factor = 0.85): string {
  const { r, g, b } = parseColorToRGB(c);
  const R = Math.max(0, Math.min(255, Math.round(r * factor)));
  const G = Math.max(0, Math.min(255, Math.round(g * factor)));
  const B = Math.max(0, Math.min(255, Math.round(b * factor)));
  return `rgb(${R}, ${G}, ${B})`;
}
