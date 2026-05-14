import { SCULPTURES } from "./sculptures-data.js";

const preloader = document.getElementById("preloader");
const perc = document.getElementById("preloader-perc");
const fill = document.querySelector(".preloader-bar-fill");

let p = 0;
const t = setInterval(() => {
  p = Math.min(100, p + 4);
  if (perc) perc.textContent = `${p}%`;
  if (fill) fill.style.width = `${p}%`;
  if (p >= 100) {
    clearInterval(t);
    preloader?.classList.add("preloader-hidden");
    setTimeout(() => preloader?.remove(), 450);
  }
}, 35);

function getModelKeyFromHref(href) {
  try {
    const url = new URL(href, window.location.href);
    return (url.searchParams.get("model") || "").toLowerCase();
  } catch (e) {
    return "";
  }
}

function applyCardMeta() {
  const cards = document.querySelectorAll(".work-card");
  if (!cards.length) return;

  cards.forEach((card) => {
    const href = card.getAttribute("href") || "";
    const key = getModelKeyFromHref(href);
    if (!key) return;

    const meta = SCULPTURES[key];
    if (!meta) return;

    const titleEl = card.querySelector(".work-title");
    const subEl = card.querySelector(".work-sub");

    if (titleEl) titleEl.textContent = meta.title;

    if (subEl) {
      const year = meta.year || "—";
      const material = meta.material || "—";
      subEl.textContent = `${year} • ${material} • 3D`;
    }
  });
}

document.addEventListener("DOMContentLoaded", applyCardMeta);
