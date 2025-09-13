import { ca } from "zod/v4/locales";
import type { Block, BubbleBlock, Bubble, PrimaryBubble, SecondaryBubble, Media, Slide } from "./types";

const el = (tag: string, attrs: Record<string, any> = {}, ...children: (Node|string|undefined)[]) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === "class") node.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v as any);
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else node.setAttribute(k, String(v));
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
  const ariaLabel =
    isSecondary
      ? (b.title ?? b.tooltip?.text ?? "Plus d'infos")
      : (b.title ?? "Bulle");

   const node = el("button",
    {
      class: ["bubble", isSecondary ? "secondary" : "", b.clickable ? "clickable" : ""].filter(Boolean).join(" "),
      type: "button",
      "data-abs": String(Boolean(b.position && abs)),
      style: b.position && abs ? { left: `${b.position.x}px`, top: `${b.position.y}px` } : undefined,
      "aria-label": ariaLabel, // ← fallback propre
    },
    isSecondary ? "+" : (b.title ?? "") // les secondaires affichent "+"
  ) as HTMLButtonElement;

  // Tooltip si défini
  const tooltipText = b.tooltip?.text;
  if (tooltipText) {
    const tip = el("div", { class: "tooltip", role: "tooltip" }, tooltipText);
    node.appendChild(tip);
  }

  // Clic => modale si clickable et media fourni
  if (b.clickable && b.modalContent?.length) {
    node.addEventListener("click", () => openModal(b.title ?? ariaLabel, b.modalContent!));
  }

  // Si non clickable mais tooltip absent et on veut un survol texte brut:
  // (déjà géré via tooltip ci-dessus — tu peux étendre si besoin)

  return node;
}

function renderBubbleBlock(block: BubbleBlock): HTMLElement {
  // conteneur des bulles (tu peux passer en layout absolu si les positions sont fournies)
  const container = el("section", { class: "bubble-layer" });

  // Indexer les primaires pour rattacher d’éventuelles secondaires isolées (si tu choisis cette option plus tard)
  const mapPrimary = new Map<string, PrimaryBubble>();
  for (const p of block.bubbles) mapPrimary.set(p.id, p);

  // Rendu : primaires puis secondaires attachées
  for (const p of block.bubbles) {
    const holder = el("div",
      { class: "bubble-holder", style: p.position ? { position: "absolute", left: `${p.position.x}px`, top: `${p.position.y}px` } : {} }
    );

    const primaryEl = renderBubble(p, Boolean(p.position));
    holder.appendChild(primaryEl);

    // secondaires liées directement
    if (p.secondaries?.length) {
      for (const s of p.secondaries) {
        const secEl = renderBubble(s, Boolean(s.position)); // position locale autour, ou simple flow
        holder.appendChild(secEl);
      }
    }
    container.appendChild(holder);
  }

  return container;
}

/* ---------- Rendu slide global ---------- */
function renderBlock(b: Block): HTMLElement {
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
      return renderBubbleBlock(b);
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
  mount.replaceChildren(...slide.blocks.map(renderBlock));
}
