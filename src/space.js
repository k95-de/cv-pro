/* ============================================================================
   THE FLOW — space
   The pipe ends in open space: a nebula sky, layered stars, a ringed gas
   giant and slow dust. All procedural (shaders + canvas), no textures to load.
   window.Space.make(origin, tangent) -> { group, update(timeSec, strength) }
   ========================================================================== */
(function () {
"use strict";
const isMobile = matchMedia("(max-width: 720px)").matches;

const NOISE = `
  float hash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
  float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

function make(origin, tangent) {
  const group = new THREE.Group();
  const T = tangent.clone().normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const R = new THREE.Vector3().crossVectors(T, worldUp).normalize();
  const U = new THREE.Vector3().crossVectors(R, T).normalize();

  /* ---- sky dome: nebula + stars, seen from inside ---- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uStr: { value: 0 },
      cDeep: { value: new THREE.Color("#05070F") }, cIndigo: { value: new THREE.Color("#3B2E8C") },
      cBlue: { value: new THREE.Color("#1D4ED8") }, cCyan: { value: new THREE.Color("#5FE3FF") },
      cViolet: { value: new THREE.Color("#8B5CF6") }, cGreen: { value: new THREE.Color("#3DFFB0") },
      cYellow: { value: new THREE.Color("#FFE27A") }, uAxis: { value: T.clone() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; varying vec3 vDir;
      uniform float uTime, uStr; uniform vec3 cDeep, cIndigo, cBlue, cCyan, cViolet, cGreen, cYellow, uAxis;
      ${NOISE}
      float stars(vec3 d, float scale, float thr, float tw){
        vec3 p = d * scale; vec3 i = floor(p); vec3 f = fract(p) - 0.5;
        float h = hash(i); if (h < thr) return 0.0;
        vec3 o = vec3(hash(i + 1.3), hash(i + 2.7), hash(i + 4.1)) - 0.5;
        float dist = length(f - o * 0.7);
        float s = smoothstep(0.10, 0.0, dist) * (0.55 + 0.45 * sin(uTime * (1.0 + h * 3.0) * tw + h * 40.0));
        return s * (0.4 + 0.6 * h);
      }
      void main(){
        vec3 d = normalize(vDir);
        // nebula: two layers of fbm pulled toward the pipe axis so the exit opens into a glowing cloud
        float axial = pow(max(0.0, dot(d, uAxis)), 1.6);
        float n1 = fbm(d * 2.2 + vec3(uTime * 0.020, uTime * 0.007, 0.0));
        float n2 = fbm(d * 5.0 - vec3(0.0, uTime * 0.016, uTime * 0.005));
        float n3 = fbm(d * 3.4 + vec3(uTime * 0.011, -uTime * 0.009, 4.0));
        float cloud = smoothstep(0.38, 0.85, n1 * 0.7 + n2 * 0.5);
        float wisps = smoothstep(0.55, 0.95, n2);
        vec3 neb = cDeep;
        neb = mix(neb, cIndigo * 0.9, cloud * 0.9);
        neb = mix(neb, cBlue * 0.85, cloud * wisps * 0.9);
        neb = mix(neb, cViolet * 0.7, smoothstep(0.6, 0.9, n1) * (1.0 - axial) * 0.5);
        neb += cCyan * pow(wisps, 3.0) * 0.35 * (0.5 + axial);
        // aurora: living green-teal curtains that ripple through the cloud, with golden cores
        float aur = smoothstep(0.40, 0.78, n3) * (0.65 + 0.35 * sin(uTime * 0.6 + n1 * 12.0));
        neb = mix(neb, cGreen * 0.85, aur * (0.35 + cloud * 0.65));
        neb += cYellow * pow(aur, 2.0) * 0.55 * (0.5 + 0.5 * sin(uTime * 0.9 + n2 * 20.0));
        neb += cGreen * pow(max(0.0, n2 - 0.5) * 2.0, 2.0) * 0.35;
        // slow golden shafts sweeping across (light through the cloud)
        float shaft = pow(0.5 + 0.5 * sin(dot(d, vec3(3.0, 5.0, 2.0)) * 4.0 + uTime * 0.25 + n1 * 3.0), 6.0);
        neb += cYellow * shaft * 0.10 * cloud;
        neb *= 0.55 + axial * 0.9;
        // a luminous band (our galaxy) across the sky
        float band = exp(-pow(dot(d, normalize(cross(uAxis, vec3(0.3, 1.0, 0.2)))), 2.0) * 9.0);
        neb += mix(cBlue, cCyan, 0.4) * band * (0.10 + 0.25 * fbm(d * 7.0)) ;
        // stars: three scales
        float st = stars(d, 60.0, 0.955, 1.0) * 1.4
                 + stars(d, 130.0, 0.945, 1.6) * 0.9
                 + stars(d, 260.0, 0.93, 2.2) * 0.5;
        // stars in three temperatures: ice-white, warm gold, faint green
        float hue = hash(floor(d * 60.0) + 9.0);
        vec3 starCol = hue < 0.55 ? vec3(0.9, 0.96, 1.0) : (hue < 0.85 ? cYellow : cGreen);
        vec3 col = neb + starCol * st * (0.8 + band * 0.9);
        gl_FragColor = vec4(col * uStr, 1.0);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 48, 32), skyMat);
  group.add(sky);

  /* ---- particle Saturn: a point-cloud body + Kepler rings ----
     Body: motes on a Fibonacci sphere (even coverage, no pole crowding).
     Rings: motes whose angular speed goes as r^-1.5, so inner lanes visibly
     outrun outer ones; gaps are carved out of the radius distribution; lane
     brightness is banded on radius so stripes hold still while matter orbits. */
  const sunDir = new THREE.Vector3().copy(T).multiplyScalar(-0.3).addScaledVector(R, -0.8).addScaledVector(U, 0.5).normalize();
  const pPos = origin.clone().addScaledVector(T, 210).addScaledVector(R, 95).addScaledVector(U, 28);
  const system = new THREE.Group();
  system.position.copy(pPos);
  system.rotation.set(0.95, 0.0, 0.38);   // open the ring toward the viewer
  group.add(system);

  const moteTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.3, "rgba(255,255,255,0.75)");
    rg.addColorStop(0.7, "rgba(255,255,255,0.12)"); rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();

  const PR_ = 58;                                       // planet radius
  const NB = isMobile ? 4500 : 11000;                   // body motes
  const bPos = new Float32Array(NB * 3), bCol = new Float32Array(NB * 3), bSz = new Float32Array(NB);
  const cSapph = new THREE.Color("#2F6BFF"), cIce = new THREE.Color("#DDF6FF"), cLav = new THREE.Color("#B39BFF"),
        cAur = new THREE.Color("#3DFFB0"), cGold = new THREE.Color("#FFE27A"), tmp = new THREE.Color();
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NB; i++) {
    const y = 1 - (i / (NB - 1)) * 2, rr = Math.sqrt(1 - y * y), th = GA * i;
    const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
    const jit = 1 + (Math.random() - 0.5) * 0.02;
    bPos[i * 3] = x * PR_ * jit; bPos[i * 3 + 1] = y * PR_ * jit; bPos[i * 3 + 2] = z * PR_ * jit;
    // banded colour by latitude with a little turbulence
    const band = 0.5 + 0.5 * Math.sin(y * 22 + Math.sin(x * 4 + z * 3) * 1.6);
    tmp.copy(cSapph).lerp(cIce, Math.pow(band, 1.6));
    if (band < 0.35) tmp.lerp(cLav, (0.35 - band) * 1.2);
    const pole = Math.max(0, Math.abs(y) - 0.72) / 0.28;
    if (pole > 0) tmp.lerp(cAur, Math.min(1, pole * 0.9));
    bCol[i * 3] = tmp.r; bCol[i * 3 + 1] = tmp.g; bCol[i * 3 + 2] = tmp.b;
    bSz[i] = 0.7 + Math.random() * 0.6;
  }
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
  bGeo.setAttribute("aCol", new THREE.BufferAttribute(bCol, 3));
  bGeo.setAttribute("aSz", new THREE.BufferAttribute(bSz, 1));
  const bodyMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTex: { value: moteTex }, uStr: { value: 0 }, uSun: { value: sunDir }, uSize: { value: isMobile ? 850 : 1150 } },
    vertexShader: `attribute vec3 aCol; attribute float aSz; varying vec3 vC; varying float vA;
      uniform float uSize; uniform vec3 uSun;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normalize(position));
        vec3 v = normalize(-mv.xyz);
        float facing = dot(n, v);                              // >0 near hemisphere
        float limb = smoothstep(-0.15, 0.25, facing);          // far side fades out
        float sun = max(0.0, dot(n, normalize((viewMatrix * vec4(uSun, 0.0)).xyz)));
        float rim = pow(1.0 - max(0.0, facing), 2.0);          // dense limb glows
        vA = limb * (0.22 + sun * 0.9 + rim * 0.9);
        vC = aCol * (0.55 + sun * 0.6) + vec3(0.6, 0.9, 1.0) * rim * 0.35;
        gl_PointSize = clamp(uSize * aSz / max(1.0, -mv.z), 1.0, 10.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `precision highp float; uniform sampler2D uTex; uniform float uStr; varying vec3 vC; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d); gl_FragColor = vec4(vC * a * vA * uStr, a * vA * uStr * 0.6); }`
  });
  const planet = new THREE.Points(bGeo, bodyMat); planet.frustumCulled = false;
  system.add(planet);

  const NR = isMobile ? 9000 : 24000;                   // ring motes
  const rR = new Float32Array(NR), rA = new Float32Array(NR), rH = new Float32Array(NR), rS = new Float32Array(NR);
  const R0 = 76, R1 = 132;
  const gaps = [[0.52, 0.575], [0.70, 0.715], [0.86, 0.875]];   // carved divisions (fractions of R0..R1)
  for (let i = 0; i < NR; i++) {
    let f;
    do { f = Math.pow(Math.random(), 0.85); } while (gaps.some(g => f > g[0] && f < g[1]));
    rR[i] = R0 + f * (R1 - R0); rA[i] = Math.random() * Math.PI * 2;
    rH[i] = (Math.random() - 0.5) * 0.9; rS[i] = Math.random();
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NR * 3), 3));
  rGeo.setAttribute("aR", new THREE.BufferAttribute(rR, 1));
  rGeo.setAttribute("aA", new THREE.BufferAttribute(rA, 1));
  rGeo.setAttribute("aH", new THREE.BufferAttribute(rH, 1));
  rGeo.setAttribute("aS", new THREE.BufferAttribute(rS, 1));
  const ringMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTex: { value: moteTex }, uStr: { value: 0 }, uTime: { value: 0 }, uSize: { value: isMobile ? 520 : 720 },
      uR0: { value: R0 }, uR1: { value: R1 }, uPR: { value: PR_ },
      cGold: { value: cGold }, cIce: { value: cIce }, cGreen: { value: cAur }, cBlue: { value: new THREE.Color("#5FA8FF") } },
    vertexShader: `attribute float aR; attribute float aA; attribute float aH; attribute float aS; varying vec3 vC; varying float vA;
      uniform float uTime, uSize, uR0, uR1, uPR; uniform vec3 cGold, cIce, cGreen, cBlue;
      ${NOISE}
      void main(){
        float f = (aR - uR0) / (uR1 - uR0);
        float w = 1.9 * pow(aR / uR0, -1.5);                  // Kepler: inner lanes run faster
        float ang = aA + uTime * w * 0.12;
        vec3 p = vec3(cos(ang) * aR, aH, sin(ang) * aR);
        // planet shadow + occlusion: motes behind the body (as seen from the camera) drop out
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec4 c0 = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec3 dp = mv.xyz - c0.xyz;
        float behind = step(0.0, -dp.z + 0.0) * step(length(dp.xy), uPR * 0.98);
        // lanes banded on radius: stripes hold still while matter orbits through them
        float lane = 0.55 + 0.65 * fbm(vec3(f * 28.0, 0.5, 1.5));
        float edge = smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.93, 1.0, f));
        vec3 col = mix(cGold, cIce, smoothstep(0.1, 0.55, f));
        col = mix(col, cBlue, smoothstep(0.55, 0.9, f) * 0.6);
        col = mix(col, cGreen, smoothstep(0.76, 0.80, f) * (1.0 - smoothstep(0.84, 0.88, f)) * 0.8);
        float tw = 0.8 + 0.2 * sin(uTime * 3.0 + aS * 40.0);
        vA = lane * edge * tw * (1.0 - behind);
        vC = col;
        gl_PointSize = clamp(uSize * (0.6 + aS * 0.8) / max(1.0, -mv.z), 1.2, 8.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `precision highp float; uniform sampler2D uTex; uniform float uStr; varying vec3 vC; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.08, d); gl_FragColor = vec4(vC * a * vA * uStr * 1.35, a * vA * uStr * 0.9); }`
  });
  const ring = new THREE.Points(rGeo, ringMat); ring.frustumCulled = false;
  system.add(ring);

  // soft atmosphere halo behind the body
  const haloTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), rg = g.createRadialGradient(128, 128, 50, 128, 128, 128);
    rg.addColorStop(0, "rgba(95,227,255,0.40)"); rg.addColorStop(0.5, "rgba(59,130,246,0.16)"); rg.addColorStop(1, "rgba(29,78,216,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.copy(pPos); halo.scale.set(175, 175, 1);
  group.add(halo);

  /* ---- drifting dust ---- */
  const COUNT = isMobile ? 700 : 2200;
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(COUNT * 3), sh = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2, rr = 8 + Math.random() * 120, z = Math.random() * 260 - 10;
    const p = origin.clone().addScaledVector(T, z).addScaledVector(R, Math.cos(a) * rr).addScaledVector(U, Math.sin(a) * rr);
    arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; sh[i] = Math.random();
  }
  geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  geo.setAttribute("aShade", new THREE.BufferAttribute(sh, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uStr: { value: 0 }, cB: { value: new THREE.Color("#3B82F6") }, cC: { value: new THREE.Color("#5FE3FF") } },
    vertexShader: `attribute float aShade; varying float vS; uniform float uTime;
      void main(){ vS = aShade; vec3 p = position; p.y += sin(uTime * 0.3 + aShade * 20.0) * 1.5; p.x += cos(uTime * 0.2 + aShade * 13.0) * 1.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp(90.0 / max(1.0, -mv.z), 1.0, 6.0) * (0.6 + aShade); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying float vS; uniform float uStr, uTime; uniform vec3 cB, cC;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
        float tw = 0.6 + 0.4 * sin(uTime * (1.0 + vS * 2.0) + vS * 50.0);
        vec3 col = vS < 0.6 ? mix(cB, cC, vS / 0.6) : (vS < 0.82 ? vec3(1.0, 0.88, 0.48) : vec3(0.35, 1.0, 0.7));
        gl_FragColor = vec4(col, a * tw * 0.85 * uStr); }`
  });
  const dust = new THREE.Points(geo, dustMat); dust.frustumCulled = false;
  group.add(dust);

  sky.position.copy(origin).addScaledVector(T, 40);

  /* ---- two moons on tilted orbits ---- */
  const moonMat = new THREE.ShaderMaterial({
    uniforms: { uStr: { value: 0 }, uSun: { value: sunDir }, cM: { value: new THREE.Color("#C9D6EA") }, cR: { value: new THREE.Color("#7FB8FF") } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position;
      vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying vec3 vN; varying vec3 vV; varying vec3 vP; uniform float uStr; uniform vec3 uSun, cM, cR;
      ${NOISE}
      void main(){ vec3 N = normalize(vN); float diff = max(0.0, dot(N, normalize((viewMatrix * vec4(uSun, 0.0)).xyz)));
        float crat = fbm(normalize(vP) * 9.0); vec3 col = cM * (0.55 + 0.45 * crat) * (pow(diff, 0.7) * 1.1 + 0.05);
        col += cR * pow(1.0 - max(0.0, dot(N, vV)), 3.0) * 0.4; gl_FragColor = vec4(col * uStr, 1.0); }`
  });
  const moons = [
    { m: new THREE.Mesh(new THREE.SphereGeometry(7, 32, 24), moonMat), r: 150, speed: 0.11, tilt: 0.35, phase: 0.8 },
    { m: new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), moonMat), r: 195, speed: 0.07, tilt: -0.22, phase: 3.4 }
  ];
  moons.forEach(o => group.add(o.m));

  /* ---- comets: additive streaks that cross the sky now and then ---- */
  const cometTex = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 16;
    const g = c.getContext("2d"), lg = g.createLinearGradient(0, 0, 256, 0);
    lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.75, "rgba(160,220,255,0.35)"); lg.addColorStop(0.97, "rgba(255,255,255,1)"); lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg; g.fillRect(0, 0, 256, 16); return new THREE.CanvasTexture(c); })();
  const comets = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 1.6), new THREE.MeshBasicMaterial({ map: cometTex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    group.add(m); comets.push({ m, t0: -10 - i * 7, period: 11 + i * 5, dur: 2.2, a: Math.random() * 6.28, b: Math.random(), armed: false });
  }
  const _cp = new THREE.Vector3(), _cd = new THREE.Vector3(), _X = new THREE.Vector3(1, 0, 0), _cq = new THREE.Quaternion();
  group.visible = false;

  return {
    group, planetPos: pPos,
    update(t, str) {
      group.visible = str > 0.002;
      if (!group.visible) return;
      skyMat.uniforms.uTime.value = t; skyMat.uniforms.uStr.value = str;
      bodyMat.uniforms.uStr.value = str;
      ringMat.uniforms.uStr.value = str; ringMat.uniforms.uTime.value = t; halo.material.opacity = str * 0.8;
      dustMat.uniforms.uTime.value = t; dustMat.uniforms.uStr.value = str;
      planet.rotation.y = t * 0.06;
      sky.rotation.y = t * 0.004; sky.rotation.x = Math.sin(t * 0.03) * 0.02;
      moonMat.uniforms.uStr.value = str;
      moons.forEach(o => {
        const a = t * o.speed + o.phase;
        o.m.position.copy(pPos).addScaledVector(R, Math.cos(a) * o.r).addScaledVector(T, Math.sin(a) * o.r * 0.55)
          .addScaledVector(U, Math.sin(a) * o.r * o.tilt);
        o.m.rotation.y = t * 0.2;
      });
      comets.forEach(c => {
        const k = ((t - c.t0) % c.period + c.period) % c.period;    // time since this comet last launched
        if (k > c.dur) { c.m.material.opacity = 0; c.armed = false; return; }
        const f = k / c.dur;
        if (!c.armed) { c.a = Math.random() * 6.28; c.b = Math.random(); c.armed = true; }
        // start high and to one side, streak across the field ahead of the exit
        _cp.copy(origin).addScaledVector(T, 120 + c.b * 120).addScaledVector(R, Math.cos(c.a) * 150).addScaledVector(U, Math.sin(c.a) * 110 + 60);
        _cd.copy(R).multiplyScalar(-1.0).addScaledVector(U, -0.7).addScaledVector(T, 0.2).normalize();
        _cp.addScaledVector(_cd, f * 260);
        c.m.position.copy(_cp);
        _cq.setFromUnitVectors(_X, _cd); c.m.quaternion.copy(_cq);
        c.m.material.opacity = Math.sin(f * Math.PI) * 0.9 * str;
      });
    }
  };
}
window.Space = { make };
})();
