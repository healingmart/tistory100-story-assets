/*
 * Tistory100 Story Experience Engine v3.18.0
 * Original work for Tistory100
 * No autoplay on page load. All audio starts after a user gesture.
 */
(function () {
  "use strict";

  var ENGINE_VERSION = "4.0.0";
  var TS100_WISDOM_SEARCH_INDEX = [];
  var TS100_WISDOM_CATEGORIES = ["자립과 생존","용기와 도전","인내와 끈기","실패와 회복","선택과 결단","관계와 공감","마음과 수양","배움과 성장","세상과 처세","변화와 인생"];
  var TS100_PROGRESS_KEY = "ts100_progress_v1";
  var TS100_PROGRESS_BACKUP_KEY = "ts100_progress_backup_v1";
  var TS100_PROGRESS_JOURNAL_KEY = "ts100_progress_journal_v1";


  function qs(root, selector) {
    return root ? root.querySelector(selector) : null;
  }

  function qsa(root, selector) {
    return root ? Array.prototype.slice.call(root.querySelectorAll(selector)) : [];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function cleanBloggerArtifacts(value) {
    var text = String(value == null ? "" : value);
    var map = {
      "39": "'",
      "183": "\u00B7",
      "8230": "...",
      "215": "x",
      "572": "",
      "9393": ""
    };
    var i;

    /* Blogger can leave numeric entities escaped more than once,
       for example &amp;#9393 or &amp;amp;#9393. Normalize only the
       ampersands immediately in front of numeric references. */
    for (i = 0; i < 8; i += 1) {
      var normalized = text.replace(/&(?:amp;)+(?=#\d{1,7};?)/gi, "&");
      if (normalized === text) break;
      text = normalized;
    }

    /* Known Blogger artifacts, with or without the leading ampersand/semicolon. */
    text = text.replace(/&?#(39|183|8230|215|572|9393);?/gi, function (_, code) {
      return Object.prototype.hasOwnProperty.call(map, code) ? map[code] : _;
    });

    /* Decode any remaining decimal numeric reference that survived as visible text. */
    text = text.replace(/&#(\d{1,7});?/gi, function (_, code) {
      var num = Number(code);
      if (!Number.isFinite(num) || num < 0 || num > 1114111) return "";
      try { return String.fromCodePoint(num); } catch (e) { return ""; }
    });

    /* Decimal 9393 can already have been converted to the Unicode character U+24B1. */
    text = text.replace(/\u24B1/g, "");
    return text;
  }

  function safeText(value) {
    return cleanBloggerArtifacts(value);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch] || ch;
    });
  }

  function cleanRenderedBloggerArtifacts(root) {
    if (!root || !document.createTreeWalker) {
      return;
    }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentNode;
      if (parent && /^(SCRIPT|STYLE|TEXTAREA)$/i.test(parent.nodeName)) {
        continue;
      }
      var cleaned = cleanBloggerArtifacts(node.nodeValue);
      if (cleaned !== node.nodeValue) {
        node.nodeValue = cleaned;
      }
    }
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "00:00";
    }
    var total = Math.floor(seconds);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }


  function installBloggerArtifactGuard(root) {
    if (!root || typeof MutationObserver === "undefined") return null;
    var scheduled = false;
    var observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(function () {
        scheduled = false;
        cleanRenderedBloggerArtifacts(root);
      });
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });
    return observer;
  }

  function icon(name) {
    var common = 'class="ts100-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    var paths = {
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
      share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>',
      play: '<polygon points="8 5 19 12 8 19 8 5"/>',
      pause: '<line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/>',
      speaker: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
      chevronLeft: '<polyline points="15 18 9 12 15 6"/>',
      chevronRight: '<polyline points="9 18 15 12 9 6"/>',
      rotate: '<polyline points="1 4 1 10 7 10"/><path d="M3.5 15a9 9 0 1 0 .5-9.5L1 10"/>',
      save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
      trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
      rewind: '<polyline points="11 19 2 12 11 5"/><polyline points="22 19 13 12 22 5"/>',
      forward: '<polyline points="13 19 22 12 13 5"/><polyline points="2 19 11 12 2 5"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>'
    };
    return '<svg ' + common + '>' + (paths[name] || paths.book) + '</svg>';
  }


  function isAbsoluteAssetUrl(value) {
    return /^(?:[a-z]+:)?\/\//i.test(value) || /^(?:data:|blob:|#)/i.test(value);
  }

  function resolveAssetPath(value, baseUrl) {
    var path = safeText(value).trim();
    if (!path || !baseUrl || isAbsoluteAssetUrl(path)) {
      return path;
    }
    try {
      return new URL(path, baseUrl).href;
    } catch (e) {
      return path;
    }
  }

  function resolveStoryImagePath(value, baseUrl, pageIndex) {
    var path = safeText(value).trim().replace(/\\/g, "/");
    var pageName = String(Number(pageIndex) + 1).padStart(2, "0") + ".webp";
    if (!baseUrl) return path;

    /*
     * Old Builder/demo JSON sometimes included an extra prefix such as
     * stories/[story-slug]/images/watermarked/01.webp. The story base already
     * points at the current story folder, so resolving that string literally duplicates
     * the folder and produces a 404. Any standard numbered image path is
     * normalized to the canonical story folder here.
     */
    if (isAbsoluteAssetUrl(path)) return path;

    var standardMatch = path.match(/(?:^|\/)images\/(?:watermarked\/)?(\d{2}\.webp)(?:[?#].*)?$/i);
    if (standardMatch) {
      try { return new URL("images/watermarked/" + standardMatch[1], baseUrl).href; }
      catch (e) {}
    }

    if (!path) {
      try { return new URL("images/watermarked/" + pageName, baseUrl).href; }
      catch (e) { return path; }
    }
    try { return new URL(path.replace(/^\.\//, ""), baseUrl).href; }
    catch (e) { return path; }
  }

  function appendAssetVersion(url, assetVersion) {
    var value = safeText(url).trim();
    var versionValue = safeText(assetVersion).trim();
    if (!value || !versionValue || /^(?:data:|blob:|#)/i.test(value)) return value;
    try {
      var parsed = new URL(value, window.location.href);
      parsed.searchParams.set("v", versionValue);
      return parsed.href;
    } catch (e) {
      return value + (value.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(versionValue);
    }
  }

  function resolveStoryAssetPaths(data, baseUrl, assetVersion) {
    if (!data || !baseUrl) {
      return data;
    }
    (data.pages || []).forEach(function (page, pageIndex) {
      page.image = appendAssetVersion(resolveStoryImagePath(page.image, baseUrl, pageIndex), assetVersion);
      page.audio = resolveAssetPath(page.audio, baseUrl);
    });
    if (data.audioBook) {
      data.audioBook.src = resolveAssetPath(data.audioBook.src, baseUrl);
    }
    if (data.meditation) {
      data.meditation.audio = resolveAssetPath(data.meditation.audio, baseUrl);
    }
    return data;
  }

  function resolveMeditationAudio(data, root) {
    if (!data || !root) return data;
    data.meditation = data.meditation || {};
    if (safeText(data.meditation.audio).trim()) return data;

    var musicId = safeText(data.meditationMusic || (data.meta && data.meta.meditationMusic) || "").trim();
    var storyNumber = Number(data.number || (data.meta && data.meta.number) || root.getAttribute("data-story-number"));
    if (!musicId && Number.isFinite(storyNumber) && storyNumber > 0) {
      musicId = "meditation-" + String(((storyNumber - 1) % 3) + 1).padStart(2, "0");
    }
    if (!musicId) return data;
    if (!/\.mp3(?:$|[?#])/i.test(musicId)) musicId += ".mp3";

    var base = root.getAttribute("data-meditation-base") || "https://healingmart.github.io/tistory100-story-assets/common/audio/meditation/";
    data.meditation.audio = resolveAssetPath(musicId, base);
    return data;
  }

  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (text != null) {
      el.textContent = safeText(text);
    }
    return el;
  }

  function normalizeData(raw) {
    var data = raw || {};
    data.version = data.version || "2.0.0";
    data.id = data.id || "story";
    data.meta = data.meta || {};
    data.meta.title = data.meta.title || "이야기";
    data.meta.hanja = data.meta.hanja || "";
    data.meta.subtitle = data.meta.subtitle || "";
    data.meta.sourceLabel = data.meta.sourceLabel || "Tistory100 인문 스토리";
    data.meta.sourceStatus = data.meta.sourceStatus || "";
    data.meta.categoryLabel = data.meta.categoryLabel || "";
    data.meta.emotionFlow = data.meta.emotionFlow || "";
    data.source = data.source && typeof data.source === "object" ? data.source : {};
    data.storyOrigin = data.storyOrigin && typeof data.storyOrigin === "object" ? data.storyOrigin : {};
    data.audioSeries = data.audioSeries && typeof data.audioSeries === "object" ? data.audioSeries : {};
    data.audioSeries.items = Array.isArray(data.audioSeries.items) ? data.audioSeries.items : [];
    data.pages = Array.isArray(data.pages) ? data.pages : [];
    data.pages.forEach(function (page) {
      if (page.audioStart != null) page.audioStart = Number(page.audioStart);
      if (page.audioEnd != null) page.audioEnd = Number(page.audioEnd);
      if (typeof page.motion === "string") page.motion = { type: page.motion };
      if (!page.motion || typeof page.motion !== "object") page.motion = null;
    });
    data.audioBook = data.audioBook || {};
    data.meaning = data.meaning || {};
    data.meaning.summary = data.meaning.summary || "";
    data.meaning.characters = Array.isArray(data.meaning.characters) ? data.meaning.characters : [];
    data.editorial = data.editorial || {};
    data.editorial.title = data.editorial.title || "이 네 글자가 오늘의 우리에게 말하는 것";
    data.editorial.body = data.editorial.body || "";
    data.editorial.question = data.editorial.question || "";
    data.reflection = data.reflection || {};
    data.reflection.question = data.reflection.question || "당신은 어떻게 생각하시나요?";
    data.reflection.placeholder = data.reflection.placeholder || "나의 생각을 자유롭게 적어보세요.";
    data.modules = Object.assign({
      handwriting: true,
      relations: true,
      motto: true,
      meditation: true,
      reflection: true,
      transcript: true
    }, data.modules || {});
    data.relations = Array.isArray(data.relations) ? data.relations : [];
    data.related = Array.isArray(data.related) ? data.related : [];
    data.motto = data.motto || {};
    data.motto.defaultText = data.motto.defaultText || "오늘 내가 스스로 시작할 수 있는 한 가지를 정해보세요.";
    data.motto.brandMain = data.motto.brandMain || "TimeStory";
    data.motto.brandSub = data.motto.brandSub || "TimeStory";
    data.motto.defaultSize = data.motto.defaultSize || "1080x2340";
    data.meditation = data.meditation || {};
    data.meditation.seconds = 300;
    data.meditation.question = data.meditation.question || data.editorial.question || data.reflection.question;
    data.meditation.audio = data.meditation.audio || "";
    data.links = data.links || {};
    return data;
  }

  function TS100StoryExperience(root, rawData) {
    if (!root) {
      throw new Error("Tistory100 root element is required.");
    }
    this.root = root;
    this.data = normalizeData(rawData);
    resolveMeditationAudio(this.data, root);
    this.pageIndex = 0;
    this.autoMode = false;
    this.autoSyncFrame = 0;
    this.currentMode = "story";
    this.touchStartX = null;
    this.imageTransitionToken = 0;
    this.activeImageLayer = 0;
    this.imageMotionAnimation = null;
    this.imageTransitionAnimations = [];
    this.preloadedImages = {};
    this.audioSeriesItems = [];
    this.audioSeriesIndex = 0;
    this.audioSeriesReady = false;
    this.continuousAudio = false;
    this.currentAudioItem = null;
    this.seriesNextResolvedUrl = "";
    this.seriesAutoNextPanel = null;
    this.seriesAutoNextTitle = null;
    this.seriesAutoNextDesc = null;
    this.seriesAutoNextTimer = null;
    this.seriesAutoNextInterval = null;
    this.seriesAutoNextCancelled = false;
    this.deleteMemoryArmed = false;
    this.deleteMemoryArmTimer = null;
    this._wisdomNewLeaf = false;
    this._activeMemoryEcho = null;
    this._libraryHighlightTimer = null;
    this._completionMilestoneTimers = [];
    this._storyLibraryItems = [];
    this._storyLibraryOpen = false;
    this._storyLibraryShowAll = false;
    this._storyLibraryOpenCategory = "";
    this._storyLibraryPromise = null;
    this._storyLibraryLoaded = false;
    this._storyLibrarySearchTimer = null;
    this._meditationFailureCount = 0;
    this._seriesCatalog = [];
    this._reflectionDraftTimer = null;
    this.meditationRemaining = this.data.meditation.seconds;
    this.meditationTimer = null;
    this.reflectionMusicItems = [];
    this.reflectionMusicIndex = 0;

    this.storagePrefix = "ts100_story_" + this.data.id + "_";
    try {
      var scopeInfo = { origin: window.location.origin, href: window.location.href, checkedAt: new Date().toISOString() };
      localStorage.setItem("ts100_storage_scope_v1", JSON.stringify(scopeInfo));
      if (window.location.protocol === "file:") {
        console.warn("[TimeStory] file:// HTML은 파일별 저장소가 달라질 수 있어 지혜 서재 지속성 테스트에 적합하지 않습니다.");
      }
    } catch (e) {}
    this.pageAudio = document.createElement("audio");
    this.pageAudio.preload = "metadata";
    this.segmentStart = null;
    this.segmentEnd = null;
    this.segmentCompleted = false;
    this.fullAudio = document.createElement("audio");
    this.fullAudio.preload = "metadata";
    this.meditationAudio = document.createElement("audio");
    this.meditationAudio.preload = "none";
    this.meditationAudio.playsInline = true;
    this.writeState = {
      index: 0,
      drawing: false,
      lastX: 0,
      lastY: 0
    };
    this.memoryWriteState = {
      drawing: false,
      lastX: 0,
      lastY: 0,
      strokes: [],
      currentStroke: null
    };
    this.elements = {};
    this.init();
  }

  TS100StoryExperience.prototype.init = function () {
    this.build();
    this.cacheElements();
    this.bind();
    this.restore();
    this.preloadStoryImages();
    this.renderPage(false);
    this.renderStaticData();
    this.initSeriesNavigation();
    this.initAudioSeries();
    this.resumeSeriesPlaybackIfRequested();
    this.renderTranscript();
    this.renderRelations();
    this.renderRelated();
    this.initStoryLibrary();
    this.initWisdomFinderModes();
    this.initReflectionMusic();
    this.renderSavedReflection();
    this.initWritingCanvas();
    this.initMemoryCanvas();
    this.setRecordMode("text");
    this.renderMemoryEcho();
    this.renderWisdomSummary();
    this.updateMottoPreview();
    this.updateMeditationDisplay();
    this.setMode("story");
    cleanRenderedBloggerArtifacts(this.root);
    this.bloggerArtifactObserver = installBloggerArtifactGuard(this.root);
  };

  TS100StoryExperience.prototype.build = function () {
    var d = this.data;
    this.root.setAttribute("data-story-id", d.id);
    this.root.setAttribute("data-engine-version", ENGINE_VERSION);
    this.root.innerHTML = [
      '<header class="ts100-header ts100-frame">',
        '<div class="ts100-brand" role="heading" aria-level="1">',
          '<span class="ts100-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h10M7 21h10M8 3c0 4 1.5 6.2 4 9-2.5 2.8-4 5-4 9M16 3c0 4-1.5 6.2-4 9 2.5 2.8 4 5 4 9"/><path d="M9.5 7.5h5M9.5 16.5h5"/></svg></span>',
          '<span class="ts100-brand-title"><strong>TimeStory</strong><span data-bind="header-title">001/100</span></span>',
        '</div>',
        '<div class="ts100-header-actions">',
          '<nav class="ts100-header-series-nav" aria-label="이전 이야기와 다음 이야기">',
            '<a class="ts100-header-series-link ts100-header-prev ts100-hidden" data-bind="series-prev" href="#" aria-disabled="true">← 이전 이야기</a>',
            '<a class="ts100-header-series-link ts100-header-next" data-bind="series-next" href="#" aria-disabled="true">다음 이야기 →</a>',
          '</nav>',
          '<div class="ts100-share-anchor">',
            '<button type="button" class="ts100-btn ts100-top-share" data-action="share" aria-label="공유 메뉴 열기" aria-expanded="false" aria-controls="ts100SharePopover">',
              icon("share"),
            '</button>',
            '<div class="ts100-share-popover ts100-hidden" id="ts100SharePopover" data-bind="share-menu" aria-label="공유하기">',
              '<p class="ts100-share-popover-title">이 이야기를 공유하세요</p>',
              '<div class="ts100-share-menu-grid">',
                '<button type="button" class="ts100-share-service ts100-share-kakao" data-share-service="kakao" title="카카오톡"><span class="ts100-share-service-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.9 1.9 5.4 4.7 6.8-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.2-.1 2.6-1.8 3.7-2.5.7.1 1.3.2 2 .2 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg></span><span>카카오</span></button>',
                '<button type="button" class="ts100-share-service ts100-share-naver" data-share-service="naver" title="네이버"><span class="ts100-share-service-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.3 12.6L7.7 0H0v24h7.7V11.4L16.3 24H24V0h-7.7v12.6z"/></svg></span><span>네이버</span></button>',
                '<button type="button" class="ts100-share-service ts100-share-facebook" data-share-service="facebook" title="페이스북"><span class="ts100-share-service-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12c0-6.6-5.4-12-12-12S0 5.4 0 12c0 6 4.4 11 10.1 11.9v-8.4H7.1V12h3.1V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4C19.6 23 24 18 24 12z"/></svg></span><span>페이스북</span></button>',
                '<button type="button" class="ts100-share-service ts100-share-x" data-share-service="x" title="X"><span class="ts100-share-service-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></span><span>X</span></button>',
                '<button type="button" class="ts100-share-service ts100-share-threads" data-share-service="threads" title="Threads"><span class="ts100-share-service-icon"><svg viewBox="0 0 192 192" fill="currentColor"><path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z"/></svg></span><span>Threads</span></button>',
                '<button type="button" class="ts100-share-service ts100-share-copy" data-share-service="copy" title="링크 복사"><span class="ts100-share-service-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></span><span>링크복사</span></button>',
                '<button type="button" class="ts100-share-service ts100-share-band" data-share-service="band" title="네이버 밴드"><span class="ts100-share-service-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm5 12h-4v4h-2v-4H7v-2h4V8h2v4h4v2z"/></svg></span><span>밴드</span></button>',
                '<button type="button" class="ts100-share-service ts100-share-telegram" data-share-service="telegram" title="텔레그램"><span class="ts100-share-service-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg></span><span>텔레그램</span></button>',
              '</div>',
            '</div>',
          '</div>',
        '</div>',
      '</header>',

      '<main>',
        '<section class="ts100-hero ts100-frame" aria-labelledby="ts100HeroTitle">',
          '<p class="ts100-hanja-title" data-bind="hero-hanja"></p>',
          '<h2 class="ts100-korean-title" id="ts100HeroTitle" data-bind="hero-title"></h2>',
          '<p class="ts100-subtitle" data-bind="hero-subtitle"></p>',
          '<span class="ts100-source-badge" data-bind="source-status"></span>',
          '<p class="ts100-source-note" data-bind="source-note"></p>',
          '<div class="ts100-hero-actions">',
            '<button type="button" class="ts100-btn ts100-btn-primary" data-action="jump-story">' + icon("book") + '이야기 시작</button>',
          '</div>',
          '<p class="ts100-hero-duration">' + icon("clock") + '<span data-bind="hero-duration">06:29</span></p>',
        '</section>',

        '<nav class="ts100-story-nav" aria-label="이 이야기 둘러보기">',
          '<span class="ts100-story-nav-title">이 이야기 둘러보기</span>',
          '<a href="#ts100StorySection">이야기</a>',
          '<a href="#ts100MeaningSection">네 글자의 의미</a>',
          '<a href="#ts100TodaySection">오늘의 생각</a>',
          '<a href="#ts100MeditationSection">5분 사색</a>',
          '<a href="#ts100ReflectionSection">나의 기록</a>',
          '<a href="#ts100WisdomTreeSection">지혜 서재</a>',
          '<a href="#ts100WisdomSearchSection">지혜 찾기</a>',
          '<a href="#ts100StoryLibrarySection">사자성어 100선</a>',
          '<a href="#ts100ExperienceSection">체험</a>',
          '<a class="ts100-story-nav-game" href="https://www.tistory100.com/2026/07/Four-character%20idiom.html">사자성어 게임</a>',
        '</nav>',

        '<section class="ts100-card ts100-story-shell ts100-frame" id="ts100StorySection" aria-label="스토리북">',
          '<div class="ts100-story-toolbar">',
            '<div class="ts100-mode-tabs" role="group" aria-label="이야기 재생 방식">',
              '<button type="button" class="ts100-btn ts100-mode-tab" data-mode="story" aria-pressed="true">직접 읽기</button>',
              '<button type="button" class="ts100-btn ts100-mode-tab" data-mode="auto" aria-pressed="false">자동 재생</button>',
              '<button type="button" class="ts100-btn ts100-mode-tab" data-mode="audio" aria-pressed="false"><span class="ts100-label-desktop">오디오만 듣기</span><span class="ts100-label-mobile">오디오만</span></button>',
            '</div>',
          '</div>',
          '<div class="ts100-story-statebar">',
            '<div class="ts100-story-state-info">',
              '<span class="ts100-story-duration" data-bind="story-duration">총 --:--</span>',
              '<span class="ts100-story-state-text" data-bind="mode-status" aria-live="polite" data-nosnippet></span>',
            '</div>',
            '<button type="button" class="ts100-btn ts100-auto-pause ts100-hidden" data-action="auto-pause"><span data-bind="auto-pause-label">일시정지</span></button>',
          '</div>',

          '<div data-panel="story">',
            '<div class="ts100-story-stage">',
              '<div class="ts100-story-media" data-swipe-area>',
                '<img class="ts100-story-image ts100-story-image-layer is-active" alt="" data-bind="page-image" decoding="async" draggable="false">',
                '<div class="ts100-story-dialogue ts100-hidden" data-bind="page-dialogue"></div>',
                '<div class="ts100-story-fallback ts100-hidden" data-bind="page-fallback">',
                  '<div class="ts100-story-fallback-inner">',
                    '<span class="ts100-story-fallback-index" data-bind="fallback-index"></span>',
                    '<span class="ts100-story-fallback-title" data-bind="fallback-title"></span>',
                  '</div>',
                '</div>',
              '</div>',
              '<div class="ts100-story-caption">',
                '<p class="ts100-story-text" data-bind="page-text"></p>',
                '<p class="ts100-story-narration-note" data-bind="page-note"></p>',
              '</div>',
            '</div>',
            '<div class="ts100-story-controls">',
              '<button type="button" class="ts100-btn" data-action="prev-page">' + icon("chevronLeft") + '이전</button>',
              '<div class="ts100-page-status">',
                '<span class="ts100-page-count" data-bind="page-count"></span>',
              '</div>',
              '<button type="button" class="ts100-btn" data-action="next-page">다음' + icon("chevronRight") + '</button>',
            '</div>',

            '<div class="ts100-audio-row" data-bind="scene-audio-row">',
              '<button type="button" class="ts100-btn ts100-btn-soft" data-action="page-audio">' + icon("speaker") + '<span data-bind="page-audio-label">이 장면 듣기</span></button>',
              '<button type="button" class="ts100-btn" data-action="restart-page">' + icon("rotate") + '다시 듣기</button>',
              '<p class="ts100-audio-status" data-bind="page-audio-status" aria-live="polite" data-nosnippet></p>',
            '</div>',
          '</div>',

          '<div class="ts100-audiobook ts100-hidden" data-panel="audio" id="ts100AudiobookPanel">',
            '<h3 class="ts100-audiobook-title" data-bind="audiobook-title"></h3>',
            '<p class="ts100-audiobook-subtitle">화면을 보지 않아도 처음부터 끝까지 들을 수 있습니다.</p>',
            '<div class="ts100-audiobook-controls">',
              '<div class="ts100-audio-main-row">',
                '<button type="button" class="ts100-btn" data-action="back-10">' + icon("rewind") + '10초</button>',
                '<button type="button" class="ts100-btn ts100-btn-primary" data-action="full-audio">' + icon("play") + '<span data-bind="full-audio-label">재생</span></button>',
                '<button type="button" class="ts100-btn" data-action="forward-10">10초' + icon("forward") + '</button>',
              '</div>',
              '<input class="ts100-audio-range" type="range" min="0" max="100" value="0" step="0.1" data-bind="full-audio-range" aria-label="전체 오디오 재생 위치">',
              '<div class="ts100-audio-time"><span data-bind="full-current">00:00</span><span data-bind="full-duration">00:00</span></div>',
              '<div class="ts100-audio-main-row" style="margin-top:12px">',
                '<label for="ts100PlaybackRate" style="font-size:12px;color:rgba(255,255,255,.72)">재생속도</label>',
                '<select id="ts100PlaybackRate" class="ts100-btn" data-bind="playback-rate" aria-label="재생 속도">',
                  '<option value="0.8">0.8x</option>',
                  '<option value="1" selected>1.0x</option>',
                  '<option value="1.2">1.2x</option>',
                  '<option value="1.5">1.5x</option>',
                '</select>',
              '</div>',
              '<p class="ts100-audio-status" data-bind="full-audio-status" aria-live="polite" data-nosnippet></p>',
              '<div class="ts100-audio-series">',
                '<label class="ts100-audio-series-toggle"><input type="checkbox" data-bind="continuous-audio"><span>다음 이야기 연속 듣기</span></label>',
                '<div class="ts100-audio-series-nav">',
                  '<button type="button" class="ts100-btn" data-action="audio-prev-story" disabled>이전 이야기</button>',
                  '<button type="button" class="ts100-btn" data-action="audio-next-story" disabled>다음 이야기</button>',
                '</div>',
                '<p class="ts100-audio-series-status" data-bind="audio-series-status" data-nosnippet>다음 작품의 오디오 카탈로그가 연결되면 연속 듣기를 사용할 수 있습니다.</p>',
              '</div>',
            '</div>',
          '</div>',
        '</section>',

        '<section class="ts100-card ts100-frame ts100-reading-card" data-section="transcript">',

          '<div class="ts100-section-head">',
            '<p class="ts100-section-kicker">STORY</p>',
            '<h2 class="ts100-section-title">전체 이야기 글로 읽기</h2>',
            '<p class="ts100-section-desc">이미지 없이도 이야기 전체를 차례대로 읽을 수 있습니다.</p>',
          '</div>',
          '<div class="ts100-transcript-toggle"><button type="button" class="ts100-btn" data-action="toggle-transcript">' + icon("eye") + '<span data-bind="transcript-label">전체 글 펼치기</span></button></div>',
          '<ol class="ts100-transcript ts100-hidden" data-bind="transcript"></ol>',
        '</section>',

        '<section class="ts100-wisdom-summary ts100-story-completion ts100-frame ts100-library-compact" id="ts100WisdomTreeSection" data-bind="wisdom-summary" aria-label="나의 지혜 서재">',
          '<div class="ts100-wisdom-summary-head">',
            '<p class="ts100-section-kicker">MY WISDOM LIBRARY</p>',
            '<h3 class="ts100-record-title" data-bind="wisdom-summary-title">나의 지혜 서재</h3>',
            '<p class="ts100-wisdom-completion-desc">이야기의 절반을 만나면 읽는 중인 책이 먼저 꽂히고, 끝까지 만나면 완독으로 기록됩니다.</p>',
          '</div>',
          '<div class="ts100-wisdom-tree-metrics ts100-library-metrics">',
            '<div class="ts100-wisdom-tree-metric"><span>서가의 책</span><strong data-bind="wisdom-progress">0 / 100</strong></div>',
            '<div class="ts100-wisdom-tree-metric"><span>열린 서가</span><strong data-bind="wisdom-branches">0 / 10</strong></div>',
            '<div class="ts100-wisdom-tree-metric"><span>남긴 기록</span><strong data-bind="wisdom-records">0</strong></div>',
          '</div>',
          '<div class="ts100-wisdom-tree-legend ts100-library-legend" data-bind="wisdom-tree-legend" aria-label="지혜 영역 선택"></div>',
          '<div class="ts100-wisdom-tree-shell ts100-wisdom-library-shell" data-bind="wisdom-tree-shell">',
            '<div class="ts100-wisdom-library" data-bind="wisdom-tree" role="region" aria-label="선택한 삶의 영역에 기록된 열 권의 이야기"></div>',
            '<div class="ts100-wisdom-tree-message ts100-library-message" data-bind="wisdom-tree-message" aria-live="polite"></div>',
          '</div>',
          '<p class="ts100-wisdom-summary-note">점수나 능력을 측정하는 기능이 아닙니다. 내가 실제로 만난 이야기와 남긴 생각을 다시 꺼내보는 개인적인 기록입니다.</p>',
        '</section>',

'<section class="ts100-wisdom-search ts100-frame" id="ts100WisdomSearchSection" aria-label="오늘의 지혜 찾기">',
          '<div class="ts100-section-head">',
            '<p class="ts100-section-kicker">FIND YOUR WISDOM</p>',
            '<h2 class="ts100-section-title">오늘의 지혜 찾기</h2>',
            '<p class="ts100-section-desc">지금의 고민에서 찾거나, 기억나는 사자성어와 한자를 직접 검색해보세요.</p>',
          '</div>',
          '<div class="ts100-wisdom-mode-tabs" role="tablist" aria-label="지혜 찾기 방식">',
            '<button type="button" class="ts100-wisdom-mode-tab is-active" data-action="wisdom-mode-situation" data-wisdom-mode="situation" role="tab" aria-selected="true">상황별 지혜찾기</button>',
            '<button type="button" class="ts100-wisdom-mode-tab" data-action="wisdom-mode-idiom" data-wisdom-mode="idiom" role="tab" aria-selected="false">사자성어로 찾기</button>',
          '</div>',

          '<div class="ts100-wisdom-mode-panel" data-bind="wisdom-panel-situation" role="tabpanel">',
            '<div class="ts100-wisdom-search-box">',
              '<input type="text" class="ts100-wisdom-search-input" data-bind="wisdom-search-input" placeholder="예: 요즘 사람 관계 때문에 마음이 너무 지쳐요" aria-label="지금 마음에 걸리는 일 입력">',
              '<button type="button" class="ts100-btn ts100-btn-primary" data-action="wisdom-search">나에게 필요한 네 글자 찾기</button>',
            '</div>',
            '<p class="ts100-wisdom-search-subtitle">다양한 생각에서 시작해보세요</p>',
            '<div class="ts100-wisdom-search-chips">',
              '<button type="button" class="ts100-search-chip" data-search-example="일을 계속해야 할지 그만두어야 할지 모르겠어요">진로와 선택</button>',
              '<button type="button" class="ts100-search-chip" data-search-example="사람에게 상처받고 관계가 두려워졌어요">관계와 상처</button>',
              '<button type="button" class="ts100-search-chip" data-search-example="실패한 뒤 다시 시작할 용기가 나지 않아요">실패와 재시작</button>',
              '<button type="button" class="ts100-search-chip" data-search-example="남들과 비교하면서 자꾸 마음이 작아져요">비교와 열등감</button>',
              '<button type="button" class="ts100-search-chip" data-search-example="아무리 노력해도 결과가 보이지 않아요">노력과 인내</button>',
              '<button type="button" class="ts100-search-chip" data-search-example="혼자 모든 것을 감당하는 기분이에요">외로움과 자립</button>',
              '<button type="button" class="ts100-search-chip" data-search-example="마음이 복잡해서 어떤 판단도 내리기 어려워요">불안과 혼란</button>',
              '<button type="button" class="ts100-search-chip" data-search-example="지나간 선택이 계속 후회돼요">후회와 회복</button>',
              '<button type="button" class="ts100-search-chip" data-search-example="새로운 도전을 앞두고 겁이 나요">용기와 도전</button>',
              '<button type="button" class="ts100-search-chip" data-search-example="지친 마음을 잠시 내려놓고 싶어요">휴식과 평온</button>',
            '</div>',
            '<p class="ts100-wisdom-search-subtitle">10개 삶의 영역으로 찾기</p>',
            '<div class="ts100-wisdom-search-chips">',
              '<button type="button" class="ts100-search-chip" data-search-situation="자립 생존 혼자 책임">자립과 생존</button>',
              '<button type="button" class="ts100-search-chip" data-search-situation="용기 도전 시작 두려움">용기와 도전</button>',
              '<button type="button" class="ts100-search-chip" data-search-situation="인내 끈기 노력 기다림">인내와 끈기</button>',
              '<button type="button" class="ts100-search-chip" data-search-situation="실패 회복 재기 다시">실패와 회복</button>',
              '<button type="button" class="ts100-search-chip" data-search-situation="선택 결정 판단 결단">선택과 결단</button>',
              '<button type="button" class="ts100-search-chip" data-search-situation="관계 공감 사람 소통">관계와 공감</button>',
              '<button type="button" class="ts100-search-chip" data-search-situation="마음 수양 평온 절제">마음과 수양</button>',
              '<button type="button" class="ts100-search-chip" data-search-situation="배움 성장 공부 발전">배움과 성장</button>',
              '<button type="button" class="ts100-search-chip" data-search-situation="세상 처세 지혜 판단">세상과 처세</button>',
              '<button type="button" class="ts100-search-chip" data-search-situation="변화 인생 시간 전환">변화와 인생</button>',
            '</div>',
            '<p class="ts100-search-status" data-bind="wisdom-search-status">TimeStory VOL.01 전체 100편의 상황과 질문에서 세 가지 시선을 찾아드립니다.</p>',
            '<div class="ts100-search-results ts100-hidden" data-bind="wisdom-search-results" aria-live="polite"></div>',
          '</div>',

          '<div class="ts100-wisdom-mode-panel ts100-hidden" data-bind="wisdom-panel-idiom" role="tabpanel">',
            '<div class="ts100-idiom-finder-toolbar">',
              '<input type="search" class="ts100-idiom-finder-input" data-bind="wisdom-idiom-input" placeholder="예: 각자도생, 各自圖生, 자립" aria-label="사자성어 또는 한자 검색">',
              '<select class="ts100-idiom-finder-category" data-bind="wisdom-idiom-category" aria-label="삶의 영역 선택">',
                '<option value="">전체 삶의 영역</option>',
              '</select>',
              '<button type="button" class="ts100-btn ts100-btn-primary" data-action="wisdom-idiom-search">사자성어 찾기</button>',
            '</div>',
            '<p class="ts100-search-status" data-bind="wisdom-idiom-status">제목, 한자, 핵심 메시지와 10개 삶의 영역으로 찾을 수 있습니다.</p>',
            '<div class="ts100-idiom-finder-results" data-bind="wisdom-idiom-results" aria-live="polite"></div>',
          '</div>',
        '</section>',

        '<section class="ts100-card ts100-frame ts100-reading-card" id="ts100MeaningSection">',
          '<div class="ts100-reveal">',
            '<p class="ts100-reveal-label">여러분, 어떠셨나요?</p>',
            '<p class="ts100-reveal-hanja" data-bind="reveal-hanja"></p>',
          '</div>',
          '<div class="ts100-section-head" style="margin-top:24px">',
            '<p class="ts100-section-kicker">MEANING</p>',
            '<h2 class="ts100-section-title" data-bind="meaning-title"></h2>',
            '<p class="ts100-section-desc" data-bind="meaning-summary"></p>',
          '</div>',
          '<div class="ts100-meaning-grid" data-bind="meaning-grid"></div>',
        '</section>',

        '<section class="ts100-card ts100-frame ts100-reading-card" id="ts100TodaySection">',
          '<div class="ts100-section-head">',
            '<p class="ts100-section-kicker">TODAY</p>',
            '<h2 class="ts100-section-title" data-bind="editorial-title"></h2>',
          '</div>',
          '<div class="ts100-editorial-body" data-bind="editorial-body"></div>',
          '<div class="ts100-editorial-question" data-bind="editorial-question"></div>',
        '</section>',

        '<section class="ts100-card ts100-reading" data-section="reflection" id="ts100ReflectionSection">',
          '<div class="ts100-section-head">',
            '<p class="ts100-section-kicker">MY THOUGHT</p>',
            '<h2 class="ts100-section-title">오늘의 나를 기록해보세요</h2>',
            '<p class="ts100-section-desc" data-bind="reflection-question"></p>',
          '</div>',
          '<div class="ts100-local-notice">',
            '<strong>나의 기록 안내</strong>',
            '<span>저장한 글과 손글씨는 이 기기의 현재 브라우저에 계속 남아 있어, 다시 방문하면 그대로 불러옵니다. TimeStory 서버로 전송하지 않습니다. 다만 브라우저 데이터 삭제·기기 변경 시 사라질 수 있어 필요할 때 ‘내 기록 이미지 저장’으로 한 장의 이미지 사본을 보관할 수 있습니다.</span>',
          '</div>',
          '<div class="ts100-record-mode-tabs" role="tablist" aria-label="기록 방식 선택">',
            '<button type="button" class="ts100-record-mode-tab is-active" data-record-mode="text" role="tab" aria-selected="true">글자로 기록</button>',
            '<button type="button" class="ts100-record-mode-tab" data-record-mode="handwriting" role="tab" aria-selected="false">손글씨로 기록</button>',
          '</div>',
          '<div class="ts100-record-block" data-record-panel="text">',
            '<h3 class="ts100-record-title">글자로 남기기</h3>',
            '<textarea class="ts100-reflection-input" data-bind="reflection-input"></textarea>',
            '<div class="ts100-reflection-actions">',
              '<button type="button" class="ts100-btn ts100-btn-primary" data-action="save-reflection">' + icon("save") + '나의 생각 저장</button>',
              '<button type="button" class="ts100-btn" data-action="clear-reflection">' + icon("trash") + '저장 내용 지우기</button>',
            '</div>',
            '<p class="ts100-reflection-save-status" data-bind="reflection-save-status" aria-live="polite">작성 중인 내용은 이 브라우저에 임시 저장됩니다.</p>',
          '</div>',
          '<div class="ts100-record-block ts100-hand-record ts100-record-panel-hidden" data-record-panel="handwriting">',
            '<h3 class="ts100-record-title">손글씨로 남기기</h3>',
            '<p class="ts100-record-help">마우스나 손가락, 펜으로 오늘의 한 문장을 자유롭게 써보세요. 손글씨의 획 순서와 좌표를 이 브라우저에 저장해 나중에 다시 보여줄 수 있습니다.</p>',
            '<div class="ts100-memory-canvas-wrap"><canvas class="ts100-memory-canvas" data-bind="memory-canvas" aria-label="나의 손글씨 기록 캔버스"></canvas></div>',
            '<div class="ts100-reflection-actions">',
              '<button type="button" class="ts100-btn" data-action="clear-memory-canvas">' + icon("trash") + '지우기</button>',
              '<button type="button" class="ts100-btn ts100-btn-primary" data-action="save-memory-handwriting">' + icon("save") + '손글씨 저장</button>',
            '</div>',
          '</div>',
          '<div class="ts100-saved-note ts100-hidden" data-bind="saved-note">',
            '<p class="ts100-saved-note-time" data-bind="saved-note-time"></p>',
            '<p class="ts100-saved-note-text" data-bind="saved-note-text"></p>',
          '</div>',
          '<aside class="ts100-memory-echo ts100-hidden" data-bind="memory-echo">',
            '<p class="ts100-memory-echo-kicker">MEMORY ECHO · 기억의 조각</p>',
            '<h3 class="ts100-memory-echo-title">지난날의 당신이 남긴 기록입니다.</h3>',
            '<p class="ts100-memory-echo-date" data-bind="memory-echo-date"></p>',
            '<blockquote class="ts100-memory-echo-text" data-bind="memory-echo-text"></blockquote>',
            '<canvas class="ts100-memory-echo-canvas ts100-hidden" data-bind="memory-echo-canvas" aria-label="저장한 손글씨 다시 보기"></canvas>',
            '<div class="ts100-reflection-actions ts100-memory-echo-actions">',
              '<button type="button" class="ts100-btn ts100-btn-soft" data-action="open-memory-echo">그 이야기 다시 보기</button>',
              '<button type="button" class="ts100-btn" data-action="dismiss-memory-echo">오늘은 닫기</button>',
            '</div>',
          '</aside>',
          '<div class="ts100-reflection-actions ts100-memory-manage">',
            '<button type="button" class="ts100-btn" data-action="export-memory">' + icon("download") + '내 기록 이미지 저장</button>',
            '<button type="button" class="ts100-btn" data-action="clear-all-memory" data-bind="clear-all-memory-button">' + icon("trash") + '내 기록 모두 삭제</button>',
          '</div>',
          '<div class="ts100-delete-confirm ts100-hidden" data-bind="clear-all-memory-confirm" role="alert">',
            '<strong>정말 모든 TimeStory 기록을 지울까요?</strong>',
            '<span>저장한 글, 손글씨, 읽는 중 기록, 완독 기록과 지혜 서재 기록이 이 브라우저에서 함께 삭제됩니다.</span>',
            '<div class="ts100-delete-confirm-actions">',
              '<button type="button" class="ts100-btn" data-action="cancel-clear-all-memory">취소</button>',
              '<button type="button" class="ts100-btn ts100-delete-danger" data-action="confirm-clear-all-memory">정말 모두 삭제</button>',
            '</div>',
          '</div>',
          '<p class="ts100-memory-manage-note">이 페이지에서 남긴 글과 손글씨를 한 장의 PNG 이미지로 저장할 수 있습니다. 브라우저에 저장된 원본 기록은 직접 삭제하기 전까지 계속 남아 있습니다.</p>',
        '</section>',

        '<section class="ts100-card ts100-experience" data-section="experience" id="ts100ExperienceSection">',
          '<div class="ts100-section-head">',
            '<p class="ts100-section-kicker">EXPERIENCE</p>',
            '<h2 class="ts100-section-title">네 글자를 직접 경험해보세요</h2>',
            '<p class="ts100-section-desc">콘텐츠 성격에 맞는 체험 모듈만 선택적으로 보여줍니다.</p>',
          '</div>',
          '<div class="ts100-module-grid">',

            '<article class="ts100-module ts100-module-wide" data-module="handwriting">',
              '<h3 class="ts100-module-title">한자 직접 써보기</h3>',
              '<p class="ts100-module-desc">마우스나 손가락으로 한 글자씩 자유롭게 따라 써보세요. 정확한 필순 판정 기능은 포함하지 않습니다.</p>',
              '<div class="ts100-write-layout">',
                '<div class="ts100-write-canvas-wrap"><canvas class="ts100-write-canvas" data-bind="write-canvas" aria-label="한자 쓰기 캔버스"></canvas></div>',
                '<div class="ts100-write-side">',
                  '<div class="ts100-write-char" data-bind="write-char"></div>',
                  '<div class="ts100-write-controls">',
                    '<button type="button" class="ts100-btn" data-action="clear-canvas">' + icon("trash") + '지우기</button>',
                    '<button type="button" class="ts100-btn" data-action="write-prev">' + icon("chevronLeft") + '이전</button>',
                    '<button type="button" class="ts100-btn" data-action="write-next">다음' + icon("chevronRight") + '</button>',
                  '</div>',
                '</div>',
              '</div>',
            '</article>',

            '<article class="ts100-module" data-module="relations">',
              '<h3 class="ts100-module-title">생각을 이어주는 네 글자</h3>',
              '<p class="ts100-module-desc">비슷한 뜻과 반대되는 가치를 함께 보면 의미가 더 선명해집니다.</p>',
              '<div class="ts100-relation-grid" data-bind="relations"></div>',
            '</article>',

            '<article class="ts100-module" data-module="motto">',
              '<h3 class="ts100-module-title">나의 좌우명으로 만들기</h3>',
              '<p class="ts100-module-desc">마음에 남은 네 글자와 나만의 한 문장을 카드로 만들어 간직해보세요.</p>',
              '<div class="ts100-motto-preview" data-bind="motto-preview">',
                '<span class="ts100-motto-hanja" data-bind="motto-hanja"></span>',
                '<span class="ts100-motto-text" data-bind="motto-text"></span>',
              '</div>',
              '<input class="ts100-motto-input" type="text" maxlength="90" data-bind="motto-input" aria-label="나의 좌우명 문장">',
              '<div class="ts100-motto-options">',
                '<label>저장 크기<select class="ts100-motto-select" data-bind="motto-size"><option value="1080x2340">안드로이드 기본 · 1080 x 2340</option><option value="1440x3120">안드로이드 고화질 · 1440 x 3120</option><option value="1179x2556">iPhone 15 계열 · 1179 x 2556</option><option value="1206x2622">iPhone 16 Pro · 1206 x 2622</option><option value="1320x2868">iPhone 16 Pro Max · 1320 x 2868</option></select></label>',
                '<label>스타일<select class="ts100-motto-select" data-bind="motto-style"><option value="classic">고전</option><option value="minimal">미니멀</option><option value="night">밤하늘</option><option value="hanji">한지</option></select></label>',
              '</div>',
              '<p class="ts100-module-desc ts100-motto-note">잠금화면의 시계와 알림을 고려해 핵심 문구는 중앙보다 약간 아래에 배치됩니다.</p>',
              '<div class="ts100-reflection-actions">',
                '<button type="button" class="ts100-btn ts100-btn-primary" data-action="download-motto">' + icon("download") + '배경화면 이미지 저장</button>',
              '</div>',
            '</article>',

'<article class="ts100-module ts100-module-wide" data-module="meditation" id="ts100MeditationSection">',
              '<h3 class="ts100-module-title">5분 사색</h3>',
              '<p class="ts100-module-desc">오늘의 네 글자를 떠올리며 음악과 함께 잠시 머물러보세요. 음악이 더 길어도 5분이 되면 자동으로 멈춥니다.</p>',
              '<div class="ts100-meditation-box">',
                '<p class="ts100-meditation-hanja" data-bind="meditation-hanja"></p>',
                '<p class="ts100-meditation-question" data-bind="meditation-question"></p>',
                '<span class="ts100-meditation-time" data-bind="meditation-time">05:00</span>',
                '<div class="ts100-reflection-track">',
                  '<p class="ts100-reflection-track-kicker" data-bind="reflection-track-mood">MUSIC FOR REFLECTION</p>',
                  '<p class="ts100-reflection-track-title" data-bind="reflection-track-title">사색 음악을 준비하고 있습니다</p>',
                  '<p class="ts100-reflection-track-subtitle" data-bind="reflection-track-subtitle">GitHub 음악 카탈로그에서 수십 곡을 자동으로 불러옵니다.</p>',
                  '<div class="ts100-reflection-track-controls">',
                    '<button type="button" class="ts100-btn ts100-btn-primary" data-action="meditation-start">' + icon("play") + '<span data-bind="meditation-label">5분 사색 시작</span></button>',
                    '<button type="button" class="ts100-btn ts100-btn-soft" data-action="meditation-random">다른 음악</button>',
                  '</div>',
                '</div>',
                '<div class="ts100-meditation-actions">',
                  '<button type="button" class="ts100-btn" data-action="meditation-reset">' + icon("rotate") + '처음부터</button>',
                '</div>',
                '<p class="ts100-audio-status" data-bind="meditation-status" aria-live="polite"></p>',
              '</div>',
            '</article>',

          '</div>',
        '</section>',

        '<section class="ts100-next-story ts100-frame" data-bind="next-story-card" aria-label="다음 이야기">',
          '<div class="ts100-next-story-copy">',
            '<p class="ts100-next-story-kicker" data-bind="next-story-kicker">다음 이야기 · 007</p>',
            '<div class="ts100-next-story-heading">',
              '<span class="ts100-next-story-hanja" data-bind="next-story-hanja">四面楚歌</span>',
              '<h2 class="ts100-next-story-title" data-bind="next-story-title">사면초가</h2>',
            '</div>',
            '<p class="ts100-next-story-subtitle" data-bind="next-story-subtitle">사면초가의 뜻과 오늘의 삶을 이어서 만나보세요.</p>',
          '</div>',
          '<a class="ts100-next-story-link" data-bind="next-story-link" aria-disabled="true">다음 이야기 만나기 ' + icon("chevronRight") + '</a>',
        '</section>',

        '<section class="ts100-card ts100-experience" data-section="related">',
          '<div class="ts100-section-head">',
            '<p class="ts100-section-kicker">NEXT</p>',
            '<h2 class="ts100-section-title">오늘의 생각을 이어가 보세요</h2>',
            '<p class="ts100-section-desc">관련된 네 글자를 통해 다음 이야기로 이어집니다.</p>',
          '</div>',
          '<div class="ts100-related-grid" data-bind="related-grid"></div>',
        '</section>',

        '<section class="ts100-card ts100-frame ts100-story-library" id="ts100StoryLibrarySection" aria-label="사자성어 100선 전체 보기">',
          '<div class="ts100-story-library-head">',
            '<div class="ts100-section-head">',
              '<p class="ts100-section-kicker">TIMESTORY VOL.01</p>',
              '<h2 class="ts100-section-title">사자성어 100선 전체 보기</h2>',
              '<p class="ts100-section-desc">10개 삶의 영역을 열어 각 10편씩 살펴보세요. 검색하면 해당 영역과 작품만 남습니다.</p>',
            '</div>',
            '<button type="button" class="ts100-btn ts100-btn-primary ts100-story-library-open" data-bind="story-library-toggle" aria-expanded="false">사자성어 100선 펼쳐보기</button>',
          '</div>',
          '<div class="ts100-story-library-panel ts100-hidden" data-bind="story-library-panel">',
            '<div class="ts100-library-toolbar">',
              '<input type="search" class="ts100-library-search" data-bind="story-library-search" placeholder="제목, 한자, 상황, 주제로 검색" aria-label="사자성어 100선 검색">',
              '<button type="button" class="ts100-btn" data-bind="story-library-clear">검색 초기화</button>',
            '</div>',
            '<p class="ts100-library-status" data-bind="story-library-status" aria-live="polite">목록을 준비하고 있습니다.</p>',
            '<div class="ts100-library-groups" data-bind="story-library-groups"></div>',
          '</div>',
        '</section>',

'<section class="ts100-card ts100-experience ts100-idiom-game-card" id="ts100IdiomGameSection" aria-label="사자성어 100선 게임">',
          '<div class="ts100-idiom-game-layout">',
            '<div class="ts100-idiom-game-copy">',
              '<p class="ts100-section-kicker">LEARN &amp; PLAY</p>',
              '<h2 class="ts100-idiom-game-title">이야기로 배운 사자성어, 게임으로 다시 만나보세요</h2>',
              '<p class="ts100-idiom-game-desc">방금 읽은 네 글자와 100가지 사자성어를 퀴즈로 재미있게 복습해 보세요.</p>',
            '</div>',
            '<a class="ts100-btn ts100-btn-primary ts100-idiom-game-link" href="https://www.tistory100.com/2026/07/Four-character%20idiom.html">게임으로 복습하기 ' + icon("chevronRight") + '</a>',
          '</div>',
        '</section>',

      '</main>',

      '<div class="ts100-end-space" aria-hidden="true"></div>',
      '<div class="ts100-completion-celebration ts100-hidden" data-bind="completion-popup" role="status" aria-live="assertive" aria-atomic="true">',
        '<div class="ts100-completion-card" data-action="dismiss-completion">',
          '<div class="ts100-completion-visual" aria-hidden="true">',
            '<span class="ts100-completion-shelf"></span>',
            '<span class="ts100-completion-book"><i class="ts100-completion-book-number" data-bind="completion-book-number">001</i></span>',
            '<span class="ts100-completion-stem"></span>',
            '<span class="ts100-completion-flower"><i class="ts100-completion-petal"></i><i class="ts100-completion-petal"></i><i class="ts100-completion-petal"></i><i class="ts100-completion-petal"></i><i class="ts100-completion-petal"></i></span>',
          '</div>',
          '<p class="ts100-completion-kicker" data-bind="completion-kicker">새로운 지혜 기록</p>',
          '<h3 class="ts100-completion-title" data-bind="completion-title"></h3>',
          '<p class="ts100-completion-desc" data-bind="completion-desc"></p>',
          '<span class="ts100-completion-progress" data-bind="completion-progress"></span>',
        '</div>',
      '</div>',
      '<div class="ts100-toast ts100-hidden" data-bind="toast" role="status" aria-live="polite" data-nosnippet></div>',
    ].join("");
  };

  TS100StoryExperience.prototype.cacheElements = function () {
    var r = this.root;
    this.elements.headerTitle = qs(r, '[data-bind="header-title"]');
    this.elements.heroHanja = qs(r, '[data-bind="hero-hanja"]');
    this.elements.heroTitle = qs(r, '[data-bind="hero-title"]');
    this.elements.heroSubtitle = qs(r, '[data-bind="hero-subtitle"]');
    this.elements.sourceStatus = qs(r, '[data-bind="source-status"]');
    this.elements.sourceNote = qs(r, '[data-bind="source-note"]');
    this.elements.heroDuration = qs(r, '[data-bind="hero-duration"]');
    this.elements.seriesCurrent = qs(r, '[data-bind="series-current"]');
    this.elements.seriesPrev = qs(r, '[data-bind="series-prev"]');
    this.elements.seriesNext = qs(r, '[data-bind="series-next"]');
    this.elements.nextStoryCard = qs(r, '[data-bind="next-story-card"]');
    this.elements.nextStoryKicker = qs(r, '[data-bind="next-story-kicker"]');
    this.elements.nextStoryHanja = qs(r, '[data-bind="next-story-hanja"]');
    this.elements.nextStoryTitle = qs(r, '[data-bind="next-story-title"]');
    this.elements.nextStorySubtitle = qs(r, '[data-bind="next-story-subtitle"]');
    this.elements.nextStoryLink = qs(r, '[data-bind="next-story-link"]');
    this.elements.storySection = qs(r, '#ts100StorySection');
    this.elements.audioPanel = qs(r, '#ts100AudiobookPanel');
    this.elements.storyPanel = qs(r, '[data-panel="story"]');
    this.elements.pageImage = qs(r, '[data-bind="page-image"]');
    this.elements.pageImageA = this.elements.pageImage;
    this.elements.pageImageB = null;
    this.elements.pageImages = this.elements.pageImage ? [this.elements.pageImage] : [];
    this.elements.pageDialogue = qs(r, '[data-bind="page-dialogue"]');
    this.elements.pageFallback = qs(r, '[data-bind="page-fallback"]');
    this.elements.fallbackIndex = qs(r, '[data-bind="fallback-index"]');
    this.elements.fallbackTitle = qs(r, '[data-bind="fallback-title"]');
    this.elements.pageText = qs(r, '[data-bind="page-text"]');
    this.elements.pageNote = qs(r, '[data-bind="page-note"]');
    this.elements.pageCount = qs(r, '[data-bind="page-count"]');
    this.elements.pageProgress = qs(r, '[data-bind="page-progress"]');
    this.elements.pageAudioLabel = qs(r, '[data-bind="page-audio-label"]');
    this.elements.pageAudioStatus = qs(r, '[data-bind="page-audio-status"]');
    this.elements.modeStatus = qs(r, '[data-bind="mode-status"]');
    this.elements.storyDuration = qs(r, '[data-bind="story-duration"]');
    this.elements.autoPauseButton = qs(r, '[data-action="auto-pause"]');
    this.elements.autoPauseLabel = qs(r, '[data-bind="auto-pause-label"]');
    this.elements.sceneAudioRow = qs(r, '[data-bind="scene-audio-row"]');
    this.elements.autoTimeline = qs(r, '[data-bind="auto-timeline"]');
    this.elements.autoAudioRange = qs(r, '[data-bind="auto-audio-range"]');
    this.elements.autoCurrent = qs(r, '[data-bind="auto-current"]');
    this.elements.autoDuration = qs(r, '[data-bind="auto-duration"]');
    this.elements.audiobookTitle = qs(r, '[data-bind="audiobook-title"]');
    this.elements.fullAudioLabel = qs(r, '[data-bind="full-audio-label"]');
    this.elements.fullAudioRange = qs(r, '[data-bind="full-audio-range"]');
    this.elements.fullCurrent = qs(r, '[data-bind="full-current"]');
    this.elements.fullDuration = qs(r, '[data-bind="full-duration"]');
    this.elements.playbackRate = qs(r, '[data-bind="playback-rate"]');
    this.elements.fullAudioStatus = qs(r, '[data-bind="full-audio-status"]');
    this.elements.continuousAudio = qs(r, '[data-bind="continuous-audio"]');
    this.elements.audioSeriesStatus = qs(r, '[data-bind="audio-series-status"]');
    this.elements.audioPrevStory = qs(r, '[data-action="audio-prev-story"]');
    this.elements.audioNextStory = qs(r, '[data-action="audio-next-story"]');
    this.elements.transcript = qs(r, '[data-bind="transcript"]');
    this.elements.transcriptLabel = qs(r, '[data-bind="transcript-label"]');
    this.elements.revealHanja = qs(r, '[data-bind="reveal-hanja"]');
    this.elements.meaningTitle = qs(r, '[data-bind="meaning-title"]');
    this.elements.meaningSummary = qs(r, '[data-bind="meaning-summary"]');
    this.elements.meaningGrid = qs(r, '[data-bind="meaning-grid"]');
    this.elements.editorialTitle = qs(r, '[data-bind="editorial-title"]');
    this.elements.editorialBody = qs(r, '[data-bind="editorial-body"]');
    this.elements.editorialQuestion = qs(r, '[data-bind="editorial-question"]');
    this.elements.reflectionQuestion = qs(r, '[data-bind="reflection-question"]');
    this.elements.reflectionInput = qs(r, '[data-bind="reflection-input"]');
    this.elements.reflectionSaveStatus = qs(r, '[data-bind="reflection-save-status"]');
    this.elements.savedNote = qs(r, '[data-bind="saved-note"]');
    this.elements.savedNoteTime = qs(r, '[data-bind="saved-note-time"]');
    this.elements.savedNoteText = qs(r, '[data-bind="saved-note-text"]');
    this.elements.memoryCanvas = qs(r, '[data-bind="memory-canvas"]');
    this.elements.memoryEcho = qs(r, '[data-bind="memory-echo"]');
    this.elements.memoryEchoDate = qs(r, '[data-bind="memory-echo-date"]');
    this.elements.memoryEchoText = qs(r, '[data-bind="memory-echo-text"]');
    this.elements.memoryEchoCanvas = qs(r, '[data-bind="memory-echo-canvas"]');
    this.elements.recordModeTabs = qsa(r, '[data-record-mode]');
    this.elements.recordPanels = qsa(r, '[data-record-panel]');
    this.elements.clearAllMemoryButton = qs(r, '[data-bind="clear-all-memory-button"]');
    this.elements.clearAllMemoryConfirm = qs(r, '[data-bind="clear-all-memory-confirm"]');
    this.elements.wisdomSummary = qs(r, '[data-bind="wisdom-summary"]');
    this.elements.wisdomSummaryTitle = qs(r, '[data-bind="wisdom-summary-title"]');
    this.elements.wisdomProgress = qs(r, '[data-bind="wisdom-progress"]');
    this.elements.wisdomBranches = qs(r, '[data-bind="wisdom-branches"]');
    this.elements.wisdomRecords = qs(r, '[data-bind="wisdom-records"]');
    this.elements.wisdomTree = qs(r, '[data-bind="wisdom-tree"]');
    this.elements.wisdomTreeShell = qs(r, '[data-bind="wisdom-tree-shell"]');
    this.elements.wisdomTreeMessage = qs(r, '[data-bind="wisdom-tree-message"]');
    this.elements.wisdomTreeLegend = qs(r, '[data-bind="wisdom-tree-legend"]');
    this.elements.wisdomSearchInput = qs(r, '[data-bind="wisdom-search-input"]');
    this.elements.wisdomSearchStatus = qs(r, '[data-bind="wisdom-search-status"]');
    this.elements.wisdomSearchResults = qs(r, '[data-bind="wisdom-search-results"]');
    this.elements.wisdomPanelSituation = qs(r, '[data-bind="wisdom-panel-situation"]');
    this.elements.wisdomPanelIdiom = qs(r, '[data-bind="wisdom-panel-idiom"]');
    this.elements.wisdomIdiomInput = qs(r, '[data-bind="wisdom-idiom-input"]');
    this.elements.wisdomIdiomCategory = qs(r, '[data-bind="wisdom-idiom-category"]');
    this.elements.wisdomIdiomStatus = qs(r, '[data-bind="wisdom-idiom-status"]');
    this.elements.wisdomIdiomResults = qs(r, '[data-bind="wisdom-idiom-results"]');
    this.elements.relations = qs(r, '[data-bind="relations"]');
    this.elements.relatedGrid = qs(r, '[data-bind="related-grid"]');
    this.elements.storyLibraryToggle = qs(r, '[data-bind="story-library-toggle"]');
    this.elements.storyLibraryPanel = qs(r, '[data-bind="story-library-panel"]');
    this.elements.storyLibrarySearch = qs(r, '[data-bind="story-library-search"]');
    this.elements.storyLibraryCategory = qs(r, '[data-bind="story-library-category"]');
    this.elements.storyLibraryClear = qs(r, '[data-bind="story-library-clear"]');
    this.elements.storyLibraryStatus = qs(r, '[data-bind="story-library-status"]');
    this.elements.storyLibraryGrid = qs(r, '[data-bind="story-library-grid"]');
    this.elements.storyLibraryGroups = qs(r, '[data-bind="story-library-groups"]');
    this.elements.storyLibraryMore = qs(r, '[data-bind="story-library-more"]');
    this.elements.writeCanvas = qs(r, '[data-bind="write-canvas"]');
    this.elements.writeChar = qs(r, '[data-bind="write-char"]');
    this.elements.mottoHanja = qs(r, '[data-bind="motto-hanja"]');
    this.elements.mottoText = qs(r, '[data-bind="motto-text"]');
    this.elements.mottoInput = qs(r, '[data-bind="motto-input"]');
    this.elements.mottoSize = qs(r, '[data-bind="motto-size"]');
    this.elements.mottoStyle = qs(r, '[data-bind="motto-style"]');
    this.elements.meditationHanja = qs(r, '[data-bind="meditation-hanja"]');
    this.elements.meditationQuestion = qs(r, '[data-bind="meditation-question"]');
    this.elements.meditationTime = qs(r, '[data-bind="meditation-time"]');
    this.elements.meditationLabel = qs(r, '[data-bind="meditation-label"]');
    this.elements.meditationStatus = qs(r, '[data-bind="meditation-status"]');
    this.elements.reflectionTrackMood = qs(r, '[data-bind="reflection-track-mood"]');
    this.elements.reflectionTrackTitle = qs(r, '[data-bind="reflection-track-title"]');
    this.elements.reflectionTrackSubtitle = qs(r, '[data-bind="reflection-track-subtitle"]');
    this.elements.completionPopup = qs(r, '[data-bind="completion-popup"]');
    this.elements.completionKicker = qs(r, '[data-bind="completion-kicker"]');
    this.elements.completionBookNumber = qs(r, '[data-bind="completion-book-number"]');
    this.elements.completionTitle = qs(r, '[data-bind="completion-title"]');
    this.elements.completionDesc = qs(r, '[data-bind="completion-desc"]');
    this.elements.completionProgress = qs(r, '[data-bind="completion-progress"]');
    this.elements.toast = qs(r, '[data-bind="toast"]');
  };

  TS100StoryExperience.prototype.bind = function () {
    var self = this;

    this.root.addEventListener("click", function (event) {
      var serviceBtn = event.target.closest("[data-share-service]");
      if (serviceBtn && self.root.contains(serviceBtn)) {
        event.preventDefault();
        event.stopPropagation();
        self.shareService(serviceBtn.getAttribute("data-share-service"));
        return;
      }

      var recordModeBtn = event.target.closest("[data-record-mode]");
      if (recordModeBtn && self.root.contains(recordModeBtn)) {
        self.setRecordMode(recordModeBtn.getAttribute("data-record-mode"));
        return;
      }

      var searchExampleBtn = event.target.closest("[data-search-example],[data-search-situation]");
      if (searchExampleBtn && self.root.contains(searchExampleBtn)) {
        var searchText = searchExampleBtn.getAttribute("data-search-example") || searchExampleBtn.getAttribute("data-search-situation") || "";
        if (self.elements.wisdomSearchInput) self.elements.wisdomSearchInput.value = searchText;
        self.searchWisdom(searchText);
        return;
      }

      var libraryJump = event.target.closest("[data-library-jump]");
      if (libraryJump && self.root.contains(libraryJump)) {
        var jumpIndex = Number(libraryJump.getAttribute("data-library-jump"));
        if (Number.isFinite(jumpIndex)) {
          self._libraryActiveCategory = clamp(jumpIndex, 0, TS100_WISDOM_CATEGORIES.length - 1);
          self.renderWisdomSummary();
        }
        return;
      }

      var wisdomLeaf = event.target.closest("[data-wisdom-leaf]");
      if (wisdomLeaf && self.root.contains(wisdomLeaf)) {
        self.showWisdomLeaf(wisdomLeaf.getAttribute("data-wisdom-leaf"));
        return;
      }

      var wisdomReading = event.target.closest("[data-wisdom-reading]");
      if (wisdomReading && self.root.contains(wisdomReading)) {
        self.showWisdomReading(wisdomReading.getAttribute("data-wisdom-reading"));
        return;
      }

      var searchShelfBtn = event.target.closest("[data-search-shelf-number]");
      if (searchShelfBtn && self.root.contains(searchShelfBtn)) {
        self.highlightWisdomShelf(Number(searchShelfBtn.getAttribute("data-search-shelf-number")));
        return;
      }

      var searchStoryBtn = event.target.closest("[data-search-story-slug]");
      if (searchStoryBtn && self.root.contains(searchStoryBtn)) {
        self.openWisdomSearchStory(searchStoryBtn.getAttribute("data-search-story-slug"));
        return;
      }

      var btn = event.target.closest("[data-action]");
      if (!btn || !self.root.contains(btn)) {
        return;
      }
      var action = btn.getAttribute("data-action");
      self.handleAction(action);
    });

    document.addEventListener("click", function (event) {
      if (!self.root.contains(event.target)) {
        self.closeShareMenu();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        self.closeShareMenu();
        self.hideCompletionPopup();
      }
    });

    qsa(this.root, "[data-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        self.setMode(btn.getAttribute("data-mode"));
      });
    });

    if (this.elements.wisdomSearchInput) {
      this.elements.wisdomSearchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          self.searchWisdom(self.elements.wisdomSearchInput.value);
        }
      });
    }

    if (this.elements.reflectionInput) {
      this.elements.reflectionInput.addEventListener("input", function () {
        if (self._reflectionDraftTimer) window.clearTimeout(self._reflectionDraftTimer);
        self._reflectionDraftTimer = window.setTimeout(function () {
          self.saveReflectionDraft();
        }, 450);
      });
    }

    if (this.elements.pageImage) {
      this.elements.pageImage.addEventListener("error", function () {
        if (this === self.elements.pageImage) self.showImageFallback(true);
      });
    }

    this.pageAudio.addEventListener("play", function () {
      self.elements.pageAudioLabel.textContent = "일시정지";
      self.elements.pageAudioStatus.textContent = self.autoMode ? "자동 슬라이드 진행 중" : "이 장면을 읽고 있습니다.";
    });
    this.pageAudio.addEventListener("pause", function () {
      if (!self.pageAudio.ended) {
        self.elements.pageAudioLabel.textContent = "이 장면 듣기";
      }
    });
    this.pageAudio.addEventListener("timeupdate", function () {
      if (Number.isFinite(self.segmentEnd) && self.pageAudio.currentTime >= self.segmentEnd - 0.04 && !self.segmentCompleted) {
        self.segmentCompleted = true;
        self.pageAudio.pause();
        self.finishPageAudio();
      }
    });
    this.pageAudio.addEventListener("ended", function () {
      self.finishPageAudio();
    });
    this.pageAudio.addEventListener("error", function () {
      self.elements.pageAudioStatus.textContent = "이 장면의 오디오를 불러오지 못했습니다.";
      if (self.autoMode) {
        self.stopAuto("오디오 오류로 자동 슬라이드를 멈췄습니다.");
      }
    });

    this.fullAudio.addEventListener("loadedmetadata", function () {
      var durationText = formatTime(self.fullAudio.duration);
      self.elements.fullDuration.textContent = durationText;
      if (self.elements.autoDuration) self.elements.autoDuration.textContent = durationText;
      if (self.elements.storyDuration) self.elements.storyDuration.textContent = "총 " + durationText;
      if (self.elements.heroDuration) self.elements.heroDuration.textContent = durationText;
      if (self.currentMode === "auto") {
        self.syncAutoSlideFromFullAudio(true);
      }
    });
    this.fullAudio.addEventListener("timeupdate", function () {
      var duration = self.fullAudio.duration || 0;
      var currentText = formatTime(self.fullAudio.currentTime);
      var durationText = formatTime(duration);
      self.elements.fullCurrent.textContent = currentText;
      self.elements.fullDuration.textContent = durationText;
      if (self.elements.autoCurrent) self.elements.autoCurrent.textContent = currentText;
      if (self.elements.autoDuration) self.elements.autoDuration.textContent = durationText;
      if (duration > 0) {
        var audioProgress = self.fullAudio.currentTime / duration;
        self.elements.fullAudioRange.value = String(audioProgress * 100);
        if (self.elements.autoAudioRange) self.elements.autoAudioRange.value = String(audioProgress * 100);
        self.checkMidpointProgress(audioProgress);
      }
      if (self.currentMode === "auto") {
        self.syncAutoSlideFromFullAudio(false);
      }
    });
    this.fullAudio.addEventListener("play", function () {
      self.elements.fullAudioLabel.textContent = "일시정지";
      if (self.currentMode === "auto") {
        self.elements.fullAudioStatus.textContent = "음성과 이미지가 자동으로 함께 진행됩니다.";
        self.elements.pageAudioLabel.textContent = "일시정지";
        if (self.elements.autoPauseLabel) self.elements.autoPauseLabel.textContent = "일시정지";
        self.scheduleAutoSync();
      } else {
        self.elements.fullAudioStatus.textContent = "전체 이야기를 재생하고 있습니다.";
      }
    });
    this.fullAudio.addEventListener("pause", function () {
      self.stopAutoSync();
      if (!self.fullAudio.ended) {
        self.elements.fullAudioLabel.textContent = "재생";
        if (self.currentMode === "auto") {
          self.elements.pageAudioLabel.textContent = "재생";
          if (self.elements.autoPauseLabel) self.elements.autoPauseLabel.textContent = "계속";
          self.elements.modeStatus.textContent = "일시정지 | " + (self.pageIndex + 1) + " / " + self.data.pages.length;
        }
      }
    });
    this.fullAudio.addEventListener("ended", function () {
      var playedExternalSeriesItem = self.currentAudioItem && self.currentAudioItem.isCurrentPage === false;
      if (playedExternalSeriesItem) self.markAudioSeriesItemCompleted(self.currentAudioItem);
      else self.markStoryCompleted();
      self.stopAutoSync();
      self.elements.fullAudioLabel.textContent = "다시 듣기";
      self.elements.fullAudioStatus.textContent = "전체 이야기가 끝났습니다.";
      if (self.currentMode === "auto") {
        self.pageIndex = Math.max(0, self.data.pages.length - 1);
        self.renderPage(false);
        self.elements.pageAudioLabel.textContent = "다시 재생";
        self.elements.modeStatus.textContent = "자동 슬라이드가 끝났습니다. 마지막 이미지가 유지됩니다.";
      }
      if (playedExternalSeriesItem) {
        if (self.currentMode === "audio") self.tryPlayNextAudioStory();
      } else if ((self.currentMode === "audio" || self.currentMode === "auto") && self.continuousAudio) {
        self.scheduleNextStoryNavigation();
      }
    });
    this.fullAudio.addEventListener("error", function () {
      self.stopAutoSync();
      self.elements.fullAudioStatus.textContent = "전체 오디오 파일을 불러오지 못했습니다.";
      if (self.currentMode === "auto") {
        self.elements.modeStatus.textContent = "오디오를 불러오지 못해 자동 슬라이드를 시작할 수 없습니다.";
      }
    });

    function bindAudioRange(rangeEl) {
      if (!rangeEl) return;
      rangeEl.addEventListener("input", function () {
        if (Number.isFinite(self.fullAudio.duration) && self.fullAudio.duration > 0) {
          self.fullAudio.currentTime = (Number(rangeEl.value) / 100) * self.fullAudio.duration;
          if (self.currentMode === "auto") self.syncAutoSlideFromFullAudio(true);
        }
      });
    }
    bindAudioRange(this.elements.fullAudioRange);
    bindAudioRange(this.elements.autoAudioRange);

    if (this.elements.continuousAudio) {
      this.elements.continuousAudio.addEventListener("change", function () {
        self.continuousAudio = !!self.elements.continuousAudio.checked;
        try { localStorage.setItem("ts100_continuous_audio_v1", self.continuousAudio ? "1" : "0"); } catch (e) {}
        self.updateAudioSeriesControls();
      });
    }

    if (this.elements.playbackRate) {
      this.elements.playbackRate.addEventListener("change", function () {
        self.fullAudio.playbackRate = Number(self.elements.playbackRate.value) || 1;
        try {
          localStorage.setItem(self.storagePrefix + "rate", String(self.fullAudio.playbackRate));
        } catch (e) {}
      });
    }

    if (this.elements.mottoInput) {
      this.elements.mottoInput.addEventListener("input", function () {
        self.updateMottoPreview();
      });
    }

    var swipeArea = qs(this.root, "[data-swipe-area]");
    if (swipeArea) {
      swipeArea.addEventListener("touchstart", function (event) {
        if (event.touches && event.touches[0]) {
          self.touchStartX = event.touches[0].clientX;
        }
      }, { passive: true });
      swipeArea.addEventListener("touchend", function (event) {
        if (self.touchStartX == null || !event.changedTouches || !event.changedTouches[0]) {
          return;
        }
        var delta = event.changedTouches[0].clientX - self.touchStartX;
        self.touchStartX = null;
        if (Math.abs(delta) < 45) {
          return;
        }
        if (delta < 0) {
          self.goToPage(self.pageIndex + 1, false);
        } else {
          self.goToPage(self.pageIndex - 1, false);
        }
      }, { passive: true });
    }

    document.addEventListener("keydown", function (event) {
      if (!self.root.isConnected) {
        return;
      }
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return;
      }
      if (self.currentMode === "audio") {
        return;
      }
      if (event.key === "ArrowRight") {
        self.goToPage(self.pageIndex + 1, false);
      } else if (event.key === "ArrowLeft") {
        self.goToPage(self.pageIndex - 1, false);
      }
    });

    window.addEventListener("resize", function () {
      self.resizeWritingCanvas();
      self.resizeMemoryCanvas();
      self.renderMemoryEcho();
    });
  };

  TS100StoryExperience.prototype.handleAction = function (action) {
    switch (action) {
      case "share": this.share(); break;
      case "jump-story": this.pageIndex = 0; try { this.fullAudio.currentTime = 0; } catch (e) {} this.setMode("auto"); this.scrollTo(this.elements.storySection); break;
      case "jump-audiobook": this.setMode("audio"); this.scrollTo(this.elements.storySection); break;
      case "prev-page": this.goToPage(this.pageIndex - 1, false); break;
      case "next-page": this.goToPage(this.pageIndex + 1, false); break;
      case "page-audio": this.togglePageAudio(); break;
      case "auto-pause": this.togglePageAudio(); break;
      case "restart-page": this.restartPageAudio(); break;
      case "full-audio": this.toggleFullAudio(); break;
      case "back-10": this.seekFullAudio(-10); break;
      case "forward-10": this.seekFullAudio(10); break;
      case "audio-prev-story": this.navigateSeriesFromAudio("previous"); break;
      case "audio-next-story": this.navigateSeriesFromAudio("next"); break;
      case "toggle-transcript": this.toggleTranscript(); break;
      case "wisdom-search": this.searchWisdom(this.elements.wisdomSearchInput ? this.elements.wisdomSearchInput.value : ""); break;
      case "wisdom-mode-situation": this.setWisdomFinderMode("situation"); break;
      case "wisdom-mode-idiom": this.setWisdomFinderMode("idiom"); break;
      case "wisdom-idiom-search": this.renderWisdomIdiomResults(); break;
      case "save-reflection": this.saveReflection(); break;
      case "clear-reflection": this.clearReflection(); break;
      case "clear-memory-canvas": this.clearMemoryCanvas(); break;
      case "save-memory-handwriting": this.saveMemoryHandwriting(); break;
      case "export-memory": this.exportMemory(); break;
      case "clear-all-memory": this.clearAllMemory(); break;
      case "confirm-clear-all-memory": this.confirmClearAllMemory(); break;
      case "cancel-clear-all-memory": this.cancelClearAllMemory(); break;
      case "clear-canvas": this.clearWritingCanvas(); break;
      case "write-prev": this.changeWritingChar(-1); break;
      case "write-next": this.changeWritingChar(1); break;
      case "download-motto": this.downloadMotto(); break;
      case "meditation-start": this.toggleMeditation(); break;
      case "meditation-reset": this.resetMeditation(); break;
      case "meditation-prev": this.changeReflectionTrack(-1); break;
      case "meditation-next": this.changeReflectionTrack(1); break;
      case "meditation-random": this.randomReflectionTrack(); break;
      case "dismiss-completion": this.hideCompletionPopup(); break;
      case "open-memory-echo": this.openMemoryEcho(); break;
      case "dismiss-memory-echo": this.dismissMemoryEcho(); break;
      case "meditation-duration-60": this.setMeditationDuration(60); break;
      case "meditation-duration-180": this.setMeditationDuration(180); break;
      case "meditation-duration-300": this.setMeditationDuration(300); break;
    }
  };

  TS100StoryExperience.prototype.renderStaticData = function () {
    var d = this.data;
    var storyNumber = Number(this.root.getAttribute("data-story-number")) || Number(d.meta.number) || 1;
    var storyCount = Number(this.root.getAttribute("data-story-count")) || 100;
    var currentNumberText = String(storyNumber).padStart(3, "0");
    if (this.elements.headerTitle) this.elements.headerTitle.textContent = currentNumberText + "/" + storyCount;
    if (this.elements.seriesCurrent) this.elements.seriesCurrent.textContent = "TimeStory " + currentNumberText + "/" + storyCount;

    if (this.elements.seriesPrev) {
      var prevNumber = Number(this.root.getAttribute("data-prev-story-number"));
      var prevTitle = this.root.getAttribute("data-prev-story-title") || "";
      var prevUrl = this.getSeriesDirectionUrl ? this.getSeriesDirectionUrl("previous") : (this.root.getAttribute("data-prev-story-url") || "");
      if (prevNumber > 0 && prevTitle) {
        this.elements.seriesPrev.textContent = "← 이전 이야기 · " + String(prevNumber).padStart(3, "0") + " " + prevTitle;
        this.elements.seriesPrev.classList.remove("ts100-hidden");
        if (prevUrl) {
          this.elements.seriesPrev.href = prevUrl;
          this.elements.seriesPrev.removeAttribute("aria-disabled");
        } else {
          this.elements.seriesPrev.removeAttribute("href");
          this.elements.seriesPrev.setAttribute("aria-disabled", "true");
        }
      } else {
        this.elements.seriesPrev.classList.add("ts100-hidden");
      }
    }

    var nextNumber = Number(this.root.getAttribute("data-next-story-number")) || storyNumber + 1;
    var nextTitle = this.root.getAttribute("data-next-story-title") || "다음 이야기";
    var nextHanja = this.root.getAttribute("data-next-story-hanja") || "";
    var nextSubtitle = this.root.getAttribute("data-next-story-subtitle") || "다음 네 글자의 이야기를 이어서 만나보세요.";
    var nextUrl = (this.getSeriesDirectionUrl ? this.getSeriesDirectionUrl("next") : "") || (d.links && d.links.next && (d.links.next.url || d.links.next)) || "";
    if (this.elements.seriesNext) {
      this.elements.seriesNext.textContent = "다음 이야기 · " + String(nextNumber).padStart(3, "0") + " " + nextTitle + " →";
      if (nextUrl && typeof nextUrl === "string") {
        this.elements.seriesNext.href = nextUrl;
        this.elements.seriesNext.removeAttribute("aria-disabled");
      } else {
        this.elements.seriesNext.removeAttribute("href");
        this.elements.seriesNext.setAttribute("aria-disabled", "true");
      }
    }
    if (this.elements.nextStoryKicker) this.elements.nextStoryKicker.textContent = "다음 이야기 · " + String(nextNumber).padStart(3, "0");
    if (this.elements.nextStoryHanja) this.elements.nextStoryHanja.textContent = nextHanja;
    if (this.elements.nextStoryTitle) this.elements.nextStoryTitle.textContent = nextTitle;
    if (this.elements.nextStorySubtitle) this.elements.nextStorySubtitle.textContent = nextSubtitle;
    if (this.elements.nextStoryLink) {
      if (nextUrl && typeof nextUrl === "string") {
        this.elements.nextStoryLink.href = nextUrl;
        this.elements.nextStoryLink.removeAttribute("aria-disabled");
        this.elements.nextStoryLink.setAttribute("aria-label", String(nextNumber).padStart(3, "0") + " " + nextTitle + " 이야기로 이동");
      } else {
        this.elements.nextStoryLink.removeAttribute("href");
        this.elements.nextStoryLink.setAttribute("aria-disabled", "true");
        this.elements.nextStoryLink.setAttribute("aria-label", nextTitle + " 이야기는 아직 연결되지 않았습니다.");
      }
    }
    this.elements.heroHanja.textContent = d.meta.hanja;
    this.elements.heroTitle.textContent = d.meta.title;
    this.elements.heroSubtitle.textContent = this.root.getAttribute("data-hero-subtitle") || d.meta.subtitle;
    var sourcePresentation = this.getSourcePresentation();
    this.elements.sourceStatus.textContent = sourcePresentation.label;
    this.elements.sourceStatus.classList.remove("is-source-a", "is-source-b", "is-source-c");
    this.elements.sourceStatus.classList.add(sourcePresentation.className);
    if (this.elements.sourceNote) this.elements.sourceNote.textContent = sourcePresentation.note;
    this.elements.audiobookTitle.textContent = "전체 이야기 오디오 듣기 | " + d.meta.title;
    this.elements.revealHanja.textContent = d.meta.hanja;
    this.elements.meaningTitle.textContent = d.meta.title + "의 뜻";
    this.elements.meaningSummary.textContent = d.meaning.summary;
    this.elements.editorialTitle.textContent = d.editorial.title;
    this.elements.editorialBody.textContent = d.editorial.body;
    this.elements.editorialQuestion.textContent = d.editorial.question;
    this.elements.reflectionQuestion.textContent = d.reflection.question;
    this.elements.reflectionInput.placeholder = d.reflection.placeholder;
    this.elements.mottoHanja.textContent = d.meta.hanja;
    this.elements.mottoInput.value = d.motto.defaultText;
    this.elements.meditationHanja.textContent = d.meta.hanja;
    this.elements.meditationQuestion.textContent = d.meditation.question;
    if (this.elements.wisdomCategory) this.elements.wisdomCategory.textContent = d.meta.categoryLabel || "자립과 생존";
    if (this.elements.wisdomFlow) this.elements.wisdomFlow.textContent = d.meta.emotionFlow || "막막함 → 주도성";

    this.elements.meaningGrid.innerHTML = "";
    d.meaning.characters.forEach(function (item) {
      var box = createEl("div", "ts100-meaning-item");
      var ch = createEl("span", "ts100-meaning-char", item.char || "");
      var reading = createEl("span", "ts100-meaning-reading", item.reading || "");
      var desc = createEl("span", "ts100-meaning-desc", item.meaning || "");
      box.appendChild(ch);
      box.appendChild(reading);
      box.appendChild(desc);
      this.elements.meaningGrid.appendChild(box);
    }, this);

    qsa(this.root, "[data-module]").forEach(function (moduleEl) {
      var key = moduleEl.getAttribute("data-module");
      moduleEl.classList.toggle("ts100-hidden", this.data.modules[key] === false);
    }, this);

    var reflectionSection = qs(this.root, '[data-section="reflection"]');
    if (reflectionSection) {
      reflectionSection.classList.toggle("ts100-hidden", this.data.modules.reflection === false);
    }
    var transcriptSection = qs(this.root, '[data-section="transcript"]');
    if (transcriptSection) {
      transcriptSection.classList.toggle("ts100-hidden", this.data.modules.transcript === false);
    }
    var relatedSection = qs(this.root, '[data-section="related"]');
    if (relatedSection) {
      relatedSection.classList.toggle("ts100-hidden", this.data.related.length === 0);
    }

    if (d.audioBook.src) {
      this.fullAudio.src = d.audioBook.src;
    } else {
      this.elements.fullAudioStatus.textContent = "전체 오디오 파일이 아직 연결되지 않았습니다.";
    }

    if (d.meditation.audio) {
      this.meditationAudio.src = d.meditation.audio;
      this.meditationAudio.loop = true;
      this.meditationAudio.load();
      if (this.elements.meditationStatus) this.elements.meditationStatus.textContent = "";
      this.meditationAudio.addEventListener("error", function () {
        if (this.elements.meditationStatus) {
          this.elements.meditationStatus.textContent = "사색 음악 파일을 불러오지 못했습니다. 공통 음악 경로를 확인해주세요.";
        }
      }.bind(this));
    } else if (this.elements.meditationStatus) {
      this.elements.meditationStatus.textContent = "사색 음악 파일이 아직 연결되지 않았습니다.";
    }
  };

  TS100StoryExperience.prototype.getSourcePresentation = function () {
    var d = this.data || {};
    var sourceType = String((d.source && d.source.type) || this.root.getAttribute("data-source-type") || "").toUpperCase();
    var originType = String((d.storyOrigin && d.storyOrigin.type) || this.root.getAttribute("data-story-origin") || "").toLowerCase();
    var metaText = String((d.meta && (d.meta.sourceStatus || d.meta.sourceLabel)) || "");
    if (originType === "source-retelling" || sourceType === "A") {
      return {
        label: "실제 고사 기반",
        className: "is-source-a",
        note: "전해지는 고사와 문헌을 바탕으로 TimeStory 형식에 맞게 재구성했습니다."
      };
    }
    if (originType === "classical-adaptation" || sourceType === "B") {
      return {
        label: "고전 문구 재구성",
        className: "is-source-b",
        note: "고전의 문구와 사상을 토대로 현대적으로 각색한 이야기입니다."
      };
    }
    if (originType === "creative-fable" || sourceType === "C" || /창작|우화|관용/.test(metaText)) {
      return {
        label: "TimeStory 창작 우화",
        className: "is-source-c",
        note: "사자성어의 뜻과 검증된 사용 맥락을 토대로 새롭게 만든 이야기입니다."
      };
    }
    return {
      label: (d.meta && (d.meta.sourceStatus || d.meta.sourceLabel)) || "TimeStory 인문 이야기",
      className: "is-source-b",
      note: "사자성어의 의미를 한 편의 이야기와 오늘의 삶에 연결했습니다."
    };
  };



  /* TimeStory Series Auto Navigator v1.0 */
  TS100StoryExperience.prototype.normalizeSeriesUrl = function (value) {
    if (!value || typeof value !== "string") return "";
    var fullUrl = value.trim();
    if (!/^https?:\/\//i.test(fullUrl)) return "";
    try { return new URL(fullUrl).href; } catch (e) { return ""; }
  };

  TS100StoryExperience.prototype.getSeriesDirectionUrl = function (direction) {
    var prefix = direction === "previous" ? "prev" : "next";
    if (this.root.getAttribute("data-" + prefix + "-story-enabled") === "false") return "";
    var direct = this.root.getAttribute("data-" + prefix + "-story-url") || "";
    return this.normalizeSeriesUrl(direct);
  };

  TS100StoryExperience.prototype.refreshSeriesNavigation = function () {
    var currentNumber = Number(this.data.meta.number) || Number(this.root.getAttribute("data-story-number")) || 1;
    var storyCount = Number(this.root.getAttribute("data-story-count")) || 100;
    if (this.elements.seriesCurrent) {
      this.elements.seriesCurrent.textContent = "TimeStory " + String(currentNumber).padStart(3, "0") + "/" + storyCount;
    }
    if (this.elements.headerTitle) this.elements.headerTitle.textContent = String(currentNumber).padStart(3, "0") + "/" + storyCount;

    var prevNumber = Number(this.root.getAttribute("data-prev-story-number"));
    var prevTitle = this.root.getAttribute("data-prev-story-title") || "";
    var prevUrl = this.getSeriesDirectionUrl("previous");
    if (this.elements.seriesPrev) {
      if (prevNumber > 0 && prevTitle) {
        this.elements.seriesPrev.textContent = "← 이전 이야기 · " + String(prevNumber).padStart(3, "0") + " " + prevTitle;
        this.elements.seriesPrev.classList.remove("ts100-hidden");
        if (prevUrl) {
          this.elements.seriesPrev.href = prevUrl;
          this.elements.seriesPrev.removeAttribute("aria-disabled");
        } else {
          this.elements.seriesPrev.removeAttribute("href");
          this.elements.seriesPrev.setAttribute("aria-disabled", "true");
        }
      } else {
        this.elements.seriesPrev.classList.add("ts100-hidden");
      }
    }

    var nextNumber = Number(this.root.getAttribute("data-next-story-number")) || currentNumber + 1;
    var nextTitle = this.root.getAttribute("data-next-story-title") || "다음 이야기";
    var nextHanja = this.root.getAttribute("data-next-story-hanja") || "";
    var nextSubtitle = this.root.getAttribute("data-next-story-subtitle") || "다음 네 글자의 이야기를 이어서 만나보세요.";
    var nextUrl = this.getSeriesDirectionUrl("next");
    if (this.elements.seriesNext) {
      this.elements.seriesNext.textContent = "다음 이야기 · " + String(nextNumber).padStart(3, "0") + " " + nextTitle + " →";
      if (nextUrl) {
        this.elements.seriesNext.href = nextUrl;
        this.elements.seriesNext.removeAttribute("aria-disabled");
      } else {
        this.elements.seriesNext.removeAttribute("href");
        this.elements.seriesNext.setAttribute("aria-disabled", "true");
      }
    }
    if (this.elements.nextStoryKicker) this.elements.nextStoryKicker.textContent = "다음 이야기 · " + String(nextNumber).padStart(3, "0");
    if (this.elements.nextStoryHanja) this.elements.nextStoryHanja.textContent = nextHanja;
    if (this.elements.nextStoryTitle) this.elements.nextStoryTitle.textContent = nextTitle;
    if (this.elements.nextStorySubtitle) this.elements.nextStorySubtitle.textContent = nextSubtitle;
    if (this.elements.nextStoryLink) {
      if (nextUrl) {
        this.elements.nextStoryLink.href = nextUrl;
        this.elements.nextStoryLink.removeAttribute("aria-disabled");
        this.elements.nextStoryLink.setAttribute("aria-label", String(nextNumber).padStart(3, "0") + " " + nextTitle + " 이야기로 이동");
      } else {
        this.elements.nextStoryLink.removeAttribute("href");
        this.elements.nextStoryLink.setAttribute("aria-disabled", "true");
        this.elements.nextStoryLink.setAttribute("aria-label", nextTitle + " 이야기는 아직 연결되지 않았습니다.");
      }
    }
    this.seriesNextResolvedUrl = nextUrl;
  };

  TS100StoryExperience.prototype.applySeriesIndexItem = function (direction, item) {
    if (!item) return;
    var prefix = direction === "previous" ? "prev" : "next";
    if (item.number != null) this.root.setAttribute("data-" + prefix + "-story-number", String(item.number));
    if (item.title) this.root.setAttribute("data-" + prefix + "-story-title", item.title);
    if (item.hanja) this.root.setAttribute("data-" + prefix + "-story-hanja", item.hanja);
    if (item.subtitle) this.root.setAttribute("data-" + prefix + "-story-subtitle", item.subtitle);
    if (item.question) this.root.setAttribute("data-" + prefix + "-story-question", item.question);
    if (item.slug) this.root.setAttribute("data-" + prefix + "-story-slug", item.slug);
    this.root.setAttribute("data-" + prefix + "-story-enabled", item.enabled === false ? "false" : "true");
    this.root.setAttribute("data-" + prefix + "-story-url", item.url || "");
  };

  TS100StoryExperience.prototype.initSeriesNavigation = function () {
    var self = this;
    this.refreshSeriesNavigation();
    var indexUrl = this.root.getAttribute("data-series-index-url") || "";
    if (!indexUrl) return;
    fetch(indexUrl, { credentials: "omit", cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("series index " + response.status);
        return response.json();
      })
      .then(function (catalog) {
        var items = Array.isArray(catalog) ? catalog : (Array.isArray(catalog.items) ? catalog.items : []);
        items = items.filter(function (item) { return !!item; });
        if (!items.length) return;
        var number = Number(self.data.meta.number) || Number(self.root.getAttribute("data-story-number")) || 1;
        var slug = self.root.getAttribute("data-story-slug") || self.data.id || "";
        var index = items.findIndex(function (item) {
          return Number(item.number) === number || (slug && (item.slug === slug || item.id === slug));
        });
        if (index < 0) return;
        self.applySeriesIndexItem("previous", items[index - 1]);
        self.applySeriesIndexItem("next", items[index + 1]);
        self.refreshSeriesNavigation();
        if (typeof self.renderRelated === "function") self.renderRelated();
      })
      .catch(function () {
        self.refreshSeriesNavigation();
      });
  };

  TS100StoryExperience.prototype.ensureSeriesAutoNextPanel = function () {
    if (this.seriesAutoNextPanel && this.seriesAutoNextPanel.isConnected) return this.seriesAutoNextPanel;
    var panel = document.createElement("section");
    panel.className = "ts100-series-auto-next";
    panel.setAttribute("role", "status");
    panel.setAttribute("aria-live", "polite");
    panel.setAttribute("data-nosnippet", "");

    var title = document.createElement("p");
    title.className = "ts100-series-auto-next-title";
    var desc = document.createElement("p");
    desc.className = "ts100-series-auto-next-desc";
    var actions = document.createElement("div");
    actions.className = "ts100-series-auto-next-actions";
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "ts100-series-auto-next-cancel";
    cancel.textContent = "여기에서 멈추기";
    var go = document.createElement("button");
    go.type = "button";
    go.className = "ts100-series-auto-next-go";
    go.textContent = "지금 다음 이야기";
    actions.appendChild(cancel);
    actions.appendChild(go);
    panel.appendChild(title);
    panel.appendChild(desc);
    panel.appendChild(actions);
    document.body.appendChild(panel);

    var self = this;
    cancel.addEventListener("click", function () { self.cancelNextStoryNavigation(true); });
    go.addEventListener("click", function () { self.goToNextStoryPage(); });
    this.seriesAutoNextPanel = panel;
    this.seriesAutoNextTitle = title;
    this.seriesAutoNextDesc = desc;
    return panel;
  };

  TS100StoryExperience.prototype.cancelNextStoryNavigation = function (byUser) {
    window.clearInterval(this.seriesAutoNextInterval);
    window.clearTimeout(this.seriesAutoNextTimer);
    this.seriesAutoNextInterval = null;
    this.seriesAutoNextTimer = null;
    if (byUser) this.seriesAutoNextCancelled = true;
    if (this.seriesAutoNextPanel) this.seriesAutoNextPanel.classList.remove("is-visible");
  };

  TS100StoryExperience.prototype.buildNextStoryNavigationUrl = function () {
    var nextUrl = this.seriesNextResolvedUrl || this.getSeriesDirectionUrl("next");
    if (!nextUrl) return "";
    try {
      var target = new URL(nextUrl, window.location.href);
      target.searchParams.set("ts100_autoplay", "1");
      target.searchParams.set("ts100_mode", this.currentMode === "auto" ? "auto" : "audio");
      return target.href;
    } catch (e) {
      return nextUrl;
    }
  };

  TS100StoryExperience.prototype.goToNextStoryPage = function () {
    var target = this.buildNextStoryNavigationUrl();
    if (!target) return;
    this.cancelNextStoryNavigation(false);
    window.location.assign(target);
  };

  TS100StoryExperience.prototype.scheduleNextStoryNavigation = function () {
    var autoEnabled = this.root.getAttribute("data-series-auto-next") !== "false";
    if (!autoEnabled || this.seriesAutoNextCancelled) return;
    var nextUrl = this.seriesNextResolvedUrl || this.getSeriesDirectionUrl("next");
    if (!nextUrl) return;
    var delay = Math.max(3, Number(this.root.getAttribute("data-series-auto-next-delay")) || 7);
    var remaining = delay;
    var nextNumber = Number(this.root.getAttribute("data-next-story-number")) || 0;
    var nextTitle = this.root.getAttribute("data-next-story-title") || "다음 이야기";
    var panel = this.ensureSeriesAutoNextPanel();
    this.seriesAutoNextTitle.textContent = "다음 " + String(nextNumber).padStart(3, "0") + " · " + nextTitle + "로 이어집니다.";
    this.seriesAutoNextDesc.textContent = remaining + "초 뒤 자동으로 이동합니다. 계속 듣기 설정은 다음 페이지에도 유지됩니다.";
    panel.classList.add("is-visible");

    var self = this;
    window.clearInterval(this.seriesAutoNextInterval);
    window.clearTimeout(this.seriesAutoNextTimer);
    this.seriesAutoNextInterval = window.setInterval(function () {
      remaining -= 1;
      if (remaining > 0 && self.seriesAutoNextDesc) {
        self.seriesAutoNextDesc.textContent = remaining + "초 뒤 자동으로 이동합니다. 계속 듣기 설정은 다음 페이지에도 유지됩니다.";
      }
    }, 1000);
    this.seriesAutoNextTimer = window.setTimeout(function () { self.goToNextStoryPage(); }, delay * 1000);
  };

  TS100StoryExperience.prototype.resumeSeriesPlaybackIfRequested = function () {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
    if (params.get("ts100_autoplay") !== "1") return;
    var mode = params.get("ts100_mode") === "auto" ? "auto" : "audio";
    try {
      var clean = new URL(window.location.href);
      clean.searchParams.delete("ts100_autoplay");
      clean.searchParams.delete("ts100_mode");
      window.history.replaceState(null, "", clean.pathname + clean.search + clean.hash);
    } catch (e) {}
    var self = this;
    window.setTimeout(function () {
      self.setMode(mode);
      if (self.fullAudio.paused) {
        var playPromise = self.fullAudio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function () {
            if (self.elements.fullAudioStatus) self.elements.fullAudioStatus.textContent = "다음 이야기가 열렸습니다. 재생 버튼을 한 번 눌러주세요.";
            if (self.elements.modeStatus) self.elements.modeStatus.textContent = "브라우저의 자동 재생 제한으로 재생 버튼을 눌러야 할 수 있습니다.";
          });
        }
      }
    }, 650);
  };

  TS100StoryExperience.prototype.initAudioSeries = function () {
    var self = this;
    try {
      var savedContinuousAudio = localStorage.getItem("ts100_continuous_audio_v1");
      if (savedContinuousAudio == null) {
        this.continuousAudio = this.root.getAttribute("data-continuous-audio-default") !== "false";
      } else {
        this.continuousAudio = savedContinuousAudio === "1";
      }
    } catch (e) {
      this.continuousAudio = this.root.getAttribute("data-continuous-audio-default") !== "false";
    }
    if (this.elements.continuousAudio) this.elements.continuousAudio.checked = this.continuousAudio;

    var currentNumber = Number(this.data.meta.number) || Number(this.root.getAttribute("data-story-number")) || 1;
    var currentItem = {
      number: currentNumber,
      id: this.data.id,
      slug: this.data.id,
      title: this.data.meta.title,
      hanja: this.data.meta.hanja,
      category: this.data.meta.categoryLabel || "",
      audio: this.data.audioBook.src || "",
      storyJson: this.root.getAttribute("data-story-url") || "",
      url: window.location.href,
      isCurrentPage: true
    };
    var inlineItems = (this.data.audioSeries && this.data.audioSeries.items) || [];
    this.audioSeriesItems = inlineItems.length ? inlineItems.slice() : [currentItem];
    if (!this.audioSeriesItems.some(function (item) { return Number(item.number) === currentNumber; })) {
      this.audioSeriesItems.unshift(currentItem);
    }
    this.audioSeriesIndex = Math.max(0, this.audioSeriesItems.findIndex(function (item) { return Number(item.number) === currentNumber; }));
    this.currentAudioItem = this.audioSeriesItems[this.audioSeriesIndex] || currentItem;

    var catalogUrl = this.root.getAttribute("data-audio-catalog-url") || (this.data.audioSeries && this.data.audioSeries.catalogUrl) || "";
    if (!catalogUrl) {
      this.audioSeriesReady = this.audioSeriesItems.length > 1;
      this.updateAudioSeriesControls();
      return;
    }

    fetch(catalogUrl, { credentials: "omit", cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("audio catalog " + response.status);
        return response.json();
      })
      .then(function (catalog) {
        var items = Array.isArray(catalog) ? catalog : (Array.isArray(catalog.items) ? catalog.items : []);
        items = items.filter(function (item) { return item && item.enabled !== false && (item.audio || item.storyJson); });
        if (!items.length) throw new Error("empty audio catalog");
        self.audioSeriesItems = items;
        self.audioSeriesIndex = Math.max(0, items.findIndex(function (item) {
          return Number(item.number) === currentNumber || item.id === self.data.id || item.slug === self.data.id;
        }));
        self.currentAudioItem = items[self.audioSeriesIndex] || currentItem;
        if (self.currentAudioItem && Number(self.currentAudioItem.number) === currentNumber) self.currentAudioItem.isCurrentPage = true;
        self.audioSeriesReady = items.length > 1;
        self.updateAudioSeriesControls();
      })
      .catch(function () {
        self.audioSeriesReady = false;
        self.updateAudioSeriesControls("오디오 카탈로그를 불러오지 못했습니다. 현재 이야기만 들을 수 있습니다.");
      });
  };

  TS100StoryExperience.prototype.navigateSeriesFromAudio = function (direction) {
    var url = this.getSeriesDirectionUrl(direction);
    if (!url) return;
    try {
      var target = new URL(url, window.location.href);
      if (this.continuousAudio) {
        target.searchParams.set("ts100_autoplay", "1");
        target.searchParams.set("ts100_mode", "audio");
      }
      window.location.href = target.href;
    } catch (e) {
      window.location.href = url;
    }
  };

  TS100StoryExperience.prototype.updateAudioSeriesControls = function (message) {
    var prevUrl = this.getSeriesDirectionUrl("previous");
    var nextUrl = this.getSeriesDirectionUrl("next");
    var prevNumber = Number(this.root.getAttribute("data-prev-story-number")) || 0;
    var nextNumber = Number(this.root.getAttribute("data-next-story-number")) || 0;
    var prevTitle = this.root.getAttribute("data-prev-story-title") || "이전 이야기";
    var nextTitle = this.root.getAttribute("data-next-story-title") || "다음 이야기";

    if (this.elements.continuousAudio) {
      this.elements.continuousAudio.disabled = !nextUrl;
      this.elements.continuousAudio.checked = !!this.continuousAudio;
    }
    if (this.elements.audioPrevStory) {
      this.elements.audioPrevStory.disabled = !prevUrl;
      this.elements.audioPrevStory.textContent = prevUrl && prevNumber
        ? "이전 " + String(prevNumber).padStart(3, "0") + " · " + prevTitle
        : "이전 이야기";
    }
    if (this.elements.audioNextStory) {
      this.elements.audioNextStory.disabled = !nextUrl;
      this.elements.audioNextStory.textContent = nextUrl && nextNumber
        ? "다음 " + String(nextNumber).padStart(3, "0") + " · " + nextTitle
        : "다음 이야기";
    }
    if (!this.elements.audioSeriesStatus) return;
    if (message) {
      this.elements.audioSeriesStatus.textContent = message;
      return;
    }
    if (nextUrl) {
      this.elements.audioSeriesStatus.textContent = this.continuousAudio
        ? "연속 듣기 켜짐 · 오디오가 끝나면 " + String(nextNumber).padStart(3, "0") + " · " + nextTitle + "로 이어집니다."
        : "연속 듣기 꺼짐 · 다음 이야기 버튼으로 " + String(nextNumber).padStart(3, "0") + " · " + nextTitle + "을 열 수 있습니다.";
    } else {
      this.elements.audioSeriesStatus.textContent = "연결된 다음 이야기가 없습니다.";
    }
  };

  TS100StoryExperience.prototype.resolveAudioSeriesItem = function (item) {
    var self = this;
    if (!item) return Promise.reject(new Error("missing audio item"));
    if (item.audio) return Promise.resolve(item);
    if (!item.storyJson) return Promise.reject(new Error("missing story json"));
    return fetch(item.storyJson, { credentials: "omit", cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("story json " + response.status);
        return response.json();
      })
      .then(function (data) {
        resolveStoryAssetPaths(data, item.storyJson);
        item.audio = data.audioBook && data.audioBook.src || "";
        item.title = item.title || data.meta && data.meta.title || "이야기";
        item.hanja = item.hanja || data.meta && data.meta.hanja || "";
        item.category = item.category || data.meta && data.meta.categoryLabel || "";
        item.id = item.id || data.id || item.slug || "";
        if (!item.audio) throw new Error("missing audio src");
        return item;
      });
  };

  TS100StoryExperience.prototype.playAudioSeriesAt = function (index, autoplay) {
    if (!this.audioSeriesReady || index < 0 || index >= this.audioSeriesItems.length) return;
    var self = this;
    var item = this.audioSeriesItems[index];
    this.updateAudioSeriesControls("다음 이야기 오디오를 준비하고 있습니다.");
    this.resolveAudioSeriesItem(item).then(function (resolved) {
      self.audioSeriesIndex = index;
      resolved.isCurrentPage = Number(resolved.number) === (Number(self.data.meta.number) || Number(self.root.getAttribute("data-story-number")) || 1);
      self.currentAudioItem = resolved;
      self.fullAudio.pause();
      self.fullAudio.src = resolved.audio;
      self.fullAudio.load();
      if (self.elements.audiobookTitle) {
        self.elements.audiobookTitle.textContent = "전체 이야기 오디오 듣기 | " + String(resolved.number || index + 1).padStart(3, "0") + " · " + (resolved.title || "이야기");
      }
      self.updateAudioSeriesControls();
      if (autoplay) {
        var p = self.fullAudio.play();
        if (p && typeof p.catch === "function") p.catch(function () {
          self.updateAudioSeriesControls("다음 이야기 재생 버튼을 한 번 눌러주세요.");
        });
      }
    }).catch(function () {
      self.updateAudioSeriesControls("다음 이야기 오디오가 아직 연결되지 않았습니다.");
    });
  };

  TS100StoryExperience.prototype.markAudioSeriesItemCompleted = function (item) {
    if (!item) return;
    var storyId = item.id || item.slug || ("story-" + item.number);
    var progress = this.getWisdomProgress();
    if (!progress.stories || typeof progress.stories !== "object") progress.stories = {};
    if (!progress.stories[storyId]) {
      var completedItem = {
        number: Number(item.number) || 0,
        completedAt: new Date().toISOString(),
        title: item.title || "이야기",
        hanja: item.hanja || "",
        category: item.category || "",
        storyUrl: item.url || "",
        favorite: false
      };
      progress.stories[storyId] = completedItem;
      try {
        var serialized = JSON.stringify(progress);
        localStorage.setItem(TS100_PROGRESS_KEY, serialized);
        localStorage.setItem(TS100_PROGRESS_BACKUP_KEY, serialized);
      } catch (e) {}
      this.appendProgressJournal(storyId, completedItem);
    }
    this.renderWisdomSummary();
  };

  TS100StoryExperience.prototype.tryPlayNextAudioStory = function () {
    if (!this.continuousAudio || !this.audioSeriesReady) return;
    if (this.audioSeriesIndex >= this.audioSeriesItems.length - 1) {
      this.updateAudioSeriesControls("연결된 마지막 이야기까지 들었습니다.");
      return;
    }
    this.playAudioSeriesAt(this.audioSeriesIndex + 1, true);
  };

  TS100StoryExperience.prototype.preloadStoryImages = function () {
    var self = this;
    var urls = this.data.pages.map(function (page) { return page && page.image; }).filter(Boolean);
    function loadOne(url) {
      if (!url || self.preloadedImages[url]) return;
      var record = { image: new Image(), status: "loading" };
      record.image.decoding = "async";
      record.image.onload = function () { record.status = record.image.naturalWidth > 0 ? "loaded" : "error"; };
      record.image.onerror = function () { record.status = "error"; };
      record.image.src = url;
      self.preloadedImages[url] = record;
    }
    urls.slice(0, 4).forEach(loadOne);
    var loadRest = function () { urls.slice(4).forEach(loadOne); };
    if ("requestIdleCallback" in window) window.requestIdleCallback(loadRest, { timeout: 1800 });
    else window.setTimeout(loadRest, 500);
  };

  TS100StoryExperience.prototype.cancelImageAnimations = function (imageEl) {
    if (!imageEl || typeof imageEl.getAnimations !== "function") return;
    imageEl.getAnimations().forEach(function (animation) {
      try { animation.cancel(); } catch (e) {}
    });
  };

  TS100StoryExperience.prototype.hasRenderableImage = function (imageEl) {
    return !!(imageEl && imageEl.getAttribute("src") && imageEl.complete && imageEl.naturalWidth > 0);
  };

  TS100StoryExperience.prototype.settleVisibleImageLayer = function () {
    var imageEl = this.elements.pageImage;
    if (!this.hasRenderableImage(imageEl) || imageEl.classList.contains("ts100-hidden")) return null;
    imageEl.classList.add("is-active");
    imageEl.style.opacity = "1";
    imageEl.style.zIndex = "2";
    imageEl.setAttribute("aria-hidden", "false");
    this.activeImageLayer = 0;
    this.elements.pageImageA = imageEl;
    this.elements.pageImageB = null;
    this.elements.pageImages = [imageEl];
    return imageEl;
  };

  TS100StoryExperience.prototype.getStoryImageCandidates = function (src, index) {
    var list = [];
    var base = this.root.getAttribute("data-story-base") || "";
    var number = String(Number(index) + 1).padStart(2, "0") + ".webp";
    function add(url) {
      var value = safeText(url).trim();
      if (value && list.indexOf(value) < 0) list.push(value);
    }

    add(src);
    if (base) {
      var assetVersion = this.root.getAttribute("data-asset-version") || "";
      try {
        var canonical = appendAssetVersion(new URL("images/watermarked/" + number, base).href, assetVersion);
        add(canonical);
        add(canonical + (canonical.indexOf("?") >= 0 ? "&" : "?") + "ts100_retry=1");
      } catch (e) {}
      try { add(appendAssetVersion(new URL("images/" + number, base).href, assetVersion)); } catch (e) {}
    }
    return list;
  };

  TS100StoryExperience.prototype.loadStoryImage = function (candidates, token, done, failed) {
    var self = this;
    var cursor = 0;

    function attempt() {
      if (token !== self.imageTransitionToken) return;
      if (cursor >= candidates.length) {
        failed();
        return;
      }

      var url = candidates[cursor++];
      var img = new Image();
      var settled = false;
      img.decoding = "async";
      if (cursor === 1 && "fetchPriority" in img) img.fetchPriority = "high";

      function cleanup() {
        img.onload = null;
        img.onerror = null;
      }
      function success() {
        if (settled || token !== self.imageTransitionToken) return;
        if (!img.naturalWidth) {
          error();
          return;
        }
        settled = true;
        cleanup();
        self.preloadedImages[url] = { image: img, status: "loaded" };
        done(url, img);
      }
      function error() {
        if (settled || token !== self.imageTransitionToken) return;
        settled = true;
        cleanup();
        self.preloadedImages[url] = { image: img, status: "error" };
        attempt();
      }

      img.onload = function () {
        if (img.decode) img.decode().catch(function () {}).then(success);
        else success();
      };
      img.onerror = error;
      img.src = url;

      /* Cached images can complete synchronously before the event loop returns. */
      if (img.complete) {
        if (img.naturalWidth) {
          if (img.decode) img.decode().catch(function () {}).then(success);
          else success();
        } else {
          window.setTimeout(error, 0);
        }
      }
    }

    attempt();
  };

  TS100StoryExperience.prototype.transitionStoryImage = function (src, alt, page, index) {
    var self = this;
    var current = this.elements.pageImage;

    if (!src) {
      ++this.imageTransitionToken;
      this.showImageFallback(true);
      return;
    }

    /* A newer navigation invalidates every older loader callback. */
    var token = ++this.imageTransitionToken;
    this.imageTransitionAnimations.forEach(function (animation) {
      try { animation.cancel(); } catch (e) {}
    });
    this.imageTransitionAnimations = [];

    var currentSrc = current ? (current.currentSrc || current.getAttribute("src") || "") : "";
    if (current && currentSrc === src && this.hasRenderableImage(current)) {
      current.alt = alt || "";
      current.classList.remove("ts100-hidden");
      current.classList.add("is-active");
      current.style.opacity = "1";
      current.style.zIndex = "2";
      current.setAttribute("aria-hidden", "false");
      this.hideImageFallback();
      this.applyPageMotion(page || {}, index, current);
      return;
    }

    /* The text and page number have already moved to the new scene.
       Hide the previous scene immediately so an old image is never shown
       beside the new scene text while the requested image is loading. */
    if (current) {
      this.cancelImageAnimations(current);
      current.classList.add("ts100-hidden");
      current.classList.remove("is-active");
      current.style.opacity = "0";
      current.style.zIndex = "1";
      current.setAttribute("aria-hidden", "true");
    }
    this.elements.pageFallback.classList.remove("ts100-hidden");

    var candidates = this.getStoryImageCandidates(src, index);
    this.loadStoryImage(candidates, token, function (loadedUrl, loadedImage) {
      if (token !== self.imageTransitionToken || !loadedImage || !loadedImage.naturalWidth) return;

      var previous = self.elements.pageImage;
      if (self.imageMotionAnimation) {
        try { self.imageMotionAnimation.cancel(); } catch (e) {}
        self.imageMotionAnimation = null;
      }
      self.cancelImageAnimations(previous);

      /* The loader image is already fully loaded and decoded. Replacing the
         DOM node atomically prevents any frame in which the stage is empty. */
      loadedImage.className = "ts100-story-image ts100-story-image-layer is-active";
      loadedImage.setAttribute("data-bind", "page-image");
      loadedImage.setAttribute("decoding", "async");
      loadedImage.setAttribute("draggable", "false");
      loadedImage.setAttribute("aria-hidden", "false");
      loadedImage.alt = alt || "";
      loadedImage.style.opacity = "1";
      loadedImage.style.zIndex = "2";
      loadedImage.style.transition = "none";
      loadedImage.style.transform = "scale(1.03)";
      loadedImage.style.transformOrigin = self.getMotionOrigin(page || {}, index);
      loadedImage.style.objectPosition = loadedImage.style.transformOrigin;

      loadedImage.addEventListener("error", function () {
        if (loadedImage === self.elements.pageImage) self.showImageFallback(true);
      });

      if (previous && previous.parentNode) {
        previous.parentNode.replaceChild(loadedImage, previous);
      } else {
        var media = qs(self.root, ".ts100-story-media");
        if (media) media.insertBefore(loadedImage, media.firstChild);
      }

      self.elements.pageImage = loadedImage;
      self.elements.pageImageA = loadedImage;
      self.elements.pageImageB = null;
      self.elements.pageImages = [loadedImage];
      self.activeImageLayer = 0;
      self.hideImageFallback();
      self.applyPageMotion(page || {}, index, loadedImage);
    }, function () {
      if (token !== self.imageTransitionToken) return;
      /* Do not restore the previous scene after a failed request. */
      self.showImageFallback(true);
      console.warn("[TimeStory] story image load failed", candidates);
    });
  };

  TS100StoryExperience.prototype.renderPage = function (announce) {
    var total = this.data.pages.length;
    if (total === 0) {
      this.elements.pageText.textContent = "아직 등록된 이야기 페이지가 없습니다.";
      this.elements.pageCount.textContent = "0 / 0";
      this.showImageFallback(true);
      return;
    }

    this.pageIndex = clamp(this.pageIndex, 0, total - 1);
    var page = this.data.pages[this.pageIndex] || {};
    var indexHuman = this.pageIndex + 1;

    this.stopPageAudio(false);
    this.elements.pageText.textContent = page.text || page.narration || "";
    this.elements.pageNote.textContent = page.note || "";
    this.elements.pageCount.textContent = indexHuman + " / " + total;
    if (this.elements.pageProgress) this.elements.pageProgress.style.width = ((indexHuman / total) * 100) + "%";
    this.checkMidpointProgress(indexHuman / total);
    this.elements.fallbackIndex.textContent = String(indexHuman).padStart(2, "0");
    this.elements.fallbackTitle.textContent = page.scene || this.data.meta.title;

    if (this.elements.pageDialogue) {
      var dialogue = page.dialogue || page.quote || "";
      this.elements.pageDialogue.textContent = dialogue;
      this.elements.pageDialogue.classList.toggle("ts100-hidden", !dialogue);
    }

    if (page.image) {
      this.transitionStoryImage(page.image, page.alt || ((page.scene || this.data.meta.title) + " 장면"), page, this.pageIndex);
    } else {
      ++this.imageTransitionToken;
      this.showImageFallback(true);
    }

    this.segmentStart = null;
    this.segmentEnd = null;
    this.segmentCompleted = false;
    var hasTimecode = this.data.audioBook.src && Number.isFinite(page.audioStart) && Number.isFinite(page.audioEnd) && page.audioEnd > page.audioStart;
    if (page.audio) {
      this.pageAudio.src = page.audio;
      this.elements.pageAudioStatus.textContent = "";
      qs(this.root, '[data-action="page-audio"]').disabled = false;
      qs(this.root, '[data-action="restart-page"]').disabled = false;
    } else if (hasTimecode) {
      this.pageAudio.src = this.data.audioBook.src;
      this.segmentStart = Math.max(0, page.audioStart);
      this.segmentEnd = Math.max(this.segmentStart, page.audioEnd);
      this.elements.pageAudioStatus.textContent = "전체 오디오의 이 장면 구간을 재생합니다.";
      qs(this.root, '[data-action="page-audio"]').disabled = false;
      qs(this.root, '[data-action="restart-page"]').disabled = false;
    } else {
      this.pageAudio.removeAttribute("src");
      this.elements.pageAudioStatus.textContent = "이 장면의 오디오 구간이 아직 연결되지 않았습니다.";
      qs(this.root, '[data-action="page-audio"]').disabled = true;
      qs(this.root, '[data-action="restart-page"]').disabled = true;
    }

    qs(this.root, '[data-action="prev-page"]').disabled = this.pageIndex === 0;
    qs(this.root, '[data-action="next-page"]').disabled = this.pageIndex === total - 1;

    try {
      localStorage.setItem(this.storagePrefix + "page", String(this.pageIndex));
    } catch (e) {}

    if (announce) {
      this.elements.modeStatus.textContent = indexHuman + "번째 장면";
    }
  };

  TS100StoryExperience.prototype.showImageFallback = function (force) {
    var imageEl = this.elements.pageImage;
    if (!force && this.hasRenderableImage(imageEl) && !imageEl.classList.contains("ts100-hidden")) {
      this.hideImageFallback();
      return;
    }
    if (imageEl) {
      this.cancelImageAnimations(imageEl);
      imageEl.classList.add("ts100-hidden");
      imageEl.classList.remove("is-active");
      imageEl.style.opacity = "0";
      imageEl.style.zIndex = "1";
      imageEl.setAttribute("aria-hidden", "true");
    }
    this.elements.pageFallback.classList.remove("ts100-hidden");
  };

  TS100StoryExperience.prototype.hideImageFallback = function () {
    var imageEl = this.elements.pageImage;
    if (!this.hasRenderableImage(imageEl)) {
      this.elements.pageFallback.classList.remove("ts100-hidden");
      return;
    }
    imageEl.classList.remove("ts100-hidden");
    imageEl.classList.add("is-active");
    imageEl.style.opacity = "1";
    imageEl.style.zIndex = "2";
    imageEl.setAttribute("aria-hidden", "false");
    this.elements.pageFallback.classList.add("ts100-hidden");
  };

  TS100StoryExperience.prototype.goToPage = function (index, playAfter) {
    if (this.data.pages.length === 0) {
      return;
    }
    var next = clamp(index, 0, this.data.pages.length - 1);
    if (next === this.pageIndex && !playAfter) {
      return;
    }
    this.pageIndex = next;
    this.renderPage(true);
    if (this.pageIndex === this.data.pages.length - 1 && this.currentMode === "story") {
      this.markStoryCompleted();
    }

    if (this.currentMode === "auto") {
      var page = this.data.pages[this.pageIndex] || {};
      if (Number.isFinite(page.audioStart)) {
        try { this.fullAudio.currentTime = Math.max(0, page.audioStart); } catch (e) {}
      }
      if (!this.fullAudio.paused) {
        this.scheduleAutoSync();
      }
      return;
    }

    if (playAfter) {
      this.playPageAudio();
    }
  };

  TS100StoryExperience.prototype.setMode = function (mode) {
    if (["story", "auto", "audio"].indexOf(mode) === -1) {
      mode = "story";
    }

    var previousMode = this.currentMode;
    if (previousMode !== mode) {
      this.stopPageAudio(false);
      if (mode !== "auto") {
        this.autoMode = false;
        this.stopAutoSync();
      }
      if (mode === "story" && !this.fullAudio.paused) {
        this.fullAudio.pause();
      }
    }

    this.currentMode = mode;
    this.applyPageMotion(this.data.pages[this.pageIndex] || {}, this.pageIndex, this.elements.pageImage);
    qsa(this.root, "[data-mode]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-mode") === mode ? "true" : "false");
    });

    var audioMode = mode === "audio";
    this.elements.storyPanel.classList.toggle("ts100-hidden", audioMode);
    this.elements.audioPanel.classList.toggle("ts100-hidden", !audioMode);
    if (this.elements.autoPauseButton) this.elements.autoPauseButton.classList.toggle("ts100-hidden", mode !== "auto");
    if (this.elements.sceneAudioRow) this.elements.sceneAudioRow.classList.toggle("ts100-hidden", mode !== "story");
    if (this.elements.autoTimeline) this.elements.autoTimeline.classList.toggle("ts100-hidden", mode !== "auto");

    if (mode === "auto") {
      this.autoMode = true;
      this.elements.modeStatus.textContent = "자동 슬라이드를 시작합니다.";
      this.startAutoSlide();
    } else if (mode === "story") {
      this.elements.pageAudioLabel.textContent = "이 장면 듣기";
      this.elements.modeStatus.textContent = "직접 읽기";
    } else {
      this.elements.modeStatus.textContent = "오디오만 듣기";
      this.playFullAudioImmediately();
    }
  };

  TS100StoryExperience.prototype.playFullAudioImmediately = function () {
    if (!this.data.audioBook.src) {
      this.elements.fullAudioStatus.textContent = "전체 오디오 파일이 아직 연결되지 않았습니다.";
      return;
    }

    if (this.fullAudio.ended || (Number.isFinite(this.fullAudio.duration) && this.fullAudio.currentTime >= this.fullAudio.duration - 0.05)) {
      try { this.fullAudio.currentTime = 0; } catch (e) {}
    }

    if (!this.fullAudio.paused) {
      return;
    }

    var promise = this.fullAudio.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(function () {
        this.elements.fullAudioStatus.textContent = "오디오를 바로 재생할 수 없습니다. 재생 버튼을 눌러주세요.";
      }.bind(this));
    }
  };

  TS100StoryExperience.prototype.togglePageAudio = function () {
    if (this.currentMode === "auto") {
      if (!this.data.audioBook.src) {
        this.elements.modeStatus.textContent = "전체 오디오가 연결되지 않았습니다.";
        return;
      }
      if (this.fullAudio.paused) {
        this.autoMode = true;
        var promise = this.fullAudio.play();
        if (promise && typeof promise.catch === "function") {
          promise.catch(function () {
            this.elements.modeStatus.textContent = "자동 슬라이드 재생을 시작할 수 없습니다.";
          }.bind(this));
        }
      } else {
        this.fullAudio.pause();
      }
      return;
    }

    if (this.pageAudio.paused) {
      this.playPageAudio();
    } else {
      this.pageAudio.pause();
    }
  };

  TS100StoryExperience.prototype.playPageAudio = function () {
    var page = this.data.pages[this.pageIndex] || {};
    var hasTimecode = this.data.audioBook.src && Number.isFinite(page.audioStart) && Number.isFinite(page.audioEnd) && page.audioEnd > page.audioStart;
    if (!page.audio && !hasTimecode) {
      this.elements.pageAudioStatus.textContent = "이 장면의 오디오 구간이 없습니다.";
      if (this.autoMode) {
        this.stopAuto("오디오 구간이 없어 자동 슬라이드를 시작할 수 없습니다.");
      }
      return;
    }
    this.segmentCompleted = false;
    var startPlayback = function () {
      if (Number.isFinite(this.segmentStart)) {
        var outside = this.pageAudio.currentTime < this.segmentStart - 0.05 || this.pageAudio.currentTime >= this.segmentEnd - 0.04;
        if (outside) {
          try { this.pageAudio.currentTime = this.segmentStart; } catch (e) {}
        }
      }
      var promise = this.pageAudio.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(function () {
          this.elements.pageAudioStatus.textContent = "재생할 수 없습니다. 오디오 주소와 브라우저 권한을 확인하세요.";
          this.stopAuto("오디오 재생을 시작하지 못했습니다.");
        }.bind(this));
      }
    }.bind(this);
    if (Number.isFinite(this.segmentStart) && this.pageAudio.readyState < 1) {
      this.pageAudio.addEventListener("loadedmetadata", startPlayback, { once: true });
      this.pageAudio.load();
    } else {
      startPlayback();
    }
  };

  TS100StoryExperience.prototype.finishPageAudio = function () {
    this.elements.pageAudioLabel.textContent = "이 장면 듣기";
    if (this.autoMode) {
      if (this.pageIndex < this.data.pages.length - 1) {
        this.goToPage(this.pageIndex + 1, true);
      } else {
        this.stopAuto("자동 슬라이드가 끝났습니다.");
      }
    }
  };

  TS100StoryExperience.prototype.stopPageAudio = function (reset) {
    this.pageAudio.pause();
    this.segmentCompleted = false;
    if (reset) {
      try { this.pageAudio.currentTime = Number.isFinite(this.segmentStart) ? this.segmentStart : 0; } catch (e) {}
    }
    this.elements.pageAudioLabel.textContent = "이 장면 듣기";
  };

  TS100StoryExperience.prototype.restartPageAudio = function () {
    if (this.currentMode === "auto") {
      var page = this.data.pages[this.pageIndex] || {};
      if (!this.data.audioBook.src || !Number.isFinite(page.audioStart)) {
        return;
      }
      try { this.fullAudio.currentTime = Math.max(0, page.audioStart); } catch (e) {}
      var p = this.fullAudio.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () {});
      }
      return;
    }

    if (!this.pageAudio.src) {
      return;
    }
    try { this.pageAudio.currentTime = Number.isFinite(this.segmentStart) ? this.segmentStart : 0; } catch (e) {}
    this.segmentCompleted = false;
    this.playPageAudio();
  };

  TS100StoryExperience.prototype.startAutoSlide = function () {
    if (!this.data.audioBook.src) {
      this.elements.modeStatus.textContent = "전체 오디오가 연결되지 않아 자동 슬라이드를 시작할 수 없습니다.";
      return;
    }

    var page = this.data.pages[this.pageIndex] || {};
    var start = Number(page.audioStart);
    var end = Number(page.audioEnd);
    var t = Number(this.fullAudio.currentTime) || 0;
    var insideCurrent = Number.isFinite(start) && Number.isFinite(end) && t >= start && t < end;

    if (!insideCurrent && Number.isFinite(start)) {
      try { this.fullAudio.currentTime = Math.max(0, start); } catch (e) {}
    }

    this.syncAutoSlideFromFullAudio(true);
    var promise = this.fullAudio.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(function () {
        this.elements.modeStatus.textContent = "자동 슬라이드 재생을 시작할 수 없습니다. 재생 버튼을 한 번 눌러주세요.";
        this.elements.pageAudioLabel.textContent = "재생";
      }.bind(this));
    }
  };

  TS100StoryExperience.prototype.syncAutoSlideFromFullAudio = function (force) {
    if (this.currentMode !== "auto" || !this.data.pages.length) {
      return;
    }

    var t = Number(this.fullAudio.currentTime) || 0;
    var pages = this.data.pages;
    var nextIndex = 0;
    for (var i = 0; i < pages.length; i += 1) {
      var start = Number(pages[i].audioStart);
      if (Number.isFinite(start) && t + 0.015 >= start) {
        nextIndex = i;
      } else if (Number.isFinite(start)) {
        break;
      }
    }

    if (force || nextIndex !== this.pageIndex) {
      this.pageIndex = nextIndex;
      this.renderPage(false);
    }

    this.elements.modeStatus.textContent = (this.fullAudio.paused ? "일시정지" : "자동 재생 중") + " | " + (this.pageIndex + 1) + " / " + pages.length;
    this.elements.pageAudioLabel.textContent = this.fullAudio.paused ? "재생" : "일시정지";
    if (this.elements.autoPauseLabel) this.elements.autoPauseLabel.textContent = this.fullAudio.paused ? "계속" : "일시정지";
  };

  TS100StoryExperience.prototype.scheduleAutoSync = function () {
    this.stopAutoSync();
    if (this.currentMode !== "auto") {
      return;
    }
    var self = this;
    function tick() {
      if (self.currentMode !== "auto" || self.fullAudio.paused || self.fullAudio.ended) {
        self.autoSyncFrame = 0;
        return;
      }
      self.syncAutoSlideFromFullAudio(false);
      self.autoSyncFrame = window.requestAnimationFrame(tick);
    }
    this.autoSyncFrame = window.requestAnimationFrame(tick);
  };

  TS100StoryExperience.prototype.stopAutoSync = function () {
    if (this.autoSyncFrame) {
      window.cancelAnimationFrame(this.autoSyncFrame);
      this.autoSyncFrame = 0;
    }
  };

  TS100StoryExperience.prototype.stopAuto = function (message) {
    this.autoMode = false;
    this.stopAutoSync();
    this.elements.modeStatus.textContent = message || "자동 슬라이드가 멈췄습니다.";
  };

  TS100StoryExperience.prototype.toggleFullAudio = function () {
    if (!this.data.audioBook.src) {
      this.elements.fullAudioStatus.textContent = "전체 오디오 파일이 아직 연결되지 않았습니다.";
      return;
    }
    if (this.fullAudio.paused) {
      var promise = this.fullAudio.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(function () {
          this.elements.fullAudioStatus.textContent = "전체 오디오를 재생할 수 없습니다.";
        }.bind(this));
      }
    } else {
      this.fullAudio.pause();
    }
  };

  TS100StoryExperience.prototype.seekFullAudio = function (delta) {
    if (!Number.isFinite(this.fullAudio.duration)) return;
    this.fullAudio.currentTime = clamp(this.fullAudio.currentTime + delta, 0, this.fullAudio.duration);
    if (this.currentMode === "auto") this.syncAutoSlideFromFullAudio(true);
  };

  TS100StoryExperience.prototype.renderTranscript = function () {
    this.elements.transcript.innerHTML = "";
    this.data.pages.forEach(function (page, index) {
      var li = createEl("li", "ts100-transcript-item");
      var num = createEl("span", "ts100-transcript-number", String(index + 1).padStart(2, "0") + (page.scene ? " | " + page.scene : ""));
      var text = createEl("p", "ts100-transcript-text", page.text || page.narration || "");
      li.appendChild(num);
      li.appendChild(text);
      this.elements.transcript.appendChild(li);
    }, this);
  };

  TS100StoryExperience.prototype.toggleTranscript = function () {
    var hidden = this.elements.transcript.classList.contains("ts100-hidden");
    this.elements.transcript.classList.toggle("ts100-hidden", !hidden);
    this.elements.transcriptLabel.textContent = hidden ? "전체 글 접기" : "전체 글 펼치기";
  };

  TS100StoryExperience.prototype.renderRelations = function () {
    this.elements.relations.innerHTML = "";
    if (this.data.relations.length === 0) {
      this.elements.relations.appendChild(createEl("p", "ts100-section-desc", "연결된 사자성어가 아직 없습니다."));
      return;
    }
    this.data.relations.forEach(function (item) {
      var tag = item.url ? "a" : "div";
      var card = createEl(tag, "ts100-relation-card");
      if (item.url) {
        card.href = item.url;
      }
      card.appendChild(createEl("span", "ts100-relation-type", item.type || "연결"));
      card.appendChild(createEl("span", "ts100-relation-name", item.title || ""));
      card.appendChild(createEl("span", "ts100-relation-hanja", item.hanja || ""));
      card.appendChild(createEl("span", "ts100-relation-desc", item.description || ""));
      this.elements.relations.appendChild(card);
    }, this);
  };

