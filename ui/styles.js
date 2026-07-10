/**
 * 首页样式
 *
 * 这次的 CNN 仪表盘结构是：
 * - 左侧五段半圆表盘
 * - 底部中央分数显示
 * - 右侧四个关键数值卡片（数值 + 状态）
 */

import { DOWN_COLOR, UP_COLOR } from "../config.js";

export function getStyles() {
  return `
    :root{
      --bg:#0b0f19;
      --card: rgba(16,24,38,.78);
      --card2: rgba(10,15,26,.55);
      --border: rgba(31,43,61,.88);
      --text: rgba(230,237,247,.94);
      --muted: rgba(138,160,198,.92);
      --shadow: 0 20px 60px rgba(0,0,0,.45);
      --r: 14px;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
      --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;

      --up: ${UP_COLOR};
      --down: ${DOWN_COLOR};

      --grid: rgba(138,160,198,.14);
      --hair: rgba(230,237,247,.22);
      --kv-val-w: 140px;
    }

    *{ box-sizing:border-box; }

    body{
      margin:0;
      min-height:100vh;
      font-family: var(--sans);
      color: var(--text);
      background:
        radial-gradient(900px 700px at 30% 10%, rgba(0,174,239,.14), transparent 55%),
        radial-gradient(1000px 700px at 85% 30%, rgba(99,102,241,.12), transparent 55%),
        radial-gradient(900px 700px at 50% 95%, rgba(0,224,255,.08), transparent 60%),
        var(--bg);
      padding: 14px;
    }

    .wrap{
      max-width: 1400px;
      margin: 0 auto;
      display:grid;
      gap: 12px;
    }

    .pages{
      display:grid;
      gap: 12px;
    }

    .page{
      display:none;
    }

    .page.page-active{
      display:block;
    }

    .top{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding: 12px 14px;
      background: rgba(9,13,22,.86);
      border: 1px solid var(--border);
      border-radius: var(--r);
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .brand{
      display:flex;
      align-items:center;
      gap:12px;
      min-width:0;
    }

    .buildInfo{
      display:grid;
      gap: 2px;
      min-width: 0;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid rgba(31,43,61,.85);
      background: rgba(255,255,255,.03);
      text-align: right;
      font-family: var(--mono);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
    }

    .buildInfoLine{
      font-size: 11px;
      line-height: 1.35;
      color: rgba(196,211,236,.86);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 420px;
    }

    .buildInfoSubline{
      font-size: 10px;
      line-height: 1.35;
      color: rgba(147,166,196,.78);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 420px;
    }

    .logo{
      width: 128px;
      height: 32px;
      display:block;
      opacity:.96;
    }

    .title{
      display:flex;
      flex-direction:column;
      gap:2px;
      min-width:0;
    }

    .titleHead{
      display:flex;
      align-items:center;
      gap: 8px;
      min-width:0;
    }

    .title .h{
      margin:0;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .6px;
      white-space:nowrap;
    }

    .globalRefreshBtn{
      appearance:none;
      border: 1px solid rgba(0,224,255,.34);
      border-radius: 999px;
      padding: 3px 9px;
      color: rgba(190,246,255,.96);
      background:
        radial-gradient(circle at 50% 0%, rgba(0,224,255,.20), transparent 64%),
        rgba(0,224,255,.07);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.08),
        0 0 16px rgba(0,224,255,.10);
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1.25;
      cursor:pointer;
      white-space:nowrap;
      transition: transform .18s ease, border-color .18s ease, background .18s ease, opacity .18s ease;
    }

    .globalRefreshBtn:hover{
      transform: translateY(-1px);
      border-color: rgba(0,224,255,.62);
      background:
        radial-gradient(circle at 50% 0%, rgba(0,224,255,.28), transparent 64%),
        rgba(0,224,255,.11);
    }

    .globalRefreshBtn:disabled{
      cursor: wait;
      opacity: .68;
      transform: none;
    }

    .title .sub{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      white-space:nowrap;
    }

    .seg{
      display:inline-flex;
      gap: 6px;
      padding: 4px;
      border-radius: 999px;
      background: rgba(255,255,255,.04);
      border: 1px solid var(--border);
      margin-left: 0;
      width: 100%;
      justify-content: flex-start;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }

    .seg button{
      appearance:none;
      border:0;
      cursor:pointer;
      font-family: var(--mono);
      font-size: 12px;
      color: rgba(230,237,247,.72);
      background: transparent;
      padding: 8px 12px;
      border-radius: 999px;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .seg button.active{
      color: rgba(255,255,255,.96);
      background: rgba(0,174,239,.18);
      box-shadow: inset 0 0 0 1px rgba(0,174,239,.25);
    }

    .indexSourceSeg{
      display:inline-flex;
      align-items:center;
      gap: 4px;
      padding: 4px;
      width: fit-content;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: rgba(255,255,255,.035);
    }

    .indexSourceSeg button{
      appearance:none;
      display:inline-flex;
      align-items:center;
      gap: 6px;
      min-height: 30px;
      padding: 5px 8px;
      border: 1px solid transparent;
      border-radius: 6px;
      color: rgba(230,237,247,.70);
      background: transparent;
      cursor:pointer;
      font-family: var(--mono);
      font-size: 11px;
      white-space: nowrap;
    }

    .indexSourceSeg button.active{
      color: rgba(255,255,255,.96);
      border-color: rgba(0,224,255,.24);
      background: rgba(0,174,239,.14);
    }

    .indexSourceIcon{
      display:block;
      width: 18px;
      height: 18px;
      border-radius: 4px;
    }

    .asof{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      padding: 8px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,.04);
      border: 1px solid var(--border);
      white-space:nowrap;
    }

    .grid{
      display:grid;
      gap: 12px;
      grid-template-columns: 1fr 520px;
      align-items: stretch;
    }

    .pageSeg{
      display:flex;
      align-items:center;
      justify-content:center;
      gap: 8px;
      padding: 6px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(9,13,22,.72);
      width: fit-content;
      margin: 0 auto;
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .pageSeg button{
      appearance:none;
      border:0;
      cursor:pointer;
      padding: 10px 18px;
      border-radius: 999px;
      font-family: var(--mono);
      font-size: 12px;
      color: rgba(230,237,247,.72);
      background: transparent;
      white-space: nowrap;
    }

    .pageSeg button.active{
      color: rgba(255,255,255,.96);
      background: rgba(0,174,239,.18);
      box-shadow: inset 0 0 0 1px rgba(0,174,239,.25);
    }

    .card{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--r);
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
      overflow: hidden;
      position: relative;
    }

    .right{
      display:grid;
      gap: 10px;
      padding: 12px;
    }

    .blockTitle{
      font-size: 12px;
      color: var(--muted);
      font-family: var(--mono);
      padding: 2px 6px 0 6px;
      letter-spacing:.5px;
    }

    .blockTitleRow{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      padding: 2px 6px 0 6px;
    }

    .blockTitleRow .blockTitle{
      padding: 0;
    }

    .blockMeta{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      text-align: right;
      white-space: nowrap;
    }

    .overviewMeta{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      flex-wrap: wrap;
      min-height: 20px;
      padding: 0 6px;
    }

    .overviewLatestTime{
      flex: 0 0 100%;
    }

    .chartWrap{
      height: 660px;
      position:relative;
    }

    canvas{
      width:100%;
      height:100%;
      display:block;
      touch-action:none;
      background: var(--card2);
    }

    .footer{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding: 10px 14px;
      border-top: 1px solid rgba(31,43,61,.85);
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
      background: rgba(10,15,26,.25);
    }

    .status.ok{ color: rgba(0,224,255,.85); }
    .status.err{ color: rgba(255,77,109,.90); }

    .fsBtn{
      position: absolute;
      top: 10px;
      right: 10px;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid rgba(31,43,61,.85);
      background: rgba(9,13,22,.55);
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px rgba(0,0,0,.35);
      display: none;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 5;
      -webkit-tap-highlight-color: transparent;
    }

    .fsBtn svg{
      width: 18px;
      height: 18px;
      fill: rgba(230,237,247,.86);
    }

    .fsBtn:active{ transform: scale(.98); }

    .chartCard.isFS{
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      border-radius: 0 !important;
      border: 0 !important;
      margin: 0 !important;
      z-index: 9999 !important;
    }

    .chartCard.isFS .chartWrap{ height: 100vh !important; }
    .chartCard.isFS .footer{ display:none; }
    .chartCard.isFS .fsBtn{ top: 12px; right: 12px; }

    .fsHint{
      position: absolute;
      left: 12px;
      right: 56px;
      top: 12px;
      z-index: 6;
      display: none;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(31,43,61,.85);
      background: rgba(9,13,22,.60);
      backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px rgba(0,0,0,.35);
      font-family: var(--mono);
      font-size: 12px;
      color: rgba(230,237,247,.88);
      line-height: 1.35;
    }

    .chartCard.isFS .fsHint{ display:block; }

    .tile{
      background: rgba(13,20,32,.72);
      border: 1px solid rgba(31,43,61,.85);
      border-radius: 12px;
      padding: 12px;
      display:grid;
      gap: 10px;
    }

    .tileHead{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
    }

    .nameRow{
      display:flex;
      align-items:center;
      gap:10px;
      min-width:0;
      flex: 1 1 auto;
    }

    .dot{
      width:10px;
      height:10px;
      border-radius:50%;
      flex:0 0 auto;
      box-shadow: 0 0 0 3px rgba(255,255,255,.06);
    }

    .name{
      font-size: 13px;
      color: rgba(230,237,247,.92);
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    .sym{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      white-space:nowrap;
      flex: 0 0 auto;
    }

    .kv{
      display:grid;
      grid-template-columns: 1fr var(--kv-val-w);
      gap: 8px 12px;
      font-family: var(--mono);
      font-size: 12px;
      color: rgba(138,160,198,.95);
      align-items: baseline;
    }

    .kv > div:nth-child(2n){
      text-align: right;
      justify-self: end;
      font-variant-numeric: tabular-nums;
    }

    .kv b{
      color: rgba(230,237,247,.96);
      font-weight: 700;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }

    #idxCards{
      display:grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .idxTile{
      position: relative;
      overflow: hidden;
      border-radius: 14px;
      border: 1px solid rgba(31,43,61,.85);
      background:
        linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)),
        rgba(13,20,32,.76);
      padding: 16px;
      display:grid;
      gap: 14px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
    }

    .idxTile.up{
      --idx-accent: var(--up);
      --idx-accent-soft: rgba(255,77,109,.12);
      --idx-accent-border: rgba(255,77,109,.22);
    }

    .idxTile.down{
      --idx-accent: var(--down);
      --idx-accent-soft: rgba(34,197,94,.12);
      --idx-accent-border: rgba(34,197,94,.22);
    }

    .idxTile.flat{
      --idx-accent: rgba(226,232,240,.92);
      --idx-accent-soft: rgba(148,163,184,.10);
      --idx-accent-border: rgba(148,163,184,.18);
    }

    .idxTile{
      border-color: var(--idx-accent-border, rgba(31,43,61,.85));
    }

    .idxTile::after{
      content:"";
      position:absolute;
      inset:auto -18% -42% auto;
      width: 128px;
      height: 128px;
      border-radius: 50%;
      background: var(--idx-accent-soft, rgba(64,156,255,.16));
      filter: blur(10px);
      pointer-events:none;
    }

    .idxTileTop{
      position: relative;
      z-index: 1;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 14px;
      min-width: 0;
    }

    .idxIdentity{
      display:flex;
      align-items:center;
      gap: 14px;
      min-width: 0;
    }

    .idxIconWrap{
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.06));
      border: 1px solid var(--idx-accent-border, rgba(255,255,255,.14));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
      display:grid;
      place-items:center;
      flex: 0 0 auto;
    }

    .idxIcon{
      width: 32px;
      height: 32px;
      object-fit: contain;
      display:block;
      filter: brightness(2.34) saturate(1.42) contrast(1.14);
    }

    .idxDot{
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display:block;
      box-shadow: 0 0 0 4px rgba(255,255,255,.06);
    }

    .idxTitleBox{
      min-width: 0;
      display:grid;
      gap: 4px;
    }

    .idxName{
      font-size: 15px;
      font-weight: 700;
      color: rgba(244,247,252,.98);
      line-height: 1.25;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .idxSymbol{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      letter-spacing: .4px;
    }

    .idxMainValue{
      position: relative;
      z-index: 1;
      display:grid;
      gap: 6px;
    }

    .idxMainValue strong{
      font-size: 32px;
      line-height: 1;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: var(--idx-accent, rgba(244,247,252,.98));
      text-shadow: 0 0 18px var(--idx-accent-soft, transparent);
    }

    .idxMainValue span{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }

    .idxMetrics{
      position: relative;
      z-index: 1;
      display:grid;
      grid-template-columns: 1fr auto;
      gap: 8px 14px;
      font-family: var(--mono);
      font-size: 13px;
      align-items: baseline;
      color: rgba(168,184,210,.94);
    }

    .idxMetrics > div:nth-child(2n){
      text-align: right;
      justify-self: end;
      font-variant-numeric: tabular-nums;
    }

    .up{ color: var(--up) !important; }
    .down{ color: var(--down) !important; }

    .fgCard{
      background:
        radial-gradient(600px 240px at 0% 0%, rgba(0,224,255,.10), transparent 60%),
        radial-gradient(500px 240px at 100% 0%, rgba(255,180,0,.10), transparent 60%),
        linear-gradient(135deg, rgba(10,15,26,.90), rgba(14,22,36,.78));
    }

    .fgCardHead{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
    }

    .fgBrand{
      display:flex;
      align-items:center;
      gap: 11px;
      min-width: 0;
    }

    .cnnLogo{
      display:grid;
      place-items:center;
      width: 54px;
      height: 54px;
      flex: 0 0 54px;
      padding: 4px;
      border-radius: 8px;
      background: #d71920;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.22), 0 8px 18px rgba(215,25,32,.22);
    }

    .cnnLogo img{
      display:block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .fgEyebrow{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      letter-spacing: .5px;
    }

    .fgTitle{
      margin-top: 4px;
      font-size: 18px;
      font-weight: 800;
      color: rgba(240,246,255,.98);
    }

    .fgBadge{
      flex: 0 0 auto;
      padding: 7px 10px;
      border-radius: 999px;
      font-family: var(--mono);
      font-size: 12px;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.04);
      color: rgba(240,246,255,.92);
    }

    .fgCardInner{
      display:grid;
      grid-template-columns: minmax(0, 1.18fr) minmax(0, .92fr);
      gap: 14px;
      align-items: stretch;
    }

    .fgGaugeWrap{
      min-width:0;
      width: 100%;
      display:block;
    }

    .fgGaugeBox{
      position: relative;
      width: min(100%, 360px);
      margin: 0 auto;
    }

    .fgGaugeSvg{
      width: 100%;
      height: auto;
      display: block;
      overflow: visible;
    }

    .fgGaugeInnerArc{
      fill: none;
      stroke: rgba(255,255,255,.08);
      stroke-width: 2;
    }

    .fgNeedle{
      stroke-linecap: round;
      filter: drop-shadow(0 0 10px rgba(0,0,0,.35));
    }

    .fgNeedleHubOuter{
      filter: drop-shadow(0 0 12px rgba(0,0,0,.35));
    }

    .fgGaugeValueLabel{
      fill: rgba(232,238,245,.82);
      font-size: 12px;
      font-weight: 700;
      font-family: var(--mono);
      letter-spacing: .2px;
    }

    .fgSectionLabel{
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .4px;
      text-shadow: 0 1px 10px rgba(0,0,0,.22);
    }

    .fgGaugeCenter{
      position: absolute;
      left: 50%;
      bottom: 0;
      transform: translateX(-50%);
      text-align: center;
      width: 128px;
      height: 72px;
      border-radius: 72px 72px 0 0;
      background:
        linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03)),
        rgba(12,18,30,.95);
      border: 1px solid rgba(255,255,255,.08);
      border-bottom: 0;
      display:grid;
      place-items:center;
      padding-top: 12px;
      pointer-events:none;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
    }

    .fgGaugeScore{
      font-size: 36px;
      line-height: 1;
      font-weight: 800;
      color: var(--fg-current-accent, rgba(240,246,255,.98));
      font-variant-numeric: tabular-nums;
      text-shadow: 0 0 18px rgba(0,0,0,.25);
    }

    .fgData{
      display:grid;
      gap: 12px;
      min-width: 0;
      align-self: stretch;
    }

    .fgStats{
      display:grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      align-content: start;
    }

    .fgMetric{
      min-width: 0;
      min-height: 78px;
      padding: 14px 12px 12px;
      border-radius: 12px;
      background:
        linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02)),
        var(--fg-accent-soft, rgba(255,255,255,.02));
      border: 1px solid var(--fg-accent-border, rgba(31,43,61,.85));
      display:grid;
      gap: 6px;
      align-content: center;
      justify-items:center;
      text-align:center;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
    }

    .fgMetricMain{
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.05),
        0 0 0 1px rgba(255,255,255,.02);
    }

    .fgMetric span{
      font-family: var(--mono);
      font-size: 11px;
      color: var(--muted);
      line-height: 1.15;
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .fgMetric b{
      font-size: 20px;
      line-height: 1;
      color: var(--fg-accent, rgba(240,246,255,.98));
      font-variant-numeric: tabular-nums;
      text-shadow: 0 0 18px var(--fg-accent-soft, transparent);
    }

    .fgMetric em{
      font-style: normal;
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1.2;
      color: var(--fg-accent, rgba(202,212,226,.88));
      font-weight: 700;
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .fgEmpty{
      min-height: 88px;
      display:grid;
      place-items:center;
      text-align:center;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
      border-radius: 12px;
      background: rgba(255,255,255,.03);
      border: 1px dashed rgba(31,43,61,.85);
    }

    .starPanel{
      padding: 18px;
      display:grid;
      gap: 14px;
      background:
        radial-gradient(900px 300px at 0% 0%, rgba(0,224,255,.08), transparent 58%),
        radial-gradient(900px 300px at 100% 0%, rgba(255,77,109,.08), transparent 58%),
        linear-gradient(180deg, rgba(10,15,26,.88), rgba(12,18,30,.78));
    }

    .starPanelHead{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap: 14px;
    }

    .starPanelTools{
      display:grid;
      gap: 10px;
      justify-items:end;
      min-width: 0;
      width: min(100%, 680px);
      max-width: 100%;
    }

    .starPanelTitle{
      display:grid;
      gap: 4px;
    }

    .starPanelTitle strong{
      font-size: 22px;
      line-height: 1.1;
      color: rgba(244,247,252,.98);
    }

    .starPanelTitle span{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }

    .starPeriodSeg{
      display:flex;
      gap: 6px;
      padding: 4px;
      border-radius: 999px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(31,43,61,.85);
      width: 100%;
      min-width: 0;
      max-width: 100%;
      justify-content: flex-start;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }

    .starPeriodSeg button{
      appearance:none;
      border:0;
      cursor:pointer;
      padding: 8px 12px;
      border-radius: 999px;
      background: transparent;
      color: rgba(230,237,247,.72);
      font-family: var(--mono);
      font-size: 12px;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .starPeriodSeg button.active{
      color: rgba(255,255,255,.96);
      background: rgba(255,180,0,.16);
      box-shadow: inset 0 0 0 1px rgba(255,180,0,.24);
    }

    .starManageBtn{
      appearance:none;
      border: 1px solid rgba(0,224,255,.24);
      cursor:pointer;
      padding: 9px 14px;
      border-radius: 999px;
      background: rgba(0,224,255,.10);
      color: rgba(230,237,247,.94);
      font-family: var(--mono);
      font-size: 12px;
      white-space: nowrap;
    }

    .sectorViewSeg{
      display:inline-flex;
      gap: 6px;
      padding: 4px;
      border-radius: 999px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(31,43,61,.85);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .sectorViewSeg button{
      appearance:none;
      border:0;
      cursor:pointer;
      padding: 8px 12px;
      border-radius: 999px;
      background: transparent;
      color: rgba(230,237,247,.72);
      font-family: var(--mono);
      font-size: 12px;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .sectorViewSeg button.active{
      color: rgba(255,255,255,.96);
      background: rgba(0,224,255,.16);
      box-shadow: inset 0 0 0 1px rgba(0,224,255,.24);
    }

    .starPanelMeta{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      flex-wrap: wrap;
      min-height: 20px;
    }

    .starPanelMetaText{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }

    .starPanelMetaText.ok{ color: rgba(0,224,255,.85); }
    .starPanelMetaText.err{ color: rgba(255,77,109,.90); }

    .panelSourceBadges{
      display:flex;
      align-items:center;
      gap: 6px;
      flex-wrap: wrap;
      min-width: 0;
    }

    .panelSourceBadge{
      display:inline-flex;
      align-items:center;
      gap: 5px;
      min-height: 24px;
      padding: 3px 7px 3px 4px;
      border: 1px solid rgba(132,151,179,.28);
      border-radius: 6px;
      background: rgba(255,255,255,.035);
      color: rgba(228,236,247,.86);
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1;
      white-space: nowrap;
    }

    .panelSourceIcon{
      display:block;
      width: 16px;
      height: 16px;
      flex: 0 0 16px;
    }

    .panelSourceOfficialIcon{
      object-fit: contain;
      border-radius: 2px;
    }

    .starGrid{
      display:grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      align-items: stretch;
    }

    .starCard{
      position: relative;
      overflow: hidden;
      border-radius: 14px;
      border: 1px solid rgba(31,43,61,.85);
      background:
        linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)),
        rgba(13,20,32,.76);
      padding: 16px;
      display:grid;
      gap: 14px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
      will-change: transform, opacity;
    }

    .starCard::after{
      content:"";
      position:absolute;
      inset:auto -20% -45% auto;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: var(--star-accent-soft, rgba(255,255,255,.05));
      filter: blur(8px);
      pointer-events:none;
    }

    .starCard.up{
      --star-accent: var(--up);
      --star-accent-soft: rgba(255,77,109,.12);
      --star-accent-border: rgba(255,77,109,.22);
    }

    .starCard.down{
      --star-accent: var(--down);
      --star-accent-soft: rgba(34,197,94,.12);
      --star-accent-border: rgba(34,197,94,.22);
    }

    .starCard.flat{
      --star-accent: rgba(226,232,240,.92);
      --star-accent-soft: rgba(148,163,184,.10);
      --star-accent-border: rgba(148,163,184,.18);
    }

    .starCard{
      border-color: var(--star-accent-border, rgba(31,43,61,.85));
    }

    .starCardTop{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 14px;
      min-width: 0;
      position: relative;
      z-index: 1;
    }

    .starIdentity{
      display:flex;
      align-items:center;
      gap: 14px;
      min-width: 0;
    }

    .starIconWrap{
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.06));
      border: 1px solid rgba(255,255,255,.14);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
      display:grid;
      place-items:center;
      flex: 0 0 auto;
    }

    .starIcon{
      width: 32px;
      height: 32px;
      object-fit: contain;
      display:block;
      filter: brightness(2.32) saturate(1.40) contrast(1.14);
    }

    .starNameBox{
      min-width: 0;
      display:grid;
      gap: 4px;
    }

    .starName{
      font-size: 15px;
      font-weight: 700;
      color: rgba(244,247,252,.98);
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .starSymbol{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      letter-spacing: .4px;
    }

    .starDeltaChip{
      flex: 0 0 auto;
      padding: 8px 12px;
      border-radius: 999px;
      background: var(--star-accent-soft, rgba(255,255,255,.04));
      border: 1px solid var(--star-accent-border, rgba(31,43,61,.85));
      color: var(--star-accent, rgba(244,247,252,.96));
      font-family: var(--mono);
      font-size: 13px;
      font-weight: 700;
      max-width: 100%;
    }

    .starBody{
      position: relative;
      z-index: 1;
      display:grid;
      gap: 12px;
    }

    .starPrice{
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap: 12px;
    }

    .starPriceValue{
      font-size: 32px;
      line-height: 1;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: rgba(244,247,252,.98);
    }

    .starPeriodTag{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
    }

    .starMetrics{
      display:grid;
      grid-template-columns: 1fr auto;
      gap: 6px 12px;
      font-family: var(--mono);
      font-size: 13px;
      align-items: baseline;
      color: rgba(168,184,210,.94);
    }

    .starMetrics > div:nth-child(2n){
      text-align: right;
      font-variant-numeric: tabular-nums;
      justify-self: end;
    }

    .starMetrics strong{
      color: var(--star-accent, rgba(244,247,252,.98));
      font-weight: 700;
    }

    .starCardLatest{
      justify-self: end;
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1.2;
      color: rgba(200,214,236,.84);
      text-align: right;
      white-space: nowrap;
    }

    .starPanelEmpty{
      min-height: 180px;
      border-radius: 14px;
      border: 1px dashed rgba(31,43,61,.85);
      background: rgba(255,255,255,.03);
      display:grid;
      place-items:center;
      text-align:center;
      padding: 20px;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 13px;
    }

    .starManageOverlay{
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(3,7,18,.68);
      backdrop-filter: blur(8px);
      display:grid;
      place-items:center;
      padding: 18px;
    }

    .starManageModal{
      width: min(760px, 100%);
      max-height: min(84vh, 860px);
      overflow: auto;
      border-radius: 18px;
      border: 1px solid rgba(31,43,61,.88);
      background:
        radial-gradient(900px 260px at 0% 0%, rgba(0,224,255,.08), transparent 58%),
        linear-gradient(180deg, rgba(10,15,26,.96), rgba(12,18,30,.94));
      box-shadow: 0 24px 80px rgba(0,0,0,.42);
      padding: 18px;
      display:grid;
      gap: 14px;
    }

    .starManageHead{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap: 12px;
    }

    .starManageTitle{
      display:grid;
      gap: 4px;
    }

    .starManageTitle strong{
      font-size: 20px;
      line-height: 1.1;
      color: rgba(244,247,252,.98);
    }

    .starManageTitle span{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }

    .starManageClose,
    .starManageDelete,
    .starManageSubmit{
      appearance:none;
      border: 1px solid rgba(31,43,61,.88);
      cursor:pointer;
      border-radius: 12px;
      font-family: var(--mono);
      font-size: 12px;
      color: rgba(230,237,247,.94);
      background: rgba(255,255,255,.05);
    }

    .starManageClose{
      padding: 9px 14px;
    }

    .starManageStatus{
      min-height: 18px;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }

    .starManageStatus.ok{ color: rgba(0,224,255,.85); }
    .starManageStatus.err{ color: rgba(255,77,109,.90); }

    .starManageForm{
      display:grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      gap: 12px;
      align-items:end;
    }

    .starManageField{
      display:grid;
      gap: 6px;
      min-width: 0;
    }

    .starManageField label{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }

    .starManageField input{
      width: 100%;
      min-width: 0;
      padding: 11px 12px;
      border-radius: 12px;
      border: 1px solid rgba(31,43,61,.88);
      background: rgba(255,255,255,.04);
      color: rgba(244,247,252,.98);
      font-size: 14px;
    }

    .starManageSubmit{
      padding: 11px 16px;
      background: rgba(0,224,255,.12);
      border-color: rgba(0,224,255,.24);
    }

    .starManageSubmit[disabled],
    .starManageDelete[disabled]{
      opacity: .55;
      cursor: default;
    }

    .starManageList{
      display:grid;
      gap: 10px;
    }

    .starManageItem{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(31,43,61,.85);
      background: rgba(255,255,255,.04);
    }

    .starManageItemMain{
      display:grid;
      gap: 4px;
      min-width: 0;
    }

    .starManageItemMain strong{
      font-family: var(--mono);
      font-size: 13px;
      color: rgba(244,247,252,.98);
    }

    .starManageItemMain span{
      color: rgba(226,232,240,.90);
      font-size: 14px;
    }

    .starManageDelete{
      padding: 9px 14px;
      color: rgba(255,113,140,.94);
      border-color: rgba(255,77,109,.22);
      background: rgba(255,77,109,.08);
      white-space: nowrap;
    }

    .sectorHeatGrid{
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      align-items: stretch;
    }

    .idxHeatGrid{
      display:grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .idxHeatGrid .sectorHeatTile{
      min-height: 0;
    }

    .sectorHeatTile{
      position: relative;
      overflow: hidden;
      border-radius: 16px;
      border: 1px solid rgba(31,43,61,.85);
      padding: 16px;
      display:grid;
      gap: 14px;
      min-height: 188px;
      will-change: transform, opacity;
    }

    .sectorHeatHeader{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap: 12px;
    }

    .sectorHeatPrice{
      font-family: var(--mono);
      font-size: 14px;
      font-weight: 700;
      color: rgba(230,237,247,.92);
      white-space: nowrap;
      margin-top: 2px;
    }

    .sectorHeatPct{
      font-size: 36px;
      line-height: 1;
      font-weight: 800;
      color: rgba(244,247,252,.98);
      font-variant-numeric: tabular-nums;
      letter-spacing: -.02em;
    }

    .sectorHeatMain{
      display:grid;
      grid-template-columns: minmax(0, 1fr) 120px;
      align-items: center;
      gap: 14px;
      min-height: 42px;
    }

    .sectorHeatTrend{
      display:grid;
      justify-items: end;
      align-items: end;
      gap: 6px;
      min-width: 0;
    }

    .sectorHeatMeta{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 10px;
      font-family: var(--mono);
      font-size: 12px;
      color: rgba(200,214,236,.88);
    }

    .sectorHeatMeta strong{
      font-size: 13px;
      color: rgba(244,247,252,.96);
    }

    .sectorHeatMetaWithLatest{
      align-items: flex-end;
    }

    .sectorHeatMetaLatest{
      margin-left: auto;
      font-size: 11px;
      line-height: 1.2;
      color: rgba(200,214,236,.84);
      text-align: right;
      white-space: nowrap;
    }

    .sectorHeatInfoStack{
      display:grid;
      gap: 6px;
    }

    .sectorHeatMetaStar{
      --sector-star-side-w: 220px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) var(--sector-star-side-w);
      align-items: end;
      gap: 12px;
    }

    .sectorHeatMetaStar .sectorHeatTarget{
      width: 100%;
      justify-self: start;
      justify-content: flex-start;
      text-align: left;
    }

    .sectorHeatLatest{
      justify-self: end;
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1.2;
      color: rgba(200,214,236,.84);
      text-align: right;
      white-space: nowrap;
    }

    .sectorHeatExtra{
      display:grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items:center;
      gap: 12px;
      min-width: 0;
      font-family: var(--mono);
      font-size: 12px;
      color: rgba(200,214,236,.88);
    }

    .sectorHeatExtraLabel{
      line-height: 1.2;
      white-space: nowrap;
    }

    .sectorHeatExtraLatest{
      min-width: 0;
      font-size: 11px;
      line-height: 1.2;
      color: rgba(200,214,236,.84);
      text-align: right;
      white-space: nowrap;
    }

    .sectorHeatExtraStar{
      grid-template-columns: minmax(0, 1fr) var(--sector-star-side-w, 220px);
      grid-template-areas:
        "forward current"
        "market latest";
      row-gap: 6px;
      column-gap: 12px;
      align-items: end;
    }

    .sectorHeatExtraForward{
      grid-area: forward;
    }

    .sectorHeatExtraCurrent{
      grid-area: current;
      justify-self: start;
      text-align: left;
    }

    .sectorHeatExtraMarketCap{
      grid-area: market;
    }

    .sectorHeatExtraStar .sectorHeatExtraLatest{
      grid-area: latest;
      justify-self: start;
      align-self: end;
      text-align: left;
    }

    .sectorHeatTarget{
      display:inline-flex;
      align-items:center;
      justify-content:flex-end;
      gap: 0;
      min-width: 0;
      white-space: nowrap;
      text-align: right;
      line-height: 1.2;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .1px;
    }

    .sectorHeatTargetLabel{
      color: rgba(244,247,252,.98);
      text-shadow: none;
    }

    .sectorHeatTargetPct{
      display:inline-block;
      line-height: 1.2;
    }

    .fundPremiumMeta{
      align-items:flex-start;
    }

    .fundPremiumMetaRight{
      display:grid;
      justify-items:end;
      gap: 4px;
      min-width: max-content;
    }

    .fundPremiumRate{
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .2px;
      color: rgba(226,232,240,.92);
      text-shadow: 0 0 12px rgba(226,232,240,.18);
      white-space: nowrap;
    }

    .fundPremiumRate.premiumPositive{
      color: var(--up);
      text-shadow: 0 0 14px rgba(255,77,109,.32);
    }

    .fundPremiumRate.premiumNegative{
      color: var(--down);
      text-shadow: 0 0 14px rgba(34,197,94,.30);
    }

    .fundIconWrap{
      border-style: dashed;
      background:
        radial-gradient(circle at 50% 45%, rgba(0,224,255,.10), rgba(0,224,255,0) 62%),
        linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
    }

    .fundPremiumTile .starIdentity{
      align-items:center;
    }

    .fundPremiumTile .starIconWrap{
      width: 86px;
      height: 48px;
      padding: 5px;
      overflow: hidden;
      background:
        radial-gradient(circle at 50% 42%, rgba(255,255,255,.14), rgba(255,255,255,0) 62%),
        linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.06));
      border-color: rgba(255,255,255,.14);
    }

    .fundPremiumTile .starIcon{
      width: 76px;
      height: 38px;
      border-radius: 0;
      object-fit: contain;
      object-position: center;
      filter: none;
    }

    .fundIconBlank{
      width: 30px;
      height: 30px;
      border-radius: 10px;
      border: 1px dashed rgba(200,214,236,.30);
      background: linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.03));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
    }

    .fundIcon{
      border-radius: 0;
      filter: none;
    }

    .fundPremiumTile[data-fund-lof-detail="1"]{
      cursor: help;
      user-select: none;
      touch-action: manipulation;
    }

    .fundPremiumHoldHint{
      justify-self: end;
      margin-top: -6px;
      font-family: var(--mono);
      font-size: 10px;
      color: rgba(200,214,236,.62);
      white-space: nowrap;
    }

    .fundCalcOverlay{
      position: fixed;
      inset: 0;
      z-index: 10020;
      background: rgba(3,7,18,.72);
      backdrop-filter: blur(10px);
      display:grid;
      place-items:center;
      padding: 18px;
    }

    .fundCalcModal{
      width: min(980px, 100%);
      max-height: min(88vh, 920px);
      overflow: auto;
      border-radius: 20px;
      border: 1px solid rgba(31,43,61,.92);
      background:
        radial-gradient(900px 320px at 0% 0%, rgba(255,77,109,.12), transparent 60%),
        radial-gradient(760px 260px at 100% 8%, rgba(0,224,255,.09), transparent 58%),
        linear-gradient(180deg, rgba(10,15,26,.98), rgba(12,18,30,.96));
      box-shadow: 0 28px 90px rgba(0,0,0,.50);
      padding: 18px;
      display:grid;
      gap: 14px;
    }

    .fundCalcHead{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap: 14px;
    }

    .fundCalcHead div{
      display:grid;
      gap: 5px;
    }

    .fundCalcHead span{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }

    .fundCalcHead strong{
      color: rgba(244,247,252,.98);
      font-size: 22px;
      line-height: 1.12;
    }

    .fundCalcClose{
      appearance:none;
      border: 1px solid rgba(31,43,61,.88);
      cursor:pointer;
      border-radius: 12px;
      font-family: var(--mono);
      font-size: 12px;
      color: rgba(226,232,240,.94);
      background: rgba(255,255,255,.06);
      padding: 8px 12px;
    }

    .fundCalcSummary{
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .fundCalcSummary div,
    .fundCalcSection{
      border-radius: 16px;
      border: 1px solid rgba(31,43,61,.82);
      background: rgba(255,255,255,.045);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
    }

    .fundCalcSummary div{
      padding: 12px;
      display:grid;
      gap: 5px;
    }

    .fundCalcSummary span,
    .fundCalcKv span{
      font-family: var(--mono);
      font-size: 11px;
      color: rgba(169,185,211,.82);
    }

    .fundCalcSummary strong{
      color: rgba(244,247,252,.98);
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.25;
      word-break: break-word;
    }

    .fundCalcSection{
      padding: 14px;
      display:grid;
      gap: 12px;
    }

    .fundCalcSection h4{
      margin: 0;
      color: rgba(244,247,252,.96);
      font-size: 15px;
      line-height: 1.25;
    }

    .fundCalcGrid{
      display:grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .fundCalcKv{
      min-width: 0;
      display:grid;
      gap: 4px;
      padding: 10px;
      border-radius: 12px;
      background: rgba(3,7,18,.30);
      border: 1px solid rgba(31,43,61,.60);
    }

    .fundCalcKv strong{
      color: rgba(230,237,247,.96);
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.35;
      word-break: break-word;
      white-space: normal;
    }

    .fundCalcSourceBlock p{
      margin: 0;
      color: rgba(200,214,236,.86);
      font-family: var(--mono);
      font-size: 11px;
      line-height: 1.45;
      word-break: break-all;
    }

    .fundCalcSourceBlock strong{
      color: rgba(244,247,252,.94);
    }

    .cardTimeAnomaly{
      color: rgba(255,77,109,.98) !important;
      font-weight: 800;
      text-shadow: 0 0 14px rgba(255,77,109,.36);
    }

    .sectorHeatSparkline{
      justify-self: end;
      align-self: center;
      width: 120px;
      height: 42px;
      color: rgba(226,232,240,.94);
    }

    .sectorHeatSparkline svg{
      width: 100%;
      height: 100%;
      display: block;
      overflow: visible;
    }

    .sectorHeatSparkline polyline{
      fill: none;
      stroke: currentColor;
      stroke-width: 2.2;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 0 8px currentColor);
      opacity: .96;
    }

    .sectorHeatSparkline circle{
      fill: currentColor;
      filter: drop-shadow(0 0 8px currentColor);
    }

    .sectorHeatSparkline.up{
      color: var(--up);
    }

    .sectorHeatSparkline.down{
      color: var(--down);
    }

    .sectorHeatSparkline.flat{
      color: rgba(226,232,240,.94);
    }

    .sectorHeatDeltaInline{
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.2;
      color: rgba(244,247,252,.96);
      white-space: nowrap;
    }

    .sectorHeatTile.up .sectorHeatPrice,
    .sectorHeatTile.up .sectorHeatPct,
    .sectorHeatTile.up .sectorHeatMeta strong,
    .sectorHeatTile.up .sectorHeatDeltaInline{
      color: var(--up);
    }

    .sectorHeatTile.down .sectorHeatPrice,
    .sectorHeatTile.down .sectorHeatPct,
    .sectorHeatTile.down .sectorHeatMeta strong,
    .sectorHeatTile.down .sectorHeatDeltaInline{
      color: var(--down);
    }

    .sectorHeatTile.flat .sectorHeatPrice,
    .sectorHeatTile.flat .sectorHeatPct,
    .sectorHeatTile.flat .sectorHeatMeta strong,
    .sectorHeatTile.flat .sectorHeatDeltaInline{
      color: rgba(226,232,240,.94);
    }

    .sectorBarList{
      display:grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .sectorBarRow{
      position: relative;
      overflow: hidden;
      border-radius: 14px;
      border: 1px solid rgba(31,43,61,.85);
      background:
        linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)),
        rgba(13,20,32,.76);
      padding: 16px;
      display:grid;
      gap: 12px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
      will-change: transform, opacity;
    }

    .sectorBarTop{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap: 14px;
    }

    .sectorBarValues{
      display:grid;
      justify-items:end;
      gap: 6px;
      min-width: 96px;
      text-align:right;
    }

    .sectorBarValues strong{
      font-size: 28px;
      line-height: 1;
      color: rgba(244,247,252,.98);
      font-variant-numeric: tabular-nums;
      letter-spacing: -.02em;
    }

    .sectorBarValues span{
      font-family: var(--mono);
      font-size: 12px;
      color: rgba(200,214,236,.88);
    }

    .sectorBarTrack{
      position: relative;
      width: 100%;
      height: 12px;
      border-radius: 999px;
      overflow: hidden;
      background:
        linear-gradient(
          90deg,
          rgba(34,197,94,.10) 0 49.5%,
          rgba(255,255,255,.08) 49.5% 50.5%,
          rgba(255,77,109,.10) 50.5% 100%
        );
      border: 1px solid rgba(255,255,255,.05);
    }

    .sectorBarAxis{
      display:grid;
      grid-template-columns: 1fr auto 1fr;
      align-items:center;
      gap: 10px;
      font-family: var(--mono);
      font-size: 11px;
      color: rgba(196,211,236,.82);
    }

    .sectorBarAxis span:last-child{
      text-align:right;
    }

    .sectorBarAxis strong{
      font-size: 12px;
      color: rgba(244,247,252,.94);
      font-weight: 700;
      justify-self:center;
    }

    .sectorBarMidline{
      position: absolute;
      top: -1px;
      bottom: -1px;
      left: 50%;
      width: 1px;
      transform: translateX(-50%);
      background: rgba(244,247,252,.36);
      box-shadow: 0 0 12px rgba(244,247,252,.12);
      z-index: 1;
      pointer-events: none;
    }

    .sectorBarFill{
      position: absolute;
      top: 0;
      bottom: 0;
      z-index: 2;
    }

    .sectorBarFill.positive{
      left: 50%;
      border-radius: 0 999px 999px 0;
    }

    .sectorBarFill.negative{
      right: 50%;
      border-radius: 999px 0 0 999px;
    }

    .sectorBarFill.flat{
      left: 50%;
      width: 0 !important;
      box-shadow: none !important;
    }

    .sectorBarMeta{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 10px;
      font-family: var(--mono);
      font-size: 12px;
      color: rgba(200,214,236,.88);
    }

    .sectorBarMeta strong{
      font-size: 13px;
      color: rgba(244,247,252,.96);
    }

    .weightsPanel{
      padding: 18px;
      display:grid;
      gap: 14px;
      background:
        radial-gradient(900px 320px at 0% 0%, rgba(0,224,255,.12), transparent 58%),
        radial-gradient(900px 320px at 100% 0%, rgba(64,156,255,.10), transparent 58%),
        linear-gradient(180deg, rgba(10,15,26,.88), rgba(12,18,30,.78));
    }

    .weightsHead{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap: 16px;
    }

    .weightsTitle{
      display:grid;
      gap: 4px;
    }

    .weightsTitle strong{
      font-size: 22px;
      line-height: 1.1;
      color: rgba(244,247,252,.98);
    }

    .weightsTitle span{
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }

    .weightsMeta{
      display:grid;
      justify-items:end;
      gap: 6px;
      text-align:right;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }

    .weightsMeta strong{
      color: rgba(244,247,252,.98);
      font-size: 13px;
      font-weight: 700;
    }

    .weightsMeta .ok{ color: rgba(0,224,255,.85); }
    .weightsMeta .err{ color: rgba(255,77,109,.90); }
    .weightsMeta .panelSourceBadges{ justify-content: flex-end; }

    .weightsIndexSeg{
      display:inline-flex;
      gap: 6px;
      padding: 4px;
      border-radius: 999px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(31,43,61,.85);
      width: fit-content;
      max-width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }

    .weightsIndexSeg button{
      appearance:none;
      border:0;
      cursor:pointer;
      padding: 8px 12px;
      border-radius: 999px;
      background: transparent;
      color: rgba(230,237,247,.72);
      font-family: var(--mono);
      font-size: 12px;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .weightsIndexSeg button.active{
      color: rgba(255,255,255,.96);
      background: rgba(0,224,255,.16);
      box-shadow: inset 0 0 0 1px rgba(0,224,255,.26);
    }

    .weightsList{
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .commonWeightList{
      display:grid;
      gap: 10px;
    }

    .commonWeightRow{
      position: relative;
      display:grid;
      grid-template-columns: 42px minmax(220px, 1.05fr) minmax(360px, 2.2fr);
      align-items:center;
      gap: 14px;
      padding: 14px;
      border-radius: 14px;
      border: 1px solid rgba(31,43,61,.85);
      background:
        linear-gradient(90deg, var(--common-weight-glow, rgba(38,106,255,.12)), transparent 34%),
        rgba(255,255,255,.035);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
      overflow: hidden;
    }

    .commonWeightRank{
      width: 34px;
      height: 34px;
      border-radius: 999px;
      display:grid;
      place-items:center;
      background: rgba(32,118,255,.12);
      border: 1px solid rgba(105,214,255,.22);
      color: rgba(156,231,255,.98);
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 800;
    }

    .commonWeightIdentity{
      display:flex;
      align-items:center;
      gap: 12px;
      min-width: 0;
    }

    .commonWeightCells{
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      min-width: 0;
    }

    .commonWeightCell{
      min-width: 0;
      padding: 9px 10px;
      border-radius: 11px;
      border: 1px solid rgba(255,255,255,.07);
      background: rgba(5,10,18,.44);
      display:grid;
      gap: 6px;
      font-family: var(--mono);
    }

    .commonWeightCell span{
      font-size: 11px;
      color: rgba(183,202,230,.76);
      white-space: nowrap;
    }

    .commonWeightCell strong{
      font-size: 17px;
      line-height: 1;
      color: rgba(244,247,252,.96);
      font-variant-numeric: tabular-nums;
    }

    .commonWeightBar{
      height: 5px;
      border-radius: 999px;
      overflow:hidden;
      background: rgba(255,255,255,.06);
    }

    .commonWeightBar i{
      display:block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(32,118,255,.95), rgba(0,224,255,.95));
      box-shadow: 0 0 14px rgba(32,118,255,.24);
    }

    .weightCard{
      position: relative;
      overflow: hidden;
      border-radius: 14px;
      border: 1px solid rgba(31,43,61,.85);
      background:
        linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)),
        rgba(13,20,32,.76);
      padding: 16px;
      display:grid;
      gap: 14px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
      min-height: 188px;
    }

    .weightCard::after{
      content:"";
      position:absolute;
      inset:auto -16% -46% auto;
      width: 110px;
      height: 110px;
      border-radius: 50%;
      background: var(--weight-glow-soft, rgba(64,156,255,.16));
      filter: blur(10px);
      pointer-events:none;
    }

    .weightCardTop{
      position: relative;
      z-index: 1;
      display:flex;
      align-items:center;
      gap: 14px;
      min-width: 0;
      padding-right: 50px;
    }

    .weightRankBadge{
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 2;
      min-width: 34px;
      padding: 7px 9px;
      border-radius: 999px;
      background: rgba(0,224,255,.12);
      border: 1px solid rgba(0,224,255,.22);
      color: rgba(156,231,255,.98);
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 700;
      line-height: 1;
      text-align: center;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      pointer-events: none;
    }

    .weightIconWrap{
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.06));
      border: 1px solid rgba(255,255,255,.14);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
      display:grid;
      place-items:center;
      flex: 0 0 auto;
    }

    .weightIcon{
      width: 32px;
      height: 32px;
      object-fit: contain;
      display:block;
      filter: brightness(2.38) saturate(1.42) contrast(1.14);
    }

    .weightName{
      min-width: 0;
      font-size: 15px;
      font-weight: 700;
      color: rgba(244,247,252,.98);
      line-height: 1.25;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .weightNameBox{
      display:grid;
      gap: 5px;
      min-width: 0;
    }

    .weightSymbol{
      font-family: var(--mono);
      font-size: 12px;
      color: rgba(208,225,246,.84);
      line-height: 1;
    }

    .weightValue{
      position: relative;
      z-index: 1;
      display:flex;
      align-items:flex-end;
      justify-content:flex-start;
      gap: 12px;
      font-family: var(--mono);
    }

    .weightValue span{
      font-size: 11px;
      color: var(--muted);
      white-space: nowrap;
    }

    .weightValue strong{
      font-size: 36px;
      line-height: 1;
      color: rgba(124,232,255,.99);
      font-variant-numeric: tabular-nums;
      text-shadow:
        0 0 10px rgba(90,214,255,.34),
        0 0 22px rgba(0,224,255,.28),
        0 0 36px rgba(64,156,255,.24);
    }

    .weightBar{
      position: relative;
      z-index: 1;
      width: 100%;
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.05);
    }

    .weightBarFill{
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(0,224,255,.94), rgba(64,156,255,.98));
      box-shadow: 0 0 18px rgba(0,224,255,.22);
    }

    .weightsEmpty{
      min-height: 220px;
      border-radius: 14px;
      border: 1px dashed rgba(31,43,61,.85);
      background: rgba(255,255,255,.03);
      display:grid;
      place-items:center;
      text-align:center;
      padding: 20px;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 13px;
    }

    @media (max-width: 980px){
      body{ padding: 12px; }

      .top{
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }

      .brand{
        flex-wrap: wrap;
        gap: 10px;
      }

      .buildInfo{
        width: 100%;
        text-align: left;
      }

      .buildInfoLine{
        max-width: none;
        white-space: normal;
        overflow: visible;
        text-overflow: clip;
      }

      .buildInfoSubline{
        max-width: none;
        white-space: normal;
        overflow: visible;
        text-overflow: clip;
      }

      .logo{
        width: 110px;
        height: auto;
        max-height: 32px;
      }

      .title{
        flex: 1 1 auto;
        min-width: 160px;
      }

      .titleHead{
        justify-content: flex-start;
      }

      .title .h{ font-size: 12px; }
      .title .sub{ font-size: 12px; }

      .globalRefreshBtn{
        padding: 3px 8px;
        font-size: 10px;
      }

      .seg{
        width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        white-space: nowrap;
        justify-content: flex-start;
        gap: 6px;
      }

      .seg button{
        flex: 0 0 auto;
        padding: 8px 10px;
      }

      .indexSourceSeg{
        max-width: 100%;
      }

      .asof{
        align-self: flex-end;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .grid{
        display:flex;
        flex-direction: column;
      }

      .pageSeg{
        display:flex;
        width: 100%;
        justify-content: flex-start;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        padding: 5px;
      }

      .pageSeg button{
        flex: 0 0 auto;
        padding: 9px 14px;
      }

      .card.info{ order: 1; }
      .card.chart{ order: 2; }

      .chartWrap{ height: 420px; }
      :root{ --kv-val-w: 124px; }

      .fsBtn{ display:flex; }

      .fgTitle{ font-size: 16px; }
      .cnnLogo{ width: 48px; height: 48px; flex-basis: 48px; }
      .fgCardInner{ grid-template-columns: 1fr; gap: 12px; }
      .fgStats{ grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .fgGaugeBox{ width: min(100%, 330px); }
      .fgGaugeCenter{ width: 118px; height: 66px; padding-top: 11px; }
      .fgGaugeScore{ font-size: 32px; }
      .fgSectionLabel{ font-size: 11px; }
      .fgGaugeValueLabel{ font-size: 11px; }
      .fgMetric{ min-height: 74px; padding: 12px 8px 10px; gap: 5px; }
      .fgMetric span{ font-size: 11px; }
      .fgMetric b{ font-size: 18px; }
      .fgMetric em{ font-size: 10px; }

      .starPanel{
        padding: 14px;
        gap: 12px;
      }

      .blockMeta{
        text-align:left;
        white-space: normal;
      }

      .overviewMeta{
        padding: 0;
      }

      .starPanelHead{
        flex-direction: column;
        align-items: stretch;
      }

      .starPanelTools{
        justify-items: stretch;
      }

      .starManageBtn{
        width: 100%;
      }

      .starPanelTitle strong{
        font-size: 18px;
      }

      .starGrid{
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .starManageOverlay{
        padding: max(12px, env(safe-area-inset-top)) 12px 12px 12px;
        place-items: start center;
      }

      .starManageModal{
        width: 100%;
        max-height: calc(100vh - 24px);
        padding: 14px;
        gap: 12px;
        border-radius: 16px;
      }

      .fundCalcOverlay{
        padding: max(12px, env(safe-area-inset-top)) 12px 12px 12px;
        place-items: start center;
      }

      .fundCalcModal{
        width: 100%;
        max-height: calc(100vh - 24px);
        padding: 14px;
        gap: 12px;
        border-radius: 16px;
      }

      .fundCalcHead{
        gap: 10px;
      }

      .fundCalcHead strong{
        font-size: 18px;
      }

      .fundCalcSummary,
      .fundCalcGrid{
        grid-template-columns: 1fr;
      }

      .fundCalcClose{
        flex: 0 0 auto;
      }

      .starManageHead{
        flex-direction: row;
        align-items: flex-start;
      }

      .starManageForm{
        grid-template-columns: 1fr;
      }

      .starManageClose{
        width: auto;
        flex: 0 0 auto;
      }

      .starManageItem{
        flex-direction: row;
        align-items: center;
      }

      .starManageSubmit{
        width: 100%;
      }

      .starManageDelete{
        width: auto;
        flex: 0 0 auto;
      }

      #idxCards{
        gap: 10px;
      }

      .idxTile{
        padding: 14px;
        gap: 12px;
      }

      .idxTileTop{
        gap: 12px;
      }

      .idxIdentity{
        gap: 12px;
      }

      .idxIconWrap{
        width: 46px;
        height: 46px;
      }

      .idxIcon{
        width: 28px;
        height: 28px;
        filter: brightness(2.44) saturate(1.45) contrast(1.16);
      }

      .idxName{
        font-size: 14px;
      }

      .idxMainValue strong{
        font-size: 28px;
      }

      .idxMetrics{
        font-size: 12px;
        gap: 7px 12px;
      }

      .weightsPanel{
        padding: 14px;
        gap: 12px;
      }

      .sectorHeatGrid{
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .sectorHeatTile{
        padding: 14px;
        gap: 12px;
        min-height: 0;
      }

      .sectorHeatPct{
        font-size: 30px;
      }

      .sectorHeatMain{
        grid-template-columns: minmax(0, 1fr) 104px;
        gap: 10px;
        min-height: 38px;
      }

      .sectorHeatTrend{
        gap: 5px;
      }

      .sectorHeatPrice{
        font-size: 13px;
      }

      .sectorHeatMeta{
        flex-direction: column;
        align-items:flex-start;
      }

      .sectorHeatMetaStar{
        display:flex;
        flex-direction: column;
        align-items:flex-start;
        gap: 4px;
      }

      .sectorHeatMetaStar .sectorHeatTarget{
        width: auto;
        justify-self: auto;
        justify-content: flex-end;
        text-align: right;
      }

      .fundPremiumMetaRight{
        justify-items:start;
        text-align:left;
      }

      .sectorHeatMetaWithLatest{
        flex-direction: row;
        align-items: flex-end;
        justify-content: space-between;
      }

      .sectorHeatLatest{
        justify-self: end;
        text-align: right;
      }

      .sectorHeatSparkline{
        justify-self: end;
        align-self: center;
        width: 104px;
        height: 38px;
      }

      .sectorHeatMetaLatest{
        margin-left: 10px;
      }

      .sectorHeatExtraStar{
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .sectorHeatExtraCurrent{
        justify-self: end;
        text-align: right;
      }

      .sectorHeatExtraStar .sectorHeatExtraLatest{
        justify-self: end;
        text-align: right;
      }

      .sectorBarRow{
        padding: 14px;
        gap: 10px;
      }

      .sectorBarTop{
        flex-direction: column;
        align-items: stretch;
      }

      .sectorBarValues{
        justify-items:start;
        text-align:left;
        min-width: 0;
      }

      .sectorBarValues strong{
        font-size: 24px;
      }

      .sectorBarAxis{
        font-size: 10px;
      }

      .sectorBarMeta{
        flex-direction: column;
        align-items:flex-start;
      }

      .weightsHead{
        flex-direction: column;
        align-items: stretch;
      }

      .weightsTitle strong{
        font-size: 18px;
      }

      .weightsMeta{
        justify-items: start;
        text-align: left;
      }

      .weightsMeta .panelSourceBadges{ justify-content: flex-start; }

      .weightsIndexSeg{
        width: 100%;
      }

      .weightsList{
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .commonWeightRow{
        grid-template-columns: 34px minmax(0, 1fr);
        gap: 10px;
        padding: 12px;
      }

      .commonWeightIdentity{
        min-width: 0;
      }

      .commonWeightCells{
        grid-column: 1 / -1;
        grid-template-columns: 1fr;
      }

      .weightCard{
        padding: 14px;
        gap: 12px;
        min-height: 0;
      }

      .weightCardTop{
        gap: 12px;
        padding-right: 44px;
      }

      .weightRankBadge{
        top: 10px;
        right: 10px;
        min-width: 30px;
        padding: 6px 8px;
        font-size: 11px;
      }

      .weightIconWrap{
        width: 46px;
        height: 46px;
      }

      .weightIcon{
        width: 28px;
        height: 28px;
        filter: brightness(2.48) saturate(1.45) contrast(1.16);
      }

      .weightName{
        font-size: 14px;
      }

      .weightValue strong{
        font-size: 30px;
      }

      .starCard{
        padding: 14px;
        gap: 12px;
      }

      .starIconWrap{
        width: 46px;
        height: 46px;
      }

      .starIcon{
        width: 28px;
        height: 28px;
        filter: brightness(2.42) saturate(1.44) contrast(1.16);
      }

      .starName{
        font-size: 14px;
        white-space: normal;
        overflow: hidden;
        text-overflow: clip;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        line-height: 1.25;
      }

      .starDeltaChip{
        padding: 7px 10px;
        font-size: 12px;
        justify-self: start;
        width: fit-content;
        max-width: none;
      }

      .starPriceValue{
        font-size: 28px;
      }

      .starCardTop{
        display:grid;
        grid-template-columns: 1fr;
        align-items: start;
        gap: 10px;
      }

      .starIdentity{
        align-items: flex-start;
      }

      .fundPremiumTile .starIdentity{
        align-items:center;
      }

      .fundPremiumTile .starIconWrap{
        width: 70px;
        height: 44px;
        padding: 4px;
      }

      .fundPremiumTile .starIcon{
        width: 62px;
        height: 34px;
      }

      .starNameBox{
        gap: 3px;
      }

      .starCardLatest{
        justify-self: start;
        text-align: left;
      }
    }

    @supports (-webkit-touch-callout: none) {
      .chartCard.isFS .chartWrap{ height: 100vh; }
    }
  `;
}
