import { t } from "./i18n.js";
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [
  ...parent.querySelectorAll(selector),
];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let motionPaused = reducedMotion.matches;

function syncMotion() {
  document.documentElement.classList.toggle("motion-paused", motionPaused);
  document.dispatchEvent(new CustomEvent("vision:motion"));
}
syncMotion();
reducedMotion.addEventListener("change", (event) => {
  motionPaused = event.matches;
  syncMotion();
});

const model = $(".hero-model");
let anatomyControl = null;
import("./spine-model.js")
  .then(({ initSpineModel }) =>
    initSpineModel({
      host: model,
      stage: $(".spine-sculpture"),
      isPaused: () => motionPaused,
    }),
  )
  .then((control) => {
    anatomyControl = control;
  })
  .catch(() => {
    model.dataset.modelState = "fallback";
    $("#spine-canvas").hidden = true;
    $("#assemble").disabled = true;
  });
$("#assemble").addEventListener("click", () => {
  const assembled = $("#assemble").getAttribute("aria-pressed") !== "true";
  $("#assemble").setAttribute("aria-pressed", String(assembled));
  model.classList.toggle("disassembled", !assembled);
  model.dataset.assemblyMode = "manual";
  anatomyControl?.setAssembled(assembled);
  $("#assembly-label").textContent = assembled
    ? t("assembled")
    : t("disassembled");
  $("#assembly-description").textContent = assembled
    ? t("assembledDescription")
    : t("disassembledDescription");
});

// 문구와 코드를 같은 단계 데이터에서 바꿉니다. 코드는 설명용 예시입니다.
const stageCodes = {
  binding:
    'type UserPath struct {\n    ID int `path:"id"`\n}\n\nfunc (c *UserController) GetUser(\n    path input.Path[UserPath],\n) (httpx.Response[*User], error)',
  interceptor:
    "PreHandle(ctx spine.Ctx, meta core.HandlerMeta) error\nPostHandle(ctx spine.Ctx, meta core.HandlerMeta)\nBeforeResponse(ctx spine.Ctx, meta core.HandlerMeta,\n    executionErr error) error\nAfterCompletion(ctx spine.Ctx, meta core.HandlerMeta,\n    err error)",
  controller:
    "func (c *UserController) GetUser(\n    id input.Path[int],\n) (httpx.Response[*User], error) {\n    user, err := c.service.Find(*id)\n    return httpx.Response[*User]{Body: user}, err\n}",
  response:
    "return httpx.Response[*User]{\n    Body: user,\n    Options: httpx.ResponseOptions{\n        Status: http.StatusOK,\n    },\n}, nil",
};
let activeStage = "controller";
function renderStage() {
  $("#stage-title").textContent = t(activeStage + "Title");
  $("#stage-description").textContent = t(activeStage + "Description");
  $("#stage-code").textContent = stageCodes[activeStage];
}
renderStage();
function refreshAnimation(element) {
  element.classList.remove("changing");
  void element.offsetWidth;
  element.classList.add("changing");
}
$$("[data-stage]").forEach((button) =>
  button.addEventListener("click", () => {
    $$("[data-stage]").forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
    activeStage = button.dataset.stage;
    renderStage();
    refreshAnimation($(".flow-detail"));
  }),
);

// 인증, 업로드와 배포 요청을 보내지 않는 설명용 재생입니다.
let deployRunning = false;
let deployTimer;
const deployRows = $$("[data-deploy-step]");
let deployIndex = -1;
let deployComplete = false;
function renderDeployButton() {
  const button = $("#deploy-play");
  const label = document.createElement("span");
  label.className = "deploy-play-label";
  label.textContent = t(
    deployRunning
      ? "deployRunning"
      : deployComplete
        ? "deployReplay"
        : "deployPlay",
  );
  button.disabled = deployRunning;
  button.replaceChildren(label);
  if (deployRunning) return;
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  icon.classList.add("deploy-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  if (deployComplete) {
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    path.setAttribute("d", "M3 11a9 9 0 1 1 2.7 6.4 M3 4v7h7");
  } else {
    icon.setAttribute("fill", "currentColor");
    path.setAttribute("d", "M8 5l11 7-11 7z");
  }
  icon.append(path);
  button.append(icon);
}

