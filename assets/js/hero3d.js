/* ============================================================================
   MH PERSONAL COACHING — hero, 3D model edition
   ---------------------------------------------------------------------------
   Replaces the procedural 2D canvas bag (see hero.js logic inside mh.js,
   left untouched) with the real GLB asset: a boxing bag hanging from a
   procedural chain. WebGL via Three.js, loaded from a CDN through an import
   map (see index.html) — the one real external dependency this project has
   taken on, scoped to this file only.

   The model was re-exported through gltf-transform's optimize pipeline
   before landing here: boxing-bag.glb 5.49 MB -> 0.68 MB.

   (This file previously also carried an animated rope-skipper model
   alongside the bag — removed. Its source .glb had a broken export that
   optimize brought from 145.6 MB down to 27.5 MB, but that was still too
   heavy for mobile, and the whole feature was dropped rather than chased
   further. If it comes back, gltf-transform's optimize+dedup pipeline is
   the place to start.)
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

(function () {
  'use strict';

  var canvas = document.getElementById('hero-canvas-3d');
  if (!canvas) return;
  var hero = canvas.closest('.hero') || canvas.parentElement;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var coarse = window.matchMedia('(hover: none), (pointer: coarse)');
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; } // no WebGL — leave the CSS vignette as a plain dark hero, no crash

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);

  var W = 0, H = 0, dpr = 1;
  var tierCx = 0.72; // fraction of width the rig sits at — matches the 2D hero's tiers

  /* ------------------------------------------------------------- ENVIRONMENT */
  var wall = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 24),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.92, metalness: 0.05 })
  );
  wall.position.set(0, 4, -4);
  wall.receiveShadow = true;
  scene.add(wall);

  var floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 20),
    new THREE.MeshStandardMaterial({ color: 0x060607, roughness: 0.55, metalness: 0.25 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -1.55, 4);
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(new THREE.HemisphereLight(0x2a2620, 0x030303, 0.5));

  var key = new THREE.SpotLight(0xf0dca8, 220, 26, Math.PI / 7, 0.55, 1.4);
  key.position.set(1.1, 7.5, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0015;
  scene.add(key);
  scene.add(key.target);

  var rim = new THREE.PointLight(0xc9a24b, 30, 14, 2);
  rim.position.set(-2.6, 3.2, -1.4);
  scene.add(rim);

  var fill = new THREE.PointLight(0x554430, 8, 12, 2);
  fill.position.set(2.8, 1.4, 3.4);
  scene.add(fill);

  /* -------------------------------------------------------------- DUST */
  var dustCount = coarse.matches ? 26 : 60;
  var dustGeo = new THREE.BufferGeometry();
  var dustPos = new Float32Array(dustCount * 3);
  var dustSeed = [];
  for (var i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.35) * 10;
    dustPos[i * 3 + 1] = Math.random() * 7 - 1;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 6 + 1;
    dustSeed.push({ vy: 0.08 + Math.random() * 0.14, ph: Math.random() * 6.28, sway: 0.15 + Math.random() * 0.2 });
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  var dustMat = new THREE.PointsMaterial({ color: 0xf0dca8, size: 0.028, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  var dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  /* --------------------------------------------------------- BAG RIG (chain) */
  var pivot = new THREE.Group();      // swings — this IS the pendulum
  // Bag bottom needs to hang close enough to the floor to read as grounded —
  // at the original 5.3 anchor it hung 3+ units above an empty floor, which
  // looked like it was floating in a void.
  var anchorY = 4.7, chainLen = 1.55, linkR = 0.052;
  pivot.position.set(0, anchorY, 0);
  scene.add(pivot);

  var ceilingPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.09, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.5, metalness: 0.6 })
  );
  ceilingPlate.castShadow = true;
  pivot.add(ceilingPlate);

  var chainMat = new THREE.MeshStandardMaterial({ color: 0x9a97a0, roughness: 0.32, metalness: 0.92 });
  var LINKS = 6, segLen = chainLen / LINKS;
  for (var l = 0; l < LINKS; l++) {
    var link = new THREE.Mesh(new THREE.TorusGeometry(linkR, linkR * 0.34, 8, 16), chainMat);
    link.position.y = -0.06 - l * segLen;
    link.rotation.x = Math.PI / 2;
    if (l % 2 === 1) link.rotation.y = Math.PI / 2;
    link.castShadow = true;
    pivot.add(link);
  }
  var bagAttachY = -0.06 - LINKS * segLen;

  var bagGroup = new THREE.Group();
  bagGroup.position.y = bagAttachY;
  pivot.add(bagGroup);

  /* ------------------------------------------------------------ LOAD MODEL */
  var loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  var bagReady = false;

  loader.load('assets/models/boxing-bag.glb', function (gltf) {
    var model = gltf.scene;
    model.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    // Scale to a fixed height first, then re-measure and re-centre — simpler
    // and more robust than trying to fold both into one pass.
    var size = new THREE.Vector3(); new THREE.Box3().setFromObject(model).getSize(size);
    model.scale.setScalar(1.9 / Math.max(0.001, size.y));
    var box = new THREE.Box3().setFromObject(model);
    model.position.y = -box.max.y; // top of bag touches the chain's bottom link
    model.position.x = -((box.min.x + box.max.x) / 2);
    model.position.z = -((box.min.z + box.max.z) / 2);
    bagGroup.add(model);
    bagReady = true;
    startWhenReady();
  }, undefined, function (err) { console.warn('[hero3d] boxing bag failed to load', err); });

  /* --------------------------------------------------------------- LAYOUT */
  function layout() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(320, r.width); H = Math.max(420, r.height);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix(); // required after changing .aspect, or the projection matrix stays stale

    var narrow = W < 1000, phone = W < 640;
    tierCx = phone ? 0.55 : (narrow ? 0.66 : 0.72);
    var camX = lerp(-1.4, 1.6, tierCx);
    camera.position.set(camX * 0.4, 1.55, 7.4 - (narrow ? 1.4 : 0));
    camera.lookAt(camX * 0.6, 1.05, 0);

    pivot.position.x = camX * 0.62;
    key.position.x = pivot.position.x - 0.6;
    key.target.position.set(pivot.position.x, 0, 0.4);
    key.target.updateMatrixWorld();
  }

  var ro = new ResizeObserver(layout);
  ro.observe(canvas);

  /* ---------------------------------------------------------- INTERACTION */
  var pointer = { nx: 0, ny: 0, tnx: 0, tny: 0, active: false };
  window.addEventListener('pointermove', function (e) {
    pointer.tnx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.tny = (e.clientY / window.innerHeight) * 2 - 1;
    pointer.active = true;
  }, { passive: true });

  var swingX = 0, swingZ = 0, velX = 0, velZ = 0, t = 0, punchKick = 0;
  hero.addEventListener('pointerdown', function (e) {
    if (e.target.closest('a, button, input, textarea')) return;
    var r = canvas.getBoundingClientRect();
    var proj = pivot.position.clone().add(new THREE.Vector3(0, -1.0, 0)).project(camera);
    var sx = (proj.x * 0.5 + 0.5) * r.width, sy = (1 - (proj.y * 0.5 + 0.5)) * r.height;
    var mx = e.clientX - r.left, my = e.clientY - r.top;
    var d = Math.hypot(mx - sx, my - sy);
    if (d > Math.min(r.width, r.height) * 0.32) return;
    var dir = (mx - sx) >= 0 ? 1 : -1;
    velZ += dir * 2.2;
    velX += (Math.random() - 0.5) * 0.6;
    punchKick = 1;
  });

  /* -------------------------------------------------------------- BOOT/RAF */
  var started = false, visible = true, raf = null;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { rootMargin: '10% 0px' }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () { visible = visible && !document.hidden; });

  function startWhenReady() {
    if (started || !bagReady) return;
    started = true;
    layout();
    if (reduced.matches) { renderer.render(scene, camera); return; } // one still frame, no loop
    tick();
  }

  var last = performance.now();
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!visible) { last = now || performance.now(); return; }
    var dt = Math.min(48, (now || performance.now()) - last) / 16.6667;
    last = now || performance.now();
    t += dt * 0.016;

    pointer.nx = lerp(pointer.nx, pointer.tnx, clamp(0.05 * dt, 0, 1));
    pointer.ny = lerp(pointer.ny, pointer.tny, clamp(0.05 * dt, 0, 1));

    var draught = Math.sin(t * 0.55) * 0.028 + Math.sin(t * 0.21 + 1.3) * 0.018;
    var targetZ = draught + (pointer.active && !coarse.matches ? pointer.nx * 0.10 : 0);
    var targetX = (pointer.active && !coarse.matches ? -pointer.ny * 0.045 : 0);

    var k = 0.10, damp = Math.pow(0.965, dt);
    velZ += (targetZ - swingZ) * k * dt; velZ *= damp; swingZ += velZ * dt;
    velX += (targetX - swingX) * k * dt; velX *= damp; swingX += velX * dt;
    pivot.rotation.z = swingZ;
    pivot.rotation.x = swingX;

    punchKick *= Math.pow(0.9, dt);
    key.intensity = 220 + punchKick * 70;

    var dp = dustGeo.attributes.position.array;
    for (var i = 0; i < dustCount; i++) {
      var s = dustSeed[i];
      dp[i * 3 + 1] += s.vy * 0.01 * dt;
      dp[i * 3] += Math.sin(t + s.ph) * 0.0018 * dt;
      if (dp[i * 3 + 1] > 6) dp[i * 3 + 1] = -1;
    }
    dustGeo.attributes.position.needsUpdate = true;

    // Scroll: fade + drift, matching the 2D hero's exit behaviour.
    var hr = hero.getBoundingClientRect();
    var prog = clamp(-hr.top / Math.max(1, hr.height), 0, 1);
    canvas.style.opacity = String(clamp(1 - prog * 1.15, 0, 1));
    scene.position.y = -prog * 1.6;

    renderer.render(scene, camera);
  }

  startWhenReady(); // no-ops until bagReady flips true
})();