TS100StoryExperience.prototype.getStoryLibraryItems = function () {
    if (Array.isArray(this._storyLibraryItems) && this._storyLibraryItems.length) {
      return this._storyLibraryItems;
    }
    if (Array.isArray(TS100_WISDOM_SEARCH_INDEX)) {
      return TS100_WISDOM_SEARCH_INDEX.map(function (item) {
        return Object.assign({}, item, {
          url: item.url || "",
          published: !!item.url,
          status: item.url ? "published" : "draft",
          relatedSlugs: Array.isArray(item.relatedSlugs) ? item.relatedSlugs : []
        });
      });
    }
    return [];
  };

  TS100StoryExperience.prototype.findStoryLibraryItem = function (value) {
    var needle = safeText(value).trim();
    if (!needle) return null;
    return this.getStoryLibraryItems().find(function (item) {
      return item.slug === needle || item.id === needle || item.title === needle || item.hanja === needle;
    }) || null;
  };

  TS100StoryExperience.prototype.mergeStoryLibraryCatalog = function (libraryItems, catalogItems) {
    var catalogMap = {};
    (catalogItems || []).forEach(function (item) {
      if (!item) return;
      var key = item.slug || item.id || String(item.number || "");
      if (key) catalogMap[key] = item;
      if (item.number) catalogMap[String(Number(item.number))] = item;
    });

    return (libraryItems || []).map(function (item) {
      var catalog = catalogMap[item.slug] || catalogMap[item.id] || catalogMap[String(Number(item.number))] || {};
      var url = safeText(catalog.url || item.url || "").trim();
      return Object.assign({}, item, {
        url: url,
        published: !!(url && (catalog.published !== false)),
        status: catalog.status || item.status || (url ? "published" : "draft"),
        thumbnail: catalog.thumbnail || item.thumbnail || "",
        storyJson: catalog.storyJson || item.storyJson || ""
      });
    });
  };

