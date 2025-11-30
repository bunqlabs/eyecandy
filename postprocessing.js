import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

export function setupPostProcessing(scene, camera, renderer) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  // FIX: Use EffectComposer directly, not THREE.EffectComposer
  const composer = new EffectComposer(renderer);

  // FIX: Use RenderPass directly
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const passes = {};

  // FIX: Use GTAOPass directly
  passes.gtao = new GTAOPass(scene, camera, size.x, size.y);
  passes.gtao.output = GTAOPass.OUTPUT.Default; // FIX: Access static property on the class directly
  composer.addPass(passes.gtao);

  // FIX: Use OutputPass directly
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  function resize(width, height) {
    composer.setSize(width, height);
    if (passes.gtao) passes.gtao.setSize(width, height);
  }

  return {
    render: () => composer.render(),
    resize,
    composer,
    passes,
  };
}
