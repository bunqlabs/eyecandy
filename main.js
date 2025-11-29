// Global variables for the scene elements
let scene, camera, renderer, model, controls, gui;
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
    position: new THREE.Vector3(0, 3, 15),
    target: new THREE.Vector3(0, 0, 0),
  },
  'camera-view-3': {
    position: new THREE.Vector3(15, 3, 0),
    target: new THREE.Vector3(0, 0, 0),
  },
};

// State object for the GUI controls
const params = {
  enableCubeRotation: false,
};

// --- GUI Setup Function ---
function setupGUI() {
  if (gui) gui.destroy();

  gui = new dat.GUI({ title: 'Debug', width: 250 });

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

  // Hide panel by default; toggle with Shift+D
  toggleGui(false);
  window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.code === 'KeyD') {
      toggleGui(gui.domElement.style.display === 'none');
    }
  });
}

function toggleGui(show) {
  if (!gui) return;
  gui.domElement.style.display = show ? 'block' : 'none';
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
  const modelPath = 'https://bunqlabs.github.io/eyecandy/assets/tensor.glb';

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
  adjustCameraFov();

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

  // 7. GUI Setup is called after model load/fail
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

  console.log('Camera fov = ', camera.fov);

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

  // Render the scene
  renderer.render(scene, camera);
}

// --- Responsiveness Handling ---
function onWindowResize() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  adjustCameraFov();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

// Tune FOV for smaller viewports to keep framing consistent
function adjustCameraFov() {
  if (window.innerWidth <= 1024) {
    camera.fov = 70;
  } else {
    camera.fov = 50;
  }
  camera.updateProjectionMatrix();
}

// --- Start the Scene ---
window.onload = function () {
  init();
  animate();
};
