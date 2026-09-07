/* ============================================================================
   THE FLOW — per-station background scenes
   One point-cloud per job, shaped to hint at what the job was.
   Local space: XY = pipe cross-section, -Z = the way the camera travels.
   Each returns { group, update(time, glow, speed) }.  All additive, cheap.
   ========================================================================== */
(function () {
"use strict";
const TAU = Math.PI * 2;
const R = (a, b) => a + Math.random() * (b - a);

function disc() {
  const c = document.createElement("canvas"); c.width = c.height = 48;
  const g = c.getContext("2d"), rg = g.createRadialGradient(24, 24, 0, 24, 24, 24);
  rg.addColorStop(0, "rgba(255,255,255,1)");
  rg.addColorStop(0.4, "rgba(210,230,255,.7)");
  rg.addColorStop(1, "rgba(140,180,255,0)");
  g.fillStyle = rg; g.fillRect(0, 0, 48, 48);
  return new THREE.CanvasTexture(c);
}
const SPRITE = disc();

/* build base positions + a per-point phase, for each mode */
function shape(mode, n) {
  const p = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, z = 0;
    const u = i / n;
    if (mode === "aero") {
      const a = R(0, TAU), r = Math.sqrt(Math.random()) * 2.3;
      x = Math.cos(a) * r; y = Math.sin(a) * r; z = R(-15, 15);
    } else if (mode === "mold") {
      x = R(-2.4, 2.4); y = R(-2.4, 2.4); z = R(-2, 6);
    } else if (mode === "battery") {
      const gx = i % 7, gy = Math.floor(i / 7) % 7;
      x = (gx - 3) * 0.7; y = (gy - 3) * 0.7; z = R(-0.3, 0.3) + ((Math.floor(i / 49)) - 1) * 1.4;
    } else if (mode === "stress") {
      const t = u * TAU * 3;
      x = Math.cos(t) * (1.6 + 0.5 * Math.cos(t * 2));
      y = Math.sin(t) * (1.6 + 0.5 * Math.cos(t * 2));
      z = Math.sin(t * 1.5) * 3;
    } else if (mode === "emotor") {
      const ring = 0.7 + (i % 4) * 0.55, a = R(0, TAU);
      x = Math.cos(a) * ring; y = Math.sin(a) * ring; z = R(-0.4, 0.4);
    } else if (mode === "flux") {
      const line = Math.floor(u * 9), a = (line / 9) * TAU;
      const s = R(-1, 1);
      x = Math.cos(a) * (1.6 + Math.cos(s * 3) * 0.8);
      y = Math.sin(a) * (1.6 + Math.cos(s * 3) * 0.8);
      z = s * 10;
    } else if (mode === "network") {
      const branch = i % 5, a = (branch / 5) * TAU;
      const d = Math.random() * 9;
      x = Math.cos(a) * d * 0.28; y = Math.sin(a) * d * 0.28; z = -d;
    } else if (mode === "iso") {
      const gx = (i % 9) - 4, gy = (Math.floor(i / 9) % 9) - 4;
      x = gx * 0.55 + gy * 0.16; y = gy * 0.42; z = -Math.abs(gx) * 0.5 - 1;
    } else { /* bvs — converging toward a ring far ahead */
      const a = R(0, TAU), r = R(2.2, 3.0);
      x = Math.cos(a) * r; y = Math.sin(a) * r; z = R(-2, 16);
    }
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    ph[i] = Math.random();
  }
  return { p, ph };
}

const VERT = `
  attribute float aPh; varying float vB;
  uniform float uTime, uMode, uSpeed;
  void main(){
    vec3 q = position;
    float b = 0.6;
    if (uMode < 0.5) {                         // aero: brightness band scrolls -Z
      q.z = mod(q.z + 15.0 - uTime*(6.0+uSpeed*30.0), 30.0) - 15.0;
      b = smoothstep(6.0, 0.0, abs(q.z));
    } else if (uMode < 1.5) {                  // mold: fill rising in Y
      float fill = mix(-2.4, 2.4, fract(uTime*0.25));
      b = q.y < fill ? 1.0 : 0.06;
      b *= 0.6 + 0.4*smoothstep(0.4,0.0,abs(q.y-fill));
    } else if (uMode < 2.5) {                  // battery: diagonal pulse sweep
      float w = fract(uTime*0.35 + aPh*0.02);
      float d = (q.x + q.y + 4.0)/8.0;
      b = smoothstep(0.12,0.0,abs(d - w)) + 0.15;
    } else if (uMode < 3.5) {                  // stress: contour ripple along z
      b = 0.3 + 0.7*pow(0.5+0.5*sin(q.z*1.4 - uTime*2.0 + aPh*6.28), 3.0);
    } else if (uMode < 4.5) {                  // emotor: spokes rotating
      float a = atan(q.y, q.x);
      b = 0.25 + 0.75*pow(0.5+0.5*sin(a*6.0 + uTime*3.0), 4.0);
    } else if (uMode < 5.5) {                  // flux: pole-to-pole travel
      float w = fract(q.z*0.05 + 0.5 - uTime*0.35);
      b = smoothstep(0.15,0.0,abs(w-0.5)) + 0.1;
    } else if (uMode < 6.5) {                  // network: pulses down branches
      float d = length(q.xy) + (-q.z);
      float w = fract(uTime*0.5 + aPh);
      b = smoothstep(0.9,0.0,abs(fract(d*0.14) - w)) + 0.12;
    } else if (uMode < 7.5) {                  // iso: progressive reveal
      float front = fract(uTime*0.15)*12.0 - 6.0;
      b = smoothstep(1.5, -1.0, q.x - front) * 0.9 + 0.1;
    } else {                                   // bvs: flow toward ring ahead
      q.z = mod(q.z + 2.0 - uTime*(4.0+uSpeed*20.0), 20.0) - 4.0;
      b = smoothstep(16.0, -2.0, q.z);
    }
    vB = b;
    vec4 mv = modelViewMatrix * vec4(q, 1.0);
    gl_PointSize = clamp((70.0*b) / max(0.5, -mv.z), 1.0, 26.0);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = `
  precision highp float;
  uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity;
  varying float vB;
  void main(){
    float a = texture2D(uMap, gl_PointCoord).a;
    gl_FragColor = vec4(uColor, a * vB * uOpacity);
  }`;

const MODES = { aero:0, mold:1, battery:2, stress:3, emotor:4, flux:5, network:6, iso:7, bvs:8 };

window.SceneFX = {
  make(mode, color) {
    const n = (mode === "network" || mode === "flux") ? 620 : 460;
    const { p, ph } = shape(mode, n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    geo.setAttribute("aPh", new THREE.BufferAttribute(ph, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uMap: { value: SPRITE }, uColor: { value: color.clone() },
        uOpacity: { value: 0 }, uTime: { value: 0 }, uSpeed: { value: 0 },
        uMode: { value: MODES[mode] != null ? MODES[mode] : 0 }
      },
      vertexShader: VERT, fragmentShader: FRAG
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;

    const group = new THREE.Group();
    group.add(pts);

    // a couple of cheap accents
    if (mode === "emotor" || mode === "stress" || mode === "bvs") {
      const ringR = mode === "bvs" ? 2.6 : 2.2;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(ringR, 0.03, 6, 40),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false })
      );
      if (mode === "bvs") ring.position.z = -14;
      group.add(ring);
      group._ring = ring;
    }

    return {
      group,
      update(time, glow, speed) {
        mat.uniforms.uOpacity.value = glow * 0.9;
        mat.uniforms.uTime.value = time;
        mat.uniforms.uSpeed.value = speed;
        if (mode === "emotor") pts.rotation.z = time * 0.6;
        if (mode === "stress") pts.rotation.z = time * 0.15;
        if (group._ring) {
          group._ring.material.opacity = glow * (mode === "bvs" ? 0.8 : 0.4)
            * (0.6 + 0.4 * Math.sin(time * 2.0));
          if (mode === "emotor") group._ring.rotation.z = time * 0.6;
        }
      }
    };
  }
};
})();
