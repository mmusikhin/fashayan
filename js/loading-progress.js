export function createLoadingProgress({
  preloader,
  fill,
  perc,
  maxBeforeComplete = 0.92,
  tickMs = 80,
} = {}) {
  let displayed = 0;
  let realTarget = 0;
  let completed = false;
  let timerId = null;
  const startedAt = performance.now();

  function render(value) {
    if (!preloader) return;

    displayed = Math.max(displayed, Math.max(0, Math.min(value, 1)));

    const percent = Math.round(displayed * 100);

    if (fill) fill.style.width = `${percent}%`;
    if (perc) perc.textContent = `${percent}%`;
  }

  function tick() {
    if (completed) return;

    const elapsed = performance.now() - startedAt;
    const simulated = maxBeforeComplete * (1 - Math.exp(-elapsed / 6200));
    const target = Math.max(realTarget, simulated);
    const next = displayed + (target - displayed) * 0.24;

    render(next);
  }

  function start() {
    if (!preloader || timerId) return;

    preloader.style.display = "flex";
    render(0.01);
    timerId = window.setInterval(tick, tickMs);
  }

  function set(progress) {
    if (!preloader || completed) return;

    const clamped = Math.max(0, Math.min(progress, 1));
    realTarget = Math.max(realTarget, Math.min(clamped, maxBeforeComplete));
    tick();
  }

  function complete() {
    if (!preloader || completed) return;

    completed = true;

    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }

    render(1);
  }

  function hide({ remove = true, delay = 500, displayNone = false } = {}) {
    if (!preloader) return;

    complete();

    requestAnimationFrame(() => {
      if (displayNone) {
        preloader.style.display = "none";
        return;
      }

      preloader.classList.add("preloader-hidden");

      if (remove) {
        window.setTimeout(() => {
          if (preloader.parentNode) preloader.parentNode.removeChild(preloader);
        }, delay);
      }
    });
  }

  start();

  return {
    set,
    complete,
    hide,
  };
}
