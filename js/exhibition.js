import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createLoadingProgress } from "./loading-progress.js";

const isMobile = window.matchMedia("(max-width: 768px)").matches;
const isTouchLike = window.matchMedia(
  "(hover: none) and (pointer: coarse)",
).matches;
const isCompactLayout = window.matchMedia(
  "(max-width: 1024px), (hover: none) and (pointer: coarse)",
).matches;

const btnExitExhibition = document.getElementById("btn-exit-exhibition");
const btnSwitchHall = document.getElementById("btn-switch-hall");

btnExitExhibition?.addEventListener("click", () => {
  window.location.href = "gallery.html";
});

const container = document.getElementById("exhibition-container");
const preloader = document.getElementById("preloader");
const preloaderPerc = document.getElementById("preloader-perc");
const preloaderFill = preloader?.querySelector(".preloader-bar-fill");
const earlyPreloader = window.__EXHIBITION_PRELOADER__;

if (earlyPreloader && typeof earlyPreloader.stop === "function") {
  earlyPreloader.stop();
}

const loadingProgress = createLoadingProgress({
  preloader,
  fill: preloaderFill,
  perc: preloaderPerc,
});

const infoPanel = document.getElementById("sculpture-info");
const infoTitle = document.getElementById("info-title");
const infoText = document.getElementById("info-text");
const btnExitView = document.getElementById("btn-exit-view");
const infoToggle = document.getElementById("info-toggle");

const focusMaskEl = document.getElementById("focus-mask");
const viewHintsEl = document.getElementById("view-hints");

