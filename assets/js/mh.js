/* ============================================================================
   MH PERSONAL COACHING — interaction engine
   ---------------------------------------------------------------------------
   Everything here runs in real time in the browser. No video, no GIFs.
     · hero.js scene  — verlet chain + rigid bag, solved every frame
     · env scene      — back-lit equipment silhouettes on parallax depth layers
     · one rAF ticker  — all scroll-driven work reads a cached scrollY
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------- 0. CONFIG */
  /* Fill these in once and every CTA on the page picks them up.
     Left empty on purpose: no invented contact details. */
  var CONFIG = {
    whatsapp:     '31640893537',        // digits only, no + or spaces (wa.me format)
    email:        'mhmultidiensten@hotmail.com',
    phone:        '+31640893537',       // used for the tel: link
    phoneDisplay: '06 40893537',        // used for the visible text
    mhGymUrl: ''                        // e.g. 'https://www.mhgym.nl'
  };

  /* --------------------------------------------------------------- 1. UTILS */
  var doc = document;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var coarse  = window.matchMedia('(hover: none), (pointer: coarse)');

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* --------------------------------------------------------- 2. RAF TICKER */
  /* One loop for the whole page. Subscribers get (scrollY, dt, frame). */
  var Ticker = {
    subs: [],
    y: window.scrollY || 0,
    dy: 0,
    running: false,
    last: 0,
    add: function (fn) { this.subs.push(fn); return fn; },
    remove: function (fn) { var i = this.subs.indexOf(fn); if (i > -1) this.subs.splice(i, 1); },
    start: function () {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      var self = this;
      (function frame(now) {
        if (!self.running) return;
        var dt = Math.min(48, now - self.last) / 16.6667; // in 60fps units
        self.last = now;
        var y = window.scrollY || window.pageYOffset || 0;
        self.dy = y - self.y;
        self.y = y;
        for (var i = 0; i < self.subs.length; i++) self.subs[i](y, dt);
        requestAnimationFrame(frame);
      })(performance.now());
    },
    stop: function () { this.running = false; }
  };
  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) Ticker.stop(); else Ticker.start();
  });

  /* Shared pointer state, normalised -1..1 plus raw viewport px. */
  var Pointer = { nx: 0, ny: 0, x: 0, y: 0, tnx: 0, tny: 0, active: false, vx: 0 };
  window.addEventListener('pointermove', function (e) {
    Pointer.x = e.clientX; Pointer.y = e.clientY;
    Pointer.tnx = (e.clientX / window.innerWidth) * 2 - 1;
    Pointer.tny = (e.clientY / window.innerHeight) * 2 - 1;
    Pointer.active = true;
  }, { passive: true });
  Ticker.add(function (y, dt) {
    var px = Pointer.nx;
    Pointer.nx = lerp(Pointer.nx, Pointer.tnx, clamp(0.08 * dt, 0, 1));
    Pointer.ny = lerp(Pointer.ny, Pointer.tny, clamp(0.08 * dt, 0, 1));
    Pointer.vx = Pointer.nx - px;
  });

  /* ------------------------------------------------------- 3. HERO SCENE */
  /* A hanging heavy bag: 5 chain links + a rigid bag body, integrated with
     verlet + distance constraints so the secondary motion is real. Forces:
     gravity, air drag, a slow ambient draught, pointer sweep, scroll impulse
     and a punch impulse on click. */
  function HeroScene(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    var W = 0, H = 0, dpr = 1;
    var bg = doc.createElement('canvas');
    var bgx = bg.getContext('2d');

    var LINKS = 5;
    var pts = [];            // 0 = anchor, 1..LINKS = chain, LINKS+1 = bag foot
    var segLen = 0, bagLen = 0, bagW = 0, baseCx = 0;
    var light = { x: 0, y: 0, tx: 0 };
    var dust = [];
    var shake = 0, flash = 0, scrollKick = 0, t = 0;
    var progress = 0;        // 0 at top of page, 1 when hero is scrolled away

    function layout() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(320, r.width); H = Math.max(420, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Three tiers, so the bag never lands behind the headline: full size to
      // the right on desktop, pushed further right and smaller on tablet,
      // small and high on phones (where the copy is bottom-aligned).
      var cx, anchorY, chainSpan;
      if (W >= 1000) {
        cx = W * 0.74; anchorY = -H * 0.06;
        bagLen = clamp(H * 0.34, 150, 340); chainSpan = clamp(H * 0.30, 90, 260);
      } else if (W >= 640) {
        cx = W * 0.80; anchorY = -H * 0.07;
        bagLen = clamp(H * 0.28, 140, 250); chainSpan = clamp(H * 0.24, 80, 190);
      } else {
        cx = W * 0.58; anchorY = -H * 0.10;
        bagLen = clamp(H * 0.20, 110, 190); chainSpan = clamp(H * 0.14, 60, 120);
      }
      bagW = bagLen * 0.42;
      segLen = chainSpan / LINKS;
      baseCx = cx;

      pts.length = 0;
      for (var i = 0; i <= LINKS; i++) {
        pts.push({ x: cx, y: anchorY + i * segLen, px: cx, py: anchorY + i * segLen, im: i === 0 ? 0 : 1 });
      }
      // Bag foot carries the mass: a low inverse mass makes it swing heavily.
      pts.push({ x: cx, y: anchorY + chainSpan + bagLen, px: cx, py: anchorY + chainSpan + bagLen, im: 0.12 });

      // The fixture hangs slightly inboard of the bag, so the highlight falls
      // across the leather instead of straight down it.
      light.x = light.tx = cx - bagW * 0.55; light.y = anchorY + 20;

      var count = coarse.matches ? 26 : 68;
      dust.length = 0;
      for (var d = 0; d < count; d++) {
        dust.push({
          x: rand(0, W), y: rand(0, H), z: rand(0.25, 1),
          r: rand(0.4, 1.5), vx: rand(-0.06, 0.06), vy: rand(-0.16, -0.03),
          a: rand(0.12, 0.6), ph: rand(0, 6.28)
        });
      }
      paintBackdrop();
    }

    /* Static wall + floor is cached once per resize. */
    function paintBackdrop() {
      bg.width = Math.round(W * dpr); bg.height = Math.round(H * dpr);
      bgx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bgx.clearRect(0, 0, W, H);

      var wall = bgx.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, '#0B0B11');
      wall.addColorStop(0.52, '#08080C');
      wall.addColorStop(0.78, '#06060A');
      wall.addColorStop(1, '#040407');
      bgx.fillStyle = wall; bgx.fillRect(0, 0, W, H);

      // Faint wall panelling: vertical seams, wide apart, very low contrast.
      var step = Math.max(150, W / 7);
      bgx.strokeStyle = 'rgba(242,238,230,0.028)';
      bgx.lineWidth = 1;
      for (var x = step * 0.5; x < W; x += step) {
        bgx.beginPath(); bgx.moveTo(Math.round(x) + 0.5, 0); bgx.lineTo(Math.round(x) + 0.5, H * 0.82); bgx.stroke();
      }
      // Floor line + a low, wide reflection band.
      var fy = H * 0.82;
      bgx.strokeStyle = 'rgba(242,238,230,0.06)';
      bgx.beginPath(); bgx.moveTo(0, fy + 0.5); bgx.lineTo(W, fy + 0.5); bgx.stroke();
      var floor = bgx.createLinearGradient(0, fy, 0, H);
      floor.addColorStop(0, 'rgba(201,162,75,0.05)');
      floor.addColorStop(1, 'rgba(4,4,7,0)');
      bgx.fillStyle = floor; bgx.fillRect(0, fy, W, H - fy);
    }

    /* ---- physics ---- */
    function solve(dt) {
      var g = 0.42 * dt;
      var drag = 0.992;
      t += dt * 0.016;

      // Ambient draught: two slow sines so the rhythm never reads as a loop.
      var draught = (Math.sin(t * 0.62) * 0.055 + Math.sin(t * 0.23 + 1.1) * 0.035) * dt;

      for (var i = 1; i < pts.length; i++) {
        var p = pts[i];
        var vx = (p.x - p.px) * drag;
        var vy = (p.y - p.py) * drag;
        p.px = p.x; p.py = p.y;
        p.x += vx; p.y += vy + g;
        if (i === pts.length - 1) {
          p.x += draught * 1.6 + scrollKick * dt;
          if (shake > 0) p.x += rand(-shake, shake) * dt;
        } else {
          p.x += draught * 0.5;
          if (shake > 0) p.x += rand(-shake, shake) * 0.4 * dt;
        }
      }
      shake *= Math.pow(0.9, dt);
      scrollKick *= Math.pow(0.86, dt);
      flash *= Math.pow(0.9, dt);

      // Pointer sweep: air pushed ahead of the cursor nudges the bag.
      if (Pointer.active && !coarse.matches) {
        var foot = pts[pts.length - 1], head = pts[LINKS];
        var bcx = (foot.x + head.x) * 0.5, bcy = (foot.y + head.y) * 0.5;
        var r = canvas.getBoundingClientRect();
        var mx = Pointer.x - r.left, my = Pointer.y - r.top;
        var dx = bcx - mx, dy = bcy - my;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var reach = bagLen * 1.5;
        if (dist < reach) {
          var fall = (1 - dist / reach);
          var push = (dx > 0 ? 1 : -1) * fall * fall * 0.5 * dt;
          push += Pointer.vx * fall * 14 * dt;      // sweeping across shoves it
          foot.x += push; head.x += push * 0.35;
        }
      }

      // Distance constraints, weighted by inverse mass. Anchor never moves.
      var iter = coarse.matches ? 4 : 6;
      for (var k = 0; k < iter; k++) {
        for (var j = 0; j < pts.length - 1; j++) {
          var a = pts[j], b = pts[j + 1];
          var want = (j === pts.length - 2) ? bagLen : segLen;
          var ddx = b.x - a.x, ddy = b.y - a.y;
          var d = Math.sqrt(ddx * ddx + ddy * ddy) || 0.0001;
          var diff = (d - want) / d;
          var sum = a.im + b.im; if (sum === 0) continue;
          var ax = ddx * diff * (a.im / sum), ay = ddy * diff * (a.im / sum);
          var bxx = ddx * diff * (b.im / sum), byy = ddy * diff * (b.im / sum);
          a.x += ax; a.y += ay; b.x -= bxx; b.y -= byy;
        }
      }
    }

    function punch(mx, my) {
      var foot = pts[pts.length - 1], head = pts[LINKS];
      var bcx = (foot.x + head.x) * 0.5, bcy = (foot.y + head.y) * 0.5;
      var dx = bcx - mx, dy = bcy - my;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > bagLen * 1.05) return false;
      var f = clamp(1 - d / (bagLen * 1.05), 0.25, 1) * 3.4;
      foot.x += (dx / d) * f; foot.y += (dy / d) * f * 0.22;
      head.x += (dx / d) * f * 0.3;
      shake = 1.5; flash = 1;
      for (var i = 0; i < 14; i++) {
        dust.push({
          x: mx + rand(-14, 14), y: my + rand(-14, 14), z: rand(0.7, 1),
          r: rand(0.5, 1.8), vx: rand(-1.4, 1.4), vy: rand(-1.1, 0.3),
          a: rand(0.4, 0.9), ph: rand(0, 6.28), life: 1
        });
      }
      return true;
    }

    /* ---- painting ---- */
    function cone(ox) {
      // Volumetric shaft from the ceiling fixture.
      var lx = light.x + ox, top = light.y, bottom = H * 0.9;
      var spread = W * 0.30;
      var grd = ctx.createLinearGradient(lx, top, lx, bottom);
      grd.addColorStop(0, 'rgba(240,220,168,0.16)');
      grd.addColorStop(0.42, 'rgba(201,162,75,0.055)');
      grd.addColorStop(1, 'rgba(201,162,75,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(lx - 26, top); ctx.lineTo(lx + 26, top);
      ctx.lineTo(lx + spread, bottom); ctx.lineTo(lx - spread, bottom);
      ctx.closePath(); ctx.fill();

      // Fixture bloom + floor pool.
      var bloom = ctx.createRadialGradient(lx, top + 10, 0, lx, top + 10, 190);
      bloom.addColorStop(0, 'rgba(240,220,168,' + (0.22 + flash * 0.2) + ')');
      bloom.addColorStop(1, 'rgba(240,220,168,0)');
      ctx.fillStyle = bloom; ctx.beginPath(); ctx.arc(lx, top + 10, 190, 0, 6.2832); ctx.fill();
      ctx.restore();

      var pool = ctx.createRadialGradient(lx, H * 0.84, 0, lx, H * 0.84, W * 0.34);
      pool.addColorStop(0, 'rgba(201,162,75,0.085)');
      pool.addColorStop(1, 'rgba(201,162,75,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = pool;
      ctx.beginPath(); ctx.ellipse(lx, H * 0.845, W * 0.34, H * 0.075, 0, 0, 6.2832); ctx.fill();
      ctx.restore();
    }

    function chain(ox, oy) {
      ctx.save();
      ctx.translate(ox, oy);

      // Ceiling plate + swivel.
      var a = pts[0];
      ctx.fillStyle = '#191920';
      ctx.fillRect(a.x - 34, a.y - 8, 68, 14);
      ctx.strokeStyle = 'rgba(242,238,230,0.14)'; ctx.lineWidth = 1;
      ctx.strokeRect(a.x - 34.5, a.y - 8.5, 69, 15);

      for (var i = 0; i < LINKS; i++) {
        var p = pts[i], q = pts[i + 1];
        var mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        var ang = Math.atan2(q.y - p.y, q.x - p.x) - Math.PI / 2;
        var len = Math.sqrt(Math.pow(q.x - p.x, 2) + Math.pow(q.y - p.y, 2));
        var edgeOn = i % 2 === 1;          // alternate links turn 90°
        var rx = edgeOn ? 3.4 : segLen * 0.20;
        ctx.save();
        ctx.translate(mx, my); ctx.rotate(ang);
        var g = ctx.createLinearGradient(-rx, 0, rx, 0);
        g.addColorStop(0, '#2A2A32');
        g.addColorStop(0.32, '#8E8C93');
        g.addColorStop(0.5, '#C9C6CC');
        g.addColorStop(0.72, '#5A5860');
        g.addColorStop(1, '#1C1C22');
        ctx.strokeStyle = g;
        ctx.lineWidth = edgeOn ? 4.2 : 3.4;
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(2.2, rx), len * 0.52, 0, 0, 6.2832);
        ctx.stroke();
        // A single warm glint per link — brass light on steel.
        ctx.strokeStyle = 'rgba(240,220,168,0.32)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(-rx * 0.28, -len * 0.1, Math.max(1.2, rx * 0.45), len * 0.3, 0, -1.1, 0.9); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    function bag(ox, oy) {
      var head = pts[LINKS], foot = pts[pts.length - 1];
      var ang = Math.atan2(foot.y - head.y, foot.x - head.x) - Math.PI / 2;
      var cx = (head.x + foot.x) / 2 + ox, cy = (head.y + foot.y) / 2 + oy;
      var w = bagW, h = bagLen, hw = w / 2, hh = h / 2;

      // Contact shadow: tracks the bag, squashes as it swings away from centre.
      var fy = H * 0.845;
      var offs = (cx - (light.x + ox)) * 0.28;
      ctx.save();
      var sh = ctx.createRadialGradient(cx - offs, fy, 0, cx - offs, fy, w * 1.5);
      sh.addColorStop(0, 'rgba(2,2,4,0.75)');
      sh.addColorStop(1, 'rgba(2,2,4,0)');
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.ellipse(cx - offs, fy, w * 1.5, w * 0.34, 0, 0, 6.2832); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(ang);

      // Body: leather cylinder. Highlight sits on the side facing the fixture.
      var toLight = clamp((light.x + ox - cx) / (W * 0.5), -1, 1);
      var hi = clamp(0.5 - toLight * 0.26, 0.18, 0.82);
      var body = ctx.createLinearGradient(-hw, 0, hw, 0);
      body.addColorStop(0, '#08080B');
      body.addColorStop(Math.max(0.02, hi - 0.34), '#131318');
      body.addColorStop(hi, '#33323A');
      body.addColorStop(Math.min(0.96, hi + 0.2), '#1A1A20');
      body.addColorStop(1, '#06060A');
      roundRect(-hw, -hh, w, h, w * 0.30);
      ctx.fillStyle = body; ctx.fill();

      // Vertical sheen streak — brushed leather catching the shaft.
      var streak = ctx.createLinearGradient(-hw, 0, hw, 0);
      streak.addColorStop(Math.max(0, hi - 0.1), 'rgba(240,220,168,0)');
      streak.addColorStop(hi, 'rgba(240,220,168,' + (0.09 + flash * 0.12) + ')');
      streak.addColorStop(Math.min(1, hi + 0.1), 'rgba(240,220,168,0)');
      ctx.fillStyle = streak; roundRect(-hw, -hh, w, h, w * 0.30); ctx.fill();

      // Rim light on the shaded edge keeps the silhouette off the wall.
      ctx.strokeStyle = 'rgba(201,162,75,0.30)'; ctx.lineWidth = 1.2;
      roundRect(-hw + 0.6, -hh + 0.6, w - 1.2, h - 1.2, w * 0.29); ctx.stroke();

      // Stitched seams top and bottom.
      ctx.strokeStyle = 'rgba(242,238,230,0.08)'; ctx.lineWidth = 1;
      seam(-hh + h * 0.13, w); seam(hh - h * 0.13, w);

      // Top cap: steel plate with four D-rings feeding the chain.
      ctx.save();
      ctx.beginPath(); roundRect(-hw, -hh, w, h * 0.1, w * 0.28); ctx.clip();
      var cap = ctx.createLinearGradient(-hw, 0, hw, 0);
      cap.addColorStop(0, '#191920'); cap.addColorStop(hi, '#6E6C74'); cap.addColorStop(1, '#131318');
      ctx.fillStyle = cap; ctx.fillRect(-hw, -hh, w, h * 0.1);
      ctx.restore();
      ctx.strokeStyle = 'rgba(242,238,230,0.16)';
      ctx.beginPath(); ctx.moveTo(-hw + 2, -hh + h * 0.1); ctx.lineTo(hw - 2, -hh + h * 0.1); ctx.stroke();

      // Engraving: gold, cut into the leather, bowed to follow the cylinder.
      curvedText('MH', 0, -h * 0.055, w * 0.42, 800, hw, 0.9, w * 0.62);
      curvedText('PERSONAL COACHING', 0, h * 0.035, w * 0.11, 600, hw, 0.62, w * 0.80);
      ctx.restore();
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function seam(y, w) {
      ctx.save(); ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(-w / 2 + 6, y); ctx.lineTo(w / 2 - 6, y); ctx.stroke();
      ctx.restore();
    }
    /* Per-character bow fakes text wrapping around the cylinder. The label is
       fitted to maxW so the engraving never runs off the leather. */
    function curvedText(str, cx0, cy0, size, weight, hw, alpha, maxW) {
      ctx.save();
      var face = ' "Archivo", "Helvetica Neue", Arial, sans-serif';
      var chars = str.split('');
      var track, widths, total;
      function measure() {
        ctx.font = weight + ' ' + size.toFixed(1) + 'px' + face;
        track = size * 0.10;
        widths = chars.map(function (c) { return ctx.measureText(c).width + track; });
        total = widths.reduce(function (a, b) { return a + b; }, 0) - track;
      }
      measure();
      if (maxW && total > maxW) { size *= maxW / total; measure(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var x = cx0 - total / 2;
      for (var i = 0; i < chars.length; i++) {
        var cw = widths[i];
        var px = x + cw / 2;
        var k = clamp((px - cx0) / hw, -1, 1);
        var bow = k * k * size * 0.16;                 // sag toward the edges
        var fade = 1 - Math.abs(k) * 0.42;             // edges turn away
        ctx.save();
        ctx.translate(px, cy0 + bow);
        ctx.scale(1 - Math.abs(k) * 0.2, 1);           // foreshortening
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(chars[i], 0, 1.4);                 // debossed edge
        ctx.fillStyle = 'rgba(240,220,168,' + (alpha * fade).toFixed(3) + ')';
        ctx.fillText(chars[i], 0, 0);
        ctx.restore();
        x += cw;
      }
      ctx.restore();
    }

    function motes(ox, front) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = dust.length - 1; i >= 0; i--) {
        var d = dust[i];
        if (front ? d.z < 0.62 : d.z >= 0.62) continue;
        var x = d.x + ox * d.z * 2.4, y = d.y;
        var inShaft = 1 - clamp(Math.abs(x - (light.x + ox)) / (W * 0.26), 0, 1);
        var a = d.a * (0.16 + inShaft * 0.9) * (d.life === undefined ? 1 : d.life);
        ctx.fillStyle = 'rgba(240,220,168,' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x, y, d.r * (0.6 + d.z * 0.8), 0, 6.2832); ctx.fill();
      }
      ctx.restore();
    }

    function stepMotes(dt) {
      for (var i = dust.length - 1; i >= 0; i--) {
        var d = dust[i];
        d.ph += 0.012 * dt;
        d.x += (d.vx + Math.sin(d.ph) * 0.12) * dt;
        d.y += d.vy * dt;
        if (d.life !== undefined) {
          d.life -= 0.012 * dt; d.vy += 0.012 * dt;
          if (d.life <= 0) { dust.splice(i, 1); continue; }
        }
        if (d.y < -10) { d.y = H + 8; d.x = rand(0, W); }
        if (d.x < -10) d.x = W + 8; else if (d.x > W + 10) d.x = -8;
      }
    }

    function draw(dt) {
      // Depth parallax: layers answer the pointer at different rates.
      var px = Pointer.nx, py = Pointer.ny;
      var sceneY = -progress * H * 0.42;
      var wallOx = px * 8, midOx = px * 20, bagOx = px * 30;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#040407'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(bg, wallOx - 8, sceneY * 0.28 + py * 4 - 4, W + 16, H + 8);

      light.tx = baseCx - bagW * 0.55 + px * 26;
      light.x = lerp(light.x, light.tx, clamp(0.05 * dt, 0, 1));

      cone(midOx * 0.4);
      motes(midOx, false);

      var fade = 1 - clamp((progress - 0.25) / 0.6, 0, 1);
      ctx.globalAlpha = clamp(fade, 0, 1);
      chain(bagOx, sceneY);
      bag(bagOx, sceneY);
      ctx.globalAlpha = 1;

      motes(bagOx * 1.3, true);
    }

    /* ---- lifecycle ---- */
    var hero = canvas.closest('.hero') || canvas.parentElement;
    var visible = true;
    var stillDrawn = false;
    var tick = function (y, dt) {
      var r = hero.getBoundingClientRect();
      progress = clamp(-r.top / Math.max(1, r.height), 0, 1);
      if (!visible) return;
      // Reduced motion: one still frame of the same scene, no loop.
      if (reduced.matches) { if (!stillDrawn) { progress = 0; draw(1); stillDrawn = true; } return; }
      if (Math.abs(Ticker.dy) > 0.5) scrollKick += clamp(Ticker.dy, -40, 40) * 0.0016;
      solve(dt); stepMotes(dt);
      draw(dt);
    };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
      }, { rootMargin: '10% 0px' }).observe(canvas);
    }

    hero.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a, button, input, textarea')) return;
      var r = canvas.getBoundingClientRect();
      punch(e.clientX - r.left, e.clientY - r.top);
    });
    // Touch drag swings the bag directly — the mobile equivalent of a sweep.
    hero.addEventListener('touchmove', function (e) {
      if (!e.touches.length) return;
      var r = canvas.getBoundingClientRect();
      var mx = e.touches[0].clientX - r.left;
      var foot = pts[pts.length - 1], head = pts[LINKS];
      var bcx = (foot.x + head.x) * 0.5;
      if (Math.abs(bcx - mx) < bagW * 2.2) { foot.x += clamp((mx - bcx) * 0.05, -1.6, 1.6); }
    }, { passive: true });

    var ro = new ResizeObserver(function () { layout(); stillDrawn = false; });
    ro.observe(canvas);
    layout();
    Ticker.add(tick);

    // Settle the chain before the first paint so it never drops into frame.
    if (!reduced.matches) for (var w = 0; w < 90; w++) solve(1);
    return { punch: punch, layout: layout };
  }

  /* -------------------------------------------------- 4. ENVIRONMENT SCENE */
  /* Back-lit equipment: near-black silhouettes with a brass rim, arranged on
     depth layers. Two bags run their own damped pendulums. */
  function EnvScene(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    var W = 0, H = 0, dpr = 1, t = 0;
    // Both bags hang clear of the floor line so nothing intersects.
    var bags = [
      { z: 0.5, x: 0.30, len: 0.17, w: 0.050, a: 0.06, v: 0, ph: 0.0 },
      { z: 1.0, x: 0.83, len: 0.24, w: 0.075, a: -0.04, v: 0, ph: 1.7 }
    ];
    var FLOOR = 0.48;      // the equipment sits above the copy, not behind it
    var motes = [];

    function layout() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(320, r.width); H = Math.max(360, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = coarse.matches ? 18 : 44;
      motes.length = 0;
      for (var i = 0; i < n; i++) {
        motes.push({ x: rand(0, W), y: rand(0, H), z: rand(0.3, 1), r: rand(0.4, 1.3), vy: rand(-0.14, -0.02), a: rand(0.1, 0.5) });
      }
    }

    function rim(path, fill) {
      ctx.fillStyle = fill || '#040406';
      path(); ctx.fill();
      ctx.strokeStyle = 'rgba(201,162,75,0.28)'; ctx.lineWidth = 1;
      path(); ctx.stroke();
    }

    function plateStack(x, y, s) {
      // Rack upright with plates loaded — read as circles edge-on.
      rim(function () { ctx.beginPath(); ctx.rect(x - 3 * s, y - 78 * s, 6 * s, 78 * s); });
      for (var i = 0; i < 4; i++) {
        var rr = (26 - i * 4) * s, yy = y - (10 + i * 19) * s;
        rim(function () { ctx.beginPath(); ctx.ellipse(x, yy, 5.5 * s, rr, 0, 0, 6.2832); });
      }
    }
    function kettlebell(x, y, s) {
      rim(function () {
        ctx.beginPath();
        ctx.arc(x, y - 15 * s, 17 * s, 0, 6.2832);
      });
      ctx.strokeStyle = 'rgba(201,162,75,0.34)'; ctx.lineWidth = 4.5 * s;
      ctx.beginPath(); ctx.arc(x, y - 34 * s, 11 * s, Math.PI * 1.06, Math.PI * 1.94); ctx.stroke();
      ctx.strokeStyle = '#040406'; ctx.lineWidth = 2.6 * s;
      ctx.beginPath(); ctx.arc(x, y - 34 * s, 11 * s, Math.PI * 1.06, Math.PI * 1.94); ctx.stroke();
    }
    function dumbbell(x, y, s) {
      rim(function () { ctx.beginPath(); ctx.rect(x - 30 * s, y - 4 * s, 60 * s, 8 * s); });
      rim(function () { ctx.beginPath(); ctx.rect(x - 44 * s, y - 15 * s, 15 * s, 30 * s); });
      rim(function () { ctx.beginPath(); ctx.rect(x + 29 * s, y - 15 * s, 15 * s, 30 * s); });
    }
    function bench(x, y, s) {
      rim(function () { ctx.beginPath(); ctx.rect(x - 60 * s, y - 30 * s, 120 * s, 11 * s); });
      rim(function () { ctx.beginPath(); ctx.rect(x - 50 * s, y - 19 * s, 9 * s, 19 * s); });
      rim(function () { ctx.beginPath(); ctx.rect(x + 41 * s, y - 19 * s, 9 * s, 19 * s); });
      // Gloves resting on the pad.
      rim(function () { ctx.beginPath(); ctx.ellipse(x + 18 * s, y - 38 * s, 13 * s, 9 * s, -0.25, 0, 6.2832); });
      rim(function () { ctx.beginPath(); ctx.ellipse(x + 34 * s, y - 36 * s, 13 * s, 9 * s, 0.2, 0, 6.2832); });
    }
    function ropeCoil(x, y, s) {
      ctx.strokeStyle = 'rgba(201,162,75,0.26)'; ctx.lineWidth = 3.4 * s;
      for (var i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.ellipse(x, y - i * 5 * s, (28 - i * 4) * s, (9 - i * 1.4) * s, 0, 0, 6.2832); ctx.stroke();
      }
    }
    function hangingBag(b, ox) {
      var ax = W * b.x + ox * b.z, ay = -H * 0.04;
      var len = H * b.len, w = H * b.w;
      var cx = ax + Math.sin(b.a) * len, cy = ay + Math.cos(b.a) * len;
      ctx.save();
      // Chain.
      ctx.strokeStyle = 'rgba(201,162,75,0.30)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.translate(cx, cy); ctx.rotate(b.a);
      var h = len * 0.86;
      var body = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      body.addColorStop(0, '#040406'); body.addColorStop(0.5, '#0B0B10'); body.addColorStop(1, '#040406');
      ctx.fillStyle = body;
      ctx.beginPath();
      var r = w * 0.3, x = -w / 2, y = 0;
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(201,162,75,0.36)'; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.restore();
    }

    function draw(dt) {
      t += dt * 0.016;
      var ox = Pointer.nx * 26, oy = Pointer.ny * 10;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, W, H);

      // The back wall glow that turns everything in front into a silhouette.
      var gx = W * 0.5 + ox * 0.6, gy = H * (FLOOR - 0.12) + oy;
      var glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, W * 0.6);
      glow.addColorStop(0, 'rgba(201,162,75,0.20)');
      glow.addColorStop(0.42, 'rgba(201,162,75,0.06)');
      glow.addColorStop(1, 'rgba(5,5,8,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

      var fy = H * FLOOR;
      ctx.strokeStyle = 'rgba(201,162,75,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, fy + 0.5); ctx.lineTo(W, fy + 0.5); ctx.stroke();
      var refl = ctx.createLinearGradient(0, fy, 0, H * 0.9);
      refl.addColorStop(0, 'rgba(201,162,75,0.08)'); refl.addColorStop(1, 'rgba(5,5,8,0)');
      ctx.fillStyle = refl; ctx.fillRect(0, fy, W, H * 0.9 - fy);

      // Scale with width so the equipment fills the frame at any size.
      var s = clamp(W / 760, 0.85, 1.9);
      // Far layer — moves least.
      hangingBag(bags[0], ox * 0.45);
      plateStack(W * 0.085 + ox * 0.5, fy, s * 1.05);
      ropeCoil(W * 0.46 + ox * 0.5, fy - 1, s);
      // Near layer.
      bench(W * 0.235 + ox, fy, s);
      kettlebell(W * 0.545 + ox * 1.2, fy, s);
      kettlebell(W * 0.615 + ox * 1.2, fy, s * 0.78);
      dumbbell(W * 0.775 + ox * 1.3, fy - 5 * s, s * 0.95);
      hangingBag(bags[1], ox);

      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.y += m.vy * dt; if (m.y < -6) { m.y = H + 6; m.x = rand(0, W); }
        ctx.fillStyle = 'rgba(240,220,168,' + (m.a * 0.5).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(m.x + ox * m.z, m.y, m.r, 0, 6.2832); ctx.fill();
      }
      ctx.restore();
    }

    function swing(dt) {
      for (var i = 0; i < bags.length; i++) {
        var b = bags[i];
        // Damped pendulum with a slow driving breath, so it never fully stills.
        var drive = Math.sin(t * 0.5 + b.ph) * 0.00022 + Math.sin(t * 0.19 + b.ph) * 0.00014;
        b.v += (-b.a * 0.0016 + drive) * dt;
        b.v *= Math.pow(0.995, dt);
        b.a += b.v * dt;
      }
    }

    var visible = false, stillDrawn = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { rootMargin: '15% 0px' }).observe(canvas);
    } else { visible = true; }
    new ResizeObserver(function () { layout(); stillDrawn = false; }).observe(canvas);
    layout();
    Ticker.add(function (y, dt) {
      if (!visible) return;
      if (reduced.matches) { if (!stillDrawn) { draw(1); stillDrawn = true; } return; }
      swing(dt);
      draw(dt);
    });
    return true;
  }

  /* ------------------------------------------------------------ 5. REVEALS */
  function initReveals() {
    var items = $$('[data-reveal], .stmt');
    if (!('IntersectionObserver' in window) || reduced.matches) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* Cards light up under the cursor — one delegated listener for the page. */
  function initCardLight() {
    if (coarse.matches) return;
    doc.addEventListener('pointermove', function (e) {
      var card = e.target.closest ? e.target.closest('.card') : null;
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  }

  function initPointerLight() {
    var el = $('.pointer-light');
    if (!el || coarse.matches || reduced.matches) return;
    var x = window.innerWidth / 2, y = window.innerHeight / 2;
    window.addEventListener('pointermove', function () { el.classList.add('is-live'); }, { once: true });
    Ticker.add(function (sy, dt) {
      x = lerp(x, Pointer.x, clamp(0.055 * dt, 0, 1));
      y = lerp(y, Pointer.y, clamp(0.055 * dt, 0, 1));
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    });
  }

  /* --------------------------------------------------------- 6. NAVIGATION */
  function initNav() {
    var nav = $('.nav'), burger = $('.burger'), menu = $('#menu');
    var lastY = window.scrollY, open = false;

    Ticker.add(function (y) {
      nav.classList.toggle('is-stuck', y > 24);
      // Hide on the way down, bring it back the moment you scroll up.
      if (!open) nav.classList.toggle('is-hidden', y > 560 && y > lastY + 4);
      if (Math.abs(y - lastY) > 4) lastY = y;
    });

    function setOpen(v) {
      open = v;
      burger.setAttribute('aria-expanded', String(v));
      menu.classList.toggle('is-open', v);
      doc.documentElement.classList.toggle('mh-lock', v);
      if (v) nav.classList.remove('is-hidden');
    }
    burger.addEventListener('click', function () { setOpen(!open); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setOpen(false); });

    // Current-section marker in the nav.
    var links = $$('.nav__link');
    var map = {};
    links.forEach(function (l) {
      var id = l.getAttribute('href').replace('#', '');
      var sec = doc.getElementById(id);
      if (sec) map[id] = { link: l, sec: sec };
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var rec = map[en.target.id];
          if (rec) rec.link.classList.toggle('is-current', en.isIntersecting);
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (k) { io.observe(map[k].sec); });
    }

    // Thumb bar appears once the hero is behind you.
    var bar = $('.thumb-bar');
    if (bar) Ticker.add(function (y) { bar.classList.toggle('is-up', y > window.innerHeight * 0.85); });
  }

  /* -------------------------------------------------------- 7. HERO COPY */
  /* Type and the bag part company as you scroll: the copy lifts and fades,
     the scene drifts out of frame. */
  function initHeroParallax() {
    var inner = $('.hero__inner'), foot = $('.hero__foot'), hero = $('.hero');
    if (!inner || reduced.matches) return;
    Ticker.add(function (y) {
      var r = hero.getBoundingClientRect();
      var p = clamp(-r.top / Math.max(1, r.height), 0, 1);
      inner.style.transform = 'translate3d(0,' + (-p * 90).toFixed(1) + 'px,0)';
      inner.style.opacity = String(clamp(1 - p * 1.9, 0, 1));
      if (foot) foot.style.opacity = String(clamp(1 - p * 2.6, 0, 1));
    });
  }

  /* ------------------------------------------------------------- 8. GOALS */
  var GOALS = {
    afvallen: {
      claim: 'Niet alleen meer bewegen.',
      body: 'Persoonlijke training, voedingsbegeleiding, maandelijkse metingen en continue coaching. We bouwen in een tempo dat je vol kunt houden — geen crashdieet, maar een aanpak die blijft werken als het traject voorbij is.',
      list: ['Vetverlies met behoud van spiermassa', 'Voedingsadvies rond jouw dagritme', 'Maandelijkse lichaamsmeting', 'Wekelijks bijsturen op basis van data']
    },
    kickboksen: {
      claim: 'Techniek voor techniek. Zonder publiek.',
      body: 'Van eerste stoot tot volledige combinaties. Je leert kickboksen in een besloten setting, waar fouten maken hoort bij het proces en je coach elke beweging corrigeert voordat die een gewoonte wordt.',
      list: ['Basis: stand, garde, verplaatsing', 'Stoot- en traptechniek', 'Pad- en zakwerk 1-op-1', 'Conditie die bij de sport hoort']
    },
    boksen: {
      claim: 'Zuivere techniek. Volle aandacht.',
      body: 'Boksen is precisie voordat het kracht is. Je bouwt voetenwerk, timing en verdediging op in een tempo dat bij jou past — met directe correctie in plaats van een spiegel en hoop.',
      list: ['Voetenwerk en balans', 'Combinaties en timing', 'Verdediging en ringinzicht', 'Pads en zakwerk op jouw niveau']
    },
    spiergroei: {
      claim: 'Opbouwen met een plan. Niet met gokwerk.',
      body: 'Spiergroei is het resultaat van progressieve belasting, uitvoering en voldoende eten. Alle drie worden vastgelegd, gemeten en aangepast zolang je traject loopt.',
      list: ['Progressive overload per spiergroep', 'Techniek onder gewicht', 'Eiwit- en caloriebegeleiding', 'Volume en herstel in balans']
    },
    kracht: {
      claim: 'Sterker worden zonder je adem te verliezen.',
      body: 'Kracht en conditie hoeven niet met elkaar te concurreren. Je plan combineert zware basisoefeningen met werk dat je hartslag opbouwt, zonder dat het één het ander opeet.',
      list: ['Squat, deadlift, press — technisch schoon', 'Kracht-uithoudingsvermogen', 'Explosiviteit en core-stabiliteit', 'Herstel als onderdeel van het plan']
    },
    fitter: {
      claim: 'Terug in vorm. In jouw tempo.',
      body: 'Een rustige, veilige opbouw voor wie lang niet getraind heeft of terugkomt na een blessure. Het startpunt is waar jij nu staat — niet waar een standaard schema begint.',
      list: ['Rustige, veilige opbouw', 'Mobiliteit en stabiliteit eerst', 'Meetbare voortgang per maand', 'Rekening met blessures en beperkingen']
    }
  };

  function initGoals() {
    var grid = $('.goals');
    if (!grid) return;
    var panel = $('.goal-panel');
    var cards = $$('.goal', grid);
    var current = null;

    function cols() {
      return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    }

    function close() {
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      grid.classList.remove('has-active');
      cards.forEach(function (c) { c.classList.remove('is-active'); c.setAttribute('aria-expanded', 'false'); });
      current = null;
    }

    function open(card) {
      var key = card.dataset.goal;
      var data = GOALS[key];
      if (!data) return;
      var idx = cards.indexOf(card);
      var n = cols();
      // Drop the panel after the last card in the clicked card's row, so the
      // rows below are pushed down smoothly instead of jumping.
      var afterIdx = Math.min(cards.length - 1, (Math.floor(idx / n) + 1) * n - 1);
      grid.insertBefore(panel, cards[afterIdx].nextSibling);

      $('.goal-panel__name', panel).textContent = card.querySelector('.goal__name').textContent;
      $('.goal-panel__claim', panel).textContent = data.claim;
      $('.goal-panel__body', panel).textContent = data.body;
      var ul = $('.goal-panel__list', panel);
      ul.innerHTML = '';
      data.list.forEach(function (item) {
        var li = doc.createElement('li');
        li.appendChild(doc.createElement('span')).textContent = item;
        ul.appendChild(li);
      });
      $('.goal-panel__cta', panel).dataset.goal = key;

      cards.forEach(function (c) {
        var on = c === card;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-expanded', String(on));
      });
      grid.classList.add('has-active');
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      current = card;
    }

    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        if (current === card) close(); else open(card);
      });
    });
    $('.goal-panel__close', panel).addEventListener('click', function () {
      if (current) { var c = current; close(); c.focus(); }
    });
    // Reflow the panel to the right row when the column count changes.
    window.addEventListener('resize', function () { if (current) open(current); });

    // "Dit is mijn doel" carries the choice into the intake.
    $('.goal-panel__cta', panel).addEventListener('click', function () {
      var key = this.dataset.goal;
      var opt = $('.opt[data-goal="' + key + '"]');
      if (opt) opt.click();
      var target = doc.getElementById('intake');
      if (target) target.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
    });
  }

  /* ------------------------------------------------------ 8.5 COACH CAROUSEL */
  var COACHES = [
    {
      name: 'Joep Bruinsma',
      nickname: 'The Technician',
      quote: 'Joep haalt het beste uit je door goed te kijken en te analyseren.',
      bio: 'Waar zit de ruimte in jouw techniek, en hoe bouwen we die stap voor ' +
        'stap op? Met geduld en een scherp oog voor detail werkt hij met je aan ' +
        'techniek — of je nu net begint of je niveau verder wil aanscherpen. ' +
        'Naast Personal Training en kickboksen traint hij ook MMA en de kids.',
      disciplines: ['Personal Training', 'Kickboksen', 'MMA', 'Kids Trainingen'],
      strengths: ['Technische vaardigheid', 'Analytisch vermogen', 'Geduldig', 'Techniekopbouw', 'Kids & jeugd']
    },
    {
      // Real second coach, not yet confirmed for the live site — no invented
      // bio or strengths here. Swap this in once name/photo/bio are final.
      name: 'Binnenkort',
      nickname: '',
      quote: '',
      bio: 'Onze tweede coach wordt binnenkort aan dit team toegevoegd — inclusief foto, disciplines en sterke punten.',
      disciplines: ['Binnenkort bekend'],
      strengths: ['Binnenkort bekend']
    }
  ];

  function initCoachCarousel() {
    var frame = $('#coach-frame'), track = $('#coach-track'), dotsWrap = $('#coach-dots');
    var info = $('#coach-info');
    var nameEl = $('#coach-name'), nickEl = $('#coach-nickname'), quoteEl = $('#coach-quote'), bioEl = $('#coach-bio');
    var discEl = $('#coach-disciplines'), strEl = $('#coach-strengths');
    var prevBtn = $('.coach__arrow[data-dir="-1"]'), nextBtn = $('.coach__arrow[data-dir="1"]');
    if (!frame || !track || !dotsWrap) return;

    var n = COACHES.length;
    var index = 0;

    dotsWrap.innerHTML = '';
    COACHES.forEach(function (c, i) {
      var dot = doc.createElement('button');
      dot.type = 'button';
      dot.className = 'coach__dot';
      dot.setAttribute('aria-label', c.name || ('Coach ' + (i + 1)));
      dot.addEventListener('click', function () { goTo(i); });
      dotsWrap.appendChild(dot);
    });
    var dots = $$('.coach__dot', dotsWrap);

    function fillChips(el, items, gold) {
      el.innerHTML = '';
      items.forEach(function (t) {
        var span = doc.createElement('span');
        span.className = gold ? 'chip chip--gold' : 'chip';
        span.textContent = t;
        el.appendChild(span);
      });
    }

    function render() {
      var c = COACHES[index];
      nameEl.textContent = c.name;
      // .chip/.coach__quote set their own `display`, which ties the UA
      // stylesheet's [hidden] rule on specificity and loses to it on source
      // order — an inline style is the one thing guaranteed to win.
      nickEl.style.display = c.nickname ? '' : 'none';
      if (c.nickname) nickEl.textContent = c.nickname;
      quoteEl.style.display = c.quote ? '' : 'none';
      if (c.quote) quoteEl.textContent = c.quote;
      bioEl.textContent = c.bio;
      fillChips(discEl, c.disciplines, false);
      fillChips(strEl, c.strengths, true);
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); });
      if (prevBtn) prevBtn.setAttribute('aria-disabled', String(index === 0));
      if (nextBtn) nextBtn.setAttribute('aria-disabled', String(index === n - 1));
    }

    function moveTrack(offsetPx) {
      track.style.transform = 'translate3d(calc(' + (-index * 100) + '% + ' + offsetPx + 'px), 0, 0)';
    }

    function goTo(next) {
      next = clamp(next, 0, n - 1);
      if (next === index) { moveTrack(0); return; }
      index = next;
      info.classList.add('is-switching');
      moveTrack(0);
      setTimeout(function () { render(); info.classList.remove('is-switching'); }, 180);
    }

    render();
    moveTrack(0);
    if (n < 2) return; // nothing to swipe to yet

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(index + 1); });

    var dragging = false, startX = 0, dx = 0;
    frame.addEventListener('pointerdown', function (e) {
      dragging = true; startX = e.clientX; dx = 0;
      frame.classList.add('is-dragging');
      frame.setPointerCapture(e.pointerId);
    });
    frame.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      // Resist dragging past the first/last slide instead of a hard stop.
      if ((index === 0 && dx > 0) || (index === n - 1 && dx < 0)) dx *= 0.35;
      moveTrack(dx);
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      frame.classList.remove('is-dragging');
      var w = frame.getBoundingClientRect().width || 1;
      var threshold = Math.min(80, w * 0.18);
      if (dx <= -threshold) goTo(index + 1);
      else if (dx >= threshold) goTo(index - 1);
      else moveTrack(0);
      dx = 0;
    }
    frame.addEventListener('pointerup', endDrag);
    frame.addEventListener('pointercancel', endDrag);
    frame.addEventListener('pointerleave', function () { if (dragging) endDrag(); });
  }

  /* ---------------------------------------------------------- 9. TIMELINE */
  function initTimeline() {
    var tl = $('.tl');
    if (!tl) return;
    var fill = $('.tl__fill', tl);
    var steps = $$('.tl__step', tl);
    if (reduced.matches) {
      fill.style.setProperty('--p', '1');
      steps.forEach(function (s) { s.classList.add('is-lit'); });
      return;
    }
    Ticker.add(function () {
      var r = tl.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = clamp((vh * 0.72 - r.top) / Math.max(1, r.height), 0, 1);
      fill.style.setProperty('--p', p.toFixed(4));
      var line = r.top + r.height * p;
      steps.forEach(function (s) {
        var sr = s.getBoundingClientRect();
        s.classList.toggle('is-lit', line >= sr.top + 8);
      });
    });
  }

  /* ------------------------------------------------------------ 10. INTAKE */
  function initIntake() {
    var form = $('#intake-flow');
    if (!form) return;
    var steps = $$('.intake__step', form);
    var bar = $('.intake__progress span', form);
    var count = $('.intake__count', form);
    var prev = $('[data-intake="prev"]', form);
    var next = $('[data-intake="next"]', form);
    var nav = $('.intake__nav', form);
    var answers = {};
    var i = 0;
    var last = steps.length - 1;      // the result panel

    function label(step) { return step.dataset.q || ''; }

    function render() {
      steps.forEach(function (s, n) { s.classList.toggle('is-current', n === i); });
      bar.style.width = (i / last * 100).toFixed(1) + '%';
      count.textContent = i < last
        ? String(i + 1).padStart(2, '0') + ' / ' + String(last).padStart(2, '0')
        : 'AFGEROND';
      prev.setAttribute('aria-disabled', String(i === 0));
      nav.style.display = i === last ? 'none' : '';
      var need = steps[i].dataset.required === 'true';
      next.setAttribute('aria-disabled', String(need && !answers[label(steps[i])]));
      next.querySelector('span').textContent = i === last - 1 ? 'BEKIJK UITKOMST' : 'VOLGENDE';
      if (i === last) summarise();
    }

    function summarise() {
      var ul = $('.intake__summary', form);
      ul.innerHTML = '';
      steps.slice(0, last).forEach(function (s) {
        var q = label(s), a = answers[q];
        if (!a) return;
        var li = doc.createElement('li');
        var k = doc.createElement('span'); k.className = 'label'; k.textContent = q;
        var v = doc.createElement('b'); v.textContent = a;
        li.appendChild(k); li.appendChild(v); ul.appendChild(li);
      });
      var cta = $('.intake__send', form);
      if (cta) cta.dataset.summary = steps.slice(0, last).map(function (s) {
        var q = label(s); return answers[q] ? q + ': ' + answers[q] : null;
      }).filter(Boolean).join('\n');
    }

    form.addEventListener('click', function (e) {
      var opt = e.target.closest('.opt');
      if (opt) {
        var group = opt.closest('.opts');
        $$('.opt', group).forEach(function (o) { o.setAttribute('aria-checked', String(o === opt)); });
        answers[label(opt.closest('.intake__step'))] = opt.dataset.value || opt.textContent.trim();
        next.setAttribute('aria-disabled', 'false');
        // Auto-advance keeps a consultation feeling like a conversation.
        if (!reduced.matches && opt.closest('.intake__step').dataset.autoNext === 'true') {
          setTimeout(function () { if (i < last) { i++; render(); } }, 320);
        }
        return;
      }
      var btn = e.target.closest('[data-intake]');
      if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
      if (btn.dataset.intake === 'next' && i < last) i++;
      if (btn.dataset.intake === 'prev' && i > 0) i--;
      if (btn.dataset.intake === 'restart') { i = 0; answers = {}; $$('.opt', form).forEach(function (o) { o.setAttribute('aria-checked', 'false'); }); var ta = $('.field', form); if (ta) ta.value = ''; }
      render();
      form.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'nearest' });
    });

    var ta = $('.field', form);
    if (ta) ta.addEventListener('input', function () {
      answers[label(ta.closest('.intake__step'))] = ta.value.trim();
    });

    render();
    return { set: function (q, v) { answers[q] = v; } };
  }

  /* ------------------------------------------------------ 10.5 BRAND LOGO */
  /* Swaps the text wordmark for the official logo once the file exists at
     assets/img/logo/. Preloaded rather than set directly on the <img>, so a
     missing file never shows a broken-image icon — it silently keeps the
     current text mark instead. Drop the file in and reload; no code change
     needed. */
  function initBrandLogo() {
    var LOGO_SRC = 'assets/img/logo/mh-personal-coaching-logo-transparent.png';
    var probe = new Image();
    probe.onload = function () {
      $$('.brand__logo').forEach(function (el) { el.src = LOGO_SRC; el.hidden = false; });
      $$('.brand__mark').forEach(function (el) { el.style.display = 'none'; });
    };
    probe.onerror = function () { /* file not supplied yet — keep the text wordmark */ };
    probe.src = LOGO_SRC;
  }

  /* ------------------------------------------------------- 11. CONTACT CTAs */
  /* Every "plan een kennismaking" resolves to whatever CONFIG holds. With
     nothing configured the buttons take you to the contact block instead of
     failing silently on a dead link. */
  function initContact() {
    var waHref = CONFIG.whatsapp ? 'https://wa.me/' + CONFIG.whatsapp : '';
    var mailHref = CONFIG.email ? 'mailto:' + CONFIG.email : '';

    $$('[data-wa]').forEach(function (el) {
      if (!waHref) { el.setAttribute('href', '#contact'); return; }
      var msg = el.dataset.wa || 'Hoi, ik wil graag een kennismaking plannen voor MH Personal Coaching.';
      el.setAttribute('href', waHref + '?text=' + encodeURIComponent(msg));
      el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener');
    });
    $$('[data-mail]').forEach(function (el) {
      el.setAttribute('href', mailHref || '#contact');
      // Only elements whose label *is* the placeholder ("... — in te vullen")
      // get their text replaced — action buttons like "WhatsApp" keep their label.
      if (CONFIG.email && /in te vullen/.test(el.textContent)) el.textContent = CONFIG.email;
    });
    $$('[data-mhgym]').forEach(function (el) {
      if (CONFIG.mhGymUrl) { el.setAttribute('href', CONFIG.mhGymUrl); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
    });
    if (CONFIG.phone) $$('[data-phone]').forEach(function (el) {
      if (/in te vullen/.test(el.textContent)) el.textContent = CONFIG.phoneDisplay || CONFIG.phone;
      el.setAttribute('href', 'tel:' + CONFIG.phone.replace(/\s/g, ''));
    });

    // Intake outcome: hand the answers to WhatsApp if it is configured.
    var send = $('.intake__send');
    if (send) send.addEventListener('click', function (e) {
      if (!waHref) return;                       // href already points at #contact
      e.preventDefault();
      var text = 'Hoi, ik heb de intake ingevuld op de site.\n\n' + (send.dataset.summary || '');
      window.open(waHref + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });
  }

  /* ------------------------------------------------------------- 12. BOOT */
  function boot() {
    var curtain = $('.curtain');
    if (curtain) {
      setTimeout(function () { curtain.classList.add('is-done'); }, reduced.matches ? 0 : 1250);
      setTimeout(function () { if (curtain.parentNode) curtain.parentNode.removeChild(curtain); }, 2200);
    }

    Ticker.start();
    var heroCanvas = $('#hero-canvas');
    if (heroCanvas) HeroScene(heroCanvas);
    var envCanvas = $('#env-canvas');
    if (envCanvas) EnvScene(envCanvas);

    initReveals();
    initCardLight();
    initPointerLight();
    initNav();
    initHeroParallax();
    initGoals();
    initCoachCarousel();
    initTimeline();
    initIntake();
    initContact();
    initBrandLogo();

    // Stagger the reveal delays declared in markup as data-d="80".
    $$('[data-d]').forEach(function (el) { el.style.setProperty('--d', el.dataset.d + 'ms'); });

    // The engraving is drawn in Archivo — repaint once the webfont lands.
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () {
      window.dispatchEvent(new Event('resize'));
    });
  }

  /* This script sits after the markup it needs, so if the hero is already in
     the tree we can start immediately. The lifecycle listeners are only a
     fallback — some embedding hosts never fire DOMContentLoaded, which would
     otherwise leave the page sitting behind its intro curtain. */
  var booted = false;
  function ready() {
    // Re-resolve the live document: an embedding host may swap it out after
    // this script has already run, leaving our captured reference stale.
    if (doc !== window.document) doc = window.document;
    // And check for the real hero element, not merely a node in the tree —
    // some hosts hand out a placeholder first. The hero background has been
    // a canvas in earlier revisions; accept whichever is actually markup.
    var c = $('#hero-video') || $('#hero-canvas-3d') || $('#hero-canvas');
    return !!c;
  }
  function bootOnce() {
    if (booted || !ready()) return;
    booted = true;
    boot();
  }
  bootOnce();
  if (!booted) {
    doc.addEventListener('DOMContentLoaded', bootOnce);
    window.addEventListener('load', bootOnce);
    // Embedding hosts that rewrite the DOM after this script runs fire neither
    // event in a useful order, so poll briefly and give up rather than spin.
    var tries = 0;
    var poll = setInterval(function () {
      bootOnce();
      if (booted || ++tries > 60) clearInterval(poll);
    }, 50);
  }

  window.MH = { CONFIG: CONFIG, Ticker: Ticker };
})();
