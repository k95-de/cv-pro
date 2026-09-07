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
      cViolet: { value: new THREE.Color("#8B5CF6") }, uAxis: { value: T.clone() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float; varying vec3 vDir;
      uniform float uTime, uStr; uniform vec3 cDeep, cIndigo, cBlue, cCyan, cViolet, uAxis;
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
        float n1 = fbm(d * 2.2 + vec3(uTime * 0.008, 0.0, 0.0));
        float n2 = fbm(d * 5.0 - vec3(0.0, uTime * 0.006, 0.0));
        float cloud = smoothstep(0.38, 0.85, n1 * 0.7 + n2 * 0.5);
        float wisps = smoothstep(0.55, 0.95, n2);
        vec3 neb = cDeep;
        neb = mix(neb, cIndigo * 0.9, cloud * 0.9);
        neb = mix(neb, cBlue * 0.85, cloud * wisps * 0.9);
        neb = mix(neb, cViolet * 0.7, smoothstep(0.6, 0.9, n1) * (1.0 - axial) * 0.5);
        neb += cCyan * pow(wisps, 3.0) * 0.35 * (0.5 + axial);
        neb *= 0.55 + axial * 0.9;
        // a luminous band (our galaxy) across the sky
        float band = exp(-pow(dot(d, normalize(cross(uAxis, vec3(0.3, 1.0, 0.2)))), 2.0) * 9.0);
        neb += mix(cBlue, cCyan, 0.4) * band * (0.10 + 0.25 * fbm(d * 7.0)) ;
        // stars: three scales
        float st = stars(d, 60.0, 0.955, 1.0) * 1.4
                 + stars(d, 130.0, 0.945, 1.6) * 0.9
                 + stars(d, 260.0, 0.93, 2.2) * 0.5;
        vec3 col = neb + vec3(0.9, 0.96, 1.0) * st * (0.7 + band * 0.8);
        gl_FragColor = vec4(col * uStr, 1.0);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 48, 32), skyMat);
  group.add(sky);

  /* ---- gas giant with atmosphere + ring ---- */
  const sunDir = new THREE.Vector3().copy(T).multiplyScalar(-0.3).addScaledVector(R, -0.8).addScaledVector(U, 0.5).normalize();
  const planetMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uStr: { value: 0 }, uSun: { value: sunDir },
      cA: { value: new THREE.Color("#0B1A4A") }, cB: { value: new THREE.Color("#1D4ED8") },
      cC: { value: new THREE.Color("#5FE3FF") }, cD: { value: new THREE.Color("#3B2E8C") } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV;
      void main(){ vN = normalize(normalMatrix * normal); vP = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `precision highp float; varying vec3 vN; varying vec3 vP; varying vec3 vV;
      uniform float uTime, uStr; uniform vec3 uSun, cA, cB, cC, cD;
      ${NOISE}
      void main(){
        vec3 p = normalize(vP);
        float lat = p.y;
        float turb = fbm(vec3(p.x * 3.0 + uTime * 0.02, lat * 9.0, p.z * 3.0)) - 0.5;
        float bands = sin(lat * 26.0 + turb * 6.0) * 0.5 + 0.5;
        float storm = smoothstep(0.75, 0.95, fbm(p * 6.0 + 3.0));
        vec3 col = mix(cA, cB, bands);
        col = mix(col, cD, smoothstep(0.3, 0.7, fbm(vec3(lat * 4.0, p.x, p.z) + 7.0)) * 0.6);
        col = mix(col, cC, storm * 0.5);
        vec3 N = normalize(vN);
        float diff = max(0.0, dot(N, normalize((viewMatrix * vec4(uSun, 0.0)).xyz)));
        float wrap = pow(diff, 0.6) * 1.15 + 0.10;
        float fres = pow(1.0 - max(0.0, dot(N, vV)), 3.0);
        col = col * wrap + cC * fres * (0.35 + diff * 0.6);
        gl_FragColor = vec4(col * uStr, 1.0);
      }`
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(58, 64, 48), planetMat);
  const pPos = origin.clone().addScaledVector(T, 210).addScaledVector(R, 95).addScaledVector(U, 28);
  planet.position.copy(pPos);
  planet.rotation.z = 0.35; planet.rotation.x = 0.2;
  group.add(planet);

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
        vec3 col = mix(cB, cC, r) * (0.55 + 0.45 * g);
        gl_FragColor = vec4(col * uStr, a * uStr);
      }`
  });
  const ringGeo = new THREE.RingGeometry(74, 128, 128, 1);
  // remap uv.x to radius for the shader
  { const uv = ringGeo.attributes.uv, pos = ringGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) { const x = pos.getX(i), y = pos.getY(i); uv.setXY(i, (Math.hypot(x, y) - 74) / (128 - 74), 0); } }
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(pPos);
  ring.rotation.set(Math.PI / 2 - 0.42, 0.18, 0.35);
  group.add(ring);

  // atmosphere halo (additive sprite)
  const haloTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), rg = g.createRadialGradient(128, 128, 60, 128, 128, 128);
    rg.addColorStop(0, "rgba(95,227,255,0.55)"); rg.addColorStop(0.45, "rgba(59,130,246,0.22)"); rg.addColorStop(1, "rgba(29,78,216,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.copy(pPos); halo.scale.set(170, 170, 1);
  group.add(halo);

  /* ---- drifting dust ---- */
  const COUNT = isMobile ? 500 : 1400;
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
        gl_FragColor = vec4(mix(cB, cC, vS), a * tw * 0.8 * uStr); }`
  });
  const dust = new THREE.Points(geo, dustMat); dust.frustumCulled = false;
  group.add(dust);

  sky.position.copy(origin).addScaledVector(T, 40);
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
      planet.rotation.y = t * 0.02;
    }
  };
}
window.Space = { make };
})();
