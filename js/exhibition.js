import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const isMobile = window.matchMedia("(max-width: 768px)").matches;

document.getElementById("btn-exit-exhibition").addEventListener("click", () => {
  window.location.href = "gallery.html";
});

const container = document.getElementById("exhibition-container");
const preloader = document.getElementById("preloader");
const preloaderPerc = document.getElementById("preloader-perc");
const preloaderFill = preloader
  ? preloader.querySelector(".preloader-bar-fill")
  : null;

const infoPanel = document.getElementById("sculpture-info");
const infoTitle = document.getElementById("info-title");
const infoText = document.getElementById("info-text");
const btnExitView = document.getElementById("btn-exit-view");
const infoToggle = document.getElementById("info-toggle");

const focusMaskEl = document.getElementById("focus-mask");
const viewHintsEl = document.getElementById("view-hints");

function setViewUI(isOn) {
  if (focusMaskEl && !isMobile) {
    focusMaskEl.classList.toggle("is-visible", isOn);
  }

  if (viewHintsEl && !isMobile) {
    viewHintsEl.classList.toggle("is-visible", isOn);
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(isMobile ? 1.25 : Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
//renderer.toneMapping = isMobile
//  ? THREE.NoToneMapping
//  : THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

renderer.domElement.style.touchAction = "none";

const manager = new THREE.LoadingManager();
const loader = new GLTFLoader(manager);

let scene = null;
let camera = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const mainCamPos = new THREE.Vector3();
const mainCamQuat = new THREE.Quaternion();

const galleryLook = {
  active: false,
  lastX: 0,
  startX: 0,
  moved: false,
  yaw: 0,
  minYaw: isMobile ? -0.35 : -0.35,
  maxYaw: isMobile ? 0.35 : 0.35,
  speed: 0.0018,
  baseQuat: new THREE.Quaternion(),
};

const touchView = {
  mode: null,
  lastX: 0,
  lastY: 0,
  startX: 0,
  startY: 0,
  pinchStartDistance: 0,
  pinchStartZoom: 0,
};

const camAnim = {
  active: false,
  fromPos: new THREE.Vector3(),
  toPos: new THREE.Vector3(),
  fromQuat: new THREE.Quaternion(),
  toQuat: new THREE.Quaternion(),
  start: 0,
  duration: 1.2,
};

const viewZoom = {
  target: new THREE.Vector3(),
  dir: new THREE.Vector3(),
  distance: 0,
  min: 0,
  max: 0,
  speed: 0.0012,
  active: false,
};

const sculpturesConfig = {
  Man1Mesh: {
    title: "Первый славянин",
    text:
      "Скульптурный образ, обращённый к истокам и становлению человека в мире. Композиция раскрывает момент внутреннего выбора — между действием и осмыслением, создавая образ человека на границе начала истории и культуры.",
    light: "M1SPL",
    maxDeltaZ: Infinity,
  },
  KitelMesh: {
    title: "Китель друга",
    text:
      "Бронзовая композиция о памяти и присутствии человека через вещь. " +
      "Китель здесь — не просто форма, а знак службы, дружбы и уважения. ",
    light: "KSL",
    maxDeltaZ: Math.PI / 4,
  },
  Loris: {
    title: "Лорис-Меликов",
    text:
      "Бронзовый портретный образ, построенный на сдержанности и внутренней собранности. " +
      "Скульптура воспринимается как размышление о государственной ответственности, служении и цене решений. ",
    light: "M2SPL",
    maxDeltaZ: Infinity,
  },
  Children: {
    title: "Дети войны",
    text:
      "Бронзовая работа о хрупкости и стойкости. " +
      "Композиция обращает внимание на тех, кто вынес войну в детском возрасте.",
    light: "M3SPL",
    maxDeltaZ: Infinity,
  },
  PressMesh: {
    title: "Журналистам",
    text:
      "Скульптурная композиция, посвящённая профессии свидетеля и посредника. Работа говорит о личной ответственности за слово и о хрупком балансе между фактом, памятью и временем.",
    light: "M0SPL",
    maxDeltaZ: Infinity,
  },
};

const sculptures = {};

let hoveredKey = null;
let activeKey = null;
let isViewMode = false;
let isDragging = false;
let lastPointerX = 0;

const rotationInertia = {
  velocity: 0,
  damping: 0.95,
  velocityScale: isMobile ? 0.018 : 0.012,
  minStop: 0.00012,
  releaseDeadzone: 0.01,
};

const rotationAnim = {
  active: false,
  key: null,
  fromQuat: new THREE.Quaternion(),
  toQuat: new THREE.Quaternion(),
  start: 0,
  duration: 0.8,
};

const mobileGalleryControls = document.getElementById(
  "mobile-gallery-controls",
);
const galleryLookSlider = document.getElementById("gallery-look-slider");

const hoverHint = document.createElement("div");
hoverHint.id = "hover-hint";
hoverHint.className = "hover-hint";
hoverHint.textContent = "Нажмите, чтобы рассмотреть";
hoverHint.style.position = "absolute";
hoverHint.style.pointerEvents = "none";
hoverHint.style.display = "none";
document.body.appendChild(hoverHint);

let lastRenderTime = 0;
const mobileFrameInterval = 1000 / 30;

if (preloader) {
  preloader.style.display = "flex";
  if (preloaderFill) preloaderFill.style.width = "0%";
  if (preloaderPerc) preloaderPerc.textContent = "0%";
}

manager.onProgress = (_url, loaded, total) => {
  const p = total ? (loaded / total) * 100 : 0;
  if (preloaderFill) preloaderFill.style.width = `${p}%`;
  if (preloaderPerc) preloaderPerc.textContent = `${Math.round(p)}%`;
};

manager.onLoad = () => {
  if (preloader) preloader.style.display = "none";
};

loader.load(
  "../assets/scene.glb",
  (gltf) => {
    scene = gltf.scene;

    let gltfCam = scene.getObjectByName("MainCamera");

    if (
      !(gltfCam && gltfCam.isCamera) &&
      gltf.cameras &&
      gltf.cameras.length > 0
    ) {
      gltfCam = gltf.cameras[0];
      if (!scene.children.includes(gltfCam)) scene.add(gltfCam);
    }

    if (gltfCam && gltfCam.isCamera) {
      camera = gltfCam;
    } else {
      camera = new THREE.PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight,
        0.1,
        1000,
      );
      camera.position.set(0, 2, 5);
      camera.lookAt(0, 1, 0);
      scene.add(camera);
    }

    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();

    mainCamPos.copy(camera.position);
    mainCamQuat.copy(camera.quaternion);

    galleryLook.baseQuat.copy(camera.quaternion);

    Object.keys(sculpturesConfig).forEach((key) => {
      const mesh = scene.getObjectByName(key);
      if (!mesh) return;

      const cfg = sculpturesConfig[key];
      const light = cfg.light ? scene.getObjectByName(cfg.light) : null;
      const lightDefaultIntensity =
        light && typeof light.intensity === "number" ? light.intensity : 1;

      if (light) light.intensity = 0;

      sculptures[key] = {
        mesh,
        light,
        lightDefaultIntensity,
        baseQuat: mesh.quaternion.clone(),
        curAngle: 0,
        config: cfg,
      };
    });

    animate();
  },
  undefined,
  (err) => {
    console.error("GLB load error", err);
    if (preloader) preloader.style.display = "none";
  },
);

function findSculptureKeyByObject(obj) {
  let cur = obj;

  while (cur) {
    for (const [key, data] of Object.entries(sculptures)) {
      if (data.mesh === cur) return key;
    }

    cur = cur.parent;
  }

  return null;
}

function getSculptureWorldAnchor(key) {
  const obj = sculptures[key];
  if (!obj) return null;

  const box = new THREE.Box3().setFromObject(obj.mesh);
  const center = new THREE.Vector3();

  box.getCenter(center);

  return center;
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getKeyFromScreenPoint(clientX, clientY) {
  if (!camera || !scene) return null;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;

  mouse.set(x, y);
  raycaster.setFromCamera(mouse, camera);

  const targets = Object.values(sculptures).map((o) => o.mesh);
  const intersects = raycaster.intersectObjects(targets, true);

  if (intersects.length > 0) {
    return findSculptureKeyByObject(intersects[0].object);
  }

  return null;
}

function startCameraAnimation(toPos, toQuat, duration = 1.2) {
  if (!camera) return;

  camAnim.active = true;
  camAnim.duration = duration;
  camAnim.start = performance.now();
  camAnim.fromPos.copy(camera.position);
  camAnim.toPos.copy(toPos);
  camAnim.fromQuat.copy(camera.quaternion);
  camAnim.toQuat.copy(toQuat);
}

function updateCameraAnimation(time) {
  if (!camAnim.active || !camera) return;

  const t = Math.min((time - camAnim.start) / (camAnim.duration * 1000), 1);
  const k = t * t * (3 - 2 * t);

  camera.position.lerpVectors(camAnim.fromPos, camAnim.toPos, k);
  camera.quaternion.slerpQuaternions(camAnim.fromQuat, camAnim.toQuat, k);

  if (t >= 1) camAnim.active = false;
}

function startRotationReset(key) {
  const obj = sculptures[key];
  if (!obj) return;

  rotationAnim.active = true;
  rotationAnim.key = key;
  rotationAnim.fromQuat.copy(obj.mesh.quaternion);
  rotationAnim.toQuat.copy(obj.baseQuat);
  rotationAnim.start = performance.now();
}

function updateRotationAnim(time) {
  if (!rotationAnim.active || !rotationAnim.key) return;

  const obj = sculptures[rotationAnim.key];

  if (!obj) {
    rotationAnim.active = false;
    return;
  }

  const t = Math.min(
    (time - rotationAnim.start) / (rotationAnim.duration * 1000),
    1,
  );

  const k = t * t * (3 - 2 * t);

  obj.mesh.quaternion.slerpQuaternions(
    rotationAnim.fromQuat,
    rotationAnim.toQuat,
    k,
  );

  if (t >= 1) {
    rotationAnim.active = false;
    obj.curAngle = 0;
  }
}

function setHover(key) {
  if (hoveredKey === key || isViewMode || isMobile) return;

  hoveredKey = key;

  Object.entries(sculptures).forEach(([name, obj]) => {
    if (obj.light) {
      obj.light.intensity = name === key ? obj.lightDefaultIntensity : 0;
    }
  });

  if (!key || !camera || !scene) {
    hoverHint.style.display = "none";
    return;
  }

  const worldPos = getSculptureWorldAnchor(key);

  if (!worldPos) {
    hoverHint.style.display = "none";
    return;
  }

  const projected = worldPos.clone().project(camera);
  const rect = container.getBoundingClientRect();

  const x = (projected.x * 0.5 + 0.5) * rect.width + rect.left;
  const y = (-projected.y * 0.5 + 0.5) * rect.height + rect.top;

  hoverHint.style.left = `${x}px`;
  hoverHint.style.top = `${y}px`;
  hoverHint.style.display = "block";
}

function enterViewMode(key) {
  const obj = sculptures[key];
  if (!obj || !camera) return;

  activeKey = key;
  isViewMode = true;

  mainCamPos.copy(camera.position);
  mainCamQuat.copy(camera.quaternion);

  document.body.classList.add("view-mode");
  hoverHint.style.display = "none";

  setViewUI(true);

  rotationInertia.velocity = 0;

  const box = new THREE.Box3().setFromObject(obj.mesh);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  box.getCenter(center);
  box.getSize(size);

  const radius = size.length() || 1;
  const dir = new THREE.Vector3().subVectors(camera.position, center).normalize();
  const distanceMultiplier = isMobile ? 2.8 : 2.0;
  const targetPos = center.clone().add(dir.multiplyScalar(radius * distanceMultiplier));

  const m = new THREE.Matrix4();
  m.lookAt(targetPos, center, camera.up);

  const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);

  viewZoom.target.copy(center);
  viewZoom.dir.copy(new THREE.Vector3().subVectors(targetPos, center).normalize());
  viewZoom.distance = targetPos.distanceTo(center);
  viewZoom.min = Math.max(radius * (isMobile ? 0.55 : 0.3), 0.12);
  viewZoom.max = Math.max(radius * 6.0, viewZoom.distance * 2.5);
  viewZoom.active = true;

  startCameraAnimation(targetPos, targetQuat, 1.3);

  infoTitle.textContent = obj.config.title;
  infoText.textContent = obj.config.text;

  infoPanel.style.display = "block";
  infoPanel.classList.remove("is-open");
}

function exitViewMode() {
  if (!isViewMode || !camera) return;

  const keyToReset = activeKey;

  isViewMode = false;
  activeKey = null;

  document.body.classList.remove("view-mode");

  infoPanel.style.display = "none";
  infoPanel.classList.remove("is-open");
  hoverHint.style.display = "none";

  setViewUI(false);

  viewZoom.active = false;

  Object.values(sculptures).forEach((obj) => {
    if (obj.light) obj.light.intensity = 0;
  });

  rotationInertia.velocity = 0;

  if (keyToReset && sculptures[keyToReset]) {
    startRotationReset(keyToReset);
  }

  startCameraAnimation(mainCamPos, mainCamQuat, 1.3);
}

function applyAngleForActive(angle) {
  if (!activeKey) return;

  const obj = sculptures[activeKey];
  if (!obj) return;

  const max = obj.config.maxDeltaZ;
  let a = angle;

  if (Number.isFinite(max)) {
    if (a < -max) a = -max;
    if (a > max) a = max;
  }

  obj.curAngle = a;

  const axis = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromAxisAngle(axis, obj.curAngle);

  obj.mesh.quaternion.copy(obj.baseQuat).multiply(q);

  if (Number.isFinite(max) && (obj.curAngle === max || obj.curAngle === -max)) {
    rotationInertia.velocity = 0;
  }
}

function rotateActiveByDrag(dx) {
  if (!isViewMode || !activeKey) return;

  rotationAnim.active = false;

  const deltaAngle = dx * (isMobile ? 0.018 : 0.01);

  applyAngleForActive(sculptures[activeKey].curAngle + deltaAngle);

  rotationInertia.velocity = dx * rotationInertia.velocityScale;
}

function updateInertia() {
  if (!isViewMode || !activeKey) return;
  if (isDragging || touchView.mode) return;
  if (rotationAnim.active) return;

  const v = rotationInertia.velocity;

  if (Math.abs(v) < rotationInertia.minStop) {
    rotationInertia.velocity = 0;
    return;
  }

  applyAngleForActive(sculptures[activeKey].curAngle + v);

  rotationInertia.velocity *= rotationInertia.damping;
}

function updateViewZoom() {
  if (!viewZoom.active || !camera) return;

  if (viewZoom.distance < viewZoom.min) viewZoom.distance = viewZoom.min;
  if (viewZoom.distance > viewZoom.max) viewZoom.distance = viewZoom.max;

  const newPos = viewZoom.target
    .clone()
    .add(viewZoom.dir.clone().multiplyScalar(viewZoom.distance));

  camera.position.copy(newPos);

  const m = new THREE.Matrix4();
  m.lookAt(camera.position, viewZoom.target, camera.up);
  camera.quaternion.setFromRotationMatrix(m);
}

function onWheel(e) {
  if (!isViewMode || !viewZoom.active || !camera) return;

  e.preventDefault();

  if (camAnim.active) return;

  const dy = e.deltaY || 0;
  const factor = Math.exp(dy * viewZoom.speed);

  viewZoom.distance *= factor;

  updateViewZoom();
}

function onPointerMove(e) {
  if (!camera || !scene) return;
  if (e.pointerType === "touch") return;

  if (isViewMode) {
    if (isDragging) {
      const dx = e.clientX - lastPointerX;
      lastPointerX = e.clientX;
      rotateActiveByDrag(dx);
    }

    return;
  }

  const foundKey = getKeyFromScreenPoint(e.clientX, e.clientY);
  setHover(foundKey);
}

function onClick(e) {
  if (isMobile) return;

  if (!isViewMode && hoveredKey) {
    enterViewMode(hoveredKey);
  }
}

function applyGalleryLook() {
  if (!camera || isViewMode || camAnim.active) return;

  if (galleryLook.yaw < galleryLook.minYaw) {
    galleryLook.yaw = galleryLook.minYaw;
  }

  if (galleryLook.yaw > galleryLook.maxYaw) {
    galleryLook.yaw = galleryLook.maxYaw;
  }

  const yawQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    galleryLook.yaw,
  );

  camera.position.copy(mainCamPos);
  camera.quaternion.copy(galleryLook.baseQuat).premultiply(yawQuat);

  if (galleryLookSlider) {
const normalized =
  100 -
  ((galleryLook.yaw - galleryLook.minYaw) /
    (galleryLook.maxYaw - galleryLook.minYaw)) *
    200;

galleryLookSlider.value = String(Math.round(normalized));
  }
}

function lookGalleryBy(dx) {
  if (!camera || isViewMode || camAnim.active) return;

  galleryLook.yaw -= dx * galleryLook.speed;
  applyGalleryLook();
}

if (galleryLookSlider) {
  galleryLookSlider.addEventListener("input", () => {
    const value = Number(galleryLookSlider.value);

    galleryLook.yaw =
      galleryLook.minYaw +
      ((100 - value) / 200) * (galleryLook.maxYaw - galleryLook.minYaw);

    applyGalleryLook();
  });
}

renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("click", onClick);
renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

renderer.domElement.addEventListener(
  "pointerdown",
  (e) => {
    if (e.pointerType === "touch") return;

    if (e.button !== 0) return;

    if (isViewMode) {
      isDragging = true;
      lastPointerX = e.clientX;
      rotationInertia.velocity = 0;
    }
  },
  { passive: false },
);

window.addEventListener("pointerup", () => {
  isDragging = false;

  if (Math.abs(rotationInertia.velocity) < rotationInertia.releaseDeadzone) {
    rotationInertia.velocity = 0;
  }
});

renderer.domElement.addEventListener("pointerleave", () => {
  if (!isViewMode) setHover(null);
});

renderer.domElement.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();

    if (!camera) return;

    if (!isViewMode) {
      if (e.touches.length === 1) {
        galleryLook.active = true;
        galleryLook.lastX = e.touches[0].clientX;
        galleryLook.startX = e.touches[0].clientX;
        galleryLook.moved = false;
      }

      return;
    }

    if (e.touches.length === 1) {
      touchView.mode = "rotate";
      touchView.lastX = e.touches[0].clientX;
      touchView.lastY = e.touches[0].clientY;
      touchView.startX = e.touches[0].clientX;
      touchView.startY = e.touches[0].clientY;
      rotationInertia.velocity = 0;
    }

    if (e.touches.length === 2) {
      touchView.mode = "zoom";
      touchView.pinchStartDistance = getTouchDistance(e.touches);
      touchView.pinchStartZoom = viewZoom.distance;
    }
  },
  { passive: false },
);

