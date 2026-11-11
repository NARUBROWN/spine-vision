import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PropertyBinding,
  MathUtils,
  Plane,
  Raycaster,
  Vector2,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
  CircleGeometry,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

// CC0 clothed characters by Kay Lousberg. See the local license and manifest.
export async function initSunrise(isPaused) {
  const canvas = document.querySelector("#sunrise-canvas");
  const host = canvas.parentElement;
  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new Scene();
  // Let the section's shared background show through the scene and its text.
  renderer.setClearColor(0x000000, 0);
  const camera = new OrthographicCamera(-5.5, 5.5, 3.2, -3.2, 0.1, 50);
  camera.position.set(4, 4.2, 7);
  camera.lookAt(0, 1.4, 0);
  scene.add(new HemisphereLight(0xffefcf, 0x746b61, 2.3));
  scene.add(new AmbientLight(0xffe3be, 0.6));
  const sunlight = new DirectionalLight(0xffc882, 4);
  sunlight.position.set(0, 6, 0);
  scene.add(sunlight);
  const fill = new DirectionalLight(0xffffff, 1.4);
  fill.position.set(2, 3, 6);
  scene.add(fill);
  const sun = new Mesh(
    new SphereGeometry(0.46, 48, 32),
    new MeshBasicMaterial({ color: 0xe4b85b, toneMapped: false }),
  );
  const sunGroup = new Group();
  const sunHeight = 3.1;
  sunGroup.position.set(0, sunHeight, 0);
  sunGroup.add(sun);
  scene.add(sunGroup);
  // Translucent shells keep the soft halo inside the 3D scene.
  for (let i = 0; i < 5; i++) {
    const halo = new Mesh(
      new SphereGeometry(0.49 + i * 0.08, 32, 24),
      new MeshBasicMaterial({
        color: 0xe4b85b,
        transparent: true,
        opacity: 0.035,
        depthWrite: false,
      }),
    );
    halo.position.copy(sun.position);
    sunGroup.add(halo);
  }
  const gazeControllers = [];
  const people = new Group();
  scene.add(people);
  function aimBone(bone, child, direction) {
    if (!bone || !child) throw new Error("Character pose bones are missing");
    bone.updateWorldMatrix(true, true);
    const origin = bone.getWorldPosition(new Vector3());
    const current = child
      .getWorldPosition(new Vector3())
      .sub(origin)
      .normalize();
    const delta = new Quaternion().setFromUnitVectors(
      current,
      direction.clone().normalize(),
    );
    const parent = bone.parent.getWorldQuaternion(new Quaternion());
    const local = parent.clone().invert().multiply(delta).multiply(parent);
    bone.quaternion.premultiply(local);
    bone.updateWorldMatrix(true, true);
  }
  function colorFrontAdventurer(material, meshName, index) {
    const hair = new Color(index === 0 ? 0x423226 : 0xd8ab65);
    const clothes = new Color(index === 0 ? 0xc75035 : 0x365a73);
    const isHead = /Rogue_Head/.test(meshName);
    material.onBeforeCompile = (shader) => {
      shader.uniforms.adventurerHair = { value: hair };
      shader.uniforms.adventurerClothes = { value: clothes };
      shader.fragmentShader =
        "uniform vec3 adventurerHair;\nuniform vec3 adventurerClothes;\n" +
        shader.fragmentShader;
      // Recolor the atlas's hair and green cloth regions while preserving skin, eyes, and shading.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        #include <map_fragment>
        vec3 sourceColor = diffuseColor.rgb;
        if (sourceColor.g > sourceColor.r * 1.4 && sourceColor.g > sourceColor.b * 1.2) {
          diffuseColor.rgb = adventurerClothes * clamp(sourceColor.g / 0.25, 0.45, 1.25);
        }
        if (${isHead ? "true" : "false"} && sourceColor.r > sourceColor.g * 2.2 && sourceColor.g > sourceColor.b * 1.2 && sourceColor.r < 0.7) {
          diffuseColor.rgb = adventurerHair * clamp(sourceColor.r / 0.35, 0.5, 1.25);
        }
      `,
      );
    };
    material.customProgramCacheKey = () => `adventurer-tint-${isHead}`;
  }

  try {
    const loader = new GLTFLoader();
    const names = ["Rogue", "Mage", "Knight", "Rogue_Hooded"];
    const models = await Promise.all(
      names.map((name) => loader.loadAsync(`/models/kaykit/${name}.glb`)),
    );
    const variants = [0, 1, 2, 3, 0];
    const heights = [1.62, 1.75, 1.7, 1.52, 1.58];
    for (let i = 0; i < 5; i++) {
      const person = clone(models[variants[i]].scene);
      person.traverse((object) => {
        // Character files include optional hand props; keep only the dressed characters.
        if (
          /^handslot|^1H_|^2H_|Shield|Knife|Throwable|Spellbook/i.test(
            object.name,
          )
        )
          object.visible = false;
        if (!object.isMesh) return;
        object.material = object.material.clone();
        object.material.roughness = 1;
        object.material.metalness = 0;
        object.frustumCulled = false;
        if (i === 0 || i === 4)
          colorFrontAdventurer(object.material, object.name, i);
      });
      aimBone(
        person.getObjectByName(PropertyBinding.sanitizeNodeName("upperarm.l")),
        person.getObjectByName(PropertyBinding.sanitizeNodeName("lowerarm.l")),
        new Vector3(0.12, -1, 0.05),
      );
      aimBone(
        person.getObjectByName(PropertyBinding.sanitizeNodeName("upperarm.r")),
        person.getObjectByName(PropertyBinding.sanitizeNodeName("lowerarm.r")),
        new Vector3(-0.12, -1, 0.05),
      );
      // Rotate in world space so the head and attached hat visibly tilt upward.
      const head = person.getObjectByName("head");
      const neutralHead = head?.quaternion.clone();
      if (head) {
        head.updateWorldMatrix(true, false);
        const parent = head.parent.getWorldQuaternion(new Quaternion());
        const raised = new Quaternion().setFromAxisAngle(
          new Vector3(1, 0, 0),
          -0.55,
        );
        head.quaternion.premultiply(
          parent.clone().invert().multiply(raised).multiply(parent),
        );
      }
      const box = new Box3();
      person.updateWorldMatrix(true, true);
      person.traverseVisible((object) => {
        if (object.isMesh) box.union(new Box3().setFromObject(object));
      });
      const scale = heights[i] / box.getSize(new Vector3()).y;
      const center = box.getCenter(new Vector3());
      const pivot = new Group();
      person.position.set(-center.x, -box.min.y, -center.z);
      pivot.add(person);
      pivot.scale.setScalar(scale);
      // Leave the camera-facing side open; the arc is aligned to the camera's ground plane.
      const angle = ((-100 + i * 50) * Math.PI) / 180;
      const radius = 1.55;
      const towardCamera = new Vector3(4, 0, 7).normalize();
      const screenRight = new Vector3(towardCamera.z, 0, -towardCamera.x);
      pivot.position
        .copy(screenRight.multiplyScalar(Math.sin(angle) * radius))
        .addScaledVector(towardCamera, -Math.cos(angle) * radius);
      pivot.rotation.y = Math.atan2(-pivot.position.x, -pivot.position.z);
      people.add(pivot);
      if (head)
        gazeControllers.push({
          head,
          pivot,
          neutral: neutralHead,
          sun: head.quaternion.clone(),
        });
      const shadow = new Mesh(
        new CircleGeometry(0.38, 32),
        new MeshBasicMaterial({
          color: 0x6f665c,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.set(1, 1.6, 1);
      shadow.position.set(pivot.position.x, 0.002, pivot.position.z + 0.25);
      scene.add(shadow);
    }
  } catch {
    renderer.dispose();
    return;
  }
  const pointer = new Vector2();
  let pointerInside = false;
  const raycaster = new Raycaster();
  const viewNormal = camera.getWorldDirection(new Vector3());
  const gazePlane = new Plane().setFromNormalAndCoplanarPoint(
    viewNormal,
    new Vector3(0, 1.4, 0).addScaledVector(viewNormal, -2),
  );
  const pointerTarget = new Vector3();
  const headPosition = new Vector3();
  const direction = new Vector3();
  const right = new Vector3();
  const localDirection = new Vector3();
  const inverseBody = new Quaternion();
  const parentRotation = new Quaternion();
  const yawRotation = new Quaternion();
  const pitchRotation = new Quaternion();
  const targetRotation = new Quaternion();
  const worldUp = new Vector3(0, 1, 0);
  const interactionArea = host.closest(".closing");

  function updateGaze(dt) {
    let followPointer = pointerInside && !isPaused();
    if (followPointer) {
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      followPointer =
        raycaster.ray.intersectPlane(gazePlane, pointerTarget) !== null;
    }
    for (const controller of gazeControllers) {
      const { head, pivot, neutral, sun: sunPose } = controller;
      targetRotation.copy(sunPose);
      if (followPointer) {
        head.getWorldPosition(headPosition);
        direction.copy(pointerTarget).sub(headPosition);
        inverseBody.copy(pivot.quaternion).invert();
        localDirection.copy(direction).applyQuaternion(inverseBody);
        const horizontal = Math.hypot(localDirection.x, localDirection.z);
        const yaw = Math.atan2(localDirection.x, localDirection.z);
        const pitch = Math.atan2(localDirection.y, horizontal);
        // Return to the sun beyond the neck limit; a small entry margin avoids edge jitter.
        const yawLimit = controller.tracking ? 0.65 : 0.58;
        const lowerPitch = controller.tracking ? -0.2 : -0.15;
        const upperPitch = controller.tracking ? 0.65 : 0.6;
        controller.tracking =
          horizontal > 0.001 &&
          Math.abs(yaw) <= yawLimit &&
          pitch >= lowerPitch &&
          pitch <= upperPitch;
        if (controller.tracking) {
          head.parent.getWorldQuaternion(parentRotation);
          right.set(1, 0, 0).applyQuaternion(pivot.quaternion);
          yawRotation.setFromAxisAngle(worldUp, yaw);
          pitchRotation.setFromAxisAngle(right, -pitch);
          targetRotation
            .copy(parentRotation)
            .invert()
            .multiply(yawRotation)
            .multiply(pitchRotation)
            .multiply(parentRotation)
            .multiply(neutral);
        }
      }
      if (!followPointer) controller.tracking = false;
      head.quaternion.slerp(
        targetRotation,
        isPaused() ? 1 : 1 - Math.exp(-10 * dt),
      );
    }
  }
  function pointerMove(event) {
    if (event.pointerType === "touch" || isPaused()) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.set(
      MathUtils.clamp(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -1.25,
        1.25,
      ),
      MathUtils.clamp(
        1 - ((event.clientY - rect.top) / rect.height) * 2,
        -1.25,
        1.25,
      ),
    );
    pointerInside = true;
    schedule();
  }
  function pointerLeave() {
    pointerInside = false;
    schedule();
  }
  interactionArea.addEventListener("pointermove", pointerMove, {
    passive: true,
  });
  interactionArea.addEventListener("pointerleave", pointerLeave);
  interactionArea.addEventListener("pointercancel", pointerLeave);

  let visible = false,
    frame = 0,
    last = 0,
    time = 0,
    disposed = false;
  function draw(now) {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    if (!isPaused()) time += dt;
    last = now;
    updateGaze(dt);
    sunGroup.position.y = sunHeight + Math.sin(time * 0.85) * 0.1;
    sunGroup.position.x = Math.sin(time * 0.45) * 0.025;
    sun.scale.setScalar(1 + Math.sin(time * 0.65) * 0.012);
    renderer.render(scene, camera);
    if (!isPaused()) schedule();
  }
  function schedule() {
    if (!frame && !disposed && visible && !document.hidden)
      frame = requestAnimationFrame(draw);
  }
  const resize = new ResizeObserver(() => {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    const headroom = parseFloat(getComputedStyle(host).getPropertyValue("--sunrise-headroom")) || 0;
    const sceneHeight = height - headroom;
    const halfWidth = Math.max(2.9, (2.05 * width) / sceneHeight);
    const halfHeight = (halfWidth * sceneHeight) / width;
    // Put the entire composition at one third of the canvas width.
    const frameCenter = halfWidth / 3;
    camera.left = -halfWidth + frameCenter;
    camera.right = halfWidth + frameCenter;
    // Extend only the top of the frame, preserving the original model scale.
    camera.top = halfHeight + (2 * halfHeight * headroom) / sceneHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    schedule();
  });
  resize.observe(host);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) pointerInside = false;
    last = 0;
    schedule();
  });
  observer.observe(host);
  document.addEventListener("vision:motion", schedule);
  document.addEventListener("visibilitychange", () => {
    last = 0;
    schedule();
  });
  canvas.addEventListener("webglcontextlost", () => {
    host.removeAttribute("data-ready");
    disposed = true;
    cancelAnimationFrame(frame);
  });
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      interactionArea.removeEventListener("pointermove", pointerMove);
      interactionArea.removeEventListener("pointerleave", pointerLeave);
      interactionArea.removeEventListener("pointercancel", pointerLeave);
      renderer.dispose();
    },
    { once: true },
  );
  host.dataset.ready = "true";
}
