import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import GUI from "lil-gui";
import gsap from "gsap";

// Expose to window
window.THREE = THREE;
window.OrbitControls = OrbitControls;
window.GLTFLoader = GLTFLoader;
window.EXRLoader = EXRLoader;
window.EffectComposer = EffectComposer;
window.RenderPass = RenderPass;
window.OutputPass = OutputPass;
window.GTAOPass = GTAOPass;
window.GUI = GUI;
window.gsap = gsap;