TS100StoryExperience.prototype.getStoryCategoryOrder = function () {
    return [
      "자립과 생존", "용기와 도전", "인내와 끈기", "실패와 회복", "선택과 결단",
      "관계와 공감", "마음과 수양", "배움과 성장", "세상과 처세", "변화와 인생"
    ];
  };

  TS100StoryExperience.prototype.ensureStoryLibraryLoaded = function () {
    var self = this;
    if (this._storyLibraryLoaded) return Promise.resolve(this.getStoryLibraryItems());
    if (this._storyLibraryPromise) return this._storyLibraryPromise;

    var libraryUrl = this.root.getAttribute("data-library-index-url") || "";
    var catalogUrl = this.root.getAttribute("data-series-index-url") || "";

    function getJson(url) {
      if (!url) return Promise.resolve(null);
      return fetch(url, { credentials: "omit", cache: "no-store" })
        .then(function (response) {
          if (!response.ok) throw new Error("catalog " + response.status);
          return response.json();
        });
    }

    this._storyLibraryPromise = Promise.all([
      getJson(libraryUrl).catch(function () { return null; }),
      getJson(catalogUrl).catch(function () { return null; })
    ]).then(function (rows) {
      var libraryData = rows[0];
      var catalogData = rows[1];
      var libraryItems = Array.isArray(libraryData)
        ? libraryData
        : (libraryData && Array.isArray(libraryData.items) ? libraryData.items : []);
      var catalogItems = Array.isArray(catalogData)
        ? catalogData
        : (catalogData && Array.isArray(catalogData.items) ? catalogData.items : []);

      self._seriesCatalog = catalogItems;
      self._storyLibraryItems = self.mergeStoryLibraryCatalog(libraryItems, catalogItems);
      self._storyLibraryLoaded = self._storyLibraryItems.length > 0;
      self._storyLibraryPromise = null;

      if (!self._storyLibraryOpenCategory) {
        var current = self._storyLibraryItems.find(function (item) { return item.slug === self.data.id; });
        self._storyLibraryOpenCategory = current ? current.category : self.getStoryCategoryOrder()[0];
      }

      self.renderStoryLibrary();
      self.renderRelated();
      self.populateWisdomIdiomCategories();
      self.renderWisdomIdiomResults();
      return self._storyLibraryItems;
    }).catch(function () {
      self._storyLibraryPromise = null;
      if (self.elements.storyLibraryStatus) {
        self.elements.storyLibraryStatus.textContent = "사자성어 100선 목록을 불러오지 못했습니다. 잠시 후 다시 열어주세요.";
      }
      return [];
    });

    return this._storyLibraryPromise;
  };

  TS100StoryExperience.prototype.initStoryLibrary = function () {
    var self = this;
    this._storyLibraryOpen = false;
    this._storyLibraryShowAll = false;
    this._storyLibraryItems = [];

    if (this.elements.storyLibraryToggle) {
      this.elements.storyLibraryToggle.addEventListener("click", function () {
        self._storyLibraryOpen = !self._storyLibraryOpen;
        self.elements.storyLibraryPanel.classList.toggle("ts100-hidden", !self._storyLibraryOpen);
        self.elements.storyLibraryToggle.setAttribute("aria-expanded", self._storyLibraryOpen ? "true" : "false");
        self.elements.storyLibraryToggle.textContent = self._storyLibraryOpen ? "사자성어 100선 접기" : "사자성어 100선 펼쳐보기";
        if (self._storyLibraryOpen) {
          self.ensureStoryLibraryLoaded().then(function () {
            self.renderStoryLibrary();
          });
        }
      });
    }

    if (this.elements.storyLibrarySearch) {
      this.elements.storyLibrarySearch.addEventListener("input", function () {
        window.clearTimeout(self._storyLibrarySearchTimer);
        self._storyLibrarySearchTimer = window.setTimeout(function () {
          self.renderStoryLibrary();
        }, 200);
      });
    }

    if (this.elements.storyLibraryClear) {
      this.elements.storyLibraryClear.addEventListener("click", function () {
        if (self.elements.storyLibrarySearch) self.elements.storyLibrarySearch.value = "";
        var current = self.getStoryLibraryItems().find(function (item) { return item.slug === self.data.id; });
        self._storyLibraryOpenCategory = current ? current.category : self.getStoryCategoryOrder()[0];
        self.renderStoryLibrary();
        if (self.elements.storyLibrarySearch) self.elements.storyLibrarySearch.focus();
      });
    }

    if (this.elements.storyLibraryGroups) {
      this.elements.storyLibraryGroups.addEventListener("click", function (event) {
        var button = event.target.closest("[data-library-group]");
        if (!button) return;
        var category = button.getAttribute("data-library-group") || "";
        self._storyLibraryOpenCategory = self._storyLibraryOpenCategory === category ? "" : category;
        self.renderStoryLibrary();
      });
    }

    var idleLoad = function () { self.ensureStoryLibraryLoaded(); };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(idleLoad, { timeout: 1200 });
    } else {
      window.setTimeout(idleLoad, 300);
    }
  };

