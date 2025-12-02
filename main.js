// Imports removed. Using globals from vendor.js
// THREE, OrbitControls, GLTFLoader, EXRLoader, GUI, gsap are now global.

// Global variables
let scene, camera, renderer, model, controls, gui, postProcessingPipeline;
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

function setupGUI() {
  if (gui) gui.destroy();
  gui = new GUI({ title: 'Debug', width: 250 });

  const modelFolder = gui.addFolder('Model');
  if (isCubeFallback) {
    modelFolder.add(params, 'enableCubeRotation').name('Rotate Fallback Cube');
  } else {
    modelFolder
      .add({ spin: false }, 'spin')
      .name('Model Spin (Animated)').domElement.style.pointerEvents = 'none';
  }
  modelFolder.open();

  // Initial GUI state
  gui.domElement.style.display = 'none';

  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.code === 'KeyD') {
      gui.domElement.style.display =
        gui.domElement.style.display === 'none' ? 'block' : 'none';
    }
  });
}

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
        color: 0x333333,
        roughness: 0.3,
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

      setupGUI();
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
      setupGUI();
    }
  );
}

function init() {
  clock = new THREE.Clock();
  scene = new THREE.Scene();

  const aspect = container.clientWidth / container.clientHeight;
  const initialView = cameraViews['camera-view-1'];
  camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
  camera.position.copy(initialView.position);
  camera.lookAt(initialView.target);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0); // Ensure alpha is 0
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.8;
  renderer.shadowMap.enabled = true;

  container.appendChild(renderer.domElement);

  // Initialize Post Processing (Passes setup via postprocessing.js)
  postProcessingPipeline = window.setupPostProcessing(scene, camera, renderer);

  loadModel();

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  new EXRLoader().load(
    'https://bunqlabs.github.io/eyecandy/assets/environment.exr',
    (texture) => {
      texture.rotation = Math.PI / 2;
      texture.center.set(0.5, 0.5);
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      texture.dispose();
      pmremGenerator.dispose();
    }
  );

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(-1, 5, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(1024, 1024);
  directionalLight.shadow.bias = -0.0005;
  scene.add(directionalLight);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2;
  controls.maxDistance = 20;
  controls.target.copy(initialView.target);
  controls.update();

  setupGUI();
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

  if (postProcessingPipeline) {
    postProcessingPipeline.render();
  } else {
    renderer.render(scene, camera);
  }
}

function onWindowResize() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (window.innerWidth <= 1024) camera.fov = 70;
  else camera.fov = 50;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  if (postProcessingPipeline) {
    postProcessingPipeline.resize(width, height);
  }
}

// Start
init();
animate();
