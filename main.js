// Global variables for the scene elements
let scene, camera, renderer, model, controls, gui;
// Animation variables
let mixer;
let clock;
let isCubeFallback = false; // Flag to track if we are using the fallback cube

const container = document.getElementById("scene-container");

// Define camera views
const cameraViews = {
  "camera-view-1": {
    position: new THREE.Vector3(7, 7, 4),
    target: new THREE.Vector3(0, 3, 1),
  },
  "camera-view-2": {
    position: new THREE.Vector3(-12, -4, 6),
    target: new THREE.Vector3(0, 0, 0),
  },
  "camera-view-3": {
    position: new THREE.Vector3(15, 3, -6),
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

  gui = new dat.GUI({ title: "Debug", width: 250 });

  // Model Control Folder
  const modelFolder = gui.addFolder("Model");
  if (isCubeFallback) {
    modelFolder.add(params, "enableCubeRotation").name("Rotate Fallback Cube");
  } else {
    modelFolder
      .add({ spin: false }, "spin")
      .name("Model Spin (Animated)").domElement.style.pointerEvents = "none";
  }
  modelFolder.open();

  // Hide panel by default; toggle with Shift+D
  toggleGui(false);
  window.addEventListener("keydown", (e) => {
    if (e.shiftKey && e.code === "KeyD") {
      toggleGui(gui.domElement.style.display === "none");
    }
  });
}

function toggleGui(show) {
  if (!gui) return;
  gui.domElement.style.display = show ? "block" : "none";
}

// --- NEW: GSAP Camera Controls Setup ---
function setupCameraControls() {
  const buttons = [
    document.getElementById("camera-view-1"),
    document.getElementById("camera-view-2"),
    document.getElementById("camera-view-3"),
  ];

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
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
        ease: "power2.inOut",
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
        ease: "power2.inOut",
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
  const modelPath = "https://bunqlabs.github.io/eyecandy/assets/tensor.glb";
  // const modelPath = "/assets/tensor.glb";

  loader.load(
    modelPath,
    (gltf) => {
      // SUCCESS
      model = gltf.scene;

      // --- NEW: Log all materials in the model ---
      console.log("Traversing model to find materials...");
      const materials = new Set();
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          materials.add(child.material);
          child.castShadow = true; // Enable shadows for each mesh
          child.receiveShadow = true; // Enable receiving shadows
        }
      });
      console.log("Found materials:", Array.from(materials));
      // --- End of new code ---

      // --- NEW: Replace materials by name ---
      const newWhiteMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.6,
        side: THREE.DoubleSide,
        name: "White_Custom", // Optional: give it a new name
      });

      const newBlackMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.3,
        side: THREE.DoubleSide,
        name: "Black_Custom", // Optional: give it a new name
      });

      // For the 'Eye', we'll use a standard material with emissive properties to make it glow
      const newEyeMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff, // Make it glow white
        emissiveIntensity: 10, // Adjust glow intensity
        name: "Eye_Custom", // Optional: give it a new name
      });

      model.traverse((child) => {
        if (child.isMesh && child.material) {
          if (child.material.name === "White")
            child.material = newWhiteMaterial;
          if (child.material.name === "Black")
            child.material = newBlackMaterial;
          if (child.material.name === "Eye") child.material = newEyeMaterial;
        }
      });

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
        console.warn("Model loaded but contains no animations.");
      }

      // Update status message
      console.log("Model loaded successfully.");

      // Re-setup GUI to ensure controls are correct
      setupGUI();
    },
    undefined,
    (error) => {
      // ERROR
      console.error("An error occurred while loading the model:", error);

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
      console.log("Using fallback cube due to model loading error.");

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
  const initialView = cameraViews["camera-view-1"];
  camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
  camera.position.copy(initialView.position);
  camera.lookAt(initialView.target);
  adjustCameraFov();

  // 3. Renderer Setup
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // --- NEW: Tone Mapping for HDR environment lighting control ---
  // Use a cinematic tone mapping
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Decrease exposure to reduce the intensity of the environment light
  renderer.toneMappingExposure = 0.5;

  // Shadows
  renderer.shadowMap.enabled = true;

  container.appendChild(renderer.domElement);

  // 4. Load the Model
  loadModel();

  // 5. Lighting Setup (IBL and Directional)
  // --- NEW: Load HDR Environment Map for Image-Based Lighting ---
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  new THREE.EXRLoader().load(
    "https://bunqlabs.github.io/eyecandy/assets/environment.exr",
    (texture) => {
      // --- NEW: Rotate the environment map ---
      // We can rotate the texture before it's converted to an envmap.
      // A 90-degree rotation (in radians) will effectively tilt the environment.
      texture.rotation = Math.PI / 2;
      texture.center.set(0.5, 0.5); // Ensure rotation is around the center

      // The EXR file provides realistic ambient lighting and reflections.
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      scene.environment = envMap;

      // Clean up to free memory
      texture.dispose();
      pmremGenerator.dispose();
    }
  );

  // Directional light for casting shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
  directionalLight.position.set(-1, 5, 5);
  directionalLight.castShadow = true;

  // --- NEW: Shadow Quality Improvements to reduce moiré patterns ---
  // 1. Increase shadow map resolution for more detail
  directionalLight.shadow.mapSize.width = 1024; // default is 512
  directionalLight.shadow.mapSize.height = 1024; // default is 512

  // 2. Adjust the shadow camera frustum to be tighter around the model
  directionalLight.shadow.camera.left = -10;
  directionalLight.shadow.camera.right = 10;
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.bottom = -10;

  // 3. Add a small bias to prevent self-shadowing artifacts (shadow acne)
  directionalLight.shadow.bias = -0.0005;
  directionalLight.shadow.radius = 0;
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
  window.addEventListener("resize", onWindowResize);
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