TS100StoryExperience.prototype.populateStoryLibraryCategories = function () {
    return;
  };

TS100StoryExperience.prototype.renderStoryLibrary = function () {
    if (!this.elements.storyLibraryGroups || !this.elements.storyLibraryStatus) return;
    var items = this.getStoryLibraryItems();
    if (!items.length) {
      this.elements.storyLibraryGroups.innerHTML = "";
      this.elements.storyLibraryStatus.textContent = this._storyLibraryPromise
        ? "사자성어 100선 목록을 불러오는 중입니다."
        : "사자성어 100선 목록을 준비하고 있습니다.";
      return;
    }

    var query = safeText(this.elements.storyLibrarySearch && this.elements.storyLibrarySearch.value).trim().toLowerCase();
    var terms = query.replace(/[^0-9a-z가-힣\s]/g, " ").split(/\s+/).filter(Boolean);
    var order = this.getStoryCategoryOrder();
    var currentSlug = this.data.id;
    var self = this;

    function matches(item) {
      if (!terms.length) return true;
      var corpus = [
        item.number, item.title, item.hanja, item.slug, item.category,
        (item.secondary || []).join(" "), item.situation, item.question,
        item.message, (item.tags || []).join(" ")
      ].join(" ").toLowerCase();
      return terms.every(function (term) { return corpus.indexOf(term) !== -1; });
    }

    var groups = order.map(function (category, index) {
      var all = items.filter(function (item) { return item.category === category; });
      var filtered = all.filter(matches);
      return { category: category, index: index + 1, all: all, items: filtered };
    }).filter(function (group) {
      return !terms.length || group.items.length > 0;
    });

    if (terms.length && groups.length && !groups.some(function (group) { return group.category === self._storyLibraryOpenCategory; })) {
      this._storyLibraryOpenCategory = groups[0].category;
    }
    if (!terms.length && !this._storyLibraryOpenCategory) {
      var current = items.find(function (item) { return item.slug === currentSlug; });
      this._storyLibraryOpenCategory = current ? current.category : order[0];
    }

    this.elements.storyLibraryGroups.innerHTML = "";
    groups.forEach(function (group) {
      var published = group.all.filter(function (item) { return !!item.url; }).length;
      var open = group.category === self._storyLibraryOpenCategory;
      var section = createEl("section", "ts100-library-group");
      section.classList.toggle("is-open", open);

      var toggle = createEl("button", "ts100-library-group-toggle");
      toggle.type = "button";
      toggle.setAttribute("data-library-group", group.category);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.appendChild(createEl("span", "ts100-library-group-index", String(group.index).padStart(2, "0")));
      toggle.appendChild(createEl("span", "ts100-library-group-title", group.category));
      toggle.appendChild(createEl("span", "ts100-library-group-progress", published + " / " + group.all.length));
      toggle.appendChild(createEl("span", "ts100-library-group-arrow", "⌄"));
      section.appendChild(toggle);

      if (open) {
        var body = createEl("div", "ts100-library-group-body");
        group.items.forEach(function (item) {
          var isPublished = !!item.url;
          var row = createEl(isPublished ? "a" : "article", "ts100-library-row");
          row.classList.toggle("is-pending", !isPublished);
          row.classList.toggle("is-current", item.slug === currentSlug);
          if (isPublished) row.href = item.url;

          var thumb = createEl("div", "ts100-library-row-thumb");
          var img = document.createElement("img");
          img.src = item.thumbnail || ("https://healingmart.github.io/tistory100-story-assets/thumbs/" + String(item.number).padStart(3, "0") + ".png");
          img.alt = safeText(item.title) + " 썸네일";
          img.loading = "lazy";
          img.decoding = "async";
          img.addEventListener("error", function () { thumb.remove(); }, { once: true });
          thumb.appendChild(img);
          row.appendChild(thumb);

          var copy = createEl("div", "ts100-library-row-copy");
          copy.appendChild(createEl("strong", "ts100-library-row-title", String(item.number).padStart(3, "0") + " · " + item.title));
          copy.appendChild(createEl("span", "ts100-library-row-hanja", item.hanja || ""));
          copy.appendChild(createEl("span", "ts100-library-row-message", item.message || item.question || ""));
          row.appendChild(copy);
          row.appendChild(createEl("span", "ts100-library-row-state", item.slug === currentSlug ? "현재" : (isPublished ? "읽기" : "준비 중")));
          body.appendChild(row);
        });
        section.appendChild(body);
      }

      self.elements.storyLibraryGroups.appendChild(section);
    });

    var totalMatches = groups.reduce(function (sum, group) { return sum + group.items.length; }, 0);
    this.elements.storyLibraryStatus.textContent = terms.length
      ? "검색 결과 " + totalMatches + "편 · 해당 삶의 영역을 열어 확인하세요."
      : "10개 삶의 영역 · 각 10편 · 모두 100편";

    if (!groups.length) {
      this.elements.storyLibraryGroups.appendChild(
        createEl("p", "ts100-section-desc", "검색 조건에 맞는 사자성어가 없습니다. 다른 단어로 다시 찾아보세요.")
      );
    }
  };

  TS100StoryExperience.prototype.getAutomaticRelatedItems = function () {
    var items = this.getStoryLibraryItems();
    var current = items.find(function (item) { return item.slug === this.data.id; }, this);
    var picked = [];
    var seen = {};
    var self = this;

    function push(item) {
      if (!item || item.slug === self.data.id || seen[item.slug]) return;
      seen[item.slug] = true;
      picked.push(item);
    }

    if (current && Array.isArray(current.relatedSlugs)) {
      current.relatedSlugs.forEach(function (slug) {
        push(items.find(function (item) { return item.slug === slug; }));
      });
    }

    (this.data.related || []).forEach(function (related) {
      var match = items.find(function (item) {
        return (related.slug && item.slug === related.slug) ||
          (related.title && item.title === related.title) ||
          (related.hanja && item.hanja === related.hanja);
      });
      push(match);
    });

    if (current) {
      items
        .filter(function (item) {
          return item.slug !== current.slug && item.category === current.category;
        })
        .sort(function (a, b) {
          var aPublished = a.url ? 1 : 0;
          var bPublished = b.url ? 1 : 0;
          if (aPublished !== bPublished) return bPublished - aPublished;
          return Math.abs(Number(a.number) - Number(current.number)) -
            Math.abs(Number(b.number) - Number(current.number));
        })
        .forEach(push);
    }

    items
      .filter(function (item) { return item.slug !== self.data.id; })
      .sort(function (a, b) {
        var aPublished = a.url ? 1 : 0;
        var bPublished = b.url ? 1 : 0;
        if (aPublished !== bPublished) return bPublished - aPublished;
        return Math.abs(Number(a.number) - Number(self.data.meta.number || 1)) -
          Math.abs(Number(b.number) - Number(self.data.meta.number || 1));
      })
      .forEach(push);

    return picked.slice(0, 3);
  };

