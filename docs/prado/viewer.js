(() => {
  'use strict';

  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d', {alpha: false});
  const label = document.querySelector('#hover-label');
  const status = document.querySelector('#status');
  const map = globalThis.ISOCITY_MAP;
  // World mode (several tiles): ISOCITY_WORLD is the folder with meta.json and the block pyramid.
  const worldBase = globalThis.ISOCITY_WORLD;
  let world = null;
  const blocks = new Map();   // 'level/x_y' -> {img, used}: decoded level blocks, least recently used evicted
  const picks = new Map();    // 'x_y' -> {data, width, used}: id pixels of one full-resolution block
  let tick = 0;
  let image, picking, frame;
  let scale = 1, x = 0, y = 0, width = 0, height = 0, dpr = 1;
  let hover = null, gesture = null, tap = null, touchLabel = false;
  const touchOnly = matchMedia('(hover: none)');
  const pointers = new Map();

  function draw() {
    frame = undefined;
    ctx.fillStyle = '#b5c39f';
    ctx.fillRect(0, 0, width, height);
    if (world) drawWorld();
    else if (image) ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
    label.style.display = 'none';
    if (!hover || pointers.size || !(picking || world)) return;
    const px = Math.floor((hover.x - x) / scale);
    const py = Math.floor((hover.y - y) / scale);
    if (px < 0 || py < 0 || px >= image.width || py >= image.height) return;
    const name = world ? worldName(px, py) : singleName(px, py);
    if (!name) return;
    label.textContent = name;
    label.classList.toggle('touch', touchLabel);
    label.style.display = 'block';
    // Keep the label inside the screen; on touch it sits above the finger.
    const w = label.offsetWidth;
    const left = touchLabel ? Math.max(w / 2 + 8, Math.min(width - w / 2 - 8, hover.x))
      : (hover.x + 12 + w > width - 8 ? Math.max(8 - 12, hover.x - w - 24) : hover.x);
    label.style.left = `${left}px`;
    label.style.top = `${touchLabel ? Math.max(hover.y, label.offsetHeight + 26) : hover.y}px`;
  }

  function singleName(px, py) {
    const offset = (py * image.width + px) * 4;
    const id = picking[offset] + 256 * picking[offset + 1];
    if (!map.names[id - 1] || picking[offset + 2] !== ((id * 113) & 255)) return '';
    return map.names[id - 1];
  }

  // ---- world mode: pyramid of blocks ------------------------------------------------------------
  function evict(cache, limit) {
    if (cache.size <= limit) return;
    const oldest = [...cache.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, cache.size - limit);
    for (const [key] of oldest) cache.delete(key);
  }

  // The decoded image of a block, or null while it loads (and, with request = false, if nobody asked yet).
  function blockImage(level, bx, by, request) {
    const key = `${level}/${bx}_${by}`;
    const cached = blocks.get(key);
    if (cached) {
      cached.used = ++tick;
      return cached.img.complete && cached.img.naturalWidth ? cached.img : null;
    }
    if (!request || !world.levels[level].keys.has(`${bx}_${by}`)) return null;
    const img = new Image();
    img.onload = schedule;
    img.src = `${worldBase}L${level}/${bx}_${by}.png`;
    blocks.set(key, {img, used: ++tick});
    evict(blocks, 160);
    return null;
  }

  function drawWorld() {
    const {block} = world.meta, levels = world.levels;
    // Coarsest level that still shows at least half a source pixel per screen pixel.
    const level = Math.max(0, Math.min(levels.length - 1, Math.floor(Math.log2(1 / scale))));
    const span = block * 2 ** level;           // level-0 pixels covered by one block of this level
    const x0 = Math.max(0, Math.floor(-x / scale / span)), y0 = Math.max(0, Math.floor(-y / scale / span));
    const x1 = Math.min(Math.ceil(image.width / span) - 1, Math.floor((width - x) / scale / span));
    const y1 = Math.min(Math.ceil(image.height / span) - 1, Math.floor((height - y) / scale / span));
    for (let by = y0; by <= y1; by++) {
      for (let bx = x0; bx <= x1; bx++) {
        if (!levels[level].keys.has(`${bx}_${by}`)) continue;     // empty block: background
        const left = x + bx * span * scale, top = y + by * span * scale;
        const size = span * scale;
        const dx = Math.floor(left), dy = Math.floor(top);
        const dw = Math.ceil(left + size) - dx, dh = Math.ceil(top + size) - dy;
        const img = blockImage(level, bx, by, true);
        if (img) {
          ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy,
            Math.ceil(left + img.naturalWidth * 2 ** level * scale) - dx, Math.ceil(top + img.naturalHeight * 2 ** level * scale) - dy);
          continue;
        }
        // Not ready: show the coarser level (asked for, so it arrives next) while this one loads.
        for (let up = level + 1; up < levels.length; up++) {
          const d = up - level;
          const parent = blockImage(up, bx >> d, by >> d, up === level + 1);
          if (!parent) continue;
          const part = block / 2 ** d;
          ctx.drawImage(parent, (bx - ((bx >> d) << d)) * part, (by - ((by >> d) << d)) * part, part, part, dx, dy, dw, dh);
          break;
        }
      }
    }
  }

  // Name under a level-0 pixel: the picking block holding it is fetched and decoded on first use.
  function worldName(px, py) {
    const block = world.meta.block;
    const bx = Math.floor(px / block), by = Math.floor(py / block), key = `${bx}_${by}`;
    if (!world.pick.has(key)) return '';
    const entry = picks.get(key);
    if (!entry) {
      picks.set(key, {data: null, used: ++tick});
      const img = new Image();
      img.onload = () => {
        const buffer = document.createElement('canvas');
        buffer.width = img.naturalWidth;
        buffer.height = img.naturalHeight;
        const pixels = buffer.getContext('2d', {willReadFrequently: true});
        pixels.drawImage(img, 0, 0);
        picks.set(key, {data: pixels.getImageData(0, 0, buffer.width, buffer.height).data, width: buffer.width, used: ++tick});
        evict(picks, 48);
        schedule();
      };
      img.src = `${worldBase}pick/${key}.png`;
      return '';
    }
    if (!entry.data) return '';
    entry.used = ++tick;
    const offset = ((py - by * block) * entry.width + (px - bx * block)) * 4;
    const id = entry.data[offset] + 256 * entry.data[offset + 1];
    if (!id || entry.data[offset + 2] !== ((id * 113) & 255)) return '';
    return world.meta.names[id - 1] || '';
  }

  function schedule() {
    if (frame === undefined) frame = requestAnimationFrame(draw);
  }

  function reset() {
    if (!image) return;
    scale = Math.min(width / image.width, height / image.height) * .9;
    x = (width - image.width * scale) / 2;
    y = (height - image.height * scale) / 2;
    schedule();
  }

  function resize() {
    x += (innerWidth - width) / 2;
    y += (innerHeight - height) / 2;
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    schedule();
  }

  function anchorZoom(from, to, start, factor) {
    scale = Math.max(.015, Math.min(8, start.scale * factor));
    const ratio = scale / start.scale;
    x = to.x - (from.x - start.x) * ratio;
    y = to.y - (from.y - start.y) * ratio;
    schedule();
  }

  const position = event => ({x: event.clientX, y: event.clientY});
  const midpoint = (a, b) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
  const distance = (a, b) => Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));

  function beginGesture() {
    const [a, b] = pointers.values();
    gesture = a ? {x, y, scale, anchor: b ? midpoint(a, b) : a, distance: b ? distance(a, b) : 1} : null;
    canvas.classList.toggle('dragging', Boolean(a));
  }

  canvas.addEventListener('pointerdown', event => {
    if (!image || pointers.size >= 2) return;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* synthetic or already released pointer */ }
    pointers.set(event.pointerId, position(event));
    hover = null;
    // A short press that barely moves is a tap: it selects the building under the finger.
    tap = pointers.size === 1 ? {...position(event), time: event.timeStamp} : null;
    beginGesture();
    schedule();
  });
  canvas.addEventListener('pointermove', event => {
    const point = position(event);
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, point);
      if (tap && (pointers.size > 1 || Math.hypot(point.x - tap.x, point.y - tap.y) > 8)) tap = null;
      const [a, b] = pointers.values();
      anchorZoom(gesture.anchor, b ? midpoint(a, b) : a, gesture,
        b ? distance(a, b) / gesture.distance : 1);
    } else if (!pointers.size && event.pointerType !== 'touch') {
      hover = point;
      touchLabel = false;
      schedule();
    }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => {
      if (type === 'pointerup' && tap && event.timeStamp - tap.time < 600) {
        hover = position(event);
        touchLabel = event.pointerType !== 'mouse';
      }
      if (pointers.delete(event.pointerId)) {
        if (!pointers.size) tap = null;
        beginGesture();
        schedule();
      }
    });
  }
  // Touch pointers also fire pointerleave right after pointerup, which would erase the tapped selection.
  canvas.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') { hover = null; schedule(); } });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    if (!image) return;
    const point = position(event);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    anchorZoom(point, point, {x, y, scale}, Math.exp(-event.deltaY * unit * .001));
  }, {passive: false});
  document.querySelector('#reset').addEventListener('click', reset);
  // Attributions live in the About dialog; click outside it, Escape or the button closes it.
  const about = document.querySelector('#about-dialog');
  document.querySelector('#about').addEventListener('click', () => about.showModal());
  document.querySelector('#about-close').addEventListener('click', () => about.close());
  about.addEventListener('click', event => { if (event.target === about) about.close(); });
  window.addEventListener('resize', resize);
  resize();

  async function loadImage(source) {
    const asset = new Image();
    asset.src = source;
    await asset.decode();
    return asset;
  }

  async function loadWorld() {
    const meta = await (await fetch(`${worldBase}meta.json`)).json();
    world = {meta, pick: new Set(meta.pick),
      levels: meta.levels.map(level => ({...level, keys: new Set(level.blocks)}))};
    image = {width: meta.levels[0].width, height: meta.levels[0].height};
    return {...meta, summary: 'Pasa el cursor sobre un edificio, parada o acceso de Metro para ver qué es.'};
  }

  async function loadMap() {
    if (!map && !worldBase) throw new Error('Falta el mapa prerenderizado. Ejecuta scripts/bundle.py.');
    let loaded = map;
    if (worldBase) loaded = await loadWorld();
    else image = await loadImage(map.image);
    document.querySelector('#scene-title').textContent = loaded.title;
    const credit = document.querySelector('#credit');
    credit.textContent = loaded.attribution;
    if (loaded.metroCredit) {
      const source = document.createElement('a');
      source.href = 'https://www.crtm.es/';
      source.textContent = 'Powered by CRTM';
      credit.append(' · ', source, ' (datos elaborados)');
    }
    // Touch screens have no hover: the status line tells people to tap instead.
    const touchSummary = 'Toca un edificio, parada o acceso de Metro para ver qué es.';
    status.textContent = touchOnly.matches ? touchSummary : loaded.summary;
    // The published site lists where each tile is also available on its own (ISOCITY_TILE_PAGES).
    if (world && globalThis.ISOCITY_TILE_PAGES) {
      const note = document.createElement('p');
      note.append('Cada tesela por separado: ');
      world.meta.tiles.forEach((tile, i) => {
        const href = globalThis.ISOCITY_TILE_PAGES[tile.name];
        if (!href) return;
        const link = document.createElement('a');
        link.href = href;
        link.textContent = tile.title;
        note.append(i ? ' · ' : '', link);
      });
      document.querySelector('#about-dialog .credits').before(note);
    }
    document.querySelector('.hint').innerHTML = touchOnly.matches
      ? 'Arrastra para moverte<br>Pellizca para ampliar' : document.querySelector('.hint').innerHTML;
    reset();
    if (world) return;
    const ids = await loadImage(map.picking);
    const buffer = document.createElement('canvas');
    buffer.width = ids.width;
    buffer.height = ids.height;
    const pixels = buffer.getContext('2d', {willReadFrequently: true});
    pixels.drawImage(ids, 0, 0);
    picking = pixels.getImageData(0, 0, ids.width, ids.height).data;
  }

  loadMap().catch(error => { status.textContent = error.message; });
})();
