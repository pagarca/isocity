(() => {
  'use strict';

  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d', {alpha: false});
  const label = document.querySelector('#hover-label');
  const status = document.querySelector('#status');
  const map = globalThis.ISOCITY_MAP;
  let image, picking, frame;
  let scale = 1, x = 0, y = 0, width = 0, height = 0, dpr = 1;
  let hover = null, gesture = null, tap = null, touchLabel = false;
  const touchOnly = matchMedia('(hover: none)');
  const pointers = new Map();

  function draw() {
    frame = undefined;
    ctx.fillStyle = '#b5c39f';
    ctx.fillRect(0, 0, width, height);
    if (image) ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
    label.style.display = 'none';
    if (!hover || !picking || pointers.size) return;
    const px = Math.floor((hover.x - x) / scale);
    const py = Math.floor((hover.y - y) / scale);
    if (px < 0 || py < 0 || px >= image.width || py >= image.height) return;
    const offset = (py * image.width + px) * 4;
    const id = picking[offset] + 256 * picking[offset + 1];
    if (!map.names[id - 1] || picking[offset + 2] !== ((id * 113) & 255)) return;
    label.textContent = map.names[id - 1];
    label.classList.toggle('touch', touchLabel);
    label.style.display = 'block';
    // Keep the label inside the screen; on touch it sits above the finger.
    const w = label.offsetWidth;
    const left = touchLabel ? Math.max(w / 2 + 8, Math.min(width - w / 2 - 8, hover.x))
      : (hover.x + 12 + w > width - 8 ? Math.max(8 - 12, hover.x - w - 24) : hover.x);
    label.style.left = `${left}px`;
    label.style.top = `${touchLabel ? Math.max(hover.y, label.offsetHeight + 26) : hover.y}px`;
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
    canvas.setPointerCapture(event.pointerId);
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
  canvas.addEventListener('pointerleave', () => { hover = null; schedule(); });
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

  async function loadMap() {
    if (!map) throw new Error('Falta el mapa prerenderizado. Ejecuta scripts/bundle.py.');
    image = await loadImage(map.image);
    document.querySelector('#scene-title').textContent = map.title;
    const credit = document.querySelector('#credit');
    credit.textContent = map.attribution;
    if (map.metroCredit) {
      const source = document.createElement('a');
      source.href = 'https://www.crtm.es/';
      source.textContent = 'Powered by CRTM';
      credit.append(' · ', source, ' (datos elaborados)');
    }
    // Touch screens have no hover: the status line tells people to tap instead.
    const touchSummary = 'Toca un edificio, parada o acceso de Metro para ver qué es.';
    status.textContent = touchOnly.matches ? touchSummary : map.summary;
    document.querySelector('.hint').innerHTML = touchOnly.matches
      ? 'Arrastra para moverte<br>Pellizca para ampliar' : document.querySelector('.hint').innerHTML;
    reset();
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
