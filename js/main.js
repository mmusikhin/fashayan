import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const container = document.getElementById('three-container');

const START_ROTATION_Y = Math.PI * 0.1; 

let scene, camera, renderer;
let model = null;
let targetRotationY = 0;
let currentRotationY = 0;
let baseY = 0;

let cursorLight = null;
let spotLight = null;

const preloader = document.getElementById('preloader');
const preloaderFill = preloader?.querySelector('.preloader-bar-fill');
const preloaderPerc = document.getElementById('preloader-perc');

function setLoadingProgress(progress) {
  if (!preloader) return;
  const clamped = Math.max(0, Math.min(progress, 1));
  const percent = Math.round(clamped * 100);
  if (preloaderFill) preloaderFill.style.width = `${percent}%`;
  if (preloaderPerc) preloaderPerc.textContent = `${percent}%`;
}

function hidePreloader() {
  if (!preloader) return;
  preloader.classList.add('preloader-hidden');
  setTimeout(() => {
    if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
  }, 500);
}

init();
animate();

function init() {
  if (!container) {
    hidePreloader();
    return;
  }

  scene = new THREE.Scene();
  scene.background = null;

  const width = container.clientWidth || window.innerWidth * 0.4;
  const height = container.clientHeight || (window.innerHeight - 72);

  camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
  camera.position.set(0, 1.2, 4);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1; 
  container.appendChild(renderer.domElement);

  // Базовый общий свет 
  const ambient = new THREE.AmbientLight(0xffffff, 5); 
  scene.add(ambient);

  const hemiLight = new THREE.HemisphereLight(0xf5f5f5, 0x020202, 12);
  hemiLight.position.set(0, 4, 4);
  scene.add(hemiLight);

  // Контровой свет (rim) — усилили и чуть подвинули
  const rimLight = new THREE.DirectionalLight(0xffffff, 1.6); 
  rimLight.position.set(-4.5, 4.2, -2.0);
  scene.add(rimLight);

  // Свет, который следует за “плавным” курсором из cursor.js
  cursorLight = new THREE.PointLight(0xffffff, 100.0, 3.0, 1.2); 
  cursorLight.position.set(0, 1.6, 2.8);
  scene.add(cursorLight);

  const loader = new GLTFLoader();
  loader.load(
    'assets/children.glb',
    (gltf) => {
      model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const desiredSize = 2;
      const scale = desiredSize / Math.max(size.x, size.y, size.z || 1);
      model.scale.setScalar(scale);

      model.position.sub(center.multiplyScalar(scale));
      model.position.y += 1.2;
      baseY = model.position.y;

      model.position.x += 1.4;
      model.rotation.y = START_ROTATION_Y;

      model.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          if (obj.material && obj.material.map) {
            obj.material.map.colorSpace = THREE.SRGBColorSpace;
          }
        }
      });

      scene.add(model);

      if (spotLight) {
        const targetPos = new THREE.Vector3();
        model.updateWorldMatrix(true, true);
        model.getWorldPosition(targetPos);
        targetPos.y += 0.4;
        spotLight.target.position.copy(targetPos);
      }

      setLoadingProgress(1);
      hidePreloader();
    },
    (xhr) => {
      if (xhr.total) {
        setLoadingProgress(xhr.loaded / xhr.total);
      } else {
        setLoadingProgress(0.5);
      }
    },
    () => {
      hidePreloader();
    }
  );

  window.addEventListener('scroll', onScroll);
  window.addEventListener('resize', onWindowResize);

  const btn3d = document.getElementById('btn-3d');
  if (btn3d) btn3d.addEventListener('click', () => (window.location.href = 'html/gallery.html'));

  const btnMore = document.getElementById('btn-more-sculptor');
  if (btnMore) btnMore.addEventListener('click', () => (window.location.href = 'html/sculptor.html'));
}

function onScroll() {
  const scrollY = window.scrollY || window.pageYOffset || 0;
  targetRotationY = scrollY * 0.003;
}

function onWindowResize() {
  if (!renderer || !camera || !container) return;

  const width = container.clientWidth || window.innerWidth * 0.4;
  const height = container.clientHeight || (window.innerHeight - 72);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// Берём координаты из cursor.js (window.__cursorLight), и только ими двигаем THREE PointLight
function updateCursorAndLight() {
  if (!renderer || !camera || !cursorLight) return;

  const api = window.__cursorLight;
  if (!api) return; // если cursor.js не подключён — просто не двигаем свет (без ошибок)

  const cursorX = api.x;
  const cursorY = api.y;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((cursorX - rect.left) / rect.width) * 2 - 1;
  const y = -((cursorY - rect.top) / rect.height) * 2 + 1;

  const ndc = new THREE.Vector3(x, y, 0.5);
  ndc.unproject(camera);
  const dir = ndc.sub(camera.position).normalize();

  const distance = 1.6; // было 2.3 — ближе к модели, свет от курсора ощущается сильнее
  cursorLight.position.copy(camera.position).add(dir.multiplyScalar(distance));
}

function animate() {
  requestAnimationFrame(animate);

  updateCursorAndLight();

  if (model) {
    currentRotationY += (targetRotationY - currentRotationY) * 0.08;
    const halfRot = currentRotationY * 0.5;
    model.rotation.y = START_ROTATION_Y + halfRot;

    const t = performance.now() * 0.001;
    model.position.y = baseY + Math.sin(t * 1.2) * 0.04;
  }

  if (renderer && camera && scene) {
    renderer.render(scene, camera);
  }
}
