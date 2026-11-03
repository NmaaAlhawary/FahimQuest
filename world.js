// Cube Island (جزيرة المكعبات): a 3D block world on top of the 12 levels.
// Fahim walks between 7 islands. Each glowing crystal opens one coding level, and
// finishing both levels of an island builds the bridge to the next one.
// Kids can also break and place blocks on the land (saved in localStorage).
// app.js calls CubeIsland.init(api) once, then CubeIsland.open() to enter.
window.CubeIsland = (() => {
  'use strict';

  const W = 72, D = 64, H = 16, SEA = 1.7, REACH = 6.5, BUILD_UP = 4;
  const I = (x, y, z) => (y * D + z) * W + x;
  const C = (x, z) => z * W + x;
  const inB = (x, y, z) => x >= 0 && x < W && z >= 0 && z < D && y >= 0 && y < H;
  const unI = (i) => ({ x: i % W, z: Math.floor(i / W) % D, y: Math.floor(i / (W * D)) });

  const T = { grass: 1, dirt: 2, sand: 3, stone: 4, snow: 5, log: 6, leaves: 7, planks: 8, glass: 9, brick: 10, magic: 11, cactus: 12, metal: 13, bridge: 14 };
  const SEE_THROUGH = new Set([T.glass, T.leaves]);
  const HOTBAR = [T.grass, T.stone, T.planks, T.glass, T.brick, T.leaves];

  // Islands in quest order. Bridge k joins island k to island k+1.
  const ISLANDS = [
    { c: 'pos', x: 12, z: 12, r: 7, top: T.grass, fill: T.dirt, deco: 'tree' },
    { c: 'seq', x: 36, z: 11, r: 7, top: T.grass, fill: T.dirt, deco: 'bush' },
    { c: 'loop', x: 60, z: 14, r: 7, top: T.sand, fill: T.sand, deco: 'cactus' },
    { c: 'var', x: 59, z: 40, r: 7, top: T.snow, fill: T.dirt, deco: 'pine' },
    { c: 'cond', x: 35, z: 51, r: 7, top: T.stone, fill: T.stone, deco: 'rock' },
    { c: 'fn', x: 11, z: 45, r: 7, top: T.magic, fill: T.dirt, deco: 'crystal' },
    { c: 'build', x: 34, z: 31, r: 5, top: T.planks, fill: T.stone, deco: 'none' },
  ];

  let api, inited = false, active = false, raf = 0, lastT = 0;
  let renderer, scene, camera, raycaster, fahim, shadow, waterTex;
  const vox = new Uint8Array(W * D * H), prot = new Uint8Array(W * D * H);
  const land = new Uint8Array(W * D), ground = new Uint8Array(W * D), islandOf = new Uint8Array(W * D), clear = new Uint8Array(W * D);
  const stations = [], gems = [], bridges = [], stationAt = new Map();
  let meshes = [], ghost = null, mats = {}, swatch = {};
  const crystals = [], bits = [], clouds = [];
  let pending = [];                       // bridge cells waiting to pop in
  let edits, built, gotGems;
  const P = { x: 0, y: 0, z: 0, vy: 0, ground: false, yaw: 0, safe: null };
  const cam = { yaw: 0, pitch: 0.55, dist: 8, x: 0, y: 0, z: 0 };
  const keys = new Set(), joy = { x: 0, y: 0 };
  let tool = 'hand', near = null, toastTimer = 0;
  const $ = (s) => document.querySelector(s);

  // ---------------------------------------------------------------------
  // textures (drawn in code, 16x16 pixel style)
  // ---------------------------------------------------------------------
  function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16), c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  }
  function px(g, hex, amt, r, x0 = 0, y0 = 0, w = 16, h = 16) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      g.fillStyle = shade(hex, 1 - amt + r() * amt * 2); g.fillRect(x, y, 1, 1);
    }
  }
  function canvas(draw, seed) {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d'); draw(g, rng(seed)); return c;
  }
  const DRAW = {
    grass: (g, r) => px(g, '#5DBB4C', 0.12, r),
    dirt: (g, r) => px(g, '#8B5E3C', 0.14, r),
    grassSide: (g, r) => { px(g, '#8B5E3C', 0.14, r); for (let x = 0; x < 16; x++) px(g, '#5DBB4C', 0.1, r, x, 0, 1, 3 + Math.floor(r() * 3)); },
    sand: (g, r) => px(g, '#EED89A', 0.07, r),
    stone: (g, r) => { px(g, '#9AA3AE', 0.12, r); g.fillStyle = '#7d8691'; for (let i = 0; i < 5; i++) g.fillRect(Math.floor(r() * 14), Math.floor(r() * 14), 3, 1); },
    snow: (g, r) => px(g, '#F5FAFF', 0.04, r),
    snowSide: (g, r) => { px(g, '#8B5E3C', 0.14, r); for (let x = 0; x < 16; x++) px(g, '#F5FAFF', 0.04, r, x, 0, 1, 3 + Math.floor(r() * 3)); },
    log: (g, r) => { px(g, '#7A5230', 0.1, r); g.fillStyle = '#5b3b20'; for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 1, 16); },
    logTop: (g, r) => { px(g, '#C49A64', 0.06, r); g.strokeStyle = '#8a6235'; g.strokeRect(2.5, 2.5, 11, 11); g.strokeRect(5.5, 5.5, 5, 5); },
    leaves: (g, r) => { px(g, '#3E9B3A', 0.2, r); g.fillStyle = '#2b7a2a'; for (let i = 0; i < 14; i++) g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); },
    planks: (g, r) => { px(g, '#C8955A', 0.08, r); g.fillStyle = '#8f6236'; for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1); g.fillRect(5, 0, 1, 3); g.fillRect(11, 4, 1, 3); g.fillRect(3, 8, 1, 3); g.fillRect(13, 12, 1, 3); },
    bridge: (g, r) => { px(g, '#9C6B3C', 0.08, r); g.fillStyle = '#5e3c1c'; for (let x = 3; x < 16; x += 4) g.fillRect(x, 0, 1, 16); g.fillStyle = '#3a3f47'; g.fillRect(1, 1, 1, 1); g.fillRect(1, 14, 1, 1); g.fillRect(14, 1, 1, 1); g.fillRect(14, 14, 1, 1); },
    glass: (g) => { g.fillStyle = 'rgba(200,240,255,0.25)'; g.fillRect(0, 0, 16, 16); g.strokeStyle = '#e8fbff'; g.strokeRect(0.5, 0.5, 15, 15); g.fillStyle = '#ffffff'; g.fillRect(3, 3, 1, 1); g.fillRect(4, 4, 1, 1); g.fillRect(5, 5, 1, 1); },
    brick: (g, r) => { px(g, '#F26A1B', 0.08, r); g.fillStyle = '#ffd2b3'; for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1); for (let y = 0; y < 16; y += 4) { const o = (y / 4) % 2 ? 4 : 0; for (let x = o; x < 16; x += 8) g.fillRect(x, y, 1, 3); } },
    magic: (g, r) => { px(g, '#8B5CF6', 0.12, r); g.fillStyle = '#e9d5ff'; for (let i = 0; i < 5; i++) g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); },
    magicSide: (g, r) => { px(g, '#8B5E3C', 0.14, r); for (let x = 0; x < 16; x++) px(g, '#8B5CF6', 0.12, r, x, 0, 1, 3 + Math.floor(r() * 3)); },
    cactus: (g, r) => { px(g, '#3C8D3A', 0.1, r); g.fillStyle = '#245c23'; for (let x = 2; x < 16; x += 5) g.fillRect(x, 0, 1, 16); g.fillStyle = '#e8f5c8'; for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); },
    cactusTop: (g, r) => px(g, '#4CA64A', 0.08, r),
    metal: (g, r) => { px(g, '#64748B', 0.06, r); g.fillStyle = '#334155'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16); g.fillStyle = '#cbd5e1'; [2, 13].forEach((a) => [2, 13].forEach((b) => g.fillRect(a, b, 1, 1))); g.fillStyle = '#22D3EE'; g.fillRect(6, 6, 4, 4); },
  };
  // [side, top, bottom] drawing for each block type
  const FACES = {
    [T.grass]: ['grassSide', 'grass', 'dirt'], [T.dirt]: ['dirt', 'dirt', 'dirt'], [T.sand]: ['sand', 'sand', 'sand'],
    [T.stone]: ['stone', 'stone', 'stone'], [T.snow]: ['snowSide', 'snow', 'dirt'], [T.log]: ['log', 'logTop', 'logTop'],
    [T.leaves]: ['leaves', 'leaves', 'leaves'], [T.planks]: ['planks', 'planks', 'planks'], [T.glass]: ['glass', 'glass', 'glass'],
    [T.brick]: ['brick', 'brick', 'brick'], [T.magic]: ['magicSide', 'magic', 'dirt'], [T.cactus]: ['cactus', 'cactusTop', 'cactusTop'],
    [T.metal]: ['metal', 'metal', 'metal'], [T.bridge]: ['bridge', 'bridge', 'bridge'],
  };
  function makeMaterials() {
    const cache = {};
    const tex = (name) => {
      if (cache[name]) return cache[name];
      const c = canvas(DRAW[name], name.length * 97 + name.charCodeAt(0));
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      cache[name] = { t, c };
      return cache[name];
    };
    for (const type in FACES) {
      const [s, top, bot] = FACES[type];
      const glass = +type === T.glass;
      const m = (n) => new THREE.MeshLambertMaterial({ map: tex(n).t, transparent: glass, depthWrite: !glass });
      const side = m(s);
      mats[type] = [side, side, m(top), m(bot), side, side];
      swatch[type] = tex(s === 'grassSide' || s === 'snowSide' || s === 'magicSide' ? s : top).c.toDataURL();
    }
  }

  // ---------------------------------------------------------------------
  // world generation
  // ---------------------------------------------------------------------
  const levelsOf = (c) => LEVELS.map((l, i) => ({ l, i })).filter((o) => o.l.concept === c);
  const isDone = (k) => ISLANDS[k].c !== 'build' && levelsOf(ISLANDS[k].c).every((o) => (api.progress()[o.l.id] || 0) > 0);
  function put(x, y, z, t) { if (inB(x, y, z) && !vox[I(x, y, z)]) vox[I(x, y, z)] = t; }

  function terrain(k, isl) {
    const s = k * 1.7 + 0.4;
    for (let x = Math.max(0, isl.x - isl.r - 3); x <= Math.min(W - 1, isl.x + isl.r + 3); x++)
      for (let z = Math.max(0, isl.z - isl.r - 3); z <= Math.min(D - 1, isl.z + isl.r + 3); z++) {
        const dx = x + 0.5 - isl.x, dz = z + 0.5 - isl.z, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
        const edge = isl.r + 0.9 * Math.sin(3 * a + s) + 0.5 * Math.sin(5 * a + 2 * s);
        if (d > edge) continue;
        const beach = d > edge - 1.4;
        const h = beach ? 2 : isl.c === 'build' || d > isl.r * 0.6 ? 3 : 4;
        for (let y = 0; y < h; y++) vox[I(x, y, z)] = y === h - 1 ? (beach ? T.sand : isl.top) : y < h - 3 ? T.stone : isl.fill;
        land[C(x, z)] = 1; ground[C(x, z)] = h; islandOf[C(x, z)] = k + 1;
      }
  }
  function decorate(k, isl) {
    const r = rng(1000 + k * 31), g = (x, z) => ground[C(x, z)];
    const spot = (pad) => {
      for (let tries = 0; tries < 40; tries++) {
        const a = r() * Math.PI * 2, d = 1.5 + r() * (isl.r - 1.5 - pad);
        const x = Math.floor(isl.x + Math.cos(a) * d), z = Math.floor(isl.z + Math.sin(a) * d);
        if (inB(x, 0, z) && land[C(x, z)] && g(x, z) >= 3 && !clear[C(x, z)] && !vox[I(x, g(x, z), z)]) return { x, z, y: g(x, z) };
      }
      return null;
    };
    // energy cubes first, so trees never sit on them
    if (isl.c !== 'build') for (let n = 0; n < 3; n++) {
      const p = spot(1.5); if (!p) continue;
      clear[C(p.x, p.z)] = 1;
      gems.push({ id: k + '-' + n, x: p.x + 0.5, y: p.y + 0.7, z: p.z + 0.5 });
    }
    const count = { tree: 6, bush: 7, cactus: 7, pine: 6, rock: 7, crystal: 6, none: 0 }[isl.deco];
    for (let n = 0; n < count; n++) {
      const p = spot(1.8); if (!p) continue;
      const { x, y, z } = p;
      clear[C(x, z)] = 1;
      if (isl.deco === 'tree' || (isl.deco === 'bush' && n % 3 === 0)) {
        for (let i = 0; i < 3; i++) put(x, y + i, z, T.log);
        for (let dy = 2; dy <= 3; dy++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (!(dy === 3 && a && b)) put(x + a, y + dy, z + b, T.leaves);
        put(x, y + 4, z, T.leaves);
      } else if (isl.deco === 'bush') {
        put(x, y, z, T.leaves); if (r() < 0.5) put(x + 1, y, z, T.leaves);
      } else if (isl.deco === 'cactus') {
        const h = 2 + Math.floor(r() * 2); for (let i = 0; i < h; i++) put(x, y + i, z, T.cactus);
      } else if (isl.deco === 'pine') {
        for (let i = 0; i < 4; i++) put(x, y + i, z, T.log);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) put(x + a, y + 2, z + b, T.leaves);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => put(x + a, y + 3, z + b, T.leaves));
        put(x, y + 4, z, T.leaves); put(x, y + 5, z, T.snow);
      } else if (isl.deco === 'rock') {
        put(x, y, z, T.stone); if (r() < 0.6) put(x, y + 1, z, T.stone); if (r() < 0.5) put(x + 1, y, z, T.stone);
      } else if (isl.deco === 'crystal') {
        const h = 2 + Math.floor(r() * 2); for (let i = 0; i < h; i++) put(x, y + i, z, T.glass);
        put(x, y + h, z, T.magic);
      }
    }
  }

  function generate() {
    vox.fill(0); prot.fill(0); land.fill(0); ground.fill(0); islandOf.fill(0); clear.fill(0);
    stations.length = 0; gems.length = 0; bridges.length = 0; stationAt.clear();
    ISLANDS.forEach((isl, k) => terrain(k, isl));

    // stations: two level crystals per concept island; Free Build + trophy on the workshop
    ISLANDS.forEach((isl, k) => {
      const list = isl.c === 'build'
        ? [{ kind: 'sandbox', x: isl.x - 2 }, { kind: 'trophy', x: isl.x + 2 }]
        : levelsOf(isl.c).map((o, n) => ({ kind: 'level', level: o.i, x: isl.x + (n ? 3 : -3) }));
      list.forEach((s) => {
        Object.assign(s, { z: isl.z, isl: k, y: ground[C(s.x, isl.z)] });
        vox[I(s.x, s.y, s.z)] = T.metal;
        for (let y = s.y; y < H; y++) prot[I(s.x, y, s.z)] = 1;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) clear[C(s.x + a, s.z + b)] = 1;
        stationAt.set(I(s.x, s.y, s.z), s);
        stations.push(s);
      });
    });

    // bridges (cells only; placed when unlocked)
    for (let k = 0; k < ISLANDS.length - 1; k++) {
      const a = ISLANDS[k], b = ISLANDS[k + 1];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      const cells = [], seen = new Set();
      let mid = null;
      for (let s = 0; s <= len; s += 0.25) for (const w of [-1.3, -0.55, 0.55, 1.3]) {
        const x = Math.floor(a.x + 0.5 + ux * s - uz * w), z = Math.floor(a.z + 0.5 + uz * s + ux * w);
        if (!inB(x, 0, z)) continue;
        clear[C(x, z)] = 1;
        if (Math.abs(w) > 1 || (land[C(x, z)] && ground[C(x, z)] > 2)) continue;
        const i = I(x, 2, z);
        prot[i] = 1;
        if (!seen.has(i)) { seen.add(i); cells.push(i); }
        if (!land[C(x, z)] && s > len / 2 && !mid) mid = { x: x + 0.5, z: z + 0.5 };
      }
      bridges.push({ k, cells, mid: mid || { x: a.x + dx / 2, z: a.z + dz / 2 } });
    }

    const sp = ISLANDS[0];
    for (let a = -2; a <= 2; a++) for (let b = 2; b <= 6; b++) clear[C(sp.x + a, sp.z + b)] = 1;
    ISLANDS.forEach((isl, k) => decorate(k, isl));

    // the player's own blocks
    for (const i in edits) if (!prot[+i] && +i < vox.length) vox[+i] = edits[i];
    built = built.filter((k) => isDone(k));
    built.forEach((k) => bridges[k].cells.forEach((i) => (vox[i] = T.bridge)));
  }

  // ---------------------------------------------------------------------
  // meshes
  // ---------------------------------------------------------------------
  const boxGeo = () => new THREE.BoxGeometry(1, 1, 1);
  function exposed(x, y, z) {
    const n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const [a, b, c] of n) {
      const X = x + a, Y = y + b, Z = z + c;
      if (Y < 0) continue;
      if (!inB(X, Y, Z)) return true;
      const t = vox[I(X, Y, Z)];
      if (!t || SEE_THROUGH.has(t)) return true;
    }
    return false;
  }
  function rebuild() {
    meshes.forEach((m) => { scene.remove(m); m.geometry.dispose(); m.dispose && m.dispose(); });
    meshes = [];
    const lists = {};
    for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const t = vox[I(x, y, z)];
      if (t && exposed(x, y, z)) (lists[t] = lists[t] || []).push(I(x, y, z));
    }
    const m4 = new THREE.Matrix4();
    for (const t in lists) {
      const cells = lists[t];
      const mesh = new THREE.InstancedMesh(boxGeo(), mats[t], cells.length);
      cells.forEach((i, n) => { const p = unI(i); m4.makeTranslation(p.x + 0.5, p.y + 0.5, p.z + 0.5); mesh.setMatrixAt(n, m4); });
      mesh.userData.cells = cells;
      if (+t === T.glass) mesh.renderOrder = 2;
      scene.add(mesh); meshes.push(mesh);
    }
    rebuildGhost();
  }
  function rebuildGhost() {
    if (ghost) { scene.remove(ghost); ghost.geometry.dispose(); }
    const cells = [];
    bridges.forEach((b) => { if (!built.includes(b.k)) b.cells.forEach((i) => cells.push(i)); });
    ghost = new THREE.InstancedMesh(boxGeo(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }), Math.max(1, cells.length));
    ghost.count = cells.length;
    const m4 = new THREE.Matrix4();
    cells.forEach((i, n) => { const p = unI(i); m4.makeTranslation(p.x + 0.5, p.y + 0.5, p.z + 0.5); ghost.setMatrixAt(n, m4); });
    scene.add(ghost);
    bridges.forEach((b) => { if (b.lock) b.lock.visible = !built.includes(b.k); });
  }

  // label sprites (text drawn on a canvas)
  function label(lines, color, w = 512, h = 200, onTop = false) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.94)'; g.strokeStyle = color; g.lineWidth = 10;
    const r = 34;
    g.beginPath(); g.moveTo(r, 5); g.arcTo(w - 5, 5, w - 5, h - 5, r); g.arcTo(w - 5, h - 5, 5, h - 5, r); g.arcTo(5, h - 5, 5, 5, r); g.arcTo(5, 5, w - 5, 5, r); g.closePath();
    g.fill(); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = api.lang() === 'ar' ? 'rtl' : 'ltr';
    lines.forEach((ln, n) => {
      g.font = `${ln.bold ? 'bold ' : ''}${ln.size || 44}px ui-rounded, system-ui, "Geeza Pro", Tahoma, sans-serif`;
      g.fillStyle = ln.color || '#0A0D14';
      g.fillText(ln.text, w / 2, h / (lines.length + 1) * (n + 1) + (n ? 6 : 0), w - 40);
    });
    const tex = new THREE.CanvasTexture(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: !onTop }));
    s.scale.set(w / 160, h / 160, 1);
    return s;
  }
  function setLabel(holder, sprite) {
    if (holder.sprite) { holder.sprite.material.map.dispose(); holder.sprite.material.dispose(); scene.remove(holder.sprite); }
    holder.sprite = sprite; scene.add(sprite);
  }
  const conceptOf = (c) => CONCEPTS.find((x) => x.id === c);
  const islandName = (k) => ISLANDS[k].c === 'build' ? api.t('w_workshop') : api.t('w_islandOf', { c: api.L(conceptOf(ISLANDS[k].c).name) });
  const islandColor = (k) => ISLANDS[k].c === 'build' ? '#0A0D14' : conceptOf(ISLANDS[k].c).color;
  const allDone = () => LEVELS.every((l) => (api.progress()[l.id] || 0) > 0);

  function makeStationMeshes() {
    stations.forEach((s) => {
      const color = s.kind === 'level' ? conceptOf(LEVELS[s.level].concept).color : s.kind === 'trophy' ? '#FACC15' : '#F26A1B';
      const geo = s.kind === 'trophy' ? new THREE.BoxGeometry(0.6, 0.6, 0.6) : s.kind === 'sandbox' ? new THREE.TorusKnotGeometry(0.3, 0.1, 48, 8) : new THREE.OctahedronGeometry(0.45);
      const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.45 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(s.x + 0.5, s.y + 1.9, s.z + 0.5);
      m.userData.station = s;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 9, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.set(s.x + 0.5, s.y + 5.5, s.z + 0.5);
      scene.add(m, beam);
      s.mesh = m; s.beam = beam; s.color = color;
      crystals.push(m);
    });
    gems.forEach((g) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), new THREE.MeshLambertMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 0.6 }));
      m.position.set(g.x, g.y, g.z); g.mesh = m; scene.add(m);
    });
    bridges.forEach((b) => { b.lock = new THREE.Group(); scene.add(b.lock); });
  }
  function refreshLabels() {
    const prog = api.progress();
    stations.forEach((s) => {
      let lines;
      if (s.kind === 'level') {
        const l = LEVELS[s.level], st = prog[l.id] || 0;
        lines = [{ text: `${conceptOf(l.concept).icon} ${s.level + 1}. ${api.L(l.title)}`, bold: true }, { text: '★'.repeat(st) + '☆'.repeat(3 - st), color: st ? '#EAB308' : '#94a3b8', size: 52 }];
        s.mesh.material.color.set(st ? '#FACC15' : s.color); s.mesh.material.emissive.set(st ? '#FACC15' : s.color);
        s.beam.visible = st > 0;
      } else if (s.kind === 'sandbox') {
        lines = [{ text: '🛠️ ' + api.t('sandbox'), bold: true }, { text: api.t('w_sandboxSub'), size: 32, color: '#5b6475' }];
        s.beam.visible = false;
      } else {
        const n = LEVELS.filter((l) => (prog[l.id] || 0) > 0).length;
        lines = [{ text: '🏆 ' + api.t('w_trophy'), bold: true }, { text: `${n} / ${LEVELS.length}`, size: 40, color: allDone() ? '#EAB308' : '#5b6475' }];
        s.mesh.visible = allDone(); s.beam.visible = allDone();
      }
      const sp = label(lines, s.color, 512, 200, true);
      sp.renderOrder = 5;
      sp.position.set(s.x + 0.5, s.y + 3.1, s.z + 0.5);
      setLabel(s, sp);
    });
    ISLANDS.forEach((isl, k) => {
      const sp = label([{ text: islandName(k), bold: true, size: 50 }], islandColor(k), 560, 120);
      sp.scale.multiplyScalar(1.6);
      sp.position.set(isl.x + 0.5, 10.5, isl.z + 0.5);
      isl.holder = isl.holder || {}; setLabel(isl.holder, sp);
    });
    bridges.forEach((b) => {
      b.lock.clear();
      const sp = label([{ text: '🔒', size: 60 }, { text: api.t('w_lock', { i: islandName(b.k) }), size: 28, color: '#5b6475' }], '#94a3b8', 512, 180);
      sp.position.set(b.mid.x, 4.6, b.mid.z);
      b.lock.add(sp);
      b.lock.visible = !built.includes(b.k);
    });
  }

  function makeFahim() {
    const g = new THREE.Group();
    const box = (w, h, d, c, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); b.position.set(x, y, z); g.add(b); return b; };
    box(0.8, 0.22, 0.66, 0x1f2937, 0, 0.11, 0);
    box(0.66, 0.5, 0.5, 0x22d3ee, 0, 0.47, 0);
    box(0.28, 0.16, 0.04, 0xf26a1b, 0, 0.5, 0.26);
    box(0.74, 0.52, 0.6, 0x22d3ee, 0, 0.98, 0);
    box(0.58, 0.28, 0.04, 0x0a0d14, 0, 1.0, 0.31);
    box(0.1, 0.1, 0.03, 0xa5f3fc, -0.13, 1.01, 0.335);
    box(0.1, 0.1, 0.03, 0xa5f3fc, 0.13, 1.01, 0.335);
    box(0.08, 0.22, 0.22, 0x7c3aed, -0.41, 0.98, 0);
    box(0.08, 0.22, 0.22, 0x7c3aed, 0.41, 0.98, 0);
    box(0.04, 0.22, 0.04, 0x0a0d14, 0, 1.35, 0);
    box(0.13, 0.13, 0.13, 0xf26a1b, 0, 1.5, 0);
    return g;
  }

  // ---------------------------------------------------------------------
  // scene
  // ---------------------------------------------------------------------
  function buildScene() {
    const cv = $('#wCanvas');
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa8dcff);
    scene.fog = new THREE.Fog(0xa8dcff, 35, 95);
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 220);
    raycaster = new THREE.Raycaster();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8f6a, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(30, 60, 20); scene.add(sun);

    const wc = canvas((g, r) => { px(g, '#3B9BE0', 0.06, r); g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 14), Math.floor(r() * 16), 3, 1); }, 7);
    waterTex = new THREE.CanvasTexture(wc); waterTex.magFilter = THREE.NearestFilter; waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(120, 120);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.82, depthWrite: false }));
    water.rotation.x = -Math.PI / 2; water.position.set(W / 2, SEA, D / 2); water.renderOrder = 3; scene.add(water);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshLambertMaterial({ color: 0xc9b47a }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0.02, D / 2); scene.add(floor);

    const cr = rng(42);
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(4 + cr() * 6, 1, 3 + cr() * 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
      c.position.set(cr() * (W + 40) - 20, 20 + cr() * 4, cr() * (D + 40) - 20);
      clouds.push(c); scene.add(c);
    }
    fahim = makeFahim(); scene.add(fahim);
    shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
  }

  // ---------------------------------------------------------------------
  // player physics
  // ---------------------------------------------------------------------
  const PR = 0.3, PH = 1.5, SPEED = 4.3, JUMP = 7.4, GRAV = 24;
  function hits(px, py, pz) {
    for (let x = Math.floor(px - PR); x <= Math.floor(px + PR); x++)
      for (let y = Math.floor(py); y <= Math.floor(py + PH - 0.01); y++)
        for (let z = Math.floor(pz - PR); z <= Math.floor(pz + PR); z++)
          if (inB(x, y, z) && vox[I(x, y, z)]) return true;
    return false;
  }
  function reachable() {
    const r = [true];
    for (let k = 0; k < bridges.length; k++) r[k + 1] = r[k] && built.includes(k);
    return r;
  }
  function placeAt(p) { P.x = p.x; P.y = p.y; P.z = p.z; P.vy = 0; }
  function spawnPoint() { const s = ISLANDS[0]; return { x: s.x + 0.5, y: ground[C(s.x, s.z + 4)], z: s.z + 4.5 }; }

  function step(dt) {
    let ix = 0, iz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    ix += joy.x; iz += joy.y;
    const len = Math.hypot(ix, iz);
    let vx = 0, vz = 0;
    if (len > 0.08) {
      const k = Math.min(1, len) / len, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
      const dx = (fx * iz + rx * ix) * k, dz = (fz * iz + rz * ix) * k;
      const sp = SPEED * (P.ground ? 1 : 0.8);
      vx = dx * sp; vz = dz * sp;
      const target = Math.atan2(dx, dz);
      let d = target - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      P.yaw += d * Math.min(1, dt * 12);
    }
    if (keys.has('Space') && P.ground) { P.vy = JUMP; P.ground = false; }
    let blocked = false;
    const nx = P.x + vx * dt; if (!hits(nx, P.y, P.z)) P.x = nx; else blocked = true;
    const nz = P.z + vz * dt; if (!hits(P.x, P.y, nz)) P.z = nz; else blocked = true;
    if (blocked && P.ground && !hits(P.x + vx * dt * 3, P.y + 1.05, P.z + vz * dt * 3) && !hits(P.x, P.y + 1.05, P.z)) { P.vy = JUMP * 0.92; P.ground = false; }
    P.x = Math.max(0.4, Math.min(W - 0.4, P.x)); P.z = Math.max(0.4, Math.min(D - 0.4, P.z));
    P.vy -= GRAV * dt;
    const ny = P.y + P.vy * dt;
    if (hits(P.x, ny, P.z)) {
      if (P.vy < 0) { P.y = Math.floor(ny) + 1; P.ground = true; }
      P.vy = 0;
    } else { P.y = ny; P.ground = false; }

    if (P.ground) {
      const col = C(Math.floor(P.x), Math.floor(P.z)), isl = islandOf[col];
      if (isl && !reachable()[isl - 1]) { sendBack('w_useBridge'); return; }
      P.safe = { x: P.x, y: P.y, z: P.z };
    }
    if (P.y < SEA - 0.4) sendBack('w_splash');
  }
  function sendBack(msg) {
    api.tone(300, 0.15, 'sine'); api.tone(180, 0.25, 'sine', 0.1);
    toast(api.t(msg));
    placeAt(P.safe || spawnPoint());
  }

  // ---------------------------------------------------------------------
  // frame loop
  // ---------------------------------------------------------------------
  let popClock = 0, time = 0;
  function frame(now) {
    if (!active) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (lastT || now)) / 1000); lastT = now; time += dt;
    step(dt);

    // bridge cells pop in one after another
    if (pending.length) {
      popClock += dt;
      if (popClock > 0.05) {
        popClock = 0;
        for (let n = 0; n < 2 && pending.length; n++) vox[pending.shift()] = T.bridge;
        api.tone(500 + Math.random() * 300, 0.05, 'square', 0, 0.03);
        rebuild();
      }
    }
    // energy cubes
    gems.forEach((g) => {
      if (gotGems[g.id]) { g.mesh.visible = false; return; }
      g.mesh.rotation.y += dt * 2; g.mesh.rotation.x += dt; g.mesh.position.y = g.y + Math.sin(time * 3 + g.x) * 0.12;
      if (Math.hypot(P.x - g.x, P.z - g.z) < 0.75 && Math.abs(P.y + 0.6 - g.y) < 1.2) {
        gotGems[g.id] = 1; api.store.set('world:gems', gotGems);
        api.sfx.gem(); burst(g.x, g.y, g.z, 0x22d3ee);
        const n = Object.keys(gotGems).length;
        toast(n === gems.length ? api.t('w_allGems') : api.t('w_gemGot', { n, m: gems.length }));
        hud();
      }
    });
    stations.forEach((s) => { if (s.sprite) s.sprite.visible = Math.hypot(P.x - s.x, P.z - s.z) < 16; });
    ISLANDS.forEach((isl) => { if (isl.holder && isl.holder.sprite) isl.holder.sprite.visible = Math.hypot(P.x - isl.x, P.z - isl.z) > isl.r + 3; });
    crystals.forEach((m, n) => { m.rotation.y += dt * 1.4; m.position.y = m.userData.station.y + 1.9 + Math.sin(time * 2 + n) * 0.12; });
    clouds.forEach((c) => { c.position.x += dt * 0.6; if (c.position.x > W + 30) c.position.x = -30; });
    waterTex.offset.x = time * 0.01; waterTex.offset.y = Math.sin(time * 0.5) * 0.02;
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]; b.life -= dt; b.v.y -= 12 * dt; b.m.position.addScaledVector(b.v, dt);
      if (b.life <= 0) { scene.remove(b.m); bits.splice(i, 1); }
    }

    // station nearby?
    let best = null, bd = 2.4;
    stations.forEach((s) => { const d = Math.hypot(P.x - s.x - 0.5, P.z - s.z - 0.5); if (d < bd && Math.abs(P.y - s.y) < 2.5) { bd = d; best = s; } });
    if (best !== near) { near = best; prompt(); }

    // Fahim + camera
    fahim.position.set(P.x, P.y + (P.ground ? Math.abs(Math.sin(time * 9)) * (keys.size || joy.x || joy.y ? 0.04 : 0) : 0), P.z);
    fahim.rotation.y = P.yaw;
    let gy = Math.floor(P.y); while (gy > 0 && !vox[I(Math.floor(P.x), gy - 1, Math.floor(P.z))]) gy--;
    shadow.position.set(P.x, (gy > 0 ? gy : SEA) + 0.02, P.z); shadow.visible = gy > 0;
    const tx = P.x, ty = P.y + 1.1, tz = P.z;
    const cx = tx + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cy = ty + Math.sin(cam.pitch) * cam.dist, cz = tz + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
    const f = Math.min(1, dt * 8);
    cam.x += (cx - cam.x) * f; cam.y += (cy - cam.y) * f; cam.z += (cz - cam.z) * f;
    camera.position.set(cam.x, cam.y, cam.z); camera.lookAt(tx, ty, tz);
    compass();
    renderer.render(scene, camera);
  }

  function burst(x, y, z, color) {
    for (let n = 0; n < 8; n++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y, z); scene.add(m);
      bits.push({ m, life: 0.6, v: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4) });
    }
  }

  // ---------------------------------------------------------------------
  // quests, HUD
  // ---------------------------------------------------------------------
  function target() {
    const prog = api.progress();
    return stations.find((s) => s.kind === 'level' && !(prog[LEVELS[s.level].id] > 0)) || stations.find((s) => s.kind === 'sandbox');
  }
  function hud() {
    const prog = api.progress();
    const stars = LEVELS.reduce((a, l) => a + (prog[l.id] || 0), 0);
    $('#wStars').textContent = `★ ${stars}/${LEVELS.length * 3}`;
    $('#wGems').textContent = `💎 ${Object.keys(gotGems).length}/${gems.length}`;
    const t = target();
    let q;
    if (allDone()) q = api.t('w_questDone');
    else {
      const k = t.isl, n = levelsOf(ISLANDS[k].c).filter((o) => (prog[o.l.id] || 0) > 0).length;
      q = api.t('w_quest', { i: islandName(k), n });
      if (!reachable()[k]) q += ' ' + api.t('w_questLocked');
    }
    $('#wQuest').innerHTML = `<b>🎯 ${api.t('w_questTitle')}</b><span>${q}</span>`;
  }
  function compass() {
    const t = target(); const el = $('#wArrow');
    if (!t) { el.hidden = true; return; }
    const dx = t.x + 0.5 - P.x, dz = t.z + 0.5 - P.z, d = Math.hypot(dx, dz);
    el.hidden = d < 3;
    // angle on screen, clockwise from "straight ahead"
    const fwd = -dx * Math.sin(cam.yaw) - dz * Math.cos(cam.yaw), right = dx * Math.cos(cam.yaw) - dz * Math.sin(cam.yaw);
    el.firstChild.style.transform = `rotate(${Math.atan2(right, fwd)}rad)`;
    el.lastChild.textContent = Math.round(d) + 'm';
  }
  function prompt() {
    const el = $('#wPrompt');
    if (!near) { el.hidden = true; return; }
    el.hidden = false;
    const prog = api.progress();
    if (near.kind === 'level') {
      const l = LEVELS[near.level], st = prog[l.id] || 0;
      el.innerHTML = `<kbd>E</kbd> ▶ ${api.t('w_play')}: ${near.level + 1}. ${api.L(l.title)} <span class="st">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>`;
    } else if (near.kind === 'sandbox') el.innerHTML = `<kbd>E</kbd> 🛠️ ${api.t('sandbox')}`;
    else el.innerHTML = allDone() ? `🏆 ${api.t('w_champion')}` : `🏆 ${api.t('w_trophyLocked', { n: LEVELS.filter((l) => (prog[l.id] || 0) > 0).length, m: LEVELS.length })}`;
  }
  function useStation(s) {
    if (!s) return;
    if (s.kind === 'trophy') { if (allDone()) { api.sfx.win(); burst(s.x + 0.5, s.y + 2, s.z + 0.5, 0xfacc15); toast('🏆 ' + api.t('w_champion')); } return; }
    savePos();
    close();
    if (s.kind === 'level') api.openLevel(s.level); else api.openSandbox();
  }
  function toast(msg) {
    const el = $('#wToast'); el.textContent = msg; el.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 2600);
  }
  function savePos() { api.store.set('world:pos', { x: P.x, y: P.y, z: P.z, yaw: P.yaw, cyaw: cam.yaw }); }

  function hotbar() {
    const tools = [{ id: 'hand', icon: '✋', key: 'H' }, { id: 'break', icon: '⛏️', key: 'Q' }].concat(HOTBAR.map((t, n) => ({ id: 'b' + t, img: swatch[t], key: n + 1 })));
    $('#wHotbar').innerHTML = tools.map((o) => `<button class="slot${tool === o.id ? ' on' : ''}" data-tool="${o.id}" title="${api.t('w_tool_' + (o.img ? 'block' : o.id))}">
      ${o.img ? `<img src="${o.img}" alt="">` : `<span>${o.icon}</span>`}<small>${o.key}</small></button>`).join('');
    document.querySelectorAll('#wHotbar [data-tool]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); setTool(b.dataset.tool); }));
  }
  function setTool(id) {
    tool = id; api.sfx.tap(); hotbar();
    if (id !== 'hand') toast(id === 'break' ? api.t('w_breakHelp') : api.t('w_placeHelp'));
  }

  // ---------------------------------------------------------------------
  // tapping: open a station, break or place a block
  // ---------------------------------------------------------------------
  const ptr = new THREE.Vector2();
  function tap(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ptr, camera);
    raycaster.far = 40;
    const hit = raycaster.intersectObjects(meshes.concat(crystals), false)[0];
    if (!hit) return;
    const st = hit.object.userData.station || (hit.object.userData.cells && stationAt.get(hit.object.userData.cells[hit.instanceId]));
    const center = new THREE.Vector3(P.x, P.y + 0.8, P.z);
    if (st) {
      if (Math.hypot(P.x - st.x - 0.5, P.z - st.z - 0.5) < 7) useStation(st); else toast(api.t('w_tooFar'));
      return;
    }
    if (tool === 'hand' || !hit.object.userData.cells) return;
    const cell = hit.object.userData.cells[hit.instanceId], p = unI(cell);
    if (center.distanceTo(new THREE.Vector3(p.x + 0.5, p.y + 0.5, p.z + 0.5)) > REACH) { toast(api.t('w_tooFar')); return; }
    if (tool === 'break') {
      if (prot[cell]) { toast(api.t('w_protected')); api.sfx.fail(); return; }
      burst(p.x + 0.5, p.y + 0.5, p.z + 0.5, 0x8b5e3c);
      vox[cell] = 0; edits[cell] = 0;
      api.tone(140, 0.08, 'square', 0, 0.06);
    } else {
      const n = hit.face.normal, x = p.x + Math.round(n.x), y = p.y + Math.round(n.y), z = p.z + Math.round(n.z);
      const ok = inB(x, y, z) && !vox[I(x, y, z)] && !prot[I(x, y, z)] && land[C(x, z)] && y < ground[C(x, z)] + BUILD_UP;
      const onMe = x + 1 > P.x - PR && x < P.x + PR && z + 1 > P.z - PR && z < P.z + PR && y + 1 > P.y && y < P.y + PH;
      if (!ok || onMe) { toast(api.t('w_cantBuild')); api.sfx.fail(); return; }
      const type = +tool.slice(1);
      vox[I(x, y, z)] = type; edits[I(x, y, z)] = type;
      api.tone(420, 0.06, 'triangle', 0, 0.08);
    }
    api.store.set('world:edits', edits);
    rebuild();
  }

  // ---------------------------------------------------------------------
  // DOM + input
  // ---------------------------------------------------------------------
  function buildDom() {
    const el = document.createElement('div');
    el.id = 'world'; el.className = 'world'; el.hidden = true;
    el.innerHTML = `
      <canvas id="wCanvas"></canvas>
      <div class="w-top">
        <button class="btn" id="wHome"></button>
        <div class="w-title" id="wTitle"></div>
        <div class="w-stats"><span id="wStars"></span><span id="wGems"></span></div>
        <button class="btn ghost" id="wLang"></button>
        <button class="btn ghost icon" id="wMute"></button>
        <button class="btn ghost icon" id="wHelpBtn">?</button>
      </div>
      <div class="w-quest" id="wQuest"></div>
      <div class="w-arrow" id="wArrow"><i>⬆</i><small></small></div>
      <div class="w-toast" id="wToast"></div>
      <button class="w-prompt" id="wPrompt" hidden></button>
      <div class="w-hotbar" id="wHotbar"></div>
      <div class="w-stick" id="wStick"><i></i></div>
      <button class="w-jump" id="wJump">⤒</button>
      <div class="w-help" id="wHelp" hidden><div class="w-help-card" id="wHelpCard"></div></div>`;
    document.body.appendChild(el);

    $('#wHome').onclick = () => { savePos(); close(); api.home(); };
    $('#wLang').onclick = () => { api.toggleLang(); texts(); };
    $('#wMute').onclick = () => { api.toggleMute(); texts(); };
    $('#wHelpBtn').onclick = help;
    $('#wPrompt').onclick = () => useStation(near);

    const cv = $('#wCanvas');
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      cam.yaw -= dx * 0.007; cam.pitch = Math.max(0.12, Math.min(1.35, cam.pitch + dy * 0.005));
    });
    cv.addEventListener('pointerup', (e) => { if (drag && drag.id === e.pointerId && drag.moved < 8) tap(e.clientX, e.clientY); drag = null; });
    cv.addEventListener('pointercancel', () => (drag = null));
    cv.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.max(4, Math.min(15, cam.dist + e.deltaY * 0.01)); }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    const stick = $('#wStick'), knob = stick.firstChild;
    let sid = null;
    const moveStick = (e) => {
      const r = stick.getBoundingClientRect(), R = r.width / 2;
      let dx = e.clientX - r.left - R, dy = e.clientY - r.top - R; const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      joy.x = dx / R; joy.y = -dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); moveStick(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) moveStick(e); });
    const endStick = () => { sid = null; joy.x = joy.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
    const jb = $('#wJump');
    jb.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.add('Space'); });
    const endJump = () => keys.delete('Space');
    jb.addEventListener('pointerup', endJump); jb.addEventListener('pointercancel', endJump); jb.addEventListener('pointerleave', endJump);

    window.addEventListener('keydown', (e) => {
      if (!active || !$('#wHelp').hidden) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      keys.add(e.code);
      if (e.code === 'KeyE' || e.code === 'Enter') useStation(near);
      if (e.code === 'KeyQ') setTool('break');
      if (e.code === 'KeyH' || e.code === 'Escape' || e.code === 'Digit0') setTool('hand');
      const n = +e.key; if (n >= 1 && n <= HOTBAR.length) setTool('b' + HOTBAR[n - 1]);
    });
    window.addEventListener('keyup', (e) => keys.delete(e.code));
    window.addEventListener('blur', () => keys.clear());
    window.addEventListener('resize', resize);
  }
  function texts() {
    $('#wHome').textContent = api.t('w_home');
    $('#wTitle').textContent = '🏝️ ' + api.t('w_title');
    $('#wLang').textContent = api.t('langBtn');
    $('#wMute').textContent = api.muted() ? '🔇' : '🔊';
    $('#world').dir = api.lang() === 'ar' ? 'rtl' : 'ltr';
    hotbar(); hud(); prompt(); refreshLabels();
  }
  function help() {
    const touch = matchMedia('(pointer: coarse)').matches;
    $('#wHelpCard').innerHTML = `
      <h2>🏝️ ${api.t('w_title')}</h2>
      <p>${api.t('w_intro')}</p>
      <ul>${api.t(touch ? 'w_helpTouch' : 'w_helpKeys').split('|').map((s) => `<li>${s}</li>`).join('')}</ul>
      <div class="w-help-actions">
        <button class="btn" id="wResetBlocks">${api.t('w_resetBlocks')}</button>
        <button class="btn run" id="wGotIt">${api.t('letsGo')}</button>
      </div>`;
    $('#wHelp').hidden = false; keys.clear();
    $('#wGotIt').onclick = () => { $('#wHelp').hidden = true; api.store.set('world:helped', true); };
    $('#wResetBlocks').onclick = () => {
      if (!confirm(api.t('w_resetConfirm'))) return;
      edits = {}; api.store.set('world:edits', edits);
      resetWorld(); placeAt(spawnPoint()); $('#wHelp').hidden = true;
    };
  }
  function resetWorld() {
    stations.forEach((s) => { scene.remove(s.mesh, s.beam); if (s.sprite) scene.remove(s.sprite); });
    gems.forEach((g) => scene.remove(g.mesh));
    bridges.forEach((b) => scene.remove(b.lock));
    crystals.length = 0;
    generate(); makeStationMeshes(); refreshLabels(); rebuild();
  }
  function resize() {
    if (!renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------------
  // public
  // ---------------------------------------------------------------------
  function init(a) { api = a; }
  function setup() {
    edits = api.store.get('world:edits', {});
    built = api.store.get('world:built', []);
    gotGems = api.store.get('world:gems', {});
    buildDom(); buildScene(); makeMaterials();
    generate(); makeStationMeshes(); rebuild();
    const saved = api.store.get('world:pos', null);
    placeAt(saved || spawnPoint());
    if (saved) { P.yaw = saved.yaw || 0; cam.yaw = saved.cyaw || 0; }
    cam.x = P.x; cam.y = P.y + 6; cam.z = P.z + 8;
    inited = true;
  }
  function open() {
    if (!window.THREE) { alert('3D is not available in this browser.'); api.home(); return; }
    if (!inited) setup();
    document.body.classList.add('in-world');
    $('#world').hidden = false;
    active = true; lastT = 0; keys.clear();
    resize(); texts();
    // new bridges for islands finished since last visit
    const fresh = bridges.filter((b) => isDone(b.k) && !built.includes(b.k));
    if (fresh.length) {
      fresh.forEach((b) => { built.push(b.k); pending.push(...b.cells); });
      api.store.set('world:built', built);
      rebuildGhost(); hud();
      setTimeout(() => { api.sfx.win(); toast(api.t('w_bridgeNew', { i: islandName(fresh[fresh.length - 1].k + 1) })); }, 400);
    }
    if (!api.store.get('world:helped', false)) help();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function close() {
    active = false; cancelAnimationFrame(raf); keys.clear();
    while (pending.length) vox[pending.shift()] = T.bridge;
    if (inited) { rebuild(); $('#world').hidden = true; }
    document.body.classList.remove('in-world');
  }
  return { init, open, close, isOpen: () => active, debug: { P, stations, bridges, cam } };
})();
