/**
 * 浏览器端脚本。
 *
 * 这个文件负责：
 * 1. 向 Worker 的 /api/quote 拉数据
 * 2. 绘制左侧折线图
 * 3. 渲染右侧指数卡片
 * 4. 渲染 CNN 恐惧贪婪指数仪表盘
 * 5. 处理移动端全屏逻辑
 *
 * 设计原则：
 * - 前端不直接依赖后端模块，只通过 /api/quote 交互
 * - 页面配置通过 HTML 注入的 JSON 传入
 * - UI 逻辑尽量集中，方便后续继续让 GPT 改样式或交互
 */

export function getClientScript() {
  return `(${clientMain.toString()})();`;
}

function clientMain() {
  const configNode = document.getElementById("app-config");
  const APP_CONFIG = configNode ? JSON.parse(configNode.textContent || "{}") : {};

  const META = APP_CONFIG.meta || [];
  const PERIOD_LABELS = APP_CONFIG.periodLabels || {};
  const UP_COLOR = APP_CONFIG.upColor || "rgba(255,77,109,.95)";
  const DOWN_COLOR = APP_CONFIG.downColor || "rgba(34,197,94,.95)";

  const $ = (id) => document.getElementById(id);

  function setStatus(text, type = "ok") {
    const el = $("status");
    if (!el) return;
    el.textContent = text;
    el.className = "status " + (type === "err" ? "err" : "ok");
  }

  function fmt(n, digits = 4) {
    return Number.isFinite(n) ? n.toFixed(digits) : "--";
  }

  function fmt1(n) {
    return Number.isFinite(n) ? n.toFixed(1) : "--";
  }

  function signNum(n, digits = 4) {
    return Number.isFinite(n) ? ((n >= 0 ? "+" : "") + n.toFixed(digits)) : "--";
  }

  function signPct(n) {
    return Number.isFinite(n) ? ((n >= 0 ? "+" : "") + n.toFixed(2) + "%") : "--";
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /**
   * tooltip 统一展示北京时间，和用户直觉一致。
   */
  const dtfBJ = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  function fmtBJ(ms) {
    return dtfBJ.format(new Date(ms)).replaceAll("/", "-") + "（北京）";
  }

  const canvas = $("c");
  const ctx = canvas ? canvas.getContext("2d") : null;

  if (!canvas || !ctx) {
    return;
  }

  let DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

  const state = {
    items: [],
    times: [],
    timeIndex: new Map(),
    hoverTime: null,
    period: "1D",
  };

  const periodCache = new Map();
  let activeFetchCtrl = null;

  function rebuildTimes() {
    const set = new Set();
    for (const item of state.items) {
      for (const point of item.line || []) {
        set.add(point.t);
      }
    }

    state.times = Array.from(set).sort((a, b) => a - b);
    state.timeIndex = new Map(state.times.map((t, i) => [t, i]));
  }

  function resizeCanvas() {
    DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
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

  function niceTicks(min, max, tickCount = 7) {
    const span = max - min || 1;
    const raw = span / (tickCount - 1);
    const pow10 = Math.pow(10, Math.floor(Math.log10(Math.abs(raw))));
    const candidates = [1, 2, 2.5, 5, 10].map((x) => x * pow10);

    let step = candidates[0];
    for (const c of candidates) {
      if (Math.abs(raw - c) < Math.abs(raw - step)) step = c;
    }

    const start = Math.floor(min / step) * step;
    const ticks = [];
    for (let v = start; v <= max + step; v += step) ticks.push(v);
    return { step, ticks };
  }

  function pctRange() {
    let min = Infinity;
    let max = -Infinity;

    for (const item of state.items) {
      for (const point of item.line || []) {
        if (!Number.isFinite(point.pct)) continue;
        min = Math.min(min, point.pct);
        max = Math.max(max, point.pct);
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { min: -1, max: 1 };
    }

    const pad = (max - min) * 0.1 || 0.5;
    return { min: min - pad, max: max + pad };
  }

  function spanIsMultiDay() {
    if (state.times.length < 2) return false;
    const a = new Date(state.times[0]);
    const b = new Date(state.times[state.times.length - 1]);
    return (b - a) > 36 * 3600 * 1000;
  }

  function measureEndLabelMaxWidth(font) {
    ctx.save();
    ctx.font = font;
    let maxW = 0;

    for (const item of state.items) {
      const pct = item.cardChgPct;
      if (!Number.isFinite(pct)) continue;
      const text = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
      maxW = Math.max(maxW, ctx.measureText(text).width);
    }

    ctx.restore();
    return maxW;
  }

  function drawEndLabels({ padL, padT, plotW, plotH, yOf, font }) {
    const x = padL + plotW + 10 * DPR;
    const labelH = 18 * DPR;
    const radius = 7 * DPR;
    const gap = 4 * DPR;
    const minSep = labelH + gap;

    ctx.save();
    ctx.font = font;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const nodes = [];

    for (const item of state.items) {
      const pct = item.cardChgPct;
      if (!Number.isFinite(pct)) continue;

      let lastPoint = null;
      for (let i = state.times.length - 1; i >= 0; i--) {
        const t = state.times[i];
        const p = item.map?.get(t);
        if (p && Number.isFinite(p.pct)) {
          lastPoint = p;
          break;
        }
      }

      if (!lastPoint) continue;

      const text = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
      const textW = ctx.measureText(text).width;
      const w = Math.max(44 * DPR, textW + 14 * DPR);
      const yTarget = yOf(lastPoint.pct);

      nodes.push({ text, w, yTarget, y: yTarget, pct });
    }

    if (!nodes.length) {
      ctx.restore();
      return;
    }

    nodes.sort((a, b) => a.yTarget - b.yTarget);

    const yMin = padT + labelH / 2;
    const yMax = padT + plotH - labelH / 2;

    for (const node of nodes) {
      node.y = Math.min(yMax, Math.max(yMin, node.y));
    }

    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      if (curr.y - prev.y < minSep) curr.y = prev.y + minSep;
    }

    const overflow = nodes[nodes.length - 1].y - yMax;
    if (overflow > 0) {
      for (const node of nodes) node.y -= overflow;
    }

    const topOverflow = yMin - nodes[0].y;
    if (topOverflow > 0) {
      for (const node of nodes) node.y += topOverflow;

      for (let i = 1; i < nodes.length; i++) {
        const prev = nodes[i - 1];
        const curr = nodes[i];
        if (curr.y - prev.y < minSep) curr.y = prev.y + minSep;
      }

      const overflow2 = nodes[nodes.length - 1].y - yMax;
      if (overflow2 > 0) {
        for (const node of nodes) node.y -= overflow2;
      }
    }

    for (const node of nodes) {
      const bx = x;
      const by = node.y - labelH / 2;

      ctx.fillStyle = node.pct >= 0 ? UP_COLOR : DOWN_COLOR;
      roundRect(ctx, bx, by, node.w, labelH, radius);
      ctx.fill();

      ctx.fillStyle = "rgba(9,13,22,.92)";
      ctx.fillText(node.text, bx + 7 * DPR, node.y);
    }

    ctx.restore();
  }

  function draw() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (!state.items.length || state.times.length < 2) {
      ctx.save();
      ctx.fillStyle = "rgba(230,237,247,.55)";
      ctx.font = `${14 * DPR}px ui-monospace`;
      ctx.textAlign = "center";
      ctx.fillText("暂无数据", W / 2, H / 2);
      ctx.restore();
      return;
    }

    const cssW = canvas.getBoundingClientRect().width;
    const isMobile = cssW <= 980;

    const padL = 14 * DPR;
    const padT = 14 * DPR;
    const padB = 30 * DPR;

    const mono = getComputedStyle(document.documentElement).getPropertyValue("--mono").trim();
    const axisFont = `${11 * DPR}px ${mono}`;
    const labelFont = `${12 * DPR}px ${mono}`;

    const maxLabelTextW = measureEndLabelMaxWidth(labelFont);
    const maxLabelBoxW = Math.max(44 * DPR, maxLabelTextW + 14 * DPR);
    const padR = isMobile ? Math.max(68 * DPR, maxLabelBoxW + 26 * DPR) : 150 * DPR;

    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const range = pctRange();
    const minP = range.min;
    const maxP = range.max;

    const yOf = (pct) => padT + (maxP - pct) * (plotH / (maxP - minP || 1));
    const xStep = plotW / (state.times.length - 1);
    const xOf = (i) => padL + i * xStep;

    ctx.save();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid").trim();
    ctx.lineWidth = 1 * DPR;
    ctx.font = axisFont;
    ctx.fillStyle = "rgba(138,160,198,.92)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    const ticks = niceTicks(minP, maxP, 7).ticks;
    for (const tick of ticks) {
      if (tick < minP || tick > maxP) continue;
      const y = yOf(tick);

      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();

      ctx.fillText(tick.toFixed(2) + "%", padL + plotW + 8 * DPR, y);
    }

    const y0 = yOf(0);
    ctx.save();
    ctx.strokeStyle = "rgba(230,237,247,.18)";
    ctx.lineWidth = 1 * DPR;
    ctx.beginPath();
    ctx.moveTo(padL, y0);
    ctx.lineTo(padL + plotW, y0);
    ctx.stroke();
    ctx.restore();

    const vCount = 6;
    for (let k = 0; k <= vCount; k++) {
      const x = padL + plotW * k / vCount;
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

    let lx = padL;
    let ly = padT + 6 * DPR;

    for (const item of state.items) {
      const label = item.nameCN;
      ctx.fillStyle = item.color;
      ctx.fillRect(lx, ly + 4 * DPR, 10 * DPR, 10 * DPR);
      ctx.fillStyle = "rgba(230,237,247,.85)";
      ctx.fillText(label, lx + 16 * DPR, ly);

      lx += ctx.measureText(label).width + 40 * DPR;
      if (lx > padL + plotW - 260 * DPR) {
        lx = padL;
        ly += 18 * DPR;
      }
    }

    ctx.restore();

    const lineWidth = isMobile ? 1.35 * DPR : 2 * DPR;
    for (const item of state.items) {
      const map = item.map;
      if (!map || map.size < 2) continue;

      ctx.save();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      let started = false;
      ctx.beginPath();

      for (let i = 0; i < state.times.length; i++) {
        const t = state.times[i];
        const p = map.get(t);
        if (!p || !Number.isFinite(p.pct)) continue;

        const x = xOf(i);
        const y = yOf(p.pct);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.restore();
    }

    const multiDay = spanIsMultiDay();
    ctx.save();
    ctx.fillStyle = "rgba(138,160,198,.92)";
    ctx.font = axisFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const labelCount = 6;
    for (let k = 0; k <= labelCount; k++) {
      const i = Math.floor((state.times.length - 1) * (k / labelCount));
      const x = xOf(i);
      const d = new Date(state.times[i]);

      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mi = String(d.getUTCMinutes()).padStart(2, "0");

      ctx.fillText(multiDay ? `${mm}-${dd}` : `${hh}:${mi}`, x, padT + plotH + 6 * DPR);
    }

    ctx.restore();

    drawEndLabels({ padL, padT, plotW, plotH, yOf, font: labelFont });

    if (state.hoverTime != null) {
      const idx = state.timeIndex.get(state.hoverTime);
      if (idx != null) {
        const x = xOf(idx);

        ctx.save();
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--hair").trim();
        ctx.lineWidth = 1 * DPR;
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();

        const rows = [];
        rows.push("时间：" + fmtBJ(state.hoverTime));

        for (const item of state.items) {
          const p = item.map?.get(state.hoverTime);
          if (!p) continue;

          if (Number.isFinite(p.pct)) {
            const y = yOf(p.pct);
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(x, y, 3.2 * DPR, 0, Math.PI * 2);
            ctx.fill();
          }

          rows.push(`${item.nameCN}：${p.close.toFixed(4)}（${signPct(p.pct)}）`);
        }

        ctx.font = labelFont;
        const pad = 10 * DPR;
        const w = Math.max(...rows.map((s) => ctx.measureText(s).width)) + pad * 2;
        const h = rows.length * 16 * DPR + pad * 2;

        const minX = padL;
        const maxX = padL + plotW - w;

        let bxTry = x + 12 * DPR;
        if (bxTry + w > padL + plotW) {
          bxTry = x - 12 * DPR - w;
        }

        let bx;
        if (maxX < minX) bx = minX;
        else bx = Math.min(maxX, Math.max(minX, bxTry));

        const by = padT + 12 * DPR;

        ctx.fillStyle = "rgba(9,13,22,.70)";
        ctx.strokeStyle = "rgba(31,43,61,.85)";
        roundRect(ctx, bx, by, w, h, 12 * DPR);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "rgba(230,237,247,.95)";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        for (let j = 0; j < rows.length; j++) {
          ctx.fillText(rows[j], bx + pad, by + pad + j * 16 * DPR);
        }

        ctx.restore();
      }
    }
  }

  function hitTestTime(evt) {
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) * DPR;
    const y = (evt.clientY - rect.top) * DPR;

    const W = canvas.width;
    const cssW = rect.width;
    const isMobile = cssW <= 980;

    const padL = 14 * DPR;
    const padT = 14 * DPR;
    const padB = 30 * DPR;

    const mono = getComputedStyle(document.documentElement).getPropertyValue("--mono").trim();
    const labelFont = `${12 * DPR}px ${mono}`;
    const maxLabelTextW = measureEndLabelMaxWidth(labelFont);
    const maxLabelBoxW = Math.max(44 * DPR, maxLabelTextW + 14 * DPR);
    const padR = isMobile ? Math.max(68 * DPR, maxLabelBoxW + 26 * DPR) : 150 * DPR;

    const plotW = W - padL - padR;
    const plotH = canvas.height - padT - padB;

    if (x < padL || x > padL + plotW || y < padT || y > padT + plotH) {
      return null;
    }

    const xStep = plotW / (state.times.length - 1);
    const i = Math.round((x - padL) / xStep);
    const idx = Math.max(0, Math.min(state.times.length - 1, i));

    return state.times[idx];
  }

  canvas.addEventListener("pointermove", (evt) => {
    const t = hitTestTime(evt);
    if (t !== state.hoverTime) {
      state.hoverTime = t;
      draw();
    }
  });

  canvas.addEventListener("pointerleave", () => {
    state.hoverTime = null;
    draw();
  });

  canvas.addEventListener("pointerdown", (evt) => {
    const t = hitTestTime(evt);
    if (t !== null) {
      state.hoverTime = t;
      draw();
    }
  });

  function tileHTML(item, period) {
    const is1D = period === "1D";
    const baseLabel = is1D ? "昨收" : "起点";
    const chgLabel = is1D ? "涨跌" : "区间涨跌";
    const pctLabel = is1D ? "涨跌幅" : "区间涨跌幅";

    const base = item.cardBaseClose;
    const last = item.lastClose;
    const chg = item.cardChg;
    const chgPct = item.cardChgPct;

    const cls = (Number.isFinite(chg) ? chg >= 0 : true) ? "up" : "down";

    return `
      <div class="tile">
        <div class="tileHead">
          <div class="nameRow">
            <span class="dot" style="background:${item.color}"></span>
            <div class="name" title="${item.nameCN}">${item.nameCN}</div>
          </div>
          <div class="sym">${item.symbol}</div>
        </div>

        <div class="kv">
          <div>最新</div><div><b>${fmt(last, 4)}</b></div>
          <div>${baseLabel}</div><div>${fmt(base, 4)}</div>
          <div>${chgLabel}</div><div class="${cls}">${signNum(chg, 4)}</div>
          <div>${pctLabel}</div><div class="${cls}">${signPct(chgPct)}</div>
        </div>
      </div>
    `;
  }

  function fearGreedMeta(score, rating, ratingCN) {
    const map = {
      "extreme fear": { label: "极度恐惧", color: "#ff5a76" },
      "fear": { label: "恐惧", color: "#fb923c" },
      "neutral": { label: "中性", color: "#fbbf24" },
      "greed": { label: "贪婪", color: "#22c55e" },
      "extreme greed": { label: "极度贪婪", color: "#14b8a6" },
    };

    const key = String(rating || "").toLowerCase().trim();
    if (map[key]) {
      return {
        label: ratingCN || map[key].label,
        color: map[key].color,
      };
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
    const value = clamp(Number.isFinite(score) ? score : 0, 0, 100);
    const angle = 180 - value * 1.8;
    const rad = angle * Math.PI / 180;

    const cx = 110;
    const cy = 115;
    const len = 68;

    const px = cx + Math.cos(rad) * len;
    const py = cy + Math.sin(rad) * len;

    return `
      <div class="fgGaugeWrap">
        <div class="fgGaugeBox">
          <svg class="fgGaugeSvg" viewBox="0 0 220 140" aria-hidden="true">
            <path class="fgTrack" d="M25 115 A85 85 0 0 1 195 115" pathLength="100"></path>

            <path class="fgZone fgZone1" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke-dasharray="25 75" stroke-dashoffset="0"></path>
            <path class="fgZone fgZone2" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke-dasharray="20 80" stroke-dashoffset="-25"></path>
            <path class="fgZone fgZone3" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke-dasharray="10 90" stroke-dashoffset="-45"></path>
            <path class="fgZone fgZone4" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke-dasharray="20 80" stroke-dashoffset="-55"></path>
            <path class="fgZone fgZone5" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke-dasharray="25 75" stroke-dashoffset="-75"></path>

            <path class="fgValueArc" d="M25 115 A85 85 0 0 1 195 115" pathLength="100" stroke="${color}" stroke-dasharray="${value} 100"></path>

            <line class="fgNeedle" x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="${color}" stroke-width="4"></line>
            <circle cx="${cx}" cy="${cy}" r="7" fill="${color}"></circle>
            <circle cx="${cx}" cy="${cy}" r="3" fill="rgba(9,13,22,.92)"></circle>

            <text x="25" y="134" class="fgAxisLabel" text-anchor="start">0</text>
            <text x="68" y="100" class="fgAxisLabel" text-anchor="middle">25</text>
            <text x="110" y="36" class="fgAxisLabel" text-anchor="middle">50</text>
            <text x="152" y="100" class="fgAxisLabel" text-anchor="middle">75</text>
            <text x="195" y="134" class="fgAxisLabel" text-anchor="end">100</text>
          </svg>

          <div class="fgGaugeText">
            <div class="fgGaugeScore">${fmt1(score)}</div>
            <div class="fgGaugeStatus" style="color:${color}">${label}</div>
          </div>
        </div>

        <div class="fgScale">
          <div class="fgScaleItem fear">恐惧</div>
          <div class="fgScaleItem neutral">中性</div>
          <div class="fgScaleItem greed">贪婪</div>
        </div>
      </div>
    `;
  }

  function renderFearGreedCard(data) {
    const root = $("fearGreedCard");
    if (!root) return;

    if (!data || !Number.isFinite(data.score)) {
      root.innerHTML = `
        <div class="tile fgCard">
          <div class="fgCardHead">
            <div>
              <div class="fgEyebrow">市场情绪</div>
              <div class="fgTitle">CNN 恐惧贪婪指数</div>
            </div>
          </div>
          <div class="fgEmpty">暂时无法加载 CNN 恐惧贪婪指数</div>
        </div>
      `;
      return;
    }

    const meta = fearGreedMeta(data.score, data.rating, data.ratingCN);
    const gaugeHtml = buildFearGreedGauge(data.score, meta.color, meta.label);

    root.innerHTML = `
      <div class="tile fgCard">
        <div class="fgCardHead">
          <div>
            <div class="fgEyebrow">市场情绪</div>
            <div class="fgTitle">CNN 恐惧贪婪指数</div>
          </div>
          <div class="fgBadge" style="color:${meta.color};background:${meta.color}14;border-color:${meta.color}33;">
            ${meta.label}
          </div>
        </div>

        <div class="fgCardInner">
          ${gaugeHtml}

          <div class="fgData">
            <div class="fgStats">
              <div class="fgMetric fgMetricMain">
                <span>最新</span>
                <b style="color:${meta.color}">${fmt1(data.score)}</b>
              </div>
              <div class="fgMetric">
                <span>一周前</span>
                <b>${fmt1(data.previous1Week)}</b>
              </div>
              <div class="fgMetric">
                <span>一月前</span>
                <b>${fmt1(data.previous1Month)}</b>
              </div>
              <div class="fgMetric">
                <span>一年前</span>
                <b>${fmt1(data.previous1Year)}</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function applyData(q) {
    const byTicker = new Map((q.items || []).map((item) => [item.tickerId, item]));

    const items = META.map((meta) => {
      const item = byTicker.get(meta.tickerId) || {};
      const line = item.line || [];

      return {
        ...meta,
        line,
        map: new Map(line.map((p) => [p.t, p])),
        lastClose: item.lastClose,
        cardBaseClose: item.cardBaseClose,
        cardChg: item.cardChg,
        cardChgPct: item.cardChgPct,
      };
    });

    state.items = items;
    rebuildTimes();

    $("asOf").textContent = q.asOfUTC ? "截至 " + q.asOfUTC : "--";
    $("idxCards").innerHTML = items.map((item) => tileHTML(item, q.period)).join("");
    $("periodCN").textContent = "周期：" + (PERIOD_LABELS[q.period] || q.period);

    renderFearGreedCard(q.cnnFearGreed || null);
    resizeCanvas();
  }

  async function fetchPeriod(period, options) {
    const opts = options || {};
    if (activeFetchCtrl) activeFetchCtrl.abort();
    activeFetchCtrl = new AbortController();

    const res = await fetch("/api/quote?p=" + encodeURIComponent(period), {
      cache: opts.force ? "no-store" : "default",
      signal: activeFetchCtrl.signal,
    });

    if (!res.ok) throw new Error("HTTP " + res.status);

    const q = await res.json();
    if (!q.ok) throw new Error(q.error || "API error");

    periodCache.set(period, { q, savedAt: Date.now() });
    return q;
  }

  async function ensureData(period, options) {
    const opts = options || {};
    if (!opts.force && periodCache.has(period)) {
      return { q: periodCache.get(period).q, fromCache: true };
    }

    const q = await fetchPeriod(period, opts);
    return { q, fromCache: false };
  }

  let switchTimer = null;

  function scheduleRender(period, options) {
    const opts = options || {};
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => renderPeriod(period, opts), 80);
  }

  async function renderPeriod(period, options) {
    const opts = options || {};

    try {
      setStatus(opts.force ? "刷新中…" : "加载中…", "ok");

      const result = await ensureData(period, opts);
      if (period !== state.period) return;

      applyData(result.q);
      setStatus(result.fromCache ? "加载缓存成功" : "加载成功", "ok");
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error(error);
      setStatus("加载失败", "err");
    }
  }

  let refreshTimer = null;

  function startAutoRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = null;

    if (state.period !== "1D") return;

    refreshTimer = setInterval(() => {
      scheduleRender(state.period, { force: true });
    }, 20000);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.period === "1D") {
      scheduleRender(state.period, { force: true });
    }
  });

  $("seg").addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-p]");
    if (!btn) return;

    const p = btn.getAttribute("data-p");
    if (!p || p === state.period) return;

    state.period = p;
    state.hoverTime = null;

    for (const b of $("seg").querySelectorAll("button[data-p]")) {
      b.classList.toggle("active", b.getAttribute("data-p") === p);
    }

    startAutoRefresh();

    if (periodCache.has(p)) {
      applyData(periodCache.get(p).q);
      setStatus("加载缓存成功", "ok");
      return;
    }

    scheduleRender(p, { force: false });
  });

  const chartCard = $("chartCard");
  const fsBtn = $("fsBtn");

  const isIOS = (() => {
    const ua = navigator.userAgent || "";
    const iOSLike = /iPad|iPhone|iPod/.test(ua);
    const iPadOS13Plus = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
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
      const o = screen.orientation;
      if (o && o.lock) {
        await o.lock("landscape");
      }
    } catch (error) {
      console.debug("orientation lock failed:", error?.message || error);
    }
  }

  fsBtn.addEventListener("click", async () => {
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

  document.addEventListener("fullscreenchange", () => {
    setTimeout(resizeCanvas, 60);
  });

  $("fsHint").addEventListener("click", () => {
    if (isPseudoFS()) exitPseudoFS();
  });

  scheduleRender(state.period, { force: false });
  startAutoRefresh();
}