TS100StoryExperience.prototype.renderRelated = function () {
    if (!this.elements.relatedGrid) return;
    this.elements.relatedGrid.innerHTML = "";
    var relatedItems = this.getAutomaticRelatedItems();

    if (!relatedItems.length) {
      this.elements.relatedGrid.appendChild(
        createEl("p", "ts100-section-desc", "연결할 이야기를 준비하고 있습니다.")
      );
      return;
    }

    relatedItems.forEach(function (item) {
      var isPublished = !!item.url;
      var card = createEl(isPublished ? "a" : "article", "ts100-related-card");
      card.classList.toggle("is-pending", !isPublished);
      if (isPublished) card.href = item.url;

      var thumb = this.createStoryThumbnail(item);
      if (thumb) card.appendChild(thumb);

      card.appendChild(createEl("span", "ts100-related-hanja", item.hanja || ""));
      card.appendChild(createEl("span", "ts100-related-title", item.title || ""));
      card.appendChild(createEl("span", "ts100-related-question", item.question || item.message || ""));
      card.appendChild(createEl("span", "ts100-related-status", isPublished ? "이야기 읽기" : "준비 중"));
      this.elements.relatedGrid.appendChild(card);
    }, this);
  };

  TS100StoryExperience.prototype.saveReflectionDraft = function () {
    if (!this.elements.reflectionInput) return;
    var text = this.elements.reflectionInput.value;
    var key = this.storagePrefix + "reflection_draft";
    try {
      if (text.trim()) {
        localStorage.setItem(key, JSON.stringify({ text: text, savedAt: new Date().toISOString() }));
        if (this.elements.reflectionSaveStatus) {
          this.elements.reflectionSaveStatus.textContent = "작성 중 · 이 브라우저에 임시 저장됨";
          this.elements.reflectionSaveStatus.classList.remove("is-saved");
        }
      } else {
        localStorage.removeItem(key);
        if (this.elements.reflectionSaveStatus) {
          this.elements.reflectionSaveStatus.textContent = "작성 중인 내용은 이 브라우저에 임시 저장됩니다.";
          this.elements.reflectionSaveStatus.classList.remove("is-saved");
        }
      }
    } catch (e) {}
  };

  TS100StoryExperience.prototype.getStoredReflection = function () {
    var payload = null;
    try {
      payload = JSON.parse(localStorage.getItem(this.storagePrefix + "reflection") || "null");
    } catch (e) {}
    if (payload && payload.text) return payload;

    var memory = this.getMemoryRecords().find(function (item) {
      return item && item.storyId === this.data.id && item.type === "text" && item.text;
    }, this);
    if (memory) return { text: memory.text, savedAt: memory.savedAt };
    return null;
  };

  TS100StoryExperience.prototype.saveReflection = function () {
    var text = this.elements.reflectionInput ? this.elements.reflectionInput.value.trim() : "";
    if (!text) {
      this.toast("먼저 나의 생각을 적어주세요.");
      return;
    }
    var payload = { text: text, savedAt: new Date().toISOString() };
    var primarySaved = false;
    try {
      localStorage.setItem(this.storagePrefix + "reflection", JSON.stringify(payload));
      localStorage.removeItem(this.storagePrefix + "reflection_draft");
      primarySaved = true;
    } catch (e) {}

    try {
      this.upsertMemoryRecord("text", { text: text, savedAt: payload.savedAt });
    } catch (e2) {}

    var verified = this.getStoredReflection();
    if (!verified || verified.text !== text) {
      this.toast("기록 저장에 실패했습니다. 브라우저 저장 설정을 확인해주세요.");
      if (this.elements.reflectionSaveStatus) {
        this.elements.reflectionSaveStatus.textContent = "저장되지 않음 · 브라우저 저장 설정을 확인해주세요.";
        this.elements.reflectionSaveStatus.classList.remove("is-saved");
      }
      return;
    }

    this.renderSavedReflection();
    this.renderMemoryEcho();
    this.renderWisdomSummary();
    if (this.elements.reflectionSaveStatus) {
      var d = new Date(payload.savedAt);
      var t = Number.isNaN(d.getTime()) ? "방금" : d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      this.elements.reflectionSaveStatus.textContent = "저장됨 · " + t;
      this.elements.reflectionSaveStatus.classList.add("is-saved");
    }
    this.toast(primarySaved ? "나의 생각을 저장했습니다." : "나의 생각을 기록에 저장했습니다.");
  };

  TS100StoryExperience.prototype.renderSavedReflection = function () {
    var payload = this.getStoredReflection();
    if (!payload || !payload.text) {
      var draft = null;
      try { draft = JSON.parse(localStorage.getItem(this.storagePrefix + "reflection_draft") || "null"); } catch (e) {}
      if (draft && draft.text && this.elements.reflectionInput) {
        this.elements.reflectionInput.value = draft.text;
        if (this.elements.reflectionSaveStatus) {
          this.elements.reflectionSaveStatus.textContent = "작성 중 · 이전에 쓰던 내용을 복원했습니다.";
          this.elements.reflectionSaveStatus.classList.remove("is-saved");
        }
      }
      if (this.elements.savedNote) this.elements.savedNote.classList.add("ts100-hidden");
      return;
    }
    if (this.elements.savedNote) this.elements.savedNote.classList.remove("ts100-hidden");
    var date = new Date(payload.savedAt);
    var dateText = Number.isNaN(date.getTime()) ? "저장된 나의 생각" : date.toLocaleDateString("ko-KR") + "의 나";
    if (this.elements.savedNoteTime) this.elements.savedNoteTime.textContent = dateText;
    if (this.elements.savedNoteText) this.elements.savedNoteText.textContent = payload.text;
    if (this.elements.reflectionInput) this.elements.reflectionInput.value = payload.text;
    if (this.elements.reflectionSaveStatus) {
      this.elements.reflectionSaveStatus.textContent = "저장된 기록을 불러왔습니다.";
      this.elements.reflectionSaveStatus.classList.add("is-saved");
    }
  };

  TS100StoryExperience.prototype.clearReflection = function () {
    try {
      localStorage.removeItem(this.storagePrefix + "reflection");
      localStorage.removeItem(this.storagePrefix + "reflection_draft");
      this.removeMemoryRecord("text");
    } catch (e) {}
    if (this.elements.reflectionInput) this.elements.reflectionInput.value = "";
    if (this.elements.savedNote) this.elements.savedNote.classList.add("ts100-hidden");
    if (this.elements.reflectionSaveStatus) {
      this.elements.reflectionSaveStatus.textContent = "작성 중인 내용은 이 브라우저에 임시 저장됩니다.";
      this.elements.reflectionSaveStatus.classList.remove("is-saved");
    }
    this.renderMemoryEcho();
    this.renderWisdomSummary();
    this.toast("저장한 글 기록을 지웠습니다.");
  };

  TS100StoryExperience.prototype.setRecordMode = function (mode) {
    mode = mode === "handwriting" ? "handwriting" : "text";
    (this.elements.recordModeTabs || []).forEach(function (btn) {
      var active = btn.getAttribute("data-record-mode") === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    (this.elements.recordPanels || []).forEach(function (panel) {
      panel.classList.toggle("ts100-record-panel-hidden", panel.getAttribute("data-record-panel") !== mode);
    });
    if (mode === "handwriting") {
      var self = this;
      window.requestAnimationFrame(function () { self.resizeMemoryCanvas(); });
    }
  };

  TS100StoryExperience.prototype.removeMemoryRecord = function (type) {
    try {
      var records = this.getMemoryRecords().filter(function (item) {
        return !(item && item.storyId === this.data.id && item.type === type);
      }, this);
      localStorage.setItem("ts100_memory_v1", JSON.stringify(records));
    } catch (e) {}
  };

  TS100StoryExperience.prototype.restore = function () {
    try {
      var savedPage = Number(localStorage.getItem(this.storagePrefix + "page"));
      if (Number.isInteger(savedPage)) {
        this.pageIndex = clamp(savedPage, 0, Math.max(0, this.data.pages.length - 1));
      }
      var rate = Number(localStorage.getItem(this.storagePrefix + "rate"));
      if ([0.8, 1, 1.2, 1.5].indexOf(rate) !== -1) {
        this.fullAudio.playbackRate = rate;
        this.elements.playbackRate.value = String(rate);
      }
    } catch (e) {}
  };

  TS100StoryExperience.prototype.initWritingCanvas = function () {
    var canvas = this.elements.writeCanvas;
    if (!canvas) {
      return;
    }
    var self = this;
    this.resizeWritingCanvas();
    this.updateWritingChar();

    function point(event) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }

    canvas.addEventListener("pointerdown", function (event) {
      self.writeState.drawing = true;
      canvas.setPointerCapture(event.pointerId);
      var p = point(event);
      self.writeState.lastX = p.x;
      self.writeState.lastY = p.y;
    });

    canvas.addEventListener("pointermove", function (event) {
      if (!self.writeState.drawing) {
        return;
      }
      var p = point(event);
      var ctx = canvas.getContext("2d");
      var scaleX = canvas.width / canvas.clientWidth;
      var scaleY = canvas.height / canvas.clientHeight;
      ctx.save();
      ctx.strokeStyle = "#2f2923";
      ctx.lineWidth = 8 * Math.max(scaleX, scaleY);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(self.writeState.lastX * scaleX, self.writeState.lastY * scaleY);
      ctx.lineTo(p.x * scaleX, p.y * scaleY);
      ctx.stroke();
      ctx.restore();
      self.writeState.lastX = p.x;
      self.writeState.lastY = p.y;
    });

    function endDraw() {
      self.writeState.drawing = false;
    }
    canvas.addEventListener("pointerup", endDraw);
    canvas.addEventListener("pointercancel", endDraw);
    canvas.addEventListener("pointerleave", endDraw);
  };

  TS100StoryExperience.prototype.getWritingChars = function () {
    var chars = this.data.meaning.characters.map(function (item) { return item.char; }).filter(Boolean);
    if (chars.length === 0) {
      chars = Array.from(this.data.meta.hanja || "");
    }
    return chars;
  };

  TS100StoryExperience.prototype.resizeWritingCanvas = function () {
    var canvas = this.elements.writeCanvas;
    if (!canvas || !canvas.clientWidth || !canvas.clientHeight) {
      return;
    }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = Math.floor(canvas.clientWidth * dpr);
    var height = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width === width && canvas.height === height) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    this.clearWritingCanvas();
  };

  TS100StoryExperience.prototype.clearWritingCanvas = function () {
    var canvas = this.elements.writeCanvas;
    if (!canvas) {
      return;
    }
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var chars = this.getWritingChars();
    var char = chars[this.writeState.index] || "";
    ctx.save();
    ctx.fillStyle = "rgba(91,75,58,.10)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 " + Math.floor(Math.min(canvas.width, canvas.height) * 0.62) + "px serif";
    ctx.fillText(char, canvas.width / 2, canvas.height / 2);
    ctx.strokeStyle = "rgba(91,75,58,.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.restore();
  };

  TS100StoryExperience.prototype.changeWritingChar = function (delta) {
    var chars = this.getWritingChars();
    if (chars.length === 0) {
      return;
    }
    this.writeState.index = (this.writeState.index + delta + chars.length) % chars.length;
    this.updateWritingChar();
    this.clearWritingCanvas();
  };

  TS100StoryExperience.prototype.updateWritingChar = function () {
    var chars = this.getWritingChars();
    this.elements.writeChar.textContent = chars[this.writeState.index] || "";
  };


  TS100StoryExperience.prototype.getMotionOrigin = function (page, index) {
    var motion = page && page.motion ? page.motion : null;
    if (typeof motion === "string") motion = { type: motion };
    var origin = String(motion && motion.origin || (index % 4 === 0 ? "50% 46%" : (index % 4 === 1 ? "48% 50%" : (index % 4 === 2 ? "52% 48%" : "50% 52%"))));
    if (!/^\s*\d{1,3}(?:\.\d+)?%\s+\d{1,3}(?:\.\d+)?%\s*$/.test(origin)) origin = "50% 50%";
    return origin;
  };

  TS100StoryExperience.prototype.applyPageMotion = function (page, index, imageEl) {
    var img = imageEl || this.elements.pageImage;
    if (!img) return;
    this.cancelImageAnimations(img);
    img.classList.remove("ts100-motion-zoom-in", "ts100-motion-zoom-out");
    var baseScale = 1.03;
    var baseTransform = "scale(" + baseScale + ")";
    var origin = this.getMotionOrigin(page || {}, index);
    img.style.transformOrigin = origin;
    img.style.objectPosition = origin;
    img.style.transform = baseTransform;

    if (this.currentMode !== "auto" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var motion = page && page.motion ? page.motion : null;
    if (typeof motion === "string") motion = { type: motion };
    if (!motion) {
      var group = Math.floor(index / 3) % 3;
      motion = { type: group === 2 ? "hold" : "breathe", scale: group === 0 ? 1.045 : 1.041 };
    }
    var type = String(motion.type || "breathe").toLowerCase();
    if (motion.enabled === false || type === "none" || type === "hold") return;

    var segmentDuration = Number(page && page.audioEnd) - Number(page && page.audioStart);
    var duration = Number(motion.duration);
    if (!Number.isFinite(duration) || duration <= 0) duration = Number.isFinite(segmentDuration) && segmentDuration > 0 ? segmentDuration : 12;
    duration = clamp(duration, 7, 22);

    var scale = Number(motion.scale);
    if (!Number.isFinite(scale)) scale = 1.044;
    scale = clamp(scale, 1.036, 1.052);

    var peakOffset = type === "release" || type === "zoom-out" ? 0.28 : 0.62;
    var keyframes = [
      { transform: baseTransform, offset: 0 },
      { transform: "scale(" + scale + ")", offset: peakOffset },
      { transform: baseTransform, offset: 1 }
    ];
    if (typeof img.animate === "function") {
      this.imageMotionAnimation = img.animate(keyframes, {
        duration: duration * 1000,
        easing: "cubic-bezier(.38,0,.2,1)",
        fill: "forwards"
      });
    }
  };

  TS100StoryExperience.prototype.getMemoryRecords = function () {
    try {
      var value = JSON.parse(localStorage.getItem("ts100_memory_v1") || "[]");
      return Array.isArray(value) ? value : [];
    } catch (e) {
      return [];
    }
  };

  TS100StoryExperience.prototype.saveMemoryRecords = function (records) {
    try {
      localStorage.setItem("ts100_memory_v1", JSON.stringify((records || []).slice(-300)));
      return true;
    } catch (e) {
      return false;
    }
  };

  TS100StoryExperience.prototype.upsertMemoryRecord = function (type, payload) {
    var records = this.getMemoryRecords();
    var previous = records.find(function (item) {
      return item && item.storyId === this.data.id && item.type === type;
    }, this) || {};
    records = records.filter(function (item) {
      return !(item && item.storyId === this.data.id && item.type === type);
    }, this);
    records.push({
      storyId: this.data.id,
      storyNumber: Number(this.data.meta.number) || Number(this.root.getAttribute("data-story-number")) || 1,
      storyTitle: this.data.meta.title,
      hanja: this.data.meta.hanja,
      category: this.data.meta.categoryLabel || "자립과 생존",
      emotionFlow: this.data.meta.emotionFlow || "막막함 → 주도성",
      storyUrl: previous.storyUrl || window.location.href,
      type: type,
      savedAt: payload.savedAt || new Date().toISOString(),
      text: payload.text || "",
      strokes: payload.strokes || [],
      favorite: previous.favorite === true,
      lastEchoedAt: previous.lastEchoedAt || null,
      echoCount: Number(previous.echoCount) || 0,
      hidden: previous.hidden === true
    });
    this.saveMemoryRecords(records);
  };

  TS100StoryExperience.prototype.initMemoryCanvas = function () {
    var canvas = this.elements.memoryCanvas;
    if (!canvas) return;
    var self = this;
    this.resizeMemoryCanvas();

    function point(event) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
        y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
        t: Date.now()
      };
    }

    function drawSegment(a, b) {
      var ctx = canvas.getContext("2d");
      ctx.save();
      ctx.strokeStyle = "#2f2923";
      ctx.lineWidth = Math.max(2, canvas.width * 0.006);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
      ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
      ctx.stroke();
      ctx.restore();
    }

    canvas.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      self.memoryWriteState.drawing = true;
      canvas.setPointerCapture(event.pointerId);
      var p = point(event);
      self.memoryWriteState.currentStroke = [p];
      self.memoryWriteState.strokes.push(self.memoryWriteState.currentStroke);
    });

    canvas.addEventListener("pointermove", function (event) {
      if (!self.memoryWriteState.drawing || !self.memoryWriteState.currentStroke) return;
      event.preventDefault();
      var p = point(event);
      var stroke = self.memoryWriteState.currentStroke;
      var prev = stroke[stroke.length - 1];
      if (!prev || Math.abs(prev.x - p.x) + Math.abs(prev.y - p.y) < 0.002) return;
      stroke.push(p);
      drawSegment(prev, p);
    });

    function endDraw() {
      self.memoryWriteState.drawing = false;
      self.memoryWriteState.currentStroke = null;
    }
    canvas.addEventListener("pointerup", endDraw);
    canvas.addEventListener("pointercancel", endDraw);
    canvas.addEventListener("pointerleave", endDraw);
  };

  TS100StoryExperience.prototype.resizeMemoryCanvas = function () {
    var canvas = this.elements.memoryCanvas;
    if (!canvas || !canvas.clientWidth || !canvas.clientHeight) return;
    var saved = this.memoryWriteState.strokes.slice();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    this.drawMemoryStrokes(canvas, saved);
  };

  TS100StoryExperience.prototype.drawMemoryStrokes = function (canvas, strokes) {
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.strokeStyle = "#2f2923";
    ctx.lineWidth = Math.max(2, canvas.width * 0.006);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    (strokes || []).forEach(function (stroke) {
      if (!stroke || stroke.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * canvas.width, stroke[0].y * canvas.height);
      for (var i = 1; i < stroke.length; i += 1) {
        ctx.lineTo(stroke[i].x * canvas.width, stroke[i].y * canvas.height);
      }
      ctx.stroke();
    });
    ctx.restore();
  };

  TS100StoryExperience.prototype.clearMemoryCanvas = function () {
    this.memoryWriteState.strokes = [];
    this.memoryWriteState.currentStroke = null;
    var canvas = this.elements.memoryCanvas;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  };

  TS100StoryExperience.prototype.saveMemoryHandwriting = function () {
    var strokes = this.memoryWriteState.strokes.filter(function (stroke) { return stroke && stroke.length > 1; });
    if (!strokes.length) {
      this.toast("먼저 손글씨로 한 문장을 남겨주세요.");
      return;
    }
    this.upsertMemoryRecord("handwriting", { strokes: strokes, savedAt: new Date().toISOString() });
    this.renderMemoryEcho();
    this.renderWisdomSummary();
    this.toast("손글씨 기록을 이 브라우저에 저장했습니다.");
  };

  TS100StoryExperience.prototype.getMemoryEchoState = function () {
    try {
      var value = JSON.parse(localStorage.getItem("ts100_memory_echo_state_v1") || "null");
      return value && typeof value === "object" ? value : {};
    } catch (e) {
      return {};
    }
  };

  TS100StoryExperience.prototype.saveMemoryEchoState = function (state) {
    try { localStorage.setItem("ts100_memory_echo_state_v1", JSON.stringify(state || {})); } catch (e) {}
  };

  TS100StoryExperience.prototype.renderMemoryEcho = function () {
    if (!this.elements.memoryEcho) return;
    var now = new Date();
    var today = now.toISOString().slice(0, 10);
    var state = this.getMemoryEchoState();
    if (state.dismissedDate === today) {
      this._activeMemoryEcho = null;
      this.elements.memoryEcho.classList.add("ts100-hidden");
      return;
    }

    var testMode = this.root.getAttribute("data-memory-echo-test") === "true";
    var cutoff = now.getTime() - (testMode ? 0 : 30 * 24 * 60 * 60 * 1000);
    var all = this.getMemoryRecords().filter(function (item) {
      if (!item || item.storyId === this.data.id || item.hidden === true) return false;
      var saved = new Date(item.savedAt || 0).getTime();
      if (!Number.isFinite(saved) || saved > cutoff) return false;
      return (item.type === "text" && item.text) || (item.type === "handwriting" && Array.isArray(item.strokes) && item.strokes.length);
    }, this);

    var byStory = {};
    all.forEach(function (item) {
      if (!byStory[item.storyId]) byStory[item.storyId] = [];
      byStory[item.storyId].push(item);
    });
    var candidates = Object.keys(byStory).map(function (storyId) {
      var group = byStory[storyId].slice().sort(function (a, b) {
        if (a.type === "text" && b.type !== "text") return -1;
        if (a.type !== "text" && b.type === "text") return 1;
        return String(b.savedAt || "").localeCompare(String(a.savedAt || ""));
      });
      var main = group[0];
      return {
        storyId: storyId,
        storyNumber: main.storyNumber,
        storyTitle: main.storyTitle || storyId,
        storyUrl: main.storyUrl || "",
        category: main.category || "",
        savedAt: main.savedAt,
        textRecord: group.find(function (item) { return item.type === "text" && item.text; }) || null,
        handRecord: group.find(function (item) { return item.type === "handwriting" && Array.isArray(item.strokes) && item.strokes.length; }) || null,
        lastEchoedAt: group.map(function (item) { return item.lastEchoedAt || ""; }).sort().reverse()[0] || "",
        echoCount: Math.max.apply(null, group.map(function (item) { return Number(item.echoCount) || 0; }))
      };
    }, this);

    if (!candidates.length) {
      this._activeMemoryEcho = null;
      this.elements.memoryEcho.classList.add("ts100-hidden");
      return;
    }

    var chosen = null;
    if (state.shownDate === today && state.storyId) {
      chosen = candidates.find(function (item) { return item.storyId === state.storyId; }) || null;
    }
    if (!chosen) {
      var currentCategory = this.data.meta.categoryLabel || "";
      candidates.sort(function (a, b) {
        var sameA = a.category === currentCategory ? 1 : 0;
        var sameB = b.category === currentCategory ? 1 : 0;
        if (sameA !== sameB) return sameB - sameA;
        if (!!a.lastEchoedAt !== !!b.lastEchoedAt) return a.lastEchoedAt ? 1 : -1;
        if (a.lastEchoedAt !== b.lastEchoedAt) return String(a.lastEchoedAt).localeCompare(String(b.lastEchoedAt));
        return String(a.savedAt || "").localeCompare(String(b.savedAt || ""));
      });
      chosen = candidates[0];
      state.shownDate = today;
      state.storyId = chosen.storyId;
      state.dismissedDate = "";
      this.saveMemoryEchoState(state);

      var records = this.getMemoryRecords();
      records.forEach(function (item) {
        if (item && item.storyId === chosen.storyId) {
          item.lastEchoedAt = now.toISOString();
          item.echoCount = (Number(item.echoCount) || 0) + 1;
        }
      });
      this.saveMemoryRecords(records);
    }

    this._activeMemoryEcho = chosen;
    this.elements.memoryEcho.classList.remove("ts100-hidden");
    var date = new Date(chosen.savedAt);
    var number = chosen.storyNumber ? String(chosen.storyNumber).padStart(3, "0") + " · " : "";
    this.elements.memoryEchoDate.textContent = Number.isNaN(date.getTime()) ? "예전에 남긴 기록" : date.toLocaleDateString("ko-KR") + " · " + number + chosen.storyTitle + "을 읽으며";
    this.elements.memoryEchoText.textContent = chosen.textRecord ? "“" + chosen.textRecord.text + "”" : "";
    this.elements.memoryEchoText.classList.toggle("ts100-hidden", !chosen.textRecord);

    if (this.elements.memoryEchoCanvas) {
      this.elements.memoryEchoCanvas.classList.toggle("ts100-hidden", !chosen.handRecord);
      if (chosen.handRecord) {
        var canvas = this.elements.memoryEchoCanvas;
        var rect = canvas.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor((rect.width || 520) * dpr));
        canvas.height = Math.max(1, Math.floor((rect.height || 180) * dpr));
        this.drawMemoryStrokes(canvas, chosen.handRecord.strokes);
      }
    }
  };

  TS100StoryExperience.prototype.openMemoryEcho = function () {
    var echo = this._activeMemoryEcho;
    if (!echo) return;
    if (echo.storyUrl && echo.storyUrl !== window.location.href) {
      window.location.href = echo.storyUrl;
      return;
    }
    this.toast("해당 이야기의 발행 URL이 연결되면 바로 다시 만날 수 있습니다.");
  };

  TS100StoryExperience.prototype.dismissMemoryEcho = function () {
    var state = this.getMemoryEchoState();
    state.dismissedDate = new Date().toISOString().slice(0, 10);
    this.saveMemoryEchoState(state);
    this._activeMemoryEcho = null;
    if (this.elements.memoryEcho) this.elements.memoryEcho.classList.add("ts100-hidden");
  };

  TS100StoryExperience.prototype.exportMemory = function () {
    var records = this.getMemoryRecords().filter(function (item) {
      return item && item.storyId === this.data.id;
    }, this);

    var savedTextRecord = records.find(function (item) { return item.type === "text" && item.text; }) || null;
    var savedHandRecord = records.find(function (item) {
      return item.type === "handwriting" && Array.isArray(item.strokes) && item.strokes.length;
    }) || null;

    var currentText = this.elements.reflectionInput ? String(this.elements.reflectionInput.value || "").trim() : "";
    var currentStrokes = (this.memoryWriteState && Array.isArray(this.memoryWriteState.strokes))
      ? this.memoryWriteState.strokes.filter(function (stroke) { return stroke && stroke.length > 1; })
      : [];

    var textRecord = currentText
      ? { type: "text", text: currentText, savedAt: new Date().toISOString() }
      : savedTextRecord;
    var handRecord = currentStrokes.length
      ? { type: "handwriting", strokes: currentStrokes, savedAt: new Date().toISOString() }
      : savedHandRecord;

    if (!textRecord && !handRecord) {
      this.toast("먼저 글이나 손글씨로 오늘의 기록을 남겨주세요.");
      return;
    }

    var latestCandidates = [];
    if (textRecord && textRecord.savedAt) latestCandidates.push(textRecord);
    if (handRecord && handRecord.savedAt) latestCandidates.push(handRecord);
    var latest = latestCandidates.sort(function (a, b) {
      return String(b.savedAt || "").localeCompare(String(a.savedAt || ""));
    })[0] || { savedAt: new Date().toISOString() };

    var canvas = document.createElement("canvas");
    var W = 1400;
    var H = handRecord ? 1760 : 1180;
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    if (!ctx) {
      this.toast("이 브라우저에서는 기록 이미지를 만들 수 없습니다.");
      return;
    }

    ctx.fillStyle = "#f7f2ea";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fffdf9";
    ctx.fillRect(70, 70, W - 140, H - 140);
    ctx.strokeStyle = "#d8cbb9";
    ctx.lineWidth = 3;
    ctx.strokeRect(70, 70, W - 140, H - 140);

    ctx.fillStyle = "#5d6d5a";
    ctx.font = "700 24px sans-serif";
    ctx.fillText("TimeStory · MY RECORD", 135, 155);
    ctx.fillStyle = "#2f2b26";
    ctx.font = "800 58px sans-serif";
    ctx.fillText(this.data.meta.title || "나의 기록", 135, 245);
    ctx.fillStyle = "#6b6259";
    ctx.font = "500 32px sans-serif";
    ctx.fillText(this.data.meta.hanja || "", 135, 300);

    var date = latest && latest.savedAt ? new Date(latest.savedAt) : new Date();
    ctx.fillStyle = "#8b8177";
    ctx.font = "400 25px sans-serif";
    ctx.fillText((Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ko-KR")) + " · " + (this.data.meta.categoryLabel || "TimeStory"), 135, 365);

    function wrapText(value, x, y, maxWidth, lineHeight) {
      var chars = Array.from(String(value || ""));
      var line = "";
      var yy = y;
      chars.forEach(function (ch) {
        var test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, x, yy);
          line = ch;
          yy += lineHeight;
        } else {
          line = test;
        }
      });
      if (line) ctx.fillText(line, x, yy);
      return yy;
    }

    var cursorY = 470;
    if (textRecord) {
      ctx.fillStyle = "#756a5f";
      ctx.font = "700 24px sans-serif";
      ctx.fillText("오늘의 나의 기록", 135, cursorY);
      cursorY += 65;
      ctx.fillStyle = "#302b27";
      ctx.font = "500 36px sans-serif";
      cursorY = wrapText(textRecord.text || "", 135, cursorY, W - 270, 58) + 95;
    }

    if (handRecord) {
      ctx.fillStyle = "#756a5f";
      ctx.font = "700 24px sans-serif";
      ctx.fillText("나의 손글씨", 135, cursorY);
      cursorY += 42;
      var boxX = 135, boxY = cursorY, boxW = W - 270, boxH = Math.max(430, H - cursorY - 245);
      ctx.fillStyle = "#fbfaf7";
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = "#ded5c9";
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = "#34312d";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      (handRecord.strokes || []).forEach(function (stroke) {
        if (!stroke || stroke.length < 2) return;
        ctx.beginPath();
        stroke.forEach(function (point, index) {
          var px = boxX + Number(point.x || 0) * boxW;
          var py = boxY + Number(point.y || 0) * boxH;
          if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
    }

    ctx.fillStyle = "#9a9085";
    ctx.font = "400 21px sans-serif";
    ctx.fillText("이 이미지는 내가 TimeStory에서 직접 남긴 개인 기록입니다.", 135, H - 125);

    var fileName = "time-story-" + (this.data.id || "my-record") + "-my-record.png";
    var self = this;

    function dataUrlToBlob(dataUrl) {
      var parts = String(dataUrl).split(",");
      var mimeMatch = parts[0].match(/data:([^;]+)/);
      var mime = mimeMatch ? mimeMatch[1] : "image/png";
      var binary = atob(parts[1] || "");
      var len = binary.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }

    try {
      /*
       * Blogger 편집/미리보기는 iframe 다운로드가 차단되는 경우가 있어,
       * 실제 게시 화면과 미리보기 화면을 구분한다.
       */
      var dataUrl = canvas.toDataURL("image/png");
      var inFrame = false;
      try { inFrame = window.self !== window.top; } catch (frameError) { inFrame = true; }

      if (inFrame) {
        var preview = window.open("", "_blank");
        if (preview) {
          preview.document.open();
          preview.document.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + fileName + '</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#eee}body{display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}img{max-width:100%;height:auto;box-shadow:0 8px 30px rgba(0,0,0,.14)}</style></head><body><img alt="TimeStory 나의 기록" src="' + dataUrl + '"></body></html>');
          preview.document.close();
          this.toast("미리보기 환경에서는 기록 이미지를 새 화면에 열었습니다. 이미지에서 저장해주세요.");
          return;
        }
      }

      var blob = dataUrlToBlob(dataUrl);
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 2500);
      this.toast("내 기록 PNG 저장을 시작했습니다.");
    } catch (error) {
      try {
        var fallback = canvas.toDataURL("image/png");
        var opened = window.open(fallback, "_blank");
        if (opened) {
          self.toast("기록 이미지를 새 화면에 열었습니다. 이미지에서 저장해주세요.");
          return;
        }
      } catch (fallbackError) {}
      this.toast("기록 이미지 저장에 실패했습니다. 게시된 페이지에서 다시 시도해주세요.");
    }
  };

  TS100StoryExperience.prototype.clearAllMemory = function () {
    if (this.elements.clearAllMemoryConfirm) {
      this.elements.clearAllMemoryConfirm.classList.remove("ts100-hidden");
      this.elements.clearAllMemoryConfirm.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  TS100StoryExperience.prototype.cancelClearAllMemory = function () {
    if (this.elements.clearAllMemoryConfirm) this.elements.clearAllMemoryConfirm.classList.add("ts100-hidden");
  };

  TS100StoryExperience.prototype.confirmClearAllMemory = function () {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i));
      keys.forEach(function (key) {
        if (key === "ts100_memory_v1" || key === TS100_PROGRESS_KEY || key === TS100_PROGRESS_BACKUP_KEY || key === TS100_PROGRESS_JOURNAL_KEY || key === "ts100_reading_v1" || key === "ts100_memory_echo_state_v1" || (key && key.indexOf("ts100_story_") === 0)) localStorage.removeItem(key);
      });
    } catch (e) {}
    if (this.elements.clearAllMemoryConfirm) this.elements.clearAllMemoryConfirm.classList.add("ts100-hidden");
    if (this.elements.reflectionInput) this.elements.reflectionInput.value = "";
    if (this.elements.savedNote) this.elements.savedNote.classList.add("ts100-hidden");
    this.clearMemoryCanvas();
    this.renderMemoryEcho();
    this.renderWisdomSummary();
    this.toast("이 브라우저의 TimeStory 기록과 지혜 서재 기록을 모두 삭제했습니다.");
  };


  TS100StoryExperience.prototype.getReadingProgress = function () {
    var progress = { stories: {} };
    try {
      var parsed = JSON.parse(localStorage.getItem("ts100_reading_v1") || "null");
      if (parsed && typeof parsed === "object") progress = parsed;
      if (!progress.stories || typeof progress.stories !== "object") progress.stories = {};
    } catch (e) {}
    return progress;
  };

  TS100StoryExperience.prototype.saveReadingProgress = function (progress) {
    try {
      localStorage.setItem("ts100_reading_v1", JSON.stringify(progress || { stories:{} }));
      return true;
    } catch (e) {
      return false;
    }
  };

  TS100StoryExperience.prototype.checkMidpointProgress = function (ratio) {
    ratio = Number(ratio);
    if (!Number.isFinite(ratio) || ratio < 0.5) return;
    this.markStoryHalfway();
  };

  TS100StoryExperience.prototype.markStoryHalfway = function () {
    var completed = this.getWisdomProgress();
    if (completed.stories && completed.stories[this.data.id]) return;

    var reading = this.getReadingProgress();
    if (reading.stories[this.data.id]) return;

    var category = this.data.meta.categoryLabel || "자립과 생존";
    reading.stories[this.data.id] = {
      number: Number(this.root.getAttribute("data-story-number")) || Number(this.data.meta.number) || 1,
      reachedHalfAt: new Date().toISOString(),
      title: this.data.meta.title,
      hanja: this.data.meta.hanja,
      category: category,
      storyUrl: window.location.href,
      maxProgress: 0.5
    };
    if (!this.saveReadingProgress(reading)) return;

    this._wisdomNewLeaf = true;
    this.renderWisdomSummary();
    this.showMidpointPopup();
    var self = this;
    window.setTimeout(function () {
      self._wisdomNewLeaf = false;
      self.renderWisdomSummary();
    }, 3000);
  };

  TS100StoryExperience.prototype.showMidpointPopup = function () {
    var number = String(Number(this.data.meta.number) || Number(this.root.getAttribute("data-story-number")) || 1).padStart(3, "0");
    var category = this.data.meta.categoryLabel || "자립과 생존";
    if (this.elements.completionKicker) this.elements.completionKicker.textContent = "지혜 서재 발견";
    if (this.elements.completionBookNumber) this.elements.completionBookNumber.textContent = number;
    if (this.elements.completionTitle) this.elements.completionTitle.textContent = number + " · " + this.data.meta.title;
    if (this.elements.completionDesc) this.elements.completionDesc.textContent = "이야기의 절반을 만나 " + category + " 서가에 읽는 중인 책이 먼저 꽂혔습니다.";
    if (this.elements.completionProgress) this.elements.completionProgress.textContent = "끝까지 만나면 완독으로 기록됩니다.";
    if (!this.prepareCompletionPopup("is-midpoint")) return;
    var self = this;
    this.completionPopupTimer = window.setTimeout(function () { self.hideCompletionPopup(); }, 3000);
  };

  TS100StoryExperience.prototype.showWisdomReading = function (storyId) {
    var item = this.getReadingProgress().stories[storyId];
    if (!item || !this.elements.wisdomTreeMessage) return;
    var date = item.reachedHalfAt ? new Date(item.reachedHalfAt) : null;
    var dateText = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("ko-KR") : "기록된 날";
    this.elements.wisdomTreeMessage.innerHTML = '<strong>' + String(item.number || "").padStart(3,"0") + ' · ' + escapeHtml(item.title || storyId) + '</strong><span>' + dateText + '에 절반 이상 만난 이야기입니다.<br><em>끝까지 만나면 완독 책으로 기록됩니다.</em></span>';
  };

  TS100StoryExperience.prototype.appendProgressJournal = function (storyId, item) {
    if (!storyId || !item) return;
    try {
      var journal = JSON.parse(localStorage.getItem(TS100_PROGRESS_JOURNAL_KEY) || "null");
      if (!journal || typeof journal !== "object") journal = { events: [] };
      if (!Array.isArray(journal.events)) journal.events = [];
      var exists = journal.events.some(function (event) {
        return event && event.storyId === storyId;
      });
      if (!exists) {
        journal.events.push({ storyId: storyId, item: item, savedAt: new Date().toISOString() });
        if (journal.events.length > 160) journal.events = journal.events.slice(-160);
        localStorage.setItem(TS100_PROGRESS_JOURNAL_KEY, JSON.stringify(journal));
      }
    } catch (e) {}
  };

  TS100StoryExperience.prototype.markStoryCompleted = function () {
    var progress = this.getWisdomProgress();
    var newlyAdded = false;
    var category = this.data.meta.categoryLabel || "자립과 생존";
    if (!progress.stories || typeof progress.stories !== "object") progress.stories = {};

    if (!progress.stories[this.data.id]) {
      var completedItem = {
        number: Number(this.root.getAttribute("data-story-number")) || Number(this.data.meta.number) || 1,
        completedAt: new Date().toISOString(),
        title: this.data.meta.title,
        hanja: this.data.meta.hanja,
        category: category,
        storyUrl: window.location.href,
        favorite: false
      };
      progress.stories[this.data.id] = completedItem;
      try {
        var serialized = JSON.stringify(progress);
        localStorage.setItem(TS100_PROGRESS_KEY, serialized);
        localStorage.setItem(TS100_PROGRESS_BACKUP_KEY, serialized);
      } catch (e) {}
      this.appendProgressJournal(this.data.id, completedItem);
      newlyAdded = true;
    }

    try {
      var readingProgress = this.getReadingProgress();
      if (readingProgress.stories && readingProgress.stories[this.data.id]) {
        delete readingProgress.stories[this.data.id];
        this.saveReadingProgress(readingProgress);
      }
    } catch (e) {}

    this._wisdomNewLeaf = newlyAdded;
    this.renderWisdomSummary();
    if (!newlyAdded) return;

    if (this.elements.wisdomSummary) {
      this.elements.wisdomSummary.classList.remove("ts100-wisdom-just-added");
      void this.elements.wisdomSummary.offsetWidth;
      this.elements.wisdomSummary.classList.add("ts100-wisdom-just-added");
    }

    var stories = progress.stories || {};
    var ids = Object.keys(stories);
    var categoryCount = ids.filter(function (id) {
      return stories[id] && stories[id].category === category;
    }).length;
    var completedShelves = TS100_WISDOM_CATEGORIES.filter(function (name) {
      return ids.filter(function (id) { return stories[id] && stories[id].category === name; }).length >= 10;
    }).length;

    this.showCompletionPopup();
    this.queueCompletionMilestones({ category: category, categoryCount: categoryCount, total: ids.length, completedShelves: completedShelves });

    var self = this;
    window.setTimeout(function () { self._wisdomNewLeaf = false; }, 3000);
  };

  TS100StoryExperience.prototype.clearCompletionMilestoneTimers = function () {
    (this._completionMilestoneTimers || []).forEach(function (timer) { window.clearTimeout(timer); });
    this._completionMilestoneTimers = [];
  };

  TS100StoryExperience.prototype.queueCompletionMilestones = function (status) {
    this.clearCompletionMilestoneTimers();
    var self = this;
    var delay = 3350;
    if (status.categoryCount === 10) {
      this._completionMilestoneTimers.push(window.setTimeout(function () {
        self.showMilestonePopup("shelf", status);
      }, delay));
      delay += 3350;
    }
    if (status.total === 100) {
      this._completionMilestoneTimers.push(window.setTimeout(function () {
        self.showMilestonePopup("library", status);
      }, delay));
    }
  };

  TS100StoryExperience.prototype.prepareCompletionPopup = function (variant) {
    var el = this.elements.completionPopup;
    if (!el) return null;
    el.classList.remove("is-midpoint", "is-milestone-shelf", "is-milestone-library");
    if (variant) el.classList.add(variant);
    window.clearTimeout(this.completionPopupTimer);
    window.clearTimeout(this.completionPopupHideTimer);
    el.classList.remove("ts100-hidden", "is-visible");
    void el.offsetWidth;
    window.requestAnimationFrame(function () { el.classList.add("is-visible"); });
    return el;
  };

  TS100StoryExperience.prototype.showCompletionPopup = function () {
    var progress = this.getWisdomProgress();
    var stories = progress.stories || {};
    var total = Object.keys(stories).length;
    var category = this.data.meta.categoryLabel || "자립과 생존";
    var categoryCount = 0;
    Object.keys(stories).forEach(function (id) {
      if (stories[id] && stories[id].category === category) categoryCount += 1;
    });

    var number = String(Number(this.data.meta.number) || Number(this.root.getAttribute("data-story-number")) || 1).padStart(3, "0");
    if (this.elements.completionKicker) this.elements.completionKicker.textContent = "새로운 지혜 기록";
    if (this.elements.completionBookNumber) this.elements.completionBookNumber.textContent = number;
    if (this.elements.completionTitle) this.elements.completionTitle.textContent = number + " · " + this.data.meta.title;
    if (this.elements.completionDesc) this.elements.completionDesc.textContent = category + " 서가의 " + (categoryCount === 1 ? "첫 번째 책" : categoryCount + "번째 책") + "이 끝까지 만난 이야기로 완성되었습니다.";
    if (this.elements.completionProgress) this.elements.completionProgress.textContent = "나의 지혜 서재 " + total + " / 100";
    if (!this.prepareCompletionPopup("")) return;

    var self = this;
    this.completionPopupTimer = window.setTimeout(function () { self.hideCompletionPopup(); }, 3000);
  };

  TS100StoryExperience.prototype.showMilestonePopup = function (kind, status) {
    if (this.elements.completionKicker) this.elements.completionKicker.textContent = kind === "library" ? "지혜 여정 완성" : "지혜 서가 완성";
    var variant = kind === "library" ? "is-milestone-library" : "is-milestone-shelf";
    if (this.elements.completionBookNumber) this.elements.completionBookNumber.textContent = kind === "library" ? "100" : "10";
    if (kind === "library") {
      if (this.elements.completionTitle) this.elements.completionTitle.textContent = "나의 지혜 서재가 완성되었습니다";
      if (this.elements.completionDesc) this.elements.completionDesc.textContent = "100개의 이야기를 만나며 잠시 멈추어 생각한 시간이 한 서재에 기록되었습니다.";
      if (this.elements.completionProgress) this.elements.completionProgress.textContent = "TimeStory VOL.01 · 100 / 100";
    } else {
      if (this.elements.completionTitle) this.elements.completionTitle.textContent = status.category + " 서가 완성";
      if (this.elements.completionDesc) this.elements.completionDesc.textContent = "이 삶의 영역에서 열 편의 이야기를 모두 만났습니다.";
      if (this.elements.completionProgress) this.elements.completionProgress.textContent = "완성한 지혜 서가 " + status.completedShelves + " / 10";
    }
    if (!this.prepareCompletionPopup(variant)) return;
    var self = this;
    this.completionPopupTimer = window.setTimeout(function () { self.hideCompletionPopup(); }, 3000);
  };

  TS100StoryExperience.prototype.hideCompletionPopup = function () {
    var el = this.elements.completionPopup;
    if (!el) return;
    window.clearTimeout(this.completionPopupTimer);
    window.clearTimeout(this.completionPopupHideTimer);
    el.classList.remove("is-visible");
    this.completionPopupHideTimer = window.setTimeout(function () {
      el.classList.add("ts100-hidden");
      el.classList.remove("is-midpoint", "is-milestone-shelf", "is-milestone-library");
    }, 240);
  };

  TS100StoryExperience.prototype.getWisdomProgress = function () {
    var merged = { stories: {} };
    var primary = null;
    var backup = null;
    var journal = null;

    function normalizeSnapshot(value) {
      if (!value || typeof value !== "object") return null;
      if (!value.stories || typeof value.stories !== "object") value.stories = {};
      return value;
    }

    function mergeStories(target, source) {
      if (!source || !source.stories || typeof source.stories !== "object") return;
      Object.keys(source.stories).forEach(function (id) {
        var incoming = source.stories[id];
        if (!incoming || typeof incoming !== "object") return;
        var existing = target.stories[id];
        if (!existing) {
          target.stories[id] = incoming;
          return;
        }
        var existingTime = Date.parse(existing.completedAt || "") || 0;
        var incomingTime = Date.parse(incoming.completedAt || "") || 0;
        if (incomingTime >= existingTime) target.stories[id] = Object.assign({}, existing, incoming);
      });
    }

    try { primary = normalizeSnapshot(JSON.parse(localStorage.getItem(TS100_PROGRESS_KEY) || "null")); } catch (e) {}
    try { backup = normalizeSnapshot(JSON.parse(localStorage.getItem(TS100_PROGRESS_BACKUP_KEY) || "null")); } catch (e) {}
    try { journal = JSON.parse(localStorage.getItem(TS100_PROGRESS_JOURNAL_KEY) || "null"); } catch (e) {}

    mergeStories(merged, backup);
    mergeStories(merged, primary);

    if (journal && Array.isArray(journal.events)) {
      journal.events.forEach(function (event) {
        if (!event || !event.storyId || !event.item) return;
        var one = { stories: {} };
        one.stories[event.storyId] = event.item;
        mergeStories(merged, one);
      });
    }

    var mergedCount = Object.keys(merged.stories).length;
    if (mergedCount > 0) {
      try {
        var serialized = JSON.stringify(merged);
        localStorage.setItem(TS100_PROGRESS_KEY, serialized);
        localStorage.setItem(TS100_PROGRESS_BACKUP_KEY, serialized);
      } catch (e) {}
    }

    return merged;
  };

  TS100StoryExperience.prototype.renderWisdomSummary = function () {
    var progress = this.getWisdomProgress();
    var stories = progress.stories || {};
    var readingProgress = this.getReadingProgress();
    var readingStories = readingProgress.stories || {};
    var completedIds = Object.keys(stories);
    var shelfIdsMap = {};
    completedIds.forEach(function (id) { shelfIdsMap[id] = true; });
    Object.keys(readingStories).forEach(function (id) { if (!stories[id]) shelfIdsMap[id] = true; });
    var shelfIds = Object.keys(shelfIdsMap);

    var categoryCounts = {};
    var completedCategoryCounts = {};
    TS100_WISDOM_CATEGORIES.forEach(function (name) {
      categoryCounts[name] = 0;
      completedCategoryCounts[name] = 0;
    });
    shelfIds.forEach(function (id) {
      var item = stories[id] || readingStories[id] || {};
      if (categoryCounts[item.category] != null) categoryCounts[item.category] += 1;
    });
    completedIds.forEach(function (id) {
      var item = stories[id] || {};
      if (completedCategoryCounts[item.category] != null) completedCategoryCounts[item.category] += 1;
    });

    var currentCategory = this.data.meta.categoryLabel || "자립과 생존";
    var currentCompleted = !!stories[this.data.id];
    var currentReading = !currentCompleted && !!readingStories[this.data.id];
    var activeBranches = TS100_WISDOM_CATEGORIES.filter(function (name) { return categoryCounts[name] > 0; }).length;
    var records = this.getMemoryRecords();
    if (this.elements.wisdomSummary) {
      this.elements.wisdomSummary.classList.remove("ts100-hidden");
      this.elements.wisdomSummary.classList.toggle("is-library-complete", completedIds.length === 100);
    }
    if (this.elements.wisdomSummaryTitle) {
      this.elements.wisdomSummaryTitle.textContent = currentCompleted ? "나의 지혜 서재에 완독한 이야기가 기록되었습니다" : (currentReading ? "나의 지혜 서재에 읽는 중인 책이 꽂혔습니다" : "나의 지혜 서재");
    }
    if (this.elements.wisdomProgress) this.elements.wisdomProgress.textContent = shelfIds.length + " / 100";
    if (this.elements.wisdomBranches) this.elements.wisdomBranches.textContent = activeBranches + " / 10";
    if (this.elements.wisdomRecords) this.elements.wisdomRecords.textContent = records.length;
    this.renderWisdomTree(stories, readingStories, categoryCounts, completedCategoryCounts, currentCategory, currentCompleted, currentReading);
  };

  TS100StoryExperience.prototype.renderWisdomTree = function (stories, readingStories, categoryCounts, completedCategoryCounts, currentCategory, currentCompleted, currentReading) {
    if (!this.elements.wisdomTree) return;

    var storyByNumber = {};
    Object.keys(stories || {}).forEach(function (id) {
      var item = stories[id] || {};
      var number = Number(item.number) || 0;
      if (number) storyByNumber[number] = { id:id, item:item, status:"completed" };
    });
    Object.keys(readingStories || {}).forEach(function (id) {
      if (stories && stories[id]) return;
      var item = readingStories[id] || {};
      var number = Number(item.number) || 0;
      if (number) storyByNumber[number] = { id:id, item:item, status:"reading" };
    });

    var currentIndex = TS100_WISDOM_CATEGORIES.indexOf(currentCategory);
    if (currentIndex < 0) currentIndex = 0;
    if (!Number.isFinite(this._libraryActiveCategory)) this._libraryActiveCategory = currentIndex;
    var activeIndex = clamp(this._libraryActiveCategory, 0, TS100_WISDOM_CATEGORIES.length - 1);
    var activeCategory = TS100_WISDOM_CATEGORIES[activeIndex];
    var activeCount = Number(categoryCounts[activeCategory] || 0);
    var activeCompletedCount = Number(completedCategoryCounts[activeCategory] || 0);

    var paletteClasses = [
      "ts100-book-palette-01","ts100-book-palette-02","ts100-book-palette-03","ts100-book-palette-04","ts100-book-palette-05",
      "ts100-book-palette-06","ts100-book-palette-07","ts100-book-palette-08","ts100-book-palette-09","ts100-book-palette-10"
    ];
    var heightPattern = [82,94,88,100,91,97,85,100,93,98];
    var tiltPattern = [-.7,.25,-.35,.6,-.15,.4,-.5,.2,-.2,.5];
    var firstNumber = activeIndex * 10 + 1;
    var memoryStoryIds = {};
    this.getMemoryRecords().forEach(function (record) {
      if (record && record.storyId) memoryStoryIds[record.storyId] = true;
    });
    var html = [];

    html.push('<section class="ts100-library-shelf is-focused' + (activeCompletedCount === 10 ? ' is-complete' : '') + '" data-library-category="' + activeCategory + '">');
    html.push('<div class="ts100-library-shelf-head">');
    html.push('<div><span class="ts100-library-shelf-index">' + String(activeIndex + 1).padStart(2, "0") + '</span><strong>' + activeCategory + '</strong></div>');
    html.push('<b>' + activeCount + ' / 10</b>');
    html.push('</div>');
    html.push('<div class="ts100-library-books" aria-label="' + activeCategory + ' 이야기 서가">');

    for (var li = 0; li < 10; li += 1) {
      var number = firstNumber + li;
      var hit = storyByNumber[number];
      var isCurrent = !!(hit && hit.id === this.data.id);
      var isNew = !!(isCurrent && this._wisdomNewLeaf);
      var classes = ['ts100-library-book'];
      if (!hit) classes.push('is-unread');
      else if (hit.status === 'reading') classes.push('is-reading', paletteClasses[activeIndex]);
      else classes.push('is-read', paletteClasses[activeIndex]);
      if (isCurrent) classes.push('is-current');
      if (isNew) classes.push('is-new');
      var style = '--book-h:' + heightPattern[li] + '%;--book-tilt:' + tiltPattern[li] + 'deg';
      var numText = String(number).padStart(3, '0');
      var title = hit && hit.item.title ? hit.item.title : '';

      if (hit && hit.status === 'completed') {
        html.push('<button type="button" class="' + classes.join(' ') + '" style="' + style + '" data-wisdom-leaf="' + hit.id + '" data-library-book-number="' + number + '" aria-label="' + numText + ' · ' + title + ' 기록 보기">');
        html.push('<span class="ts100-library-book-shine"></span>');
        html.push('<span class="ts100-library-book-title">' + title + '</span>');
        html.push('<span class="ts100-library-book-number">' + numText + '</span>');
        if (memoryStoryIds[hit.id]) html.push('<span class="ts100-library-bookmark" aria-hidden="true"></span>');
        html.push('</button>');
      } else if (hit && hit.status === 'reading') {
        html.push('<button type="button" class="' + classes.join(' ') + '" style="' + style + '" data-wisdom-reading="' + hit.id + '" data-library-book-number="' + number + '" aria-label="' + numText + ' · ' + title + ' 읽는 중">');
        html.push('<span class="ts100-library-book-shine"></span>');
        html.push('<span class="ts100-library-book-title">' + title + '</span>');
        html.push('<span class="ts100-library-book-number">' + numText + '</span>');
        if (memoryStoryIds[hit.id]) html.push('<span class="ts100-library-bookmark" aria-hidden="true"></span>');
        html.push('<span class="ts100-library-reading-mark" aria-hidden="true">½</span>');
        html.push('</button>');
      } else {
        html.push('<span class="' + classes.join(' ') + '" style="' + style + '" data-library-book-number="' + number + '" aria-label="아직 만나지 않은 ' + numText + ' 이야기">');
        html.push('<span class="ts100-library-book-number">' + numText + '</span>');
        html.push('</span>');
      }
    }

    html.push('</div>');
    html.push('<div class="ts100-library-shelf-board" aria-hidden="true"></div>');
    if (activeCompletedCount === 10) html.push('<p class="ts100-library-complete-mark">이 삶의 서가를 모두 만났습니다.</p>');
    html.push('</section>');
    this.elements.wisdomTree.innerHTML = html.join('');

    if (this.elements.wisdomTreeLegend) {
      this.elements.wisdomTreeLegend.innerHTML = TS100_WISDOM_CATEGORIES.map(function (name, index) {
        var count = Number(categoryCounts[name] || 0);
        var selected = index === activeIndex;
        return '<button type="button" class="ts100-library-legend-item' + (selected ? ' is-selected' : '') + '" data-library-jump="' + index + '" aria-pressed="' + (selected ? 'true' : 'false') + '"><span>' + name + '</span><b>' + count + '/10</b></button>';
      }).join('');
    }

    if (this.elements.wisdomTreeMessage) {
      var currentNumber = String(this.data.meta.number || this.root.getAttribute("data-story-number") || 1).padStart(3, "0");
      if (activeIndex === currentIndex && currentCompleted) {
        var currentCompletedCount = Number(completedCategoryCounts[currentCategory] || 0);
        this.elements.wisdomTreeMessage.innerHTML = '<strong>✦ ' + currentCategory + ' 서가의 ' + (currentCompletedCount === 1 ? '첫 번째 책' : currentCompletedCount + '번째 책') + '이 완독으로 기록되었습니다.</strong><span><b>' + currentNumber + ' · ' + this.data.meta.title + '</b>을 누르면 읽은 날과 내가 남긴 생각을 다시 볼 수 있습니다.</span>';
      } else if (activeIndex === currentIndex && currentReading) {
        this.elements.wisdomTreeMessage.innerHTML = '<strong>✦ ' + currentCategory + ' 서가에 읽는 중인 책이 꽂혔습니다.</strong><span><b>' + currentNumber + ' · ' + this.data.meta.title + '</b>을 끝까지 만나면 꽃이 피며 완독 책으로 기록됩니다.</span>';
      } else if (activeIndex === currentIndex) {
        this.elements.wisdomTreeMessage.innerHTML = '<strong>' + currentCategory + ' 서가 · ' + activeCount + ' / 10</strong><span>이야기의 절반을 만나면 <b>' + currentNumber + ' · ' + this.data.meta.title + '</b>이 읽는 중인 책으로 먼저 꽂힙니다.</span>';
      } else {
        this.elements.wisdomTreeMessage.innerHTML = '<strong>' + activeCategory + ' 서가 · ' + activeCount + ' / 10</strong><span>위의 영역을 눌러 다른 서가를 살펴볼 수 있습니다. 색이 들어온 책은 눌러 현재 상태나 그날의 기록을 확인할 수 있습니다.</span>';
      }
    }
  };

  TS100StoryExperience.prototype.showWisdomLeaf = function (storyId) {
    var item = this.getWisdomProgress().stories[storyId];
    if (!item || !this.elements.wisdomTreeMessage) return;
    var date = item.completedAt ? new Date(item.completedAt) : null;
    var dateText = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("ko-KR") : "기록된 날";
    var memories = this.getMemoryRecords().filter(function (record) { return record && record.storyId === storyId; });
    var textMemory = memories.find(function (record) { return record.type === "text" && record.text; });
    var hasHandwriting = memories.some(function (record) { return record.type === "handwriting" && Array.isArray(record.strokes) && record.strokes.length; });
    var recordHtml = textMemory ? '<br><em>“' + escapeHtml(textMemory.text) + '”</em>' : (hasHandwriting ? '<br><em>손글씨 기록이 남아 있습니다.</em>' : '<br><em>아직 남긴 문장은 없습니다.</em>');
    this.elements.wisdomTreeMessage.innerHTML = '<strong>' + String(item.number || "").padStart(3,"0") + ' · ' + escapeHtml(item.title || storyId) + '</strong><span>' + dateText + '에 만난 이야기' + recordHtml + '</span>';
  };

  TS100StoryExperience.prototype.highlightWisdomShelf = function (storyNumber) {
    storyNumber = Number(storyNumber);
    if (!Number.isFinite(storyNumber) || storyNumber < 1 || storyNumber > 100) return;
    var categoryIndex = Math.floor((storyNumber - 1) / 10);
    this._libraryActiveCategory = clamp(categoryIndex, 0, TS100_WISDOM_CATEGORIES.length - 1);
    this.renderWisdomSummary();

    var section = this.elements.wisdomSummary;
    if (section) section.scrollIntoView({ behavior:"smooth", block:"center" });
    window.clearTimeout(this._libraryHighlightTimer);
    var self = this;
    window.setTimeout(function () {
      var shelf = self.elements.wisdomTree && self.elements.wisdomTree.querySelector(".ts100-library-shelf");
      var book = self.elements.wisdomTree && self.elements.wisdomTree.querySelector('[data-library-book-number="' + storyNumber + '"]');
      if (shelf) shelf.classList.add("is-search-highlight");
      if (book) book.classList.add("is-search-highlight");
      self._libraryHighlightTimer = window.setTimeout(function () {
        if (shelf) shelf.classList.remove("is-search-highlight");
        if (book) book.classList.remove("is-search-highlight");
      }, 2600);
    }, 420);
  };

TS100StoryExperience.prototype.searchWisdom = function (query) {
    if (!this.getStoryLibraryItems().length) {
      if (this.elements.wisdomSearchStatus) this.elements.wisdomSearchStatus.textContent = "전체 100편 지혜 인덱스를 불러오는 중입니다.";
      this.ensureStoryLibraryLoaded().then(function () { this.searchWisdom(query); }.bind(this));
      return;
    }
    query = String(query || "").trim();
    if (!this.elements.wisdomSearchResults || !this.elements.wisdomSearchStatus) return;
    if (!query) {
      this.elements.wisdomSearchStatus.textContent = "마음에 걸리는 일을 적거나 다양한 생각 중 하나를 눌러주세요.";
      this.elements.wisdomSearchResults.classList.add("ts100-hidden");
      return;
    }
    var synonymMap = {
      "관계":["관계","사람","소통","공감","마음","이별"], "사람":["관계","소통","공감","사람"],
      "결정":["결정","선택","판단","결단","망설임"], "선택":["선택","판단","결정","결단"],
      "실패":["실패","회복","다시","재기","변화"], "다시":["다시","회복","변화","시작","성장"],
      "불안":["불안","걱정","동요","혼란","노심초사"], "걱정":["걱정","불안","염려","동요"],
      "도전":["도전","용기","시작","기세","포기"], "포기":["포기","인내","끈기","도전","성장"],
      "외로움":["외로움","혼자","고립","자립","관계"], "혼자":["혼자","자립","고립","생존"],
      "성장":["성장","배움","발전","노력","깊이"], "회복":["회복","다시","변화","재기","평정"],
      "도움":["도움","자립","혼자","기다림","행동"], "회사":["세상","처세","관계","직장","위험","판단"],
      "비교":["비교","열등감","만족","자존","성장"], "후회":["후회","회복","선택","변화","성찰"],
      "지침":["지침","휴식","평온","마음","수양"], "지쳐":["지침","휴식","회복","평온"]
    };
    var terms = query.toLowerCase().replace(/[^0-9a-z가-힣\s]/g," ").split(/\s+/).filter(function (t) { return t.length >= 2; });
    Object.keys(synonymMap).forEach(function (key) {
      if (query.indexOf(key) !== -1) terms = terms.concat(synonymMap[key]);
    });
    terms = Array.from(new Set(terms));

    var sourceItems = this.getStoryLibraryItems();
    var scored = sourceItems.map(function (item) {
      var corpus = [
        item.title,item.hanja,item.category
      ].concat(item.secondary || []).concat([
        item.situation,item.question,item.message,item.emotionBefore,item.emotionAfter
      ]).concat(item.tags || []).join(" ").toLowerCase();
      var score = 0;
      terms.forEach(function (term) {
        if (corpus.indexOf(term) !== -1) score += 3;
        if (safeText(item.title).indexOf(term) !== -1) score += 5;
        if (safeText(item.category).indexOf(term) !== -1) score += 2;
      });
      return { item:item, score:score };
    }).sort(function (a,b) { return b.score - a.score || a.item.number - b.item.number; });

    var picks = scored.filter(function (row) { return row.score > 0; }).slice(0,3);
    if (picks.length < 3) {
      sourceItems.forEach(function (item) {
        if (picks.length >= 3 || picks.some(function (row) { return row.item.slug === item.slug; })) return;
        picks.push({ item:item, score:0 });
      });
    }

    var roles = ["지금의 나와 닮은 네 글자","지금 나에게 필요한 네 글자","다른 방향에서 바라본다면"];
    this.elements.wisdomSearchResults.innerHTML = "";
    picks.slice(0,3).forEach(function (row, index) {
      var item = row.item;
      var card = createEl("article", "ts100-search-result");
      var thumb = this.createStoryThumbnail(item);
      if (thumb) card.appendChild(thumb);
      card.appendChild(createEl("p", "ts100-search-result-role", roles[index]));
      card.appendChild(createEl("p", "ts100-search-result-hanja", (item.hanja || "") + " · " + (item.category || "")));
      card.appendChild(createEl("h3", "ts100-search-result-title", item.title || ""));
      var reason = index === 0 ? item.situation : (index === 1 ? item.message : "같은 고민을 조금 다른 시선에서 바라보게 하는 이야기입니다. " + item.message);
      card.appendChild(createEl("p", "ts100-search-result-reason", reason || ""));
      card.appendChild(createEl("p", "ts100-search-result-question", "생각해 볼 질문 · " + (item.question || "")));
      var actions = createEl("div", "ts100-search-result-actions");
      var storyButton = createEl("button", "ts100-btn" + (item.url ? " ts100-btn-primary" : ""), item.url ? "이 이야기 만나기" : "준비 중");
      storyButton.type = "button";
      storyButton.setAttribute("data-search-story-slug", item.slug || "");
      actions.appendChild(storyButton);
      var shelfButton = createEl("button", "ts100-btn ts100-btn-soft", "서가에서 위치 보기");
      shelfButton.type = "button";
      shelfButton.setAttribute("data-search-shelf-number", item.number || "");
      actions.appendChild(shelfButton);
      card.appendChild(actions);
      this.elements.wisdomSearchResults.appendChild(card);
    }, this);

    this.elements.wisdomSearchResults.classList.remove("ts100-hidden");
    this.elements.wisdomSearchStatus.textContent =
      "‘" + query + "’에서 떠올릴 수 있는 세 가지 지혜의 방향입니다. 정답이 아니라 생각을 시작하기 위한 추천입니다.";
  };

  TS100StoryExperience.prototype.updateMottoPreview = function () {
    var text = (this.elements.mottoInput && this.elements.mottoInput.value.trim()) || this.data.motto.defaultText;
    this.elements.mottoText.textContent = text;
  };

  TS100StoryExperience.prototype.downloadMotto = function () {
    var sizeValue = (this.elements.mottoSize && this.elements.mottoSize.value) || this.data.motto.defaultSize || "1080x2340";
    var parts = sizeValue.split("x");
    var width = Number(parts[0]) || 1080;
    var height = Number(parts[1]) || 2340;
    var style = (this.elements.mottoStyle && this.elements.mottoStyle.value) || "classic";
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    var palette = {
      classic:{a:"#f8f3eb",b:"#dfd0bd",panel:"#fffaf3",ink:"#2f271f",accent:"#5b4b3a",muted:"#8b8177"},
      minimal:{a:"#f7f7f5",b:"#ecece8",panel:"#ffffff",ink:"#1f2328",accent:"#31363c",muted:"#747b83"},
      night:{a:"#172033",b:"#070b12",panel:"#101827",ink:"#f5f2e8",accent:"#d7bd89",muted:"#aab2c0"},
      hanji:{a:"#eee5d3",b:"#d8c7a7",panel:"#f8f0df",ink:"#302920",accent:"#70543a",muted:"#897b69"}
    }[style] || null;
    if (!palette) palette = {a:"#f8f3eb",b:"#dfd0bd",panel:"#fffaf3",ink:"#2f271f",accent:"#5b4b3a",muted:"#8b8177"};
    var grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, palette.a);
    grad.addColorStop(1, palette.b);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    var margin = Math.round(width * 0.075);
    ctx.fillStyle = style === "night" ? "rgba(255,255,255,.035)" : "rgba(91,75,58,.08)";
    ctx.fillRect(margin, margin, width - margin * 2, height - margin * 2);
    ctx.fillStyle = palette.panel;
    ctx.globalAlpha = style === "night" ? 0.84 : 0.94;
    ctx.fillRect(margin + Math.round(width*.018), margin + Math.round(width*.018), width - (margin + Math.round(width*.018))*2, height - (margin + Math.round(width*.018))*2);
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    ctx.fillStyle = palette.muted;
    ctx.font = "700 " + Math.round(width * 0.026) + "px sans-serif";
    ctx.fillText(this.data.motto.brandMain || "TimeStory", width / 2, Math.round(height * 0.10));
    ctx.font = "500 " + Math.round(width * 0.018) + "px sans-serif";
    ctx.fillText(this.data.motto.brandSub || "TimeStory", width / 2, Math.round(height * 0.13));

    /* 잠금화면 상단 시계 영역을 비우고 핵심 문구를 중앙보다 약간 아래 배치 */
    ctx.fillStyle = palette.ink;
    ctx.font = "700 " + Math.round(width * 0.105) + "px serif";
    ctx.fillText(this.data.meta.hanja, width / 2, Math.round(height * 0.43));

    ctx.fillStyle = palette.accent;
    ctx.font = "800 " + Math.round(width * 0.045) + "px sans-serif";
    ctx.fillText(this.data.meta.title, width / 2, Math.round(height * 0.49));

    var text = (this.elements.mottoInput.value || this.data.motto.defaultText).trim();
    ctx.fillStyle = palette.ink;
    ctx.font = "700 " + Math.round(width * 0.038) + "px sans-serif";
    this.wrapCanvasText(ctx, text, width / 2, Math.round(height * 0.60), Math.round(width * 0.70), Math.round(width * 0.066));

    ctx.fillStyle = palette.muted;
    ctx.font = "600 " + Math.round(width * 0.021) + "px sans-serif";
    ctx.fillText("네 글자에서 시작되는 다양한 생각", width / 2, Math.round(height * 0.88));

    var link = document.createElement("a");
    link.download = this.data.id + "-motto-" + width + "x" + height + ".png";
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
    this.toast("갤럭시 세로 배경화면 이미지를 저장했습니다.");
  };

  TS100StoryExperience.prototype.wrapCanvasText = function (ctx, text, x, y, maxWidth, lineHeight) {
    var words = Array.from(text);
    var line = "";
    var lines = [];
    words.forEach(function (char) {
      var test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = test;
      }
    });
    if (line) {
      lines.push(line);
    }
    lines.slice(0, 5).forEach(function (item, index) {
      ctx.fillText(item, x, y + index * lineHeight);
    });
  };

  TS100StoryExperience.prototype.setMeditationDuration = function (seconds) {
    if (![60, 180, 300].includes(seconds)) return;
    this.pauseMeditation();
    this.data.meditation.seconds = seconds;
    this.meditationRemaining = seconds;
    qsa(this.root, ".ts100-duration-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-action") === "meditation-duration-" + seconds);
    });
    this.elements.meditationLabel.textContent = "5분 사색 시작";
    this.updateMeditationDisplay();
  };

