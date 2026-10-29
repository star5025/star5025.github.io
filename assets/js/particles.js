// Background geometry only. Drawing never intercepts links or pointer input.
(() => {
  const canvas = document.getElementById('background-particles');
  const context = canvas?.getContext('2d', { alpha: true });
  if (!context) return;
  const pointer = { x: 0, y: 0, active: false };
  const frameInterval = 1000 / 30;
  let width = 0, height = 0, points = [], colors = [];
  let frame = 0, previousTime = 0, resizeTimer;
  let printing = false, running = false;

  function readColors() {
    const style = getComputedStyle(document.documentElement);
    colors = ['--cyan', '--sky', '--indigo'].map(name => style.getPropertyValue(name).trim());
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    const mobile = width < 600;
    const count = mobile ? 32 : Math.min(120, Math.max(64, Math.round(width * height / 14500)));
    const lane = Math.min(width * .3, Math.max(70, (width - 1200) / 2 + 90));
    points = Array.from({ length: count }, (_, index) => {
      // Two thirds near the margins, the rest behind gaps across the viewport.
      const x = index % 3 === 0 ? Math.random() * width :
        index % 2 === 0 ? Math.random() * lane : width - Math.random() * lane;
      return { x, y: Math.random() * height, vx: (Math.random() - .5) * 8,
        vy: (Math.random() - .5) * 13, ox: 0, oy: 0, fx: 0, fy: 0,
        radius: .9 + Math.random() * 1.1, color: index % 3 };
    });
    pointer.active = false;
    canvas.dataset.particleCount = String(count);
  }

  function draw(delta) {
    context.clearRect(0, 0, width, height);
    const dark = document.documentElement.dataset.theme === 'dark';
    const reach = width < 600 ? 95 : 155;
    const attractionRadius = 110;
    let attracted = 0;
    const drag = Math.exp(-8 * delta);
    points.forEach(point => {
      point.x += point.vx * delta;
      point.y += point.vy * delta;
      if (point.x < -15) point.x = width + 15;
      if (point.x > width + 15) point.x = -15;
      if (point.y < -15) point.y = height + 15;
      if (point.y > height + 15) point.y = -15;
      let targetX = 0, targetY = 0;
      if (pointer.active) {
        // Measure from the original drift path so attraction cannot spread outward.
        const dx = pointer.x - point.x;
        const dy = pointer.y - point.y;
        const distance = Math.hypot(dx, dy);
        if (distance < attractionRadius) {
          const influence = .7 * (1 - distance / attractionRadius) ** 2;
          targetX = dx * influence;
          targetY = dy * influence;
          attracted++;
        }
      }
      // A small target offset and stronger damping keep the response local and gentle.
      point.fx = (point.fx + (targetX - point.ox) * 18 * delta) * drag;
      point.fy = (point.fy + (targetY - point.oy) * 18 * delta) * drag;
      point.ox += point.fx * delta;
      point.oy += point.fy * delta;
      const offset = Math.hypot(point.ox, point.oy);
      if (offset > 16) {
        point.ox *= 16 / offset;
        point.oy *= 16 / offset;
        point.fx = 0;
        point.fy = 0;
      }
      point.px = point.x + point.ox;
      point.py = point.y + point.oy;
    });
    canvas.dataset.attractedCount = String(attracted);
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      let links = 0;
      for (let j = i + 1; j < points.length && links < 3; j++) {
        const b = points[j];
        const distance = Math.hypot(a.px - b.px, a.py - b.py);
        if (distance > reach) continue;
        links++;
        context.strokeStyle = colors[a.color];
        context.globalAlpha = (1 - distance / reach) * (dark ? .32 : .22);
        context.lineWidth = .75;
        context.beginPath();
        context.moveTo(a.px, a.py);
        context.lineTo(b.px, b.py);
        context.stroke();
      }
      const proximity = pointer.active ? Math.max(0, 1 - Math.hypot(a.x - pointer.x, a.y - pointer.y) / attractionRadius) : 0;
      context.fillStyle = colors[a.color];
      context.globalAlpha = (dark ? .12 : .07) + proximity * .025;
      context.beginPath();
      context.arc(a.px, a.py, a.radius * 4, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = (dark ? .8 : .58) + proximity * .05;
      context.beginPath();
      context.arc(a.px, a.py, a.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function tick(time) {
    if (!running) return;
    if (time - previousTime >= frameInterval) {
      const delta = previousTime ? Math.min((time - previousTime) / 1000, .06) : 0;
      previousTime = time;
      draw(delta);
    }
    frame = requestAnimationFrame(tick);
  }

  function clearPointer() { pointer.active = false; }
  function sync() {
    const allowed = motionAllowed() && !document.hidden && !printing &&
      !document.body.classList.contains('focus-mode') && !document.querySelector('dialog[open]');
    readColors();
    if (allowed === running) return;
    running = allowed;
    canvas.hidden = !allowed;
    canvas.dataset.state = allowed ? 'running' : 'paused';
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    clearPointer();
    if (allowed) { draw(0); frame = requestAnimationFrame(tick); }
    else { context.clearRect(0, 0, width, height); canvas.dataset.attractedCount = '0'; }
  }

  window.addEventListener('pointermove', event => {
    if (!running || (event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', clearPointer);
  window.addEventListener('pointerout', event => { if (!event.relatedTarget) clearPointer(); });
  window.addEventListener('pointercancel', clearPointer);
  window.addEventListener('blur', clearPointer);
  window.addEventListener('scroll', clearPointer, { passive: true });
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(document.getElementById('search-dialog'), { attributes: true, attributeFilter: ['open'] });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('gallery-state-change', sync);
  motionPreference.addEventListener('change', sync);
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); if (running) draw(0); }, 120);
  });
  window.addEventListener('beforeprint', () => { printing = true; sync(); });
  window.addEventListener('afterprint', () => { printing = false; sync(); });
  window.addEventListener('pagehide', () => { printing = true; sync(); });
  window.addEventListener('pageshow', () => { printing = false; sync(); });
  resize();
  canvas.hidden = true;
  canvas.dataset.state = 'paused';
  sync();
})();
