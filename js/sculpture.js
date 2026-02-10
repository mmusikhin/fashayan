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
const hintsEl = document.getElementById("view-hints");

function revealOverlayUI() {
  if (maskEl) maskEl.classList.add("is-visible");

  if (hintsEl) hintsEl.classList.add("is-visible");

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
    if (preloader && preloader.parentNode)
      preloader.parentNode.removeChild(preloader);
  }, 500);
}

setLoadingProgress(0);

if (btnBack) {
  btnBack.addEventListener("click", () => {
    window.location.href = "gallery.html";
  });
}

const params = new URLSearchParams(window.location.search);
const modelKey = (params.get("model") || "man").toLowerCase();
const meta = SCULPTURES[modelKey] || {
  title: "Скульптура",
  year: "—",
  material: "—",
};

const PLACEHOLDER_DESC =
  "Бронзовая фигура воина-защитника — собирательный образ стойкости и долга. " +
  "В пластике ощущается напряжённая готовность встать между опасностью и родной землёй.";

const DESCRIPTIONS = {
  turgenev: PLACEHOLDER_DESC,
  children: PLACEHOLDER_DESC,
  fish: PLACEHOLDER_DESC,
  kitel: PLACEHOLDER_DESC,
  loris: PLACEHOLDER_DESC,
  man: PLACEHOLDER_DESC,
  press: PLACEHOLDER_DESC,
};

const titleEl =
  document.getElementById("sc-title") || document.getElementById("info-title");
const subEl =
  document.getElementById("sc-sub") || document.getElementById("info-sub");
const textEl =
  document.getElementById("sc-text") || document.getElementById("info-text");

const uiRoot =
  document.querySelector(".sculpture-ui") ||
  document.querySelector(".viewer-ui") ||
  document.querySelector(".page-sculpture") ||
  document.body;

if (titleEl) titleEl.textContent = meta.title;
if (subEl) subEl.textContent = `${meta.year} • ${meta.material} • 3D`;
if (textEl)
  textEl.textContent =
    meta.description || DESCRIPTIONS[modelKey] || PLACEHOLDER_DESC;

let uiActivated = false;
function activateUI() {
  if (uiActivated) return;
  uiActivated = true;
  if (uiRoot && uiRoot.classList) uiRoot.classList.add("is-active");
}

const glbPath = `../assets/${modelKey}.glb`;

if (!viewerEl) {
  console.error("[sculpture] #viewer не найден");
  hidePreloader();
} else {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  viewerEl.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(
    50,
    viewerEl.clientWidth / viewerEl.clientHeight,
    0.01,
    2000,
  );

  const UP_AXIS = new THREE.Vector3(0, 1, 0);
  camera.up.copy(UP_AXIS);

  scene.add(new THREE.AmbientLight(0xffffff, 0.95));

  const hemi = new THREE.HemisphereLight(0xffffff, 0x111111, 1.35);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 3);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 1.55);
  fill.position.set(-5, 3, -4);
  scene.add(fill);

  const camLight = new THREE.PointLight(0xffffff, 1.35, 0, 2);
  scene.add(camLight);

  const spot = new THREE.SpotLight(0xffffff, 1.4, 0, Math.PI / 5, 0.4, 1);
  spot.position.set(0, 8, 6);
  spot.target.position.set(0, 0, 0);
  scene.add(spot);
  scene.add(spot.target);

  const loader = new GLTFLoader();
  let model = null;

  const bbox = new THREE.Box3();
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  const orbit = {
    target: new THREE.Vector3(0, 0, 0),
    yaw: 0, 
    height: 0.35,
    distance: 2.8,
    min: 0.2,
    max: 50,
  };

  function updateCamera() {
    const x = Math.sin(orbit.yaw) * orbit.distance;
    const z = Math.cos(orbit.yaw) * orbit.distance;

    camera.position.set(
      orbit.target.x + x,
      orbit.target.y + orbit.height,
      orbit.target.z + z,
    );
    camera.lookAt(orbit.target);

    camLight.position.copy(camera.position);
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

      orbit.distance = Math.max(radius * 2.4, 1.2);
      orbit.min = Math.max(radius * 0.35, 0.2);
      orbit.max = Math.max(radius * 12, orbit.distance * 3);

      orbit.height = radius * 0.35;
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

  renderer.domElement.addEventListener("pointerdown", (e) => {
    activateUI();
    if (e.button === 0) isLmb = true; 
    if (e.button === 2) isRmb = true; 
    lastX = e.clientX;
    lastY = e.clientY;
  });

  window.addEventListener("pointerup", () => {
    isLmb = false;
    isRmb = false;
  });

  renderer.domElement.addEventListener("pointermove", (e) => {
    if (!model) return;

    if (isLmb || isRmb) activateUI();

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (isLmb) {
      orbit.yaw -= dx * 0.01;
      updateCamera();
      return;
    }

    if (isRmb) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);

      const right = new THREE.Vector3()
        .crossVectors(dir, camera.up)
        .normalize();
      const up = new THREE.Vector3().crossVectors(right, dir).normalize();

      const panScale = orbit.distance * 0.0012;

      const pan = new THREE.Vector3()
        .addScaledVector(right, -dx * panScale)
        .addScaledVector(up, dy * panScale);

      orbit.target.add(pan);
      updateCamera();
    }
  });

  renderer.domElement.addEventListener(
    "wheel",
    (e) => {
      activateUI();
      e.preventDefault();

      const dy = e.deltaY || 0;
      const factor = Math.exp(dy * 0.0012);
      orbit.distance *= factor;

      if (orbit.distance < orbit.min) orbit.distance = orbit.min;
      if (orbit.distance > orbit.max) orbit.distance = orbit.max;

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
    renderer.render(scene, camera);
  }
  animate();
}
