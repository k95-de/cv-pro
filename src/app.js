/* ============================================================================
   THE FLOW — app (PRO edition)
   A camera riding the coolant through a pipe. Scroll = flow.
   Plain <script> (no build step). Needs: three, gsap, lenis, CV.

   PRO additions over the base engine:
     · post-processing: bloom, speed chromatic aberration, vignette, grain
     · headlight riding ahead of the camera inside the pipe
     · speed-reactive lens (FOV opens up when the flow accelerates)
     · station timeline (click to travel), keyboard navigation, prev/next
     · live HUD (station counter, current org, flow meter)
     · per-element card choreography on glass panels + tool chips
     · gate flashes when crossing a degree/training gate
     · cursor light, portrait tilt, procedural coolant soundscape (WebAudio)
   ========================================================================== */
(function () {
"use strict";

const TAU = Math.PI * 2;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = matchMedia("(max-width: 720px)").matches;
const fineCursor = matchMedia("(hover: hover) and (pointer: fine)").matches;
const POST = !reduced && !isMobile;          // post-processing: desktop only

/* palette — stays in the blue family, blended */
const COL = {
  bg:      new THREE.Color("#070A0F"),
  indigo:  new THREE.Color("#3B2E8C"),
  deep:    new THREE.Color("#152C6E"),
  blue:    new THREE.Color("#1D4ED8"),
  bright:  new THREE.Color("#3B82F6"),
  cyan:    new THREE.Color("#5FE3FF"),
};

/* ---------------------------------------------------------------- renderer */
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !POST, alpha: !POST, powerPreference: "high-performance" });
renderer.setClearColor(0x000000, 0);
const PR = Math.min(devicePixelRatio, POST ? 1.5 : 1.5);
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight);
if (POST) document.body.classList.add("post");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 500);
const BASE_FOV = 64;

/* ---------------------------------------------------------------- the path */
const ctrl = [];
const TURNS = 5.2, LEN = 520, DROP = 40;
for (let i = 0; i <= 22; i++) {
  const u = i / 22;
  const wob = Math.sin(u * 7.0) * 0.5 + Math.sin(u * 2.3) * 1.0;
  ctrl.push(new THREE.Vector3(
    Math.sin(u * Math.PI * TURNS) * (5.5 + wob),
    Math.cos(u * Math.PI * (TURNS * 0.7)) * 3.2 - u * DROP,
    -u * LEN
  ));
}
const curve = new THREE.CatmullRomCurve3(ctrl, false, "catmullrom", 0.5);

const N = 700;
const P = new Array(N + 1), T = new Array(N + 1);
for (let i = 0; i <= N; i++) { P[i] = curve.getPointAt(i / N); T[i] = curve.getTangentAt(i / N); }
const frames = curve.computeFrenetFrames(N, false);

function sampleAt(p, outPos, outTan) {
  p = Math.min(0.99999, Math.max(0, p));
  const f = p * N, i = Math.floor(f), k = f - i, j = Math.min(N, i + 1);
  outPos.copy(P[i]).lerp(P[j], k);
  if (outTan) outTan.copy(T[i]).lerp(T[j], k).normalize();
}
const _n = new THREE.Vector3(), _b = new THREE.Vector3();
function frameAt(p, outN, outB) {
  const f = p * N, i = Math.floor(f), k = f - i, j = Math.min(N, i + 1);
  outN.copy(frames.normals[i]).lerp(frames.normals[j], k).normalize();
  outB.copy(frames.binormals[i]).lerp(frames.binormals[j], k).normalize();
}

/* ---------------------------------------------------------------- gates */
const GATE_RGB = {
  start: [1.00, 0.28, 0.28],
  done:  [0.16, 0.85, 0.50],
  train: [0.62, 0.42, 1.00]
};
const GATE_CSS = { start: "#FF6B6B", done: "#3ECF8E", train: "#9E6BFF" };
function buildGateUniforms() {
  const list = CV.stations.filter(s => s.gate).slice(0, 5).map(s => {
    const c = GATE_RGB[s.gate] || GATE_RGB.start;
    return new THREE.Vector4(c[0], c[1], c[2], s.t);
  });
  while (list.length < 5) list.push(new THREE.Vector4(0, 0, 0, -9.0));
  return list;
}
const GATE_LIST = CV.stations.filter(s => s.gate).map(s => ({ t: s.t, s: s.s, kind: s.gate, crossed: false }));

/* ---------------------------------------------------------------- pipe wall */
const wallMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    uFlow: { value: 0 }, uSpeed: { value: 0 }, uHead: { value: 0 },
    cDeep: { value: COL.deep }, cIndigo: { value: COL.indigo },
    cBlue: { value: COL.blue }, cBright: { value: COL.bright }, cCyan: { value: COL.cyan },
    cBg: { value: COL.bg },
    uFadeNear: { value: 10.0 }, uFadeFar: { value: 150.0 },
    uDim: { value: isMobile ? 0.72 : 1.0 },
    uGates: { value: buildGateUniforms() }
  },
  vertexShader: `
    varying vec2 vUv; varying float vDist; varying vec3 vN; varying vec3 vView;
    void main(){
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      vView = normalize(-mv.xyz);
      vN = normalize(normalMatrix * normal);
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv; varying float vDist; varying vec3 vN; varying vec3 vView;
    uniform float uFlow, uSpeed, uFadeNear, uFadeFar, uDim, uHead;
    uniform vec3 cDeep, cIndigo, cBlue, cBright, cCyan, cBg;
    uniform vec4 uGates[5];
    float band(float x, float w){ float d = abs(fract(x) - 0.5); return smoothstep(w, 0.0, d - (0.5 - w)); }
    void main(){
      float along = vUv.y * 150.0 - uFlow * 6.0;
      float weld  = band(along, 0.020);
      float gauge = band(vUv.y * 30.0 - uFlow * 1.2, 0.028);
      float seam  = smoothstep(0.012, 0.0, min(vUv.x, 1.0 - vUv.x));
      float ribs  = band(vUv.x * 24.0, 0.06) * 0.06;

      float tone = 0.5 + 0.5 * sin(vUv.y * 2.4 + vUv.x * 6.28);
      vec3 base = mix(cDeep, cIndigo, tone) * 0.05;

      float rim = pow(1.0 - abs(dot(vView, vN)), 4.0);
      vec3 lines = cBright * (weld * 0.32 + seam * 0.16 + ribs)
                 + cCyan   * (gauge * 0.28)
                 + cBlue   * (rim   * 0.10);

      vec3 col = base + lines + cCyan * uSpeed * weld * 1.2;

      // headlight: a soft pool of light riding just ahead of the camera
      float hd = vUv.x - uHead;
      float head = exp(-abs(hd - 0.010) * 110.0) * step(0.0, hd + 0.004);
      col += (cBright * 0.10 + cCyan * 0.06) * head * (1.0 + uSpeed * 2.0);
      col += cBright * weld * head * 0.6;

      // gate zones (vUv.x runs ALONG the tube)
      for (int gi = 0; gi < 5; gi++) {
        float gd = abs(vUv.x - uGates[gi].w);
        float inf = 1.0 - smoothstep(0.02, 0.052, gd);
        vec3 gc = uGates[gi].xyz;
        float lum = dot(col, vec3(0.35, 0.45, 0.20));
        vec3 gated = gc * (lum * 2.2 + 0.02) + gc * (weld * 0.5 + gauge * 0.35);
        col = mix(col, gated, inf);
      }

      float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, vDist);
      col = mix(cBg, col, fade);
      col *= smoothstep(2.0, 7.0, vDist);
      gl_FragColor = vec4(col * uDim, 1.0);
    }`
});
const wall = new THREE.Mesh(new THREE.TubeGeometry(curve, 460, 3.4, 22, false), wallMat);
scene.add(wall);

