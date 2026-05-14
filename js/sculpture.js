import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SCULPTURES } from "./sculptures-data.js";

const viewerEl = document.getElementById("viewer");
const errEl = document.getElementById("viewer-error");
const btnBack = document.getElementById("btn-back");

const preloader = document.getElementById("preloader");
const preloaderFill = preloader?.querySelector(".preloader-bar-fill");
const preloaderPerc = document.getElementById("preloader-perc");

const maskEl = document.getElementById("focus-mask");
const infoEl = document.getElementById("sculpture-info");
const infoToggle = document.getElementById("info-toggle");
const hintsEl = document.getElementById("view-hints");

const isMobile = window.matchMedia("(max-width: 768px)").matches;

function revealOverlayUI() {
  if (maskEl && !isMobile) maskEl.classList.add("is-visible");
  if (hintsEl && !isMobile) hintsEl.classList.add("is-visible");

  if (infoEl) {
    infoEl.style.display = "block";
    infoEl.setAttribute("aria-hidden", "false");
  }
}

function setLoadingProgress(progress) {
  if (!preloader) return;
  const clamped = Math.max(0, Math.min(progress, 1));
  const percent = Math.round(clamped * 100);
  if (preloaderFill) preloaderFill.style.width = `${percent}%`;
  if (preloaderPerc) preloaderPerc.textContent = `${percent}%`;
}

function hidePreloader() {
  if (!preloader) return;
  preloader.classList.add("preloader-hidden");
  setTimeout(() => {
    if (preloader && preloader.parentNode) {
      preloader.parentNode.removeChild(preloader);
    }
  }, 500);
}

setLoadingProgress(0);

if (btnBack) {
  btnBack.addEventListener("click", () => {
    window.location.href = "gallery.html";
  });
}

if (infoToggle && infoEl) {
  infoToggle.addEventListener("click", () => {
    infoEl.classList.toggle("is-open");
  });
}

const params = new URLSearchParams(window.location.search);
const modelKey = (params.get("model") || "man").toLowerCase();

const meta = SCULPTURES[modelKey] || {
  title: "Скульптура",
  year: "—",
  material: "—",
  lightProfile: "balanced",
  initialYaw: 0,
  initialPitch: 0.08,
  zoomInMultiplier: 0.7,
};

const DEFAULT_DESCRIPTION =
  "Бронзовая фигура воина-защитника — собирательный образ стойкости и долга. " +
  "В пластике ощущается напряжённая готовность встать между опасностью и родной землёй.";

const titleEl =
  document.getElementById("sc-title") || document.getElementById("info-title");
const subEl =
  document.getElementById("sc-sub") || document.getElementById("info-sub");
const textEl =
  document.getElementById("sc-text") || document.getElementById("info-text");

if (titleEl) titleEl.textContent = meta.title;
if (subEl) subEl.textContent = `${meta.year} • ${meta.material} • 3D`;
if (textEl) textEl.textContent = meta.description || DEFAULT_DESCRIPTION;

const glbPath = `../assets/${modelKey}.glb`;

