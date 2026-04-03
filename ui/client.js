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
    el.className = "status " + (type === "err" ? "err" : "ok");
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

  try {
    var configNode = $("app-config");
    var APP_CONFIG = configNode ? JSON.parse(configNode.textContent || "{}") : {};

    var META = APP_CONFIG.meta || [];
    var PERIOD_LABELS = APP_CONFIG.periodLabels || {};
    var UP_COLOR = APP_CONFIG.upColor || "rgba(255,77,109,.95)";
    var DOWN_COLOR = APP_CONFIG.downColor || "rgba(34,197,94,.95)";

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

    var canvas = $("c");
    var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;

    if (!canvas || !ctx) {
      setStatus("\u672a\u627e\u5230\u56fe\u8868\u5bb9\u5668", "err");
      return;
    }

    var DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    var API_TIMEOUT_MS = 15000;
    var INDEX_WEIGHTS_API_VERSION = "20260403b";
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
    var weightsState = {
      activeIndex: "NDXTMC",
      cache: new Map(),
      fetchCtrl: null,
      statusText: "\u8fdb\u5165\u9762\u677f\u540e\u52a0\u8f7d\u6700\u65b0\u7533\u8d4e\u6e05\u5355\u6743\u91cd",
      statusType: "ok",
      touched: false
    };
    var activeFetchCtrl = null;
    var switchTimer = null;
    var refreshTimer = null;

    function getPanelTitle(page) {
      if (page === "stars") return "\u9762\u677f\uff1a\u660e\u661f\u79d1\u6280\u516c\u53f8";
      if (page === "weights") return "\u9762\u677f\uff1a\u79d1\u6280\u7c7b\u6307\u6570\u6743\u91cd";
      return "\u9762\u677f\uff1a\u79d1\u6280\u7c7b\u6307\u6570\u4fe1\u606f";
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
        ctx.fillText("鏆傛棤鏁版嵁", W / 2, H / 2);
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

      var multiDay = spanIsMultiDay();
      ctx.save();
      ctx.fillStyle = "rgba(138,160,198,.92)";
      ctx.font = axisFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      for (var labelIndex = 0; labelIndex <= 6; labelIndex++) {
        var i2 = Math.floor((state.times.length - 1) * (labelIndex / 6));
        var x2 = xOf(i2);
        var d = new Date(state.times[i2]);
        var mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        var dd = String(d.getUTCDate()).padStart(2, "0");
        var hh = String(d.getUTCHours()).padStart(2, "0");
        var mi = String(d.getUTCMinutes()).padStart(2, "0");
        ctx.fillText(multiDay ? (mm + "-" + dd) : (hh + ":" + mi), x2, padT + plotH + 6 * DPR);
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
      var cls = (Number.isFinite(item.cardChg) ? item.cardChg >= 0 : true) ? "up" : "down";

      return [
        '<div class="tile">',
          '<div class="tileHead">',
            '<div class="nameRow">',
              '<span class="dot" style="background:' + item.color + '"></span>',
              '<div class="name" title="' + esc(item.nameCN) + '">' + esc(item.nameCN) + '</div>',
            '</div>',
            '<div class="sym">' + esc(item.symbol) + '</div>',
          '</div>',
          '<div class="kv">',
            '<div>\u6700\u65b0</div><div><b>' + fmt(item.lastClose, 4) + '</b></div>',
            '<div>' + baseLabel + '</div><div>' + fmt(item.cardBaseClose, 4) + '</div>',
            '<div>' + chgLabel + '</div><div class="' + cls + '">' + signNum(item.cardChg, 4) + '</div>',
            '<div>' + pctLabel + '</div><div class="' + cls + '">' + signPct(item.cardChgPct) + '</div>',
          '</div>',
        '</div>'
      ].join("");
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

      return { label: "鏆傛棤鏁版嵁", color: "#94a3b8", bandIndex: null };
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
      var status = point && point.ratingCN ? point.ratingCN : "鏆傛棤鏁版嵁";
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
              '<div class="fgEyebrow">甯傚満鎯呯华</div>',
              '<div class="fgTitle">CNN 鎭愭儳璐┆鎸囨暟</div>',
            '</div>',
          '</div>',
          '<div class="fgEmpty">姝ｅ湪鍔犺浇 CNN 鎭愭儳璐┆鎸囨暟鈥?/div>',
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

      root.querySelectorAll(".starCard[data-symbol]").forEach(function (node) {
        var rect = node.getBoundingClientRect();
        positions.set(node.getAttribute("data-symbol"), {
          left: rect.left,
          top: rect.top
        });
      });

      return positions;
    }

    function animateStarCards(root, previousPositions) {
      if (!root || !previousPositions || !previousPositions.size) return;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      root.querySelectorAll(".starCard[data-symbol]").forEach(function (node) {
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
                '<img class="starIcon" src="' + esc(item.icon) + '" alt="' + esc(item.symbol) + '" loading="lazy" />',
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
            '</div>',
          '</div>',
        '</article>'
      ].join("");
    }

    function renderStarPanel() {
      var root = $("starTechPanel");
      if (!root) return;

      var previousPositions = captureStarPositions(root);
      var periodLabel = PERIOD_LABELS[starsState.period] || starsState.period;
      var cached = starsState.cache.get(starsState.period);
      var items = cached && cached.items ? sortStarItems(cached.items) : null;
      var statusClass = starsState.statusType === "err" ? "err" : "ok";
      var gridHtml = items && items.length
        ? '<div class="starGrid">' + items.map(starCardHTML).join("") + '</div>'
        : '<div class="starPanelEmpty">\u70b9\u51fb\u4e0a\u65b9\u5468\u671f\u6309\u94ae\u540e\u52a0\u8f7d\u5bf9\u5e94\u6570\u636e\u3002<br />\u4e3a\u4e86\u63a7\u5236\u8bf7\u6c42\u91cf\uff0c\u660e\u661f\u79d1\u6280\u516c\u53f8\u9762\u677f\u4e0d\u4f1a\u5728\u9875\u9762\u521d\u59cb\u65f6\u4e00\u6b21\u6027\u8bfb\u53d6\u5168\u90e8\u5468\u671f\u3002</div>';

      root.innerHTML = [
        '<div class="card starPanel">',
          '<div class="starPanelHead">',
            '<div class="starPanelTitle">',
              '<span>\u6309\u5468\u671f\u67e5\u770b\u660e\u661f\u79d1\u6280\u516c\u53f8\u80a1\u4ef7\u8868\u73b0</span>',
              '<strong>\u660e\u661f\u79d1\u6280\u516c\u53f8</strong>',
            '</div>',
            '<div class="starPeriodSeg" id="starPeriodSeg">',
              '<button data-star-p="1D"' + (starsState.period === "1D" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["1D"]) + '</button>',
              '<button data-star-p="5D"' + (starsState.period === "5D" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["5D"]) + '</button>',
              '<button data-star-p="1M"' + (starsState.period === "1M" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["1M"]) + '</button>',
              '<button data-star-p="6M"' + (starsState.period === "6M" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["6M"]) + '</button>',
              '<button data-star-p="YTD"' + (starsState.period === "YTD" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["YTD"]) + '</button>',
              '<button data-star-p="1Y"' + (starsState.period === "1Y" ? ' class="active"' : "") + '>' + esc(PERIOD_LABELS["1Y"]) + '</button>',
            '</div>',
          '</div>',
          '<div class="starPanelMeta">',
            '<div class="starPanelMetaText ' + statusClass + '">' + esc(starsState.statusText) + '</div>',
            '<div class="starPanelMetaText">\u5f53\u524d\u5468\u671f\uff1a' + esc(periodLabel) + '</div>',
          '</div>',
          gridHtml,
        '</div>'
      ].join("");

      requestAnimationFrame(function () {
        animateStarCards(root, previousPositions);
      });
    }

    function formatBasketDate(ymd) {
      var text = String(ymd || "");
      if (!/^\\d{8}$/.test(text)) return "--";
      return text.slice(0, 4) + "-" + text.slice(4, 6) + "-" + text.slice(6, 8);
    }

    function weightCardHTML(item, maxWeight) {
      var safeMax = Number.isFinite(maxWeight) && maxWeight > 0 ? maxWeight : 1;
      var widthPct = clamp((item.weightPct / safeMax) * 100, 10, 100);

      return [
        '<article class="weightCard">',
          '<div class="weightCardTop">',
            '<div class="weightIconWrap">',
              item.iconLight
                ? '<img class="weightIcon" src="' + esc(item.iconLight) + '" alt="' + esc(item.nameEn) + '" loading="lazy" />'
                : '<div class="weightIcon" aria-hidden="true"></div>',
            '</div>',
            '<div class="weightName">' + esc(item.nameEn || item.symbol) + '</div>',
          '</div>',
          '<div class="weightValue">',
            '<span>Weight</span>',
            '<strong>' + fmt(item.weightPct, 2) + '%</strong>',
          '</div>',
          '<div class="weightBar">',
            '<div class="weightBarFill" style="width:' + widthPct.toFixed(2) + '%"></div>',
          '</div>',
        '</article>'
      ].join("");
    }

    function renderWeightsPanel() {
      var root = $("indexWeightsPanel");
      if (!root) return;

      var cached = weightsState.cache.get(weightsState.activeIndex);
      var items = cached && cached.items ? cached.items.slice() : null;
      var maxWeight = items && items.length ? items[0].weightPct : 0;
      var statusClass = weightsState.statusType === "err" ? "err" : "ok";
      var listHtml = items && items.length
        ? '<div class="weightsList">' + items.map(function (item) { return weightCardHTML(item, maxWeight); }).join("") + '</div>'
        : '<div class="weightsEmpty">\u8fdb\u5165\u8be5\u9762\u677f\u540e\u53ea\u4f1a\u52a0\u8f7d\u4e00\u6b21\u6700\u65b0\u7533\u8d4e\u6e05\u5355\uff0c\u5e76\u5c06\u7ed3\u679c\u7f13\u5b58\u5728 Worker \u548c\u6d4f\u89c8\u5668\u4e2d\u3002<br />\u5f53\u524d\u4ec5\u5c55\u793a NDXTMC \u6307\u6570\u6743\u91cd\u3002</div>';

      root.innerHTML = [
        '<div class="card weightsPanel">',
          '<div class="weightsHead">',
            '<div class="weightsTitle">',
              '<span>\u6839\u636e\u6700\u65b0\u7533\u8d4e\u6e05\u5355\u63a8\u5bfc\u6210\u5206\u80a1\u6743\u91cd</span>',
              '<strong>\u79d1\u6280\u7c7b\u6307\u6570\u6743\u91cd</strong>',
            '</div>',
            '<div class="weightsMeta">',
              '<div class="' + statusClass + '">' + esc(weightsState.statusText) + '</div>',
              '<div>\u6307\u6570\uff1a<strong>' + esc(weightsState.activeIndex) + '</strong></div>',
              '<div>\u6e05\u5355\u65e5\u671f\uff1a<strong>' + esc(cached ? formatBasketDate(cached.basketDate) : "--") + '</strong></div>',
            '</div>',
          '</div>',
          listHtml,
        '</div>'
      ].join("");
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
          cache: opts.force ? "no-store" : "default",
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

    async function loadIndexWeights(indexCode, options) {
      var opts = options || {};
      weightsState.activeIndex = indexCode;
      weightsState.touched = true;

      if (!opts.force && weightsState.cache.has(indexCode)) {
        weightsState.statusText = "\u5df2\u4f7f\u7528\u7f13\u5b58\u7684\u6700\u65b0\u7533\u8d4e\u6e05\u5355";
        weightsState.statusType = "ok";
        renderWeightsPanel();
        return;
      }

      weightsState.statusText = "\u6b63\u5728\u52a0\u8f7d\u6700\u65b0\u7533\u8d4e\u6e05\u5355\u548c\u516c\u53f8\u56fe\u6807...";
      weightsState.statusType = "ok";
      renderWeightsPanel();

      try {
        var payload = await fetchIndexWeights(indexCode, opts);
        if (!payload) return;
        weightsState.cache.set(indexCode, payload);
        weightsState.statusText = "\u5df2\u7f13\u5b58\u6700\u65b0\u7533\u8d4e\u6e05\u5355";
        weightsState.statusType = "ok";
        renderWeightsPanel();
      } catch (error) {
        console.error("index weights load failed:", error);
        weightsState.statusText = error && error.message ? error.message : "\u79d1\u6280\u7c7b\u6307\u6570\u6743\u91cd\u52a0\u8f7d\u5931\u8d25";
        weightsState.statusType = "err";
        renderWeightsPanel();
      }
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
          cache: opts.force ? "no-store" : "default",
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
          throw new Error("鏄庢槦绉戞妧闈㈡澘璇锋眰瓒呮椂锛?5绉掞級");
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
      } catch (error) {
        console.error("star tech load failed:", error);
        starsState.statusText = error && error.message ? error.message : "\u660e\u661f\u79d1\u6280\u516c\u53f8\u9762\u677f\u52a0\u8f7d\u5931\u8d25";
        starsState.statusType = "err";
        renderStarPanel();
      }

      startStarAutoRefresh();
    }

    function shouldRefreshStar1D() {
      if (document.hidden) return false;
      if (starsState.period !== "1D") return false;
      if (!starsState.cache.has("1D")) return false;
      return state.page === "stars";
    }

    function startStarAutoRefresh() {
      clearInterval(starsState.refreshTimer);
      starsState.refreshTimer = null;
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
      }

      if (periodLabel) {
        periodLabel.textContent = getPanelTitle(page);
      }

      starsState.mobileVisible = page === "stars";

      if (page === "stars" && !starsState.touched) {
        loadStarPeriod(starsState.period, { force: false });
      }

      if (page === "weights" && !weightsState.touched) {
        loadIndexWeights(weightsState.activeIndex, { force: false });
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
          lastClose: item.lastClose,
          cardBaseClose: item.cardBaseClose,
          cardChg: item.cardChg,
          cardChgPct: item.cardChgPct
        });
      });

      state.items = items;
      rebuildTimes();
      $("idxCards").innerHTML = items.map(function (item) {
        return tileHTML(item, q.period);
      }).join("");
      $("periodCN").textContent = getPanelTitle(state.page);
      resizeCanvas();
    }

    async function fetchPeriod(period, options) {
      var opts = options || {};

      if (activeFetchCtrl) activeFetchCtrl.abort();
      activeFetchCtrl = new AbortController();

      var timer = setTimeout(function () {
        if (activeFetchCtrl) activeFetchCtrl.abort();
      }, API_TIMEOUT_MS);

      var res;
      try {
        res = await fetch("/api/quote?p=" + encodeURIComponent(period), {
          cache: opts.force ? "no-store" : "default",
          signal: activeFetchCtrl.signal
        });
      } catch (error) {
        if (activeFetchCtrl.signal.aborted) {
          throw new Error("鎺ュ彛璇锋眰瓒呮椂锛?" + (API_TIMEOUT_MS / 1000) + "绉掞級");
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) throw new Error("HTTP " + res.status);
      var q = await res.json();
      if (!q.ok) throw new Error(q.error || "API error");
      periodCache.set(period, { q: q, savedAt: Date.now() });
      return q;
    }

    async function ensureData(period, options) {
      var opts = options || {};
      if (!opts.force && periodCache.has(period)) {
        return { q: periodCache.get(period).q, fromCache: true };
      }
      var q = await fetchPeriod(period, opts);
      return { q: q, fromCache: false };
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
          cache: opts.force ? "no-store" : "default",
          signal: controller.signal
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error("CNN 闈㈡澘璇锋眰瓒呮椂锛?" + (API_TIMEOUT_MS / 1000) + "绉掞級");
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
      try {
        setStatus(opts.force ? "\u5237\u65b0\u4e2d..." : "\u52a0\u8f7d\u4e2d...", "ok");
        var result = await ensureData(period, opts);
        if (period !== state.period) return;
        applyData(result.q);
        setStatus(result.fromCache ? "\u52a0\u8f7d\u7f13\u5b58\u6210\u529f" : "\u52a0\u8f7d\u6210\u529f", "ok");
      } catch (error) {
        console.error(error);
        setStatus(error && error.message ? error.message : "\u52a0\u8f7d\u5931\u8d25", "err");
      }
    }

    function startAutoRefresh() {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }

    document.addEventListener("visibilitychange", function () {
      return;
    });

    $("seg").addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("button[data-p]") : null;
      if (!btn) return;

      var p = btn.getAttribute("data-p");
      if (!p || p === state.period) return;

      state.period = p;
      state.hoverTime = null;

      $("seg").querySelectorAll("button[data-p]").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-p") === p);
      });

      startAutoRefresh();

      if (periodCache.has(p)) {
        applyData(periodCache.get(p).q);
        setStatus("鍔犺浇缂撳瓨鎴愬姛", "ok");
        return;
      }

      scheduleRender(p, { force: false });
    });

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

    var starTechPanel = $("starTechPanel");
    if (starTechPanel) {
      starTechPanel.addEventListener("click", function (e) {
        var btn = e.target && e.target.closest ? e.target.closest("button[data-star-p]") : null;
        if (!btn) return;
        var period = btn.getAttribute("data-star-p");
        if (!period) return;
        loadStarPeriod(period, { force: false });
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

    renderFearGreedLoading();
    renderStarPanel();
    renderWeightsPanel();
    loadFearGreed({ force: false });
    setActivePage("overview");
    scheduleRender(state.period, { force: false });
    startAutoRefresh();
  } catch (error) {
    console.error("app bootstrap failed:", error);
    setStatus(error && error.message ? error.message : "\u9875\u9762\u521d\u59cb\u5316\u5931\u8d25", "err");
  }
})();
`;
}
