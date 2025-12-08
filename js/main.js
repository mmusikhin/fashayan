import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const container = document.getElementById('three-container');

let scene, camera, renderer;
let model = null;
let targetRotationY = 0;
let currentRotationY = 0;
let baseY = 0;

let cursorLight = null;
let cursorCircle = null;
let spotLight = null;

let cursorTargetX = window.innerWidth / 2;
let cursorTargetY = window.innerHeight / 2;
let cursorX = cursorTargetX;
let cursorY = cursorTargetY;

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
  renderer.toneMappingExposure = 0.9;
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.01);
  scene.add(ambient);

  const hemiLight = new THREE.HemisphereLight(0xf5f5f5, 0x020202, 0.75);
  hemiLight.position.set(0, 4, 0);
  scene.add(hemiLight);

  spotLight = new THREE.SpotLight(0xffffff, 3.0, 15, Math.PI / 7, 0.35, 2);
  spotLight.position.set(1.6, 4.2, 2.4);
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.set(2048, 2048);
  spotLight.shadow.bias = -0.0002;
  spotLight.target.position.set(0, 1, 0);
  scene.add(spotLight);
  scene.add(spotLight.target);

  const rimLight = new THREE.DirectionalLight(0xffffff, 1);
  rimLight.position.set(-3.5, 3.5, -3.0);
  scene.add(rimLight);

  cursorLight = new THREE.PointLight(0xffffff, 2, 1.7, 2);
  cursorLight.position.set(0, 1.6, 2.8);
  scene.add(cursorLight);

  cursorCircle = document.createElement('div');
  cursorCircle.className = 'cursor-light';
  document.body.appendChild(cursorCircle);

  const loader = new GLTFLoader();
  loader.load(
    '../assets/sculpt.glb',
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

      model.position.x -= 0.25;

      model.rotation.y = Math.PI;

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
  window.addEventListener('mousemove', onMouseMove);

  const btn3d = document.getElementById('btn-3d');
  if (btn3d) btn3d.addEventListener('click', () => window.location.href = 'gallery.html');

  const btnMore = document.getElementById('btn-more-sculptor');
  if (btnMore) btnMore.addEventListener('click', () => window.location.href = 'sculptor.html');
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

function onMouseMove(e) {
  cursorTargetX = e.clientX;
  cursorTargetY = e.clientY;
}

function updateCursorAndLight() {
  if (!renderer || !camera || !cursorLight || !cursorCircle) return;

  const lerpFactor = 0.06;
  cursorX += (cursorTargetX - cursorX) * lerpFactor;
  cursorY += (cursorTargetY - cursorY) * lerpFactor;

  cursorCircle.style.left = `${cursorX}px`;
  cursorCircle.style.top = `${cursorY}px`;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((cursorX - rect.left) / rect.width) * 2 - 1;
  const y = -((cursorY - rect.top) / rect.height) * 2 + 1;

  const ndc = new THREE.Vector3(x, y, 0.5);
  ndc.unproject(camera);
  const dir = ndc.sub(camera.position).normalize();

  const distance = 2.3;
  cursorLight.position.copy(camera.position).add(dir.multiplyScalar(distance));
}

function animate() {
  requestAnimationFrame(animate);

  updateCursorAndLight();

  if (model) {
    currentRotationY += (targetRotationY - currentRotationY) * 0.08;
    const halfRot = currentRotationY * 0.5;
    model.rotation.y = Math.PI + halfRot;

    const t = performance.now() * 0.001;
    model.position.y = baseY + Math.sin(t * 1.2) * 0.04;
  }
  if (renderer && camera && scene) {
    renderer.render(scene, camera);
  }
}