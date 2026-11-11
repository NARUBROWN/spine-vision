import { t } from "./i18n.js";
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Group,
  HemisphereLight,
  MathUtils,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const BASE_YAW = -1.03;
const BASE_ROLL = 0;

// 렌더링이 불가능한 환경에서는 같은 원본 모델로 만든 정적 그림을 유지합니다.
export async function initSpineModel({ host, stage, isPaused }) {
  const canvas = stage.querySelector("canvas");
  const resetButton = host.querySelector("#model-reset");
  const status = host.querySelector("#model-status");
  const assemblyButton = host.querySelector("#assemble");
  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    host.dataset.modelState = "fallback";
    status.textContent = t("modelStatic");
    canvas.hidden = true;
    resetButton.hidden = true;
    assemblyButton.disabled = true;
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 20);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
  scene.add(new HemisphereLight(0xffffff, 0x494039, 1.7));
  const key = new DirectionalLight(0xfff8ec, 3.0);
  key.position.set(-3.2, 4, 5);
  scene.add(key);
  const fill = new DirectionalLight(0xf1dfcc, 1.2);
  fill.position.set(4, 1, -2);
  scene.add(fill);
  const sculpture = new Group();
  sculpture.rotation.order = "ZYX";
  sculpture.rotation.z = BASE_ROLL;
  scene.add(sculpture);

  const boneMaterial = new MeshStandardMaterial({
    color: 0xf5f2e9,
    roughness: 0.84,
    metalness: 0,
  });
  const discMaterial = new MeshStandardMaterial({
    color: 0xc75035,
    roughness: 0.88,
    metalness: 0,
  });

  let parts = [];
  let visible = true;
  let dragging = false;
  let pointer = null;
  let frameId = 0;
  let lastFrame = 0;
  let age = 0;
  let yaw = BASE_YAW;
  let targetYaw = BASE_YAW;
  let tilt = 0;
  let targetTilt = 0;
  let spread = 0;
  let targetSpread = 0;
  let manualAssembly = true;
  let disposed = false;
  let aspect = 1;

  function updateFrustum() {
    const halfHeight = 0.57 * (1 + spread * 0.23);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }

  function scrollSpread() {
    return manualAssembly ? 0 : 1;
  }

  function draw(now) {
    frameId = 0;
    if (disposed || document.hidden || !visible) return;
    const dt = Math.min((now - (lastFrame || now)) / 1000, 0.05);
    lastFrame = now;
    const paused = isPaused();
    targetSpread = scrollSpread();
    if (paused) {
      spread = targetSpread;
      yaw = targetYaw;
      tilt = targetTilt;
    } else {
      spread = MathUtils.damp(spread, targetSpread, 5.5, dt);
      yaw = MathUtils.damp(yaw, targetYaw, 12, dt);
      tilt = MathUtils.damp(tilt, targetTilt, 12, dt);
      age += dt;
    }
    const drift = paused || dragging ? 0 : Math.sin(age * 0.32) * 0.045;
    sculpture.rotation.y = yaw + drift;
    sculpture.rotation.x = tilt;
    sculpture.rotation.z = BASE_ROLL;

    updateFrustum();
    parts.forEach(({ mesh, origin, offset, twist }) => {
      mesh.position.copy(origin).addScaledVector(offset, spread);
      mesh.rotation.set(twist.x * spread, twist.y * spread, twist.z * spread);
    });
    renderer.render(scene, camera);
    if (!paused) schedule();
  }

  function schedule() {
    if (!frameId && !disposed && visible && !document.hidden) {
      frameId = requestAnimationFrame(draw);
    }
  }

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    aspect = width / height;
    updateFrustum();
    renderer.setSize(width, height, false);
    schedule();
  }

  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(stage);
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        lastFrame = 0;
        schedule();
      } else if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    },
    { rootMargin: "80px" },
  );
  visibilityObserver.observe(host);

  function onVisibility() {
    if (document.hidden) {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    } else {
      lastFrame = 0;
      schedule();
    }
  }
  document.addEventListener("visibilitychange", onVisibility);
  const onMotion = () => schedule();
  document.addEventListener("vision:motion", onMotion);
  const onScroll = () => schedule();
  window.addEventListener("scroll", onScroll, { passive: true });

  function pointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      yaw: targetYaw,
      tilt: targetTilt,
    };
    dragging = false;
    if (event.pointerType === "mouse")
      canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!dragging) {
      if (Math.abs(dx) < 6) return;
      // 세로 터치는 본문 스크롤에 맡깁니다.
      if (event.pointerType === "touch" && Math.abs(dy) > Math.abs(dx)) return;
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      host.classList.add("model-dragging");
    }
    targetYaw = pointer.yaw + dx * 0.009;
    targetTilt = MathUtils.clamp(pointer.tilt + dy * 0.0025, -0.28, 0.28);
    schedule();
  }
  function pointerEnd() {
    pointer = null;
    dragging = false;
    host.classList.remove("model-dragging");
  }
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerEnd);
  canvas.addEventListener("pointercancel", pointerEnd);
  canvas.addEventListener("lostpointercapture", pointerEnd);
  canvas.addEventListener("keydown", (event) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(
        event.key,
      )
    )
      return;
    event.preventDefault();
    if (event.key === "ArrowLeft") targetYaw -= 0.18;
    if (event.key === "ArrowRight") targetYaw += 0.18;
    if (event.key === "ArrowUp")
      targetTilt = MathUtils.clamp(targetTilt - 0.08, -0.28, 0.28);
    if (event.key === "ArrowDown")
      targetTilt = MathUtils.clamp(targetTilt + 0.08, -0.28, 0.28);
    if (event.key === "Home") {
      targetYaw = BASE_YAW;
      targetTilt = 0;
    }
    schedule();
  });

  function reset() {
    targetYaw = BASE_YAW;
    targetTilt = 0;
    manualAssembly = true;
    assemblyButton.setAttribute("aria-pressed", "true");
    host.classList.remove("disassembled");
    host.querySelector("#assembly-label").textContent = t("assembled");
    host.querySelector("#assembly-description").textContent = t(
      "assembledDescription",
    );
    schedule();
  }
  resetButton.addEventListener("click", reset);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    host.dataset.modelState = "fallback";
    status.textContent = t("modelStatic");
    resetButton.hidden = true;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    visible = false;
    canvas.hidden = true;
    assemblyButton.disabled = true;
  });

  try {
    const gltf = await new GLTFLoader().loadAsync(
      "/models/bodyparts3d/spine.glb",
    );
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.material.dispose();
      object.material =
        object.userData.kind === "disc" ? discMaterial : boneMaterial;
      const order = object.userData.order;
      parts.push({
        mesh: object,
        origin: object.position.clone(),
        offset: new Vector3(
          Math.sin(order * 1.23) * 0.19,
          object.position.y * 0.36,
          Math.cos(order * 0.88) * 0.15,
        ),
        twist: new Vector3(
          0,
          Math.sin(order * 1.3) * 0.2,
          Math.cos(order * 0.85) * 0.12,
        ),
      });
    });
    if (parts.length !== 48)
      throw new Error("척추 모델의 부위 구성이 다릅니다.");
    sculpture.add(gltf.scene);
    manualAssembly =
      host.dataset.assemblyMode === "manual"
        ? assemblyButton.getAttribute("aria-pressed") === "true"
        : true;
    spread = scrollSpread();
    yaw = targetYaw;
    resize();
    renderer.render(scene, camera);
    host.dataset.modelState = "ready";
    status.textContent = t("modelDrag");
    resetButton.hidden = false;
    schedule();
  } catch {
    host.dataset.modelState = "fallback";
    status.textContent = t("modelStatic");
    canvas.hidden = true;
    resetButton.hidden = true;
    sizeObserver.disconnect();
    visibilityObserver.disconnect();
    renderer.dispose();
    assemblyButton.disabled = true;
    disposed = true;
  }

  return {
    setAssembled(assembled) {
      manualAssembly = assembled;
      schedule();
    },
  };
}