function showDeployStep(index) {
  deployIndex = index;
  deployRows.forEach((row, i) => {
    row.classList.toggle("active", i === index);
    row.classList.toggle("done", i < index);
  });
  $("#deploy-status").textContent = t("deployMessage" + index);
  if (index < deployRows.length - 1) {
    deployTimer = window.setTimeout(
      () => showDeployStep(index + 1),
      motionPaused ? 350 : 1000,
    );
  } else {
    deployTimer = window.setTimeout(
      () => {
        deployRows.forEach((row) => {
          row.classList.remove("active");
          row.classList.add("done");
        });
        deployComplete = true;
        $("#deploy-status").textContent = t("deployDone");
        deployRunning = false;
        renderDeployButton();
      },
      motionPaused ? 350 : 1000,
    );
  }
}
$("#deploy-play").addEventListener("click", () => {
  if (deployRunning) return;
  deployRunning = true;
  deployComplete = false;
  renderDeployButton();
  showDeployStep(0);
});
window.addEventListener("pagehide", () => window.clearTimeout(deployTimer));

let activePerspective = "human";
function renderPerspective() {
  $("#perspective-title .heading-text").innerHTML = t(
    activePerspective + "Title",
  );
  $("#perspective-description").textContent = t(
    activePerspective + "Description",
  );
  $("#perspective-footnote").textContent = t(activePerspective + "Note");
  $("#art-start").textContent = t(
    activePerspective === "ai" ? "intent" : "idea",
  );
  $("#art-build").textContent = "Spine CLI";
  $("#art-end").textContent = "Spine Cloud";
  $("#path-first").textContent = t(
    activePerspective === "ai" ? "aiPathFirst" : "humanPathFirst",
  );
  $("#path-build").textContent = t(
    activePerspective === "ai" ? "aiPathBuild" : "humanPathBuild",
  );
  $("#path-publish").textContent = t(
    activePerspective === "ai" ? "aiPathPublish" : "humanPathPublish",
  );
  $("#art-caption").textContent = t(activePerspective + "Art");
}
renderPerspective();
$$("[data-perspective]").forEach((button) =>
  button.addEventListener("click", () => {
    $$("[data-perspective]").forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
    activePerspective = button.dataset.perspective;
    renderPerspective();
    $(".perspective-exhibit").classList.toggle(
      "ai",
      button.dataset.perspective === "ai",
    );
    refreshAnimation($(".perspective-copy"));
  }),
);

// 초기 HTML은 전부 표시합니다. 스크립트 없이도 이야기를 읽을 수 있습니다.
const revealTargets = $$(
  ".section-heading h2, .section-heading > div, .responsibility-map, .origin-closing, .flow-explorer, .framework-statement, .cloud-copy h2, .cloud-copy > p, .cloud-copy > a, .deploy-exhibit, .future-intro h2, .future-intro > p, .perspective-exhibit, .principles article, .closing-top h2, .closing-top > div",
);
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove("pending");
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  revealTargets.forEach((element, index) => {
    element.classList.add("reveal");
    element.style.transitionDelay = (index % 3) * 65 + "ms";
    if (
      !motionPaused &&
      element.getBoundingClientRect().top > window.innerHeight
    )
      element.classList.add("pending");
    observer.observe(element);
  });

  const navLinks = $$(".header nav a");
  const chapterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          if (link.hash === "#" + entry.target.id)
            link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      });
    },
    { rootMargin: "-15% 0px -55% 0px" },
  );
  $$("main > section[id]").forEach((section) =>
    chapterObserver.observe(section),
  );
}

import("./globe.js")
  .then(({ initGlobe }) => initGlobe(() => motionPaused))
  .catch(() => {});
document.addEventListener("vision:language", () => {
  syncMotion();
  renderStage();
  renderPerspective();
  const assembled = $("#assemble").getAttribute("aria-pressed") === "true";
  $("#assembly-label").textContent = t(
    assembled ? "assembled" : "disassembled",
  );
  $("#assembly-description").textContent = t(
    assembled ? "assembledDescription" : "disassembledDescription",
  );
  $("#model-status").textContent = t(
    model.dataset.modelState === "ready" ? "modelDrag" : "modelStatic",
  );
  renderDeployButton();
  $("#deploy-status").textContent = t(
    deployRunning
      ? "deployMessage" + deployIndex
      : deployComplete
        ? "deployDone"
        : "deployInitial",
  );
});
$("#assembly-label").textContent = t("assembled");
$("#assembly-description").textContent = t("assembledDescription");
$("#model-status").textContent = t("modelStatic");
renderDeployButton();
$("#deploy-status").textContent = t("deployInitial");

import("./sunrise.js")
  .then(({ initSunrise }) => initSunrise(() => motionPaused))
  .catch(() => {});

import("./floating-symbols.js")
  .then(({ initFloatingSymbols }) => initFloatingSymbols(() => motionPaused))
  .catch(() => {});
