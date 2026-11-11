import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  SphereGeometry,
  Mesh,
  MeshStandardMaterial,
  AmbientLight,
  DirectionalLight,
  Group,
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineLoop,
  Vector3,
} from "three";

export async function initGlobe(isPaused) {
  const canvas = document.querySelector("#globe-canvas");
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
  const scene = new Scene();
  const camera = new PerspectiveCamera(36, 1, 0.1, 20);
  camera.position.z = 3.8;
  const globe = new Group();
  globe.rotation.z = -0.16;
  scene.add(globe);
  globe.add(
    new Mesh(
      new SphereGeometry(1, 48, 32),
      new MeshStandardMaterial({ color: 0xded8cc, roughness: 1 }),
    ),
  );
  scene.add(new AmbientLight(0xffffff, 2));
  const light = new DirectionalLight(0xffffff, 3);
  light.position.set(-3, 4, 5);
  scene.add(light);
  const position = (lon, lat, radius = 1.008) => {
    const a = (lon * Math.PI) / 180,
      b = (lat * Math.PI) / 180;
    return new Vector3(
      radius * Math.cos(b) * Math.sin(a),
      radius * Math.sin(b),
      radius * Math.cos(b) * Math.cos(a),
    );
  };
  function line(points, color, opacity) {
    const geometry = new BufferGeometry().setAttribute(
      "position",
      new Float32BufferAttribute(
        points.flatMap((p) => [p.x, p.y, p.z]),
        3,
      ),
    );
    globe.add(
      new LineLoop(
        geometry,
        new LineBasicMaterial({ color, transparent: true, opacity }),
      ),
    );
  }
  for (let lat = -60; lat <= 60; lat += 30)
    line(
      Array.from({ length: 180 }, (_, i) => position(i * 2, lat)),
      0x6f665c,
      0.17,
    );
  for (let lon = 0; lon < 180; lon += 30)
    line(
      Array.from({ length: 180 }, (_, i) => {
        const a = (i * Math.PI) / 90;
        const b = (lon * Math.PI) / 180;
        return new Vector3(
          Math.cos(a) * Math.sin(b) * 1.006,
          Math.sin(a) * 1.006,
          Math.cos(a) * Math.cos(b) * 1.006,
        );
      }),
      0x6f665c,
      0.17,
    );
  try {
    const response = await fetch("/data/land.geojson");
    if (!response.ok) throw new Error("Map unavailable");
    const map = await response.json();
    for (const feature of map.features) {
      const polygons =
        feature.geometry.type === "Polygon"
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
      for (const polygon of polygons)
        for (const ring of polygon)
          line(
            ring.map(([lon, lat]) => position(lon, lat, 1.012)),
            0x202426,
            0.85,
          );
    }
  } catch {
    /* A graticule globe remains available offline. */
  }
  globe.rotation.y = -2;
  let visible = false,
    frame = 0,
    last = 0,
    disposed = false;
  function draw(now) {
    frame = 0;
    if (disposed || document.hidden || !visible) return;
    if (!isPaused() && last)
      globe.rotation.y += Math.min(now - last, 50) * 0.00009;
    last = now;
    renderer.render(scene, camera);
    if (!isPaused()) schedule();
  }
  function schedule() {
    if (!frame && visible && !document.hidden && !disposed)
      frame = requestAnimationFrame(draw);
  }
  const size = new ResizeObserver(() => {
    const width = host.clientWidth;
    renderer.setSize(width, width, false);
    schedule();
  });
  size.observe(host);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    last = 0;
    schedule();
  });
  observer.observe(host);
  document.addEventListener("vision:motion", schedule);
  document.addEventListener("visibilitychange", () => {
    last = 0;
    schedule();
  });
  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      size.disconnect();
      renderer.dispose();
    },
    { once: true },
  );
  host.dataset.ready = "true";
}