TS100StoryExperience.prototype.toggleMeditation = function () {
    if (this.meditationTimer) {
      this.pauseMeditation();
      return;
    }
    if (this.meditationRemaining <= 0) this.meditationRemaining = this.data.meditation.seconds || 300;
    if (!this.meditationAudio.src) {
      if (!this.randomReflectionTrack(false)) return;
    }

    var startTimer = function () {
      if (this.elements.meditationStatus) this.elements.meditationStatus.textContent = "";
      this.elements.meditationLabel.textContent = "잠시 멈춤";
      this.meditationTimer = window.setInterval(function () {
        this.meditationRemaining -= 1;
        this.updateMeditationDisplay();
        if (this.meditationRemaining <= 0) {
          this.pauseMeditation();
          this.meditationRemaining = 0;
          this.updateMeditationDisplay();
          try { this.meditationAudio.currentTime = 0; } catch (e) {}
          this.toast("사색 시간이 끝났습니다. 떠오른 생각을 한 문장으로 남겨보세요.");
        }
      }.bind(this), 1000);
    }.bind(this);

    var p = this.meditationAudio.play();
    if (p && typeof p.then === "function") {
      p.then(startTimer).catch(function () {
        if (this.elements.meditationStatus) this.elements.meditationStatus.textContent = "사색 음악을 재생하지 못했습니다. 다른 음악을 선택해보세요.";
        this.toast("사색 음악 재생에 실패했습니다.");
      }.bind(this));
    } else {
      startTimer();
    }
  };

  TS100StoryExperience.prototype.pauseMeditation = function () {
    if (this.meditationTimer) {
      window.clearInterval(this.meditationTimer);
      this.meditationTimer = null;
    }
    this.meditationAudio.pause();
    this.elements.meditationLabel.textContent = this.meditationRemaining <= 0 ? "5분 다시 시작" : "사색 계속";
  };

  TS100StoryExperience.prototype.resetMeditation = function () {
    this.pauseMeditation();
    this.meditationRemaining = this.data.meditation.seconds;
    try { this.meditationAudio.currentTime = 0; } catch (e) {}
    this.elements.meditationLabel.textContent = "5분 사색 시작";
    this.updateMeditationDisplay();
  };

  TS100StoryExperience.prototype.updateMeditationDisplay = function () {
    this.elements.meditationTime.textContent = formatTime(this.meditationRemaining);
  };

  TS100StoryExperience.prototype.share = function () {
    this.toggleShareMenu();
  };

  TS100StoryExperience.prototype.toggleShareMenu = function () {
    var menu = qs(this.root, '[data-bind="share-menu"]');
    var trigger = qs(this.root, '[data-action="share"]');
    if (!menu || !trigger) {
      return;
    }
    var willOpen = menu.classList.contains("ts100-hidden");
    menu.classList.toggle("ts100-hidden", !willOpen);
    trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
  };

  TS100StoryExperience.prototype.closeShareMenu = function () {
    var menu = qs(this.root, '[data-bind="share-menu"]');
    var trigger = qs(this.root, '[data-action="share"]');
    if (menu) {
      menu.classList.add("ts100-hidden");
    }
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    }
  };

  TS100StoryExperience.prototype.shareService = function (service) {
    var fnMap = {
      kakao: window.ts100ShareKakao,
      naver: window.ts100ShareNaver,
      facebook: window.ts100ShareFacebook,
      x: window.ts100ShareX,
      threads: window.ts100ShareThreads,
      copy: window.ts100ShareCopy,
      band: window.ts100ShareBand,
      telegram: window.ts100ShareTelegram
    };
    var fn = fnMap[service];
    if (typeof fn === "function") {
      fn();
    }
    this.closeShareMenu();
  };

  TS100StoryExperience.prototype.scrollTo = function (element) {
    if (!element) {
      return;
    }
    element.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  TS100StoryExperience.prototype.toast = function (message) {
    var el = this.elements.toast;
    if (!el) {
      return;
    }
    el.textContent = message;
    el.classList.remove("ts100-hidden");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(function () {
      el.classList.add("ts100-hidden");
    }, 2300);
  };

  TS100StoryExperience.prototype.destroy = function () {
    window.clearTimeout(this.completionPopupTimer);
    window.clearTimeout(this.completionPopupHideTimer);
    window.clearTimeout(this._libraryHighlightTimer);
    this.clearCompletionMilestoneTimers();
    this.stopAutoSync();
    this.pageAudio.pause();
    this.fullAudio.pause();
    this.meditationAudio.pause();
    if (this.meditationTimer) {
      window.clearInterval(this.meditationTimer);
    }
    this.root.innerHTML = "";
  };

  function parseInlineStory(root, attributeName) {
    var inlineId = root.getAttribute(attributeName);
    if (!inlineId) return null;

    var script = document.getElementById(inlineId);
    if (!script) {
      throw new Error("Inline story JSON element not found: " + inlineId);
    }

    var parsed = JSON.parse(script.textContent);
    var inlineBase = root.getAttribute("data-story-base") || "";
    var inlineVersion = safeText(parsed && (parsed.assetVersion || parsed.updatedAt || parsed.version) || root.getAttribute("data-asset-version") || "").trim();
    return resolveStoryAssetPaths(parsed, inlineBase, inlineVersion);
  }

TS100StoryExperience.prototype.createStoryThumbnail = function (item) {
    var src = safeText(item && item.thumbnail).trim();
    if (!src && item && item.number) {
      src = "https://healingmart.github.io/tistory100-story-assets/thumbs/" + String(item.number).padStart(3, "0") + ".png";
    }
    if (!src) return null;
    var box = createEl("div", "ts100-card-thumbnail");
    var img = document.createElement("img");
    img.src = src;
    img.alt = safeText(item.title || "") + " 썸네일";
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", function () {
      box.remove();
    }, { once: true });
    box.appendChild(img);
    return box;
  };

  TS100StoryExperience.prototype.setWisdomFinderMode = function (mode) {
    mode = mode === "idiom" ? "idiom" : "situation";
    qsa(this.root, "[data-wisdom-mode]").forEach(function (button) {
      var active = button.getAttribute("data-wisdom-mode") === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    if (this.elements.wisdomPanelSituation) {
      this.elements.wisdomPanelSituation.classList.toggle("ts100-hidden", mode !== "situation");
    }
    if (this.elements.wisdomPanelIdiom) {
      this.elements.wisdomPanelIdiom.classList.toggle("ts100-hidden", mode !== "idiom");
    }
    if (mode === "idiom") {
      this.populateWisdomIdiomCategories();
      this.renderWisdomIdiomResults();
      window.setTimeout(function () {
        if (this.elements.wisdomIdiomInput) this.elements.wisdomIdiomInput.focus({ preventScroll: true });
      }.bind(this), 60);
    }
  };

  TS100StoryExperience.prototype.initWisdomFinderModes = function () {
    var self = this;
    this.populateWisdomIdiomCategories();
    this.renderWisdomIdiomResults();

    if (this.elements.wisdomIdiomInput) {
      this.elements.wisdomIdiomInput.addEventListener("input", function () {
        self.renderWisdomIdiomResults();
      });
      this.elements.wisdomIdiomInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          self.renderWisdomIdiomResults();
        }
      });
    }

    if (this.elements.wisdomIdiomCategory) {
      this.elements.wisdomIdiomCategory.addEventListener("change", function () {
        self.renderWisdomIdiomResults();
      });
    }
  };

  TS100StoryExperience.prototype.populateWisdomIdiomCategories = function () {
    if (!this.elements.wisdomIdiomCategory) return;
    var selected = this.elements.wisdomIdiomCategory.value || "";
    var categories = [];
    this.getStoryLibraryItems().forEach(function (item) {
      var category = safeText(item.category).trim();
      if (category && categories.indexOf(category) === -1) categories.push(category);
    });
    this.elements.wisdomIdiomCategory.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = "전체 삶의 영역";
    this.elements.wisdomIdiomCategory.appendChild(all);
    categories.forEach(function (category) {
      var option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      this.elements.wisdomIdiomCategory.appendChild(option);
    }, this);
    this.elements.wisdomIdiomCategory.value = categories.indexOf(selected) >= 0 ? selected : "";
  };

  TS100StoryExperience.prototype.renderWisdomIdiomResults = function () {
    if (!this.getStoryLibraryItems().length) {
      if (this.elements.wisdomIdiomStatus) this.elements.wisdomIdiomStatus.textContent = "사자성어 목록을 불러오는 중입니다.";
      this.ensureStoryLibraryLoaded().then(function () { this.renderWisdomIdiomResults(); }.bind(this));
      return;
    }
    if (!this.elements.wisdomIdiomResults || !this.elements.wisdomIdiomStatus) return;
    var query = safeText(this.elements.wisdomIdiomInput && this.elements.wisdomIdiomInput.value).trim().toLowerCase();
    var category = safeText(this.elements.wisdomIdiomCategory && this.elements.wisdomIdiomCategory.value).trim();
    var terms = query.replace(/[^0-9a-z가-힣\s]/g, " ").split(/\s+/).filter(Boolean);
    var items = this.getStoryLibraryItems().filter(function (item) {
      if (category && item.category !== category) return false;
      if (!terms.length) return true;
      var corpus = [
        item.number, item.title, item.hanja, item.slug, item.category,
        item.situation, item.question, item.message, (item.tags || []).join(" ")
      ].join(" ").toLowerCase();
      return terms.every(function (term) { return corpus.indexOf(term) !== -1; });
    });

    var visible = items.slice(0, query || category ? 30 : 12);
    this.elements.wisdomIdiomResults.innerHTML = "";
    visible.forEach(function (item) {
      var isPublished = !!item.url;
      var card = createEl(isPublished ? "a" : "article", "ts100-library-card");
      card.classList.toggle("is-pending", !isPublished);
      if (isPublished) card.href = item.url;
      var thumb = this.createStoryThumbnail(item);
      if (thumb) card.appendChild(thumb);
      var top = createEl("div", "ts100-library-card-top");
      top.appendChild(createEl("span", "ts100-library-number", String(item.number || "").padStart(3, "0")));
      top.appendChild(createEl("span", "ts100-library-state", isPublished ? "이야기 읽기" : "준비 중"));
      card.appendChild(top);
      card.appendChild(createEl("span", "ts100-library-hanja", item.hanja || ""));
      card.appendChild(createEl("strong", "ts100-library-title", item.title || ""));
      card.appendChild(createEl("p", "ts100-library-message", item.message || item.question || ""));
      card.appendChild(createEl("span", "ts100-library-category-label", item.category || ""));
      this.elements.wisdomIdiomResults.appendChild(card);
    }, this);

    if (!visible.length) {
      this.elements.wisdomIdiomResults.appendChild(
        createEl("p", "ts100-section-desc", "검색 조건에 맞는 사자성어가 없습니다.")
      );
    }

    this.elements.wisdomIdiomStatus.textContent =
      "검색 결과 " + items.length + "편" +
      (items.length > visible.length ? " · 먼저 " + visible.length + "편을 보여드립니다." : "");
  };