/* ---------------------------------------------------------------- coolant sleeve */
const coolMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, depthWrite: false,
  blending: THREE.NormalBlending,
  uniforms: {
    uFlow: { value: 0 }, uSpeed: { value: 0 }, uHead: { value: 0 },
    cBlue: { value: COL.blue }, cCyan: { value: COL.cyan },
    uFadeNear: { value: 5.0 }, uFadeFar: { value: 70.0 },
    uDim: { value: isMobile ? 0.45 : 1.0 },
    uGates: { value: buildGateUniforms() }
  },
  vertexShader: `
    varying vec2 vUv; varying float vDist;
    void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0);
      vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv; varying float vDist;
    uniform float uFlow, uSpeed, uFadeNear, uFadeFar, uDim, uHead;
    uniform vec3 cBlue, cCyan;
    uniform vec4 uGates[5];
    void main(){
      float y = vUv.y * 40.0 - uFlow * 5.0;
      float c1 = sin(y + sin(vUv.x * 12.0 + uFlow) * 1.5);
      float c2 = sin(y * 0.5 - vUv.x * 8.0 + uFlow * 0.6);
      float caustic = smoothstep(0.72, 1.0, c1 * 0.6 + c2 * 0.5 + 0.4);
      float veil = 0.03 + 0.05 * (0.5 + 0.5 * sin(y * 0.2));
      vec3 col = mix(cBlue, cCyan, caustic) * (0.5 + caustic * 0.5 + uSpeed * 1.0);
      float head = exp(-abs(vUv.x - uHead - 0.010) * 110.0);
      col += cCyan * head * 0.18;
      for (int gi = 0; gi < 5; gi++) {
        float inf = 1.0 - smoothstep(0.02, 0.05, abs(vUv.x - uGates[gi].w));
        float lum = dot(col, vec3(0.35, 0.45, 0.20));
        col = mix(col, uGates[gi].xyz * (lum * 1.6 + 0.25), inf);
      }
      float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, vDist);
      float a = (veil + caustic * 0.22 + head * 0.06) * fade * smoothstep(2.0, 6.0, vDist);
      gl_FragColor = vec4(col, a * uDim);
    }`
});
scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 280, 2.55, 14, false), coolMat));

/* ---------------------------------------------------------------- particles */
const COUNT = reduced ? 400 : (isMobile ? 1100 : 2600);
const pGeo = new THREE.BufferGeometry();
const pos = new Float32Array(COUNT * 3);
const seedA = new Float32Array(COUNT);
const seedR = new Float32Array(COUNT * 2);
const aShade = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  seedA[i] = Math.random();
  seedR[i * 2] = Math.pow(Math.random(), 0.7) * 2.15;
  seedR[i * 2 + 1] = Math.random() * TAU;
  aShade[i] = Math.random();
}
pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
pGeo.setAttribute("aShade", new THREE.BufferAttribute(aShade, 1));

function discTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, "rgba(255,255,255,1)");
  rg.addColorStop(0.35, "rgba(200,224,255,0.8)");
  rg.addColorStop(1, "rgba(120,170,255,0)");
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uMap: { value: discTexture() }, uSize: { value: isMobile ? 18 : 26 },
              uSpeed: { value: 0 }, cBlue: { value: COL.bright }, cCyan: { value: COL.cyan } },
  vertexShader: `
    attribute float aShade; varying float vShade; varying float vFade;
    uniform float uSize, uSpeed;
    void main(){
      vShade = aShade;
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      float d = -mv.z;
      vFade = smoothstep(1.0, 4.0, d) * (1.0 - smoothstep(30.0, 110.0, d));
      gl_PointSize = clamp((uSize * (1.0 + uSpeed*4.0)) / max(0.4, d), 1.0, 34.0);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    precision highp float;
    uniform sampler2D uMap; uniform vec3 cBlue, cCyan;
    varying float vShade; varying float vFade;
    void main(){
      float a = texture2D(uMap, gl_PointCoord).a;
      vec3 col = mix(cBlue, cCyan, vShade);
      gl_FragColor = vec4(col, a * vFade * 0.5);
    }`
});
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
scene.add(points);

const _pp = new THREE.Vector3();
function updateParticles(dt, speed) {
  const adv = (isMobile ? 0.012 : 0.015) + speed * 0.9;
  for (let i = 0; i < COUNT; i++) {
    let t = seedA[i] + (performance.now() * 0.00001) + adv * (0.4 + seedR[i * 2] * 0.25);
    t = t - Math.floor(t);
    const f = t * N, idx = Math.floor(f), kk = f - idx, jd = Math.min(N, idx + 1);
    _pp.copy(P[idx]).lerp(P[jd], kk);
    _n.copy(frames.normals[idx]).lerp(frames.normals[jd], kk);
    _b.copy(frames.binormals[idx]).lerp(frames.binormals[jd], kk);
    const r = seedR[i * 2], ang = seedR[i * 2 + 1] + t * 26.0;
    pos[i * 3]     = _pp.x + (_n.x * Math.cos(ang) + _b.x * Math.sin(ang)) * r;
    pos[i * 3 + 1] = _pp.y + (_n.y * Math.cos(ang) + _b.y * Math.sin(ang)) * r;
    pos[i * 3 + 2] = _pp.z + (_n.z * Math.cos(ang) + _b.z * Math.sin(ang)) * r;
  }
  pGeo.attributes.position.needsUpdate = true;
}