renderer.domElement.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();

    if (!camera) return;

    if (!isViewMode) {
      if (galleryLook.active && e.touches.length === 1) {
        const x = e.touches[0].clientX;
        const dx = x - galleryLook.lastX;

        galleryLook.lastX = x;

        if (Math.abs(x - galleryLook.startX) > 8) {
          galleryLook.moved = true;
        }

        lookGalleryBy(dx);
      }

      return;
    }

    if (camAnim.active) return;

    if (touchView.mode === "rotate" && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchView.lastX;

      touchView.lastX = touch.clientX;
      touchView.lastY = touch.clientY;

      rotateActiveByDrag(dx);

      return;
    }

    if (touchView.mode === "zoom" && e.touches.length === 2) {
      const currentDistance = getTouchDistance(e.touches);

      if (touchView.pinchStartDistance > 0) {
        const zoomFactor = touchView.pinchStartDistance / currentDistance;

        viewZoom.distance = touchView.pinchStartZoom * zoomFactor;

        updateViewZoom();
      }
    }
  },
  { passive: false },
);

renderer.domElement.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();

    if (!isViewMode) {
      if (
        galleryLook.active &&
        !galleryLook.moved &&
        e.changedTouches.length > 0
      ) {
        const touch = e.changedTouches[0];
        const key = getKeyFromScreenPoint(touch.clientX, touch.clientY);

        if (key) {
          enterViewMode(key);
        }
      }

      if (e.touches.length === 0) {
        galleryLook.active = false;
      }

      return;
    }

    if (e.touches.length === 0) {
      touchView.mode = null;

      if (Math.abs(rotationInertia.velocity) < rotationInertia.releaseDeadzone) {
        rotationInertia.velocity = 0;
      }
    }

    if (e.touches.length === 1) {
      touchView.mode = "rotate";
      touchView.lastX = e.touches[0].clientX;
      touchView.lastY = e.touches[0].clientY;
    }
  },
  { passive: false },
);