function setViewUI(isOn) {
  if (focusMaskEl && !isCompactLayout) {
    focusMaskEl.classList.toggle("is-visible", isOn);
  }

  if (viewHintsEl && !isCompactLayout) {
    viewHintsEl.classList.toggle("is-visible", isOn);
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setPixelRatio(
  isMobile ? 1.25 : Math.min(window.devicePixelRatio || 1, 2),
);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
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

function getGalleryYawLimit() {
  const width = window.innerWidth || document.documentElement.clientWidth || 0;

  if (width <= 768) return 0.35;
  if (width <= 1180) return Math.max(0.18, 0.34 - (width - 768) * 0.00047);

  return 0.35;
}

const initialGalleryYawLimit = getGalleryYawLimit();

const galleryLook = {
  active: false,
  lastX: 0,
  startX: 0,
  moved: false,
  yaw: 0,
  minYaw: -initialGalleryYawLimit,
  maxYaw: initialGalleryYawLimit,
  speed: 0.0018,
  baseQuat: new THREE.Quaternion(),
};

const touchView = {
  mode: null,
  lastX: 0,
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
  onComplete: null,
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

const exhibitionHalls = [
  {
    asset: "../assets/scene0.glb",
    cameraName: "Camera",
    switchLabel: "Следующий зал",
    ambientLight: {
      color: 0xffffff,
      intensity: 1.65,
    },
    hemisphereLight: {
      skyColor: 0xffffff,
      groundColor: 0x151515,
      intensity: 2.6,
    },
    persistentLights: [
      {
        name: "L_FILL",
        intensity: 900,
      },
    ],
    sculptureDefaults: {
      focusMode: "camera-forward",
      focusHeight: 0.58,
      viewFitMultiplier: 1.55,
      minViewDistance: 2.15,
      maxViewDistance: 3.35,
      zoomMinMultiplier: 0.48,
      rotationDirection: -1,
    },
    sculptures: {
      JukovLP: {
        title: "Жуков",
        text:
          "Маршал Советского Союза, принявший капитуляцию Германии и Парад Победы 24 июня 1945 года.",
        lights: ["L_Juk1", "L_Juk2"],
        maxDeltaZ: Infinity,
      },
      KonevLP: {
        title: "Конев",
        text:
          "Маршал Советского Союза, командовавший 1-м Украинским фронтом в финальных операциях войны.",
        lights: ["L_Kon1", "L_Kon2"],
        maxDeltaZ: Infinity,
      },
      MalinovskiLP: {
        title: "Малиновский",
        text:
          "Маршал Советского Союза, чьи войска сыграли важную роль в освобождении Южной Украины и разгроме Квантунской армии.",
        lights: ["L_Mal1", "L_Mal2"],
        maxDeltaZ: Infinity,
      },
      RokossovkiiyLP: {
        title: "Рокоссовский",
        text:
          "Маршал Советского Союза, командовавший Парадом Победы на Красной площади 24 июня 1945 года.",
        lights: ["L_Rok1", "L_Rok2"],
        maxDeltaZ: Infinity,
      },
    },
  },
  {
    asset: "../assets/scene.glb",
    switchLabel: "Предыдущий зал",
    galleryLookDirection: -1,
    sculptures: {
      Man1Mesh: {
        title: "Первый славянин",
        text:
          "Скульптурный образ, обращённый к истокам и становлению человека в мире. Композиция раскрывает момент внутреннего выбора — между действием и осмыслением, создавая образ человека на границе начала истории и культуры.",
        lights: ["M1SPL"],
        maxDeltaZ: Infinity,
      },
      KitelMesh: {
        title: "Китель друга",
        text:
          "Бронзовая композиция о памяти и присутствии человека через вещь. " +
          "Китель здесь — не просто форма, а знак службы, дружбы и уважения.",
        lights: ["KSL"],
        minDeltaZ: -Math.PI / 3,
        maxDeltaZ: Math.PI / 6,
      },
      Loris: {
        title: "Лорис-Меликов",
        text:
          "Бронзовый портретный образ, построенный на сдержанности и внутренней собранности. " +
          "Скульптура воспринимается как размышление о государственной ответственности, служении и цене решений.",
        lights: ["M2SPL"],
        maxDeltaZ: Infinity,
      },
      Children: {
        title: "Дети войны",
        text:
          "Бронзовая работа о хрупкости и стойкости. " +
          "Композиция обращает внимание на тех, кто вынес войну в детском возрасте.",
        lights: ["M3SPL"],
        maxDeltaZ: Infinity,
      },
      PressMesh: {
        title: "Журналистам",
        text:
          "Скульптурная композиция, посвящённая профессии свидетеля и посредника. Работа говорит о личной ответственности за слово и о хрупком балансе между фактом, памятью и временем.",
        lights: ["M0SPL"],
        maxDeltaZ: Infinity,
      },
    },
  },
];

const sculptures = {};

const MIN_LOD_DETAIL_DISTANCE = 1.5;

let currentHallIndex = 0;
let isHallLoading = false;
let hasStartedAnimation = false;

function getGalleryLookDirection() {
  const direction = exhibitionHalls[currentHallIndex]?.galleryLookDirection;
  return direction === -1 ? -1 : 1;
}

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

const galleryLookSlider = document.getElementById("gallery-look-slider");

const hoverHint = document.createElement("div");
hoverHint.id = "hover-hint";
hoverHint.className = "hover-hint";
hoverHint.textContent = "Нажмите, чтобы рассмотреть";
hoverHint.style.position = "fixed";
hoverHint.style.pointerEvents = "none";
hoverHint.style.display = "none";
document.body.appendChild(hoverHint);

let lastRenderTime = 0;
const mobileFrameInterval = 1000 / 30;

manager.onProgress = (_url, loaded, total) => {
  loadingProgress.set(total ? loaded / total : 0.5);
};

manager.onLoad = () => {
  loadingProgress.set(0.96);
};

function getNextHallIndex() {
  return (currentHallIndex + 1) % exhibitionHalls.length;
}

function updateHallSwitchButton() {
  if (!btnSwitchHall) return;

  btnSwitchHall.disabled = isHallLoading || exhibitionHalls.length < 2;
  btnSwitchHall.textContent = isHallLoading
    ? "Загрузка..."
    : exhibitionHalls[currentHallIndex].switchLabel;
}

function clearSculptures() {
  Object.keys(sculptures).forEach((key) => {
    delete sculptures[key];
  });
}

function disposeMaterial(material) {
  Object.values(material).forEach((value) => {
    if (value && value.isTexture) value.dispose();
  });

  material.dispose();
}

function disposeScene(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();

    if (Array.isArray(obj.material)) {
      obj.material.forEach(disposeMaterial);
    } else if (obj.material) {
      disposeMaterial(obj.material);
    }
  });
}

function resetInteractionState() {
  hoveredKey = null;
  activeKey = null;
  isViewMode = false;
  isDragging = false;

  galleryLook.active = false;
  touchView.mode = null;
  camAnim.active = false;
  camAnim.onComplete = null;
  rotationAnim.active = false;
  rotationAnim.key = null;
  rotationInertia.velocity = 0;
  viewZoom.active = false;

  document.body.classList.remove("view-mode");
  hoverHint.style.display = "none";
  setViewUI(false);

  if (infoPanel) {
    infoPanel.style.display = "none";
    infoPanel.classList.remove("is-open");
  }
}

function getLightNames(cfg) {
  if (Array.isArray(cfg.lights)) return cfg.lights;
  if (cfg.light) return [cfg.light];
  return [];
}

function setSculptureLights(obj, isOn) {
  if (!obj || !obj.lights) return;

  obj.lights.forEach((light, index) => {
    light.intensity = isOn ? obj.lightDefaultIntensities[index] : 0;
  });
}

function clearAllSculptureLights() {
  Object.values(sculptures).forEach((obj) => {
    setSculptureLights(obj, false);
  });
}

function setupCamera(gltf, root, hall) {
  const cameraNames = [hall.cameraName, "MainCamera", "Camera"].filter(Boolean);
  let gltfCam = null;

  for (const name of cameraNames) {
    gltfCam = root.getObjectByName(name);
    if (gltfCam && gltfCam.isCamera) break;
  }

  if (
    !(gltfCam && gltfCam.isCamera) &&
    gltf.cameras &&
    gltf.cameras.length > 0
  ) {
    gltfCam = gltf.cameras[0];
    if (!gltfCam.parent) root.add(gltfCam);
  }

  const nextCamera =
    gltfCam && gltfCam.isCamera
      ? gltfCam
      : new THREE.PerspectiveCamera(
          50,
          container.clientWidth / container.clientHeight,
          0.1,
          1000,
        );

  if (!nextCamera.parent) {
    nextCamera.position.set(0, 2, 5);
    nextCamera.lookAt(0, 1, 0);
    root.add(nextCamera);
  }

  nextCamera.aspect = container.clientWidth / container.clientHeight;
  nextCamera.updateProjectionMatrix();

  return nextCamera;
}

function setupHallLighting(root, hall) {
  if (hall.ambientLight) {
    const ambient = new THREE.AmbientLight(
      hall.ambientLight.color ?? 0xffffff,
      hall.ambientLight.intensity ?? 0,
    );

    ambient.name = "hall_ambient_light";
    root.add(ambient);
  }

  if (hall.hemisphereLight) {
    const hemi = new THREE.HemisphereLight(
      hall.hemisphereLight.skyColor ?? 0xffffff,
      hall.hemisphereLight.groundColor ?? 0x111111,
      hall.hemisphereLight.intensity ?? 0,
    );

    hemi.name = "hall_hemisphere_light";
    root.add(hemi);
  }

  (hall.persistentLights || []).forEach((cfg) => {
    const light = root.getObjectByName(cfg.name);

    if (!light) return;

    if (typeof cfg.intensity === "number") light.intensity = cfg.intensity;
    if (typeof cfg.distance === "number") light.distance = cfg.distance;
    if (typeof cfg.decay === "number") light.decay = cfg.decay;
  });
}

function setupSculptures(root, hall) {
  Object.keys(hall.sculptures).forEach((key) => {
    const lodData = createSculptureLod(root, key);
    if (!lodData) return;

    const cfg = {
      ...(hall.sculptureDefaults || {}),
      ...hall.sculptures[key],
    };
    const lights = getLightNames(cfg)
      .map((name) => root.getObjectByName(name))
      .filter(Boolean);
    const lightDefaultIntensities = lights.map((light) =>
      typeof light.intensity === "number" ? light.intensity : 1,
    );

    lights.forEach((light) => {
      light.intensity = 0;
    });

    sculptures[key] = {
      ...lodData,
      lights,
      lightDefaultIntensities,
      baseQuat: lodData.mesh.quaternion.clone(),
      curAngle: 0,
      config: cfg,
    };

    setSculptureDetail(sculptures[key], "low");
  });
}

function startRenderLoop() {
  if (hasStartedAnimation) return;

  hasStartedAnimation = true;
  animate();
}

function loadHall(hallIndex) {
  const hall = exhibitionHalls[hallIndex];

  if (!hall || isHallLoading) return;

  isHallLoading = true;
  updateHallSwitchButton();
  resetInteractionState();
  clearAllSculptureLights();

  loader.load(
    hall.asset,
    (gltf) => {
      const previousScene = scene;
      const nextScene = gltf.scene;
      const nextCamera = setupCamera(gltf, nextScene, hall);

      scene = nextScene;
      camera = nextCamera;
      currentHallIndex = hallIndex;

      if (previousScene) disposeScene(previousScene);

      clearSculptures();

      mainCamPos.copy(camera.position);
      mainCamQuat.copy(camera.quaternion);

      galleryLook.yaw = 0;
      updateGalleryLookLimits();
      galleryLook.baseQuat.copy(camera.quaternion);

      setupHallLighting(scene, hall);
      setupSculptures(scene, hall);
      applyGalleryLook();

      isHallLoading = false;
      updateHallSwitchButton();
      startRenderLoop();

      requestAnimationFrame(() => loadingProgress.hide());
    },
    undefined,
    (err) => {
      console.error("GLB load error", err);
      isHallLoading = false;
      updateHallSwitchButton();
      loadingProgress.hide();
    },
  );
}

btnSwitchHall?.addEventListener("click", () => {
  loadHall(getNextHallIndex());
});

updateHallSwitchButton();
loadHall(currentHallIndex);

function createSculptureLod(root, key) {
  const high = root.getObjectByName(key);
  if (!high) return null;

  const low = root.getObjectByName(`${key}_d`);

  if (!low) {
    return {
      high,
      low: null,
      mesh: high,
      lod: null,
      raycastTarget: high,
    };
  }

  const parent = high.parent || root;
  const lod = new THREE.LOD();

  lod.name = `${key}_lod`;
  lod.autoUpdate = false;
  lod.position.copy(high.position);
  lod.quaternion.copy(high.quaternion);
  lod.scale.copy(high.scale);
  parent.add(lod);

  high.removeFromParent();
  high.position.set(0, 0, 0);
  high.quaternion.identity();
  high.scale.set(1, 1, 1);
  lod.addLevel(high, 0);

  lod.attach(low);

  const box = new THREE.Box3().setFromObject(lod);
  const size = new THREE.Vector3();
  box.getSize(size);

  const switchDistance = Math.max(
    size.length() * (isMobile ? 3.05 : 2.35),
    MIN_LOD_DETAIL_DISTANCE,
  );

  lod.addLevel(low, switchDistance);

  return {
    high,
    low,
    mesh: lod,
    lod,
    switchDistance,
    raycastTarget: low,
  };
}

function setSculptureDetail(obj, mode) {
  if (!obj) return;

  const showHigh = mode === "high" || !obj.low;

  if (obj.high) obj.high.visible = showHigh;
  if (obj.low) obj.low.visible = !showHigh;

  obj.raycastTarget = showHigh ? obj.high : obj.low || obj.high || obj.mesh;
}

function setActiveSculptureDetail(key) {
  Object.entries(sculptures).forEach(([name, obj]) => {
    setSculptureDetail(obj, name === key ? "high" : "low");
  });
}

function setOverviewSculptureDetails() {
  Object.values(sculptures).forEach((obj) => {
    setSculptureDetail(obj, "low");
  });
}

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

function getSculptureFocusBounds(obj) {
  const target = obj.config.focusMode === "camera-forward" ? obj.high : obj.mesh;
  const box = new THREE.Box3().setFromObject(target || obj.mesh);

  if (box.isEmpty()) {
    box.setFromObject(obj.mesh);
  }

  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  box.getCenter(center);
  box.getSize(size);

  return { box, center, size };
}

function getViewDistance(obj, size, radius) {
  if (obj.config.focusMode !== "camera-forward") {
    return radius * (isCompactLayout ? 2.8 : 2.0);
  }

  const maxDimension = Math.max(size.x, size.y, size.z, 0.1);
  const fov = THREE.MathUtils.degToRad(camera.fov || 50);
  const fitDistance =
    (maxDimension / (2 * Math.tan(fov / 2))) *
    (obj.config.viewFitMultiplier || 1.55);

  const minDistance =
    typeof obj.config.minViewDistance === "number"
      ? obj.config.minViewDistance
      : 0.12;
  const maxDistance =
    typeof obj.config.maxViewDistance === "number"
      ? obj.config.maxViewDistance
      : Infinity;

  return Math.min(Math.max(fitDistance, minDistance), maxDistance);
}

function getFocusPoint(obj, box, center, size) {
  if (typeof obj.config.focusHeight !== "number") return center;

  const focus = center.clone();

  focus.y = box.min.y + size.y * obj.config.focusHeight;

  return focus;
}

function worldPointToCameraLocal(point) {
  if (!camera || !camera.parent) return point.clone();

  return camera.parent.worldToLocal(point.clone());
}

function worldDirectionToCameraLocal(dir) {
  if (!camera || !camera.parent) return dir.clone().normalize();

  const worldOrigin = camera.getWorldPosition(new THREE.Vector3());
  const localOrigin = worldPointToCameraLocal(worldOrigin);
  const localEnd = worldPointToCameraLocal(worldOrigin.clone().add(dir));

  return localEnd.sub(localOrigin).normalize();
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

  const targets = Object.values(sculptures).map((o) => o.raycastTarget);
  const intersects = raycaster.intersectObjects(targets, true);

  if (intersects.length > 0) {
    return findSculptureKeyByObject(intersects[0].object);
  }

  return null;
}

function startCameraAnimation(toPos, toQuat, duration = 1.2, onComplete = null) {
  if (!camera) return;

  camAnim.active = true;
  camAnim.duration = duration;
  camAnim.onComplete = onComplete;
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

  if (t >= 1) {
    const onComplete = camAnim.onComplete;

    camAnim.active = false;
    camAnim.onComplete = null;

    if (onComplete) onComplete();
  }
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
  if (hoveredKey === key || isViewMode || isMobile || isTouchLike) return;

  hoveredKey = key;

  Object.entries(sculptures).forEach(([name, obj]) => {
    setSculptureLights(obj, name === key);
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
  const viewportGap = 16;

  hoverHint.style.display = "block";

  const hintWidth = hoverHint.offsetWidth;
  const hintHeight = hoverHint.offsetHeight;
  const maxX = Math.max(
    viewportGap,
    window.innerWidth - hintWidth - viewportGap,
  );
  const maxY = Math.max(
    viewportGap,
    window.innerHeight - hintHeight - viewportGap,
  );
  const clampedX = Math.min(
    Math.max(x - hintWidth / 2, viewportGap),
    maxX,
  );
  const clampedY = Math.min(Math.max(y, viewportGap), maxY);

  hoverHint.style.left = `${clampedX}px`;
  hoverHint.style.top = `${clampedY}px`;
}

function enterViewMode(key) {
  const obj = sculptures[key];
  if (!obj || !camera) return;

  setActiveSculptureDetail(key);

  activeKey = key;
  isViewMode = true;

  mainCamPos.copy(camera.position);
  mainCamQuat.copy(camera.quaternion);

  document.body.classList.add("view-mode");
  hoverHint.style.display = "none";

  setViewUI(true);

  rotationInertia.velocity = 0;

  const { box, center, size } = getSculptureFocusBounds(obj);
  const focusPoint = worldPointToCameraLocal(
    getFocusPoint(obj, box, center, size),
  );

  const radius = size.length() || 1;
  const distance = getViewDistance(obj, size, radius);
  const dir =
    obj.config.focusMode === "camera-forward"
      ? worldDirectionToCameraLocal(
          camera.getWorldDirection(new THREE.Vector3()),
        )
      : new THREE.Vector3().subVectors(camera.position, focusPoint).normalize();

  if (dir.lengthSq() === 0) {
    dir.set(0, 0, -1);
  }

  const targetPos =
    obj.config.focusMode === "camera-forward"
      ? focusPoint.clone().addScaledVector(dir, -distance)
      : focusPoint.clone().add(dir.multiplyScalar(distance));

  const m = new THREE.Matrix4();
  m.lookAt(targetPos, focusPoint, camera.up);

  const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);

  viewZoom.target.copy(focusPoint);
  viewZoom.dir.copy(
    new THREE.Vector3().subVectors(targetPos, focusPoint).normalize(),
  );
  viewZoom.distance = targetPos.distanceTo(focusPoint);
  viewZoom.min = Math.max(
    radius *
      (obj.config.zoomMinMultiplier ||
        (isCompactLayout ? 0.55 : 0.3)),
    0.12,
  );
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

  clearAllSculptureLights();

  rotationInertia.velocity = 0;

  if (keyToReset && sculptures[keyToReset]) {
    startRotationReset(keyToReset);
  }

  startCameraAnimation(mainCamPos, mainCamQuat, 1.3, () => {
    if (!isViewMode) {
      setOverviewSculptureDetails();
    }
  });
}

function applyAngleForActive(angle) {
  if (!activeKey) return;

  const obj = sculptures[activeKey];
  if (!obj) return;

  const max = obj.config.maxDeltaZ;
  const min = Number.isFinite(obj.config.minDeltaZ)
    ? obj.config.minDeltaZ
    : Number.isFinite(max)
      ? -max
      : -Infinity;
  const upper = Number.isFinite(max) ? max : Infinity;
  let a = angle;

  if (a < min) a = min;
  if (a > upper) a = upper;

  obj.curAngle = a;

  const axis = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromAxisAngle(axis, obj.curAngle);

  obj.mesh.quaternion.copy(obj.baseQuat).multiply(q);

  if (
    (Number.isFinite(min) && obj.curAngle === min) ||
    (Number.isFinite(upper) && obj.curAngle === upper)
  ) {
    rotationInertia.velocity = 0;
  }
}

function rotateActiveByDrag(dx) {
  if (!isViewMode || !activeKey) return;

  rotationAnim.active = false;

  const obj = sculptures[activeKey];
  if (!obj) return;

  const direction =
    typeof obj.config.rotationDirection === "number"
      ? obj.config.rotationDirection
      : 1;
  const deltaAngle = dx * (isMobile ? 0.018 : 0.01) * direction;

  applyAngleForActive(obj.curAngle + deltaAngle);

  rotationInertia.velocity = dx * rotationInertia.velocityScale * direction;
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

function onClick() {
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
    galleryLook.yaw * getGalleryLookDirection(),
  );

  camera.position.copy(mainCamPos);
  camera.quaternion.copy(galleryLook.baseQuat).premultiply(yawQuat);

  if (galleryLookSlider) {
    const normalized =
      ((galleryLook.yaw - galleryLook.minYaw) /
        (galleryLook.maxYaw - galleryLook.minYaw)) *
        200 -
      100;

    galleryLookSlider.value = String(Math.round(normalized));
  }
}

function updateGalleryLookLimits() {
  const yawLimit = getGalleryYawLimit();

  galleryLook.minYaw = -yawLimit;
  galleryLook.maxYaw = yawLimit;

  if (galleryLook.yaw < galleryLook.minYaw) {
    galleryLook.yaw = galleryLook.minYaw;
  }

  if (galleryLook.yaw > galleryLook.maxYaw) {
    galleryLook.yaw = galleryLook.maxYaw;
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
      ((value + 100) / 200) * (galleryLook.maxYaw - galleryLook.minYaw);

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
        lookGalleryBy(dx);

        if (Math.abs(x - galleryLook.startX) > 8) {
          galleryLook.moved = true;
        }
      }

      return;
    }

    if (camAnim.active) return;

    if (touchView.mode === "rotate" && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchView.lastX;

      touchView.lastX = touch.clientX;

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
    }
  },
  { passive: false },
);

btnExitView?.addEventListener("click", () => {
  exitViewMode();
});

if (infoToggle && infoPanel) {
  infoToggle.addEventListener("click", () => {
    infoPanel.classList.toggle("is-open");
  });
}

function onResize() {
  updateGalleryLookLimits();

  if (!camera) return;

  const w = container.clientWidth;
  const h = container.clientHeight;

  renderer.setSize(w, h);

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  applyGalleryLook();
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