if (!viewerEl) {
  console.error("[sculpture] #viewer не найден");
  hidePreloader();
} else {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  viewerEl.appendChild(renderer.domElement);

  renderer.domElement.style.touchAction = "none";

  const camera = new THREE.PerspectiveCamera(
    50,
    viewerEl.clientWidth / viewerEl.clientHeight,
    0.01,
    2000,
  );

  const UP_AXIS = new THREE.Vector3(0, 1, 0);
  camera.up.copy(UP_AXIS);

  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x111111, 3.2);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 6, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 1.0);
  fill.position.set(-4, 3, -3);
  scene.add(fill);

  const camLight = new THREE.PointLight(0xffffff, 0.9, 0, 2);
  scene.add(camLight);

  const spot = new THREE.SpotLight(0xffffff, 0.9, 0, Math.PI / 5, 0.4, 1);
  spot.position.set(0, 7, 5);
  scene.add(spot);
  scene.add(spot.target);

  const LIGHT_PROFILES = {
    dark: {
      exposure: 2.6,
      ambient: 2,
      hemi: 4,
      key: 1.9,
      fill: 1.2,
      cam: 1.05,
      spot: 2.95,
    },
    balanced: {
      exposure: 1.42,
      ambient: 0.82,
      hemi: 3.05,
      key: 1.55,
      fill: 0.95,
      cam: 0.82,
      spot: 0.72,
    },
    bright: {
      exposure: 1.22,
      ambient: 0.66,
      hemi: 2.45,
      key: 1.22,
      fill: 0.74,
      cam: 0.6,
      spot: 0.5,
    },
    white: {
      exposure: 0.9,
      ambient: 0.08,
      hemi: 1.55,
      key: 0.9,
      fill: 0.32,
      cam: 0.34,
      spot: 0.8,
    },
  };

  function applyLightProfile(profileName) {
    const profile = LIGHT_PROFILES[profileName] || LIGHT_PROFILES.balanced;
    renderer.toneMappingExposure = profile.exposure;
    ambient.intensity = profile.ambient;
    hemi.intensity = profile.hemi;
    key.intensity = profile.key;
    fill.intensity = profile.fill;
    camLight.intensity = profile.cam;
    spot.intensity = profile.spot;
  }

  applyLightProfile(meta.lightProfile);

  const loader = new GLTFLoader();
  let model = null;

  const bbox = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  const orbit = {
    target: new THREE.Vector3(0, 0, 0),
    yaw: typeof meta.initialYaw === "number" ? meta.initialYaw : 0,
    pitch: typeof meta.initialPitch === "number" ? meta.initialPitch : 0.08,
    distance: isMobile ? 3.6 : 2.8,
    min: 0.2,
    max: 50,
  };

  const rotationInertia = {
    velocity: 0,
    damping: 0.95,
    velocityScale: isMobile ? 0.018 : 0.01,
    minStop: 0.00012,
    releaseDeadzone: 0.01,
  };

  function updateCamera() {
    const safePitch = Math.max(-1.2, Math.min(1.2, orbit.pitch));
    const cosPitch = Math.cos(safePitch);
    const sinPitch = Math.sin(safePitch);

    const x = Math.sin(orbit.yaw) * orbit.distance * cosPitch;
    const y = sinPitch * orbit.distance;
    const z = Math.cos(orbit.yaw) * orbit.distance * cosPitch;

    camera.position.set(
      orbit.target.x + x,
      orbit.target.y + y,
      orbit.target.z + z,
    );

    camera.lookAt(orbit.target);
    camLight.position.copy(camera.position);
    spot.target.position.copy(orbit.target);
  }

  function updateInertia() {
    if (!model) return;
    if (isLmb || touchMode) return;

    const v = rotationInertia.velocity;

    if (Math.abs(v) < rotationInertia.minStop) {
      rotationInertia.velocity = 0;
      return;
    }

    orbit.yaw += v;
    rotationInertia.velocity *= rotationInertia.damping;
    updateCamera();
  }

  function showError() {
    if (errEl) errEl.style.display = "grid";
  }

  loader.load(
    glbPath,
    (gltf) => {
      model = gltf.scene;

      bbox.setFromObject(model);
      bbox.getCenter(center);
      bbox.getSize(size);

      model.position.sub(center);

      scene.add(model);

      const radius = Math.max(size.x, size.y, size.z) * 0.55 || 1;
      const mobileDistanceMultiplier = 3.1;
      const desktopDistanceMultiplier = 2.4;

      orbit.distance = Math.max(
        radius * (isMobile ? mobileDistanceMultiplier : desktopDistanceMultiplier),
        1.2,
      );

      const zoomInMultiplier =
        typeof meta.zoomInMultiplier === "number" ? meta.zoomInMultiplier : 0.7;

      orbit.min = Math.max(radius * zoomInMultiplier, 0.2);
      orbit.max = Math.max(radius * 12, orbit.distance * 3);
      orbit.target.set(0, 0, 0);

      updateCamera();

      revealOverlayUI();
      window.__SCULPTURE_MODEL_READY__ = true;
      window.dispatchEvent(new Event("sculpture:modelLoaded"));

      setLoadingProgress(1);
      requestAnimationFrame(() => hidePreloader());
    },
    (xhr) => {
      if (xhr && xhr.total) {
        setLoadingProgress(xhr.loaded / xhr.total);
      } else {
        setLoadingProgress(0.5);
      }
    },
    () => {
      showError();
      hidePreloader();
    },
  );

  renderer.domElement.addEventListener("contextmenu", (e) =>
    e.preventDefault(),
  );

  let isLmb = false;
  let isRmb = false;
  let lastX = 0;
  let lastY = 0;

  let touchMode = null;
  let pinchStartDistance = 0;
  let pinchStartZoom = 0;

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clampZoom() {
    if (orbit.distance < orbit.min) orbit.distance = orbit.min;
    if (orbit.distance > orbit.max) orbit.distance = orbit.max;
  }

  renderer.domElement.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "touch") return;

      if (e.button === 0) {
        isLmb = true;
        rotationInertia.velocity = 0;
      }

      if (e.button === 2) {
        isRmb = true;
      }

      lastX = e.clientX;
      lastY = e.clientY;
    },
    { passive: false },
  );

  window.addEventListener("pointerup", () => {
    isLmb = false;
    isRmb = false;

    if (Math.abs(rotationInertia.velocity) < rotationInertia.releaseDeadzone) {
      rotationInertia.velocity = 0;
    }
  });

  renderer.domElement.addEventListener(
    "pointermove",
    (e) => {
      if (!model) return;
      if (e.pointerType === "touch") return;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;

      lastX = e.clientX;
      lastY = e.clientY;

      if (isLmb) {
        orbit.yaw -= dx * 0.01;
        rotationInertia.velocity = -dx * rotationInertia.velocityScale;
        updateCamera();
        return;
      }

      if (isRmb) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);

        const right = new THREE.Vector3()
          .crossVectors(dir, camera.up)
          .normalize();

        const up = new THREE.Vector3()
          .crossVectors(right, dir)
          .normalize();

        const panScale = orbit.distance * 0.0012;

        const pan = new THREE.Vector3()
          .addScaledVector(right, -dx * panScale)
          .addScaledVector(up, dy * panScale);

        orbit.target.add(pan);

        updateCamera();
      }
    },
    { passive: false },
  );

  renderer.domElement.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();

      if (e.touches.length === 1) {
        touchMode = "rotate";
        rotationInertia.velocity = 0;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }

      if (e.touches.length === 2) {
        touchMode = "zoom";
        pinchStartDistance = getTouchDistance(e.touches);
        pinchStartZoom = orbit.distance;
      }
    },
    { passive: false },
  );

  renderer.domElement.addEventListener(
    "touchmove",
    (e) => {
      if (!model) return;

      e.preventDefault();

      if (touchMode === "rotate" && e.touches.length === 1) {
        const touch = e.touches[0];

        const dx = touch.clientX - lastX;

        lastX = touch.clientX;
        lastY = touch.clientY;

        orbit.yaw -= dx * 0.018;
        rotationInertia.velocity = -dx * 0.0018;

        updateCamera();
      }

      if (touchMode === "zoom" && e.touches.length === 2) {
        const currentDistance = getTouchDistance(e.touches);

        if (pinchStartDistance > 0) {
          const zoomFactor = pinchStartDistance / currentDistance;
          orbit.distance = pinchStartZoom * zoomFactor;
          clampZoom();
          updateCamera();
        }
      }
    },
    { passive: false },
  );

  renderer.domElement.addEventListener(
    "touchend",
    (e) => {
      if (e.touches.length === 0) {
        touchMode = null;
      }

      if (e.touches.length === 1) {
        touchMode = "rotate";
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    },
    { passive: false },
  );

  renderer.domElement.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();

      const dy = e.deltaY || 0;
      const factor = Math.exp(dy * 0.0012);

      orbit.distance *= factor;

      clampZoom();
      updateCamera();
    },
    { passive: false },
  );

  function onResize() {
    const w = viewerEl.clientWidth;
    const h = viewerEl.clientHeight;

    renderer.setSize(w, h);

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    updateCamera();
  }

  window.addEventListener("resize", onResize);

  function animate() {
    requestAnimationFrame(animate);
    updateInertia();
    renderer.render(scene, camera);
  }

  animate();
}
