import ko from "./locales/ko.json";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import hans from "./locales/zh-Hans.json";
import hant from "./locales/zh-Hant.json";

export const catalogs = { ko, en, ja, "zh-Hans": hans, "zh-Hant": hant };
const languageTags = {
  ko: "ko",
  en: "en",
  ja: "ja",
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
};
const ogLocales = {
  ko: "ko_KR",
  en: "en_US",
  ja: "ja_JP",
  "zh-Hans": "zh_CN",
  "zh-Hant": "zh_TW",
};
export let locale = "ko";
export const t = (key) => catalogs[locale][key] ?? ko[key] ?? key;

// Mark elements once. Translation keys remain on the DOM across language changes.
const bindings = {
  ".skip": "skip",
  ".header nav a:first-child": "originNav",
  ".header nav a:last-child": "futureNav",
  "#hero-title": "heroTitle",
  ".hero-description": "heroDescription",
  ".hero-copy > .button": "ourStory",
  ".hero-foot p": "heroFoot",
  ".model-caption span:first-child": "familiar",
  ".model-caption span:last-child": "possibilities",
  "#model-reset": "reset",
  "#why-title": "whyTitle",
  ".origin-heading > div p:first-child": "originFirst",
  ".origin-heading > div p:last-child": "originSecond",
  ".idea-node": "learned",
  ".service-node": "newPossibilities",
  ".origin-closing": "originClosing",
  "#spine-title .heading-text": "spineTitle",
  ".framework .section-heading > div p:first-child": "frameworkFirst",
  ".framework .section-heading > div p:nth-child(2)": "frameworkSecond",
  ".framework .section-heading .text-link": "docsLink",
  ".exhibit-header span:first-child": "flowTitle",
  ".exhibit-header span:last-child": "chooseStage",
  '[data-stage="binding"]': "binding",
  '[data-stage="interceptor"]': "interceptor",
  '[data-stage="controller"]': "controller",
  '[data-stage="response"]': "response",
  ".framework-statement > p": "frameworkStatement",
  ".framework-statement > div p": "performanceDescription",
  ".framework-statement .text-link": "benchmarksLink",
  "#cloud-title": "cloudTitle",
  ".cloud-copy > p:nth-of-type(1)": "cloudFirst",
  ".cloud-copy > p:nth-of-type(2)": "cloudSecond",
  ".cloud-copy > .text-link": "cloudLink",
  ".beta-note": "beta",
  ".deploy-header > span:first-child": "deployTitle",
  ".demo-label": "demo",
  ".terminal-comment:first-child": "terminalLogin",
  ".terminal-comment:last-child": "terminalDeploy",
  "#future-title": "futureTitle",
  ".future-intro > p": "futureDescription",
  '[data-perspective="human"]': "human",
  '[data-perspective="ai"]': "ai",
  "#closing-title": "closingTitle",
  ".closing-top p": "closingDescription",
  ".closing-top .button": "startLink",
  ".footer-links a:nth-child(2)": "footerDocs",
  ".footer-links a:last-child": "top",
};
for (const [selector, key] of Object.entries(bindings))
  document.querySelector(selector)?.setAttribute("data-i18n", key);
["familiarUse", "responsibility", "readable", "lightStart"].forEach((key, i) =>
  document
    .querySelectorAll(".responsibility-names span")
    [i]?.setAttribute("data-i18n", key),
);
for (let i = 0; i < 4; i++) {
  document
    .querySelector(`.principles article:nth-child(${i + 1}) h3`)
    ?.setAttribute("data-i18n", `principle${i}`);
  document
    .querySelector(`.principles article:nth-child(${i + 1}) p`)
    ?.setAttribute("data-i18n", `principle${i}Description`);
  document
    .querySelector(`[data-deploy-step="${i}"] span:first-child`)
    ?.setAttribute("data-i18n", `deploy${i}`);
  document
    .querySelector(`[data-deploy-step="${i}"] span:last-child`)
    ?.setAttribute("data-i18n", `deploy${i}Detail`);
}
const attributes = {
  ".brand": "home",
  ".header nav": "navigation",
  "#language": "language",
  ".hero-model": "modelLabel",
  "#spine-canvas": "modelCanvas",
  ".responsibility-map": "mapLabel",
  ".flow-stages": "stageGroup",
  ".deploy-exhibit": "deployLabel",
  ".perspective-control": "perspectiveGroup",
  ".footer-links": "related",
};
function normalize(value) {
  if (catalogs[value]) return value;
  if (/^zh/i.test(value))
    return /hant|tw|hk|mo/i.test(value) ? "zh-Hant" : "zh-Hans";
  return value?.split("-")[0];
}
export function setLocale(next, { persist = true } = {}) {
  locale = catalogs[next] ? next : "ko";
  document.documentElement.lang = languageTags[locale];
  document.title = document.querySelector(".license-page")
    ? `Spine Vision — ${t("licensesLink")}`
    : t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18n);
  });
  document
    .querySelectorAll("[data-i18n-aria]")
    .forEach((el) => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  for (const [selector, key] of Object.entries(attributes))
    document.querySelector(selector)?.setAttribute("aria-label", t(key));
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", t("metaDescription"));
  for (const property of [
    "og:title",
    "og:description",
    "og:image:alt",
    "og:locale",
  ]) {
    document
      .querySelector(`meta[property="${property}"]`)
      ?.setAttribute(
        "content",
        property === "og:locale"
          ? ogLocales[locale]
          : t(property === "og:description" ? "metaDescription" : "pageTitle"),
      );
  }
  document
    .querySelectorAll('a[href^="https://spine.na2ru2.me/"]')
    .forEach((link) => {
      const url = new URL(link.href);
      url.pathname = url.pathname.replace(
        /^\/(ko|en|ja|zh-Hans|zh-Hant)(?=\/|$)/,
        `/${locale}`,
      );
      link.href = url.href;
    });
  document
    .querySelectorAll('a[href^="/licenses"], a[data-home]')
    .forEach((link) => {
      const url = new URL(link.href);
      url.searchParams.set("lang", locale);
      link.href = url.pathname + url.search + url.hash;
    });
  const select = document.querySelector("#language");
  if (select) select.value = locale;
  if (persist) {
    try {
      localStorage.setItem("vision-language", locale);
    } catch {
      /* Storage may be disabled. */
    }
    const url = new URL(location.href);
    url.searchParams.set("lang", locale);
    history.replaceState(null, "", url);
  }
  document.dispatchEvent(new CustomEvent("vision:language"));
}
let stored;
try {
  stored = localStorage.getItem("vision-language");
} catch {
  /* Use URL or browser language. */
}
const requested = new URL(location.href).searchParams.get("lang");
const initial =
  [requested, stored, ...navigator.languages.map(normalize)].find(
    (lang) => catalogs[lang],
  ) ?? "ko";
setLocale(initial, { persist: false });
document
  .querySelector("#language")
  ?.addEventListener("change", (event) => setLocale(event.target.value));
