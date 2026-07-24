(function () {
  "use strict";

  var root = document.getElementById("tistory100Story");
  if (!root || root.__timeStoryLoaderStarted) return;
  root.__timeStoryLoaderStarted = true;

  var runtimeUrl = root.getAttribute("data-runtime-url") ||
    "https://healingmart.github.io/tistory100-story-assets/common/data/runtime.json";
  var fallbackCss = root.getAttribute("data-runtime-css") ||
    "https://healingmart.github.io/tistory100-story-assets/common/css/timestory.css";
  var fallbackEngine = root.getAttribute("data-runtime-engine") ||
    "https://healingmart.github.io/tistory100-story-assets/common/js/timestory-engine.js";

  function withVersion(url, version) {
    if (!url) return "";
    var joiner = url.indexOf("?") === -1 ? "?" : "&";
    return url + joiner + "v=" + encodeURIComponent(version || "1");
  }

  function showError(message) {
    root.classList.add("ts100-runtime-failed");
    root.innerHTML = "";
    var box = document.createElement("div");
    box.className = "ts100-runtime-error";
    var title = document.createElement("strong");
    title.textContent = "TimeStory를 불러오지 못했습니다.";
    var desc = document.createElement("p");
    desc.textContent = message || "네트워크 연결을 확인한 뒤 다시 시도해주세요.";
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = "다시 불러오기";
    button.addEventListener("click", function () { window.location.reload(); });
    box.appendChild(title);
    box.appendChild(desc);
    box.appendChild(button);
    root.appendChild(box);
  }

  function setRuntimeAttributes(runtime) {
    var endpoints = runtime.endpoints || {};
    var meditation = runtime.meditation || {};
    if (endpoints.storiesIndex) root.setAttribute("data-series-index-url", endpoints.storiesIndex);
    if (endpoints.storyLibrary) root.setAttribute("data-library-index-url", endpoints.storyLibrary);
    if (endpoints.thumbnailsIndex) root.setAttribute("data-thumbnail-index-url", endpoints.thumbnailsIndex);
    if (meditation.baseUrl) root.setAttribute("data-meditation-base", meditation.baseUrl);
    if (meditation.count) root.setAttribute("data-meditation-count", String(meditation.count));
    if (meditation.volume != null) root.setAttribute("data-meditation-volume", String(meditation.volume));
  }

  function loadAssets(runtime) {
    var version = runtime.version || "1";
    var cssUrl = withVersion(runtime.css || fallbackCss, version);
    var engineUrl = withVersion(runtime.engine || fallbackEngine, version);

    setRuntimeAttributes(runtime);

    var preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "script";
    preload.href = engineUrl;
    document.head.appendChild(preload);

    return new Promise(function (resolve, reject) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssUrl;
      link.onload = function () {
        var script = document.createElement("script");
        script.src = engineUrl;
        script.async = true;
        script.onload = function () {
          root.classList.add("ts100-runtime-ready");
          resolve();
        };
        script.onerror = function () { reject(new Error("공통 엔진을 불러오지 못했습니다.")); };
        document.head.appendChild(script);
      };
      link.onerror = function () { reject(new Error("공통 스타일을 불러오지 못했습니다.")); };
      document.head.appendChild(link);
    });
  }

  fetch(runtimeUrl, { credentials: "omit", cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("runtime " + response.status);
      return response.json();
    })
    .catch(function () {
      return {
        version: root.getAttribute("data-runtime-version") || "6.0.0",
        css: fallbackCss,
        engine: fallbackEngine,
        endpoints: {},
        meditation: {}
      };
    })
    .then(loadAssets)
    .catch(function (error) {
      console.error("[TimeStory Loader]", error);
      showError(error.message);
    });
})();
