(() => {
  const lightbox = document.getElementById("lightbox");
  const lightboxImage = document.getElementById("lightboxImg");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const thumbs = Array.from(document.querySelectorAll(".photo-strip .photo"));
  const btnPrev = document.querySelector(".lightbox__nav--prev");
  const btnNext = document.querySelector(".lightbox__nav--next");
  const strip = document.getElementById("photoStrip");
  const stripPrev = document.querySelector(".photo-strip-nav--prev");
  const stripNext = document.querySelector(".photo-strip-nav--next");

  if (!lightbox || !lightboxImage || !thumbs.length) return;

  const items = thumbs
    .map((button) => ({
      src: button.getAttribute("data-full") || button.querySelector("img")?.src,
      alt:
        button.getAttribute("data-alt") ||
        button.querySelector("img")?.alt ||
        "",
    }))
    .filter((item) => item.src);

  if (!items.length) return;

  let currentIndex = 0;
  let startX = 0;
  let startY = 0;
  let isPointerDown = false;

  function render() {
    const item = items[currentIndex];
    lightboxImage.src = item.src;
    lightboxImage.alt = item.alt || "";

    if (lightboxCaption) {
      lightboxCaption.textContent = item.alt || "";
    }
  }

  function openAt(index) {
    currentIndex = (index + items.length) % items.length;
    render();
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function close() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImage.src = "";

    if (lightboxCaption) {
      lightboxCaption.textContent = "";
    }

    document.body.classList.remove("no-scroll");
  }

  function next() {
    currentIndex = (currentIndex + 1) % items.length;
    render();
  }

  function prev() {
    currentIndex = (currentIndex - 1 + items.length) % items.length;
    render();
  }

  function scrollStrip(direction) {
    if (!strip) return;

    const card = strip.querySelector(".photo");
    const step = card ? card.getBoundingClientRect().width + 12 : 280;

    strip.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  thumbs.forEach((button, index) => {
    button.addEventListener("click", () => openAt(index));
  });

  lightbox.addEventListener("click", (event) => {
    const target = event.target;

    if (target?.getAttribute?.("data-close") === "1") {
      close();
    }
  });

  btnNext?.addEventListener("click", (event) => {
    event.stopPropagation();
    next();
  });

  btnPrev?.addEventListener("click", (event) => {
    event.stopPropagation();
    prev();
  });

  stripNext?.addEventListener("click", () => scrollStrip(1));
  stripPrev?.addEventListener("click", () => scrollStrip(-1));

  document.addEventListener("keydown", (event) => {
    if (lightbox.classList.contains("is-open")) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") prev();
      return;
    }

    if (event.key === "ArrowRight") scrollStrip(1);
    if (event.key === "ArrowLeft") scrollStrip(-1);
  });

  lightbox.addEventListener("pointerdown", (event) => {
    if (!lightbox.classList.contains("is-open")) return;

    isPointerDown = true;
    startX = event.clientX;
    startY = event.clientY;
  });

  lightbox.addEventListener("pointerup", (event) => {
    if (!lightbox.classList.contains("is-open") || !isPointerDown) return;

    isPointerDown = false;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (Math.abs(dx) <= 60 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;

    if (dx < 0) {
      next();
    } else {
      prev();
    }
  });

  lightbox.addEventListener("pointercancel", () => {
    isPointerDown = false;
  });
})();