TS100StoryExperience.prototype.initReflectionMusic = function () {
    var base = this.root.getAttribute("data-meditation-base") || "https://healingmart.github.io/tistory100-story-assets/common/audio/meditation/";
    var count = Math.max(1, Number(this.root.getAttribute("data-meditation-count")) || 20);
    var volume = Number(this.root.getAttribute("data-meditation-volume"));
    this.reflectionMusicItems = [];
    this.reflectionMusicIndex = -1;
    this._meditationFailureCount = 0;
    for (var i = 1; i <= count; i += 1) {
      this.reflectionMusicItems.push({
        number: i,
        src: base.replace(/\/?$/, "/") + "meditation-" + String(i).padStart(2, "0") + ".mp3"
      });
    }
    this.meditationAudio.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.38;
    this.meditationAudio.loop = true;
    this.updateReflectionTrackDisplay(null);

    this.meditationAudio.addEventListener("error", function () {
      if (!this.meditationTimer) return;
      this._meditationFailureCount += 1;
      if (this._meditationFailureCount >= this.reflectionMusicItems.length) {
        this.pauseMeditation();
        if (this.elements.meditationStatus) this.elements.meditationStatus.textContent = "업로드된 사색 음악을 확인해주세요.";
        return;
      }
      this.randomReflectionTrack(true);
    }.bind(this));
  };

