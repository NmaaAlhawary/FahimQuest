(() => {
  'use strict';

  // ---------- storage (safe) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('fcq:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('fcq:' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  let lang = store.get('lang', 'en');
  let progress = store.get('progress', {});      // levelId -> stars
  let seen = store.get('seen', {});              // conceptId -> true
  let muted = store.get('muted', false);
  let speed = store.get('speed', 3);

  const $ = (s, el = document) => el.querySelector(s);
  const app = $('#app');
  const t = (k, vars) => {
    let s = (STRINGS[lang] && STRINGS[lang][k]) || STRINGS.en[k] || k;
    if (vars) for (const v in vars) s = s.replace('{' + v + '}', vars[v]);
    return s;
  };
  const L = (o) => (o ? o[lang] || o.en : '');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const conceptOf = (id) => CONCEPTS.find((c) => c.id === id);

  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('title');
  }

  // ---------- sound ----------
  let actx = null;
  function tone(freq, dur = 0.12, type = 'sine', when = 0, vol = 0.15) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      const t0 = actx.currentTime + when;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g).connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* no audio */ }
  }
  const sfx = {
    gem() { tone(880, 0.1, 'triangle'); tone(1320, 0.15, 'triangle', 0.08); },
    fail() { tone(220, 0.2, 'sawtooth', 0, 0.08); tone(150, 0.3, 'sawtooth', 0.15, 0.08); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', i * 0.11)); },
    tap() { tone(600, 0.05, 'square', 0, 0.04); },
  };

  // ---------- robot art ----------
  const ROBOT_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <rect x="18" y="6" width="56" height="15" rx="6" fill="#1f2937"/>
    <rect x="18" y="79" width="56" height="15" rx="6" fill="#1f2937"/>
    <rect x="10" y="15" width="76" height="70" rx="24" fill="#22D3EE" stroke="#0A0D14" stroke-width="4"/>
    <rect x="54" y="28" width="24" height="44" rx="11" fill="#0A0D14"/>
    <circle cx="67" cy="40" r="5.5" fill="#a5f3fc"/><circle cx="67" cy="60" r="5.5" fill="#a5f3fc"/>
    <circle cx="30" cy="50" r="8" fill="#F26A1B"/>
    <polygon points="97,50 86,40 86,60" fill="#F26A1B" stroke="#0A0D14" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
  const FACE_SVG = `<svg viewBox="0 0 120 120" aria-hidden="true">
    <line x1="60" y1="8" x2="60" y2="24" stroke="#0A0D14" stroke-width="5" stroke-linecap="round"/>
    <circle cx="60" cy="8" r="7" fill="#F26A1B" stroke="#0A0D14" stroke-width="3"/>
    <rect x="14" y="24" width="92" height="78" rx="26" fill="#22D3EE" stroke="#0A0D14" stroke-width="5"/>
    <rect x="26" y="40" width="68" height="34" rx="16" fill="#0A0D14"/>
    <circle cx="45" cy="57" r="8" fill="#a5f3fc"/><circle cx="75" cy="57" r="8" fill="#a5f3fc"/>
    <path d="M46 86 Q60 96 74 86" stroke="#0A0D14" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="4" y="50" width="12" height="24" rx="5" fill="#7C3AED" stroke="#0A0D14" stroke-width="3"/>
    <rect x="104" y="50" width="12" height="24" rx="5" fill="#7C3AED" stroke="#0A0D14" stroke-width="3"/>
  </svg>`;

  // ---------- blocks ----------
  const DEFS = {
    move: { cat: 'motion' }, turnL: { cat: 'motion' }, turnR: { cat: 'motion' }, jump: { cat: 'motion' },
    goto: { cat: 'pos' },
    repeat: { cat: 'loop', body: true }, until: { cat: 'loop', body: true },
    if: { cat: 'cond', body: true, else: true },
    set: { cat: 'var' }, change: { cat: 'var' }, moveVar: { cat: 'var' },
    call: { cat: 'fn' },
  };
  const ALL_BLOCKS = ['move', 'turnL', 'turnR', 'jump', 'goto', 'repeat', 'until', 'if', 'set', 'change', 'moveVar', 'call'];

  let uid = 1;
  function newBlock(type, extra) {
    const b = { id: 'b' + uid++, type };
    if (type === 'goto') { b.x = 0; b.y = 0; }
    if (type === 'repeat') b.n = 3;
    if (type === 'set') b.n = 1;
    if (type === 'change') b.n = 1;
    if (type === 'if') b.cond = (level && level.conds && level.conds[0]) || 'wall';
    if (DEFS[type].body) b.body = [];
    if (DEFS[type].else) b.else = [];
    return Object.assign(b, extra || {});
  }
  function hydrate(list) {
    return (list || []).map((raw) => {
      const b = newBlock(raw.type);
      for (const k of ['n', 'x', 'y', 'cond']) if (raw[k] !== undefined) b[k] = raw[k];
      if (b.body) b.body = hydrate(raw.body);
      if (b.else) b.else = hydrate(raw.else);
      return b;
    });
  }
  const strip = (list) => list.map((b) => {
    const o = { type: b.type };
    for (const k of ['n', 'x', 'y', 'cond']) if (b[k] !== undefined) o[k] = b[k];
    if (b.body) o.body = strip(b.body);
    if (b.else) o.else = strip(b.else);
    return o;
  });
  const countList = (list) => list.reduce((s, b) => s + 1 + (b.body ? countList(b.body) : 0) + (b.else ? countList(b.else) : 0), 0);
  const usesType = (list, type) => list.some((b) => b.type === type || (b.body && usesType(b.body, type)) || (b.else && usesType(b.else, type)));

  function labelHTML(b, live) {
    const num = (f, min, max) => live
      ? `<input class="num" type="number" inputmode="numeric" data-field="${f}" value="${b[f]}" min="${min}" max="${max}">`
      : `<span class="num">${b[f]}</span>`;
    const v = `<span class="var">${t('var')}</span>`;
    switch (b.type) {
      case 'move': return `<span class="ic">➜</span>${t('b_move')}`;
      case 'turnL': return `<span class="ic">↺</span>${t('b_turnL')}`;
      case 'turnR': return `<span class="ic">↻</span>${t('b_turnR')}`;
      case 'jump': return `<span class="ic">🦘</span>${t('b_jump')} 🌊`;
      case 'goto': return `<span class="ic">📍</span>${t('b_goto')} <b>${t('x')}</b>${num('x', 0, 19)} <b>${t('y')}</b>${num('y', 0, 19)}`;
      case 'repeat': return `<span class="ic">🔁</span>${t('b_repeat1')} ${num('n', 0, 30)} ${t('b_repeat2')}`;
      case 'until': return `<span class="ic">🔁</span>${t('b_until')}`;
      case 'if': {
        const conds = (level && level.conds) || ['wall', 'water'];
        const sel = live
          ? `<select data-field="cond">${conds.map((c) => `<option value="${c}"${c === b.cond ? ' selected' : ''}>${t('c_' + c)}</option>`).join('')}</select>`
          : `<span class="num">${t('c_' + b.cond)}</span>`;
        return `<span class="ic">🚦</span>${t('b_if')} ${sel}`;
      }
      case 'set': return `<span class="ic">📦</span>${t('b_set1')} ${v} ${t('b_set2')} ${num('n', -20, 20)}`;
      case 'change': return `<span class="ic">📦</span>${t('b_change1')} ${v} ${t('b_change2')} ${num('n', -20, 20)}`;
      case 'moveVar': return `<span class="ic">➜</span>${t('b_moveVar1')} ${v} ${t('b_moveVar2')}`;
      case 'call': return `<span class="ic">🧩</span>${t('fnName')}()`;
    }
    return b.type;
  }

  // ---------- python view ----------
  function py(list, ind) {
    const p = '    '.repeat(ind);
    const out = [];
    for (const b of list) {
      switch (b.type) {
        case 'move': out.push(p + 'move()'); break;
        case 'turnL': out.push(p + 'turn_left()'); break;
        case 'turnR': out.push(p + 'turn_right()'); break;
        case 'jump': out.push(p + 'jump()'); break;
        case 'goto': out.push(`${p}go_to(${b.x}, ${b.y})`); break;
        case 'repeat': out.push(`${p}for i in range(${b.n}):`, ...pyBody(b.body, ind + 1)); break;
        case 'until': out.push(`${p}while not at_goal():`, ...pyBody(b.body, ind + 1)); break;
        case 'if':
          out.push(`${p}if ${b.cond}_ahead():`, ...pyBody(b.body, ind + 1));
          if (b.else.length) out.push(`${p}else:`, ...pyBody(b.else, ind + 1));
          break;
        case 'set': out.push(`${p}steps = ${b.n}`); break;
        case 'change': out.push(b.n < 0 ? `${p}steps = steps - ${-b.n}` : `${p}steps = steps + ${b.n}`); break;
        case 'moveVar': out.push(p + 'move(steps)'); break;
        case 'call': out.push(p + 'my_move()'); break;
      }
    }
    return out;
  }
  const pyBody = (list, ind) => (list.length ? py(list, ind) : ['    '.repeat(ind) + 'pass']);

  // ---------- maps ----------
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]; // E N W S
  function parseMap(rows) {
    const h = rows.length, w = rows[0].length;
    const cells = [], gems = new Set();
    let start = { x: 0, y: 0 };
    for (let r = 0; r < h; r++) {
      const y = h - 1 - r;
      cells[y] = [];
      for (let x = 0; x < w; x++) {
        let ch = rows[r][x] || '.';
        if (ch === 'S') { start = { x, y }; ch = '.'; }
        if (ch === '*') { gems.add(x + ',' + y); ch = '.'; }
        cells[y][x] = ch;
      }
    }
    return { w, h, cells, gems, start, hasGoal: rows.some((r) => r.includes('G')) };
  }

  // ---------- state ----------
  let level = null, levelIdx = -1, isSandbox = false;
  let prog = { main: [], fn: [] };
  let activeCid = 'main';
  let variant = 0;
  let map = null;     // parsed current variant
  let W = null;       // live world
  let running = false, runToken = 0, fails = 0, cellPx = 48;
  let sandboxRows = store.get('sandbox', SANDBOX_DEFAULT);

  const levelMaps = () => (isSandbox ? [sandboxRows] : level.maps);
  const hasFn = () => level.blocks.includes('call');
  const usesVar = () => level.blocks.includes('set') || level.blocks.includes('moveVar');

  // ======================================================================
  // HOME
  // ======================================================================
  // big face for the home page; the pupils follow the pointer
  const HERO_FACE = `<svg viewBox="0 0 120 120" aria-hidden="true">
    <line x1="60" y1="8" x2="60" y2="24" stroke="#0A0D14" stroke-width="5" stroke-linecap="round"/>
    <circle cx="60" cy="8" r="7" fill="#F26A1B" stroke="#0A0D14" stroke-width="3" class="antenna"/>
    <rect x="14" y="24" width="92" height="78" rx="26" fill="#22D3EE" stroke="#0A0D14" stroke-width="5"/>
    <rect x="26" y="40" width="68" height="34" rx="16" fill="#0A0D14"/>
    <g class="pupils"><circle cx="45" cy="57" r="8" fill="#a5f3fc"/><circle cx="75" cy="57" r="8" fill="#a5f3fc"/></g>
    <path d="M46 86 Q60 96 74 86" stroke="#0A0D14" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="4" y="50" width="12" height="24" rx="5" fill="#7C3AED" stroke="#0A0D14" stroke-width="3"/>
    <rect x="104" y="50" width="12" height="24" rx="5" fill="#7C3AED" stroke="#0A0D14" stroke-width="3"/>
  </svg>`;
  // a little isometric block for the sky
  const cube = (top, left, right) => `<svg viewBox="0 0 60 64"><path d="M30 2 58 17 30 32 2 17Z" fill="${top}"/><path d="M2 17 30 32v30L2 47Z" fill="${left}"/><path d="M58 17 30 32v30l28-15Z" fill="${right}"/></svg>`;
  const SKY_CUBES = [
    ['#5DBB4C', '#8B5E3C', '#6b4426', 6, 22, 64, 1.2], ['#EED89A', '#d9c07a', '#bfa45e', 84, 16, 54, 0.8],
    ['#F5FAFF', '#8B5E3C', '#6b4426', 92, 64, 44, 1.5], ['#8B5CF6', '#8B5E3C', '#6b4426', 14, 76, 40, 1.8],
    ['#9AA3AE', '#7d8691', '#646d78', 70, 82, 36, 2.2], ['#F26A1B', '#c9520f', '#a8430b', 46, 8, 30, 2.6],
    ['#22D3EE', '#0ea5b7', '#0b8696', 30, 88, 28, 2.4], ['#FACC15', '#d4a90e', '#b08a08', 60, 40, 24, 3],
  ];

  function renderHome() {
    level = null; running = false; runToken++;
    applyLang();
    const firstOpen = LEVELS.findIndex((l) => !progress[l.id]);
    const anyDone = LEVELS.some((l) => progress[l.id]);
    const wdone = store.get('world:done', {});
    const lvStars = LEVELS.reduce((a, l) => a + (progress[l.id] || 0), 0);
    const wStars = WORLD_TASKS.reduce((a, tk) => a + (wdone[tk.c] || 0), 0);
    const pct = Math.round((lvStars + wStars) / ((LEVELS.length + WORLD_TASKS.length) * 3) * 100);
    let n = 0;
    app.innerHTML = `
      <div class="home">
      <section class="hero2" id="hero">
        <div class="sky" aria-hidden="true">
          <i class="cloud c1"></i><i class="cloud c2"></i><i class="cloud c3"></i>
          ${SKY_CUBES.map(([a, b, c, x, y, size, depth], i) => `<button class="sky-cube" tabindex="-1" data-depth="${depth}" style="left:${x}%;top:${y}%;width:${size}px;animation-delay:-${i * 0.7}s">${cube(a, b, c)}</button>`).join('')}
        </div>
        <header class="home-top">
          <div class="brand"><span class="mini">${FACE_SVG}</span><b>${t('title')}</b></div>
          <div class="top-actions">${topButtons()}</div>
        </header>
        <div class="hero2-in">
          <div class="hero2-text">
            <span class="tag">${t('h_tag')}</span>
            <h1>${t('title')}</h1>
            <p>${t('subtitle')}</p>
            <div class="hero-btns">
              <button class="btn big run" id="worldBtn">${t('w_btn')}</button>
              <button class="btn big" id="startBtn">${anyDone ? t('continue') : t('start')}</button>
            </div>
            <div class="progress" title="${pct}%"><span style="width:${pct}%"></span><b>★ ${lvStars + wStars} / ${(LEVELS.length + WORLD_TASKS.length) * 3}</b></div>
          </div>
          <button class="hero2-face" id="heroFace" aria-label="Fahim">${HERO_FACE}<span class="bubble" id="faceSay">${t('h_hi')}</span></button>
        </div>
      </section>

      <section class="island-card" id="islandCard">
        <div class="ic-text">
          <h2>🏝️ ${t('w_title')}</h2>
          <p>${t('w_desc')}</p>
          <button class="btn run" id="worldBtn2">${t('h_play')}</button>
        </div>
        <div class="ic-isles">
          ${WORLD_TASKS.map((tk, i) => {
            const c = conceptOf(tk.c), st = wdone[tk.c] || 0;
            const open = i === 0 || (wdone[WORLD_TASKS[i - 1].c] || 0) > 0;
            return `<button class="isle${st ? ' done' : ''}${open ? '' : ' locked'}" style="--c:${c.color}" data-isle="${i}">
              <span class="isle-top">${open ? tk.icon : '🔒'}</span>
              <span class="isle-name">${L(tk.title)}</span>
              <span class="lv-s">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></span></button>`;
          }).join('')}
        </div>
      </section>

      <div class="sec-head"><h2>🧩 ${t('h_levels')}</h2><p>${t('h_levelsSub')}</p></div>
      ${firstOpen === -1 ? `<p class="done-note">🏆 ${t('allDone')}</p>` : ''}
      <section class="concepts">
        ${CONCEPTS.map((c, ci) => {
          const lv = LEVELS.filter((l) => l.concept === c.id);
          return `<article class="ccard" style="--c:${c.color}">
            <div class="ccard-head"><span class="cicon">${c.icon}</span>
              <div><small>${ci + 1}</small><h2>${L(c.name)}</h2></div>
              <button class="btn ghost sm" data-learn="${c.id}">${t('learn')}</button></div>
            <p>${L(c.what).split('. ')[0]}.</p>
            <div class="lv-row">${lv.map((l) => {
              n++;
              const s = progress[l.id] || 0;
              return `<button class="lv" data-lv="${LEVELS.indexOf(l)}" title="${esc(L(l.title))}">
                <span class="lv-n">${n}</span><span class="lv-t">${L(l.title)}</span>
                <span class="lv-s">${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i></span></button>`;
            }).join('')}</div>
          </article>`;
        }).join('')}
        <article class="ccard sandbox" style="--c:#0A0D14">
          <div class="ccard-head"><span class="cicon">🛠️</span><div><small>★</small><h2>${t('sandbox')}</h2></div></div>
          <p>${t('sandboxDesc')}</p>
          <div class="lv-row"><button class="lv" id="sandboxBtn"><span class="lv-n">∞</span><span class="lv-t">${t('sandbox')}</span></button></div>
        </article>
      </section>
      <footer class="home-foot">${t('h_foot')}</footer>
      </div>`;
    wireTop();
    $('#startBtn').onclick = () => openLevel(firstOpen === -1 ? 0 : firstOpen);
    $('#worldBtn').onclick = openWorld;
    $('#worldBtn2').onclick = openWorld;
    app.querySelectorAll('[data-isle]').forEach((b) => (b.onclick = openWorld));
    app.querySelectorAll('[data-lv]').forEach((b) => (b.onclick = () => openLevel(+b.dataset.lv)));
    app.querySelectorAll('[data-learn]').forEach((b) => (b.onclick = () => showConcept(conceptOf(b.dataset.learn))));
    $('#sandboxBtn').onclick = openSandbox;
    wireHero();
  }

  // home page fun: eyes follow the pointer, blocks drift (parallax) and pop when tapped, Fahim talks
  function wireHero() {
    const hero = $('#hero'), pupils = $('#heroFace .pupils'), cubes = [...hero.querySelectorAll('.sky-cube')];
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      cubes.forEach((c) => c.style.translate = `${-nx * 30 * c.dataset.depth}px ${-ny * 20 * c.dataset.depth}px`);
      const f = $('#heroFace').getBoundingClientRect(), dx = e.clientX - (f.left + f.width / 2), dy = e.clientY - (f.top + f.height / 2), d = Math.hypot(dx, dy) || 1;
      pupils.setAttribute('transform', `translate(${(dx / d) * Math.min(4, d / 40)} ${(dy / d) * Math.min(3, d / 40)})`);
    });
    cubes.forEach((c, i) => (c.onclick = () => {
      c.classList.remove('popped'); void c.offsetWidth; c.classList.add('popped');
      tone(400 + i * 90, 0.12, 'triangle'); tone(600 + i * 90, 0.12, 'triangle', 0.06);
    }));
    const lines = [t('h_hi'), t('h_say1'), t('h_say2'), t('h_say3')];
    let k = 0;
    $('#heroFace').onclick = () => {
      k = (k + 1) % lines.length;
      const b = $('#faceSay'); b.textContent = lines[k]; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
      $('#heroFace').classList.remove('wiggle'); void $('#heroFace').offsetWidth; $('#heroFace').classList.add('wiggle');
      sfx.gem();
    };
  }

  function topButtons() {
    return `<button class="btn ghost" id="langBtn">${t('langBtn')}</button>
      <button class="btn ghost icon" id="muteBtn" title="sound">${muted ? '🔇' : '🔊'}</button>`;
  }
  function wireTop() {
    $('#langBtn').onclick = () => { lang = lang === 'en' ? 'ar' : 'en'; store.set('lang', lang); level ? renderLevel() : renderHome(); };
    $('#muteBtn').onclick = (e) => { muted = !muted; store.set('muted', muted); e.currentTarget.textContent = muted ? '🔇' : '🔊'; };
  }

  // ======================================================================
  // CUBE ISLAND (3D world, world.js)
  // ======================================================================
  function openWorld() {
    level = null; running = false; runToken++; closeModal();
    applyLang();
    app.innerHTML = '';
    CubeIsland.open();
  }
  CubeIsland.init({
    t, L, store, sfx, tone,
    lang: () => lang,
    muted: () => muted,
    progress: () => progress,
    toggleLang() { lang = lang === 'en' ? 'ar' : 'en'; store.set('lang', lang); applyLang(); },
    toggleMute() { muted = !muted; store.set('muted', muted); },
    home: renderHome,
    confetti: () => confetti(),
    showConcept: (c) => showConcept(c),
  });

  // ======================================================================
  // MODALS
  // ======================================================================
  const modal = $('#modal'), modalCard = $('#modalCard');
  function openModal(html, wire) {
    modalCard.innerHTML = html;
    modal.classList.remove('hidden');
    if (wire) wire(modalCard);
  }
  function closeModal() { modal.classList.add('hidden'); }
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  function showConcept(c, onGo) {
    openModal(`
      <div class="concept-modal" style="--c:${c.color}">
        <div class="cm-icon">${c.icon}</div>
        <h2>${L(c.name)}</h2>
        <p class="cm-what">${L(c.what)}</p>
        <div class="cm-grid">
          <div><h4>🌍 ${t('inLife')}</h4><p>${L(c.life)}</p></div>
          <div><h4>💻 ${t('inCode')}</h4><pre dir="ltr">${esc(c.code)}</pre></div>
        </div>
        <details class="tip"><summary>${t('teacherTip')}</summary><p>${L(c.tip)}</p></details>
        <button class="btn big run" id="goBtn">${t('letsGo')}</button>
      </div>`, (m) => { $('#goBtn', m).onclick = () => { closeModal(); onGo && onGo(); }; });
  }

  // ======================================================================
  // LEVEL SCREEN
  // ======================================================================
  function openLevel(i) {
    isSandbox = false;
    levelIdx = i; level = LEVELS[i]; variant = 0; fails = 0; activeCid = 'main';
    const saved = store.get('prog:' + level.id, null);
    prog = saved
      ? { main: hydrate(saved.main), fn: hydrate(saved.fn) }
      : { main: hydrate(level.starter), fn: [] };
    renderLevel();
    if (!seen[level.concept]) {
      seen[level.concept] = true; store.set('seen', seen);
      showConcept(conceptOf(level.concept));
    }
  }
  function openSandbox() {
    isSandbox = true; levelIdx = -1; variant = 0; fails = 0; activeCid = 'main';
    level = {
      id: 'sandbox', concept: null, blocks: ALL_BLOCKS.slice(), conds: ['wall', 'water'],
      title: { en: STRINGS.en.sandbox, ar: STRINGS.ar.sandbox },
      goal: { en: STRINGS.en.sandboxHelp, ar: STRINGS.ar.sandboxHelp },
    };
    const saved = store.get('prog:sandbox', null);
    prog = saved ? { main: hydrate(saved.main), fn: hydrate(saved.fn) } : { main: [], fn: [] };
    renderLevel();
  }

  function renderLevel() {
    applyLang();
    running = false; runToken++;
    const c = level.concept ? conceptOf(level.concept) : { color: '#0A0D14', icon: '🛠️', name: { en: STRINGS.en.sandbox, ar: STRINGS.ar.sandbox } };
    const maps = levelMaps();
    app.innerHTML = `
      <header class="topbar" style="--c:${c.color}">
        <button class="btn ghost" id="backBtn">${t('map')}</button>
        <div class="lvl-title">
          <button class="chip" id="conceptBtn" ${level.concept ? '' : 'disabled'}>${c.icon} ${L(c.name)}</button>
          <h1>${isSandbox ? '' : levelIdx + 1 + '. '}${L(level.title)}</h1>
        </div>
        <div class="top-actions">${topButtons()}</div>
      </header>
      <main class="level" style="--c:${c.color}">
        <section class="left">
          <div class="mission"><span>🎯</span><p>${L(level.goal)}</p></div>
          ${maps.length > 1 ? `<div class="variants">${maps.map((_, i) => `<button class="vbtn${i === variant ? ' on' : ''}" data-v="${i}">${t('road', { n: i + 1 })}</button>`).join('')}</div>` : ''}
          <div id="stage" class="stage"></div>
          <div class="stage-info"><span id="coord">${t('hover')}</span><span id="varBox" class="varbox" ${usesVar() ? '' : 'hidden'}></span></div>
          <div id="msg" class="msg" role="status"></div>
          <div class="controls">
            <button class="btn run big" id="runBtn">${t('run')}</button>
            <button class="btn" id="resetBtn">${t('reset')}</button>
            ${level.hint ? `<button class="btn" id="hintBtn">${t('hint')}</button>` : ''}
            <label class="speed">🐢<input type="range" min="1" max="5" id="speed" value="${speed}">🐇</label>
          </div>
        </section>
        <section class="right">
          <div class="card palette-card">
            <h3>${t('blocks')}</h3>
            <div id="palette" class="palette"></div>
            <p class="small">${t('tapHelp')}</p>
          </div>
          <div class="card">
            <div class="prog-head"><h3>${t('program')}</h3><span id="count" class="count"></span><button class="btn sm ghost" id="clearBtn">${t('clear')}</button></div>
            <div id="mainZone"></div>
          </div>
          ${hasFn() ? `<div class="card fn-card"><div class="prog-head"><h3>${t('fnTitle')}: <code>${t('fnName')}()</code></h3></div><div id="fnZone"></div></div>` : ''}
          <details class="card code-card" ${store.get('codeOpen', false) ? 'open' : ''}><summary>${t('code')}</summary><pre id="code" dir="ltr"></pre></details>
        </section>
      </main>`;
    wireTop();
    $('#backBtn').onclick = renderHome;
    if (level.concept) $('#conceptBtn').onclick = () => showConcept(c);
    $('#runBtn').onclick = () => (running ? stopRun() : runProgram());
    $('#resetBtn').onclick = () => { stopRun(); loadVariant(variant); setMsg(''); };
    if ($('#hintBtn')) $('#hintBtn').onclick = () => setMsg('💡 ' + L(level.hint), 'hint');
    $('#speed').oninput = (e) => { speed = +e.target.value; store.set('speed', speed); setDur(); };
    $('#clearBtn').onclick = () => { if (running) return; prog.main = []; prog.fn = []; activeCid = 'main'; renderEditor(); };
    $('.code-card').addEventListener('toggle', (e) => store.set('codeOpen', e.target.open));
    app.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { if (running) return; loadVariant(+b.dataset.v); setMsg(''); }));
    renderPalette();
    renderEditor();
    loadVariant(variant);
  }

  // ---------- palette & editor ----------
  function renderPalette() {
    const pal = $('#palette');
    pal.innerHTML = '';
    level.blocks.forEach((type) => {
      const fake = newBlock(type);
      const d = document.createElement('button');
      d.className = `block pal cat-${DEFS[type].cat}`;
      d.draggable = true;
      d.innerHTML = `<span class="brow">${labelHTML(fake, false)}</span>`;
      d.onclick = () => addBlock(type);
      d.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', 'new:' + type); e.dataTransfer.effectAllowed = 'copyMove'; });
      pal.appendChild(d);
    });
  }

  function findList(cid) {
    if (cid === 'main') return prog.main;
    if (cid === 'fn') return prog.fn;
    const [bid, part] = cid.split(':');
    const b = findBlock(bid);
    return b ? b[part] : null;
  }
  function findBlock(bid, lists = [prog.main, prog.fn]) {
    for (const list of lists) {
      for (const b of list) {
        if (b.id === bid) return b;
        const inner = findBlock(bid, [b.body || [], b.else || []]);
        if (inner) return inner;
      }
    }
    return null;
  }
  function findParent(bid, lists = [prog.main, prog.fn]) {
    for (const list of lists) {
      const i = list.findIndex((b) => b.id === bid);
      if (i >= 0) return list;
      for (const b of list) {
        const p = findParent(bid, [b.body || [], b.else || []]);
        if (p) return p;
      }
    }
    return null;
  }

  function addBlock(type) {
    if (running) return;
    let list = findList(activeCid);
    if (!list) { activeCid = 'main'; list = prog.main; }
    const b = newBlock(type);
    list.push(b);
    sfx.tap();
    // A new container block becomes the place where the next blocks go.
    if (b.body) activeCid = b.id + ':body';
    renderEditor();
    const elx = document.querySelector(`[data-bid="${b.id}"]`);
    if (elx) { elx.classList.add('pop'); elx.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }

  function setActive(cid) {
    activeCid = cid;
    document.querySelectorAll('.zone').forEach((z) => z.classList.toggle('active', z.dataset.cid === cid));
  }

  let dragBid = null;
  function zoneEl(list, cid) {
    const z = document.createElement('div');
    z.className = 'zone' + (cid === activeCid ? ' active' : '') + (cid === 'main' || cid === 'fn' ? ' root' : '');
    z.dataset.cid = cid;
    list.forEach((b) => z.appendChild(blockEl(b)));
    if (!list.length) {
      const e = document.createElement('div');
      e.className = 'zone-empty';
      e.textContent = t('dropHere');
      z.appendChild(e);
    }
    z.addEventListener('click', (e) => {
      if (e.target.closest('input,select,button')) return;
      if (e.target.closest('.zone') !== z) return;
      setActive(cid);
    });
    z.addEventListener('dragover', (e) => {
      e.preventDefault(); e.stopPropagation();
      document.querySelectorAll('.zone.over').forEach((o) => o !== z && o.classList.remove('over'));
      z.classList.add('over');
    });
    z.addEventListener('dragleave', (e) => { if (!z.contains(e.relatedTarget)) z.classList.remove('over'); });
    z.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      z.classList.remove('over');
      if (running) return;
      const data = e.dataTransfer.getData('text/plain');
      const kids = [...z.children].filter((c) => c.classList.contains('block'));
      let idx = list.length;
      const tb = e.target.closest('.block');
      if (tb && tb.parentElement === z) {
        idx = kids.indexOf(tb);
        const r = tb.getBoundingClientRect();
        if (e.clientY > r.top + Math.min(r.height / 2, 24)) idx++;
      }
      if (data.startsWith('new:')) {
        const b = newBlock(data.slice(4));
        list.splice(idx, 0, b);
        if (b.body) activeCid = b.id + ':body';
      } else if (data.startsWith('move:')) {
        const bid = data.slice(5);
        const srcEl = document.querySelector(`[data-bid="${bid}"]`);
        if (!srcEl || srcEl.contains(z)) return; // can't drop a block inside itself
        const src = findParent(bid);
        const blk = findBlock(bid);
        const i = src.indexOf(blk);
        src.splice(i, 1);
        if (src === list && i < idx) idx--;
        list.splice(idx, 0, blk);
      }
      sfx.tap();
      renderEditor();
    });
    return z;
  }

  function blockEl(b) {
    const def = DEFS[b.type];
    const d = document.createElement('div');
    d.className = `block cat-${def.cat}` + (def.body ? ' has-body' : '');
    d.dataset.bid = b.id;
    d.draggable = true;
    const row = document.createElement('div');
    row.className = 'brow';
    row.innerHTML = labelHTML(b, true);
    const del = document.createElement('button');
    del.className = 'bdel';
    del.textContent = '×';
    del.setAttribute('aria-label', 'delete');
    del.onclick = (e) => {
      e.stopPropagation();
      if (running) return;
      const p = findParent(b.id);
      p.splice(p.indexOf(b), 1);
      if (activeCid.startsWith(b.id + ':') || !findList(activeCid)) activeCid = 'main';
      renderEditor();
    };
    row.appendChild(del);
    d.appendChild(row);
    row.querySelectorAll('[data-field]').forEach((inp) => {
      const f = inp.dataset.field;
      const upd = () => {
        if (f === 'cond') b.cond = inp.value;
        else {
          let v = parseInt(inp.value, 10);
          if (isNaN(v)) return;
          v = Math.max(+inp.min, Math.min(+inp.max, v));
          b[f] = v;
        }
        afterEdit();
      };
      inp.addEventListener('input', upd);
      inp.addEventListener('change', () => { upd(); inp.value = b[f]; });
      inp.addEventListener('mousedown', () => (d.draggable = false));
      inp.addEventListener('blur', () => (d.draggable = true));
    });
    d.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      dragBid = b.id;
      e.dataTransfer.setData('text/plain', 'move:' + b.id);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => d.classList.add('dragging'), 0);
    });
    d.addEventListener('dragend', () => { d.classList.remove('dragging'); dragBid = null; });
    if (def.body) d.appendChild(zoneEl(b.body, b.id + ':body'));
    if (def.else) {
      const lab = document.createElement('div');
      lab.className = 'belse';
      lab.textContent = t('b_else');
      d.appendChild(lab);
      d.appendChild(zoneEl(b.else, b.id + ':else'));
    }
    return d;
  }

  function renderEditor() {
    if (!findList(activeCid)) activeCid = 'main';
    $('#mainZone').replaceChildren(zoneEl(prog.main, 'main'));
    if (hasFn()) $('#fnZone').replaceChildren(zoneEl(prog.fn, 'fn'));
    afterEdit();
  }

  function totalBlocks() { return countList(prog.main) + countList(prog.fn); }

  function afterEdit() {
    const n = totalBlocks();
    const cnt = $('#count');
    cnt.textContent = level.limit ? t('countLimit', { n, max: level.limit }) : t('count', { n });
    cnt.classList.toggle('over', !!(level.limit && n > level.limit));
    let code = py(prog.main, 0);
    if (hasFn() && prog.fn.length) code = ['def my_move():', ...pyBody(prog.fn, 1), '', ...code];
    $('#code').textContent = code.join('\n') || '# …';
    store.set('prog:' + level.id, { main: strip(prog.main), fn: strip(prog.fn) });
  }

  // ---------- stage ----------
  function loadVariant(i) {
    variant = i;
    map = parseMap(levelMaps()[i]);
    W = {
      x: map.start.x, y: map.start.y, dir: 0, angle: 0,
      gems: new Set(map.gems), vars: { steps: 0 }, steps: 0, depth: 0,
    };
    app.querySelectorAll('.vbtn').forEach((b) => b.classList.toggle('on', +b.dataset.v === i));
    buildStage();
  }

  function buildStage() {
    const stage = $('#stage');
    const avail = Math.max(200, stage.clientWidth - 72);
    const maxH = Math.max(220, Math.min(window.innerHeight * 0.55, 480));
    cellPx = Math.floor(Math.max(28, Math.min(72, avail / map.w, maxH / map.h)));
    stage.style.setProperty('--cell', cellPx + 'px');
    let cells = '';
    for (let r = 0; r < map.h; r++) {
      const y = map.h - 1 - r;
      for (let x = 0; x < map.w; x++) {
        const ch = map.cells[y][x];
        const cls = ch === '#' ? 'wall' : ch === '~' ? 'water' : ch === 'G' ? 'goal' : '';
        const isGem = map.gems.has(x + ',' + y);
        cells += `<div class="cell ${cls} ${(x + y) % 2 ? 'alt' : ''}" data-x="${x}" data-y="${y}">${
          ch === 'G' ? '<span class="flag">🏁</span>' : ''}${isGem ? `<span class="gem" data-g="${x},${y}">⭐</span>` : ''}</div>`;
      }
    }
    const ylab = Array.from({ length: map.h }, (_, r) => `<span>${map.h - 1 - r}</span>`).join('');
    const xlab = Array.from({ length: map.w }, (_, x) => `<span>${x}</span>`).join('');
    stage.innerHTML = `
      <div class="board-wrap" dir="ltr">
        <div class="ylab"><em>${t('y')}↑</em>${ylab}</div>
        <div class="board" style="grid-template-columns:repeat(${map.w},var(--cell))">
          ${cells}
          <div class="robot" id="robot"><div class="robot-rot" id="robotRot">${ROBOT_SVG}</div></div>
        </div>
        <div></div>
        <div class="xlab">${xlab}<em>${t('x')}→</em></div>
      </div>`;
    setDur();
    drawRobot(true);
    drawVars();
    const coord = $('#coord');
    stage.querySelectorAll('.cell').forEach((cel) => {
      cel.addEventListener('mouseenter', () => { coord.innerHTML = `📍 <b>(${cel.dataset.x}, ${cel.dataset.y})</b>`; });
      cel.addEventListener('touchstart', () => { coord.innerHTML = `📍 <b>(${cel.dataset.x}, ${cel.dataset.y})</b>`; }, { passive: true });
      if (isSandbox) cel.addEventListener('click', () => sandboxPaint(+cel.dataset.x, +cel.dataset.y));
    });
    stage.classList.toggle('editable', isSandbox);
  }

  function sandboxPaint(x, y) {
    if (running) return;
    if (x === map.start.x && y === map.start.y) return;
    const r = map.h - 1 - y;
    const order = ['.', '#', '*', '~', 'G'];
    const rows = sandboxRows.slice();
    const cur = rows[r][x];
    let next = order[(order.indexOf(cur) + 1) % order.length];
    // only one flag
    if (next === 'G') {
      for (let i = 0; i < rows.length; i++) rows[i] = rows[i].replace('G', '.');
    }
    rows[r] = rows[r].slice(0, x) + next + rows[r].slice(x + 1);
    sandboxRows = rows;
    store.set('sandbox', sandboxRows);
    sfx.tap();
    loadVariant(0);
  }

  const delay = () => [0, 750, 480, 300, 170, 70][speed];
  function setDur() { const s = $('#stage'); if (s) s.style.setProperty('--dur', Math.round(delay() * 0.85) + 'ms'); }

  function drawRobot(instant) {
    const r = $('#robot'), rr = $('#robotRot');
    if (!r) return;
    if (instant) { r.classList.add('instant'); }
    r.style.transform = `translate(${W.x * cellPx}px, ${(map.h - 1 - W.y) * cellPx}px)`;
    rr.style.transform = `rotate(${-W.angle}deg)`;
    if (instant) { void r.offsetWidth; r.classList.remove('instant'); }
  }
  function drawGems() {
    document.querySelectorAll('.gem').forEach((g) => g.classList.toggle('got', !W.gems.has(g.dataset.g)));
  }
  function drawVars(flash) {
    const vb = $('#varBox');
    if (!vb || vb.hidden) return;
    vb.innerHTML = `📦 <span class="var">${t('var')}</span> = <b>${W.vars.steps}</b>`;
    if (flash) { vb.classList.remove('flash'); void vb.offsetWidth; vb.classList.add('flash'); }
  }
  function highlight(bid, cls = 'running') {
    document.querySelectorAll('.block.' + cls).forEach((e) => e.classList.remove(cls));
    if (bid) { const e = document.querySelector(`.block[data-bid="${bid}"]`); if (e) e.classList.add(cls); }
  }
  function setMsg(text, kind = '') {
    const m = $('#msg');
    if (!m) return;
    m.className = 'msg ' + kind;
    m.textContent = text;
  }

  // ---------- interpreter ----------
  class Fail { constructor(reason, bid) { this.reason = reason; this.bid = bid; } }
  const MAX_STEPS = 500;

  const cellAt = (x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? null : map.cells[y][x]);
  const tick = (S, bid) => { if (++S.steps > MAX_STEPS) throw new Fail('dizzy', bid); };
  function collect(S) {
    const k = S.x + ',' + S.y;
    if (S.gems.has(k)) { S.gems.delete(k); return true; }
    return false;
  }
  function checkCond(S, cond) {
    const c = cellAt(S.x + DX[S.dir], S.y + DY[S.dir]);
    if (cond === 'wall') return c === null || c === '#';
    if (cond === 'water') return c === '~';
    return false;
  }

  function* stepForward(S, bid) {
    const nx = S.x + DX[S.dir], ny = S.y + DY[S.dir];
    const c = cellAt(nx, ny);
    if (c === null) throw new Fail('edge', bid);
    if (c === '#') throw new Fail('wall', bid);
    S.x = nx; S.y = ny;
    if (c === '~') throw new Fail('water', bid);
    yield { bid, gem: collect(S) };
  }

  function* exec(list, S) {
    for (const b of list) {
      tick(S, b.id);
      switch (b.type) {
        case 'move': yield* stepForward(S, b.id); break;
        case 'turnL': S.dir = (S.dir + 1) % 4; S.angle += 90; yield { bid: b.id }; break;
        case 'turnR': S.dir = (S.dir + 3) % 4; S.angle -= 90; yield { bid: b.id }; break;
        case 'jump': {
          const mx = S.x + DX[S.dir], my = S.y + DY[S.dir];
          const lx = S.x + 2 * DX[S.dir], ly = S.y + 2 * DY[S.dir];
          const mid = cellAt(mx, my), land = cellAt(lx, ly);
          if (mid === '#') throw new Fail('wall', b.id);
          if (land === null || land === '#' || mid === null) throw new Fail('badJump', b.id);
          S.x = lx; S.y = ly;
          if (land === '~') throw new Fail('water', b.id);
          yield { bid: b.id, gem: collect(S), jump: true };
          break;
        }
        case 'goto': {
          const c = cellAt(b.x, b.y);
          if (c === null) throw new Fail('edge', b.id);
          if (c === '#') throw new Fail('wall', b.id);
          S.x = b.x; S.y = b.y;
          if (c === '~') throw new Fail('water', b.id);
          yield { bid: b.id, gem: collect(S), glide: true };
          break;
        }
        case 'repeat':
          for (let i = 0; i < b.n; i++) { tick(S, b.id); yield { bid: b.id, think: true }; yield* exec(b.body, S); }
          break;
        case 'until':
          while (cellAt(S.x, S.y) !== 'G') { tick(S, b.id); yield { bid: b.id, think: true }; yield* exec(b.body, S); }
          break;
        case 'if':
          yield { bid: b.id, think: true };
          yield* exec(checkCond(S, b.cond) ? b.body : b.else, S);
          break;
        case 'set': S.vars.steps = b.n; yield { bid: b.id, vars: true }; break;
        case 'change': S.vars.steps += b.n; yield { bid: b.id, vars: true }; break;
        case 'moveVar':
          if (S.vars.steps <= 0) yield { bid: b.id };
          for (let i = 0; i < S.vars.steps; i++) yield* stepForward(S, b.id);
          break;
        case 'call':
          if (++S.depth > 30) throw new Fail('dizzy', b.id);
          yield { bid: b.id, think: true };
          yield* exec(prog.fn, S);
          S.depth--;
          break;
      }
    }
  }

  // ---------- runner ----------
  function lockUI(on) {
    document.body.classList.toggle('is-running', on);
    const rb = $('#runBtn');
    if (rb) { rb.textContent = on ? t('stop') : t('run'); rb.classList.toggle('stop', on); }
  }
  function stopRun() {
    if (!running) return;
    runToken++; running = false; lockUI(false); highlight(null);
    setMsg(t('stopped'));
  }

  async function runVariant(vi, token) {
    loadVariant(vi);
    await sleep(120);
    const S = W;
    const gen = exec(prog.main, S);
    while (true) {
      if (token !== runToken) return { stopped: true };
      let r;
      try { r = gen.next(); } catch (err) {
        if (!(err instanceof Fail)) throw err;
        highlight(err.bid);
        highlight(err.bid, 'failed');
        drawRobot();
        await sleep(delay() * 0.8);
        const rob = $('#robot');
        rob.classList.add(err.reason === 'water' ? 'sink' : 'bump');
        sfx.fail();
        return { ok: false, reason: err.reason };
      }
      if (r.done) break;
      const a = r.value;
      highlight(a.bid);
      const rob = $('#robot');
      rob.classList.toggle('jumping', !!a.jump);
      rob.classList.toggle('gliding', !!a.glide);
      drawRobot();
      if (a.vars) drawVars(true);
      if (a.gem) { sfx.gem(); drawGems(); burstAt(S.x, S.y); }
      await sleep(a.think ? delay() * 0.45 : a.glide ? delay() * 1.4 : delay());
    }
    highlight(null);
    if (S.gems.size) return { ok: false, reason: 'gemsLeft' };
    if (map.hasGoal && cellAt(S.x, S.y) !== 'G') return { ok: false, reason: 'notGoal' };
    return { ok: true };
  }

  async function runProgram() {
    const n = totalBlocks();
    if (!n) { setMsg(t('empty'), 'bad'); return; }
    if (level.limit && n > level.limit) { setMsg(t('overLimit', { max: level.limit }), 'bad'); sfx.fail(); return; }
    if (level.mustUse && !usesType(prog.main, level.mustUse)) { setMsg(t('mustUse'), 'bad'); sfx.fail(); return; }
    running = true; lockUI(true); setMsg(''); highlight(null, 'failed');
    const token = ++runToken;
    const total = levelMaps().length;
    const order = [variant, ...Array.from({ length: total }, (_, i) => i).filter((i) => i !== variant)];
    for (let k = 0; k < order.length; k++) {
      if (k > 0) {
        setMsg(t('testing', { n: order[k - 1] + 1, m: order[k] + 1 }), 'good');
        await sleep(900);
        if (token !== runToken) return;
      }
      const res = await runVariant(order[k], token);
      if (res.stopped) return;
      if (!res.ok) {
        running = false; lockUI(false);
        fails++;
        setMsg((total > 1 ? t('road', { n: order[k] + 1 }) + ': ' : '') + t(res.reason), 'bad');
        if (fails >= 2 && $('#hintBtn')) $('#hintBtn').classList.add('glow');
        return;
      }
    }
    running = false; lockUI(false);
    onWin(n);
  }

  function onWin(n) {
    sfx.win(); confetti();
    if (isSandbox) { setMsg(t('win'), 'good'); return; }
    const stars = !level.optimal || n <= level.optimal ? 3 : n <= level.optimal + 2 ? 2 : 1;
    progress[level.id] = Math.max(progress[level.id] || 0, stars);
    store.set('progress', progress);
    setMsg(t('win'), 'good');
    const c = conceptOf(level.concept);
    const next = LEVELS[levelIdx + 1];
    const lastOfConcept = !next || next.concept !== level.concept;
    setTimeout(() => openModal(`
      <div class="win-modal" style="--c:${c.color}">
        <div class="win-face">${FACE_SVG}</div>
        <h2>${t('win')}</h2>
        <div class="stars">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}" style="animation-delay:${i * 0.15}s">★</span>`).join('')}</div>
        <p class="small">${t('count', { n })}${level.optimal && n > level.optimal ? ' · 🎯 ' + level.optimal : ''}</p>
        ${lastOfConcept ? `<div class="learned"><b>${c.icon} ${t('learned', { c: L(c.name) })}</b><pre dir="ltr">${esc(c.code)}</pre></div>` : ''}
        <div class="win-actions">
          <button class="btn" id="wReplay">${t('replay')}</button>
          <button class="btn" id="wMap">${t('toMap')}</button>
          ${next ? `<button class="btn run" id="wNext">${t('next')}</button>` : `<button class="btn run" id="wFree">${t('sandbox')} 🛠️</button>`}
        </div>
      </div>`, (m) => {
      $('#wReplay', m).onclick = () => { closeModal(); loadVariant(0); setMsg(''); };
      $('#wMap', m).onclick = () => { closeModal(); renderHome(); };
      if (next) $('#wNext', m).onclick = () => { closeModal(); openLevel(levelIdx + 1); };
      else $('#wFree', m).onclick = () => { closeModal(); openSandbox(); };
    }), 700);
  }

  // ---------- effects ----------
  function burstAt(x, y) {
    const board = $('.board');
    if (!board) return;
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      s.textContent = '✨';
      s.style.left = (x + 0.5) * cellPx + 'px';
      s.style.top = (map.h - 1 - y + 0.5) * cellPx + 'px';
      s.style.setProperty('--dx', (Math.random() * 2 - 1) * cellPx + 'px');
      s.style.setProperty('--dy', (Math.random() * 2 - 1) * cellPx + 'px');
      board.appendChild(s);
      setTimeout(() => s.remove(), 700);
    }
  }
  function confetti() {
    const box = $('#confetti');
    const colors = ['#F26A1B', '#22D3EE', '#7C3AED', '#FACC15', '#22C55E', '#EC4899'];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * 0.5 + 's';
      p.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(p);
      setTimeout(() => p.remove(), 3600);
    }
  }

  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { if (level && !running && $('#stage')) buildStage(); }, 150);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  renderHome();
})();
