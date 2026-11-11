import { readFile, writeFile, unlink } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

// 원본 메시에서 생성한 벡터 그림을 작은 정적 대체 이미지로 내보냅니다.
const input = new URL(
  "../qa/bodyparts-source/spine-poster.svg",
  import.meta.url,
);
const output = new URL(
  "../public/models/bodyparts3d/spine-poster.png",
  import.meta.url,
);
const svg = await readFile(input);
const renderer = new Resvg(svg, { fitTo: { mode: "width", value: 600 } });
const image = renderer.render();
await writeFile(output, image.asPng());
console.log("Static spine poster:", image.width, "x", image.height);
await unlink(
  new URL("../public/models/bodyparts3d/spine-poster.svg", import.meta.url),
).catch((error) => {
  if (error.code !== "ENOENT") throw error;
});