TS100StoryExperience.prototype.updateReflectionTrackDisplay = function (item) {
    if (this.elements.reflectionTrackMood) this.elements.reflectionTrackMood.textContent = "MUSIC FOR REFLECTION";
    if (this.elements.reflectionTrackTitle) this.elements.reflectionTrackTitle.textContent = "무작위 사색 음악";
    if (this.elements.reflectionTrackSubtitle) {
      this.elements.reflectionTrackSubtitle.textContent = item
        ? "20곡 중 한 곡을 선택했습니다. 한 번의 사색 동안 같은 음악이 이어집니다."
        : "시작할 때 20곡 중 한 곡을 무작위로 선택합니다.";
    }
  };

TS100StoryExperience.prototype.selectReflectionTrack = function (index, autoplay) {
    var items = this.reflectionMusicItems || [];
    if (!items.length) {
      this.toast("아직 연결된 사색 음악이 없습니다.");
      return false;
    }
    index = (Number(index) + items.length) % items.length;
    var item = items[index];
    this.reflectionMusicIndex = index;
    this.pauseMeditation();
    this.meditationRemaining = this.data.meditation.seconds || 300;
    this.meditationAudio.removeAttribute("src");
    this.meditationAudio.src = item.src;
    this.meditationAudio.loop = true;
    this._meditationFailureCount = 0;
    this.updateReflectionTrackDisplay(item);
    this.updateMeditationDisplay();
    try { localStorage.setItem("timestory_last_meditation", String(index)); } catch (e) {}
    if (this.elements.meditationStatus) this.elements.meditationStatus.textContent = "무작위 음악이 선택되었습니다.";
    if (autoplay) this.toggleMeditation();
    return true;
  };

TS100StoryExperience.prototype.changeReflectionTrack = function (step) {
    this.randomReflectionTrack(false);
  };

TS100StoryExperience.prototype.randomReflectionTrack = function (autoplay) {
    var items = this.reflectionMusicItems || [];
    if (!items.length) {
      this.toast("아직 연결된 사색 음악이 없습니다.");
      return false;
    }
    var last = this.reflectionMusicIndex;
    if (last < 0) {
      try { last = Number(localStorage.getItem("timestory_last_meditation")); } catch (e) { last = -1; }
    }
    var next = Math.floor(Math.random() * items.length);
    if (items.length > 1 && next === last) next = (next + 1) % items.length;
    return this.selectReflectionTrack(next, !!autoplay);
  };


  function loadDataFromRoot(root) {
    var inlineId = root.getAttribute("data-story-json-id");
    var fallbackId = root.getAttribute("data-story-fallback-json-id");
    var url = root.getAttribute("data-story-url");

    if (inlineId) {
      try {
        return Promise.resolve(parseInlineStory(root, "data-story-json-id"));
      } catch (e) {
        return Promise.reject(new Error("Inline story JSON parse error: " + e.message));
      }
    }

    if (url) {
      return fetch(url, { credentials: "omit", cache: "no-store" }).then(function (response) {
        if (!response.ok) {
          throw new Error("Story data HTTP " + response.status);
        }
        return response.json();
      }).then(function (remoteData) {
        var expectedNumber = Number(root.getAttribute("data-story-number")) || 0;
        var expectedSlug = safeText(root.getAttribute("data-story-slug")).trim();
        var remoteNumber = Number(remoteData && (remoteData.number || (remoteData.meta && remoteData.meta.number))) || 0;
        var remoteSlug = safeText(remoteData && (remoteData.slug || remoteData.id || (remoteData.meta && remoteData.meta.slug))).trim();
        if ((expectedNumber && remoteNumber !== expectedNumber) || (expectedSlug && remoteSlug !== expectedSlug)) {
          throw new Error("Story data identity mismatch: expected " + expectedNumber + "/" + expectedSlug + ", received " + remoteNumber + "/" + remoteSlug);
        }
        var baseUrl = root.getAttribute("data-story-base") || new URL(".", url).href;
        var remoteVersion = safeText(remoteData && (remoteData.assetVersion || remoteData.updatedAt || remoteData.version) || root.getAttribute("data-asset-version") || "").trim();
        return resolveStoryAssetPaths(remoteData, baseUrl, remoteVersion);
      }).catch(function (fetchError) {
        if (!fallbackId) throw fetchError;
        try {
          console.warn("[Tistory100 Story Engine] Remote story data unavailable; using embedded fallback.", fetchError);
          return parseInlineStory(root, "data-story-fallback-json-id");
        } catch (fallbackError) {
          throw new Error(fetchError.message + " / fallback: " + fallbackError.message);
        }
      });
    }

    if (fallbackId) {
      try {
        return Promise.resolve(parseInlineStory(root, "data-story-fallback-json-id"));
      } catch (e) {
        return Promise.reject(new Error("Fallback story JSON parse error: " + e.message));
      }
    }

    if (window.TS100_STORY_DATA) {
      var inlineBase = root.getAttribute("data-story-base");
      var windowVersion = safeText(window.TS100_STORY_DATA && (window.TS100_STORY_DATA.assetVersion || window.TS100_STORY_DATA.updatedAt || window.TS100_STORY_DATA.version) || root.getAttribute("data-asset-version") || "").trim();
      return Promise.resolve(resolveStoryAssetPaths(window.TS100_STORY_DATA, inlineBase, windowVersion));
    }

    return Promise.reject(new Error("No story data found."));
  }

  function boot() {
    qsa(document, ".ts100-app[data-auto-init='true'], .ts100-app[data-story-url], .ts100-app[data-story-json-id]").forEach(function (root) {
      if (root.__ts100Experience) {
        return;
      }
      loadDataFromRoot(root).then(function (data) {
        root.__ts100Experience = new TS100StoryExperience(root, data);
      }).catch(function (error) {
        root.innerHTML = '<div class="ts100-card ts100-frame" data-nosnippet><h2 class="ts100-section-title">이야기를 불러오지 못했습니다.</h2><p class="ts100-section-desc"></p></div>';
        var p = qs(root, ".ts100-section-desc");
        if (p) {
          p.textContent = error.message;
        }
        console.error("[Tistory100 Story Engine]", error);
      });
    });
  }

  window.TS100StoryExperience = TS100StoryExperience;
  window.TS100StoryEngine = {
    version: ENGINE_VERSION,
    boot: boot
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function cleanUrl(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    try {
      var url = new URL(raw, window.location.href);
      url.hash = "";
      return url.href;
    } catch (error) {
      return raw.split("#")[0];
    }
  }

  function upsertMeta(selector, attributes, content) {
    if (!content) return;
    var node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      Object.keys(attributes).forEach(function (key) {
        node.setAttribute(key, attributes[key]);
      });
      document.head.appendChild(node);
    }
    node.setAttribute("content", content);
  }

  function ensureCanonical(explicitCanonical) {
    var node = document.head.querySelector('link[rel="canonical"]');
    var canonical = cleanUrl(explicitCanonical);
    if (!canonical && node && node.href) canonical = cleanUrl(node.href);
    if (!canonical) canonical = cleanUrl(window.location.href.split("?")[0]);
    if (!node) {
      node = document.createElement("link");
      node.setAttribute("rel", "canonical");
      document.head.appendChild(node);
    }
    if (explicitCanonical || !node.href) node.setAttribute("href", canonical);
    return cleanUrl(node.href || canonical);
  }

  function makeStructuredData(config) {
    var schema = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": config.headline,
      "name": config.title,
      "description": config.description,
      "url": config.canonical,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": config.canonical
      },
      "inLanguage": "ko-KR",
      "articleSection": config.section,
      "keywords": config.keywords,
      "genre": ["인문", "교양", "사자성어 이야기"],
      "isAccessibleForFree": true,
      "isPartOf": {
        "@type": "CreativeWorkSeries",
        "name": "TimeStory VOL.01 · 사자성어 인생 이야기 100선",
        "url": "https://www.tistory100.com/"
      },
      "author": {
        "@type": "Organization",
        "name": "TimeStory",
        "url": "https://www.tistory100.com/"
      },
      "publisher": {
        "@type": "Organization",
        "name": "TimeStory",
        "url": "https://www.tistory100.com/"
      },
      "about": {
        "@type": "DefinedTerm",
        "name": "절처봉생",
        "alternateName": "絶處逢生",
        "description": "막다른 처지에서 뜻밖의 살길을 만난다는 뜻"
      }
    };
    if (config.image) schema.image = [config.image];
    return schema;
  }

  ready(function () {
    var root = document.getElementById("tistory100Story");
    if (!root) return;

    var title = root.getAttribute("data-seo-title") || root.getAttribute("data-share-title") || document.title || "TimeStory";
    var headline = root.getAttribute("data-seo-headline") || title;
    var description = root.getAttribute("data-seo-description") || "네 글자에 담긴 이야기를 읽고 오늘의 나를 생각해보세요.";
    var keywordsText = root.getAttribute("data-seo-keywords") || "";
    var keywords = keywordsText.split(",").map(function (item) { return item.trim(); }).filter(Boolean);
    var image = cleanUrl(root.getAttribute("data-seo-image"));
    var section = root.getAttribute("data-seo-section") || "인문 이야기";
    var canonical = ensureCanonical(root.getAttribute("data-seo-canonical"));

    upsertMeta('meta[name="description"]', { name: "description" }, description);
    upsertMeta('meta[name="keywords"]', { name: "keywords" }, keywords.join(", "));
    upsertMeta('meta[name="author"]', { name: "author" }, "TimeStory");

    upsertMeta('meta[property="og:type"]', { property: "og:type" }, "article");
    upsertMeta('meta[property="og:locale"]', { property: "og:locale" }, "ko_KR");
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name" }, "TimeStory");
    upsertMeta('meta[property="og:title"]', { property: "og:title" }, title);
    upsertMeta('meta[property="og:description"]', { property: "og:description" }, description);
    upsertMeta('meta[property="og:url"]', { property: "og:url" }, canonical);
    upsertMeta('meta[property="og:image"]', { property: "og:image" }, image);
    upsertMeta('meta[property="article:section"]', { property: "article:section" }, section);

    upsertMeta('meta[name="twitter:card"]', { name: "twitter:card" }, "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title" }, title);
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description);
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image" }, image);

    var oldJsonLd = document.getElementById("ts100ArticleJsonLd");
    if (oldJsonLd) oldJsonLd.remove();
    var jsonLd = document.createElement("script");
    jsonLd.id = "ts100ArticleJsonLd";
    jsonLd.type = "application/ld+json";
    jsonLd.textContent = JSON.stringify(makeStructuredData({
      title: title,
      headline: headline,
      description: description,
      keywords: keywords,
      image: image,
      section: section,
      canonical: canonical
    }));
    document.head.appendChild(jsonLd);
  });
})();

(function(){
  "use strict";

  function data(){
    var root=document.getElementById("tistory100Story");
    var title=(root&&root.getAttribute("data-share-title"))||document.title||"TimeStory";
    var desc=(document.querySelector('meta[name="description"]')||{}).content||"네 글자에 담긴 이야기를 읽고 오늘의 나를 생각해보세요.";
    var hiddenThumb=document.querySelector('div[style*="display:none"] img');
    var img=(document.querySelector('meta[property="og:image"]')||{}).content||(hiddenThumb&&hiddenThumb.src)||"";
    return {url:window.location.href,title:title,desc:desc,img:img};
  }

  function open(url){
    window.open(url,"_blank","noopener,noreferrer");
  }

  window.ts100ShareKakao=function(){
    var d=data();
    if(window.Kakao&&Kakao.Share&&Kakao.Share.sendDefault){
      try{
        if(!Kakao.isInitialized())Kakao.init("a6897bdb5b7785b0ffbe542d81886b93");
        Kakao.Share.sendDefault({
          objectType:"feed",
          content:{
            title:d.title,
            description:d.desc,
            imageUrl:d.img||"https://healingmart.github.io/tistory100-story-assets/thumbs/006.png?v=006-1",
            link:{mobileWebUrl:d.url,webUrl:d.url}
          }
        });
        return;
      }catch(e){}
    }
    window.ts100ShareCopy();
  };

  window.ts100ShareNaver=function(){
    var d=data();
    open("https://share.naver.com/web/shareView?url="+encodeURIComponent(d.url)+"&title="+encodeURIComponent(d.title));
  };

  window.ts100ShareFacebook=function(){
    var d=data();
    open("https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent(d.url));
  };

  window.ts100ShareX=function(){
    var d=data();
    open("https://twitter.com/intent/tweet?url="+encodeURIComponent(d.url)+"&text="+encodeURIComponent(d.title));
  };

  window.ts100ShareThreads=function(){
    var d=data();
    open("https://www.threads.net/intent/post?text="+encodeURIComponent(d.title+"\n"+d.url));
  };

  window.ts100ShareBand=function(){
    var d=data();
    open("https://band.us/plugin/share?body="+encodeURIComponent(d.title+"\r\n"+d.url));
  };

  window.ts100ShareTelegram=function(){
    var d=data();
    open("https://t.me/share/url?url="+encodeURIComponent(d.url)+"&text="+encodeURIComponent(d.title));
  };

  window.ts100ShareCopy=function(){
    var d=data();
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(d.url).then(function(){
        var root=document.getElementById("tistory100Story");
        if(root&&root.__ts100Experience){
          root.__ts100Experience.toast("링크를 복사했습니다.");
        }
      }).catch(function(){
        window.prompt("아래 주소를 복사하세요.",d.url);
      });
    }else{
      window.prompt("아래 주소를 복사하세요.",d.url);
    }
  };
})();