renderer.domElement.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();

    if (!isViewMode) {
      if (galleryLook.active && !galleryLook.moved && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const key = getKeyFromScreenPoint(touch.clientX, touch.clientY);

        if (key) {
          enterViewMode(key);
        }
      }

      if (e.touches.length === 0) {
        galleryLook.active = false;
      }

      return;
    }

    if (e.touches.length === 0) {
      touchView.mode = null;

      if (Math.abs(rotationInertia.velocity) < rotationInertia.releaseDeadzone) {
        rotationInertia.velocity = 0;
      }
    }

    if (e.touches.length === 1) {
      touchView.mode = "rotate";
      touchView.lastX = e.touches[0].clientX;
      touchView.lastY = e.touches[0].clientY;
    }
  },
  { passive: false },
);

btnExitView.addEventListener("click", () => {
  exitViewMode();
});

if (infoToggle && infoPanel) {
  infoToggle.addEventListener("click", () => {
    infoPanel.classList.toggle("is-open");
  });
}

function onResize() {
  if (!camera) return;

  const w = container.clientWidth;
  const h = container.clientHeight;

  renderer.setSize(w, h);

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", onResize);

function animate(time = 0) {
  requestAnimationFrame(animate);

  if (!scene || !camera) return;

  if (isMobile && time - lastRenderTime < mobileFrameInterval) {
    return;
  }

  lastRenderTime = time;

  updateCameraAnimation(time);
  updateRotationAnim(time);
  updateInertia();

  renderer.render(scene, camera);
}