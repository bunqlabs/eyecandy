// Global variables for the scene elements
let scene, camera, renderer, model, controls, composer, gui;
let filmPass, dotScreenPass, rgbShiftPass; // Post-processing passes
// Animation variables
let mixer;
let clock;
let isCubeFallback = false; // Flag to track if we are using the fallback cube

const container = document.getElementById('scene-container');

// Define camera views
const cameraViews = {
  'camera-view-1': {
    position: new THREE.Vector3(7, 9, 4),
    target: new THREE.Vector3(0, 3, 1),
  },
  'camera-view-2': {
    position: new THREE.Vector3(0, 2, 8),
    target: new THREE.Vector3(0, 0, 0),
  },
  'camera-view-3': {
    position: new THREE.Vector3(4, 1, 0),
    target: new THREE.Vector3(0, 0, 0),
  },
};

// State object for the GUI controls
const params = {
  enableCubeRotation: false,
  enableFilm: false,
  enableDotScreen: false,
  enableRGBShift: false,
};

// --- GUI Setup Function ---
function setupGUI() {
  if (gui) gui.destroy();

  gui = new dat.GUI({ title: 'Post-Processing Toggles', width: 250 });

  // Effect Toggles Folder
  const effectsFolder = gui.addFolder('Effects');

  effectsFolder
    .add(params, 'enableFilm')
    .name('Film (Noise/Scanlines)')
    .onChange((value) => {
      filmPass.enabled = value;
    });

  effectsFolder
    .add(params, 'enableDotScreen')
    .name('Dot Screen (Halftone)')
    .onChange((value) => {
      dotScreenPass.enabled = value;
    });

  effectsFolder
    .add(params, 'enableRGBShift')
    .name('RGB Shift (Chromatic)')
    .onChange((value) => {
      rgbShiftPass.enabled = value;
    });

  effectsFolder.open();

  // Model Control Folder
  const modelFolder = gui.addFolder('Model');
  if (isCubeFallback) {
    modelFolder.add(params, 'enableCubeRotation').name('Rotate Fallback Cube');
  } else {
    modelFolder
      .add({ spin: false }, 'spin')
      .name('Model Spin (Animated)').domElement.style.pointerEvents = 'none';
  }
  modelFolder.open();
}

// --- NEW: GSAP Camera Controls Setup ---
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

      // 1. Disable OrbitControls during animation
      controls.enabled = false;

      // 2. Animate Camera Position
      gsap.to(camera.position, {
        duration: 1.5,
        x: view.position.x,
        y: view.position.y,
        z: view.position.z,
        ease: 'power2.inOut',
        onUpdate: () => {
          camera.updateProjectionMatrix();
        },
        onComplete: () => {
          // 4. Re-enable controls after animation finishes
          controls.enabled = true;
        },
      });

      // 3. Animate Controls Target (LookAt Point)
      // We animate the controls.target properties, and call controls.update() on every frame
      gsap.to(controls.target, {
        duration: 1.5,
        x: view.target.x,
        y: view.target.y,
        z: view.target.z,
        ease: 'power2.inOut',
        onUpdate: () => {
          controls.update();
        },
      });
    });
  });
}

// --- Load GLTF Model Function ---
function loadModel() {
  const loader = new THREE.GLTFLoader();
  const modelPath = '/assets/tensor.glb';

  loader.load(
    modelPath,
    (gltf) => {
      // SUCCESS
      model = gltf.scene;

      // Adjusted scale slightly for the new model
      model.scale.set(5, 5, 5);
      model.position.y = -1;
      model.rotation.y = -Math.PI / 2;
      scene.add(model);

      mixer = new THREE.AnimationMixer(model);
      if (gltf.animations.length > 0) {
        const clip = gltf.animations[0];
        const action = mixer.clipAction(clip);
        action.play();
      } else {
        console.warn('Model loaded but contains no animations.');
      }

      // Update status message
      console.log('Model loaded successfully.');

      // Re-setup GUI to ensure controls are correct
      setupGUI();
    },
    undefined,
    (error) => {
      // ERROR
      console.error('An error occurred while loading the model:', error);

      // --- FALLBACK CUBE ---
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({
        color: 0xff6b6b,
        wireframe: false,
      });
      model = new THREE.Mesh(geometry, material);
      scene.add(model);

      isCubeFallback = true;
      params.enableCubeRotation = true; // Enable rotation for the fallback cube

      // Update status message
      console.log('Using fallback cube due to model loading error.');

      // Re-setup GUI to expose the rotation control for the cube
      setupGUI();
    }
  );
}

// --- Initialization Function ---
function init() {
  clock = new THREE.Clock();

  // 1. Scene Setup
  scene = new THREE.Scene();

  // 2. Camera Setup
  const aspect = container.clientWidth / container.clientHeight;
  const initialView = cameraViews['camera-view-1'];
  camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
  camera.position.copy(initialView.position);
  camera.lookAt(initialView.target);

  // 3. Renderer Setup
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // 4. Load the Model
  loadModel();

  // 5. Lighting Setup
  // const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  // scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // 6. OrbitControls Setup
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 2;
  controls.maxDistance = 20;
  controls.target.copy(initialView.target);
  controls.update();

  // 7. Post-Processing Setup
  composer = new THREE.EffectComposer(renderer);

  const renderPass = new THREE.RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Film Pass
  filmPass = new THREE.ShaderPass(THREE.FilmShader);
  filmPass.uniforms['nIntensity'].value = 0.5;
  filmPass.uniforms['sIntensity'].value = 0.1;
  filmPass.uniforms['sCount'].value = 512;
  filmPass.enabled = params.enableFilm;
  composer.addPass(filmPass);

  // Dot Screen Pass
  dotScreenPass = new THREE.ShaderPass(THREE.DotScreenShader);
  dotScreenPass.uniforms['scale'].value = 4;
  dotScreenPass.enabled = params.enableDotScreen;
  composer.addPass(dotScreenPass);

  // RGB Shift Pass
  rgbShiftPass = new THREE.ShaderPass(THREE.RGBShiftShader);
  rgbShiftPass.uniforms['amount'].value = 0.005;
  rgbShiftPass.enabled = params.enableRGBShift;
  composer.addPass(rgbShiftPass);

  // 8. GUI Setup is called after model load/fail
  setupGUI();

  // 9. Setup GSAP camera button controls
  setupCameraControls();

  // Add event listeners for responsiveness
  window.addEventListener('resize', onWindowResize);
}

// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (controls) {
    controls.update();
  }

  if (mixer) {
    // Update the model animation mixer if a model was loaded
    mixer.update(delta);
  } else if (model && isCubeFallback && params.enableCubeRotation) {
    // Manual rotation for the fallback cube
    model.rotation.x += 0.005;
    model.rotation.y += 0.01;
  }

  // Render the scene using the composer
  if (composer) {
    composer.render();
  } else {
    // Fallback rendering
    renderer.render(scene, camera);
  }
}

// --- Responsiveness Handling ---
function onWindowResize() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  if (composer) {
    composer.setSize(width, height);
  }
}

// --- Start the Scene ---
window.onload = function () {
  init();
  animate();
};
