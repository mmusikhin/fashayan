(() => {
  const isTouch =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;

  if (isTouch) return;

  let el = document.getElementById("cursorLight");
  if (!el) {
    el = document.createElement("div");
    el.id = "cursorLight";
    el.className = "cursor-light";
    document.body.appendChild(el);
  }

  el.style.position = el.style.position || "fixed";
  el.style.pointerEvents = "none";

  let tx = window.innerWidth / 2;
  let ty = window.innerHeight / 2;
  let x = tx;
  let y = ty;

  const lerp = 0.07;

  window.addEventListener(
    "mousemove",
    (e) => {
      tx = e.clientX;
      ty = e.clientY;
    },
    { passive: true },
  );

  function tick() {
    x += (tx - x) * lerp;
    y += (ty - y) * lerp;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  window.__cursorLight = {
    get x() {
      return x;
    },
    get y() {
      return y;
    },
  };
})();
