/**
 * 娴忚鍣ㄧ鑴氭湰鐢熸垚鍣ㄣ€? *
 * 娉ㄦ剰锛? * 杩欓噷涓嶅啀浣跨敤 `someFunction.toString()` 鍔ㄦ€佹嫾鎺ュ墠绔唬鐮侊紝
 * 鍥犱负 Workers 鎵撳寘鍚庡彲鑳芥彃鍏ュ唴閮ㄨ緟鍔╃鍙凤紙渚嬪 __name锛夛紝
 * 鏈€缁堝湪娴忚鍣ㄦ墽琛屾椂鍙樻垚鏈畾涔夊彉閲忋€? *
 * 鐜板湪鐩存帴杩斿洖涓€娈靛浐瀹氳剼鏈枃鏈紝閬垮厤鏋勫缓鍣ㄦ敼鍐欒繍琛屾椂浠ｇ爜銆? */

export function getClientScript() {
  return `
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(text, type) {
    var el = $("status");
    if (!el) return;
    el.textContent = text;
    var stateClass = type === "err" ? "err" : "ok";
    el.className = el.dataset && el.dataset.metaStatus === "1"
      ? "starPanelMetaText status " + stateClass
      : "status " + stateClass;
  }

  function fmt(n, digits) {
    var d = digits == null ? 4 : digits;
    return Number.isFinite(n) ? n.toFixed(d) : "--";
  }

  function fmt1(n) {
    return Number.isFinite(n) ? n.toFixed(1) : "--";
  }

  function signNum(n, digits) {
    var d = digits == null ? 4 : digits;
    return Number.isFinite(n) ? ((n >= 0 ? "+" : "") + n.toFixed(d)) : "--";
  }

  function signPct(n) {
    return Number.isFinite(n) ? ((n >= 0 ? "+" : "") + n.toFixed(2) + "%") : "--";
  }

  function fmtPrice(n) {
    if (!Number.isFinite(n)) return "--";
    return n >= 1000 ? n.toFixed(2) : n.toFixed(2);
  }

  function signPrice(n) {
    return Number.isFinite(n) ? ((n >= 0 ? "+" : "") + n.toFixed(2)) : "--";
  }

  function fmtFundPrice(n) {
    return Number.isFinite(n) ? n.toFixed(3) : "--";
  }

  function signFundPrice(n) {
    return Number.isFinite(n) ? ((n >= 0 ? "+" : "") + n.toFixed(3)) : "--";
  }

  function fmtPeRatio(n, isLoss) {
    if (isLoss) return "\u4e8f\u635f";
    return Number.isFinite(n) ? n.toFixed(2) : "--";
  }

  function fmtTargetPrice(n) {
    return Number.isFinite(n) ? n.toFixed(2) : "--";
  }

  function fmtTargetPct(n) {
    return Number.isFinite(n) ? ((n >= 0 ? "+" : "") + n.toFixed(2) + "%") : "--";
  }

  function fmtMarketCapCN(value) {
    var text = String(value == null ? "" : value).trim();
    return text || "--";
  }

  function targetToneStyle(n) {
    if (!Number.isFinite(n)) {
      return "color: rgba(200,214,236,.84);";
    }

    var intensity = clamp(Math.abs(n) / 60, 0, 1);
    if (n >= 0) {
      var upAlpha = 0.76 + intensity * 0.24;
      var upGlow = 0.18 + intensity * 0.26;
      return "color: rgba(255,92,120," + upAlpha.toFixed(3) + "); text-shadow: 0 0 14px rgba(255,77,109," + upGlow.toFixed(3) + ");";
    }

    var downAlpha = 0.76 + intensity * 0.24;
    var downGlow = 0.18 + intensity * 0.26;
    return "color: rgba(72,232,122," + downAlpha.toFixed(3) + "); text-shadow: 0 0 14px rgba(34,197,94," + downGlow.toFixed(3) + ");";
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setImageRefreshState(img, state) {
    if (!img || !img.dataset) return;
    img.dataset.searchRefreshState = state;
  }

  async function refreshSearchMetaForIcon(symbol) {
    if (!symbol) return null;
    var res = await fetch(
      "/api/search-meta?symbol=" + encodeURIComponent(symbol) + "&refresh=1&_ts=" + Date.now(),
      {
        cache: "no-store"
      }
    );
    if (!res.ok) return null;
    var payload = await res.json();
    return payload && payload.ok ? payload.meta : null;
  }

  async function handleSearchIconError(img) {
    if (!img || !img.dataset) return;
    if (img.dataset.searchRefreshState === "pending" || img.dataset.searchRefreshState === "done") {
      return;
    }

    var symbol = String(img.dataset.searchSymbol || "").trim().toUpperCase();
    if (!symbol) {
      setImageRefreshState(img, "done");
      return;
    }

    setImageRefreshState(img, "pending");

    try {
      var meta = await refreshSearchMetaForIcon(symbol);
      var nextSrc = meta && (meta.iconLight || meta.iconDark);
      if (nextSrc && nextSrc !== img.currentSrc && nextSrc !== img.src) {
        img.src = nextSrc;
        setImageRefreshState(img, "done");
        return;
      }
    } catch (error) {
      console.error("search icon refresh failed:", error);
    }

    setImageRefreshState(img, "done");
    img.classList.add("icon-failed");
  }

  try {
    var configNode = $("app-config");
    var APP_CONFIG = configNode ? JSON.parse(configNode.textContent || "{}") : {};

    var META = APP_CONFIG.meta || [];
    var PERIOD_LABELS = APP_CONFIG.periodLabels || {};
    var INDEX_SOURCES = Array.isArray(APP_CONFIG.indexSources) ? APP_CONFIG.indexSources : [];
    var UP_COLOR = APP_CONFIG.upColor || "rgba(255,77,109,.95)";
    var DOWN_COLOR = APP_CONFIG.downColor || "rgba(34,197,94,.95)";

    function normalizeIndexSource(value) {
      return String(value || "").toLowerCase() === "google" ? "google" : "yahoo";
    }

    function indexSourceConfig(source) {
      var key = normalizeIndexSource(source);
      return INDEX_SOURCES.find(function (item) { return item && item.key === key; }) || {
        key: key,
        label: key === "google" ? "谷歌财经" : "雅虎台湾",
        periods: key === "google"
          ? ["1D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"]
          : ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"]
      };
    }

    function sourceSupportsPeriod(source, period) {
      return indexSourceConfig(source).periods.indexOf(period) >= 0;
    }

    var dtfBJ = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    function fmtBJ(ms) {
      return dtfBJ.format(new Date(ms)).replaceAll("/", "-") + "\uff08\u5317\u4eac\uff09";
    }

    var dtfBJSeconds = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });

    function fmtBJSeconds(ms) {
      return dtfBJSeconds.format(new Date(ms)).replaceAll("/", "-");
    }

    function latestDataText(ms) {
      return Number.isFinite(ms) ? ("\u6700\u65b0\u6570\u636e\uff1a" + fmtBJ(ms)) : "\u6700\u65b0\u6570\u636e\uff1a--";
    }

    function latestTradeDateText(dateText) {
      return dateText ? ("\u6700\u65b0\u6570\u636e\uff1a" + String(dateText)) : "\u6700\u65b0\u6570\u636e\uff1a--";
    }

    function setOverviewCurrentPeriod(period) {
      var el = $("idxCurrentPeriod");
      if (!el) return;
      el.textContent = "\u5f53\u524d\u5468\u671f\uff1a" + (PERIOD_LABELS[period] || period);
    }

    var CARD_TIME_ANOMALY_MS = 5 * 60 * 60 * 1000;

    function isCardLatestTimeAnomaly(ms, referenceMs) {
      return Number.isFinite(ms) &&
        Number.isFinite(referenceMs) &&
        Math.abs(ms - referenceMs) >= CARD_TIME_ANOMALY_MS;
    }

    function cardLatestTimeText(ms, referenceMs) {
      var label = isCardLatestTimeAnomaly(ms, referenceMs) ? "\u5f02\u5e38\u65f6\u95f4" : "\u6700\u65b0\u65f6\u95f4";
      return Number.isFinite(ms) ? (label + " " + fmtBJSeconds(ms)) : (label + " --");
    }

    function fundTradeDateText(dateText) {
      return dateText ? ("\u6700\u65b0\u65e5\u671f " + String(dateText)) : "\u6700\u65b0\u65e5\u671f --";
    }

    function calcNumberText(value, digits) {
      var n = Number(value);
      if (!Number.isFinite(n)) return "--";
      return n.toFixed(Number.isFinite(digits) ? digits : 4);
    }

    function calcPctText(value) {
      var n = Number(value);
      if (!Number.isFinite(n)) return "--";
      return (n > 0 ? "+" : "") + n.toFixed(4) + "%";
    }

    function calcTimeText(ms) {
      return Number.isFinite(ms) ? fmtBJSeconds(ms) : "--";
    }

    function cardLatestTimeClass(ms, referenceMs) {
      return isCardLatestTimeAnomaly(ms, referenceMs) ? " cardTimeAnomaly" : "";
    }

    function getSparklineValues(item) {
      return (item && Array.isArray(item.sparkline) ? item.sparkline : []).filter(function (value) {
        return Number.isFinite(value);
      });
    }

    function sparklineSvgHTML(item, className) {
      var values = getSparklineValues(item);
      if (values.length < 2) return "";

      var width = 120;
      var height = 42;
      var padX = 2;
      var padY = 3;
      var min = Math.min.apply(null, values);
      var max = Math.max.apply(null, values);
      var span = max - min;
      var points = values.map(function (value, index) {
        var x = padX + ((width - padX * 2) * index / Math.max(1, values.length - 1));
        var y;
        if (span <= 0) {
          y = height / 2;
        } else {
          y = padY + (max - value) * ((height - padY * 2) / span);
        }
        return x.toFixed(2) + "," + y.toFixed(2);
      }).join(" ");

      var lastX = padX + (width - padX * 2);
      var lastY = span <= 0
        ? height / 2
        : padY + (max - values[values.length - 1]) * ((height - padY * 2) / span);

      return [
        '<div class="' + className + " " + starToneClass(item) + '">',
          '<svg viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true" focusable="false">',
            '<polyline points="' + points + '" />',
            '<circle cx="' + lastX.toFixed(2) + '" cy="' + lastY.toFixed(2) + '" r="2.6" />',
          '</svg>',
        '</div>'
      ].join("");
    }

    var canvas = $("c");
    var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;

    if (!canvas || !ctx) {
      setStatus("\u672a\u627e\u5230\u56fe\u8868\u5bb9\u5668", "err");
      return;
    }

    var DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    var API_TIMEOUT_MS = 15000;
    var OVERVIEW_API_TIMEOUT_MS = 30000;
    var INDEX_WEIGHTS_API_VERSION = "weights-ui-2";
    var INDEX_WEIGHTS_LOCAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
    var INDEX_WEIGHTS_LOCAL_CACHE_SCHEMA = 1;
    var INDEX_WEIGHTS_LOCAL_CACHE_PREFIX = "nasdaqDashboard.indexWeights." + INDEX_WEIGHTS_API_VERSION + ".";
    var SP500_SECTOR_API_VERSION = "20260406a";
    var FUND_PREMIUM_API_VERSION = "20260415b";
    var COMMON_WEIGHTS_CODE = "COMMON";
    var WEIGHTS_INDEX_OPTIONS = [
      { code: COMMON_WEIGHTS_CODE, label: "\\u5171\\u540c\\u6210\\u4efd\\u80a1" },
      { code: "NDXTMC", label: "\\u7eb3\\u6307\\u79d1\\u6280\\u52a0\\u6743" },
      { code: "SP500-45", label: "\\u6807\\u666e\\u4fe1\\u606f\\u79d1\\u6280" },
      { code: "NDX", label: "\\u7eb3\\u65af\\u8fbe\\u514b100" }
    ];
    var COMMON_WEIGHT_INDEX_OPTIONS = WEIGHTS_INDEX_OPTIONS.filter(function (option) {
      return option.code !== COMMON_WEIGHTS_CODE;
    });
    function weightIndexLabel(indexCode) {
      var option = WEIGHTS_INDEX_OPTIONS.find(function (item) {
        return item.code === indexCode;
      });
      return option ? option.label : indexCode;
    }
    function commonIndexLabelsText() {
      return COMMON_WEIGHT_INDEX_OPTIONS.map(function (item) {
        return item.label;
      }).join("\\u3001");
    }
    var FEAR_GREED_PALETTE = [
      { key: "extreme fear", label: "\u6781\u5ea6\u6050\u614c", color: "#ff5468", bandIndex: 0, maxExclusive: 25, lines: ["\u6781\u5ea6", "\u6050\u614c"] },
      { key: "fear", label: "\u6050\u614c", color: "#ff9ea4", bandIndex: 1, maxExclusive: 45, lines: ["\u6050\u614c"] },
      { key: "neutral", label: "\u4e2d\u6027", color: "#ffd449", bandIndex: 2, maxExclusive: 55, lines: ["\u4e2d\u6027"] },
      { key: "greed", label: "\u8d2a\u5a6a", color: "#8be3a3", bandIndex: 3, maxExclusive: 75, lines: ["\u8d2a\u5a6a"] },
      { key: "extreme greed", label: "\u6781\u5ea6\u8d2a\u5a6a", color: "#35ea72", bandIndex: 4, maxExclusive: 101, lines: ["\u6781\u5ea6", "\u8d2a\u5a6a"] }
    ];

    var state = {
      items: [],
      times: [],
      timeIndex: new Map(),
      hoverTime: null,
      period: "1D",
      indexSource: "yahoo",
      page: "overview"
    };

    var periodCache = new Map();
    var fearGreedCache = null;
    var starsState = {
      period: "1D",
      cache: new Map(),
      fetchCtrl: null,
      refreshTimer: null,
      statusText: "\u70b9\u51fb\u5468\u671f\u6309\u94ae\u540e\u52a0\u8f7d",
      statusType: "ok",
      ready: false,
      touched: false,
      mobileVisible: false
    };
    var starForwardPeState = {
      map: new Map(),
      fetchCtrl: null,
      loading: false,
      loaded: false,
      attempted: false
    };
    var starListState = {
      open: false,
      items: [],
      loading: false,
      saving: false,
      error: "",
      symbolInput: "",
      nameCNInput: ""
    };
    var sectorsState = {
      period: "1D",
      view: "heatmap",
      cache: new Map(),
      fetchCtrl: null,
      statusText: "\u8fdb\u5165\u9762\u677f\u540e\u52a0\u8f7d\u5f53\u524d\u5468\u671f\u6570\u636e",
      statusType: "ok",
      touched: false
    };
    var fundPremiumState = {
      cache: null,
      fetchCtrl: null,
      statusText: "\u8fdb\u5165\u9762\u677f\u540e\u52a0\u8f7d\u6700\u65b0\u57fa\u91d1\u884c\u60c5",
      statusType: "ok",
      touched: false,
      detailSymbol: null
    };
    var weightsState = {
      activeIndex: COMMON_WEIGHTS_CODE,
      cache: new Map(),
      fetchCtrl: null,
      commonCache: null,
      commonFetchCtrl: null,
      statusText: "\u8fdb\u5165\u9762\u677f\u540e\u52a0\u8f7d\u6700\u65b0\u6743\u91cd\u6587\u4ef6",
      statusType: "ok",
      commonStatusText: "\u8fdb\u5165\u9762\u677f\u540e\u52a0\u8f7d\u4e09\u4e2a\u6307\u6570\u7684\u5171\u540c\u6210\u4efd\u80a1",
      commonStatusType: "ok",
      touched: false
    };
    var activeFetchCtrl = null;
    var switchTimer = null;
    var refreshTimer = null;
    var weightsCacheCountdownTimer = null;
    var fundPremiumLongPressTimer = null;

    function getPanelTitle(page) {
      if (page === "stars") return "\u9762\u677f\uff1a\u660e\u661f\u79d1\u6280\u516c\u53f8";
      if (page === "weights") return "\u9762\u677f\uff1a\u79d1\u6280\u7c7b\u6307\u6570\u6743\u91cd";
      if (page === "sectors") return "\u9762\u677f\uff1a\u6807\u666e500\u677f\u5757ETF";
      if (page === "fundPremiums") return "\u9762\u677f\uff1a\u57fa\u91d1\u6298\u6ea2\u4ef7";
      return "\u9762\u677f\uff1a\u79d1\u6280\u7c7b\u6307\u6570\u4fe1\u606f";
    }

    function overviewCacheKey(period, source) {
      return normalizeIndexSource(source) + ":" + period;
    }

    function syncOverviewSourceControls() {
      var source = normalizeIndexSource(state.indexSource);
      var sourceSeg = $("indexSourceSeg");
      if (sourceSeg) {
        sourceSeg.querySelectorAll("button[data-index-source]").forEach(function (button) {
          button.classList.toggle("active", button.getAttribute("data-index-source") === source);
        });
      }

      var seg = $("seg");
      if (!seg) return;
      seg.querySelectorAll("button[data-p]").forEach(function (button) {
        var period = button.getAttribute("data-p");
        var supported = sourceSupportsPeriod(source, period);
        button.hidden = !supported;
        button.disabled = !supported;
        button.classList.toggle("active", supported && period === state.period);
      });
    }

    function switchIndexSource(source) {
      var nextSource = normalizeIndexSource(source);
      if (nextSource === state.indexSource) return;

      state.indexSource = nextSource;
      if (!sourceSupportsPeriod(nextSource, state.period)) {
        state.period = "1D";
      }
      state.hoverTime = null;
      periodCache.clear();
      syncOverviewSourceControls();

      if (state.page === "overview") {
        clearOverviewPanelData({ keepFearGreed: true });
        scheduleRender(state.period, { force: true, source: nextSource });
      }
    }

    function rebuildTimes() {
      var set = new Set();
      state.items.forEach(function (item) {
        (item.line || []).forEach(function (point) {
          set.add(point.t);
        });
      });
      state.times = Array.from(set).sort(function (a, b) { return a - b; });
      state.timeIndex = new Map(state.times.map(function (t, i) { return [t, i]; }));
    }

    function resizeCanvas() {
      DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      var rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * DPR);
      canvas.height = Math.floor(rect.height * DPR);
      draw();
    }

    new ResizeObserver(resizeCanvas).observe(canvas);

    function roundRect(drawCtx, x, y, w, h, r) {
      drawCtx.beginPath();
      drawCtx.moveTo(x + r, y);
      drawCtx.arcTo(x + w, y, x + w, y + h, r);
      drawCtx.arcTo(x + w, y + h, x, y + h, r);
      drawCtx.arcTo(x, y + h, x, y, r);
      drawCtx.arcTo(x, y, x + w, y, r);
      drawCtx.closePath();
    }

    function niceTicks(min, max, tickCount) {
      var count = tickCount == null ? 7 : tickCount;
      var span = max - min || 1;
      var raw = span / (count - 1);
      var pow10 = Math.pow(10, Math.floor(Math.log10(Math.abs(raw))));
      var candidates = [1, 2, 2.5, 5, 10].map(function (x) { return x * pow10; });
      var step = candidates[0];

      candidates.forEach(function (c) {
        if (Math.abs(raw - c) < Math.abs(raw - step)) {
          step = c;
        }
      });

      var start = Math.floor(min / step) * step;
      var ticks = [];
      for (var v = start; v <= max + step; v += step) ticks.push(v);
      return { step: step, ticks: ticks };
    }

    function pctRange() {
      var min = Infinity;
      var max = -Infinity;

      state.items.forEach(function (item) {
        (item.line || []).forEach(function (point) {
          if (!Number.isFinite(point.pct)) return;
          min = Math.min(min, point.pct);
          max = Math.max(max, point.pct);
        });
      });

      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return { min: -1, max: 1 };
      }

      var pad = (max - min) * 0.1 || 0.5;
      return { min: min - pad, max: max + pad };
    }

    function spanIsMultiDay() {
      if (state.times.length < 2) return false;
      return (new Date(state.times[state.times.length - 1]) - new Date(state.times[0])) > 36 * 3600 * 1000;
    }

    function axisLabelForTime(ms) {
      var d = new Date(ms);
      var yyyy = String(d.getUTCFullYear());
      var mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      var dd = String(d.getUTCDate()).padStart(2, "0");
      var hh = String(d.getUTCHours()).padStart(2, "0");
      var mi = String(d.getUTCMinutes()).padStart(2, "0");

      if (state.times.length >= 2) {
        var spanMs = state.times[state.times.length - 1] - state.times[0];
        if (spanMs > 730 * 24 * 3600 * 1000) return yyyy;
        if (spanMs > 90 * 24 * 3600 * 1000) return yyyy.slice(2) + "-" + mm;
      }

      return spanIsMultiDay() ? (mm + "-" + dd) : (hh + ":" + mi);
    }

    function measureEndLabelMaxWidth(font) {
      ctx.save();
      ctx.font = font;
      var maxW = 0;

      state.items.forEach(function (item) {
        var pct = item.cardChgPct;
        if (!Number.isFinite(pct)) return;
        var text = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
        maxW = Math.max(maxW, ctx.measureText(text).width);
      });

      ctx.restore();
      return maxW;
    }

    function drawEndLabels(args) {
      var padL = args.padL;
      var padT = args.padT;
      var plotW = args.plotW;
      var plotH = args.plotH;
      var yOf = args.yOf;
      var font = args.font;

      var x = padL + plotW + 10 * DPR;
      var labelH = 18 * DPR;
      var radius = 7 * DPR;
      var gap = 4 * DPR;
      var minSep = labelH + gap;

      ctx.save();
      ctx.font = font;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      var nodes = [];

      state.items.forEach(function (item) {
        var pct = item.cardChgPct;
        if (!Number.isFinite(pct)) return;

        var lastPoint = null;
        for (var i = state.times.length - 1; i >= 0; i--) {
          var t = state.times[i];
          var p = item.map && item.map.get(t);
          if (p && Number.isFinite(p.pct)) {
            lastPoint = p;
            break;
          }
        }

        if (!lastPoint) return;

        var text = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
        var textW = ctx.measureText(text).width;
        var w = Math.max(44 * DPR, textW + 14 * DPR);
        var yTarget = yOf(lastPoint.pct);
        nodes.push({ text: text, w: w, yTarget: yTarget, y: yTarget, pct: pct });
      });

      if (!nodes.length) {
        ctx.restore();
        return;
      }

      nodes.sort(function (a, b) { return a.yTarget - b.yTarget; });

      var yMin = padT + labelH / 2;
      var yMax = padT + plotH - labelH / 2;

      nodes.forEach(function (node) {
        node.y = Math.min(yMax, Math.max(yMin, node.y));
      });

      for (var i = 1; i < nodes.length; i++) {
        var prev = nodes[i - 1];
        var curr = nodes[i];
        if (curr.y - prev.y < minSep) curr.y = prev.y + minSep;
      }

      var overflow = nodes[nodes.length - 1].y - yMax;
      if (overflow > 0) {
        nodes.forEach(function (node) { node.y -= overflow; });
      }

      var topOverflow = yMin - nodes[0].y;
      if (topOverflow > 0) {
        nodes.forEach(function (node) { node.y += topOverflow; });
        for (var j = 1; j < nodes.length; j++) {
          var prev2 = nodes[j - 1];
          var curr2 = nodes[j];
          if (curr2.y - prev2.y < minSep) curr2.y = prev2.y + minSep;
        }
        var overflow2 = nodes[nodes.length - 1].y - yMax;
        if (overflow2 > 0) {
          nodes.forEach(function (node) { node.y -= overflow2; });
        }
      }

      nodes.forEach(function (node) {
        var bx = x;
        var by = node.y - labelH / 2;
        ctx.fillStyle = node.pct >= 0 ? UP_COLOR : DOWN_COLOR;
        roundRect(ctx, bx, by, node.w, labelH, radius);
        ctx.fill();
        ctx.fillStyle = "rgba(9,13,22,.92)";
        ctx.fillText(node.text, bx + 7 * DPR, node.y);
      });

      ctx.restore();
    }

    function draw() {
      var W = canvas.width;
      var H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (!state.items.length || state.times.length < 2) {
        ctx.save();
        ctx.fillStyle = "rgba(230,237,247,.55)";
        ctx.font = (14 * DPR) + "px ui-monospace";
        ctx.textAlign = "center";
        ctx.fillText("\u6682\u65e0\u6570\u636e", W / 2, H / 2);
        ctx.restore();
        return;
      }

      var cssW = canvas.getBoundingClientRect().width;
      var isMobile = cssW <= 980;

      var padL = 14 * DPR;
      var padT = 14 * DPR;
      var padB = 30 * DPR;

      var mono = getComputedStyle(document.documentElement).getPropertyValue("--mono").trim();
      var axisFont = (11 * DPR) + "px " + mono;
      var labelFont = (12 * DPR) + "px " + mono;

      var maxLabelTextW = measureEndLabelMaxWidth(labelFont);
      var maxLabelBoxW = Math.max(44 * DPR, maxLabelTextW + 14 * DPR);
      var padR = isMobile ? Math.max(68 * DPR, maxLabelBoxW + 26 * DPR) : 150 * DPR;

      var plotW = W - padL - padR;
      var plotH = H - padT - padB;

      var range = pctRange();
      var minP = range.min;
      var maxP = range.max;

      function yOf(pct) {
        return padT + (maxP - pct) * (plotH / (maxP - minP || 1));
      }

      var xStep = plotW / (state.times.length - 1);
      function xOf(i) {
        return padL + i * xStep;
      }

      ctx.save();
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid").trim();
      ctx.lineWidth = 1 * DPR;
      ctx.font = axisFont;
      ctx.fillStyle = "rgba(138,160,198,.92)";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      niceTicks(minP, maxP, 7).ticks.forEach(function (tick) {
        if (tick < minP || tick > maxP) return;
        var y = yOf(tick);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + plotW, y);
        ctx.stroke();
        ctx.fillText(tick.toFixed(2) + "%", padL + plotW + 8 * DPR, y);
      });

      var y0 = yOf(0);
      ctx.save();
      ctx.strokeStyle = "rgba(230,237,247,.18)";
      ctx.lineWidth = 1 * DPR;
      ctx.beginPath();
      ctx.moveTo(padL, y0);
      ctx.lineTo(padL + plotW, y0);
      ctx.stroke();
      ctx.restore();

      for (var k = 0; k <= 6; k++) {
        var x = padL + plotW * k / 6;
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
      }

      ctx.restore();

      ctx.save();
      ctx.font = labelFont;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      var lx = padL;
      var ly = padT + 6 * DPR;

      state.items.forEach(function (item) {
        var label = item.nameCN;
        ctx.fillStyle = item.color;
        ctx.fillRect(lx, ly + 4 * DPR, 10 * DPR, 10 * DPR);
        ctx.fillStyle = "rgba(230,237,247,.85)";
        ctx.fillText(label, lx + 16 * DPR, ly);

        lx += ctx.measureText(label).width + 40 * DPR;
        if (lx > padL + plotW - 260 * DPR) {
          lx = padL;
          ly += 18 * DPR;
        }
      });

      ctx.restore();

      var lineWidth = isMobile ? 1.35 * DPR : 2 * DPR;
      state.items.forEach(function (item) {
        var map = item.map;
        if (!map || map.size < 2) return;

        ctx.save();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        var started = false;
        ctx.beginPath();

        for (var i = 0; i < state.times.length; i++) {
          var t = state.times[i];
          var p = map.get(t);
          if (!p || !Number.isFinite(p.pct)) continue;
          var x = xOf(i);
          var y = yOf(p.pct);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
        ctx.restore();
      });

      ctx.save();
      ctx.fillStyle = "rgba(138,160,198,.92)";
      ctx.font = axisFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      for (var labelIndex = 0; labelIndex <= 6; labelIndex++) {
        var i2 = Math.floor((state.times.length - 1) * (labelIndex / 6));
        var x2 = xOf(i2);
        ctx.fillText(axisLabelForTime(state.times[i2]), x2, padT + plotH + 6 * DPR);
      }

      ctx.restore();

      drawEndLabels({ padL: padL, padT: padT, plotW: plotW, plotH: plotH, yOf: yOf, font: labelFont });

      if (state.hoverTime != null) {
        var hoverIndex = state.timeIndex.get(state.hoverTime);
        if (hoverIndex != null) {
          var hoverX = xOf(hoverIndex);

          ctx.save();
          ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--hair").trim();
          ctx.lineWidth = 1 * DPR;
          ctx.beginPath();
          ctx.moveTo(hoverX, padT);
          ctx.lineTo(hoverX, padT + plotH);
          ctx.stroke();

          var rows = [];
          rows.push("\u65f6\u95f4\uff1a " + fmtBJ(state.hoverTime));

          state.items.forEach(function (item) {
            var p = item.map && item.map.get(state.hoverTime);
            if (!p) return;

            if (Number.isFinite(p.pct)) {
              var dotY = yOf(p.pct);
              ctx.fillStyle = item.color;
              ctx.beginPath();
              ctx.arc(hoverX, dotY, 3.2 * DPR, 0, Math.PI * 2);
              ctx.fill();
            }

            rows.push(item.nameCN + "\uff1a " + p.close.toFixed(4) + "\uff08" + signPct(p.pct) + "\uff09");
          });

          ctx.font = labelFont;
          var pad = 10 * DPR;
          var w = Math.max.apply(null, rows.map(function (s) { return ctx.measureText(s).width; })) + pad * 2;
          var h = rows.length * 16 * DPR + pad * 2;

          var minX = padL;
          var maxX = padL + plotW - w;
          var bxTry = hoverX + 12 * DPR;
          if (bxTry + w > padL + plotW) {
            bxTry = hoverX - 12 * DPR - w;
          }

          var bx = maxX < minX ? minX : Math.min(maxX, Math.max(minX, bxTry));
          var by = padT + 12 * DPR;

          ctx.fillStyle = "rgba(9,13,22,.70)";
          ctx.strokeStyle = "rgba(31,43,61,.85)";
          roundRect(ctx, bx, by, w, h, 12 * DPR);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "rgba(230,237,247,.95)";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          rows.forEach(function (row, idx) {
            ctx.fillText(row, bx + pad, by + pad + idx * 16 * DPR);
          });

          ctx.restore();
        }
      }
    }

    function hitTestTime(evt) {
      var rect = canvas.getBoundingClientRect();
      var x = (evt.clientX - rect.left) * DPR;
      var y = (evt.clientY - rect.top) * DPR;
      var W = canvas.width;
      var cssW = rect.width;
      var isMobile = cssW <= 980;

      var padL = 14 * DPR;
      var padT = 14 * DPR;
      var padB = 30 * DPR;

      var mono = getComputedStyle(document.documentElement).getPropertyValue("--mono").trim();
      var labelFont = (12 * DPR) + "px " + mono;
      var maxLabelTextW = measureEndLabelMaxWidth(labelFont);
      var maxLabelBoxW = Math.max(44 * DPR, maxLabelTextW + 14 * DPR);
      var padR = isMobile ? Math.max(68 * DPR, maxLabelBoxW + 26 * DPR) : 150 * DPR;

      var plotW = W - padL - padR;
      var plotH = canvas.height - padT - padB;

      if (x < padL || x > padL + plotW || y < padT || y > padT + plotH) return null;

      var xStep = plotW / (state.times.length - 1);
      var i = Math.round((x - padL) / xStep);
      var idx = Math.max(0, Math.min(state.times.length - 1, i));
      return state.times[idx];
    }

    canvas.addEventListener("pointermove", function (evt) {
      var t = hitTestTime(evt);
      if (t !== state.hoverTime) {
        state.hoverTime = t;
        draw();
      }
    });

    canvas.addEventListener("pointerleave", function () {
      state.hoverTime = null;
      draw();
    });

    canvas.addEventListener("pointerdown", function (evt) {
      var t = hitTestTime(evt);
      if (t !== null) {
        state.hoverTime = t;
        draw();
      }
    });

    function tileHTML(item, period) {
      var is1D = period === "1D";
      var baseLabel = is1D ? "\u6628\u6536" : "\u8d77\u70b9";
      var chgLabel = is1D ? "\u6da8\u8dcc" : "\u533a\u95f4\u6da8\u8dcc";
      var pctLabel = is1D ? "\u6da8\u8dcc\u5e45" : "\u533a\u95f4\u6da8\u8dcc\u5e45";
      var cls = "flat";
      if (Number.isFinite(item.cardChg)) {
        cls = item.cardChg > 0 ? "up" : (item.cardChg < 0 ? "down" : "flat");
      }

      return [
        '<article class="idxTile ' + cls + '">',
          '<div class="idxTileTop">',
            '<div class="idxIdentity">',
              '<div class="idxIconWrap">',
                item.iconLight
                  ? '<img class="idxIcon" src="' + esc(item.iconLight) + '" alt="' + esc(item.nameCN) + '" loading="lazy" data-search-symbol="' + esc(item.iconSymbol || item.symbol) + '" data-search-refresh-state="idle" />'
                  : '<span class="idxDot" style="background:' + item.color + '"></span>',
              '</div>',
              '<div class="idxTitleBox">',
                '<div class="idxName" title="' + esc(item.nameCN) + '">' + esc(item.nameCN) + '</div>',
                '<div class="idxSymbol">' + esc(item.symbol) + '</div>',
              '</div>',
            '</div>',
          '</div>',
          '<div class="idxMainValue">',
            '<strong>' + fmt(item.lastClose, 2) + '</strong>',
            '<span>\u6700\u65b0</span>',
          '</div>',
          '<div class="idxMetrics">',
            '<div>' + baseLabel + '</div><div>' + fmt(item.cardBaseClose, 2) + '</div>',
            '<div>' + chgLabel + '</div><div class="' + cls + '">' + signNum(item.cardChg, 2) + '</div>',
            '<div>' + pctLabel + '</div><div class="' + cls + '">' + signPct(item.cardChgPct) + '</div>',
          '</div>',
        '</article>'
      ].join("");
    }

    function overviewHeatItem(item, period, referenceLatestT) {
      return {
        symbol: item.symbol,
        icon: item.iconLight || "",
        nameCN: item.nameCN,
        latestT: item.latestT,
        referenceLatestT: referenceLatestT,
        lastClose: item.lastClose,
        baseClose: item.cardBaseClose,
        change: item.cardChg,
        changePct: item.cardChgPct,
        baseLabel: period === "1D" ? "\u6628\u6536" : "\u8d77\u70b9",
        period: period,
        showSparkline: false,
      };
    }

    function fearGreedMeta(score, rating, ratingCN) {
      var key = String(rating || "").toLowerCase().trim();
      var matchedByKey = FEAR_GREED_PALETTE.find(function (entry) {
        return entry.key === key;
      });

      if (matchedByKey) {
        return {
          label: ratingCN || matchedByKey.label,
          color: matchedByKey.color,
          bandIndex: matchedByKey.bandIndex
        };
      }

      if (Number.isFinite(score)) {
        var matchedByScore = FEAR_GREED_PALETTE.find(function (entry) {
          return score < entry.maxExclusive;
        }) || FEAR_GREED_PALETTE[FEAR_GREED_PALETTE.length - 1];

        return {
          label: ratingCN || matchedByScore.label,
          color: matchedByScore.color,
          bandIndex: matchedByScore.bandIndex
        };
      }

      return { label: "\u6682\u65e0\u6570\u636e", color: "#94a3b8", bandIndex: null };
    }

    function hexToRgba(hex, alpha) {
      var clean = String(hex || "").replace("#", "");
      if (clean.length !== 6) return "rgba(255,255,255," + alpha + ")";
      return "rgba(" +
        parseInt(clean.slice(0, 2), 16) + "," +
        parseInt(clean.slice(2, 4), 16) + "," +
        parseInt(clean.slice(4, 6), 16) + "," + alpha + ")";
    }

    function gaugeAngleForScore(score) {
      return 180 - clamp(score, 0, 100) * 1.8;
    }

    function gaugePoint(cx, cy, radius, angle) {
      var rad = angle * Math.PI / 180;
      return {
        x: cx + Math.cos(rad) * radius,
        y: cy - Math.sin(rad) * radius
      };
    }

    function donutSegmentPath(cx, cy, outerR, innerR, startAngle, endAngle) {
      var outerStart = gaugePoint(cx, cy, outerR, startAngle);
      var outerEnd = gaugePoint(cx, cy, outerR, endAngle);
      var innerEnd = gaugePoint(cx, cy, innerR, endAngle);
      var innerStart = gaugePoint(cx, cy, innerR, startAngle);

      return [
        "M", outerStart.x.toFixed(2), outerStart.y.toFixed(2),
        "A", outerR, outerR, 0, 0, 1, outerEnd.x.toFixed(2), outerEnd.y.toFixed(2),
        "L", innerEnd.x.toFixed(2), innerEnd.y.toFixed(2),
        "A", innerR, innerR, 0, 0, 0, innerStart.x.toFixed(2), innerStart.y.toFixed(2),
        "Z"
      ].join(" ");
    }

    function buildGaugeDots(cx, cy, radius) {
      var dots = [];

      for (var score = 0; score <= 100; score += 5) {
        var angle = gaugeAngleForScore(score);
        var point = gaugePoint(cx, cy, radius, angle);
        var dotRadius = score % 25 === 0 ? 2.4 : 1.55;
        dots.push(
          '<circle cx="' + point.x.toFixed(2) + '" cy="' + point.y.toFixed(2) + '" r="' + dotRadius + '" fill="rgba(210,218,230,.58)"></circle>'
        );
      }

      return dots.join("");
    }

    function buildGaugeScaleValues(cx, cy, radius) {
      var points = [
        { value: 0, x: cx - 106, y: cy - 2, anchor: "start" },
        { value: 25, point: gaugePoint(cx, cy, radius, 135), anchor: "middle" },
        { value: 50, point: gaugePoint(cx, cy, radius - 2, 90), anchor: "middle" },
        { value: 75, point: gaugePoint(cx, cy, radius, 45), anchor: "middle" },
        { value: 100, x: cx + 106, y: cy - 2, anchor: "end" }
      ];

      return points.map(function (entry) {
        var x = entry.point ? entry.point.x : entry.x;
        var y = entry.point ? entry.point.y : entry.y;
        return '<text class="fgGaugeValueLabel" x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" text-anchor="' + entry.anchor + '" dominant-baseline="middle">' + entry.value + '</text>';
      }).join("");
    }

    function buildGaugeSectionLabel(cx, cy, radius, startAngle, endAngle, lines, color, active) {
      var midAngle = (startAngle + endAngle) / 2;
      var point = gaugePoint(cx, cy, radius, midAngle);
      var rotation = 90 - midAngle;
      var fill = active ? "rgba(248,250,252,.98)" : "rgba(236,241,247,.88)";
      var spans = "";

      if (lines.length === 1) {
        spans = '<tspan x="' + point.x.toFixed(2) + '" dy="0">' + lines[0] + '</tspan>';
      } else {
        spans =
          '<tspan x="' + point.x.toFixed(2) + '" dy="-0.48em">' + lines[0] + '</tspan>' +
          '<tspan x="' + point.x.toFixed(2) + '" dy="1.05em">' + lines[1] + '</tspan>';
      }

      return '<text class="fgSectionLabel" fill="' + fill + '" x="' + point.x.toFixed(2) + '" y="' + point.y.toFixed(2) + '" text-anchor="middle" transform="rotate(' + rotation.toFixed(2) + ' ' + point.x.toFixed(2) + ' ' + point.y.toFixed(2) + ')">' + spans + '</text>';
    }

    function buildFearGreedGauge(score, meta) {
      var value = clamp(Number.isFinite(score) ? score : 0, 0, 100);
      var cx = 180;
      var cy = 194;
      var outerR = 160;
      var innerR = 110;
      var needleLength = 118;
      var needleAngle = gaugeAngleForScore(value);
      var needlePoint = gaugePoint(cx, cy, needleLength, needleAngle);
      var sections = [
        { start: 180, end: 135, palette: FEAR_GREED_PALETTE[0] },
        { start: 135, end: 99, palette: FEAR_GREED_PALETTE[1] },
        { start: 99, end: 81, palette: FEAR_GREED_PALETTE[2] },
        { start: 81, end: 45, palette: FEAR_GREED_PALETTE[3] },
        { start: 45, end: 0, palette: FEAR_GREED_PALETTE[4] }
      ];

      var sectionMarkup = sections.map(function (section, index) {
        var active = meta.bandIndex === index;
        var fill = active ? hexToRgba(section.palette.color, 0.28) : "rgba(255,255,255,.055)";
        var stroke = active ? section.palette.color : "rgba(255,255,255,.09)";
        return [
          '<path d="' + donutSegmentPath(cx, cy, outerR, innerR, section.start, section.end) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2"></path>',
          buildGaugeSectionLabel(cx, cy, 138, section.start, section.end, section.palette.lines, section.palette.color, active)
        ].join("");
      }).join("");

      return [
        '<div class="fgGaugeWrap">',
          '<div class="fgGaugeBox" style="--fg-current-accent:' + meta.color + ';">',
            '<svg class="fgGaugeSvg" viewBox="0 0 360 220" aria-hidden="true">',
              sectionMarkup,
              '<path class="fgGaugeInnerArc" d="M68 194 A112 112 0 0 1 292 194"></path>',
              buildGaugeDots(cx, cy, 96),
              buildGaugeScaleValues(cx, cy, 82),
              '<line class="fgNeedle" x1="' + cx + '" y1="' + cy + '" x2="' + needlePoint.x.toFixed(2) + '" y2="' + needlePoint.y.toFixed(2) + '" stroke="' + meta.color + '" stroke-width="6"></line>',
              '<circle class="fgNeedleHubOuter" cx="' + cx + '" cy="' + cy + '" r="10" fill="' + meta.color + '"></circle>',
              '<circle class="fgNeedleHubInner" cx="' + cx + '" cy="' + cy + '" r="4" fill="rgba(9,13,22,.96)"></circle>',
            '</svg>',
            '<div class="fgGaugeCenter">',
              '<div class="fgGaugeScore">' + fmt1(score) + '</div>',
            '</div>',
          '</div>',
        '</div>'
      ].join("");
    }

    function buildFearGreedMetric(title, point, extraClass) {
      var metricClass = "fgMetric" + (extraClass ? (" " + extraClass) : "");
      var score = point && Number.isFinite(point.score) ? fmt1(point.score) : "--";
      var status = point && point.ratingCN ? point.ratingCN : "\u6682\u65e0\u6570\u636e";
      var pointMeta = fearGreedMeta(
        point && Number.isFinite(point.score) ? point.score : NaN,
        point ? point.rating : null,
        point ? point.ratingCN : null
      );
      var accent = pointMeta.color;
      var accentSoft = hexToRgba(accent, 0.15);
      var accentBorder = hexToRgba(accent, 0.22);

      return [
        '<div class="' + metricClass + '" style="--fg-accent:' + accent + ';--fg-accent-soft:' + accentSoft + ';--fg-accent-border:' + accentBorder + ';">',
          '<span>' + esc(title) + '</span>',
          '<b>' + score + '</b>',
          '<em>' + esc(status) + '</em>',
        '</div>'
      ].join("");
    }

    function renderFearGreedCard(data) {
      var root = $("fearGreedCard");
      if (!root) return;

      if (!data || !Number.isFinite(data.score)) {
        root.innerHTML = [
          '<div class="tile fgCard">',
            '<div class="fgCardHead">',
              '<div>',
                '<div class="fgEyebrow">\u5e02\u573a\u60c5\u7eea</div>',
                '<div class="fgTitle">CNN \u6050\u60e7\u8d2a\u5a6a\u6307\u6570</div>',
              '</div>',
            '</div>',
            '<div class="fgEmpty">\u6682\u65f6\u65e0\u6cd5\u52a0\u8f7d CNN \u6050\u60e7\u8d2a\u5a6a\u6307\u6570</div>',
          '</div>'
        ].join("");
        return;
      }

      var meta = fearGreedMeta(data.score, data.rating, data.ratingCN);
      var gaugeHtml = buildFearGreedGauge(data.score, meta);
      var currentPoint = { score: data.score, rating: data.rating, ratingCN: meta.label };

      root.innerHTML = [
        '<div class="tile fgCard">',
          '<div class="fgCardHead">',
            '<div>',
              '<div class="fgEyebrow">\u5e02\u573a\u60c5\u7eea</div>',
              '<div class="fgTitle">CNN \u6050\u60e7\u8d2a\u5a6a\u6307\u6570</div>',
            '</div>',
            '<div class="fgBadge" style="color:' + meta.color + ';background:' + meta.color + '14;border-color:' + meta.color + '33;">' + esc(meta.label) + '</div>',
          '</div>',
          '<div class="fgCardInner">',
            gaugeHtml,
            '<div class="fgData">',
              '<div class="fgStats">',
                buildFearGreedMetric("\u6700\u65b0", currentPoint, "fgMetricMain"),
                buildFearGreedMetric("\u4e00\u5468\u524d", data.previous1Week),
                buildFearGreedMetric("\u4e00\u6708\u524d", data.previous1Month),
                buildFearGreedMetric("\u4e00\u5e74\u524d", data.previous1Year),
              '</div>',
            '</div>',
          '</div>',
        '</div>'
      ].join("");
    }

    function renderFearGreedLoading() {
      var root = $("fearGreedCard");
      if (!root) return;

      root.innerHTML = [
        '<div class="tile fgCard">',
          '<div class="fgCardHead">',
            '<div>',
              '<div class="fgEyebrow">\u5e02\u573a\u60c5\u7eea</div>',
              '<div class="fgTitle">CNN \u6050\u60e7\u8d2a\u5a6a\u6307\u6570</div>',
            '</div>',
          '</div>',
          '<div class="fgEmpty">\u6b63\u5728\u52a0\u8f7d CNN \u6050\u60e7\u8d2a\u5a6a\u6307\u6570...</div>',
        '</div>'
      ].join("");
    }

    function isDesktopPageMode() {
      return window.innerWidth > 980;
    }

    function starToneClass(item) {
      if (!Number.isFinite(item && item.change)) return "flat";
      if (item.change > 0) return "up";
      if (item.change < 0) return "down";
      return "flat";
    }

    function starSortScore(item) {
      return Number.isFinite(item && item.changePct) ? item.changePct : -Infinity;
    }

    function sortStarItems(items) {
      return (items || []).slice().sort(function (a, b) {
        var pctDelta = starSortScore(b) - starSortScore(a);
        if (Math.abs(pctDelta) > 1e-9) return pctDelta;

        var changeDelta = (Number.isFinite(b && b.change) ? b.change : -Infinity) - (Number.isFinite(a && a.change) ? a.change : -Infinity);
        if (Math.abs(changeDelta) > 1e-9) return changeDelta;

        return String(a && a.symbol || "").localeCompare(String(b && b.symbol || ""));
      });
    }

    function captureStarPositions(root) {
      var positions = new Map();
      if (!root) return positions;

      root.querySelectorAll(".starCard[data-symbol], .sectorHeatTile[data-symbol], .sectorBarRow[data-symbol]").forEach(function (node) {
        var rect = node.getBoundingClientRect();
        positions.set(node.getAttribute("data-symbol"), {
          left: rect.left,
          top: rect.top
        });
      });

      return positions;
    }

    function captureScrollLeft(root, selector) {
      var node = root && root.querySelector ? root.querySelector(selector) : null;
      return node ? node.scrollLeft : 0;
    }

    function restoreScrollLeft(root, selector, scrollLeft) {
      var node = root && root.querySelector ? root.querySelector(selector) : null;
      if (!node || !Number.isFinite(scrollLeft)) return;
      node.scrollLeft = scrollLeft;
    }

    function animateStarCards(root, previousPositions) {
      if (!root || !previousPositions || !previousPositions.size) return;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      root.querySelectorAll(".starCard[data-symbol], .sectorHeatTile[data-symbol], .sectorBarRow[data-symbol]").forEach(function (node) {
        var symbol = node.getAttribute("data-symbol");
        var previous = previousPositions.get(symbol);
        var currentRect = node.getBoundingClientRect();

        if (!previous) {
          if (node.animate) {
            node.animate(
              [
                { opacity: 0, transform: "translateY(12px) scale(0.985)" },
                { opacity: 1, transform: "translateY(0) scale(1)" }
              ],
              {
                duration: 320,
                easing: "cubic-bezier(0.22,1,0.36,1)",
                fill: "both"
              }
            );
          } else {
            node.style.transition = "none";
            node.style.opacity = "0";
            node.style.transform = "translateY(12px) scale(0.985)";
            requestAnimationFrame(function () {
              node.style.transition = "transform 380ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease";
              node.style.opacity = "1";
              node.style.transform = "translate(0, 0) scale(1)";
            });
          }
          return;
        }

        var deltaX = previous.left - currentRect.left;
        var deltaY = previous.top - currentRect.top;
        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

        if (node.animate) {
          node.animate(
            [
              { transform: "translate(" + deltaX + "px," + deltaY + "px)" },
              { transform: "translate(0, 0)" }
            ],
            {
              duration: 420,
              easing: "cubic-bezier(0.22,1,0.36,1)",
              fill: "both"
            }
          );
        } else {
          node.style.transition = "none";
          node.style.transform = "translate(" + deltaX + "px," + deltaY + "px)";

          requestAnimationFrame(function () {
            node.style.transition = "transform 420ms cubic-bezier(0.22,1,0.36,1)";
            node.style.transform = "translate(0, 0)";
          });
        }
      });
    }

    function starCardHTML(item) {
      var tone = starToneClass(item);
      return [
        '<article class="starCard ' + tone + '" data-symbol="' + esc(item.symbol) + '">',
          '<div class="starCardTop">',
            '<div class="starIdentity">',
              '<div class="starIconWrap">',
                '<img class="starIcon" src="' + esc(item.icon) + '" alt="' + esc(item.symbol) + '" loading="lazy" data-search-symbol="' + esc(item.symbol) + '" data-search-refresh-state="idle" />',
              '</div>',
              '<div class="starNameBox">',
                '<div class="starName">' + esc(item.nameCN) + '</div>',
                '<div class="starSymbol">' + esc(item.symbol) + '</div>',
              '</div>',
            '</div>',
            '<div class="starDeltaChip">' + signPct(item.changePct) + '</div>',
          '</div>',
          '<div class="starBody">',
            '<div class="starPrice">',
              '<div class="starPriceValue">' + fmtPrice(item.lastClose) + '</div>',
              '<div class="starPeriodTag">' + esc(item.baseLabel || "\u8d77\u70b9") + '</div>',
            '</div>',
            '<div class="starMetrics">',
              '<div>\u57fa\u51c6</div><div>' + fmtPrice(item.baseClose) + '</div>',
              '<div>\u6da8\u8dcc</div><div><strong>' + signPrice(item.change) + '</strong></div>',
              '<div>\u524d\u77bbPE</div><div>' + fmtPeRatio(item.peRatioFwd) + '</div>',
            '</div>',
            '<div class="starCardLatest' + cardLatestTimeClass(item.latestT, item.referenceLatestT) + '">' + esc(cardLatestTimeText(item.latestT, item.referenceLatestT)) + '</div>',
          '</div>',
        '</article>'
      ].join("");
    }

    function renderStarPanel() {
      var root = $("starTechPanel");
      if (!root) return;

      var previousPositions = captureStarPositions(root);
      var periodScrollLeft = captureScrollLeft(root, "#starPeriodSeg");
      var periodLabel = PERIOD_LABELS[starsState.period] || starsState.period;
      var cached = starsState.cache.get(starsState.period);
      var items = cached && cached.items ? sortStarItems(cached.items.map(function (item) {
        var metrics = starForwardPeState.map.get(String(item.symbol || "").toUpperCase());
        return metrics
          ? Object.assign({}, item, {
              peRatioFwd: Number.isFinite(metrics.peRatioFwd) ? metrics.peRatioFwd : item.peRatioFwd,
              peRatioFwdLoss: !!metrics.peRatioFwdLoss || !!item.peRatioFwdLoss,
              peRatioCurrent: Number.isFinite(metrics.peRatioCurrent) ? metrics.peRatioCurrent : item.peRatioCurrent,
              peRatioCurrentLoss: !!metrics.peRatioCurrentLoss || !!item.peRatioCurrentLoss,
              marketCapCN: metrics.marketCapCN || item.marketCapCN,
              priceTargetValue: Number.isFinite(metrics.priceTargetValue) ? metrics.priceTargetValue : item.priceTargetValue,
              priceTargetPct: Number.isFinite(metrics.priceTargetPct) ? metrics.priceTargetPct : item.priceTargetPct
            })
          : item;
      })).map(function (item) {
        return Object.assign({}, item, { showSparkline: true, referenceLatestT: cached.asOfMs });
      }) : null;
      var latestText = latestDataText(cached && cached.asOfMs);
      var statusClass = starsState.statusType === "err" ? "err" : "ok";
      var maxAbs = items && items.length ? sectorMaxAbsChange(items) : 1;
      var manageStatus = starListState.loading
        ? "\u6b63\u5728\u4ece KV \u8bfb\u53d6\u5217\u8868..."
        : (starListState.saving
          ? "\u6b63\u5728\u4fdd\u5b58\u5217\u8868..."
          : (starListState.error || ""));
      var manageStatusClass = starListState.error ? "err" : "ok";
      var modalHtml = starListState.open
        ? [
            '<div class="starManageOverlay" data-star-manage-close="overlay">',
              '<div class="starManageModal" role="dialog" aria-modal="true" aria-label="\u660e\u661f\u79d1\u6280\u80a1\u5217\u8868\u7ba1\u7406">',
                '<div class="starManageHead">',
                  '<div class="starManageTitle">',
                    '<strong>\u7ba1\u7406\u660e\u661f\u79d1\u6280\u80a1</strong>',
                    '<span>\u5217\u8868\u4f18\u5148\u5b58\u5728 Worker KV \uff08index:star-tech:list\uff09</span>',
                  '</div>',
                  '<button class="starManageClose" type="button" data-star-manage-close="button">\u5173\u95ed</button>',
                '</div>',
                '<div class="starManageStatus ' + manageStatusClass + '">' + esc(manageStatus || "\u53ef\u5728\u8fd9\u91cc\u6dfb\u52a0\u6216\u5220\u9664\u660e\u661f\u79d1\u6280\u80a1\u3002") + '</div>',
                '<form class="starManageForm" id="starManageForm">',
                  '<div class="starManageField">',
                    '<label for="starManageSymbol">Symbol</label>',
                    '<input id="starManageSymbol" name="symbol" type="text" value="' + esc(starListState.symbolInput) + '" placeholder="例如 NVDA" maxlength="12" />',
                  '</div>',
                  '<div class="starManageField">',
                    '<label for="starManageNameCN">\u4e2d\u6587\u540d</label>',
                    '<input id="starManageNameCN" name="nameCN" type="text" value="' + esc(starListState.nameCNInput) + '" placeholder="例如 英伟达" maxlength="24" />',
                  '</div>',
                  '<button class="starManageSubmit" type="submit"' + (starListState.loading || starListState.saving ? ' disabled' : '') + '>\u6dfb\u52a0</button>',
                '</form>',
                '<div class="starManageList">',
                  (starListState.items || []).map(function (item) {
                    return [
                      '<div class="starManageItem" data-symbol="' + esc(item.symbol) + '">',
                        '<div class="starManageItemMain">',
                          '<strong>' + esc(item.symbol) + '</strong>',
                          '<span>' + esc(item.nameCN) + '</span>',
                        '</div>',
                        '<button class="starManageDelete" type="button" data-star-delete="' + esc(item.symbol) + '"' + (starListState.loading || starListState.saving ? ' disabled' : '') + '>\u5220\u9664</button>',
                      '</div>'
                    ].join("");
                  }).join(""),
                '</div>',
              '</div>',
            '</div>'
          ].join("")
        : "";
      var gridHtml = items && items.length
        ? '<div class="sectorHeatGrid">' + items.map(function (item) { return sectorHeatTileHTML(item, maxAbs); }).join("") + '</div>'
        : '<div class="starPanelEmpty">\u70b9\u51fb\u4e0a\u65b9\u5468\u671f\u6309\u94ae\u540e\u52a0\u8f7d\u5bf9\u5e94\u6570\u636e\u3002<br />\u4e3a\u4e86\u63a7\u5236\u8bf7\u6c42\u91cf\uff0c\u660e\u661f\u79d1\u6280\u516c\u53f8\u9762\u677f\u4e0d\u4f1a\u5728\u9875\u9762\u521d\u59cb\u65f6\u4e00\u6b21\u6027\u8bfb\u53d6\u5168\u90e8\u5468\u671f\u3002</div>';

      root.innerHTML = [
        '<div class="card starPanel">',
          '<div class="starPanelHead">',
            '<div class="starPanelTitle">',
              '<span>\u6309\u5468\u671f\u67e5\u770b\u660e\u661f\u79d1\u6280\u516c\u53f8\u80a1\u4ef7\u8868\u73b0</span>',
              '<strong>\u660e\u661f\u79d1\u6280\u516c\u53f8</strong>',
            '</div>',
            '<div class="starPanelTools">',
              '<div class="starPeriodSeg" id="starPeriodSeg">',
                '<button data-star-p="1D"' + (starsState.period === "1D" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["1D"]) + '</button>',
                '<button data-star-p="5D"' + (starsState.period === "5D" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["5D"]) + '</button>',
                '<button data-star-p="1M"' + (starsState.period === "1M" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["1M"]) + '</button>',
                '<button data-star-p="6M"' + (starsState.period === "6M" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["6M"]) + '</button>',
                '<button data-star-p="YTD"' + (starsState.period === "YTD" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["YTD"]) + '</button>',
                '<button data-star-p="1Y"' + (starsState.period === "1Y" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["1Y"]) + '</button>',
                '<button data-star-p="5Y"' + (starsState.period === "5Y" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["5Y"]) + '</button>',
                '<button data-star-p="10Y"' + (starsState.period === "10Y" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["10Y"]) + '</button>',
                '<button data-star-p="MAX"' + (starsState.period === "MAX" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["MAX"]) + '</button>',
              '</div>',
              '<button class="starManageBtn" type="button" data-star-manage-open="1">\u7ba1\u7406\u5217\u8868</button>',
            '</div>',
          '</div>',
          '<div class="starPanelMeta">',
            '<div class="starPanelMetaText ' + statusClass + '">' + esc(starsState.statusText) + '</div>',
            '<div class="starPanelMetaText">\u5f53\u524d\u5468\u671f\uff1a' + esc(periodLabel) + '</div>',
            '<div class="starPanelMetaText">' + esc(latestText) + '</div>',
          '</div>',
          gridHtml,
          modalHtml,
        '</div>'
      ].join("");
      restoreScrollLeft(root, "#starPeriodSeg", periodScrollLeft);

      requestAnimationFrame(function () {
        restoreScrollLeft(root, "#starPeriodSeg", periodScrollLeft);
        animateStarCards(root, previousPositions);
      });
    }

    function renderSectorPanel() {
      var root = $("sp500SectorPanel");
      if (!root) return;

      var previousPositions = captureStarPositions(root);
      var periodScrollLeft = captureScrollLeft(root, "#sectorPeriodSeg");
      var periodLabel = PERIOD_LABELS[sectorsState.period] || sectorsState.period;
      var cached = sectorsState.cache.get(sectorsState.period);
      var items = cached && cached.items ? sortStarItems(cached.items).map(function (item) {
        return Object.assign({}, item, { referenceLatestT: cached.asOfMs });
      }) : null;
      var latestText = latestDataText(cached && cached.asOfMs);
      var statusClass = sectorsState.statusType === "err" ? "err" : "ok";
      var gridHtml = items && items.length
        ? renderSectorView(items)
        : '<div class="starPanelEmpty">\u8fdb\u5165\u8be5\u9762\u677f\u540e\u4f1a\u52a0\u8f7d\u5f53\u524d\u5468\u671f\u7684\u6807\u666e500\u5404\u677f\u5757 ETF \u8868\u73b0\u3002<br />\u53ea\u5728\u70b9\u51fb\u8fdb\u5165\u6216\u5207\u6362\u5468\u671f\u65f6\u8bf7\u6c42\u65b0\u6570\u636e\uff0c\u4e0d\u4f1a\u9884\u5148\u62c9\u53d6\u6240\u6709\u5468\u671f\u3002</div>';

      root.innerHTML = [
        '<div class="card starPanel">',
          '<div class="starPanelHead">',
            '<div class="starPanelTitle">',
              '<span>\u6309\u5468\u671f\u67e5\u770b\u6807\u666e500\u5404\u677f\u5757 ETF \u6da8\u8dcc\u5e45</span>',
              '<strong>\u6807\u666e500\u677f\u5757ETF</strong>',
            '</div>',
            '<div class="starPanelTools">',
              '<div class="starPeriodSeg" id="sectorPeriodSeg">',
                '<button data-sector-p="1D"' + (sectorsState.period === "1D" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["1D"]) + '</button>',
                '<button data-sector-p="5D"' + (sectorsState.period === "5D" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["5D"]) + '</button>',
                '<button data-sector-p="1M"' + (sectorsState.period === "1M" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["1M"]) + '</button>',
                '<button data-sector-p="6M"' + (sectorsState.period === "6M" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["6M"]) + '</button>',
                '<button data-sector-p="YTD"' + (sectorsState.period === "YTD" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["YTD"]) + '</button>',
                '<button data-sector-p="1Y"' + (sectorsState.period === "1Y" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["1Y"]) + '</button>',
                '<button data-sector-p="5Y"' + (sectorsState.period === "5Y" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["5Y"]) + '</button>',
                '<button data-sector-p="10Y"' + (sectorsState.period === "10Y" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["10Y"]) + '</button>',
                '<button data-sector-p="MAX"' + (sectorsState.period === "MAX" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["MAX"]) + '</button>',
              '</div>',
            '</div>',
          '</div>',
          '<div class="starPanelMeta">',
            '<div class="starPanelMetaText ' + statusClass + '">' + esc(sectorsState.statusText) + '</div>',
            '<div class="starPanelMetaText">\u5f53\u524d\u5468\u671f\uff1a' + esc(periodLabel) + '</div>',
            '<div class="starPanelMetaText">' + esc(latestText) + '</div>',
          '</div>',
          gridHtml,
        '</div>'
      ].join("");
      restoreScrollLeft(root, "#sectorPeriodSeg", periodScrollLeft);

      requestAnimationFrame(function () {
        restoreScrollLeft(root, "#sectorPeriodSeg", periodScrollLeft);
        animateStarCards(root, previousPositions);
      });
    }

    function getFundPremiumDetailItem(symbol) {
      var cache = fundPremiumState.cache;
      var items = cache && Array.isArray(cache.items) ? cache.items : [];
      var key = String(symbol || "");
      return items.find(function (item) {
        if (!key) return String(item && item.code || "") === "161128";
        return String(item && item.symbol || "") === key || (key === "161128" && String(item && item.code || "") === "161128");
      }) || null;
    }

    function openFundPremiumDetail(symbol) {
      var item = getFundPremiumDetailItem(symbol);
      if (!item || String(item.code || "") !== "161128") return;
      fundPremiumState.detailSymbol = item.symbol || "sz161128";
      renderFundPremiumPanel();
    }

    function closeFundPremiumDetail() {
      if (!fundPremiumState.detailSymbol) return;
      fundPremiumState.detailSymbol = null;
      renderFundPremiumPanel();
    }

    function fundCalcKvHTML(label, value) {
      return '<div class="fundCalcKv"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
    }

    function fundCalcSectionHTML(title, rows) {
      return [
        '<section class="fundCalcSection">',
          '<h4>' + esc(title) + '</h4>',
          '<div class="fundCalcGrid">',
            rows.map(function (row) { return fundCalcKvHTML(row[0], row[1]); }).join(""),
          '</div>',
        '</section>'
      ].join("");
    }

    function renderFundPremiumDetailModal(item) {
      if (!item) return "";

      var calc = item.lofPremium || {};
      var index = calc.index || {};
      var fx = calc.fx || {};
      var quote = calc.quoteSource || {};
      var nav = calc.navSource || {};
      var indexQuoteText = index.yahooQuote || index.googleQuote ||
        ((index.googleSymbol || index.symbol) && index.googleExchange
          ? (index.googleSymbol || index.symbol) + ":" + index.googleExchange
          : "");
      var indexSourceText = (index.source || "指数数据源") +
        (indexQuoteText ? " / " + indexQuoteText : (index.tickerId ? " / ticker_id=" + index.tickerId : ""));
      var estimatedFormula = "\u4f30\u7b97\u51c0\u503c = " +
        calcNumberText(calc.publishedNav, 6) + " \u00d7 " +
        calcNumberText(calc.indexMultiplier, 8) + " \u00d7 " +
        calcNumberText(calc.fxMultiplier, 8) + " = " +
        calcNumberText(calc.estimatedNav, 6);
      var premiumFormula = "\u6298\u6ea2\u4ef7 = (" +
        calcNumberText(calc.tradePrice, 3) + " / " +
        calcNumberText(calc.estimatedNav, 6) + " - 1) \u00d7 100 = " +
        calcPctText(calc.premiumPct);
      var fieldText = "\u4ef7\u683c\u5b57\u6bb5 3\uff0c\u65f6\u95f4\u5b57\u6bb5 30\uff0c\u817e\u8baf\u6298\u6ea2\u4ef7\u5b57\u6bb5 77\uff0c\u53c2\u8003\u51c0\u503c\u5b57\u6bb5 78";

      return [
        '<div class="fundCalcOverlay" data-fund-calc-close="overlay">',
          '<div class="fundCalcModal" role="dialog" aria-modal="true" aria-label="161128 \u6298\u6ea2\u4ef7\u8ba1\u7b97\u8be6\u60c5">',
            '<div class="fundCalcHead">',
              '<div>',
                '<span>\u957f\u6309 3 \u79d2\u6253\u5f00\uff0c\u7528\u4e8e\u6838\u5bf9 LOF \u771f\u5b9e\u6298\u6ea2\u4ef7\u4f30\u7b97\u8fc7\u7a0b</span>',
                '<strong>161128 \u6298\u6ea2\u4ef7\u8ba1\u7b97\u8be6\u60c5</strong>',
              '</div>',
              '<button class="fundCalcClose" type="button" data-fund-calc-close="button">\u5173\u95ed</button>',
            '</div>',
            '<div class="fundCalcSummary">',
              '<div><span>\u6700\u7ec8\u7ed3\u679c</span><strong>' + esc(fundPremiumRateText(calc.premiumPct)) + '</strong></div>',
              '<div><span>\u4ea4\u6613\u4ef7\u65e5\u671f</span><strong>' + esc(calc.tradeDate || item.tradeDate || "--") + '</strong></div>',
              '<div><span>\u8ba1\u7b97\u751f\u6210\u65f6\u95f4</span><strong>' + esc(calcTimeText(Date.parse(calc.generatedAt || ""))) + '</strong></div>',
            '</div>',
            fundCalcSectionHTML("1. \u573a\u5185\u4ea4\u6613\u4ef7\u683c", [
              ["\u57fa\u91d1\u4ee3\u7801", item.symbol || "--"],
              ["\u4ea4\u6613\u4ef7\u683c", calcNumberText(calc.tradePrice, 3)],
              ["\u4ea4\u6613\u4ef7\u65e5\u671f", calc.tradeDate || item.tradeDate || "--"],
              ["\u884c\u60c5\u65f6\u95f4", calcTimeText(calc.quoteTime || item.latestT)],
              ["\u817e\u8baf\u539f\u59cb\u65f6\u95f4", quote.rawTimestamp || "--"],
              ["\u6628\u65e5\u6536\u76d8", calcNumberText(item.baseClose, 3)],
              ["\u65e5\u6da8\u8dcc\u5e45", calcPctText(item.changePct)],
              ["\u5b57\u6bb5\u4f4d\u7f6e", fieldText],
            ]),
            fundCalcSectionHTML("2. \u6700\u65b0\u516c\u5e03\u5355\u4f4d\u51c0\u503c", [
              ["\u516c\u5e03\u51c0\u503c", calcNumberText(calc.publishedNav, 6)],
              ["\u516c\u5e03\u51c0\u503c\u65e5\u671f", calc.publishedNavDate || "--"],
              ["\u817e\u8baf\u539f\u59cb\u6298\u6ea2\u4ef7", calcPctText(calc.tencentPremiumPct)],
              ["\u817e\u8baf\u53c2\u8003\u51c0\u503c", calcNumberText(calc.tencentReferenceNav, 6)],
              ["\u51c0\u503c\u5b57\u6bb5", nav.navPath || "--"],
              ["\u65e5\u671f\u5b57\u6bb5", nav.navDatePath || "--"],
            ]),
            fundCalcSectionHTML("3. \u6807\u666e\u4fe1\u606f\u79d1\u6280\u6307\u6570\u4fee\u6b63", [
              ["\u6307\u6570\u4ee3\u7801", index.symbol || "SP500-45"],
              ["\u8bf7\u6c42\u5468\u671f", index.period || "1Y"],
              ["\u51c0\u503c\u65e5\u6536\u76d8", (index.navDate || "--") + " / " + calcNumberText(index.navClose, 4)],
              ["\u51c0\u503c\u65e5\u6570\u636e\u65f6\u95f4", calcTimeText(index.navTime)],
              ["\u4ea4\u6613\u65e5\u6536\u76d8", (index.tradeDate || "--") + " / " + calcNumberText(index.tradeClose, 4)],
              ["\u4ea4\u6613\u65e5\u6570\u636e\u65f6\u95f4", calcTimeText(index.tradeTime)],
              ["\u6307\u6570\u4fee\u6b63\u500d\u6570", calcNumberText(calc.indexMultiplier, 8)],
              ["\u533a\u95f4\u6da8\u8dcc", calcPctText(index.changePct)],
            ]),
            fundCalcSectionHTML("4. \u4eba\u6c11\u5e01\u7f8e\u5143\u4e2d\u95f4\u4ef7\u4fee\u6b63", [
              ["\u51c0\u503c\u65e5\u6c47\u7387", (fx.navDate || "--") + " / " + calcNumberText(fx.navRate, 4)],
              ["\u4ea4\u6613\u65e5\u6c47\u7387", (fx.tradeDate || "--") + " / " + calcNumberText(fx.tradeRate, 4)],
              ["\u6c47\u7387\u4fee\u6b63\u500d\u6570", calcNumberText(calc.fxMultiplier, 8)],
              ["\u533a\u95f4\u53d8\u5316", calcPctText(fx.changePct)],
            ]),
            fundCalcSectionHTML("5. \u4f30\u7b97\u51c0\u503c\u4e0e\u6700\u7ec8\u6298\u6ea2\u4ef7", [
              ["\u4f30\u7b97\u51c0\u503c", calcNumberText(calc.estimatedNav, 6)],
              ["\u6700\u7ec8\u6298\u6ea2\u4ef7", calcPctText(calc.premiumPct)],
              ["\u4f30\u7b97\u51c0\u503c\u516c\u5f0f", estimatedFormula],
              ["\u6298\u6ea2\u4ef7\u516c\u5f0f", premiumFormula],
            ]),
            '<section class="fundCalcSection fundCalcSourceBlock">',
              '<h4>\u6e90\u6570\u636e\u63a5\u53e3</h4>',
              '<p><strong>\u4ea4\u6613\u4ef7\uff1a</strong>' + esc(quote.url || "--") + '</p>',
              '<p><strong>\u5355\u4f4d\u51c0\u503c\uff1a</strong>' + esc(nav.url || "--") + '</p>',
              '<p><strong>\u6307\u6570\u6570\u636e\uff1a</strong>' + esc(indexSourceText || "--") + '</p>',
              '<p><strong>\u6c47\u7387\u6570\u636e\uff1a</strong>' + esc(fx.requestUrl || "--") + '</p>',
            '</section>',
          '</div>',
        '</div>'
      ].join("");
    }

    function renderFundPremiumPanel() {
      var root = $("fundPremiumPanel");
      if (!root) return;

      var cached = fundPremiumState.cache;
      var items = cached && cached.items ? cached.items.map(function (item) {
        return Object.assign({}, item, { referenceLatestT: cached.asOfMs });
      }).sort(function (a, b) {
        var delta =
          (Number.isFinite(b && b.premiumPct) ? b.premiumPct : -Infinity) -
          (Number.isFinite(a && a.premiumPct) ? a.premiumPct : -Infinity);
        if (Math.abs(delta) > 1e-9) return delta;
        return String(a && a.symbol || "").localeCompare(String(b && b.symbol || ""));
      }) : null;
      var latestText = latestTradeDateText(cached && cached.tradeDate);
      var statusClass = fundPremiumState.statusType === "err" ? "err" : "ok";
      var maxAbs = items && items.length ? fundPremiumMaxAbs(items) : 1;
      var detailItem = fundPremiumState.detailSymbol ? getFundPremiumDetailItem(fundPremiumState.detailSymbol) : null;
      var modalHtml = detailItem ? renderFundPremiumDetailModal(detailItem) : "";
      var gridHtml = items && items.length
        ? '<div class="sectorHeatGrid fundPremiumGrid">' + items.map(function (item) { return fundPremiumTileHTML(item, maxAbs); }).join("") + '</div>'
        : '<div class="starPanelEmpty">\u8fdb\u5165\u8be5\u9762\u677f\u540e\u4f1a\u8bfb\u53d6\u573a\u5185\u57fa\u91d1\u6700\u65b0\u4ef7\u683c\u548c\u6298\u6ea2\u4ef7\u7387\u3002<br />\u8be5\u9762\u677f\u6682\u65f6\u4e0d\u63a5 KV\uff0c\u57fa\u91d1\u5217\u8868\u5728\u4ee3\u7801\u4e2d\u56fa\u5b9a\u3002</div>';

      root.innerHTML = [
        '<div class="card starPanel fundPremiumPanel">',
          '<div class="starPanelHead">',
            '<div class="starPanelTitle">',
              '<span>\u4f7f\u7528\u817e\u8baf\u8d22\u7ecf\u5b9e\u65f6\u884c\u60c5\u663e\u793a\u573a\u5185\u57fa\u91d1\u6298\u6ea2\u4ef7</span>',
              '<strong>\u57fa\u91d1\u6298\u6ea2\u4ef7</strong>',
            '</div>',
          '</div>',
          '<div class="starPanelMeta">',
            '<div class="starPanelMetaText ' + statusClass + '">' + esc(fundPremiumState.statusText) + '</div>',
            '<div class="starPanelMetaText">' + esc(latestText) + '</div>',
          '</div>',
          gridHtml,
          modalHtml,
        '</div>'
      ].join("");
    }

    function sectorMaxAbsChange(items) {
      var values = (items || []).map(function (item) {
        return Math.abs(Number.isFinite(item && item.changePct) ? item.changePct : 0);
      }).filter(function (value) { return value > 0; });
      if (!values.length) return 1;
      return Math.max.apply(null, values);
    }

    function sectorTint(item, alpha) {
      var a = Number.isFinite(alpha) ? alpha : 0.18;
      if (Number.isFinite(item && item.change) && item.change > 0) return "rgba(255,77,109," + a.toFixed(3) + ")";
      if (Number.isFinite(item && item.change) && item.change < 0) return "rgba(34,197,94," + a.toFixed(3) + ")";
      return "rgba(148,163,184," + a.toFixed(3) + ")";
    }

    function sectorHeatTileHTML(item, maxAbs) {
      var intensity = clamp(Math.abs(Number.isFinite(item && item.changePct) ? item.changePct : 0) / (maxAbs || 1), 0, 1);
      var bg = sectorTint(item, 0.12 + intensity * 0.34);
      var border = sectorTint(item, 0.26 + intensity * 0.30);
      var glow = sectorTint(item, 0.16 + intensity * 0.24);
      var tone = starToneClass(item);
      var hasForwardPe = Number.isFinite(item && item.peRatioFwd) || !!(item && item.peRatioFwdLoss);
      var hasCurrentPe = Number.isFinite(item && item.peRatioCurrent) || !!(item && item.peRatioCurrentLoss);
      var marketCapText = fmtMarketCapCN(item && item.marketCapCN);
      var hasMarketCap = marketCapText !== "--";
      var hasValuationMetrics = hasForwardPe || hasCurrentPe || hasMarketCap;
      var hasTargetPrice = Number.isFinite(item && item.priceTargetValue) && Number.isFinite(item && item.priceTargetPct);
      var hasSparkline = !!(item && item.showSparkline && item.period !== "1D" && getSparklineValues(item).length > 1);
      var targetHtml = hasTargetPrice
        ? '<span class="sectorHeatTarget"><span class="sectorHeatTargetLabel">\u76ee\u6807\u4ef7\uff1a' + fmtTargetPrice(item.priceTargetValue) + '</span><span class="sectorHeatTargetPct" style="' + targetToneStyle(item && item.priceTargetPct) + '"> (' + esc(fmtTargetPct(item.priceTargetPct)) + ')</span></span>'
        : "";
      var mainHtml = hasSparkline
        ? [
            '<div class="sectorHeatMain">',
              '<div class="sectorHeatPct">' + signPct(item.changePct) + '</div>',
              '<div class="sectorHeatTrend">',
                sparklineSvgHTML(item, "sectorHeatSparkline"),
                '<strong class="sectorHeatDeltaInline">' + signPrice(item.change) + '</strong>',
              '</div>',
            '</div>'
          ].join("")
        : '<div class="sectorHeatPct">' + signPct(item.changePct) + '</div>';
      var metaClass = 'sectorHeatMeta'
        + (hasValuationMetrics ? ' sectorHeatMetaStar' : '')
        + (hasSparkline && !hasValuationMetrics ? ' sectorHeatMetaWithLatest' : '');
      var latestTimeClass = cardLatestTimeClass(item.latestT, item.referenceLatestT);
      var latestTimeInlineHtml = '<span class="sectorHeatExtraLatest' + latestTimeClass + '">' + esc(cardLatestTimeText(item.latestT, item.referenceLatestT)) + '</span>';
      var metaRightHtml = hasSparkline
        ? (hasTargetPrice
          ? targetHtml
          : (hasValuationMetrics ? "" : '<span class="sectorHeatMetaLatest' + latestTimeClass + '">' + esc(cardLatestTimeText(item.latestT, item.referenceLatestT)) + '</span>'))
        : (hasTargetPrice ? targetHtml : '<strong>' + signPrice(item.change) + '</strong>');
      var footerHtml = hasSparkline
        ? ""
        : (hasValuationMetrics ? "" : '<div class="sectorHeatLatest' + latestTimeClass + '">' + esc(cardLatestTimeText(item.latestT, item.referenceLatestT)) + '</div>');
      var extraHtml = hasValuationMetrics
        ? '<div class="sectorHeatExtra sectorHeatExtraStar"><span class="sectorHeatExtraLabel sectorHeatExtraForward">\u524d\u77bbPE: ' + fmtPeRatio(item.peRatioFwd, item && item.peRatioFwdLoss) + '</span><span class="sectorHeatExtraLabel sectorHeatExtraCurrent">\u5f53\u524dPE: ' + fmtPeRatio(item.peRatioCurrent, item && item.peRatioCurrentLoss) + '</span><span class="sectorHeatExtraLabel sectorHeatExtraMarketCap">\u5f53\u524d\u5e02\u503c: ' + esc(marketCapText) + '</span>' + latestTimeInlineHtml + '</div>'
        : "";
      var infoStackHtml = hasValuationMetrics
        ? '<div class="sectorHeatInfoStack"><div class="' + metaClass + '"><span>' + esc(item.baseLabel || "\u8d77\u70b9") + ' ' + fmtPrice(item.baseClose) + '</span>' + metaRightHtml + '</div>' + extraHtml + '</div>'
        : '<div class="' + metaClass + '"><span>' + esc(item.baseLabel || "\u8d77\u70b9") + ' ' + fmtPrice(item.baseClose) + '</span>' + metaRightHtml + '</div>' + extraHtml + footerHtml;

      return [
        '<article class="sectorHeatTile ' + tone + '" data-symbol="' + esc(item.symbol) + '" style="background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02)), ' + bg + '; border-color:' + border + '; box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 0 0 1px rgba(255,255,255,.01), 0 16px 32px ' + glow + ';">',
          '<div class="sectorHeatHeader">',
            '<div class="starIdentity">',
              '<div class="starIconWrap">',
                '<img class="starIcon" src="' + esc(item.icon) + '" alt="' + esc(item.symbol) + '" loading="lazy" data-search-symbol="' + esc(item.symbol) + '" data-search-refresh-state="idle" />',
              '</div>',
              '<div class="starNameBox">',
                '<div class="starName">' + esc(item.nameCN) + '</div>',
                '<div class="starSymbol">' + esc(item.symbol) + '</div>',
              '</div>',
            '</div>',
            '<div class="sectorHeatPrice">' + fmtPrice(item.lastClose) + '</div>',
          '</div>',
          mainHtml,
          infoStackHtml,
        '</article>'
      ].join("");
    }

    function fundPremiumRateClass(value) {
      if (!Number.isFinite(value)) return "flat";
      if (value > 0) return "premiumPositive";
      if (value < 0) return "premiumNegative";
      return "flat";
    }

    function fundPremiumToneClass(value) {
      if (!Number.isFinite(value)) return "flat";
      if (value > 0) return "up";
      if (value < 0) return "down";
      return "flat";
    }

    function fundPremiumTint(value, alpha) {
      var a = Number.isFinite(alpha) ? alpha : 0.18;
      if (Number.isFinite(value) && value > 0) return "rgba(255,77,109," + a.toFixed(3) + ")";
      if (Number.isFinite(value) && value < 0) return "rgba(34,197,94," + a.toFixed(3) + ")";
      return "rgba(148,163,184," + a.toFixed(3) + ")";
    }

    function fundPremiumMaxAbs(items) {
      var values = (items || []).map(function (item) {
        return Math.abs(Number.isFinite(item && item.premiumPct) ? item.premiumPct : 0);
      }).filter(function (value) { return value > 0; });
      if (!values.length) return 1;
      return Math.max.apply(null, values);
    }

    function fundPremiumRateText(value) {
      if (!Number.isFinite(value)) return "\u6298\u6ea2\u4ef7 --";
      if (value > 0) return "\u6ea2\u4ef7 " + value.toFixed(2) + "%";
      if (value < 0) return "\u6298\u4ef7 " + Math.abs(value).toFixed(2) + "%";
      return "\u5e73\u4ef7 0.00%";
    }

    function fundPremiumTileHTML(item, maxAbs) {
      var premiumValue = Number.isFinite(item && item.premiumPct) ? item.premiumPct : NaN;
      var intensity = clamp(Math.abs(Number.isFinite(premiumValue) ? premiumValue : 0) / (maxAbs || 1), 0, 1);
      var bg = fundPremiumTint(premiumValue, 0.12 + intensity * 0.34);
      var border = fundPremiumTint(premiumValue, 0.26 + intensity * 0.30);
      var glow = fundPremiumTint(premiumValue, 0.16 + intensity * 0.24);
      var tone = fundPremiumToneClass(premiumValue);
      var premiumClass = fundPremiumRateClass(item.premiumPct);
      var isLofDetail = String(item && item.code || "") === "161128";
      var detailAttr = isLofDetail ? ' data-fund-lof-detail="1" aria-label="161128 \u957f\u6309 3 \u79d2\u67e5\u770b\u6298\u6ea2\u4ef7\u8ba1\u7b97\u8be6\u60c5"' : "";
      var detailHint = isLofDetail ? '<div class="fundPremiumHoldHint">\u957f\u6309 3 \u79d2\u67e5\u770b\u8ba1\u7b97\u8be6\u60c5</div>' : "";

      return [
        '<article class="sectorHeatTile fundPremiumTile ' + tone + '" data-symbol="' + esc(item.symbol) + '"' + detailAttr + ' style="background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02)), ' + bg + '; border-color:' + border + '; box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 0 0 1px rgba(255,255,255,.01), 0 16px 32px ' + glow + ';">',
          '<div class="sectorHeatHeader">',
            '<div class="starIdentity">',
              '<div class="starIconWrap fundIconWrap">',
                item.icon
                  ? '<img class="starIcon fundIcon" src="' + esc(item.icon) + '" alt="' + esc(item.nameCN) + '" loading="lazy" />'
                  : '<div class="fundIconBlank" aria-hidden="true"></div>',
              '</div>',
              '<div class="starNameBox">',
                '<div class="starName">' + esc(item.nameCN) + '</div>',
                '<div class="starSymbol">' + esc(item.symbol) + '</div>',
              '</div>',
            '</div>',
            '<div class="sectorHeatPrice">' + fmtFundPrice(item.lastClose) + '</div>',
          '</div>',
          '<div class="sectorHeatPct">' + signPct(item.changePct) + '</div>',
          '<div class="sectorHeatMeta fundPremiumMeta">',
            '<span>' + esc(item.baseLabel || "\u6628\u6536") + ' ' + fmtFundPrice(item.baseClose) + '</span>',
            '<div class="fundPremiumMetaRight">',
              '<strong>' + signFundPrice(item.change) + '</strong>',
              '<span class="fundPremiumRate ' + premiumClass + '">' + esc(fundPremiumRateText(item.premiumPct)) + '</span>',
            '</div>',
          '</div>',
          '<div class="sectorHeatLatest">' + esc(fundTradeDateText(item.tradeDate)) + '</div>',
          detailHint,
        '</article>'
      ].join("");
    }

    function sectorBarRowHTML(item, maxAbs) {
      var intensity = clamp(Math.abs(Number.isFinite(item && item.changePct) ? item.changePct : 0) / (maxAbs || 1), 0, 1);
      var tone = starToneClass(item);
      var fill = sectorTint(item, 0.38 + intensity * 0.34);
      var glow = sectorTint(item, 0.16 + intensity * 0.20);
      var direction = Number.isFinite(item && item.change) ? (item.change > 0 ? "positive" : (item.change < 0 ? "negative" : "flat")) : "flat";
      var widthPct = direction === "flat" ? 0 : clamp(intensity * 50, 3, 50);

      return [
        '<article class="sectorBarRow ' + tone + '" data-symbol="' + esc(item.symbol) + '">',
          '<div class="sectorBarTop">',
            '<div class="starIdentity">',
              '<div class="starIconWrap">',
                '<img class="starIcon" src="' + esc(item.icon) + '" alt="' + esc(item.symbol) + '" loading="lazy" data-search-symbol="' + esc(item.symbol) + '" data-search-refresh-state="idle" />',
              '</div>',
              '<div class="starNameBox">',
                '<div class="starName">' + esc(item.nameCN) + '</div>',
                '<div class="starSymbol">' + esc(item.symbol) + '</div>',
              '</div>',
            '</div>',
            '<div class="sectorBarValues">',
              '<strong>' + signPct(item.changePct) + '</strong>',
              '<span>' + fmtPrice(item.lastClose) + '</span>',
            '</div>',
          '</div>',
          '<div class="sectorBarAxis">',
            '<span>\u8dcc</span>',
            '<strong>0</strong>',
            '<span>\u6da8</span>',
          '</div>',
          '<div class="sectorBarTrack">',
            '<div class="sectorBarMidline"></div>',
            '<div class="sectorBarFill ' + direction + '" style="width:' + widthPct.toFixed(2) + '%; background:' + fill + '; box-shadow: 0 0 18px ' + glow + ';"></div>',
          '</div>',
          '<div class="sectorBarMeta">',
            '<span>' + esc(item.baseLabel || "\u8d77\u70b9") + ' ' + fmtPrice(item.baseClose) + '</span>',
            '<strong>' + signPrice(item.change) + '</strong>',
          '</div>',
        '</article>'
      ].join("");
    }

    function renderSectorView(items) {
      var maxAbs = sectorMaxAbsChange(items);
      return '<div class="sectorHeatGrid">' + items.map(function (item) {
        return sectorHeatTileHTML(Object.assign({}, item, { showSparkline: true }), maxAbs);
      }).join("") + '</div>';
    }

    function formatBasketDate(ymd) {
      var text = String(ymd || "");
      if (!/^\\d{8}$/.test(text)) return "--";
      return text.slice(0, 4) + "-" + text.slice(4, 6) + "-" + text.slice(6, 8);
    }

    function formatWeightCacheDuration(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return "\u5373\u5c06\u5237\u65b0";

      var totalMinutes = Math.max(1, Math.ceil(ms / 60000));
      var hours = Math.floor(totalMinutes / 60);
      var minutes = totalMinutes % 60;

      if (hours >= 24) return "24\u5c0f\u65f6";
      if (hours > 0 && minutes > 0) return hours + "\u5c0f\u65f6" + minutes + "\u5206\u949f";
      if (hours > 0) return hours + "\u5c0f\u65f6";
      return minutes + "\u5206\u949f";
    }

    function weightLocalCacheKey(indexCode) {
      return INDEX_WEIGHTS_LOCAL_CACHE_PREFIX + String(indexCode || "").toUpperCase();
    }

    function decorateWeightCachePayload(payload, meta) {
      if (!payload) return payload;
      var savedAt = Number.isFinite(meta && meta.savedAt) ? meta.savedAt : null;
      var expiresAt = Number.isFinite(meta && meta.expiresAt) ? meta.expiresAt : null;
      return Object.assign({}, payload, {
        localCacheSavedAt: savedAt,
        localCacheExpiresAt: expiresAt,
        localCacheSource: meta && meta.source ? meta.source : null
      });
    }

    function isWeightCacheFresh(payload) {
      var expiresAt = Number(payload && payload.localCacheExpiresAt);
      return Number.isFinite(expiresAt) && expiresAt > Date.now();
    }

    function readWeightLocalCache(indexCode) {
      try {
        var raw = window.localStorage && window.localStorage.getItem(weightLocalCacheKey(indexCode));
        if (!raw) return null;
        var record = JSON.parse(raw);
        if (!record || record.schema !== INDEX_WEIGHTS_LOCAL_CACHE_SCHEMA || !record.payload) {
          window.localStorage.removeItem(weightLocalCacheKey(indexCode));
          return null;
        }

        var savedAt = Number(record.savedAt);
        var expiresAt = Number(record.expiresAt);
        if (!Number.isFinite(savedAt) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
          window.localStorage.removeItem(weightLocalCacheKey(indexCode));
          return null;
        }

        return decorateWeightCachePayload(record.payload, {
          savedAt: savedAt,
          expiresAt: expiresAt,
          source: "local"
        });
      } catch (error) {
        console.warn("index weights local cache read failed:", error);
        return null;
      }
    }

    function writeWeightLocalCache(indexCode, payload, meta) {
      if (!payload || !payload.ok) return payload;

      var savedAt = Number.isFinite(meta && meta.savedAt) ? meta.savedAt : Date.now();
      var expiresAt = Number.isFinite(meta && meta.expiresAt)
        ? meta.expiresAt
        : savedAt + INDEX_WEIGHTS_LOCAL_CACHE_TTL_MS;
      var decorated = decorateWeightCachePayload(payload, {
        savedAt: savedAt,
        expiresAt: expiresAt,
        source: "server"
      });

      try {
        if (window.localStorage) {
          window.localStorage.setItem(weightLocalCacheKey(indexCode), JSON.stringify({
            schema: INDEX_WEIGHTS_LOCAL_CACHE_SCHEMA,
            savedAt: savedAt,
            expiresAt: expiresAt,
            payload: payload
          }));
        }
      } catch (error) {
        console.warn("index weights local cache write failed:", error);
      }

      return decorated;
    }

    function writeCommonWeightLocalCache(payload) {
      var savedAt = Date.now();
      var expiresAt = savedAt + INDEX_WEIGHTS_LOCAL_CACHE_TTL_MS;
      var decorated = writeWeightLocalCache(COMMON_WEIGHTS_CODE, payload, {
        savedAt: savedAt,
        expiresAt: expiresAt
      });

      if (payload && Array.isArray(payload.indexes)) {
        payload.indexes.forEach(function (indexPayload) {
          if (indexPayload && indexPayload.indexCode) {
            writeWeightLocalCache(indexPayload.indexCode, indexPayload, {
              savedAt: savedAt,
              expiresAt: expiresAt
            });
          }
        });
      }

      return decorated;
    }

    function weightCacheRefreshText(payload) {
      var expiresAt = Number(payload && payload.localCacheExpiresAt);
      if (!Number.isFinite(expiresAt)) return "\u672c\u5730\u7f13\u5b58\uff1a--";
      var remaining = expiresAt - Date.now();
      if (remaining <= 0) return "\u672c\u5730\u7f13\u5b58\u5df2\u8fc7\u671f\uff0c\u4e0b\u6b21\u8fdb\u5165\u5c06\u91cd\u65b0\u83b7\u53d6";
      return "\u8ddd\u79bb\u4e0b\u6b21\u5237\u65b0\uff1a" + formatWeightCacheDuration(remaining);
    }

    function weightIndexSegHTML(activeIndex) {
      return [
        '<div class="weightsIndexSeg" role="tablist" aria-label="\\u6743\\u91cd\\u6307\\u6570\\u5207\\u6362">',
          WEIGHTS_INDEX_OPTIONS.map(function (option) {
            return '<button data-weight-index="' + esc(option.code) + '"' +
              (option.code === activeIndex ? ' class="active"' : '') +
              '>' + esc(option.label) + '</button>';
          }).join(""),
        '</div>'
      ].join("");
    }

    function weightCardHTML(item, maxWeight, rank) {
      var safeMax = Number.isFinite(maxWeight) && maxWeight > 0 ? maxWeight : 1;
      var intensity = clamp(item.weightPct / safeMax, 0, 1);
      var bg = "rgba(32,118,255," + (0.08 + intensity * 0.30).toFixed(3) + ")";
      var border = "rgba(105,214,255," + (0.18 + intensity * 0.26).toFixed(3) + ")";
      var glow = "rgba(38,106,255," + (0.12 + intensity * 0.22).toFixed(3) + ")";

      return [
        '<article class="weightCard" style="background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02)), ' + bg + '; border-color:' + border + '; box-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 16px 32px ' + glow + '; --weight-glow-soft:' + glow + ';">',
          '<div class="weightRankBadge">' + esc(String(rank)) + '</div>',
          '<div class="weightCardTop">',
            '<div class="weightIconWrap">',
              item.iconLight
                ? '<img class="weightIcon" src="' + esc(item.iconLight) + '" alt="' + esc(item.nameEn) + '" loading="lazy" data-search-symbol="' + esc(item.symbol) + '" data-search-refresh-state="idle" />'
                : '<div class="weightIcon" aria-hidden="true"></div>',
            '</div>',
            '<div class="weightNameBox">',
              '<div class="weightName">' + esc(item.nameEn || item.symbol) + '</div>',
              '<div class="weightSymbol">' + esc(item.symbol) + '</div>',
            '</div>',
          '</div>',
          '<div class="weightValue">',
            '<strong>' + fmt(item.weightPct, 2) + '%</strong>',
          '</div>',
        '</article>'
      ].join("");
    }

    function commonWeightRowHTML(item, rank, maxTotal, maxCellWeight) {
      var safeGlowMax = Number.isFinite(maxTotal) && maxTotal > 0 ? maxTotal : 1;
      var safeCellMax = Number.isFinite(maxCellWeight) && maxCellWeight > 0 ? maxCellWeight : 1;
      var total = Number.isFinite(item.totalWeightPct) ? item.totalWeightPct : 0;
      var intensity = clamp(total / safeGlowMax, 0, 1);
      var glow = "rgba(38,106,255," + (0.10 + intensity * 0.20).toFixed(3) + ")";
      var weights = item.weights || {};

      return [
        '<article class="commonWeightRow" style="--common-weight-glow:' + glow + ';">',
          '<div class="commonWeightRank">' + esc(String(rank)) + '</div>',
          '<div class="commonWeightIdentity">',
            '<div class="weightIconWrap">',
              item.iconLight
                ? '<img class="weightIcon" src="' + esc(item.iconLight) + '" alt="' + esc(item.nameEn || item.symbol) + '" loading="lazy" data-search-symbol="' + esc(item.symbol) + '" data-search-refresh-state="idle" />'
                : '<div class="weightIcon" aria-hidden="true"></div>',
            '</div>',
            '<div class="weightNameBox">',
              '<div class="weightName">' + esc(item.nameEn || item.symbol) + '</div>',
              '<div class="weightSymbol">' + esc(item.symbol) + '</div>',
            '</div>',
          '</div>',
          '<div class="commonWeightCells">',
            COMMON_WEIGHT_INDEX_OPTIONS.map(function (option) {
              var value = Number.isFinite(weights[option.code]) ? weights[option.code] : null;
              var width = Number.isFinite(value) ? clamp(value / safeCellMax, 0.035, 1) * 100 : 0;
              return [
                '<div class="commonWeightCell">',
                  '<span>' + esc(option.label) + '</span>',
                  '<strong>' + (Number.isFinite(value) ? fmt(value, 2) + '%' : '--') + '</strong>',
                  '<div class="commonWeightBar"><i style="width:' + width.toFixed(2) + '%"></i></div>',
                '</div>'
              ].join("");
            }).join(""),
          '</div>',
        '</article>'
      ].join("");
    }

    function commonWeightsPanelHTML() {
      var payload = weightsState.commonCache;
      var items = payload && Array.isArray(payload.items) ? payload.items.slice() : null;
      var maxTotal = items && items.length ? items[0].totalWeightPct : 0;
      var maxCellWeight = 0;
      if (items && items.length) {
        items.forEach(function (item) {
          var weights = item.weights || {};
          COMMON_WEIGHT_INDEX_OPTIONS.forEach(function (option) {
            var value = Number.isFinite(weights[option.code]) ? weights[option.code] : null;
            if (Number.isFinite(value) && value > maxCellWeight) maxCellWeight = value;
          });
        });
      }
      var statusClass = weightsState.commonStatusType === "err" ? "err" : "ok";
      var listHtml = items && items.length
        ? '<div class="commonWeightList">' + items.map(function (item, index) { return commonWeightRowHTML(item, index + 1, maxTotal, maxCellWeight); }).join("") + '</div>'
        : '<div class="weightsEmpty">\u8fdb\u5165\u8be5\u9762\u677f\u540e\u4f1a\u4e00\u6b21\u6027\u6bd4\u5bf9 ' + esc(commonIndexLabelsText()) + '\uff0c\u53ea\u663e\u793a\u4e09\u4e2a\u6307\u6570\u90fd\u5305\u542b\u7684\u6210\u4efd\u80a1\u3002</div>';

      return [
        '<div class="card weightsPanel commonWeightsPanel">',
          '<div class="weightsHead">',
            '<div class="weightsTitle">',
              '<span>\u53ea\u4fdd\u7559\u4e09\u4e2a\u6307\u6570\u5171\u540c\u5305\u542b\u7684\u6210\u4efd\u80a1</span>',
              '<strong>\u5171\u540c\u6210\u4efd\u80a1\u6743\u91cd\u5bf9\u7167</strong>',
            '</div>',
            '<div class="weightsMeta">',
              '<div class="' + statusClass + '">' + esc(weightsState.commonStatusText) + '</div>',
              payload ? '<div>\u5171\u540c\u6210\u4efd\u80a1\uff1a<strong>' + esc(String(payload.itemCount || 0)) + '</strong></div>' : '',
              payload ? '<div>' + esc(weightCacheRefreshText(payload)) + '</div>' : '',
            '</div>',
          '</div>',
          weightIndexSegHTML(weightsState.activeIndex),
          listHtml,
        '</div>'
      ].join("");
    }

    function renderWeightsPanel() {
      var root = $("indexWeightsPanel");
      if (!root) return;

      if (weightsState.activeIndex === COMMON_WEIGHTS_CODE) {
        root.innerHTML = commonWeightsPanelHTML();
        return;
      }

      var cached = weightsState.cache.get(weightsState.activeIndex);
      var items = cached && cached.items ? cached.items.slice() : null;
      var maxWeight = items && items.length ? items[0].weightPct : 0;
      var statusClass = weightsState.statusType === "err" ? "err" : "ok";
      var indexTitle = cached && cached.title ? cached.title : weightIndexLabel(weightsState.activeIndex);
      var showDataDate = !!(cached && cached.showDataDate !== false && cached.basketDate);
      var listHtml = items && items.length
        ? '<div class="weightsList">' + items.map(function (item, index) { return weightCardHTML(item, maxWeight, index + 1); }).join("") + '</div>'
        : '<div class="weightsEmpty">\u8fdb\u5165\u8be5\u9762\u677f\u540e\u4f1a\u83b7\u53d6\u6700\u65b0\u6743\u91cd\uff0c\u5e76\u5728\u672c\u5730\u7f13\u5b58 24 \u5c0f\u65f6\u3002<br />\u70b9\u51fb\u4e0a\u65b9\u6307\u6570\u6309\u94ae\u53ef\u5207\u6362 ' + esc(commonIndexLabelsText()) + '\u3002</div>';

      root.innerHTML = [
        '<div class="card weightsPanel">',
          '<div class="weightsHead">',
            '<div class="weightsTitle">',
              '<span>\u6839\u636e\u6700\u65b0\u6743\u91cd\u6587\u4ef6\u63a8\u5bfc\u6210\u5206\u80a1\u6743\u91cd</span>',
              '<strong>\u79d1\u6280\u7c7b\u6307\u6570\u6743\u91cd</strong>',
            '</div>',
            '<div class="weightsMeta">',
              '<div class="' + statusClass + '">' + esc(weightsState.statusText) + '</div>',
              '<div>\u6307\u6570\uff1a<strong>' + esc(indexTitle) + '</strong></div>',
              showDataDate
                ? '<div>\u6e05\u5355\u65e5\u671f\uff1a<strong>' + esc(formatBasketDate(cached.basketDate)) + '</strong></div>'
                : '',
              cached ? '<div>' + esc(weightCacheRefreshText(cached)) + '</div>' : '',
            '</div>',
          '</div>',
          weightIndexSegHTML(weightsState.activeIndex),
          listHtml,
        '</div>'
      ].join("");
    }

    function hydrateIndexWeightCacheFromCommon(payload) {
      if (!payload || !Array.isArray(payload.indexes)) return false;
      var hydrated = false;
      var savedAt = Number(payload.localCacheSavedAt);
      var expiresAt = Number(payload.localCacheExpiresAt);
      var source = payload.localCacheSource || "memory";
      payload.indexes.forEach(function (indexPayload) {
        if (!indexPayload || !indexPayload.indexCode || !Array.isArray(indexPayload.items)) return;
        weightsState.cache.set(indexPayload.indexCode, decorateWeightCachePayload({
          ok: true,
          indexCode: indexPayload.indexCode,
          title: indexPayload.title,
          etfCode: indexPayload.etfCode,
          basketDate: indexPayload.basketDate,
          showDataDate: indexPayload.showDataDate,
          cashAmount: indexPayload.cashAmount,
          items: indexPayload.items.slice()
        }, {
          savedAt: savedAt,
          expiresAt: expiresAt,
          source: source
        }));
        hydrated = true;
      });
      return hydrated;
    }

    async function fetchIndexWeights(indexCode, options) {
      var opts = options || {};
      if (weightsState.fetchCtrl) {
        weightsState.fetchCtrl.abort();
      }

      var controller = new AbortController();
      var timedOut = false;
      weightsState.fetchCtrl = controller;
      var timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, API_TIMEOUT_MS);

      try {
        var res = await fetch("/api/index-weights?index=" + encodeURIComponent(indexCode) + "&v=" + encodeURIComponent(INDEX_WEIGHTS_API_VERSION), {
          cache: "no-store",
          signal: controller.signal
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var payload = await res.json();
        if (!payload.ok) throw new Error(payload.error || "Index weights API error");
        return payload;
      } catch (error) {
        if (controller.signal.aborted && !timedOut) {
          return null;
        }
        if (timedOut) {
          throw new Error("\u79d1\u6280\u7c7b\u6307\u6570\u6743\u91cd\u8bf7\u6c42\u8d85\u65f6\uff0815\u79d2\uff09");
        }
        throw error;
      } finally {
        clearTimeout(timer);
        if (weightsState.fetchCtrl === controller) {
          weightsState.fetchCtrl = null;
        }
      }
    }

    async function fetchCommonIndexWeights(options) {
      var opts = options || {};
      if (weightsState.commonFetchCtrl) {
        weightsState.commonFetchCtrl.abort();
      }

      var controller = new AbortController();
      var timedOut = false;
      weightsState.commonFetchCtrl = controller;
      var timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, OVERVIEW_API_TIMEOUT_MS);

      try {
        var res = await fetch("/api/index-weights-common?v=" + encodeURIComponent(INDEX_WEIGHTS_API_VERSION), {
          cache: "no-store",
          signal: controller.signal
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var payload = await res.json();
        if (!payload.ok) throw new Error(payload.error || "Common index weights API error");
        return payload;
      } catch (error) {
        if (controller.signal.aborted && !timedOut) {
          return null;
        }
        if (timedOut) {
          throw new Error("\u5171\u540c\u6210\u5206\u80a1\u6743\u91cd\u8bf7\u6c42\u8d85\u65f6\uff0830\u79d2\uff09");
        }
        throw error;
      } finally {
        clearTimeout(timer);
        if (weightsState.commonFetchCtrl === controller) {
          weightsState.commonFetchCtrl = null;
        }
      }
    }

    async function loadIndexWeights(indexCode, options) {
      var opts = options || {};
      weightsState.activeIndex = indexCode;
      weightsState.touched = true;

      var localCached = readWeightLocalCache(indexCode);
      if (localCached) {
        weightsState.cache.set(indexCode, localCached);
        weightsState.statusText = "\u5df2\u4f7f\u7528 24 \u5c0f\u65f6\u672c\u5730\u7f13\u5b58\u7684\u6307\u6570\u6743\u91cd\u6570\u636e";
        weightsState.statusType = "ok";
        renderWeightsPanel();
        return;
      }

      hydrateIndexWeightCacheFromCommon(weightsState.commonCache);

      if (weightsState.cache.has(indexCode) && !isWeightCacheFresh(weightsState.cache.get(indexCode))) {
        weightsState.cache.delete(indexCode);
      }

      if (weightsState.cache.has(indexCode)) {
        weightsState.statusText = "\u5df2\u4f7f\u7528 24 \u5c0f\u65f6\u672c\u5730\u7f13\u5b58\u7684\u6307\u6570\u6743\u91cd\u6570\u636e";
        weightsState.statusType = "ok";
        renderWeightsPanel();
        return;
      }

      weightsState.statusText = "\u6b63\u5728\u52a0\u8f7d\u6700\u65b0\u6743\u91cd\u6587\u4ef6\u548c\u516c\u53f8\u56fe\u6807...";
      weightsState.statusType = "ok";
      renderWeightsPanel();

      try {
        var payload = await fetchIndexWeights(indexCode, opts);
        if (!payload) return;
        payload = writeWeightLocalCache(indexCode, payload);
        weightsState.cache.set(indexCode, payload);
        weightsState.statusText = "\u5df2\u83b7\u53d6\u6700\u65b0\u6743\u91cd\u6587\u4ef6\uff0c\u5e76\u5728\u672c\u5730\u7f13\u5b58 24 \u5c0f\u65f6";
        weightsState.statusType = "ok";
        renderWeightsPanel();
      } catch (error) {
        console.error("index weights load failed:", error);
        weightsState.statusText = error && error.message ? error.message : "\u79d1\u6280\u7c7b\u6307\u6570\u6743\u91cd\u52a0\u8f7d\u5931\u8d25";
        weightsState.statusType = "err";
        renderWeightsPanel();
      }
    }

    async function loadCommonIndexWeights(options) {
      var opts = options || {};
      weightsState.activeIndex = COMMON_WEIGHTS_CODE;
      weightsState.touched = true;

      var localCached = readWeightLocalCache(COMMON_WEIGHTS_CODE);
      if (localCached) {
        weightsState.commonCache = localCached;
        hydrateIndexWeightCacheFromCommon(localCached);
        weightsState.commonStatusText = "\u5df2\u4f7f\u7528 24 \u5c0f\u65f6\u672c\u5730\u7f13\u5b58\u7684\u5171\u540c\u6210\u4efd\u80a1\u6743\u91cd";
        weightsState.commonStatusType = "ok";
        renderWeightsPanel();
        return;
      }

      if (weightsState.commonCache && !isWeightCacheFresh(weightsState.commonCache)) {
        weightsState.commonCache = null;
      }

      if (weightsState.commonCache) {
        hydrateIndexWeightCacheFromCommon(weightsState.commonCache);
        weightsState.commonStatusText = "\u5df2\u4f7f\u7528 24 \u5c0f\u65f6\u672c\u5730\u7f13\u5b58\u7684\u5171\u540c\u6210\u4efd\u80a1\u6743\u91cd";
        weightsState.commonStatusType = "ok";
        renderWeightsPanel();
        return;
      }

      weightsState.commonStatusText = "\u6b63\u5728\u6bd4\u5bf9" + commonIndexLabelsText() + "\u7684\u6700\u65b0\u6743\u91cd...";
      weightsState.commonStatusType = "ok";
      renderWeightsPanel();

      try {
        var payload = await fetchCommonIndexWeights(opts);
        if (!payload) return;
        payload = writeCommonWeightLocalCache(payload);
        weightsState.commonCache = payload;
        hydrateIndexWeightCacheFromCommon(payload);
        weightsState.commonStatusText = "\u5df2\u751f\u6210\u4e09\u4e2a\u6307\u6570\u7684\u5171\u540c\u6210\u4efd\u80a1\u6743\u91cd\uff0c\u5e76\u5728\u672c\u5730\u7f13\u5b58 24 \u5c0f\u65f6";
        weightsState.commonStatusType = "ok";
        renderWeightsPanel();
      } catch (error) {
        console.error("common index weights load failed:", error);
        weightsState.commonStatusText = error && error.message ? error.message : "\u5171\u540c\u6210\u4efd\u80a1\u6743\u91cd\u52a0\u8f7d\u5931\u8d25";
        weightsState.commonStatusType = "err";
        renderWeightsPanel();
      }
    }

    function loadWeightsView(indexCode, options) {
      if (indexCode === COMMON_WEIGHTS_CODE) {
        return loadCommonIndexWeights(options);
      }
      return loadIndexWeights(indexCode, options);
    }

    async function fetchStarPeriod(period, options) {
      var opts = options || {};
      if (starsState.fetchCtrl) {
        starsState.fetchCtrl.abort();
      }

      var controller = new AbortController();
      var timedOut = false;
      starsState.fetchCtrl = controller;

      var timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, API_TIMEOUT_MS);

      try {
        var res = await fetch("/api/star-tech?p=" + encodeURIComponent(period), {
          cache: "no-store",
          signal: controller.signal
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var payload = await res.json();
        if (!payload.ok) throw new Error(payload.error || "Star tech API error");
        return payload;
      } catch (error) {
        if (controller.signal.aborted && !timedOut) {
          return null;
        }
        if (timedOut) {
          throw new Error("\u660e\u661f\u79d1\u6280\u516c\u53f8\u9762\u677f\u8bf7\u6c42\u8d85\u65f6\uff0815\u79d2\uff09");
        }
        throw error;
      } finally {
        clearTimeout(timer);
        if (starsState.fetchCtrl === controller) {
          starsState.fetchCtrl = null;
        }
      }
    }

    async function loadStarPeriod(period, options) {
      var opts = options || {};
      starsState.period = period;
      starsState.ready = true;
      starsState.touched = true;

      if (!opts.force && starsState.cache.has(period)) {
        starsState.statusText = "\u5df2\u4f7f\u7528\u7f13\u5b58\u6570\u636e";
        starsState.statusType = "ok";
        renderStarPanel();
        ensureStarForwardPe();
        startStarAutoRefresh();
        return;
      }

      starsState.statusText = "\u6b63\u5728\u52a0\u8f7d " + (PERIOD_LABELS[period] || period) + " \u6570\u636e...";
      starsState.statusType = "ok";
      renderStarPanel();

      try {
        var payload = await fetchStarPeriod(period, opts);
        if (!payload) return;
        starsState.cache.set(period, payload);
        starsState.statusText = "\u5df2\u7f13\u5b58\u5f53\u524d\u5468\u671f\u6570\u636e";
        starsState.statusType = "ok";
        renderStarPanel();
        ensureStarForwardPe();
      } catch (error) {
        console.error("star tech load failed:", error);
        starsState.statusText = error && error.message ? error.message : "\u660e\u661f\u79d1\u6280\u516c\u53f8\u9762\u677f\u52a0\u8f7d\u5931\u8d25";
        starsState.statusType = "err";
        renderStarPanel();
      }

      startStarAutoRefresh();
    }

    async function fetchStarForwardPe() {
      if (starForwardPeState.fetchCtrl) {
        starForwardPeState.fetchCtrl.abort();
      }

      var controller = new AbortController();
      var timedOut = false;
      starForwardPeState.fetchCtrl = controller;
      starForwardPeState.loading = true;

      var timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, API_TIMEOUT_MS);

      try {
        var res = await fetch("/api/star-tech-forward-pe", {
          cache: "no-store",
          signal: controller.signal
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var payload = await res.json();
        if (!payload.ok) throw new Error(payload.error || "Star tech PE API error");
        return payload;
      } catch (error) {
        if (controller.signal.aborted && !timedOut) {
          return null;
        }
        if (timedOut) {
          throw new Error("\u660e\u661f\u79d1\u6280\u516c\u53f8\u4f30\u503c\u6307\u6807\u8bf7\u6c42\u8d85\u65f6\uff0815\u79d2\uff09");
        }
        throw error;
      } finally {
        clearTimeout(timer);
        starForwardPeState.loading = false;
        if (starForwardPeState.fetchCtrl === controller) {
          starForwardPeState.fetchCtrl = null;
        }
      }
    }

    function ensureStarForwardPe(options) {
      var opts = options || {};
      if (!opts.force && (starForwardPeState.attempted || starForwardPeState.loading)) {
        return;
      }

      starForwardPeState.attempted = true;

      fetchStarForwardPe()
        .then(function (payload) {
          if (!payload) return;
          var nextMap = new Map();
          (payload.items || []).forEach(function (item) {
            var symbol = String(item && item.symbol || "").trim().toUpperCase();
            if (!symbol) return;
            if (Number.isFinite(item.peRatioFwd) || !!item.peRatioFwdLoss || Number.isFinite(item.peRatioCurrent) || !!item.peRatioCurrentLoss || !!item.marketCapCN || Number.isFinite(item.priceTargetPct) || Number.isFinite(item.priceTargetValue)) {
              nextMap.set(symbol, {
                peRatioFwd: Number.isFinite(item.peRatioFwd) ? item.peRatioFwd : null,
                peRatioFwdLoss: !!item.peRatioFwdLoss,
                peRatioCurrent: Number.isFinite(item.peRatioCurrent) ? item.peRatioCurrent : null,
                peRatioCurrentLoss: !!item.peRatioCurrentLoss,
                marketCapCN: item.marketCapCN || null,
                priceTargetValue: Number.isFinite(item.priceTargetValue) ? item.priceTargetValue : null,
                priceTargetPct: Number.isFinite(item.priceTargetPct) ? item.priceTargetPct : null
              });
            }
          });
          starForwardPeState.map = nextMap;
          starForwardPeState.loaded = true;
          renderStarPanel();
        })
        .catch(function (error) {
          console.error("star tech forward PE load failed:", error);
        });
    }

    async function fetchStarTechList() {
      var res = await fetch("/api/star-tech-list?_ts=" + Date.now(), {
        cache: "no-store"
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var payload = await res.json();
      if (!payload.ok) throw new Error(payload.error || "Star tech list API error");
      return payload.items || [];
    }

    async function openStarListManager() {
      starListState.open = true;
      starListState.loading = true;
      starListState.error = "";
      renderStarPanel();
      try {
        starListState.items = await fetchStarTechList();
      } catch (error) {
        starListState.error = error && error.message ? error.message : "\u5217\u8868\u8bfb\u53d6\u5931\u8d25";
      } finally {
        starListState.loading = false;
        renderStarPanel();
      }
    }

    function closeStarListManager() {
      starListState.open = false;
      starListState.loading = false;
      starListState.saving = false;
      starListState.error = "";
      starListState.symbolInput = "";
      starListState.nameCNInput = "";
      starListState.items = [];
      renderStarPanel();
    }

    async function refreshStarListAndPanel() {
      starListState.items = await fetchStarTechList();
      starsState.cache.clear();
      await loadStarPeriod(starsState.period, { force: true });
    }

    async function addStarListItem(symbol, nameCN) {
      var res = await fetch("/api/star-tech-list", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        cache: "no-store",
        body: JSON.stringify({ symbol: symbol, nameCN: nameCN })
      });
      var payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload && payload.error ? payload.error : "添加失败");
      }
      return payload.items || [];
    }

    async function deleteStarListItem(symbol) {
      var res = await fetch("/api/star-tech-list?symbol=" + encodeURIComponent(symbol), {
        method: "DELETE",
        cache: "no-store"
      });
      var payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload && payload.error ? payload.error : "删除失败");
      }
      return payload.items || [];
    }

    async function fetchSectorPeriod(period, options) {
      var opts = options || {};
      if (sectorsState.fetchCtrl) {
        sectorsState.fetchCtrl.abort();
      }

      var controller = new AbortController();
      var timedOut = false;
      sectorsState.fetchCtrl = controller;

      var timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, API_TIMEOUT_MS);

      try {
        var res = await fetch("/api/sp500-sectors?p=" + encodeURIComponent(period) + "&v=" + encodeURIComponent(SP500_SECTOR_API_VERSION), {
          cache: "no-store",
          signal: controller.signal
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var payload = await res.json();
        if (!payload.ok) throw new Error(payload.error || "Sector ETF API error");
        return payload;
      } catch (error) {
        if (controller.signal.aborted && !timedOut) {
          return null;
        }
        if (timedOut) {
          throw new Error("\u6807\u666e500\u677f\u5757 ETF \u9762\u677f\u8bf7\u6c42\u8d85\u65f6\uff0815\u79d2\uff09");
        }
        throw error;
      } finally {
        clearTimeout(timer);
        if (sectorsState.fetchCtrl === controller) {
          sectorsState.fetchCtrl = null;
        }
      }
    }

    async function loadSectorPeriod(period, options) {
      var opts = options || {};
      sectorsState.period = period;
      sectorsState.touched = true;

      if (!opts.force && sectorsState.cache.has(period)) {
        sectorsState.statusText = "\u5df2\u4f7f\u7528\u7f13\u5b58\u6570\u636e";
        sectorsState.statusType = "ok";
        renderSectorPanel();
        return;
      }

      sectorsState.statusText = "\u6b63\u5728\u52a0\u8f7d " + (PERIOD_LABELS[period] || period) + " \u6570\u636e...";
      sectorsState.statusType = "ok";
      renderSectorPanel();

      try {
        var payload = await fetchSectorPeriod(period, opts);
        if (!payload) return;
        sectorsState.cache.set(period, payload);
        sectorsState.statusText = "\u5df2\u7f13\u5b58\u5f53\u524d\u5468\u671f\u6570\u636e";
        sectorsState.statusType = "ok";
        renderSectorPanel();
      } catch (error) {
        console.error("sector ETF load failed:", error);
        sectorsState.statusText = error && error.message ? error.message : "\u6807\u666e500\u677f\u5757 ETF \u9762\u677f\u52a0\u8f7d\u5931\u8d25";
        sectorsState.statusType = "err";
        renderSectorPanel();
      }
    }

    async function fetchFundPremiums(options) {
      var opts = options || {};
      if (fundPremiumState.fetchCtrl) {
        fundPremiumState.fetchCtrl.abort();
      }

      var controller = new AbortController();
      var timedOut = false;
      fundPremiumState.fetchCtrl = controller;

      var timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, API_TIMEOUT_MS);

      try {
        var res = await fetch("/api/fund-premiums?v=" + encodeURIComponent(FUND_PREMIUM_API_VERSION), {
          cache: "no-store",
          signal: controller.signal
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        var payload = await res.json();
        if (!payload.ok) throw new Error(payload.error || "Fund premium API error");
        return payload;
      } catch (error) {
        if (controller.signal.aborted && !timedOut) {
          return null;
        }
        if (timedOut) {
          throw new Error("\u57fa\u91d1\u6298\u6ea2\u4ef7\u9762\u677f\u8bf7\u6c42\u8d85\u65f6\uff0815\u79d2\uff09");
        }
        throw error;
      } finally {
        clearTimeout(timer);
        if (fundPremiumState.fetchCtrl === controller) {
          fundPremiumState.fetchCtrl = null;
        }
      }
    }

    async function loadFundPremiums(options) {
      var opts = options || {};
      fundPremiumState.touched = true;

      if (!opts.force && fundPremiumState.cache) {
        fundPremiumState.statusText = "\u5df2\u4f7f\u7528\u7f13\u5b58\u6570\u636e";
        fundPremiumState.statusType = "ok";
        renderFundPremiumPanel();
        return;
      }

      fundPremiumState.statusText = "\u6b63\u5728\u52a0\u8f7d\u6700\u65b0\u57fa\u91d1\u884c\u60c5...";
      fundPremiumState.statusType = "ok";
      renderFundPremiumPanel();

      try {
        var payload = await fetchFundPremiums(opts);
        if (!payload) return;
        fundPremiumState.cache = payload;
        fundPremiumState.statusText = "\u5df2\u7f13\u5b58\u6700\u65b0\u57fa\u91d1\u884c\u60c5";
        fundPremiumState.statusType = "ok";
        renderFundPremiumPanel();
      } catch (error) {
        console.error("fund premium load failed:", error);
        fundPremiumState.statusText = error && error.message ? error.message : "\u57fa\u91d1\u6298\u6ea2\u4ef7\u9762\u677f\u52a0\u8f7d\u5931\u8d25";
        fundPremiumState.statusType = "err";
        renderFundPremiumPanel();
      }
    }

    function setGlobalRefreshBusy(isBusy) {
      var btn = $("globalRefreshBtn");
      if (!btn) return;

      btn.disabled = !!isBusy;
      btn.textContent = isBusy ? "\u5237\u65b0\u4e2d" : "\u5237\u65b0";
      btn.setAttribute("aria-busy", isBusy ? "true" : "false");
    }

    function resetStarForwardPeState() {
      if (starForwardPeState.fetchCtrl) {
        starForwardPeState.fetchCtrl.abort();
      }
      starForwardPeState.map.clear();
      starForwardPeState.fetchCtrl = null;
      starForwardPeState.loading = false;
      starForwardPeState.loaded = false;
      starForwardPeState.attempted = false;
    }

    function clearOverviewPanelData(options) {
      var opts = options || {};
      periodCache.delete(overviewCacheKey(state.period, state.indexSource));
      if (!opts.keepFearGreed) fearGreedCache = null;
      state.items = [];
      state.times = [];
      state.timeIndex = new Map();
      state.hoverTime = null;

      var idxCards = $("idxCards");
      if (idxCards) {
        idxCards.innerHTML = '<div class="starPanelEmpty">\u5df2\u6e05\u7a7a\u65e7\u6570\u636e\uff0c\u6b63\u5728\u91cd\u65b0\u83b7\u53d6\u79d1\u6280\u7c7b\u6307\u6570\u4fe1\u606f...</div>';
      }

      var idxLatestTime = $("idxLatestTime");
      if (idxLatestTime) {
        idxLatestTime.textContent = latestDataText(null);
      }

      setOverviewCurrentPeriod(state.period);
      draw();
      if (!opts.keepFearGreed) renderFearGreedLoading();
    }

    async function forceRefreshCurrentPanel() {
      var currentPage = state.page;
      setGlobalRefreshBusy(true);

      try {
        if (currentPage === "overview") {
          setStatus("\u5df2\u6e05\u7a7a\u5f53\u524d\u9762\u677f\u7f13\u5b58\uff0c\u6b63\u5728\u91cd\u65b0\u83b7\u53d6\u6307\u6570\u6570\u636e...", "ok");
          clearOverviewPanelData();
          await Promise.allSettled([
            loadFearGreed({ force: true }),
            renderPeriod(state.period, { force: true }),
          ]);
          return;
        }

        if (currentPage === "stars") {
          starsState.cache.clear();
          resetStarForwardPeState();
          starsState.statusText = "\u5df2\u6e05\u7a7a\u5f53\u524d\u9762\u677f\u7f13\u5b58\uff0c\u6b63\u5728\u91cd\u65b0\u83b7\u53d6\u660e\u661f\u79d1\u6280\u80a1\u6570\u636e...";
          starsState.statusType = "ok";
          renderStarPanel();
          await loadStarPeriod(starsState.period, { force: true });
          return;
        }

        if (currentPage === "weights") {
          if (weightsState.activeIndex === COMMON_WEIGHTS_CODE) {
            weightsState.commonStatusText = "\u6743\u91cd\u9762\u677f\u4f7f\u7528 24 \u5c0f\u65f6\u672c\u5730\u7f13\u5b58\uff0c\u9876\u90e8\u5237\u65b0\u6309\u94ae\u4e0d\u4f1a\u91cd\u65b0\u8bf7\u6c42\u670d\u52a1\u5668";
            weightsState.commonStatusType = "ok";
          } else {
            weightsState.statusText = "\u6743\u91cd\u9762\u677f\u4f7f\u7528 24 \u5c0f\u65f6\u672c\u5730\u7f13\u5b58\uff0c\u9876\u90e8\u5237\u65b0\u6309\u94ae\u4e0d\u4f1a\u91cd\u65b0\u8bf7\u6c42\u670d\u52a1\u5668";
            weightsState.statusType = "ok";
          }
          renderWeightsPanel();
          return;
        }

        if (currentPage === "sectors") {
          sectorsState.cache.clear();
          sectorsState.statusText = "\u5df2\u6e05\u7a7a\u5f53\u524d\u9762\u677f\u7f13\u5b58\uff0c\u6b63\u5728\u91cd\u65b0\u83b7\u53d6\u677f\u5757 ETF \u6570\u636e...";
          sectorsState.statusType = "ok";
          renderSectorPanel();
          await loadSectorPeriod(sectorsState.period, { force: true });
          return;
        }

        if (currentPage === "fundPremiums") {
          fundPremiumState.cache = null;
          fundPremiumState.detailSymbol = null;
          fundPremiumState.statusText = "\u5df2\u6e05\u7a7a\u5f53\u524d\u9762\u677f\u7f13\u5b58\uff0c\u6b63\u5728\u91cd\u65b0\u83b7\u53d6\u6700\u65b0\u57fa\u91d1\u884c\u60c5...";
          fundPremiumState.statusType = "ok";
          renderFundPremiumPanel();
          await loadFundPremiums({ force: true });
        }
      } finally {
        setGlobalRefreshBusy(false);
        if (state.page !== currentPage) {
          setActivePage(currentPage);
        } else {
          var periodLabel = $("periodCN");
          if (periodLabel) periodLabel.textContent = getPanelTitle(currentPage);
        }
      }
    }

    function startStarAutoRefresh() {
      clearInterval(starsState.refreshTimer);
      starsState.refreshTimer = null;
    }

    function updateWeightsCacheCountdownTimer() {
      clearInterval(weightsCacheCountdownTimer);
      weightsCacheCountdownTimer = null;

      if (state.page !== "weights") return;

      weightsCacheCountdownTimer = setInterval(function () {
        if (state.page === "weights") {
          renderWeightsPanel();
        }
      }, 60000);
    }

    function setActivePage(page) {
      state.page = page;
      var pagesRoot = $("pages");
      var pageSeg = $("pageSeg");
      var wrap = document.querySelector(".wrap");
      var periodLabel = $("periodCN");

      if (pagesRoot) {
        pagesRoot.querySelectorAll(".page").forEach(function (node) {
          node.classList.toggle("page-active", node.getAttribute("data-page") === page);
        });
      }

      if (pageSeg) {
        pageSeg.querySelectorAll("button[data-page]").forEach(function (node) {
          node.classList.toggle("active", node.getAttribute("data-page") === page);
        });
      }

      if (wrap) {
        wrap.classList.toggle("stars-active", page === "stars");
        wrap.classList.toggle("weights-active", page === "weights");
        wrap.classList.toggle("sectors-active", page === "sectors");
        wrap.classList.toggle("fund-premiums-active", page === "fundPremiums");
      }

      if (periodLabel) {
        periodLabel.textContent = getPanelTitle(page);
      }

      starsState.mobileVisible = page === "stars";
      updateWeightsCacheCountdownTimer();

      if (page === "stars" && !starsState.touched) {
        loadStarPeriod(starsState.period, { force: true });
      }

      if (page === "weights" && !weightsState.touched) {
        loadWeightsView(weightsState.activeIndex, { force: true });
      }

      if (page === "sectors" && !sectorsState.touched) {
        loadSectorPeriod(sectorsState.period, { force: true });
      }

      if (page === "fundPremiums" && !fundPremiumState.touched) {
        loadFundPremiums({ force: true });
      }

      startStarAutoRefresh();
    }

    function applyData(q) {
      var byTicker = new Map((q.items || []).map(function (item) {
        return [item.tickerId, item];
      }));

      var items = META.map(function (meta) {
        var item = byTicker.get(meta.tickerId) || {};
        var line = item.line || [];
        return Object.assign({}, meta, {
          line: line,
          map: new Map(line.map(function (p) { return [p.t, p]; })),
          iconSymbol: item.iconSymbol || meta.iconSymbol || item.symbol,
          iconLight: item.iconLight || null,
          latestT: item.latestT,
          lastClose: item.lastClose,
          cardBaseClose: item.cardBaseClose,
          cardChg: item.cardChg,
          cardChgPct: item.cardChgPct
        });
      });

      state.items = items;
      rebuildTimes();
      var overviewItems = items.map(function (item) { return overviewHeatItem(item, q.period, q.asOfMs); });
      var overviewMaxAbs = sectorMaxAbsChange(overviewItems);
      $("idxCards").innerHTML = '<div class="idxHeatGrid">' + overviewItems.map(function (item) {
        return sectorHeatTileHTML(item, overviewMaxAbs);
      }).join("") + '</div>';
      var idxLatestTime = $("idxLatestTime");
      if (idxLatestTime) {
        idxLatestTime.textContent = latestDataText(q.asOfMs);
      }
      setOverviewCurrentPeriod(q.period || state.period);
      $("periodCN").textContent = getPanelTitle(state.page);
      resizeCanvas();
    }

    async function fetchPeriod(period, options) {
      var opts = options || {};
      var source = normalizeIndexSource(opts.source || state.indexSource);
      var controller = new AbortController();
      var timedOut = false;

      if (activeFetchCtrl) activeFetchCtrl.abort();
      activeFetchCtrl = controller;

      var timer = setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, OVERVIEW_API_TIMEOUT_MS);

      var res;
      try {
        res = await fetch(
          "/api/quote?p=" + encodeURIComponent(period) + "&source=" + encodeURIComponent(source),
          {
          cache: "no-store",
          signal: controller.signal
          }
        );
      } catch (error) {
        if (controller.signal.aborted && !timedOut) {
          return null;
        }
        if (timedOut) {
          throw new Error("\u79d1\u6280\u7c7b\u6307\u6570\u4fe1\u606f\u8bf7\u6c42\u8d85\u65f6\uff08" + (OVERVIEW_API_TIMEOUT_MS / 1000) + "\u79d2\uff09");
        }
        throw error;
      } finally {
        clearTimeout(timer);
        if (activeFetchCtrl === controller) {
          activeFetchCtrl = null;
        }
      }

      if (!res.ok) throw new Error("HTTP " + res.status);
      var q = await res.json();
      if (!q.ok) throw new Error(q.error || "API error");
      periodCache.set(overviewCacheKey(period, source), { q: q, savedAt: Date.now() });
      return q;
    }

    async function ensureData(period, options) {
      var opts = options || {};
      var source = normalizeIndexSource(opts.source || state.indexSource);
      var key = overviewCacheKey(period, source);
      if (!opts.force && periodCache.has(key)) {
        return { q: periodCache.get(key).q, fromCache: true };
      }
      var q = await fetchPeriod(period, Object.assign({}, opts, { source: source }));
      return q ? { q: q, fromCache: false } : null;
    }

    async function fetchFearGreedData(options) {
      var opts = options || {};
      var controller = new AbortController();
      var timer = setTimeout(function () {
        controller.abort();
      }, API_TIMEOUT_MS);

      var res;
      try {
        res = await fetch("/api/fear-greed", {
          cache: "no-store",
          signal: controller.signal
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error("CNN \u9762\u677f\u8bf7\u6c42\u8d85\u65f6\uff08" + (API_TIMEOUT_MS / 1000) + "\u79d2\uff09");
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) throw new Error("HTTP " + res.status);
      var payload = await res.json();
      if (!payload.ok) throw new Error(payload.error || "Fear greed API error");
      fearGreedCache = payload.data || null;
      return fearGreedCache;
    }

    async function loadFearGreed(options) {
      var opts = options || {};

      if (!opts.force && fearGreedCache) {
        renderFearGreedCard(fearGreedCache);
        return;
      }

      renderFearGreedLoading();

      try {
        var data = await fetchFearGreedData(opts);
        renderFearGreedCard(data);
      } catch (error) {
        console.error("fear greed load failed:", error);
        renderFearGreedCard(null);
      }
    }

    function scheduleRender(period, options) {
      var opts = options || {};
      clearTimeout(switchTimer);
      switchTimer = setTimeout(function () {
        renderPeriod(period, opts);
      }, 80);
    }

    async function renderPeriod(period, options) {
      var opts = options || {};
      var source = normalizeIndexSource(opts.source || state.indexSource);
      try {
        setOverviewCurrentPeriod(period);
        setStatus(opts.force ? "\u4ece\u7f51\u7edc\u83b7\u53d6\u4e2d..." : ("\u6b63\u5728\u52a0\u8f7d " + (PERIOD_LABELS[period] || period) + " \u6570\u636e..."), "ok");
        var result = await ensureData(period, Object.assign({}, opts, { source: source }));
        if (!result) return;
        if (period !== state.period || source !== state.indexSource) return;
        applyData(result.q);
        setStatus(result.fromCache ? "\u5df2\u4f7f\u7528\u7f13\u5b58\u6570\u636e" : "\u5df2\u7f13\u5b58\u5f53\u524d\u5468\u671f\u6570\u636e", "ok");
      } catch (error) {
        console.error(error);
        setStatus(error && error.message ? error.message : "\u52a0\u8f7d\u5931\u8d25", "err");
      }
    }

    function startAutoRefresh() {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }

    $("seg").addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("button[data-p]") : null;
      if (!btn) return;

      var p = btn.getAttribute("data-p");
      if (!p || p === state.period || !sourceSupportsPeriod(state.indexSource, p)) return;

      state.period = p;
      state.hoverTime = null;

      syncOverviewSourceControls();

      startAutoRefresh();
      scheduleRender(p, { force: false });
    });

    var indexSourceSeg = $("indexSourceSeg");
    if (indexSourceSeg) {
      indexSourceSeg.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("button[data-index-source]") : null;
        if (!btn) return;
        switchIndexSource(btn.getAttribute("data-index-source"));
      });
    }

    var pageSeg = $("pageSeg");
    if (pageSeg) {
      pageSeg.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("button[data-page]") : null;
        if (!btn) return;
        var page = btn.getAttribute("data-page");
        if (!page || page === state.page) return;
        setActivePage(page);
      });
    }

    var globalRefreshBtn = $("globalRefreshBtn");
    if (globalRefreshBtn) {
      globalRefreshBtn.addEventListener("click", function () {
        forceRefreshCurrentPanel();
      });
    }

    var starTechPanel = $("starTechPanel");
    if (starTechPanel) {
      starTechPanel.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("button[data-star-p]") : null;
        if (btn) {
          var period = btn.getAttribute("data-star-p");
          if (!period) return;
          loadStarPeriod(period, { force: false });
          return;
        }

        var openBtn = e.target && e.target.closest ? e.target.closest("button[data-star-manage-open]") : null;
        if (openBtn) {
          openStarListManager();
          return;
        }

        var closeBtn = e.target && e.target.closest
          ? e.target.closest('button[data-star-manage-close="button"]')
          : null;
        var closeOverlay = e.target && e.target.matches
          ? e.target.matches('[data-star-manage-close="overlay"]')
          : false;
        if (closeBtn || closeOverlay) {
          closeStarListManager();
          return;
        }

        var deleteBtn = e.target && e.target.closest ? e.target.closest("button[data-star-delete]") : null;
        if (deleteBtn) {
          if (starListState.loading || starListState.saving) return;
          var symbol = deleteBtn.getAttribute("data-star-delete");
          if (!symbol) return;
          starListState.saving = true;
          starListState.error = "";
          renderStarPanel();
          deleteStarListItem(symbol)
            .then(function () {
              return refreshStarListAndPanel();
            })
            .catch(function (error) {
              console.error("star tech list delete failed:", error);
              starListState.error = error && error.message ? error.message : "\u5220\u9664\u5931\u8d25";
            })
            .finally(function () {
              starListState.saving = false;
              renderStarPanel();
            });
        }
      });

      starTechPanel.addEventListener("submit", function (e) {
        var form = e.target && e.target.closest ? e.target.closest("#starManageForm") : null;
        if (!form) return;
        e.preventDefault();
        if (starListState.loading || starListState.saving) return;

        var formData = new FormData(form);
        var symbol = String(formData.get("symbol") || "").trim().toUpperCase();
        var nameCN = String(formData.get("nameCN") || "").trim();
        starListState.symbolInput = symbol;
        starListState.nameCNInput = nameCN;
        starListState.saving = true;
        starListState.error = "";
        renderStarPanel();

        addStarListItem(symbol, nameCN)
          .then(function () {
            starListState.symbolInput = "";
            starListState.nameCNInput = "";
            return refreshStarListAndPanel();
          })
          .catch(function (error) {
            console.error("star tech list add failed:", error);
            starListState.error = error && error.message ? error.message : "\u6dfb\u52a0\u5931\u8d25";
          })
          .finally(function () {
            starListState.saving = false;
            renderStarPanel();
          });
      });
    }

    function clearFundPremiumLongPress() {
      if (fundPremiumLongPressTimer) {
        clearTimeout(fundPremiumLongPressTimer);
        fundPremiumLongPressTimer = null;
      }
    }

    var fundPremiumPanel = $("fundPremiumPanel");
    if (fundPremiumPanel) {
      fundPremiumPanel.addEventListener("pointerdown", function (e) {
        var tile = e.target && e.target.closest ? e.target.closest('[data-fund-lof-detail="1"]') : null;
        if (!tile) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;

        clearFundPremiumLongPress();
        var symbol = tile.getAttribute("data-symbol");
        fundPremiumLongPressTimer = setTimeout(function () {
          fundPremiumLongPressTimer = null;
          openFundPremiumDetail(symbol);
        }, 3000);
      });

      ["pointerup", "pointercancel", "pointerleave"].forEach(function (type) {
        fundPremiumPanel.addEventListener(type, clearFundPremiumLongPress);
      });

      fundPremiumPanel.addEventListener("contextmenu", function (e) {
        var tile = e.target && e.target.closest ? e.target.closest('[data-fund-lof-detail="1"]') : null;
        if (tile) e.preventDefault();
      });

      fundPremiumPanel.addEventListener("click", function (e) {
        var closeBtn = e.target && e.target.closest ? e.target.closest('button[data-fund-calc-close="button"]') : null;
        var closeOverlay = e.target && e.target.matches ? e.target.matches('[data-fund-calc-close="overlay"]') : false;
        if (closeBtn || closeOverlay) {
          closeFundPremiumDetail();
        }
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeFundPremiumDetail();
    });

    var sp500SectorPanel = $("sp500SectorPanel");
    if (sp500SectorPanel) {
      sp500SectorPanel.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("button[data-sector-p]") : null;
        if (btn) {
          var period = btn.getAttribute("data-sector-p");
          if (!period) return;
          loadSectorPeriod(period, { force: false });
          return;
        }

      });
    }

    var indexWeightsPanel = $("indexWeightsPanel");
    if (indexWeightsPanel) {
      indexWeightsPanel.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("button[data-weight-index]") : null;
        if (!btn) return;
        var indexCode = btn.getAttribute("data-weight-index");
        if (!indexCode || indexCode === weightsState.activeIndex) return;
        loadWeightsView(indexCode, { force: false });
      });
    }

    var chartCard = $("chartCard");
    var fsBtn = $("fsBtn");

    var isIOS = (function () {
      var ua = navigator.userAgent || "";
      var iOSLike = /iPad|iPhone|iPod/.test(ua);
      var iPadOS13Plus = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
      return iOSLike || iPadOS13Plus;
    })();

    function hasNativeFullscreen() {
      if (isIOS) return false;
      return !!(chartCard.requestFullscreen && document.fullscreenEnabled);
    }

    function isNativeFS() {
      return document.fullscreenElement === chartCard;
    }

    function isPseudoFS() {
      return chartCard.classList.contains("isFS");
    }

    function enterPseudoFS() {
      chartCard.classList.add("isFS");
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      setTimeout(resizeCanvas, 60);
    }

    function exitPseudoFS() {
      chartCard.classList.remove("isFS");
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      setTimeout(resizeCanvas, 60);
    }

    async function tryLockLandscape() {
      try {
        var o = screen.orientation;
        if (o && o.lock) await o.lock("landscape");
      } catch (error) {
        console.debug("orientation lock failed:", error && error.message ? error.message : error);
      }
    }

    fsBtn.addEventListener("click", async function () {
      if (!hasNativeFullscreen()) {
        if (isPseudoFS()) exitPseudoFS();
        else enterPseudoFS();
        return;
      }

      try {
        if (isNativeFS()) {
          await document.exitFullscreen();
          return;
        }

        await chartCard.requestFullscreen({ navigationUI: "hide" });
        tryLockLandscape();
        setTimeout(resizeCanvas, 60);
      } catch (error) {
        console.error("native fullscreen failed:", error);
        if (!isPseudoFS()) enterPseudoFS();
      }
    });

    document.addEventListener("fullscreenchange", function () {
      setTimeout(resizeCanvas, 60);
    });

    $("fsHint").addEventListener("click", function () {
      if (isPseudoFS()) exitPseudoFS();
    });

    window.addEventListener("resize", function () {
      starsState.mobileVisible = state.page === "stars";
      startStarAutoRefresh();
    });

    document.addEventListener("error", function (event) {
      var target = event && event.target;
      if (!target || target.tagName !== "IMG" || !target.dataset || !target.dataset.searchSymbol) {
        return;
      }
      handleSearchIconError(target);
    }, true);

    renderFearGreedLoading();
    renderStarPanel();
    renderSectorPanel();
    renderWeightsPanel();
    loadFearGreed({ force: true });
    syncOverviewSourceControls();
    setActivePage("overview");
    scheduleRender(state.period, { force: true });
    startAutoRefresh();
  } catch (error) {
    console.error("app bootstrap failed:", error);
    setStatus(error && error.message ? error.message : "\u9875\u9762\u521d\u59cb\u5316\u5931\u8d25", "err");
  }
})();
`;
}
