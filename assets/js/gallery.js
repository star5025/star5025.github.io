// Progressive enhancement: ordinary thumbnail links remain usable without dialog support.
(() => {
  function init() {
    if (document.body.dataset.page !== 'album' || document.getElementById('photo-dialog')) return;
    const links = [...document.querySelectorAll('.album-photos .album-photo-link')].filter(link => link.querySelector('img'));
    if (!links.length || typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
    const node = (tag, className, text) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    };
    function safeURL(value) {
      if (typeof value !== 'string' || !value.trim()) return null;
      try {
        const url = new URL(value, document.baseURI);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
      } catch { return null; }
    }
    const dialog = node('dialog', 'photo-dialog'); dialog.id = 'photo-dialog';
    dialog.setAttribute('aria-label', '照片浏览器');
    const toolbar = node('div', 'photo-toolbar'), figure = node('figure', 'photo-figure');
    const stage = node('div', 'photo-stage'), imageBox = node('div', 'photo-image');
    const caption = node('figcaption', 'photo-caption'), counter = node('p', 'photo-counter');
    const loading = node('p', 'photo-loading', '正在加载照片…');
    const failure = node('p', 'photo-failure', '照片加载失败，请稍后重试或返回缩略图打开原图。');
    [counter, loading, failure].forEach(el => { el.setAttribute('role', 'status'); el.setAttribute('aria-atomic', 'true'); });
    loading.hidden = failure.hidden = true;
    function button(className, label, glyph) {
      const el = node('button', `photo-button ${className}`); el.type = 'button';
      el.setAttribute('aria-label', label); el.title = label;
      const mark = node('span'); mark.dataset.icon = glyph; el.append(mark);
      // Missing icon script should not leave an invisible control.
      if (typeof hydrateIcons !== 'function') el.append(document.createTextNode(label));
      return el;
    }
    const close = button('photo-close', '关闭照片', 'x'); close.autofocus = true;
    const prev = button('photo-prev', '上一张', 'arrow-left');
    const next = button('photo-next', '下一张', 'arrow-left');
    const controls = node('div', 'photo-controls'); controls.append(prev, next);
    prev.hidden = next.hidden = links.length < 2;
    prev.disabled = next.disabled = links.length < 2;
    toolbar.append(counter, close); stage.append(imageBox, loading, failure); figure.append(stage, caption);
    dialog.append(toolbar, figure, controls); document.body.append(dialog);
    if (typeof hydrateIcons === 'function') hydrateIcons(dialog);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => dialog.classList.toggle('photo-reduced-motion', reduced.matches);
    reduced.addEventListener('change', syncMotion); syncMotion();
    let index = 0, token = 0, pending = null, opener = null, active = false, swipe = null, backdropDown = false;
    const announce = () => window.dispatchEvent(new Event('gallery-state-change'));
    function clearImage() {
      token++;
      if (pending) { pending.onload = pending.onerror = null; pending.removeAttribute('src'); pending = null; }
      imageBox.replaceChildren();
    }
    function render() {
      clearImage(); swipe = null;
      const link = links[index], thumb = link.querySelector('img');
      const url = safeURL(link.dataset.full ?? link.getAttribute('href'));
      caption.textContent = link.dataset.caption ?? link.closest('figure')?.querySelector('figcaption')?.textContent ?? '';
      caption.hidden = !caption.textContent;
      counter.textContent = `第 ${index + 1} / ${links.length} 张`;
      failure.hidden = true; loading.hidden = false; stage.setAttribute('aria-busy', 'true');
      const image = new Image(), ticket = token;
      let settled = false;
      pending = image; image.alt = link.dataset.alt ?? thumb.alt; image.decoding = 'async'; image.draggable = false;
      const finish = success => {
        if (settled || ticket !== token || pending !== image || !dialog.open) return;
        settled = true; image.onload = image.onerror = null; loading.hidden = true; stage.removeAttribute('aria-busy');
        failure.hidden = success;
        if (success) imageBox.replaceChildren(image); else imageBox.replaceChildren();
      };
      if (!url) { finish(false); return; }
      image.onload = () => finish(image.naturalWidth > 0);
      image.onerror = () => finish(false);
      image.src = url;
      if (image.complete) queueMicrotask(() => finish(image.naturalWidth > 0));
    }
    function cleanup() {
      if (!active || dialog.open) return;
      active = false; clearImage(); swipe = null; backdropDown = false;
      loading.hidden = failure.hidden = true; stage.removeAttribute('aria-busy');
      document.body.classList.remove('photo-open'); announce();
      const target = opener; opener = null;
      if (target?.isConnected) target.focus({ preventScroll: true });
    }
    function closePhoto() { if (dialog.open) dialog.close(); cleanup(); }
    function move(step) {
      if (!dialog.open || links.length < 2) return;
      index = (index + step + links.length) % links.length; render();
    }
    links.forEach((link, position) => link.addEventListener('click', event => {
      // Validate href as well: modified clicks must not navigate to an unsafe scheme.
      if (!safeURL(link.getAttribute('href')) || !safeURL(link.dataset.full ?? link.getAttribute('href'))) {
        event.preventDefault(); return;
      }
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (document.querySelector('dialog[open]')) { event.preventDefault(); return; }
      try { dialog.showModal(); } catch { return; } // Keep native link fallback if opening fails.
      event.preventDefault(); active = true; opener = link; index = position;
      document.body.classList.add('photo-open'); render(); close.focus({ preventScroll: true }); announce();
    }));
    close.addEventListener('click', closePhoto);
    prev.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
    dialog.addEventListener('cancel', event => { event.preventDefault(); closePhoto(); });
    dialog.addEventListener('close', cleanup);
    function blockSearch(event) {
      if (dialog.open && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }
    window.addEventListener('keydown', blockSearch, true);
    document.addEventListener('keydown', blockSearch, true);
    dialog.addEventListener('keydown', event => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    function outside(event) {
      const r = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom);
    }
    dialog.addEventListener('pointerdown', event => { backdropDown = event.isPrimary && event.button === 0 && outside(event); });
    dialog.addEventListener('pointercancel', () => { backdropDown = false; });
    dialog.addEventListener('click', event => {
      const dismiss = backdropDown && outside(event); backdropDown = false;
      if (dismiss) closePhoto();
    });
    // Passive observation only: never prevent vertical scrolling or native pinch zoom.
    dialog.addEventListener('touchstart', event => { if (event.touches.length > 1) swipe = null; }, { capture: true, passive: true });
    stage.addEventListener('touchstart', event => {
      if (event.touches.length !== 1 || (window.visualViewport?.scale ?? 1) > 1.01) { swipe = null; return; }
      const touch = event.touches[0];
      swipe = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: Date.now() };
    }, { passive: true });
    stage.addEventListener('touchmove', event => {
      if (!swipe) return;
      const touch = event.touches[0], dx = touch ? Math.abs(touch.clientX - swipe.x) : 0, dy = touch ? Math.abs(touch.clientY - swipe.y) : 0;
      if (event.touches.length !== 1 || touch.identifier !== swipe.id || dy > 30 || (dy > 10 && dy > dx) ||
          (window.visualViewport?.scale ?? 1) > 1.01) swipe = null;
    }, { passive: true });
    stage.addEventListener('touchend', event => {
      const start = swipe; swipe = null;
      if (!start || event.touches.length || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0], dx = touch.clientX - start.x, dy = touch.clientY - start.y;
      if (touch.identifier === start.id && Date.now() - start.time < 900 && Math.abs(dx) >= 60 &&
          Math.abs(dy) < 30 && Math.abs(dx) > Math.abs(dy) * 2 && (window.visualViewport?.scale ?? 1) <= 1.01) move(dx < 0 ? 1 : -1);
    }, { passive: true });
    stage.addEventListener('touchcancel', () => { swipe = null; }, { passive: true });
    window.addEventListener('pagehide', closePhoto);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
