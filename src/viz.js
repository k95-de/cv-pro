/* ============================================================================
   THE FLOW — job instrument panels
   One per job: a technical title, an animated schematic, and a live strip
   chart (grid, trace, ticking readout with units) — the look of real
   simulation post-processing, so a non-mechanical audience instantly sees
   WHAT was modelled and WHAT signal came out of it.
   ========================================================================== */
(function () {
"use strict";
const TAU = Math.PI * 2;

const INK   = "#5FE3FF";
const INK2  = "#3B82F6";
const DIM   = "rgba(147,180,255,0.34)";
const FAINT = "rgba(147,180,255,0.12)";
const HOT   = "#FF6B6B";
const TXT   = "rgba(234,242,255,0.92)";
const TXT2  = "rgba(147,180,255,0.75)";
const EASE  = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

function S(ctx, color, w, glow) {
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(95,227,255,0.5)";
  ctx.shadowBlur = glow || 0;
}
function partial(ctx, pts, k, close) {
  const n = pts.length; if (n < 2 || k <= 0) return;
  const total = close ? n : n - 1;
  const upto = Math.max(1, Math.floor(total * Math.min(1, k)));
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= upto && i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close && k >= 1) ctx.closePath();
  ctx.stroke();
}
function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

/* panel title, top-left — plain English tool language, what engineers call it */
function title(ctx, W, H, text, b) {
  if (b <= 0.15) return;
  ctx.save(); ctx.globalAlpha *= EASE((b - 0.15) / 0.5);
  ctx.shadowBlur = 0;
  ctx.fillStyle = TXT2;
  ctx.font = "600 11px Sora, sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  const n = Math.max(1, Math.floor(text.length * EASE((b - 0.15) / 0.6)));
  ctx.fillText(text.slice(0, n).toUpperCase(), W * 0.045, H * 0.035);
  S(ctx, DIM, 1, 0);
  ctx.beginPath(); ctx.moveTo(W * 0.045, H * 0.035 + 17);
  ctx.lineTo(W * 0.045 + ctx.measureText(text.toUpperCase()).width, H * 0.035 + 17); ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------ strip chart
   cfg = { label, unit, lo, hi, fn(u,t)->0..1, decimals, measure }
   fn's u is the window position (0 = oldest, 1 = now). measure=true overlays
   sparse "test data" dots on the trace — the validation story. */
function chart(ctx, W, H, t, b, cfg) {
  const cb = EASE((b - 0.45) / 0.55); if (cb <= 0) return;
  const x = W * 0.045, y = H * 0.70, w = W * 0.91, h = H * 0.245;
  ctx.save(); ctx.globalAlpha *= cb; ctx.shadowBlur = 0;

  // frame + grid
  S(ctx, DIM, 1, 0); ctx.strokeRect(x, y, w, h);
  S(ctx, FAINT, 1, 0);
  for (let i = 1; i < 4; i++) { const gx = x + (w / 4) * i;
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let i = 1; i < 3; i++) { const gy = y + (h / 3) * i;
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }

  // trace (draws with cb, then scrolls with t)
  const reveal = Math.min(1, cb * 1.4);
  S(ctx, INK, 1.7, 7);
  ctx.beginPath();
  const N = 90;
  for (let i = 0; i <= N * reveal; i++) {
    const u = i / N;
    const v = Math.max(0, Math.min(1, cfg.fn(u, t)));
    const px = x + u * w, py = y + h - v * h * 0.86 - h * 0.07;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();

  // validation dots from "measurements"
  if (cfg.measure && reveal >= 1) {
    for (let i = 1; i <= 6; i++) {
      const u = i / 7;
      const v = Math.max(0, Math.min(1, cfg.fn(u, t) + Math.sin(i * 37.7) * 0.035));
      dot(ctx, x + u * w, y + h - v * h * 0.86 - h * 0.07, 2.6, "rgba(234,242,255,0.9)");
    }
  }

  // live head + readout
  const vNow = Math.max(0, Math.min(1, cfg.fn(1, t)));
  const hx = x + w, hy = y + h - vNow * h * 0.86 - h * 0.07;
  if (reveal >= 1) { dot(ctx, hx - 1, hy, 3, INK); }
  ctx.fillStyle = TXT; ctx.font = "600 13px Sora, sans-serif";
  ctx.textAlign = "right"; ctx.textBaseline = "bottom";
  const val = cfg.lo + (cfg.hi - cfg.lo) * vNow;
  ctx.fillText(val.toFixed(cfg.decimals == null ? 0 : cfg.decimals) + " " + cfg.unit, x + w - 4, y - 3);
  ctx.fillStyle = TXT2; ctx.font = "500 10px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(cfg.label, x + 1, y - 4);
  ctx.restore();
}

/* schematic region: draw into the middle band, uniformly scaled */
function schemZone(ctx, W, H, fn, t, b) {
  ctx.save();
  const s = 0.60;
  ctx.translate(W * (1 - s) / 2, H * 0.075);
  ctx.scale(s, s);
  fn(ctx, W, H, t, b);
  ctx.restore();
}

/* ------------------------------------------------ schematics (from v0.6) */
function schemAero(ctx, W, H, t, b) {
  const cx = W * 0.5, cy = H * 0.58, L = W * 0.6;
  const car = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40, x = cx - L / 2 + u * L;
    car.push([x, cy - Math.sin(Math.pow(u, 0.72) * Math.PI) * H * 0.2]);
  }
  car.push([cx + L / 2, cy], [cx - L / 2, cy]);
  S(ctx, INK, 2.6, 12); partial(ctx, car, EASE(b), true);
  if (b > 0.6) { S(ctx, INK2, 2, 6);
    const wb = EASE((b - 0.6) / 0.4);
    [[cx - L * 0.28, cy], [cx + L * 0.3, cy]].forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, H * 0.055 * wb, 0, TAU); ctx.stroke(); }); }
  for (let s = 0; s < 5; s++) {
    const y0 = cy - H * 0.4 + s * H * 0.12;
    S(ctx, s % 2 ? DIM : INK2, 1.6, s % 2 ? 0 : 5);
    ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 70 - s * 8;
    ctx.beginPath();
    for (let x = W * 0.02; x <= W * 0.98; x += 8) {
      const dx = (x - cx) / L, lift = Math.exp(-dx * dx * 6) * (cy - y0 > 0 ? 1 : -0.4);
      const y = y0 - lift * H * 0.05;
      x <= W * 0.02 + 1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
}
function schemMold(ctx, W, H, t, b) {
  const x = W * 0.22, y = H * 0.12, w = W * 0.56, h = H * 0.74;
  const e = EASE(b);
  S(ctx, INK, 2.4, 10);
  partial(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], e, true);
  if (b > 0.4) { S(ctx, DIM, 1.4, 0); ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(x - W * 0.07, y + h / 2); ctx.lineTo(x + w + W * 0.07, y + h / 2); ctx.stroke();
    ctx.setLineDash([]); }
  const cw = w * 0.5, ch = h * 0.46, cx0 = x + (w - cw) / 2, cy0 = y + (h - ch) / 2;
  S(ctx, INK2, 2, 6);
  partial(ctx, [[cx0, cy0], [cx0 + cw, cy0], [cx0 + cw, cy0 + ch], [cx0, cy0 + ch]], EASE((b - 0.3) / 0.7), true);
  if (b > 0.55) { S(ctx, INK2, 2, 6);
    ctx.beginPath(); ctx.moveTo(x + w / 2, y - H * 0.08); ctx.lineTo(x + w / 2, cy0); ctx.stroke(); }
  if (b > 0.7) {
    const fill = (Math.sin(t * 0.9) * 0.5 + 0.5);
    ctx.save(); ctx.globalAlpha *= 0.5;
    const gy = cy0 + ch * (1 - fill);
    const grad = ctx.createLinearGradient(0, gy, 0, cy0 + ch);
    grad.addColorStop(0, "rgba(95,227,255,0.9)"); grad.addColorStop(1, "rgba(29,78,216,0.5)");
    ctx.fillStyle = grad; ctx.fillRect(cx0 + 2, gy, cw - 4, ch * fill - 2);
    ctx.restore();
    for (let k = 0; k < 3; k++) {
      const dy = ((t * 60 + k * 30) % (cy0 - (y - H * 0.08)));
      dot(ctx, x + w / 2, y - H * 0.08 + dy, 3, INK);
    }
  }
}
function schemBattery(ctx, W, H, t, b) {
  const mx = W * 0.12, my = H * 0.14, mw = W * 0.76, mh = H * 0.5;
  S(ctx, INK, 2.4, 10);
  partial(ctx, [[mx, my], [mx + mw, my], [mx + mw, my + mh], [mx, my + mh]], EASE(b), true);
  const cols = 8, rows = 3, gw = mw / cols, gh = mh / rows;
  const on = Math.floor(EASE((b - 0.25) / 0.75) * cols * rows);
  S(ctx, INK2, 1.6, 4);
  for (let i = 0; i < cols * rows && i < on; i++) {
    const cxx = mx + (i % cols) * gw, cyy = my + Math.floor(i / cols) * gh;
    const sweep = 0.5 + 0.5 * Math.sin(t * 2.2 - (i % cols) * 0.55);
    ctx.globalAlpha *= (0.35 + sweep * 0.65);
    ctx.strokeRect(cxx + 5, cyy + 5, gw - 10, gh - 10);
    ctx.globalAlpha /= (0.35 + sweep * 0.65);
  }
  if (b > 0.7) {
    const bx = W * 0.4, by = H * 0.78;
    S(ctx, INK, 2, 8); ctx.strokeRect(bx, by, W * 0.2, H * 0.16);
    S(ctx, DIM, 1.4, 0);
    ctx.beginPath(); ctx.moveTo(mx + mw * 0.5, my + mh); ctx.lineTo(bx + W * 0.1, by); ctx.stroke();
    const k = (t * 0.8) % 1;
    dot(ctx, mx + mw * 0.5 + (bx + W * 0.1 - mx - mw * 0.5) * k, my + mh + (by - my - mh) * k, 3.4, INK);
  }
}
function schemStress(ctx, W, H, t, b) {
  const cx = W * 0.5, cy = H * 0.5;
  const hull = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU;
    const r = (W * 0.33) * (1 + 0.34 * Math.cos(a) - 0.16 * Math.cos(2 * a));
    hull.push([cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.45]);
  }
  S(ctx, INK, 2.6, 12); partial(ctx, hull, EASE(b), true);
  if (b > 0.35) for (let c = 1; c <= 3; c++) {
    const breathe = 1 + 0.05 * Math.sin(t * 2 + c);
    S(ctx, c === 1 ? INK2 : DIM, 1.5, c === 1 ? 5 : 0);
    ctx.globalAlpha *= EASE((b - 0.35) / 0.65) * (1.05 - c * 0.25);
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      const r = (W * 0.33) * (1 + 0.34 * Math.cos(a) - 0.16 * Math.cos(2 * a)) * (1 - c * 0.22) * breathe;
      const X = cx + Math.cos(a) * r * 0.9, Y = cy + Math.sin(a) * r * 0.45;
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.globalAlpha /= EASE((b - 0.35) / 0.65) * (1.05 - c * 0.25);
  }
  if (b > 0.6) [[-1, W * 0.09], [1, W * 0.91]].forEach(([sgn, x]) => {
    const wob = Math.sin(t * 2) * 0.25;
    S(ctx, INK, 2.2, 8);
    ctx.beginPath(); ctx.arc(x, cy, H * 0.2, (-0.4 + wob) * sgn, (1.1 + wob) * sgn, sgn < 0); ctx.stroke();
    const ea = (1.1 + wob) * sgn;
    dot(ctx, x + Math.cos(ea) * H * 0.2, cy + Math.sin(ea) * H * 0.2, 4, INK);
  });
}
function schemEmotor(ctx, W, H, t, b) {
  const cx = W * 0.5, cy = H * 0.5, R = H * 0.4;
  S(ctx, INK, 2.6, 12);
  ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * EASE(b)); ctx.stroke();
  if (b > 0.35) { S(ctx, DIM, 1.4, 0);
    const n = Math.floor(EASE((b - 0.35) / 0.65) * 12);
    for (let i = 0; i < n; i++) { const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86);
      ctx.lineTo(cx + Math.cos(a) * R * 0.99, cy + Math.sin(a) * R * 0.99); ctx.stroke(); } }
  if (b > 0.5) {
    const rot = t * 1.6;
    S(ctx, INK2, 2, 6);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, TAU); ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = rot + (i / 6) * TAU;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.14, cy + Math.sin(a) * R * 0.14);
      ctx.lineTo(cx + Math.cos(a) * R * 0.52, cy + Math.sin(a) * R * 0.52); ctx.stroke(); }
    dot(ctx, cx, cy, 3.4, INK);
  }
  if (b > 0.7) for (let k = 0; k < 5; k++) {
    const u = ((t * 0.7 + k * 0.2) % 1);
    const a = -Math.PI / 2 + (k - 2) * 0.18;
    dot(ctx, cx + Math.cos(a) * R * (1.16 - 0.45 * u),
             cy + Math.sin(a) * R * (1.16 - 0.45 * u) + u * u * H * 0.06, 2.6, INK);
  }
}
function schemFlux(ctx, W, H, t, b) {
  const cx = W * 0.5, cy = H * 0.5, R = H * 0.38;
  S(ctx, INK, 2.4, 10);
  ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * EASE(b)); ctx.stroke();
  if (b > 0.3) { S(ctx, INK2, 2, 5);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + Math.PI / 4;
      ctx.save(); ctx.translate(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62);
      ctx.rotate(a + Math.PI / 2);
      ctx.strokeRect(-R * 0.18, -R * 0.07, R * 0.36, R * 0.14); ctx.restore(); } }
  if (b > 0.45) for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const mx = cx + Math.cos(a) * R * 0.62, my = cy + Math.sin(a) * R * 0.62;
    for (let l = 0; l < 3; l++) {
      const ph = ((t * 0.5 + l / 3) % 1);
      S(ctx, INK2, 1.4, 4);
      const ga = (1 - ph) * 0.8 * EASE((b - 0.45) / 0.55);
      ctx.globalAlpha *= ga;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.ellipse(0, 0, R * (0.22 + ph * 0.3), R * (0.10 + ph * 0.22), 0, 0, TAU);
      ctx.stroke(); ctx.restore();
      ctx.globalAlpha /= Math.max(1e-4, ga);
    }
  }
  if (b > 0.75) {
    const blink = 0.5 + 0.5 * Math.sin(t * 5);
    const a = Math.PI / 4;
    ctx.save(); ctx.globalAlpha *= blink;
    S(ctx, HOT, 2, 10);
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62, R * 0.13, 0, TAU);
    ctx.stroke(); ctx.restore();
  }
}
function schemNetwork(ctx, W, H, t, b) {
  const px = W * 0.5, py = H * 0.52, e = EASE(b);
  S(ctx, INK, 2.4, 12);
  ctx.beginPath(); ctx.arc(px, py, H * 0.09, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, e * 2)); ctx.stroke();
  if (e > 0.3) { ctx.save(); ctx.translate(px, py); ctx.rotate(t * 2.4);
    S(ctx, INK, 1.8, 6);
    ctx.beginPath(); ctx.moveTo(0, -H * 0.055); ctx.lineTo(H * 0.046, H * 0.036); ctx.lineTo(-H * 0.046, H * 0.036);
    ctx.closePath(); ctx.stroke(); ctx.restore(); }
  const loops = [
    { x: W * 0.10, y: H * 0.08, w: W * 0.3, h: H * 0.26 },
    { x: W * 0.62, y: H * 0.06, w: W * 0.28, h: H * 0.28 },
    { x: W * 0.08, y: H * 0.68, w: W * 0.28, h: H * 0.24 },
    { x: W * 0.64, y: H * 0.68, w: W * 0.26, h: H * 0.24 }
  ];
  loops.forEach((L, i) => {
    const lb = EASE((b - 0.15 - i * 0.12) / 0.5); if (lb <= 0) return;
    S(ctx, INK2, 2, 5);
    partial(ctx, [[L.x, L.y], [L.x + L.w, L.y], [L.x + L.w, L.y + L.h], [L.x, L.y + L.h]], lb, true);
    S(ctx, DIM, 1.4, 0);
    const mx0 = L.x + L.w / 2, my0 = L.y + (i < 2 ? L.h : 0);
    ctx.beginPath(); ctx.moveTo(mx0, my0); ctx.lineTo(px, py); ctx.stroke();
    if (lb >= 1) {
      const per = 2 * (L.w + L.h);
      let d = ((t * (0.35 + i * 0.08)) % 1) * per, X, Y;
      if (d < L.w) { X = L.x + d; Y = L.y; }
      else if (d < L.w + L.h) { X = L.x + L.w; Y = L.y + (d - L.w); }
      else if (d < 2 * L.w + L.h) { X = L.x + L.w - (d - L.w - L.h); Y = L.y + L.h; }
      else { X = L.x; Y = L.y + L.h - (d - 2 * L.w - L.h); }
      dot(ctx, X, Y, 3.4, INK);
    }
    if (i === 0 && lb >= 1) { S(ctx, DIM, 1.2, 0);
      for (let f = 0; f < 5; f++) { const fx = L.x + L.w * 0.2 + f * L.w * 0.14;
        ctx.beginPath(); ctx.moveTo(fx, L.y - 6); ctx.lineTo(fx, L.y + 6); ctx.stroke(); } }
  });
}
function schemVenture(ctx, W, H, t, b) {
  const e = EASE(b), bx = W * 0.28, by = H * 0.9;
  S(ctx, INK, 2.4, 10);
  partial(ctx, [[bx, by], [bx, H * 0.08], [bx + W * 0.38, H * 0.08], [bx + W * 0.38, H * 0.28],
                [bx + W * 0.13, H * 0.28], [bx + W * 0.13, by]], e, false);
  if (b > 0.5) {
    const cyc = Math.pow(Math.max(0, Math.sin(t * 2.4)), 6);
    const ry = H * 0.3 + cyc * H * 0.3;
    S(ctx, INK2, 2.2, 8);
    ctx.strokeRect(bx + W * 0.17, ry, W * 0.14, H * 0.12);
    S(ctx, INK, 2, 6);
    ctx.beginPath(); ctx.moveTo(W * 0.02, H * 0.76); ctx.lineTo(W * 0.98, H * 0.76); ctx.stroke();
    const step = W * 0.1, off = (t * W * 0.06) % step;
    S(ctx, DIM, 1.4, 0);
    for (let x = W * 0.04 - off; x < W * 0.96; x += step) {
      if (x > bx + W * 0.15 && x < bx + W * 0.33) continue;
      ctx.beginPath(); ctx.arc(x, H * 0.76, 5, 0, TAU); ctx.stroke();
    }
    if (cyc > 0.85) { ctx.save(); ctx.globalAlpha *= (cyc - 0.85) / 0.15;
      S(ctx, INK, 1.8, 14);
      ctx.beginPath(); ctx.moveTo(bx + W * 0.24, H * 0.74); ctx.lineTo(bx + W * 0.24 - 11, H * 0.66);
      ctx.moveTo(bx + W * 0.24, H * 0.74); ctx.lineTo(bx + W * 0.24 + 11, H * 0.66); ctx.stroke();
      ctx.restore(); }
  }
}
function schemTraining(ctx, W, H, t, b) {
  const e = EASE(b);
  S(ctx, INK, 2.4, 10);
  partial(ctx, [[W * 0.1, H * 0.1], [W * 0.46, H * 0.1], [W * 0.37, H * 0.48], [W * 0.33, H * 0.48],
                [W * 0.33, H * 0.86], [W * 0.37, H * 0.86]], e, false);
  partial(ctx, [[W * 0.1, H * 0.1], [W * 0.19, H * 0.48], [W * 0.23, H * 0.48]], e, false);
  if (b > 0.5) for (let k = 0; k < 4; k++) {
    const u = ((t * 0.5 + k * 0.25) % 1);
    dot(ctx, W * (0.29 - 0.1 * (1 - u) * Math.sin(k * 9)), H * (0.13 + u * 0.68), 3, u > 0.8 ? INK : DIM);
  }
  if (b > 0.35) {
    const cb = EASE((b - 0.35) / 0.65);
    S(ctx, DIM, 1.4, 0);
    ctx.beginPath(); ctx.moveTo(W * 0.56, H * 0.86); ctx.lineTo(W * 0.94, H * 0.86); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * 0.56, H * 0.86); ctx.lineTo(W * 0.56, H * 0.12); ctx.stroke();
    S(ctx, INK2, 2, 5);
    for (let i = 0; i < 4; i++) {
      const bh = H * (0.1 + i * 0.15) * cb * (1 + 0.03 * Math.sin(t * 2 + i));
      ctx.strokeRect(W * (0.6 + i * 0.085), H * 0.86 - bh, W * 0.055, bh);
    }
    if (cb >= 1) { S(ctx, INK, 2.2, 8);
      ctx.beginPath(); ctx.moveTo(W * 0.59, H * 0.7); ctx.lineTo(W * 0.9, H * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W * 0.9, H * 0.2); ctx.lineTo(W * 0.82, H * 0.21);
      ctx.moveTo(W * 0.9, H * 0.2); ctx.lineTo(W * 0.89, H * 0.3); ctx.stroke(); }
  }
}

