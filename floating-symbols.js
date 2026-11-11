import {
  ACESFilmicToneMapping,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  Shape,
  SphereGeometry,
  CylinderGeometry,
  WebGLRenderer,
} from "three";

function createHeart() {
  const shape = new Shape();
  shape.moveTo(0, -0.95);
  shape.bezierCurveTo(-0.25, -0.7, -1, -0.05, -1, 0.55);
  shape.bezierCurveTo(-1, 1.25, -0.2, 1.35, 0, 0.82);
  shape.bezierCurveTo(0.2, 1.35, 1, 1.25, 1, 0.55);
  shape.bezierCurveTo(1, -0.05, 0.25, -0.7, 0, -0.95);
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.3,
    bevelEnabled: true,
    bevelSegments: 6,
    steps: 1,
    bevelSize: 0.13,
    bevelThickness: 0.13,
    curveSegments: 28,
  });
  geometry.center();
  return new Mesh(
    geometry,
    new MeshStandardMaterial({
      color: 0xc75035,
      roughness: 0.35,
      metalness: 0.02,
    }),
  );
}
function createBone() {
  const bone = new Group();
  const material = new MeshStandardMaterial({
    color: 0xf5f2e9,
    roughness: 0.48,
  });
  const shaft = new Mesh(new CylinderGeometry(0.21, 0.21, 1.45, 24), material);
  shaft.rotation.z = Math.PI / 2;
  bone.add(shaft);
  const end = new SphereGeometry(0.32, 24, 20);
  for (const x of [-0.8, 0.8])
    for (const y of [-0.18, 0.18]) {
      const tip = new Mesh(end, material);
      tip.position.set(x, y, 0);
      bone.add(tip);
    }
  return bone;
}

export function initFloatingSymbols(isPaused) {
  const symbols = [];
  let frame = 0,
    last = 0,
    time = 0,
    disposed = false;
  function schedule() {
    if (
      !frame &&
      !disposed &&
      !document.hidden &&
      symbols.some((item) => item.visible)
    )
      frame = requestAnimationFrame(draw);
  }
  function draw(now) {
    frame = 0;
    if (disposed || document.hidden) return;
    if (!isPaused() && last) time += Math.min(now - last, 50) / 1000;
    last = now;
    for (const item of symbols) {
      if (!item.visible) continue;
      item.object.position.y = Math.sin(time * 1.25) * 0.11;
      item.object.rotation.y = -0.3 + time * 0.4;
      item.object.rotation.z =
        item.kind === "bone" ? -0.45 + Math.sin(time * 0.8) * 0.045 : -0.1;
      item.renderer.render(item.scene, item.camera);
    }
    if (!isPaused()) schedule();
  }
  for (const host of document.querySelectorAll(".floating-symbol")) {
    const canvas = host.querySelector("canvas");
    let renderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      continue;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new Scene();
    const camera = new OrthographicCamera(-1.5, 1.5, 1.65, -1.65, 0.1, 20);
    camera.position.set(0, 0, 5);
    scene.add(new HemisphereLight(0xfff9ee, 0x4d3930, 2));
    const light = new DirectionalLight(0xffffff, 3);
    light.position.set(-3, 4, 5);
    scene.add(light);
    const kind = host.dataset.symbol;
    const object = kind === "heart" ? createHeart() : createBone();
    scene.add(object);
    const item = {
      kind,
      host,
      object,
      renderer,
      scene,
      camera,
      visible: false,
    };
    symbols.push(item);
    item.resize = new ResizeObserver(() => {
      const width = host.clientWidth,
        height = host.clientHeight;
      if (!width || !height) return;
      camera.left = (-1.65 * width) / height;
      camera.right = -camera.left;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      schedule();
    });
    item.resize.observe(host);
    item.observer = new IntersectionObserver(([entry]) => {
      item.visible = entry.isIntersecting;
      last = 0;
      schedule();
    });
    item.observer.observe(host);
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      item.visible = false;
      host.removeAttribute("data-ready");
    });
    host.dataset.ready = "true";
  }
  document.addEventListener("vision:motion", schedule);
  function visibility() {
    last = 0;
    schedule();
  }
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("vision:motion", schedule);
      document.removeEventListener("visibilitychange", visibility);
      const geometries = new Set(),
        materials = new Set();
      for (const item of symbols) {
        item.resize.disconnect();
        item.observer.disconnect();
        item.renderer.dispose();
        item.object.traverse((object) => {
          if (object.isMesh) {
            geometries.add(object.geometry);
            materials.add(object.material);
          }
        });
      }
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
    { once: true },
  );
}
