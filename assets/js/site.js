// Classic deferred script; particles.js consumes these two globals.
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
function motionAllowed() { return !motionPreference.matches && !document.hidden; }
(() => {
  function init() {
    const $ = selector => document.querySelector(selector);
    const main = $('#main');
    if (!main) return;
    const node = (tag, className, text) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    };
    const glyph = name => { const el = node('span'); el.dataset.icon = name; return el; };
    let animations = [], frame = 0, toastTimer;
    function toast(message) {
      const el = $('.toast');
      if (!el) return;
      clearTimeout(toastTimer); el.textContent = message; el.classList.add('visible');
      toastTimer = setTimeout(() => el.classList.remove('visible'), 2600);
    }
    function syncMotion() {
      document.documentElement.classList.toggle('motion-off', !motionAllowed());
      if (!motionAllowed()) { animations.forEach(animation => animation.cancel()); animations = []; }
    }
    function animateEntries(elements) {
      if (!motionAllowed()) return;
      elements.forEach((el, index) => {
        if (el.animate) animations.push(el.animate([
          { opacity: .5, transform: 'translateY(9px)' }, { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 360, delay: Math.min(index, 3) * 40, easing: 'cubic-bezier(.2,.7,.2,1)' }));
      });
      animations = animations.filter(animation => animation.playState !== 'finished');
    }
    const themeButton = $('#theme-toggle');
    try {
      const stored = localStorage.getItem('1star-theme') || localStorage.getItem('1star-preview-theme');
      if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored;
    } catch {}
    function updateThemeButton() {
      if (!themeButton) return;
      const dark = document.documentElement.dataset.theme === 'dark';
      themeButton.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
      themeButton.setAttribute('aria-pressed', String(dark));
      themeButton.replaceChildren(glyph(dark ? 'sun' : 'moon')); hydrateIcons(themeButton);
    }
    themeButton?.addEventListener('click', () => {
      if (themeButton.disabled) return;
      themeButton.disabled = true;
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem('1star-theme', theme); } catch {}
      updateThemeButton(); setTimeout(() => { themeButton.disabled = false; }, 500);
    });
    function connectAvatar() {
      const image = $('.hero-avatar'), status = $('.resource-status');
      if (!image) return;
      const shell = image.parentElement, frame = image.closest('.avatar-frame');
      function statusText(label, state) {
        if (!status) return;
        status.querySelector('.resource-label').textContent = label;
        status.dataset.state = state; status.hidden = false;
        const mark = status.querySelector('[data-icon]');
        if (mark) mark.dataset.icon = state === 'loading' ? 'loader-circle' : state === 'loaded' ? 'check' : 'external-link';
        hydrateIcons(status);
      }
      function finish() {
        const success = image.naturalWidth > 0;
        frame?.classList.remove('avatar-loading'); frame?.classList.toggle('avatar-failed', !success);
        shell.removeAttribute('aria-busy');
        shell.querySelector('.avatar-fallback')?.setAttribute('aria-hidden', String(success));
        if (!success) image.alt = '';
        if (status && !status.hidden) {
          statusText(success ? '头像已加载' : '头像暂不可用', success ? 'loaded' : 'failed');
          setTimeout(() => { status.hidden = true; }, 1500);
        }
        scheduleReading();
      }
      if (image.complete) { finish(); return; }
      frame?.classList.add('avatar-loading'); shell.setAttribute('aria-busy', 'true');
      statusText('正在加载头像…', 'loading');
      image.addEventListener('load', finish, { once: true }); image.addEventListener('error', finish, { once: true });
    }
    const articleBody = document.body.dataset.page === 'article' ? $('.article-body') : null;
    const headings = articleBody ? [...articleBody.querySelectorAll(':scope > h2')] : [];
    const dock = $('.reading-dock'), focusButton = $('#focus-toggle');
    if (dock) dock.hidden = !articleBody;
    if (articleBody) {
      const toc = $('.toc'), list = toc?.querySelector('ol');
      if (toc) toc.hidden = !headings.length;
      list?.replaceChildren();
      const used = new Set([...document.querySelectorAll('[id]')].filter(el => !headings.includes(el)).map(el => el.id));
      const rail = main.querySelector(':scope > .reading-rail') || node('aside', 'reading-rail');
      rail.hidden = !headings.length; rail.setAttribute('aria-label', '文章阅读导航');
      rail.replaceChildren();
      if (headings.length) {
        const title = node('p', 'rail-title', '本文目录'); title.prepend(glyph('list'));
        const nav = node('nav'); nav.setAttribute('aria-label', '文章章节');
        headings.forEach((heading, index) => {
          const text = heading.textContent.trim();
          const base = heading.id || text.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || `section-${index + 1}`;
          let id = base, suffix = 2;
          while (used.has(id)) id = `${base}-${suffix++}`;
          used.add(id); heading.id = id; heading.tabIndex = -1;
          const link = node('a', '', text); link.href = `#${encodeURIComponent(id)}`; link.dataset.section = id;
          if (list) { const item = node('li'); item.append(link); list.append(item); }
          nav.append(link.cloneNode(true));
          if (!heading.querySelector('.heading-anchor')) {
            const anchor = node('a', 'heading-anchor'); anchor.href = link.href;
            anchor.setAttribute('aria-label', `定位到“${text}”`); anchor.append(glyph('hash')); heading.append(anchor);
          }
        });
        rail.append(title, nav, node('p', 'rail-note', '慢慢读，按自己的节奏。')); main.append(rail);
      }
    }
    function updateReading() {
      document.body.classList.toggle('is-scrolled', scrollY > 32);
      const rect = articleBody?.getBoundingClientRect();
      const ratio = rect ? Math.min(1, Math.max(0, (120 - rect.top) / Math.max(1, rect.height - innerHeight + 200))) : 0;
      const percent = `${Math.round(ratio * 100)}%`;
      if ($('.dock-progress')) $('.dock-progress').textContent = percent;
      dock?.style.setProperty('--read-progress', `${ratio * 100}%`);
      if ($('.reading-progress')) $('.reading-progress').style.width = `${ratio * 100}%`;
      let current = headings[0]?.id;
      for (const heading of headings) if (heading.getBoundingClientRect().top <= 175) current = heading.id;
      main.querySelectorAll('.toc [data-section], .reading-rail [data-section]').forEach(link => {
        const active = link.dataset.section === current;
        link.classList.toggle('current-section', active);
        if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
    }
    function scheduleReading() {
      if (document.hidden || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; updateReading(); });
    }
    function setFocus(enabled) {
      enabled = Boolean(enabled && articleBody);
      document.body.classList.toggle('focus-mode', enabled);
      focusButton?.setAttribute('aria-pressed', String(enabled));
      if ($('.focus-label')) $('.focus-label').textContent = enabled ? '退出专注' : '专注阅读';
      document.querySelectorAll('.reading-rail, .site-header, .site-footer').forEach(el => el.toggleAttribute('inert', enabled));
      scheduleReading();
    }
    focusButton?.addEventListener('click', () => setFocus(!document.body.classList.contains('focus-mode')));
    document.querySelectorAll('#dock-top, #back-top').forEach(button => button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: motionAllowed() ? 'smooth' : 'instant' });
    }));
    $('.skip[href="#main"]')?.addEventListener('click', event => {
      event.preventDefault(); main.tabIndex = -1; main.focus({ preventScroll: true });
      main.scrollIntoView({ behavior: motionAllowed() ? 'smooth' : 'instant', block: 'start' });
    });
    const pres = new Set([...main.querySelectorAll('.highlight pre, pre code')].map(el => el.closest('pre')));
    pres.forEach(pre => {
      if (pre.closest('.rouge-gutter, .lineno')) return;
      let block = pre.closest('.code-block');
      if (!block) {
        block = node('div', 'code-block');
        const surface = pre.closest('div.highlighter-rouge') || pre.closest('div.highlight') || pre;
        surface.before(block); block.append(surface);
      }
      let button = block.querySelector('.copy-button');
      if (!button) {
        let head = block.querySelector('.code-head');
        if (!head) { head = node('div', 'code-head'); block.prepend(head); }
        button = node('button', 'copy-button', '复制'); button.prepend(glyph('copy')); head.append(button);
      }
      if (button.dataset.copyBound) return;
      button.dataset.copyBound = 'true'; button.type = 'button';
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        const code = pre.querySelector('code') || pre;
        button.disabled = true;
        try {
          await navigator.clipboard.writeText(code.textContent);
          button.replaceChildren(glyph('check'), document.createTextNode('已复制')); hydrateIcons(button); toast('代码已复制');
        } catch {
          const selection = window.getSelection(), range = document.createRange(); range.selectNodeContents(code);
          selection?.removeAllRanges(); selection?.addRange(range); toast('代码已选中，请按 Ctrl/Cmd + C 复制');
        } finally {
          setTimeout(() => {
            button.replaceChildren(glyph('copy'), document.createTextNode('复制')); hydrateIcons(button); button.disabled = false;
          }, 2000);
        }
      });
    });
    if (document.body.dataset.page === 'home') {
      const buttons = [...main.querySelectorAll('[data-filter]')], rows = [...main.querySelectorAll('#posts li.post-row')];
      const allowed = ['all', 'development', 'daily', 'travel'];
      function filterPosts(button, animate = false) {
        const filter = button.dataset.filter;
        if (!allowed.includes(filter)) return;
        buttons.forEach(el => { const active = el === button; el.classList.toggle('active', active); el.setAttribute('aria-pressed', String(active)); });
        rows.forEach(row => { row.hidden = filter !== 'all' && row.dataset.category !== filter; });
        const visible = rows.filter(row => !row.hidden);
        if ($('#filter-empty')) $('#filter-empty').hidden = visible.length > 0;
        if ($('#filter-announcement')) $('#filter-announcement').textContent = `${button.textContent.trim()}：${visible.length} 篇文章`;
        if (animate) { animations.forEach(animation => animation.cancel()); animations = []; animateEntries(visible); }
      }
      buttons.forEach(button => button.addEventListener('click', () => filterPosts(button, true)));
      const initial = buttons.find(button => button.getAttribute('aria-pressed') === 'true') || buttons.find(button => button.dataset.filter === 'all');
      if (initial) filterPosts(initial);
    }
    const dialog = $('#search-dialog'), input = $('#search-input'), results = $('#search-results');
    let searchData = [], searchOpener;
    function safeURL(value) {
      if (typeof value !== 'string' || !value.trim()) return null;
      try {
        const url = new URL(value, location.href);
        return /^https?:$/.test(url.protocol) && url.origin === location.origin && !url.username && !url.password ? url.href : null;
      } catch { return null; }
    }
    try {
      const data = JSON.parse($('#search-data')?.textContent || '[]');
      if (Array.isArray(data)) searchData = data.filter(item => item && typeof item.title === 'string' && safeURL(item.url));
    } catch { console.warn('搜索索引不是有效的 JSON。'); }
    const categoryLabels = { development: '开发', daily: '日常', travel: '旅行' };
    function search() {
      const query = input.value.trim().toLocaleLowerCase(); results.replaceChildren();
      const found = searchData.filter(item => [item.title, item.summary, item.category, categoryLabels[item.category], item.date].filter(value => typeof value === 'string').join(' ').toLocaleLowerCase().includes(query));
      found.forEach(item => {
        const link = node('a', '', item.title); link.href = safeURL(item.url);
        link.append(node('small', '', [categoryLabels[item.category] || item.category, item.date].filter(value => typeof value === 'string' && value).join(' · ')));
        const arrow = node('span', 'result-arrow'); arrow.append(glyph('arrow-up-right')); link.append(arrow); results.append(link);
      });
      if (!found.length) results.append(node('p', 'no-results', searchData.length ? '没有找到相关文章，换个关键词试试。' : '暂无可搜索的文章。'));
      hydrateIcons(results);
    }
    function openSearch() {
      if (!dialog || !input || !results) return;
      if (!dialog.open) { searchOpener = document.activeElement; search(); dialog.showModal(); }
      input.focus();
    }
    $('#search-toggle')?.addEventListener('click', openSearch);
    $('#close-search')?.addEventListener('click', () => dialog.close());
    input?.addEventListener('input', search);
    results?.addEventListener('click', event => { if (event.target.closest('a')) dialog.close(); });
    dialog?.addEventListener('close', () => {
      const target = searchOpener?.isConnected && !searchOpener.closest('[inert]') ? searchOpener : focusButton;
      target?.focus({ preventScroll: true });
    });
    dialog?.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
    dialog?.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog?.addEventListener('keydown', event => {
      if (event.isComposing || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      const links = [...results.querySelectorAll('a')];
      if (!links.length) return;
      event.preventDefault(); const index = links.indexOf(document.activeElement), down = event.key === 'ArrowDown';
      links[index < 0 ? (down ? 0 : links.length - 1) : (index + (down ? 1 : -1) + links.length) % links.length].focus();
    });
    document.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
      if (event.key === 'Escape' && !dialog?.open && document.body.classList.contains('focus-mode')) setFocus(false);
    });
    window.addEventListener('scroll', scheduleReading, { passive: true }); window.addEventListener('resize', scheduleReading);
    window.addEventListener('load', scheduleReading); window.addEventListener('pageshow', scheduleReading);
    if (articleBody && 'ResizeObserver' in window) new ResizeObserver(scheduleReading).observe(articleBody);
    motionPreference.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', () => {
      syncMotion(); if (frame) cancelAnimationFrame(frame); frame = 0; scheduleReading();
    });
    if ($('#year')) $('#year').textContent = String(new Date().getFullYear());
    updateThemeButton(); connectAvatar(); hydrateIcons(); syncMotion(); updateReading();
    animateEntries([...main.querySelectorAll('.hero > div:first-child, .section-intro, .article-head, .about-page > h1')]);
    const flash = $('.route-flash');
    if (motionAllowed() && flash?.animate) animations.push(flash.animate([{ opacity: 0, transform: 'scaleX(.05)' }, { opacity: .7, offset: .4 }, { opacity: 0, transform: 'scaleX(1)' }], { duration: 500 }));
    try {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (headings.includes(target)) target.scrollIntoView({ behavior: 'instant', block: 'start' });
    } catch {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