/* ---------------------------------------------------------------- station markers */
const modeColor = {
  aero: COL.cyan, mold: COL.bright, battery: COL.blue, stress: COL.cyan,
  emotor: COL.bright, flux: COL.cyan, network: COL.blue, iso: COL.bright, bvs: COL.cyan,
  training: COL.bright
};
function stationColor(st) {
  return st.gate === "start" ? new THREE.Color(GATE_CSS.start)
       : st.gate === "done"  ? new THREE.Color(GATE_CSS.done)
       : st.gate === "train" ? new THREE.Color(GATE_CSS.train)
       : (modeColor[st.mode] || COL.bright);
}
const markers = [];
const flangeGeo = new THREE.TorusGeometry(3.15, 0.10, 8, 48);
const haloGeo = new THREE.RingGeometry(2.2, 3.6, 48);
CV.stations.forEach((st) => {
  const g = new THREE.Group();
  const p = new THREE.Vector3(), tan = new THREE.Vector3();
  sampleAt(st.t, p, tan);
  g.position.copy(p);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan.clone().normalize());
  const c = stationColor(st);
  st._css = "#" + c.getHexString();
  const flange = new THREE.Mesh(flangeGeo, new THREE.MeshBasicMaterial({
    color: c, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
    color: c, transparent: true, opacity: 0.0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  for (let k = 0; k < 4; k++) {
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 2.4, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const a = k * Math.PI / 2 + Math.PI / 4;
    stub.position.set(Math.cos(a) * 3.1, Math.sin(a) * 3.1, 0);
    stub.rotation.z = a;
    g.add(stub);
  }
  g.add(flange, halo);
  let fx = null;
  const sceneMode = ({ venture: "mold", training: "iso" })[st.mode] || st.mode;
  if (window.SceneFX) {
    try { fx = window.SceneFX.make(sceneMode, c); g.add(fx.group); } catch (e) { fx = null; }
  }
  scene.add(g);
  markers.push({ st, g, fx, flange, mats: [flange.material, halo.material, ...g.children.slice(0, 4).map(m => m.material)] });
});

/* ------------------------------------------------ the entrance */
const entrance = new THREE.Group();
{
  const p0 = P[0].clone(), t0 = T[0].clone().normalize();
  const q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), t0);
  const ringIn = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.09, 10, 64),
    new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false }));
  const ringIn2 = new THREE.Mesh(
    new THREE.TorusGeometry(3.75, 0.035, 8, 64),
    new THREE.MeshBasicMaterial({ color: COL.bright, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false }));
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 6.4, 64),
    new THREE.MeshBasicMaterial({ color: COL.blue, transparent: true, opacity: 0.10,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(3.58, 3.58, 30, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x0C1730, transparent: true, opacity: 0.92,
      side: THREE.FrontSide, depthWrite: true }));
  shell.geometry.rotateX(Math.PI / 2);
  shell.position.z = -15;
  const shellRim = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 3.6, 30, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: COL.blue, transparent: true, opacity: 0.08,
      side: THREE.FrontSide, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  shellRim.geometry.rotateX(Math.PI / 2);
  shellRim.position.z = -15;
  entrance.add(ringIn, ringIn2, halo, shell, shellRim);
  entrance.position.copy(p0);
  entrance.quaternion.copy(q0);
  entrance._mats = [ringIn.material, ringIn2.material, halo.material, shell.material, shellRim.material];
  entrance._base = [0.9, 0.5, 0.10, 0.92, 0.08];
}
scene.add(entrance);

const mouth = new THREE.Mesh(
  new THREE.TorusGeometry(3.2, 0.14, 10, 60),
  new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false })
);
{ const p = new THREE.Vector3(), tan = new THREE.Vector3(); sampleAt(0.988, p, tan);
  mouth.position.copy(p); mouth.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), tan.normalize()); }
scene.add(mouth);

/* exit shell: like the entrance, the pipe needs a body once we're outside it */
{
  const p1 = new THREE.Vector3(), t1 = new THREE.Vector3(); sampleAt(0.985, p1, t1);
  const q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), t1.clone().normalize());
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(3.58, 3.58, 60, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x0C1730, side: THREE.FrontSide }));
  shell.geometry.rotateX(Math.PI / 2); shell.position.z = -30;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 60, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: COL.blue, transparent: true, opacity: 0.10, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  rim.geometry.rotateX(Math.PI / 2); rim.position.z = -30;
  const exitG = new THREE.Group(); exitG.add(shell, rim); exitG.position.copy(p1); exitG.quaternion.copy(q1);
  scene.add(exitG);
}
/* the end of the line opens into space (src/space.js) */
let space = null;
{ const p = new THREE.Vector3(), tan = new THREE.Vector3(); sampleAt(0.985, p, tan);
  if (window.Space) { try { space = Space.make(p, tan); scene.add(space.group); } catch (e) { console.error('space', e); space = null; } } }
window.__space = () => ({ space, camera, THREE, renderer });

/* ---------------------------------------------------------------- post-processing
   Scene -> offscreen target -> bright pass -> 2x separable blur (quarter res)
   -> composite (bloom + speed chromatic aberration + vignette + grain + the
   background gradient behind the transparent parts of the scene). */
