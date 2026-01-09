// draggable-panels.js
// Draggable + resizable panels, persistent via localStorage.
// Terintegrasi dengan CSS Anda (.panel-handle, .panel-inner, .panel-resizer).
// Menonaktifkan drag/resizer pada viewport mobile (<= 920px).
(() => {
  const STORAGE_PREFIX = 'panelState:';
  let zIndexCounter = 1000;
  const MOBILE_BREAKPOINT = 920;
  // Resize constraints (lower minimums, remove maximum limits)
  // keep JS minimums in-sync with CSS to avoid layout drift when clamped
  const MIN_WIDTH = 220; // matches CSS .panel min-width
  const MIN_HEIGHT = 120; // matches CSS .panel min-height
  // Maximum as ratio of the viewport (can be adjusted)
  // larger maximums so panels can be resized much bigger than viewport when desired
  const MAX_WIDTH_RATIO = 5.0;  // allow up to 500% of viewport width
  const MAX_HEIGHT_RATIO = 5.0; // allow up to 500% of viewport height

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function saveState(panel) {
    try {
      const state = {
        left: panel.style.left || '',
        top: panel.style.top || '',
        width: panel.style.width || '',
        height: panel.style.height || '',
        z: panel.style.zIndex || '',
        moved: panel.classList.contains('is-moved') ? '1' : '0',
        max: panel.dataset.max || '0'
      };
      localStorage.setItem(STORAGE_PREFIX + panel.id, JSON.stringify(state));
    } catch (e) { /* ignore storage errors */ }
  }

  function loadState(panel) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + panel.id);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.left) { panel.style.left = s.left; panel.classList.add('is-moved'); panel.style.right = 'auto'; }
      if (s.top) panel.style.top = s.top;
      if (s.width) panel.style.width = s.width;
      if (s.height) panel.style.height = s.height;
      if (s.z) panel.style.zIndex = s.z;
      if (s.max === '1') panel.dataset.max = '1';
    } catch (e) { /* ignore */ }
  }

  function bringToFront(panel) {
    zIndexCounter += 1;
    panel.style.zIndex = String(zIndexCounter);
    saveState(panel);
  }

  function ensureId(panel, idx) {
    if (!panel.id) panel.id = `panel-auto-${idx}`;
  }

  function isMobileViewport() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  // helper: measure panel even when it might be hidden (display:none).
  function measureRectWhenHidden(panel) {
    const rect = panel.getBoundingClientRect();
    if (rect.width > 2 && rect.height > 2) return rect;
    // temporarily show invisibly to measure
    const prevDisplay = panel.style.display;
    const prevVisibility = panel.style.visibility;
    panel.style.display = 'block';
    panel.style.visibility = 'hidden';
    const r = panel.getBoundingClientRect();
    panel.style.display = prevDisplay;
    panel.style.visibility = prevVisibility;
    return r;
  }

  function makePanel(panel, idx) {
    ensureId(panel, idx);
    panel.classList.add('draggable-panel');
    panel.setAttribute('tabindex', '0');
    panel.setAttribute('role', 'dialog');

    // handle element (.panel-handle) or fallback to h2
    const handle = panel.querySelector('.panel-handle') || panel.querySelector('h2') || panel;

    // Dragging (Pointer Events) - restore handlers so panels can be moved
    let dragging = false;
    let dragStart = { x: 0, y: 0, left: 0, top: 0 };

    function onPointerDownDrag(e) {
      // do not start dragging if user started pointerdown on a resizer
      if (e.target && e.target.classList && e.target.classList.contains('panel-resizer')) return;
      if (e.button && e.button !== 0) return;
      // allow mouse-driven drag even on small viewports (useful when resizing window on desktop)
      // some events (mousedown) don't have pointerType -> treat MouseEvent/mousedown as mouse
      const isMouseEvent = (typeof e.pointerType === 'string' && e.pointerType === 'mouse') || e.type === 'mousedown' || (window.MouseEvent && e instanceof MouseEvent);
      if (isMobileViewport() && !isMouseEvent) return;
      e.preventDefault();
      try { panel.setPointerCapture?.(e.pointerId); } catch (_) {}
      dragging = true;
      panel.dataset.dragging = '1';
      panel.classList.add('is-moved');
      // if panel was centered, remove centering so it can be moved
      panel.classList.remove('modal-centered');
      bringToFront(panel);
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
      dragStart.left = parseFloat(panel.style.left || 0);
      dragStart.top = parseFloat(panel.style.top || 0);
    }

    function onPointerMoveDrag(e) {
      if (!dragging) return;
      e.preventDefault();
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = panel.offsetWidth, h = panel.offsetHeight;
      const newLeft = clamp(Math.round(dragStart.left + dx), 8, Math.max(8, vw - w - 8));
      const newTop = clamp(Math.round(dragStart.top + dy), 8, Math.max(8, vh - h - 8));
      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
    }

    function onPointerUpDrag(e) {
      if (!dragging) return;
      dragging = false;
      try { panel.releasePointerCapture?.(e.pointerId); } catch (_) {}
      panel.dataset.dragging = '0';
      saveState(panel);
    }

    handle.addEventListener('pointerdown', onPointerDownDrag);
  // mouse fallback for environments where PointerEvents may be unreliable (DevTools, emulation)
  handle.addEventListener('mousedown', (me) => { try { me.pointerType = 'mouse'; } catch (_){}; onPointerDownDrag(me); });
    window.addEventListener('pointermove', onPointerMoveDrag);
    window.addEventListener('pointerup', onPointerUpDrag);
  // mouse fallbacks
  window.addEventListener('mousemove', onPointerMoveDrag);
  window.addEventListener('mouseup', onPointerUpDrag);

    // Ensure initial positioning values exist so style.left/top can be used later
    const rect = measureRectWhenHidden(panel);
    // If panel uses right positioning in CSS, convert to left so we can move it
    const computed = getComputedStyle(panel);
    const usingRight = computed.right && computed.right !== 'auto' && !panel.style.left;
    if (usingRight) {
      const rightVal = parseFloat(computed.right || 0);
      const left = Math.max(8, window.innerWidth - rightVal - (rect.width || 380));
      panel.style.left = `${Math.round(left)}px`;
      panel.style.right = 'auto';
      panel.classList.add('is-moved');
    } else {
      if (!panel.style.left) panel.style.left = `${Math.round(rect.left || 20)}px`;
    }
    if (!panel.style.top) panel.style.top = `${Math.round(rect.top || 84)}px`;
  if (!panel.style.width) panel.style.setProperty('width', `${Math.round(rect.width || 380)}px`, 'important');
  if (!panel.style.height) panel.style.setProperty('height', `${Math.round(Math.min(rect.height || 320, window.innerHeight * 0.82))}px`, 'important');

    // Load saved state from localStorage (overrides defaults if present)
    loadState(panel);

    // create corner resizers (nw, ne, se, sw) if not present
    const directions = ['nw', 'ne', 'se', 'sw'];
    const existingResizers = panel.querySelectorAll('.panel-resizer');
    let resizers = {};
    if (!existingResizers || existingResizers.length < 4) {
      // remove any existing to recreate cleanly
      existingResizers && existingResizers.forEach(n => n.remove());
      directions.forEach(dir => {
        const r = document.createElement('div');
        r.className = `panel-resizer panel-resizer--${dir}`;
        r.dataset.dir = dir;
        r.style.zIndex = '9999';
        r.style.position = 'absolute';
        // size & touch
        r.style.width = '20px';
        r.style.height = '20px';
        r.style.touchAction = 'none';
        r.setAttribute('role', 'separator');
        r.setAttribute('aria-label', `Resize panel ${dir}`);
  // cursor direction only; actual corner placement is handled by CSS classes
  if (dir === 'nw') { r.style.cursor = 'nwse-resize'; }
  if (dir === 'ne') { r.style.cursor = 'nesw-resize'; }
  if (dir === 'se') { r.style.cursor = 'nwse-resize'; }
  if (dir === 'sw') { r.style.cursor = 'nesw-resize'; }
        panel.appendChild(r);
      });
    }
    // fetch fresh map of resizers
    panel.querySelectorAll('.panel-resizer').forEach(n => { resizers[n.dataset.dir] = n; });

    // Resizing (supports corner directions)
    let resizing = false;
    let resizeStart = { x: 0, y: 0, w: 0, h: 0, left: 0, top: 0 };
    let resizeDir = 'se';

    function onPointerDownResize(e) {
      // allow mouse-driven resize even when viewport is small (for users who open DevTools or resize window)
      // some events (mousedown) don't have pointerType -> treat MouseEvent/mousedown as mouse
      const isMouseEvent = (typeof e.pointerType === 'string' && e.pointerType === 'mouse') || e.type === 'mousedown' || (window.MouseEvent && e instanceof MouseEvent);
      if (isMobileViewport() && !isMouseEvent) return;
      if (e.button && e.button !== 0) return;
      e.preventDefault();
      const target = e.currentTarget || e.target;
      resizeDir = target.dataset?.dir || target.getAttribute('data-dir') || 'se';
      try { target.setPointerCapture?.(e.pointerId); } catch (_) {}
      e.stopPropagation(); // prevent dragging
      resizing = true;
      panel.dataset.dragging = '1';
  // if this panel was centered, remove centering so resize anchors to corners like native windows
  panel.classList.remove('modal-centered');
  panel.classList.add('is-moved');
  bringToFront(panel);
      resizeStart.x = e.clientX;
      resizeStart.y = e.clientY;
      resizeStart.w = panel.offsetWidth;
      resizeStart.h = panel.offsetHeight;
      resizeStart.left = parseFloat(panel.style.left || 0);
      resizeStart.top = parseFloat(panel.style.top || 0);
      // temporarily disable pointer events on inner content to avoid interference while resizing
      const inner = panel.querySelector('.panel-inner') || panel.querySelector(':scope > *:not(.panel-resizer)');
      if (inner) inner.style.pointerEvents = 'none';
    }

    function onPointerCancelResize(e){
      if(!resizing) return;
      resizing = false;
      try{ (e.currentTarget || e.target).releasePointerCapture?.(e.pointerId); }catch(_){ }
      panel.dataset.dragging='0';
      const inner = panel.querySelector('.panel-inner') || panel.querySelector(':scope > *:not(.panel-resizer)');
      if (inner) inner.style.pointerEvents = '';
      saveState(panel);
    }

    function onPointerMoveResize(e) {
      if (!resizing) return;
      e.preventDefault();
      const dx = e.clientX - resizeStart.x;
      const dy = e.clientY - resizeStart.y;
      // Compute maximums based on current viewport and ratio (allow per-panel override via data attributes)
      const panelMaxWRatio = parseFloat(panel.dataset.maxWidthRatio) || MAX_WIDTH_RATIO;
      const panelMaxHRatio = parseFloat(panel.dataset.maxHeightRatio) || MAX_HEIGHT_RATIO;
      const maxW = Math.max(MIN_WIDTH, Math.round(window.innerWidth * panelMaxWRatio));
      const maxH = Math.max(MIN_HEIGHT, Math.round(window.innerHeight * panelMaxHRatio));

      let newW = resizeStart.w;
      let newH = resizeStart.h;
      let newLeft = resizeStart.left;
      let newTop = resizeStart.top;

      if (resizeDir === 'se') {
        newW = clamp(Math.round(resizeStart.w + dx), MIN_WIDTH, maxW);
        newH = clamp(Math.round(resizeStart.h + dy), MIN_HEIGHT, maxH);
        // se: anchored top-left stays the same
      } else if (resizeDir === 'sw') {
        // compute width/height then derive left from difference so anchoring stays correct when clamped
        const rawW = Math.round(resizeStart.w - dx);
        newW = clamp(rawW, MIN_WIDTH, maxW);
        newH = clamp(Math.round(resizeStart.h + dy), MIN_HEIGHT, maxH);
        newLeft = Math.round(resizeStart.left + (resizeStart.w - newW));
      } else if (resizeDir === 'ne') {
        const rawH = Math.round(resizeStart.h - dy);
        newW = clamp(Math.round(resizeStart.w + dx), MIN_WIDTH, maxW);
        newH = clamp(rawH, MIN_HEIGHT, maxH);
        newTop = Math.round(resizeStart.top + (resizeStart.h - newH));
      } else if (resizeDir === 'nw') {
        const rawW = Math.round(resizeStart.w - dx);
        const rawH = Math.round(resizeStart.h - dy);
        newW = clamp(rawW, MIN_WIDTH, maxW);
        newH = clamp(rawH, MIN_HEIGHT, maxH);
        newLeft = Math.round(resizeStart.left + (resizeStart.w - newW));
        newTop = Math.round(resizeStart.top + (resizeStart.h - newH));
      }

      // Ensure left/top keep panel inside viewport
      const vw = window.innerWidth, vh = window.innerHeight;
      newLeft = clamp(newLeft, 8, Math.max(8, vw - newW - 8));
      newTop = clamp(newTop, 8, Math.max(8, vh - newH - 8));

      panel.style.setProperty('width', `${newW}px`, 'important');
      panel.style.setProperty('height', `${newH}px`, 'important');
      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
    }

    function onPointerUpResize(e) {
      if (!resizing) return;
      resizing = false;
      try { (e.currentTarget || e.target).releasePointerCapture?.(e.pointerId); } catch (_) {}
      panel.dataset.dragging = '0';
      // restore pointer events on inner content
      const inner = panel.querySelector('.panel-inner') || panel.querySelector(':scope > *:not(.panel-resizer)');
      if (inner) inner.style.pointerEvents = '';
      saveState(panel);
    }

    // attach listeners for each resizer
    Object.values(resizers).forEach(r => {
      r.addEventListener('pointerdown', onPointerDownResize);
      r.addEventListener('pointercancel', onPointerCancelResize);
      // mouse fallback
      r.addEventListener('mousedown', (me) => { try { me.pointerType = 'mouse'; } catch(_){}; onPointerDownResize(me); });
    });
    window.addEventListener('pointermove', onPointerMoveResize);
    window.addEventListener('pointerup', onPointerUpResize);
    // mouse fallbacks
    window.addEventListener('mousemove', onPointerMoveResize);
    window.addEventListener('mouseup', onPointerUpResize);

    // click to bring front
    panel.addEventListener('pointerdown', () => bringToFront(panel));
    // start drag when clicking non-interactive parts of the panel (helps if handle is not present)
    panel.addEventListener('pointerdown', (e) => {
      try {
        if (e.target && e.target.closest && e.target.closest('button, input, textarea, select, a')) return;
      } catch (_) {}
      // delegate to drag start for clicks on panel body/header
      onPointerDownDrag(e);
    });

    // dblclick handle -> maximize/restore
    handle.addEventListener('dblclick', (ev) => {
      ev.preventDefault();
      const maximized = panel.dataset.max === '1';
      if (!maximized) {
  panel.dataset.prevLeft = panel.style.left || '';
  panel.dataset.prevTop = panel.style.top || '';
  panel.dataset.prevWidth = panel.style.width || '';
  panel.dataset.prevHeight = panel.style.height || '';
  panel.style.left = '8px';
  panel.style.top = '8px';
  panel.style.setProperty('width', `${window.innerWidth - 16}px`, 'important');
  panel.style.setProperty('height', `${window.innerHeight - 16}px`, 'important');
        panel.dataset.max = '1';
        panel.classList.add('is-moved');
      } else {
        panel.style.left = panel.dataset.prevLeft || panel.style.left;
        panel.style.top = panel.dataset.prevTop || panel.style.top;
        panel.style.width = panel.dataset.prevWidth || panel.style.width;
        panel.style.height = panel.dataset.prevHeight || panel.style.height;
        panel.dataset.max = '0';
      }
      saveState(panel);
    });

    // Keyboard support
    panel.addEventListener('keydown', (ev) => {
      const step = ev.shiftKey ? 24 : 8;
      let moved = false;
      if (ev.key === 'ArrowLeft') { panel.style.left = `${parseFloat(panel.style.left || 0) - step}px`; moved = true; }
      else if (ev.key === 'ArrowRight') { panel.style.left = `${parseFloat(panel.style.left || 0) + step}px`; moved = true; }
      else if (ev.key === 'ArrowUp') { panel.style.top = `${parseFloat(panel.style.top || 0) - step}px`; moved = true; }
      else if (ev.key === 'ArrowDown') { panel.style.top = `${parseFloat(panel.style.top || 0) + step}px`; moved = true; }
    else if (ev.key === '+' || ev.key === '=') { panel.style.setProperty('width', `${panel.offsetWidth + step}px`, 'important'); moved = true; }
  else if (ev.key === '-' || ev.key === '_') { panel.style.setProperty('width', `${Math.max(MIN_WIDTH, panel.offsetWidth - step)}px`, 'important'); moved = true; }
      else if (ev.key === 'Escape') {
        const closeBtn = panel.querySelector('.close');
        if (closeBtn) closeBtn.click();
      }
      if (moved) {
        ev.preventDefault();
        panel.classList.add('is-moved');
        const vw = window.innerWidth, vh = window.innerHeight;
        const left = clamp(parseFloat(panel.style.left || 0), 8, Math.max(8, vw - panel.offsetWidth - 8));
        const top = clamp(parseFloat(panel.style.top || 0), 8, Math.max(8, vh - panel.offsetHeight - 8));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        saveState(panel);
      }
    });

    // Keep panels inside viewport on window resize
    window.addEventListener('resize', () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      if (isMobileViewport()) return;
      const left = clamp(parseFloat(panel.style.left || 8), 8, Math.max(8, vw - panel.offsetWidth - 8));
      const top = clamp(parseFloat(panel.style.top || 8), 8, Math.max(8, vh - panel.offsetHeight - 8));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      saveState(panel);
    });

    // react to custom 'panel:opened' event (when app opens a panel)
    panel.addEventListener('panel:opened', () => {
      // on open, load saved state (in case load happened while hidden) and bring to front
      loadState(panel);
      bringToFront(panel);
      // ensure it's inside viewport
      const vw = window.innerWidth, vh = window.innerHeight;
      const left = clamp(parseFloat(panel.style.left || 8), 8, Math.max(8, vw - panel.offsetWidth - 8));
      const top = clamp(parseFloat(panel.style.top || 8), 8, Math.max(8, vh - panel.offsetHeight - 8));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      // focus for keyboard moves
      panel.focus();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const panels = Array.from(document.querySelectorAll('.panel'));
    panels.forEach((p, i) => makePanel(p, i + 1));
  });
})();