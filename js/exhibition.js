import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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

const focusMaskEl = document.getElementById("focus-mask");
const viewHintsEl = document.getElementById("view-hints");

function setViewUI(isOn) {
  if (focusMaskEl) focusMaskEl.classList.toggle("is-visible", isOn);
  if (viewHintsEl) viewHintsEl.classList.toggle("is-visible", isOn);
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

const manager = new THREE.LoadingManager();
const loader = new GLTFLoader(manager);

let scene = null;
let camera = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const mainCamPos = new THREE.Vector3();
const mainCamQuat = new THREE.Quaternion();

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
    text: "Скульптурная композиция, посвящённая профессии свидетеля и посредника. Работа говорит о личной ответственности за слово и о хрупком балансе между фактом, памятью и временем.",
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
  velocityScale: 0.012,
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

const hoverHint = document.createElement("div");
hoverHint.id = "hover-hint";
hoverHint.className = "hover-hint";
hoverHint.textContent = "Нажмите, чтобы рассмотреть";
hoverHint.style.position = "absolute";
hoverHint.style.pointerEvents = "none";
hoverHint.style.display = "none";
document.body.appendChild(hoverHint);

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
  if (hoveredKey === key || isViewMode) return;
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
  const dir = new THREE.Vector3()
    .subVectors(camera.position, center)
    .normalize();
  const targetPos = center.clone().add(dir.multiplyScalar(radius * 2.0));

  const m = new THREE.Matrix4();
  m.lookAt(targetPos, center, camera.up);
  const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);

  viewZoom.target.copy(center);
  viewZoom.dir.copy(
    new THREE.Vector3().subVectors(targetPos, center).normalize(),
  );
  viewZoom.distance = targetPos.distanceTo(center);
  viewZoom.min = Math.max(radius * 0.3, 0.12);
  viewZoom.max = Math.max(radius * 6.0, viewZoom.distance * 2.5);
  viewZoom.active = true;

  startCameraAnimation(targetPos, targetQuat, 1.3);

  infoTitle.textContent = obj.config.title;
  infoText.textContent = obj.config.text;
  infoPanel.style.display = "block";
}

function exitViewMode() {
  if (!isViewMode || !camera) return;

  const keyToReset = activeKey;

  isViewMode = false;
  activeKey = null;
  document.body.classList.remove("view-mode");
  infoPanel.style.display = "none";
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

  const deltaAngle = dx * 0.01;
  applyAngleForActive(sculptures[activeKey].curAngle + deltaAngle);

  rotationInertia.velocity = dx * rotationInertia.velocityScale;
}

function updateInertia() {
  if (!isViewMode || !activeKey) return;
  if (isDragging) return;
  if (rotationAnim.active) return;

  const v = rotationInertia.velocity;
  if (Math.abs(v) < rotationInertia.minStop) {
    rotationInertia.velocity = 0;
    return;
  }

  applyAngleForActive(sculptures[activeKey].curAngle + v);
  rotationInertia.velocity *= rotationInertia.damping;
}

function onWheel(e) {
  if (!isViewMode || !viewZoom.active || !camera) return;

  e.preventDefault();

  if (camAnim.active) return;

  const dy = e.deltaY || 0;

  const factor = Math.exp(dy * viewZoom.speed);
  viewZoom.distance *= factor;

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

function onPointerMove(e) {
  if (!camera || !scene) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  if (isViewMode) {
    if (isDragging) {
      const dx = e.clientX - lastPointerX;
      lastPointerX = e.clientX;
      rotateActiveByDrag(dx);
    }
    return;
  }

  mouse.set(x, y);
  raycaster.setFromCamera(mouse, camera);
  const targets = Object.values(sculptures).map((o) => o.mesh);

  const intersects = raycaster.intersectObjects(targets, true);
  if (intersects.length > 0) {
    const hitObj = intersects[0].object;
    const foundKey = findSculptureKeyByObject(hitObj);
    setHover(foundKey);
  } else {
    setHover(null);
  }
}

function onClick() {
  if (!isViewMode && hoveredKey) {
    enterViewMode(hoveredKey);
  }
}

renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("click", onClick);

renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  if (isViewMode) {
    isDragging = true;
    lastPointerX = e.clientX;

    rotationInertia.velocity = 0;
  }
});

window.addEventListener("pointerup", () => {
  isDragging = false;
  if (Math.abs(rotationInertia.velocity) < rotationInertia.releaseDeadzone) {
    rotationInertia.velocity = 0;
  }
});

renderer.domElement.addEventListener("pointerleave", () => {
  if (!isViewMode) setHover(null);
});

btnExitView.addEventListener("click", () => {
  exitViewMode();
});

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

  updateCameraAnimation(time);
  updateRotationAnim(time);
  updateInertia();

  renderer.render(scene, camera);
}