/* ------------------------------------------------ full panels */
const PANEL = {
  aero: {
    title: "Wind tunnel — body design & CFD streamlines",
    schem: schemAero,
    chart: { label: "air speed over the body", unit: "m/s", lo: 0, hi: 32, decimals: 0,
      fn: (u, t) => 0.45 + 0.3 * Math.sin(u * 5 - t * 1.8) * Math.exp(-Math.pow(u - 0.55, 2) * 4) + 0.15 * u }
  },
  mold: {
    title: "Injection moulding — cavity fill simulation",
    schem: schemMold,
    chart: { label: "cavity pressure during one shot", unit: "bar", lo: 0, hi: 850, decimals: 0,
      fn: (u, t) => { const c = ((u * 2 + t * 0.28) % 1); return c < 0.55 ? Math.pow(c / 0.55, 2) : Math.max(0, 1 - (c - 0.55) * 3); } }
  },
  battery: {
    title: "Battery development — BMS & V-cycle KPIs",
    schem: schemBattery,
    chart: { label: "pack state of charge", unit: "%", lo: 0, hi: 100, decimals: 0,
      fn: (u, t) => 0.18 + 0.72 * Math.min(1, Math.max(0, ((u + t * 0.05) % 1.15))) }
  },
  stress: {
    title: "FEA — monocoque torsional stiffness",
    schem: schemStress,
    chart: { label: "torque vs. chassis twist", unit: "Nm", lo: 0, hi: 2400, decimals: 0,
      fn: (u, t) => 0.5 + 0.42 * Math.sin(u * TAU - t * 1.2) * (0.6 + 0.4 * u) }
  },
  emotor: {
    title: "GT-SUITE — 1D thermal model, e-motor + oil circuit",
    measure: true,
    schem: schemEmotor,
    chart: { label: "winding temperature — sim line, test dots", unit: "°C", lo: 20, hi: 160, decimals: 0, measure: true,
      fn: (u) => 1 - Math.exp(-u * 3.2) * 0.92 - 0.06 }
  },
  flux: {
    title: "ANSYS Maxwell — electromagnetic losses & hotspots",
    schem: schemFlux,
    chart: { label: "iron + magnet losses", unit: "kW", lo: 0, hi: 6, decimals: 1,
      fn: (u, t) => 0.3 + 0.25 * Math.sin(u * 9 - t * 2.5) + 0.3 * u + (u > 0.8 ? 0.12 * Math.sin(t * 5) : 0) }
  },
  network: {
    title: "Vehicle cooling network — 4 interconnected circuits",
    schem: schemNetwork,
    chart: { label: "coolant Δ-temperature across circuit — sim vs. test", unit: "K", lo: 0, hi: 18, decimals: 1, measure: true,
      fn: (u, t) => 0.55 + 0.2 * Math.sin(u * 4 - t * 0.9) - 0.15 * Math.cos(u * 11) * (1 - u) }
  },
  venture: {
    title: "AKM — press tooling, sales & operations",
    schem: schemVenture,
    chart: { label: "quotations sent per month", unit: "", lo: 0, hi: 24, decimals: 0,
      fn: (u, t) => 0.15 + 0.6 * u + 0.08 * Math.sin(u * 9 + t) }
  },
  training: {
    title: "Tech sales — pipeline & close rate",
    schem: schemTraining,
    chart: { label: "opportunity conversion", unit: "%", lo: 0, hi: 45, decimals: 0,
      fn: (u, t) => 0.2 + 0.55 * u + 0.05 * Math.sin(u * 8 + t) }
  }
};