let post = null;
if (POST) {
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quadScene.add(quad);
  const mk = (w, h) => new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: true });
  const W = Math.floor(innerWidth * PR), H = Math.floor(innerHeight * PR);
  const sceneRT = mk(W, H);
  const brightRT = mk(W >> 2, H >> 2), blurA = mk(W >> 2, H >> 2), blurB = mk(W >> 2, H >> 2);
  brightRT.depthBuffer = blurA.depthBuffer = blurB.depthBuffer = false;
  const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, uThr: { value: 0.62 } },
    vertexShader: VS,
    fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tex; uniform float uThr;
      void main(){ vec4 c = texture2D(tex, vUv); float l = dot(c.rgb, vec3(.2126,.7152,.0722));
        float k = smoothstep(uThr, uThr + 0.35, l); gl_FragColor = vec4(c.rgb * k, 1.0); }`
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2(1 / (W >> 2), 1 / (H >> 2)) } },
    vertexShader: VS,
    fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tex; uniform vec2 uDir, uTexel;
      void main(){
        vec2 d = uDir * uTexel;
        vec3 s = texture2D(tex, vUv).rgb * 0.2270270;
        s += (texture2D(tex, vUv + d * 1.3846154).rgb + texture2D(tex, vUv - d * 1.3846154).rgb) * 0.3162162;
        s += (texture2D(tex, vUv + d * 3.2307692).rgb + texture2D(tex, vUv - d * 3.2307692).rgb) * 0.0702703;
        gl_FragColor = vec4(s, 1.0); }`
  });
  const compMat = new THREE.ShaderMaterial({
    uniforms: {
      tScene: { value: sceneRT.texture }, tBloom: { value: null },
      uStrength: { value: 0.42 }, uSpeed: { value: 0 }, uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(W, H) },
      uFlash: { value: new THREE.Vector4(0, 0, 0, 0) }
    },
    vertexShader: VS,
    fragmentShader: `precision highp float; varying vec2 vUv;
      uniform sampler2D tScene, tBloom; uniform float uStrength, uSpeed, uTime; uniform vec2 uRes; uniform vec4 uFlash;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float blob(vec2 uv, vec2 c, vec2 r){ return 1.0 - smoothstep(0.0, 1.0, length((uv - c) / r)); }
      void main(){
        vec2 uv = vUv;
        // speed chromatic aberration: channels split radially when the flow accelerates
        vec2 off = (uv - 0.5) * (0.0015 + uSpeed * 0.010);
        vec4 sc = texture2D(tScene, uv);
        float r = texture2D(tScene, uv + off).r;
        float b = texture2D(tScene, uv - off).b;
        vec3 col = vec3(r, sc.g, b);
        // the blended-blue gradient mesh sits behind whatever the scene leaves transparent
        vec2 a = vec2(uv.x * uRes.x / uRes.y, uv.y);
        vec2 ar = vec2(uRes.x / uRes.y, 1.0);
        vec3 bg = vec3(0.027, 0.039, 0.059);
        bg += vec3(0.231, 0.180, 0.549) * 0.55 * blob(uv, vec2(0.22, 0.82), vec2(0.60, 0.55) * ar / ar.x);
        bg += vec3(0.114, 0.306, 0.847) * 0.34 * blob(uv, vec2(0.82, 0.78), vec2(0.55, 0.50));
        bg += vec3(0.090, 0.173, 0.431) * 0.55 * blob(uv, vec2(0.60, 0.00), vec2(0.70, 0.60));
        bg += vec3(0.373, 0.890, 1.000) * 0.10 * blob(uv, vec2(0.12, 0.18), vec2(0.40, 0.40));
        col = mix(bg, col, sc.a);
        // bloom
        vec3 bl = texture2D(tBloom, uv).rgb;
        col += bl * uStrength;
        // gate flash: a coloured breath from the edges
        float edge = smoothstep(0.25, 0.9, length(uv - 0.5) * 1.35);
        col += uFlash.rgb * uFlash.a * (0.10 + edge * 0.55);
        // soft shoulder so gate zones + bloom never clip to white
        col = col / (1.0 + col * 0.42) * 1.32;
        // vignette + film grain
        float vig = 1.0 - smoothstep(0.55, 1.25, length((uv - 0.5) * vec2(1.15, 1.0)) * 1.4);
        col *= mix(0.72, 1.0, vig);
        float g = hash(uv * uRes + fract(uTime) * 100.0) - 0.5;
        col += g * 0.028;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  post = {
    render() {
      renderer.setRenderTarget(sceneRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
      quad.material = brightMat; brightMat.uniforms.tex.value = sceneRT.texture;
      renderer.setRenderTarget(brightRT); renderer.render(quadScene, quadCam);
      let src = brightRT;
      for (let i = 0; i < 2; i++) {
        quad.material = blurMat;
        blurMat.uniforms.tex.value = src.texture; blurMat.uniforms.uDir.value.set(1 + i, 0);
        renderer.setRenderTarget(blurA); renderer.render(quadScene, quadCam);
        blurMat.uniforms.tex.value = blurA.texture; blurMat.uniforms.uDir.value.set(0, 1 + i);
        renderer.setRenderTarget(blurB); renderer.render(quadScene, quadCam);
        src = blurB;
      }
      quad.material = compMat; compMat.uniforms.tBloom.value = blurB.texture;
      renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
    },
    resize() {
      const W = Math.floor(innerWidth * PR), H = Math.floor(innerHeight * PR);
      sceneRT.setSize(W, H); brightRT.setSize(W >> 2, H >> 2); blurA.setSize(W >> 2, H >> 2); blurB.setSize(W >> 2, H >> 2);
      blurMat.uniforms.uTexel.value.set(1 / (W >> 2), 1 / (H >> 2));
      compMat.uniforms.uRes.value.set(W, H);
    },
    u: compMat.uniforms
  };
}
function draw() { if (post) post.render(); else renderer.render(scene, camera); }

/* ---------------------------------------------------------------- dwell map */
const PIN = 0.055;
const _anchors = [{ s: PIN, t: 0 }]
  .concat(CV.stations.map(st => ({ s: st.s, t: st.t })))
  .concat([{ s: 1, t: 0.985 }]);
function smoother(x) { x = Math.max(0, Math.min(1, x)); return x * x * x * (x * (x * 6 - 15) + 10); }
function dwellMap(p) {
  p = Math.max(PIN, Math.min(1, p));
  let i = 0;
  while (i < _anchors.length - 2 && p > _anchors[i + 1].s) i++;
  const A = _anchors[i], B = _anchors[i + 1];
  const span = (B.s - A.s) || 1e-6;
  return A.t + (B.t - A.t) * smoother((p - A.s) / span);
}

/* ---------------------------------------------------------------- camera rig */
let progress = 0, target = 0, speed = 0, camT = 0, prevCamT = 0, nowS = 0;
const camPos = new THREE.Vector3(), camTan = new THREE.Vector3();
const look = new THREE.Vector3(), upN = new THREE.Vector3(), upB = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const mouse = { x: 0, y: 0, tx: 0, ty: 0, px: innerWidth / 2, py: innerHeight / 2, cx: innerWidth / 2, cy: innerHeight / 2 };
addEventListener("pointermove", (e) => {
  mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
  mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
  mouse.px = e.clientX; mouse.py = e.clientY;
});

function positionCamera(cp) {
  cp = Math.min(0.985, Math.max(0.0, cp));
  sampleAt(cp, camPos, camTan);
  sampleAt(Math.min(0.995, cp + 0.02), look, null);
  frameAt(cp, upN, upB);

  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;
  const right = camTan.clone().cross(worldUp).normalize();
  camPos.addScaledVector(right, mouse.x * 0.5);
  camPos.addScaledVector(upN, -mouse.y * 0.4);
  // micro-turbulence grows with flow speed — the camera is IN the liquid
  const sh = Math.min(1, speed * 2.5) * (reduced ? 0 : 0.045);
  camPos.addScaledVector(right, (Math.sin(nowS * 7.3) + Math.sin(nowS * 11.7) * 0.5) * sh);
  camPos.addScaledVector(upN, (Math.sin(nowS * 6.1 + 1.0) + Math.sin(nowS * 13.3) * 0.5) * sh);

  camera.position.copy(camPos);
  const up = worldUp.clone().lerp(upN, 0.32).normalize();
  camera.up.copy(up);
  camera.lookAt(look);
}

const _mouthPos = P[0].clone();
const _tan0 = T[0].clone().normalize();
const _extPos = _mouthPos.clone()
  .addScaledVector(_tan0, -11)
  .addScaledVector(new THREE.Vector3(1, 0, 0), -3.2)
  .addScaledVector(new THREE.Vector3(0, 1, 0), 1.6);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
function rigCamera(p) {
  if (p < PIN) {
    const k = smoother(p / PIN);
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    _v1.lerpVectors(_extPos, _mouthPos, k);
    _v1.x += mouse.x * (1 - k) * 0.8; _v1.y -= mouse.y * (1 - k) * 0.6;
    _v2.copy(_mouthPos).addScaledVector(_tan0, k * 4 + 0.5);
    camera.position.copy(_v1);
    camera.up.set(0, 1, 0);
    camera.lookAt(_v2);
  } else {
    positionCamera(camT);
    // leaving the pipe: drift out of the mouth into open space, eyes on the planet
    const ex = smoother(ramp(p, 0.940, 1.0));
    if (ex > 0 && space) {
      // glide out, then a slow cinematic drift/orbit while parked at the end
      camera.position.addScaledVector(camTan, ex * 48);
      const right = camTan.clone().cross(worldUp).normalize();
      camera.position.addScaledVector(right, Math.sin(nowS * 0.11) * 7 * ex);
      camera.position.addScaledVector(worldUp, Math.cos(nowS * 0.09) * 4 * ex);
      _v2.copy(camera.position).addScaledVector(camTan, 12);
      _v2.lerp(space.planetPos, ex * 0.16);
      _v2.addScaledVector(right, Math.sin(nowS * 0.07 + 1.0) * 3 * ex);
      camera.up.lerp(worldUp, ex);
      camera.lookAt(_v2);
    }
  }
  // speed-reactive lens: the view opens up as the flow accelerates
  const fov = BASE_FOV + Math.min(16, speed * 22);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

/* ---------------------------------------------------------------- HTML: stations */
const stage = document.getElementById("stations");
const projLayer = document.createElement("div");
projLayer.id = "projections";
document.body.insertBefore(projLayer, stage);
const nodes = [];
const REVEAL = [".st-kick", ".st-years", ".st-dur", ".st-org", ".st-role", ".st-place", ".st-tools", ".st-bullets"];
CV.stations.forEach((st, i) => {
  const el = document.createElement("article");
  el.className = "overlay station";
  el.dataset.idx = i;
  const hasImg = !!st.img;
  const hasViz = !hasImg && st.kind !== "edu" && st.kind !== "training"
                 && window.VIZ && VIZ.has(st.mode);
  el.innerHTML = `
    <div class="st-inner">
      <div class="st-card">
        <div class="st-kick"></div>
        <div class="st-years"></div>
        <div class="st-dur"></div>
        <h2 class="st-org"></h2>
        <div class="st-role"></div>
        <div class="st-place"></div>
        <div class="st-tools"></div>
        <ul class="st-bullets"></ul>
      </div>
      ${hasImg ? '<div class="st-viz-wrap"><div class="st-photo" style="--img:url(' + st.img + ')"><img src="' + st.img + '" alt="" loading="lazy" /></div></div>' : ""}
      ${hasViz ? '<div class="st-viz-wrap"><canvas class="st-viz" width="560" height="340"></canvas></div>' : ""}
    </div>`;
  stage.appendChild(el);
  el._viz = hasViz ? el.querySelector(".st-viz") : null;
  el._build = 0;
  el._parts = REVEAL.map(sel => el.querySelector(sel));
  el.style.setProperty("--c", st._css);
  el._video = null;
  nodes.push(el);
});

const outroEl = document.getElementById("outro");

let LANG = "en";
function pick(v){ return (v && typeof v === "object" && !Array.isArray(v)) ? (v[LANG] ?? v.en) : v; }

/* ---------------------------------------------------------------- timeline + HUD */
const tl = document.getElementById("tl");
const tlDots = [];
const tlFill = tl ? tl.querySelector(".tl-fill") : null;
if (tl) {
  const list = tl.querySelector(".tl-list");
  CV.stations.forEach((st, i) => {
    const b = document.createElement("button");
    b.className = "tl-dot kind-" + st.kind + (st.gate ? " gate" : "");
    b.style.setProperty("--c", st._css);
    b.style.setProperty("--p", (st.s * 100).toFixed(2) + "%");
    b.type = "button";
    b.innerHTML = '<i></i><span class="tl-lab"><b></b><em></em></span>';
    b.addEventListener("click", () => goToStation(i));
    list.appendChild(b);
    tlDots.push(b);
  });
}
const hudIdx = document.querySelector("#hud .hud-idx");
const hudOrg = document.querySelector("#hud .hud-org");
const hudFlow = document.querySelector("#hud .hud-flow i");
let hudCur = -2;
function setHud(idx) {
  if (idx === hudCur) return;
  hudCur = idx;
  const total = String(CV.stations.length).padStart(2, "0");
  let a, b;
  if (idx === -1)      { a = "00 / " + total; b = pick(CV.ui.hudStart); }
  else if (idx >= CV.stations.length) { a = total + " / " + total; b = pick(CV.ui.hudEnd); }
  else { const st = CV.stations[idx]; a = String(idx + 1).padStart(2, "0") + " / " + total;
         b = pick(st.org) + " · " + pick(st.years); }
  if (hudIdx) hudIdx.textContent = a;
  if (hudOrg) { hudOrg.classList.remove("swap"); void hudOrg.offsetWidth; hudOrg.textContent = b; hudOrg.classList.add("swap"); }
  tlDots.forEach((d, i) => d.classList.toggle("on", i === idx));
}

/* travel: scroll to a station (used by timeline, keys, prev/next) */
let lenis = null;
function scrollToFrac(f, dur) {
  const y = f * (document.body.scrollHeight - innerHeight);
  if (lenis) lenis.scrollTo(y, { duration: dur || 1.6, easing: (t) => 1 - Math.pow(1 - t, 3), force: true });
  else window.scrollTo({ top: y, behavior: "smooth" });
}
function goToStation(i) {
  i = Math.max(-1, Math.min(CV.stations.length, i));
  if (i === -1) return scrollToFrac(0, 1.8);
  if (i >= CV.stations.length) return scrollToFrac(1, 1.8);
  scrollToFrac(CV.stations[i].s, 1.6);
}
function nextStation(dir) {
  const p = target;
  if (dir > 0) {
    const i = CV.stations.findIndex(st => st.s > p + 0.012);
    goToStation(i === -1 ? CV.stations.length : i);
  } else {
    let i = -1;
    for (let k = CV.stations.length - 1; k >= 0; k--) if (CV.stations[k].s < p - 0.012) { i = k; break; }
    goToStation(i);
  }
}
addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key;
  if (k === "ArrowDown" || k === "ArrowRight" || k === " " || k === "PageDown" || k === "j") { e.preventDefault(); nextStation(1); }
  else if (k === "ArrowUp" || k === "ArrowLeft" || k === "PageUp" || k === "k") { e.preventDefault(); nextStation(-1); }
  else if (k === "Home") { e.preventDefault(); scrollToFrac(0, 2); }
  else if (k === "End") { e.preventDefault(); scrollToFrac(1, 2); }
  else if (k === "m") { AudioFX.toggle(); }
});
const prevBtn = document.getElementById("prev"), nextBtn = document.getElementById("next");
if (prevBtn) prevBtn.addEventListener("click", () => nextStation(-1));
if (nextBtn) nextBtn.addEventListener("click", () => nextStation(1));

/* ---------------------------------------------------------------- render copy */
function render() {
  document.documentElement.lang = LANG;
  document.querySelector("#hero .h-sub").textContent = pick(CV.meta.intro);
  document.querySelector("#hero .h-tag").textContent = pick(CV.meta.tagline);
  document.querySelector(".scroll-cue span").textContent = pick(CV.ui.scroll);
  document.getElementById("pl-label").textContent = pick(CV.ui.loading);
  const dl = document.getElementById("dl-cv"); if (dl) dl.textContent = pick(CV.ui.downloadCV);
  const rp = document.getElementById("replay"); if (rp) rp.textContent = pick(CV.ui.replay);
  const cp = document.getElementById("copy"); if (cp && !cp.classList.contains("ok")) cp.textContent = pick(CV.ui.copyLink);
  const sb = document.getElementById("sound"); if (sb) sb.textContent = AudioFX.on ? pick(CV.ui.soundOn) : pick(CV.ui.soundOff);
  document.querySelectorAll(".lang button").forEach(b => b.classList.toggle("on", b.dataset.lang === LANG));
  document.querySelectorAll("[data-i18n]").forEach(n => { const v = CV.ui[n.dataset.i18n]; if (v) n.textContent = pick(v); });
  if (prevBtn) prevBtn.setAttribute("aria-label", pick(CV.ui.prev));
  if (nextBtn) nextBtn.setAttribute("aria-label", pick(CV.ui.next));

  let jobNo = 0;
  CV.stations.forEach((st, i) => {
    const el = nodes[i];
    el.className = "overlay station kind-" + st.kind + (st.gate ? " gate-" + st.gate : "");
    let kick;
    if (st.kind === "upcoming")      kick = pick(CV.ui.upcoming);
    else if (st.gate === "start")    kick = pick(CV.ui.gateStart);
    else if (st.gate === "done")     kick = pick(CV.ui.gateDone);
    else if (st.gate === "train")    kick = pick(st.place);
    else if (st.kind === "edu")      kick = pick(st.role);
    else { jobNo++;                  kick = String(jobNo).padStart(2, "0") + " — " + pick(st.role); }
    el.querySelector(".st-kick").textContent = kick;
    el.querySelector(".st-years").textContent = pick(st.years);
    const durEl = el.querySelector(".st-dur");
    durEl.textContent = st.dur ? pick(st.dur) : "";
    durEl.style.display = st.dur ? "" : "none";
    el.querySelector(".st-org").textContent = pick(st.org);
    el.querySelector(".st-role").textContent = pick(st.role);
    el.querySelector(".st-place").textContent = pick(st.place);
    const tools = el.querySelector(".st-tools"); tools.innerHTML = "";
    (st.tools || []).forEach(t => { const s = document.createElement("span"); s.textContent = t; tools.appendChild(s); });
    tools.style.display = (st.tools && st.tools.length) ? "" : "none";
    const ul = el.querySelector(".st-bullets"); ul.innerHTML = "";
    (pick(st.bullets) || []).forEach(b => { const li = document.createElement("li"); li.textContent = b; ul.appendChild(li); });
    // timeline label
    if (tlDots[i]) { tlDots[i].querySelector("b").textContent = pick(st.years); tlDots[i].querySelector("em").textContent = pick(st.org);
                     tlDots[i].setAttribute("aria-label", pick(st.years) + " — " + pick(st.org)); }
  });
  const route = document.getElementById("route");
  if (route) {
    route.querySelector(".r-title").textContent = pick(CV.ui.positions);
    const ol = route.querySelector("ol"); ol.innerHTML = "";
    CV.stations.forEach((st) => {
      if (st.kind === "edu") return;
      const li = document.createElement("li");
      li.innerHTML = "<b></b><span></span>";
      li.querySelector("b").textContent = pick(st.years);
      li.querySelector("span").textContent = pick(st.org);
      if (st.kind === "upcoming") li.className = "up";
      ol.appendChild(li);
    });
  }
  outroEl.querySelector(".o-kick").textContent = pick(CV.outro.kicker);
  outroEl.querySelector(".o-line").textContent = pick(CV.outro.line);
  outroEl.querySelector(".o-loc").textContent = pick(CV.outro.location);
  // journey recap — counted from the content itself
  const jobs = CV.stations.filter(s => s.kind === "job").length;
  const degrees = CV.stations.filter(s => s.gate === "done").length;
  const yrs = CV.stations.map(s => parseInt(String(pick(s.years)).match(/\d{4}/)?.[0] || "0", 10)).filter(Boolean);
  const stats = outroEl.querySelector(".o-stats");
  if (stats) stats.innerHTML = [
      [jobs, pick(CV.ui.statJobs)], [degrees, pick(CV.ui.statDegrees)],
      [Math.min(...yrs) + " → " + Math.max(...yrs), pick(CV.ui.statSpan)]
    ].map(([n, l]) => '<div><b>' + n + '</b><span>' + l + '</span></div>').join("");
  hudCur = -2; setHud(lastHud);
}
let lastHud = -1;
function setLang(l) {
  LANG = (l === "de") ? "de" : "en";
  try { localStorage.setItem("flow_lang", LANG); } catch (e) {}
  render();
}
document.querySelectorAll(".lang button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));

/* ---------------------------------------------------------------- audio
   No audio files: the coolant hum is synthesised live. Brown noise through a
   low-pass that opens with flow speed + a low hum; gates ring a soft chime. */
const AudioFX = {
  on: false, ctx: null,
  init() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    const ctx = this.ctx = new AC();
    const master = this.master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    // brown noise
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let l = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = this.lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 160; lp.Q.value = 0.8;
    const ng = this.ng = ctx.createGain(); ng.gain.value = 0.3;
    src.connect(lp); lp.connect(ng); ng.connect(master); src.start();
    // hum: two detuned sines + slow LFO
    const hg = this.hg = ctx.createGain(); hg.gain.value = 0.06; hg.connect(master);
    [46, 92.5].forEach((f, i) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = i ? 0.35 : 1; o.connect(g); g.connect(hg); o.start(); (this.osc = this.osc || []).push(o); });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 0.02;
    lfo.connect(lg); lg.connect(hg.gain); lfo.start();
    return true;
  },
  toggle() {
    if (!this.ctx && !this.init()) return;
    this.on = !this.on;
    if (this.on && this.ctx.state === "suspended") this.ctx.resume();
    this.master.gain.setTargetAtTime(this.on ? 0.55 : 0, this.ctx.currentTime, 0.4);
    const sb = document.getElementById("sound");
    if (sb) { sb.classList.toggle("on", this.on); sb.textContent = this.on ? pick(CV.ui.soundOn) : pick(CV.ui.soundOff); }
  },
  update(spd) {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    this.lp.frequency.setTargetAtTime(150 + spd * 1500, t, 0.15);
    this.ng.gain.setTargetAtTime(0.22 + spd * 0.9, t, 0.15);
    this.osc.forEach((o, i) => o.detune.setTargetAtTime(spd * 500, t, 0.2));
  },
  ping(kind) {
    if (!this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const base = kind === "done" ? 660 : kind === "train" ? 554 : 440;
    [base, base * 1.5].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12 / (i + 1), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1.7);
    });
  }
};
const sBtn = document.getElementById("sound");
if (sBtn) sBtn.addEventListener("click", () => AudioFX.toggle());

setLang((() => { try { return localStorage.getItem("flow_lang"); } catch (e) { return null; } })()
        || (navigator.language || "en").slice(0, 2));

/* ---------------------------------------------------------------- scroll */
document.getElementById("scroll-space").style.height = "1100vh";
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.85 });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
window.jumpTo = (f) => {
  const y = f * (document.body.scrollHeight - innerHeight);
  window.scrollTo(0, y);
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  target = progress = f;
  camT = dwellMap(progress);
  rigCamera(progress);
  updateOverlays(progress, performance.now() / 1000);
  draw();
};
window.goToStation = goToStation;
window.__dev = { get lenis() { return lenis; }, get target() { return target; }, get progress() { return progress; }, frames: 0 };
/* dev hook: drive the journey WITHOUT scrolling the page (preview screenshots) */
window.previewAt = (f) => {
  window.__lockP = (f == null) ? null : f;
  if (f == null) return;
  target = progress = f; camT = dwellMap(f); nowS = performance.now() / 1000; rigCamera(f);
  if (space) space.update(nowS, smoother(ramp(f, 0.85, 0.965)));
  updateOverlays(f, nowS); draw();
};

function ramp(x, a, b) { return Math.max(0, Math.min(1, (x - a) / (b - a))); }

/* ---------------------------------------------------------------- overlays */
const heroInner = document.querySelector("#hero .h-inner");
const cueEl = document.querySelector(".scroll-cue");
const portraitEl = document.querySelector("#hero .portrait");
const flashEl = document.getElementById("flash");
function updateOverlays(p, nowSec) {
  const heroA = 1 - ramp(p, 0.024, PIN);
  heroInner.style.opacity = heroA;
  heroInner.style.visibility = heroA > 0.01 ? "visible" : "hidden";
  const cueA = 1 - ramp(p, 0.008, 0.03);
  cueEl.style.opacity = cueA;
  cueEl.style.visibility = cueA > 0.01 ? "visible" : "hidden";
  if (portraitEl && heroA > 0.01 && fineCursor && !reduced) {
    portraitEl.style.transform = "translateY(-50%) perspective(900px) rotateY(" + (mouse.x * 7).toFixed(2) + "deg) rotateX(" + (-mouse.y * 5).toFixed(2) + "deg)";
  }

  let active = -1;
  CV.stations.forEach((st, i) => {
    const d = p - st.s;
    const ain = ramp(d, -0.024, -0.009), aout = 1 - ramp(d, 0.009, 0.024);
    const a = ain * aout;
    const el = nodes[i];
    el.style.opacity = aout;                       // exit is a common fade…
    el.style.visibility = a > 0.01 ? "visible" : "hidden";
    if (a > 0.5) active = i;
    if (a > 0.01) {
      // …entry is choreographed per element: each line rises a beat after the last
      el._parts.forEach((n, k) => {
        if (!n) return;
        const ak = smoother(ramp(ain, k * 0.075, 0.45 + k * 0.075));
        n.style.opacity = ak;
        n.style.transform = "translateY(" + ((1 - ak) * 22).toFixed(1) + "px)";
      });
      const card = el.querySelector(".st-card");
      card.style.transform = "translateY(" + (-d * 1900).toFixed(1) + "px)";
      const t0 = (nowSec || 0) + i * 1.7;
      const fy = Math.sin(t0 * 0.55) * 11 + Math.sin(t0 * 1.31) * 4;
      const fx = Math.sin(t0 * 0.42 + 1.3) * 8;
      const rot = Math.sin(t0 * 0.35 + 0.6) * 1.1;
      const floatTf = isMobile
        ? "translateX(calc(-50% + " + (fx * 0.5).toFixed(1) + "px)) " +
          "translateY(" + (-d * 420 + fy * 0.6).toFixed(1) + "px) rotate(" + (rot * 0.6).toFixed(2) + "deg)"
        : "translateY(calc(-50% + " + (-d * 900 + fy).toFixed(1) + "px)) " +
          "translateX(" + fx.toFixed(1) + "px) rotate(" + rot.toFixed(2) + "deg) scale(" + (0.94 + ain * 0.06).toFixed(3) + ")";
      const wrap = el.querySelector(".st-viz-wrap");
      if (wrap) { wrap.style.transform = floatTf; wrap.style.opacity = smoother(ramp(ain, 0.1, 0.8)); }
      el._build = Math.max(el._build * (a > 0.02 ? 1 : 0), ramp(d, -0.026, -0.004));
      if (el._viz && window.VIZ) VIZ.draw(st.mode, el._viz, nowSec || 0, a, el._build);
    } else {
      el._build = 0;
    }
  });

  const oA = ramp(p, 0.928, 0.962);
  outroEl.style.opacity = oA;
  outroEl.style.visibility = oA > 0.01 ? "visible" : "hidden";

  // HUD: which station are we at?
  let hud = active, between = false;
  if (hud === -1) {
    if (p < CV.stations[0].s - 0.02) hud = -1;
    else if (p > 0.93) hud = CV.stations.length;
    else { // between stations: show the one we're heading to, no dot lit
      const nx = CV.stations.findIndex(st => st.s > p);
      hud = nx === -1 ? CV.stations.length : nx;
      between = true;
    }
  }
  lastHud = hud; setHud(hud);
  if (between) tlDots.forEach((d) => d.classList.remove("on"));
  if (tlFill) tlFill.style.setProperty("--p", (p * 100).toFixed(2) + "%");
  document.body.classList.toggle("in-pipe", p > PIN * 0.9 && p < 0.94);
  document.body.classList.toggle("at-start", p < 0.01);
}

/* ---------------------------------------------------------------- loop */
let last = performance.now(), flow = 0;
const cursorEl = document.getElementById("cursor");
const _flash = { r: 0, g: 0, b: 0, a: 0 };

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; nowS = now / 1000; window.__dev.frames++;

  const maxY = Math.max(1, document.body.scrollHeight - innerHeight);
  target = (window.__lockP != null) ? window.__lockP
         : Math.max(0, Math.min(1, (window.scrollY || window.pageYOffset || 0) / maxY));
  if (!isFinite(progress)) progress = 0;
  progress += (target - progress) * (reduced ? 1 : 0.09);

  prevCamT = camT;
  camT = dwellMap(progress);
  const camMove = Math.abs(camT - prevCamT);
  speed += (camMove * 200 - speed) * 0.09;
  flow += dt * (0.16 + speed * 26.0);

  rigCamera(progress);

  const entFade = 1 - ramp(progress, PIN * 1.1, PIN * 2.2);
  entrance._mats.forEach((m, i) => { m.opacity = entrance._base[i] * Math.max(0.0, entFade); });
  entrance.visible = entFade > 0.01;

  wallMat.uniforms.uFlow.value = flow;
  wallMat.uniforms.uSpeed.value = speed;
  wallMat.uniforms.uHead.value = camT;
  coolMat.uniforms.uFlow.value = flow * 1.3;
  coolMat.uniforms.uSpeed.value = speed;
  coolMat.uniforms.uHead.value = camT;
  pMat.uniforms.uSpeed.value = speed;
  updateParticles(dt, speed);

  markers.forEach(({ st, mats, fx, flange }) => {
    const d = Math.abs(camT - st.t);
    const glow = Math.max(0, 1 - d / 0.06);
    const o = glow * glow;
    mats[0].opacity = o * 0.9;
    mats[1].opacity = o * 0.22;
    for (let k = 2; k < mats.length; k++) mats[k].opacity = o * 0.5;
    flange.rotation.z = nowS * 0.15;               // slow valve-wheel turn
    if (fx) { try { fx.update(flow, o, speed); } catch (e) {} }
    st._g = o;
  });
  const dm = Math.abs(camT - 0.985);
  mouth.material.opacity = Math.max(0, 1 - dm / 0.03) * 0.9;
  if (space) space.update(nowS, smoother(ramp(progress, 0.85, 0.965)));

  // gate flash + chime when crossing a gate
  let fa = 0, fc = null;
  GATE_LIST.forEach(g => {
    const d = camT - g.t;
    const k = Math.max(0, 1 - Math.abs(d) / 0.018);
    if (k > fa) { fa = k; fc = GATE_RGB[g.kind]; }
    const now = d > 0;
    if (now !== g.crossed) { g.crossed = now; if (Math.abs(d) < 0.03) AudioFX.ping(g.kind); }
  });
  _flash.a += ((fa * fa * 0.42) - _flash.a) * 0.15;
  if (fc) { _flash.r = fc[0]; _flash.g = fc[1]; _flash.b = fc[2]; }
  if (post) post.u.uFlash.value.set(_flash.r, _flash.g, _flash.b, _flash.a);
  else if (flashEl) { flashEl.style.opacity = _flash.a * 0.7;
    flashEl.style.background = "radial-gradient(80% 80% at 50% 50%, transparent 30%, rgba(" + (_flash.r*255|0) + "," + (_flash.g*255|0) + "," + (_flash.b*255|0) + ",.55))"; }
  if (post) { post.u.uSpeed.value = speed; post.u.uTime.value = nowS; }

  updateOverlays(progress, nowS);
  if (hudFlow) hudFlow.style.transform = "scaleX(" + Math.min(1, 0.08 + speed * 1.6).toFixed(3) + ")";

  // cursor light
  if (cursorEl && fineCursor) {
    mouse.cx += (mouse.px - mouse.cx) * 0.18; mouse.cy += (mouse.py - mouse.cy) * 0.18;
    cursorEl.style.transform = "translate(" + mouse.cx.toFixed(1) + "px," + mouse.cy.toFixed(1) + "px)";
  }
  AudioFX.update(speed);

  draw();
  requestAnimationFrame(loop);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (post) post.resize();
});

/* ---------------------------------------------------------------- preloader */
const plBar = document.querySelector("#preloader .pl-bar i");
const plPct = document.getElementById("pl-pct");
let pct = 0; const plT0 = performance.now();
const iv = setInterval(() => {
  // time-based so throttled/background tabs still finish in ~1.4 s
  pct = Math.min(100, Math.max(pct + 4, (performance.now() - plT0) / 1400 * 100));
  if (plBar) plBar.style.width = pct + "%";
  if (plPct) plPct.textContent = String(Math.round(pct)).padStart(3, "0");
  if (pct >= 100) {
    clearInterval(iv);
    setTimeout(() => { document.getElementById("preloader").classList.add("done"); document.body.classList.add("ready"); }, 300);
  }
}, 110);

/* replay + copy link */
const rBtn = document.getElementById("replay");
if (rBtn) rBtn.addEventListener("click", () => scrollToFrac(0, 2.4));
const cBtn = document.getElementById("copy");
if (cBtn) cBtn.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(location.href); cBtn.classList.add("ok"); cBtn.textContent = pick(CV.ui.copied);
        setTimeout(() => { cBtn.classList.remove("ok"); cBtn.textContent = pick(CV.ui.copyLink); }, 1800); } catch (e) {}
});

requestAnimationFrame(loop);
})();
