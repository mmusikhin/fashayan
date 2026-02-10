// js/cursor.js
(() => {
  // Ищем готовый элемент, а если его нет — создаём
  let el = document.getElementById("cursorLight");
  if (!el) {
    el = document.createElement("div");
    el.id = "cursorLight";
    el.className = "cursor-light";
    document.body.appendChild(el);
  }

  // На всякий: позиционирование должно быть fixed, чтобы работало одинаково везде
  // (если у тебя уже в CSS задано — ок, это не помешает)
  el.style.position = el.style.position || "fixed";
  el.style.pointerEvents = "none";

  let tx = window.innerWidth / 2;
  let ty = window.innerHeight / 2;
  let x = tx;
  let y = ty;

  const lerp = 0.07; // меньше — сильнее отстаёт, больше — ближе к курсору

  window.addEventListener(
    "mousemove",
    (e) => {
      tx = e.clientX;
      ty = e.clientY;
    },
    { passive: true }
  );

  function tick() {
    x += (tx - x) * lerp;
    y += (ty - y) * lerp;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  // Дадим доступ другим скриптам (например main.js для THREE.PointLight)
  window.__cursorLight = {
    get x() {
      return x;
    },
    get y() {
      return y;
    },
  };
})();
