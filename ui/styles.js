/**
 * 首页样式
 *
 * 这次的 CNN 仪表盘结构是：
 * - 左侧半圆仪表盘
 * - 下方中文分段刻度（恐惧 / 中性 / 贪婪）
 * - 右侧四个关键数值卡片
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

    .title .h{
      margin:0;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .6px;
      white-space:nowrap;
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
      margin-left: 10px;
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
    }

    .seg button.active{
      color: rgba(255,255,255,.96);
      background: rgba(0,174,239,.18);
      box-shadow: inset 0 0 0 1px rgba(0,174,239,.25);
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
      grid-template-columns: minmax(0, 240px) minmax(0, 1fr);
      gap: 14px;
      align-items: center;
    }

    .fgGaugeWrap{
      min-width:0;
      width: 100%;
      display:grid;
      gap: 8px;
      justify-items:center;
    }

    .fgGaugeBox{
      position: relative;
      width: min(100%, 220px);
      margin: 0 auto;
      padding-top: 2px;
    }

    .fgGaugeSvg{
      width: 100%;
      height: auto;
      display: block;
      overflow: visible;
    }

    .fgTrack{
      fill: none;
      stroke: rgba(255,255,255,.08);
      stroke-width: 14;
      stroke-linecap: round;
    }

    .fgZone{
      fill: none;
      stroke-width: 9;
      stroke-linecap: round;
      opacity: .36;
    }

    .fgZone1{ stroke: #ff5a76; }
    .fgZone2{ stroke: #fb923c; }
    .fgZone3{ stroke: #fbbf24; }
    .fgZone4{ stroke: #22c55e; }
    .fgZone5{ stroke: #14b8a6; }

    .fgValueArc{
      fill: none;
      stroke-width: 14;
      stroke-linecap: round;
      filter: drop-shadow(0 0 10px rgba(255,255,255,.12));
    }

    .fgNeedle{
      stroke-linecap: round;
      filter: drop-shadow(0 0 6px rgba(255,255,255,.18));
    }

    .fgAxisLabel{
      fill: rgba(138,160,198,.90);
      font-size: 11px;
      font-family: var(--mono);
    }

    .fgGaugeText{
      position: absolute;
      left: 50%;
      top: 54px;
      transform: translateX(-50%);
      text-align: center;
      display: grid;
      gap: 2px;
      pointer-events: none;
      width: 74%;
    }

    .fgGaugeScore{
      font-size: 32px;
      line-height: 1;
      font-weight: 800;
      color: rgba(240,246,255,.98);
      font-variant-numeric: tabular-nums;
    }

    .fgGaugeStatus{
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.25;
      font-weight: 700;
    }

    .fgScale{
      width: 100%;
      display:grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-top: -2px;
    }

    .fgScaleItem{
      text-align:center;
      padding: 8px 6px;
      border-radius: 10px;
      font-family: var(--mono);
      font-size: 11px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      color: rgba(230,237,247,.86);
    }

    .fgScaleItem.fear{
      color: #ff8ca0;
      background: rgba(255,90,118,.10);
      border-color: rgba(255,90,118,.18);
    }

    .fgScaleItem.neutral{
      color: #ffd46b;
      background: rgba(251,191,36,.10);
      border-color: rgba(251,191,36,.18);
    }

    .fgScaleItem.greed{
      color: #6ee7b7;
      background: rgba(34,197,94,.10);
      border-color: rgba(34,197,94,.18);
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
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(31,43,61,.85);
      display:grid;
      gap: 6px;
      align-content: center;
      justify-items:center;
      text-align:center;
    }

    .fgMetricMain{
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));
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
      color: rgba(240,246,255,.98);
      font-variant-numeric: tabular-nums;
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

      .logo{
        width: 110px;
        height: auto;
        max-height: 32px;
      }

      .title{
        flex: 1 1 auto;
        min-width: 160px;
      }

      .title .h{ font-size: 12px; }
      .title .sub{ font-size: 12px; }

      .seg{
        width: 100%;
        margin-left: 0;
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

      .card.info{ order: 1; }
      .card.chart{ order: 2; }

      .chartWrap{ height: 420px; }
      :root{ --kv-val-w: 124px; }

      .fsBtn{ display:flex; }

      .fgTitle{ font-size: 16px; }
      .fgCardInner{ grid-template-columns: 1fr; }
      .fgStats{ grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .fgGaugeText{ top: 52px; width: 72%; }
      .fgGaugeScore{ font-size: 30px; }
      .fgGaugeStatus{ font-size: 12px; }
      .fgScaleItem{ font-size: 11px; padding: 7px 4px; }
      .fgMetric{ min-height: 74px; padding: 12px 8px 10px; gap: 5px; }
      .fgMetric span{ font-size: 11px; }
      .fgMetric b{ font-size: 18px; }
    }

    @supports (-webkit-touch-callout: none) {
      .chartCard.isFS .chartWrap{ height: 100vh; }
    }
  `;
}
