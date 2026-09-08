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

  /* ---- gas giant with atmosphere + ring ---- */
  const sunDir = new THREE.Vector3().copy(T).multiplyScalar(-0.3).addScaledVector(R, -0.8).addScaledVector(U, 0.5).normalize();
  const planetMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uStr: { value: 0 }, uSun: { value: sunDir },
      cA: { value: new THREE.Color("#12327F") }, cB: { value: new THREE.Color("#5FA8FF") },
      cC: { value: new THREE.Color("#E6FAFF") }, cD: { value: new THREE.Color("#A48BFF") },
      cGold: { value: new THREE.Color("#FFE7B8") } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV;
      void main(){ vN = normalize(normalMatrix * normal); vP = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying vec3 vN; varying vec3 vP; varying vec3 vV;
      uniform float uTime, uStr; uniform vec3 uSun, cA, cB, cC, cD, cGold;
      ${NOISE}
      void main(){
        vec3 p = normalize(vP);
        float lat = p.y;
        // flowing bands: turbulence shears the latitude lines, slowly drifting
        float turb = fbm(vec3(p.x * 2.6 + uTime * 0.03, lat * 8.0, p.z * 2.6)) - 0.5;
        float turb2 = fbm(vec3(p.x * 7.0 - uTime * 0.02, lat * 20.0, p.z * 7.0) + 5.0) - 0.5;
        float b1 = sin(lat * 22.0 + turb * 7.0 + turb2 * 2.0) * 0.5 + 0.5;
        float b2 = sin(lat * 47.0 - turb * 4.0) * 0.5 + 0.5;
        float storm = smoothstep(0.72, 0.95, fbm(p * 5.0 + vec3(uTime * 0.01, 0.0, 0.0) + 3.0));
        vec3 col = mix(cA, cB, pow(b1, 1.4));
        col = mix(col, cD, smoothstep(0.35, 0.75, b2) * 0.30 * (1.0 - b1));
        col = mix(col, cC, storm * 0.7 + pow(b1, 6.0) * 0.25);
        // polar ice caps with a rippling green aurora ring around them
        col = mix(col, cC, smoothstep(0.78, 0.95, abs(lat)) * 0.7);
        float auroraRing = smoothstep(0.62, 0.72, abs(lat)) * (1.0 - smoothstep(0.74, 0.84, abs(lat)));
        float ripple = 0.5 + 0.5 * sin(atan(p.z, p.x) * 9.0 + uTime * 1.3 + turb * 6.0);
        col += vec3(0.24, 1.0, 0.69) * auroraRing * ripple * 0.55;
        vec3 N = normalize(vN);
        vec3 L = normalize((viewMatrix * vec4(uSun, 0.0)).xyz);
        float diff = max(0.0, dot(N, L));
        float wrap = pow(diff, 0.55) * 1.2 + 0.08;
        float fres = pow(1.0 - max(0.0, dot(N, vV)), 3.0);
        // champagne-gold light along the terminator, icy blue atmosphere on the rim
        float term = smoothstep(0.0, 0.25, diff) * (1.0 - smoothstep(0.25, 0.6, diff));
        col = col * wrap + cGold * term * 0.16 + cB * fres * (0.35 + diff * 0.8) + cC * fres * fres * 0.5;
        gl_FragColor = vec4(col * uStr, 1.0);
      }`
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(58, 64, 48), planetMat);
  const pPos = origin.clone().addScaledVector(T, 210).addScaledVector(R, 95).addScaledVector(U, 28);
  const system = new THREE.Group();            // planet + ring share one axial tilt
  system.position.copy(pPos);
  system.rotation.set(0.42, 0.0, 0.30);
  group.add(system);
  system.add(planet);

  const ringMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    uniforms: { uStr: { value: 0 }, uSun: { value: sunDir }, cB: { value: new THREE.Color("#3B82F6") }, cC: { value: new THREE.Color("#5FE3FF") } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; varying vec2 vUv; varying vec3 vW; uniform float uStr; uniform vec3 uSun, cB, cC;
      ${NOISE}
      void main(){
        float r = vUv.x;                                  // 0 inner .. 1 outer
        float g = fbm(vec3(r * 40.0, 0.0, 1.0));
        float lanes = smoothstep(0.35, 0.8, g) * (1.0 - smoothstep(0.92, 1.0, r)) * smoothstep(0.0, 0.08, r);
        float gap = 1.0 - smoothstep(0.55, 0.58, r) * (1.0 - smoothstep(0.62, 0.65, r));
        float a = lanes * gap * 0.55;
        vec3 col = mix(mix(vec3(1.0, 0.89, 0.55), cB, smoothstep(0.0, 0.25, r)), cC, r) * (0.55 + 0.45 * g);
        col = mix(col, vec3(0.45, 1.0, 0.75), smoothstep(0.78, 0.86, r) * (1.0 - smoothstep(0.86, 0.9, r)) * 0.6);
        gl_FragColor = vec4(col * uStr, a * uStr);
      }`
  });
  const ringGeo = new THREE.RingGeometry(74, 128, 128, 1);
  // remap uv.x to radius for the shader
  { const uv = ringGeo.attributes.uv, pos = ringGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) { const x = pos.getX(i), y = pos.getY(i); uv.setXY(i, (Math.hypot(x, y) - 74) / (128 - 74), 0); } }
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;                 // equatorial plane of the tilted system
  system.add(ring);

  // atmosphere halo (additive sprite)
  const haloTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), rg = g.createRadialGradient(128, 128, 60, 128, 128, 128);
    rg.addColorStop(0, "rgba(95,227,255,0.55)"); rg.addColorStop(0.45, "rgba(59,130,246,0.22)"); rg.addColorStop(1, "rgba(29,78,216,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.copy(pPos); halo.scale.set(170, 170, 1);
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
      planetMat.uniforms.uTime.value = t; planetMat.uniforms.uStr.value = str;
      ringMat.uniforms.uStr.value = str; halo.material.opacity = str * 0.9;
      dustMat.uniforms.uTime.value = t; dustMat.uniforms.uStr.value = str;
      planet.rotation.y = t * 0.06;
      sky.rotation.y = t * 0.004; sky.rotation.x = Math.sin(t * 0.03) * 0.02;
      ring.rotation.z = t * 0.01;
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