/* BVS keeps its own full-canvas treatment — the node coming online */
function drawBvs(ctx, W, H, t, b) {
  const cx = W * 0.5, cy = H * 0.52, e = EASE(b);
  title(ctx, W, H, "Next node — technical sales consultant", b);
  for (let r = 0; r < 3; r++) {
    const ph = ((t * 0.4 + r / 3) % 1);
    S(ctx, INK2, 1.2, 4);
    ctx.globalAlpha *= (1 - ph) * 0.7 * e;
    ctx.beginPath(); ctx.arc(cx, cy, H * 0.1 + ph * H * 0.34, 0, TAU); ctx.stroke();
    ctx.globalAlpha /= Math.max(1e-4, (1 - ph) * 0.7 * e);
  }
  const N = 7;
  for (let i = 0; i < N; i++) {
    const nb = EASE((b - 0.2 - i * 0.08) / 0.4); if (nb <= 0) continue;
    const a = (i / N) * TAU + 0.5, R = H * 0.34;
    const x = cx + Math.cos(a) * R * 1.15, y = cy + Math.sin(a) * R * 0.8;
    S(ctx, DIM, 1.1, 0);
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (x - cx) * nb, cy + (y - cy) * nb); ctx.stroke();
    if (nb >= 1) { const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 2);
      dot(ctx, x, y, 2.5 + tw * 1.5, INK); }
  }
  const pul = 0.5 + 0.5 * Math.sin(t * 2.2);
  S(ctx, INK, 2, 14);
  ctx.setLineDash([7, 7]); ctx.lineDashOffset = -t * 14;
  ctx.beginPath(); ctx.arc(cx, cy, H * 0.1 * (1 + pul * 0.06), 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  if (b > 0.6) {
    ctx.save(); ctx.globalAlpha *= EASE((b - 0.6) / 0.4);
    ctx.fillStyle = INK; ctx.font = "600 " + Math.round(H * 0.085) + "px Sora, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(95,227,255,.6)"; ctx.shadowBlur = 14;
    ctx.fillText("2027", cx, cy + 1);
    ctx.restore();
  }
}

window.VIZ = {
  has(mode) { return mode === "bvs" || !!PANEL[mode]; },
  draw(mode, canvas, t, alpha, build) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    const b = Math.max(0, Math.min(1, build));
    if (mode === "bvs") { drawBvs(ctx, W, H, t, b); ctx.restore(); return; }
    const p = PANEL[mode]; if (!p) { ctx.restore(); return; }
    title(ctx, W, H, p.title, b);
    schemZone(ctx, W, H, p.schem, t, b);
    chart(ctx, W, H, t, b, p.chart);
    ctx.restore();
  }
};
})();
