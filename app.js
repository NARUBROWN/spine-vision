const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [
  ...parent.querySelectorAll(selector),
];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let motionPaused = reducedMotion.matches;

function syncMotion() {
  document.documentElement.classList.toggle("motion-paused", motionPaused);
  $(".motion-toggle").setAttribute("aria-pressed", String(motionPaused));
  $(".motion-toggle").setAttribute(
    "aria-label",
    motionPaused ? "움직임 재생하기" : "움직임 멈추기",
  );
  $(".motion-label").textContent = motionPaused
    ? "움직임 재생하기"
    : "움직임 멈추기";
  $(".pause-icon").textContent = motionPaused ? "▷" : "Ⅱ";
  document.dispatchEvent(new CustomEvent("vision:motion"));
}
syncMotion();
$(".motion-toggle").addEventListener("click", () => {
  motionPaused = !motionPaused;
  syncMotion();
});
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
    ? "연결된 가능성"
    : "흩어진 가능성";
  $("#assembly-description").textContent = assembled
    ? "익숙한 구조 위에, 더 넓은 가능성을 쌓습니다."
    : "연결하면, 새로운 가능성이 보입니다.";
});

// 문구와 코드를 같은 단계 데이터에서 바꿉니다. 코드는 설명용 예시입니다.
const stages = {
  binding: {
    title: "입력에도 의미가 있도록",
    description:
      "경로와 쿼리처럼 요청의 서로 다른 입력을 의미 있는 타입으로 표현합니다. 메서드 시그니처에서 입력의 출처를 읽을 수 있습니다.",
    code: "id path.Int\n\n// 경로의 값을 정수로 해석합니다.\n// 메서드의 입력 타입에 의미가 남습니다.",
  },
  interceptor: {
    title: "공통 처리에도 자리가 있도록",
    description:
      "인증, 로깅과 트랜잭션처럼 반복되는 관심사를 인터셉터로 분리합니다. 요청 전후의 실행 시점을 명시합니다.",
    code: "// 인터셉터의 실행 시점\nPreHandle       → 컨트롤러 실행 전\nBeforeResponse  → 응답 작성 전\nAfterCompletion → 요청 처리 완료 후",
  },
  controller: {
    title: "업무의 의도가 남는 곳",
    description:
      "컨트롤러는 요청을 받고, 서비스에 업무를 맡깁니다. 메서드의 입력과 반환 타입에서 API의 형태를 읽습니다.",
    code: "func (c *UserController) GetUser(\n    id path.Int,\n) (*User, error) {\n    return c.service.Find(int(id))\n}",
  },
  response: {
    title: "결과가 닿는 곳까지",
    description:
      "컨트롤러가 반환한 결과와 오류는 응답 처리로 이어집니다. 반환 타입과 오류에서 API가 전달할 결과를 이해합니다.",
    code: "// 메서드의 반환 타입\n(*User, error)\n\n// 성공 결과와 실패를 표현하고\n// HTTP 응답 처리로 이어갑니다.",
  },
};
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
    const stage = stages[button.dataset.stage];
    $("#stage-title").textContent = stage.title;
    $("#stage-description").textContent = stage.description;
    $("#stage-code").textContent = stage.code;
    refreshAnimation($(".flow-detail"));
  }),
);

// 인증, 업로드와 배포 요청을 보내지 않는 설명용 재생입니다.
let deployRunning = false;
let deployTimer;
const deployRows = $$("[data-deploy-step]");
const deploymentMessages = [
  "브라우저에서 일회용 코드를 승인합니다.",
  "프로젝트의 배포를 접수합니다.",
  "서버의 실행 환경에서 앱을 실행합니다.",
  "웹에서 앱 상태와 공개 주소를 확인합니다.",
];
function showDeployStep(index) {
  deployRows.forEach((row, i) => {
    row.classList.toggle("active", i === index);
    row.classList.toggle("done", i < index);
  });
  $("#deploy-status").textContent = deploymentMessages[index];
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
        $("#deploy-status").textContent =
          "설명용 흐름이 끝났습니다. 실제 배포는 실행하지 않았습니다.";
        $("#deploy-play").disabled = false;
        $("#deploy-play").replaceChildren(
          document.createTextNode("다시 살펴보기 "),
        );
        const arrow = document.createElement("span");
        arrow.textContent = "↗";
        arrow.setAttribute("aria-hidden", "true");
        $("#deploy-play").append(arrow);
        deployRunning = false;
      },
      motionPaused ? 350 : 1000,
    );
  }
}
$("#deploy-play").addEventListener("click", () => {
  if (deployRunning) return;
  deployRunning = true;
  $("#deploy-play").disabled = true;
  $("#deploy-play").textContent = "배포 흐름 살펴보는 중";
  showDeployStep(0);
});
window.addEventListener("pagehide", () => window.clearTimeout(deployTimer));

const perspectives = {
  human: {
    title: ["시작하는 마음에,", "기술이 답할 수 있도록."],
    description:
      "학생도, 코딩을 처음 배우는 사람도. CLI로 프로젝트의 첫 구조를 만들고, 흐름을 읽으며 자신의 아이디어를 발전시킬 수 있도록.",
    note: "Spine CLI에서 Spine Cloud까지, 우리가 지향하는 경험",
  },
  ai: {
    title: ["AI와 함께 만들어도,", "구조는 튼튼하도록."],
    description:
      "사람과 AI가 같은 실행 구조를 이해하고, CLI로 계약을 확인하며 코드를 발전시키는 경험을 지향합니다. 테스트와 실행 검증을 함께 이어갑니다.",
    note: "자동 생성에서 멈추지 않고, 이해와 검증으로",
  },
};
$$("[data-perspective]").forEach((button) =>
  button.addEventListener("click", () => {
    $$("[data-perspective]").forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
    const perspective = perspectives[button.dataset.perspective];
    $("#perspective-title").replaceChildren(
      document.createTextNode(perspective.title[0]),
      document.createElement("br"),
      document.createTextNode(perspective.title[1]),
    );
    $("#perspective-description").textContent = perspective.description;
    $("#perspective-footnote").textContent = perspective.note;
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
