import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.2/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/loaders/DRACOLoader.js';

// Expose to window
window.THREE = THREE;
window.GLTFLoader = GLTFLoader;
window.DRACOLoader = DRACOLoader;
window.gsap = gsap;

// Global variables
let scene, camera, renderer, model;
let cameraTarget;
let mixer, clock;
let isCubeFallback = false;

const container = document.getElementById('scene-container');

// Camera Views (THREE is now defined because we imported it)
const cameraViews = {
  'camera-view-1': {
    position: new THREE.Vector3(-12, -4, 6),
    target: new THREE.Vector3(0, 0, 0),
  },
  'camera-view-2': {
    position: new THREE.Vector3(8, 7, 5),
    target: new THREE.Vector3(0, 2.5, 1),
  },
  'camera-view-3': {
    position: new THREE.Vector3(15, 3, -6),
    target: new THREE.Vector3(0, 1, 0),
  },
};

const params = {
  enableCubeRotation: false,
};

const desktopCamFov = 50;
const mobileCamFov = 80;

const progressBar = document.getElementById('progress-bar');

function setupCameraControls() {
  const buttons = [
    document.getElementById('camera-view-1'),
    document.getElementById('camera-view-2'),
    document.getElementById('camera-view-3'),
  ];

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = cameraViews[button.id];
      if (!view) return;

      gsap.to(camera.position, {
        duration: 1.5,
        x: view.position.x,
        y: view.position.y,
        z: view.position.z,
        ease: 'power2.inOut',
        onUpdate: () => camera.lookAt(cameraTarget),
      });

      gsap.to(cameraTarget, {
        duration: 1.5,
        x: view.target.x,
        y: view.target.y,
        z: view.target.z,
        ease: 'power2.inOut',
        onUpdate: () => camera.lookAt(cameraTarget),
      });
    });
  });
}

function setupColorControls() {
  const buttons = document.querySelectorAll('.color-button');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const colorHex = button.getAttribute('data-color');
      if (!model) return;

      model.traverse((child) => {
        if (
          child.isMesh &&
          child.material &&
          child.material.name === 'White_Custom'
        ) {
          child.material.color.set(colorHex);
        }
      });
    });
  });
}

function loadModel() {
  // Previous plain GLTF loading (kept for reference):
  // const loader = new GLTFLoader();
  // loader.load(modelPath, onLoad, onProgress, onError);

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  const modelPath =
    'https://bunqlabs.github.io/eyecandy/assets/DRACO/draco_trimmed.glb';
  // const modelPath = 'assets/draco/draco_trimmed.glb';

  loader.load(
    modelPath,
    (gltf) => {
      model = gltf.scene;

      const newBlackMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.4,
        side: THREE.DoubleSide,
        name: 'Black_Custom',
      });

      const newEyeMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 10,
        name: 'Eye_Custom',
      });

      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.castShadow = false;
          child.receiveShadow = false;
          if (child.material.name === 'Black')
            child.material = newBlackMaterial;
          if (child.material.name === 'Eye') child.material = newEyeMaterial;
        }
      });

      model.scale.set(5, 5, 5);
      model.position.y = -1;
      model.rotation.y = -Math.PI / 2;
      scene.add(model);

      mixer = new THREE.AnimationMixer(model);
      if (gltf.animations.length > 0) {
        mixer.clipAction(gltf.animations[0]).play();
      }
    },
    (xhr) => {
      if (xhr.lengthComputable && progressBar) {
        const percentComplete = (xhr.loaded / xhr.total) * 100;
        progressBar.style.width = percentComplete + '%';
      }
    },
    (error) => {
      console.error('Model load error:', error);
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
      model = new THREE.Mesh(geometry, material);
      scene.add(model);
      isCubeFallback = true;
      params.enableCubeRotation = true;
    }
  );
}

function init() {
  clock = new THREE.Clock();
  scene = new THREE.Scene();

  const aspect = container.clientWidth / container.clientHeight;
  const initialView = cameraViews['camera-view-1'];
  cameraTarget = initialView.target.clone();

  // ---------- FIX FOV ON LOAD ----------
  const isMobile = window.innerWidth <= 1024;
  const fov = isMobile ? mobileCamFov : desktopCamFov;

  camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
  camera.position.copy(initialView.position);
  camera.lookAt(cameraTarget);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Keep tone mapping (ACESFilmic is excellent)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;

  renderer.shadowMap.enabled = false;

  container.appendChild(renderer.domElement);

  loadModel();

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  setupCameraControls();
  setupColorControls();

  window.addEventListener('resize', onWindowResize);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);
  else if (model && isCubeFallback && params.enableCubeRotation) {
    model.rotation.x += 0.005;
    model.rotation.y += 0.01;
  }
  if (cameraTarget) camera.lookAt(cameraTarget);

  renderer.render(scene, camera);
}

function onWindowResize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const aspect = width / height;

  const isMobile = window.innerWidth <= 1024;
  camera.fov = isMobile ? mobileCamFov : desktopCamFov;

  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function hideLoaderWhenReady() {
  let checks = 0;
  const maxChecks = 100; // safety limit (~1.6s at 60fps)

  function check() {
    checks++;

    // Condition 1: Model is loaded
    // Condition 2: At least one frame has been rendered (canvas has content)
    const canvas = renderer.domElement;
    const hasContent = canvas && canvas.offsetHeight > 0; // canvas is in DOM and visible
    const modelReady = !!model; // model exists (even fallback cube counts)

    // Once the model is loaded, set progress to 100%
    if (modelReady && progressBar && progressBar.style.width !== '100%') {
      progressBar.style.width = '100%';
    }

    if (modelReady && hasContent && checks < maxChecks) {
      // Optional: wait one extra frame so first render is complete
      requestAnimationFrame(() => {
        setTimeout(() => {
          const loader = document.getElementById('loader');
          if (!loader) return;

          loader.style.transform = 'translateY(-100%)';

          const onEnd = () => {
            loader.style.display = 'none';
            loader.removeEventListener('transitionend', onEnd);
          };
          loader.addEventListener('transitionend', onEnd);
        }, 500); //  exactly 0.5 second delay
      });
    } else if (checks < maxChecks) {
      requestAnimationFrame(check);
    } else {
      // Fallback: force hide after timeout (in case something went wrong)
      const loader = document.getElementById('loader');
      if (loader) loader.style.display = 'none';
    }
  }

  requestAnimationFrame(check);
}

init();
animate();
hideLoaderWhenReady();
