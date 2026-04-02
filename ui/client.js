/**
 * 浏览器端脚本生成器。
 *
 * 注意：
 * 这里不再使用 `someFunction.toString()` 动态拼接前端代码，
 * 因为 Workers 打包后可能插入内部辅助符号（例如 __name），
 * 最终在浏览器执行时变成未定义变量。
 *
 * 现在直接返回一段固定脚本文本，避免构建器改写运行时代码。
 */

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
      return dtfBJ.format(new Date(ms)).replaceAll("/", "-") + "（北京）";
    }

    var canvas = $("c");
    var ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;

    if (!canvas || !ctx) {
      setStatus("未找到图表容器", "err");
      return;
    }

    var DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    var API_TIMEOUT_MS = 15000;

    var state = {
      items: [],
      times: [],
      timeIndex: new Map(),
      hoverTime: null,
      period: "1D"
    };

    var periodCache = new Map();
    var fearGreedCache = null;
    var activeFetchCtrl = null;
    var switchTimer = null;
    var refreshTimer = null;

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
        ctx.fillText("暂无数据", W / 2, H / 2);
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
          rows.push("时间：" + fmtBJ(state.hoverTime));

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

            rows.push(item.nameCN + "：" + p.close.toFixed(4) + "（" + signPct(p.pct) + "）");
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
      var baseLabel = is1D ? "昨收" : "起点";
      var chgLabel = is1D ? "涨跌" : "区间涨跌";
      var pctLabel = is1D ? "涨跌幅" : "区间涨跌幅";
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
            '<div>最新</div><div><b>' + fmt(item.lastClose, 4) + '</b></div>',
            '<div>' + baseLabel + '</div><div>' + fmt(item.cardBaseClose, 4) + '</div>',
            '<div>' + chgLabel + '</div><div class="' + cls + '">' + signNum(item.cardChg, 4) + '</div>',
            '<div>' + pctLabel + '</div><div class="' + cls + '">' + signPct(item.cardChgPct) + '</div>',
          '</div>',
        '</div>'
      ].join("");
    }

    function fearGreedMeta(score, rating, ratingCN) {
      var map = {
        "extreme fear": { label: "极度恐惧", color: "#ff5a76" },
        "fear": { label: "恐惧", color: "#fb923c" },
        "neutral": { label: "中性", color: "#fbbf24" },
        "greed": { label: "贪婪", color: "#22c55e" },
        "extreme greed": { label: "极度贪婪", color: "#14b8a6" }
      };

      var key = String(rating || "").toLowerCase().trim();
      if (map[key]) {
        return { label: ratingCN || map[key].label, color: map[key].color };
      }

      if (Number.isFinite(score)) {
        if (score < 25) return { label: ratingCN || "极度恐惧", color: "#ff5a76" };
        if (score < 45) return { label: ratingCN || "恐惧", color: "#fb923c" };
        if (score < 55) return { label: ratingCN || "中性", color: "#fbbf24" };
        if (score < 75) return { label: ratingCN || "贪婪", color: "#22c55e" };
        return { label: ratingCN || "极度贪婪", color: "#14b8a6" };
      }

      return { label: "暂无数据", color: "#94a3b8" };
    }

    function buildFearGreedGauge(score, color, label) {
      var value = clamp(Number.isFinite(score) ? score : 0, 0, 100);
      var angle = 180 - value * 1.8;
      var rad = angle * Math.PI / 180;
      var cx = 110;
      var cy = 115;
      var len = 68;
      var px = cx + Math.cos(rad) * len;
      var py = cy - Math.sin(rad) * len;

      return [
        '<div class="fgGaugeWrap">',
          '<div class="fgGaugeBox">',
            '<svg class="fgGaugeSvg" viewBox="0 0 220 140" aria-hidden="true">',
              '<path class="fgTrack" d="M25 115 A85 85 0 0 1 195 115" pathLength="100"></path>',
              '<path class="fgZone fgZone1" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke-dasharray="25 75" stroke-dashoffset="0"></path>',
              '<path class="fgZone fgZone2" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke-dasharray="20 80" stroke-dashoffset="-25"></path>',
              '<path class="fgZone fgZone3" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke-dasharray="10 90" stroke-dashoffset="-45"></path>',
              '<path class="fgZone fgZone4" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke-dasharray="20 80" stroke-dashoffset="-55"></path>',
              '<path class="fgZone fgZone5" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke-dasharray="25 75" stroke-dashoffset="-75"></path>',
              '<path class="fgValueArc" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke="' + color + '" stroke-dasharray="' + value + ' 100"></path>',
              '<line class="fgNeedle" x1="' + cx + '" y1="' + cy + '" x2="' + px + '" y2="' + py + '" stroke="' + color + '" stroke-width="4"></line>',
              '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="' + color + '"></circle>',
              '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="rgba(9,13,22,.92)"></circle>',
              '<text x="25" y="134" class="fgAxisLabel" text-anchor="start">0</text>',
              '<text x="68" y="100" class="fgAxisLabel" text-anchor="middle">25</text>',
              '<text x="110" y="36" class="fgAxisLabel" text-anchor="middle">50</text>',
              '<text x="152" y="100" class="fgAxisLabel" text-anchor="middle">75</text>',
              '<text x="195" y="134" class="fgAxisLabel" text-anchor="end">100</text>',
            '</svg>',
            '<div class="fgGaugeText">',
              '<div class="fgGaugeScore">' + fmt1(score) + '</div>',
              '<div class="fgGaugeStatus" style="color:' + color + '">' + esc(label) + '</div>',
            '</div>',
          '</div>',
          '<div class="fgScale">',
            '<div class="fgScaleItem fear">恐惧</div>',
            '<div class="fgScaleItem neutral">中性</div>',
            '<div class="fgScaleItem greed">贪婪</div>',
          '</div>',
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
                '<div class="fgEyebrow">市场情绪</div>',
                '<div class="fgTitle">CNN 恐惧贪婪指数</div>',
              '</div>',
            '</div>',
            '<div class="fgEmpty">暂时无法加载 CNN 恐惧贪婪指数</div>',
          '</div>'
        ].join("");
        return;
      }

      var meta = fearGreedMeta(data.score, data.rating, data.ratingCN);
      var gaugeHtml = buildFearGreedGauge(data.score, meta.color, meta.label);

      root.innerHTML = [
        '<div class="tile fgCard">',
          '<div class="fgCardHead">',
            '<div>',
              '<div class="fgEyebrow">市场情绪</div>',
              '<div class="fgTitle">CNN 恐惧贪婪指数</div>',
            '</div>',
            '<div class="fgBadge" style="color:' + meta.color + ';background:' + meta.color + '14;border-color:' + meta.color + '33;">' + esc(meta.label) + '</div>',
          '</div>',
          '<div class="fgCardInner">',
            gaugeHtml,
            '<div class="fgData">',
              '<div class="fgStats">',
                '<div class="fgMetric fgMetricMain">',
                  '<span>最新</span>',
                  '<b>' + fmt1(data.score) + '</b>',
                '</div>',
                '<div class="fgMetric"><span>一周前</span><b>' + fmt1(data.previous1Week) + '</b></div>',
                '<div class="fgMetric"><span>一月前</span><b>' + fmt1(data.previous1Month) + '</b></div>',
                '<div class="fgMetric"><span>一年前</span><b>' + fmt1(data.previous1Year) + '</b></div>',
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
              '<div class="fgEyebrow">市场情绪</div>',
              '<div class="fgTitle">CNN 恐惧贪婪指数</div>',
            '</div>',
          '</div>',
          '<div class="fgEmpty">正在加载 CNN 恐惧贪婪指数…</div>',
        '</div>'
      ].join("");
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

      $("asOf").textContent = q.asOfUTC ? ("截至 " + q.asOfUTC) : "--";
      $("idxCards").innerHTML = items.map(function (item) {
        return tileHTML(item, q.period);
      }).join("");
      $("periodCN").textContent = "周期：" + (PERIOD_LABELS[q.period] || q.period);
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
          throw new Error("接口请求超时（>" + (API_TIMEOUT_MS / 1000) + "秒）");
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
          throw new Error("CNN 面板请求超时（>" + (API_TIMEOUT_MS / 1000) + "秒）");
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
        setStatus(opts.force ? "刷新中…" : "加载中…", "ok");
        var result = await ensureData(period, opts);
        if (period !== state.period) return;
        applyData(result.q);
        setStatus(result.fromCache ? "加载缓存成功" : "加载成功", "ok");
      } catch (error) {
        console.error(error);
        setStatus(error && error.message ? error.message : "加载失败", "err");
      }
    }

    function startAutoRefresh() {
      clearInterval(refreshTimer);
      refreshTimer = null;
      if (state.period !== "1D") return;
      refreshTimer = setInterval(function () {
        scheduleRender(state.period, { force: true });
      }, 20000);
    }

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state.period === "1D") {
        scheduleRender(state.period, { force: true });
      }
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
        setStatus("加载缓存成功", "ok");
        return;
      }

      scheduleRender(p, { force: false });
    });

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

    renderFearGreedLoading();
    loadFearGreed({ force: false });
    scheduleRender(state.period, { force: false });
    startAutoRefresh();
  } catch (error) {
    console.error("app bootstrap failed:", error);
    setStatus(error && error.message ? error.message : "页面初始化失败", "err");
  }
})();
`;
}
