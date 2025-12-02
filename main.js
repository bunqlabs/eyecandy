import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.181.2/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/loaders/EXRLoader.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'https://cdn.jsdelivr.net/npm/three@0.181.2/examples/jsm/postprocessing/GTAOPass.js';

// Expose to window
window.THREE = THREE;
window.OrbitControls = OrbitControls;
window.GLTFLoader = GLTFLoader;
window.EXRLoader = EXRLoader;
window.EffectComposer = EffectComposer;
window.RenderPass = RenderPass;
window.OutputPass = OutputPass;
window.GTAOPass = GTAOPass;
window.gsap = gsap;

// Global variables
let scene, camera, renderer, model, controls, composer;
let mixer, clock;
let isCubeFallback = false;

const container = document.getElementById('scene-container');

// Camera Views (THREE is now defined because we imported it)
const cameraViews = {
  'camera-view-1': {
    position: new THREE.Vector3(7, 7, 4),
    target: new THREE.Vector3(0, 3, 1),
  },
  'camera-view-2': {
    position: new THREE.Vector3(-12, -4, 6),
    target: new THREE.Vector3(0, 0, 0),
  },
  'camera-view-3': {
    position: new THREE.Vector3(15, 3, -6),
    target: new THREE.Vector3(0, 0, 0),
  },
};

const params = {
  enableCubeRotation: false,
};

const desktopCamFov = 50;
const mobileCamFov = 80;

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

      controls.enabled = false;

      gsap.to(camera.position, {
        duration: 1.5,
        x: view.position.x,
        y: view.position.y,
        z: view.position.z,
        ease: 'power2.inOut',
        onUpdate: () => camera.updateProjectionMatrix(),
        onComplete: () => {
          controls.enabled = true;
        },
      });

      gsap.to(controls.target, {
        duration: 1.5,
        x: view.target.x,
        y: view.target.y,
        z: view.target.z,
        ease: 'power2.inOut',
        onUpdate: () => controls.update(),
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
  const loader = new GLTFLoader();
  const modelPath =
    'https://bunqlabs.github.io/eyecandy/assets/gltf_export_trimmed_materials_baked_lights.glb';
  // const modelPath = 'assets/gltf_export_trimmed_materials_baked_lights.glb';

  loader.load(
    modelPath,
    (gltf) => {
      model = gltf.scene;

      const newWhiteMaterial = new THREE.MeshStandardMaterial({
        color: 0xff6c31,
        roughness: 0.6,
        side: THREE.DoubleSide,
        name: 'White_Custom',
      });

      const newBlackMaterial = new THREE.MeshStandardMaterial({
        color: 0x777777,
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
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material.name === 'White')
            child.material = newWhiteMaterial;
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
    undefined,
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

  // ---------- FIX FOV ON LOAD ----------
  const isMobile = window.innerWidth <= 1024;
  const fov = isMobile ? mobileCamFov : desktopCamFov;

  camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
  camera.position.copy(initialView.position);
  camera.lookAt(initialView.target);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Keep tone mapping (ACESFilmic is excellent)
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.8;

  renderer.shadowMap.enabled = true;
  renderer.autoClear = false; // Required for EffectComposer

  container.appendChild(renderer.domElement);

  // Post-processing setup with GTAO
  const renderSize = new THREE.Vector2();
  renderer.getSize(renderSize);
  const dpr = renderer.getPixelRatio();

  const gtaoParams = {
    width: renderSize.width * dpr,
    height: renderSize.height * dpr,
    kernelRadius: 8,
    minResolution: 4,
    outputMode: 0, // 0: Default (beauty + AO)
    maxSamples: 32,
    luminanceInfluence: 0.7,
    radius: 5,
    scale: 1.0,
    bias: 0.5,
    intensity: 1.0,
    color: new THREE.Color(0x000000),
    cameraNear: camera.near,
    cameraFar: camera.far,
    cameraFov: (camera.fov * Math.PI) / 180,
  };

  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const gtaoPass = new GTAOPass(scene, camera, gtaoParams);
  composer.addPass(gtaoPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  loadModel();

  // Environment map (EXR → PMREM)
  // const pmremGenerator = new THREE.PMREMGenerator(renderer);
  // pmremGenerator.compileEquirectangularShader();

  // new EXRLoader().load(
  //   'https://bunqlabs.github.io/eyecandy/assets/environment.exr',
  //   (texture) => {
  //     texture.rotation = Math.PI / 2;
  //     texture.center.set(0.5, 0.5);
  //     const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  //     scene.environment = envMap;
  //     texture.dispose();
  //     pmremGenerator.dispose();
  //   }
  // );

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(-1, 5, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(1024, 1024);
  directionalLight.shadow.bias = -0.0005;
  scene.add(directionalLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2;
  controls.maxDistance = 20;
  controls.target.copy(initialView.target);
  controls.update();

  setupCameraControls();
  setupColorControls();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({ opacity: 0.3 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -4.4;
  ground.receiveShadow = true;
  scene.add(ground);

  window.addEventListener('resize', onWindowResize);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (controls) controls.update();
  if (mixer) mixer.update(delta);
  else if (model && isCubeFallback && params.enableCubeRotation) {
    model.rotation.x += 0.005;
    model.rotation.y += 0.01;
  }

  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
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

  if (composer) {
    composer.setSize(width, height);
    const dpr = renderer.getPixelRatio();
    composer.passes[1].uniforms.resolution.value.set(width * dpr, height * dpr); // Update GTAOPass resolution
  }
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

    if (modelReady && hasContent && checks < maxChecks) {
      // Optional: wait one extra frame so first render is complete
      requestAnimationFrame(() => {
        setTimeout(() => {
          const loader = document.getElementById('loader');
          if (!loader) return;

          loader.style.transition =
            'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
          loader.style.transform = 'translateY(-100%)';

          const onEnd = () => {
            loader.style.display = 'none';
            loader.removeEventListener('transitionend', onEnd);
          };
          loader.addEventListener('transitionend', onEnd);
        }, 500); // ← exactly 0.5 second delay
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
