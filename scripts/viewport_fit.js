(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }
  root.ViewportFit = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function createViewportFitController(options = {}) {
    const appEl = options.appEl || null;
    const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
    const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
    const getComputedStyleRef = options.getComputedStyleRef
      || (windowRef && typeof windowRef.getComputedStyle === 'function' ? windowRef.getComputedStyle.bind(windowRef) : null);
    const requestFrame = options.requestFrame
      || (windowRef && windowRef.requestAnimationFrame ? windowRef.requestAnimationFrame.bind(windowRef) : null);
    const cancelFrame = options.cancelFrame
      || (windowRef && windowRef.cancelAnimationFrame ? windowRef.cancelAnimationFrame.bind(windowRef) : null);

    const state = { frame: 0, scale: 1, fontsReady: false, eventsBound: false };

    function getScale() {
      if (!appEl || !windowRef || !documentRef || !getComputedStyleRef) return 1;
      if (windowRef.innerWidth < 1080) return 1;
      const previousZoom = appEl.style.zoom || '1';
      appEl.style.zoom = '1';
      const bodyStyles = getComputedStyleRef(documentRef.body);
      const paddingX = (parseFloat(bodyStyles.paddingLeft) || 0) + (parseFloat(bodyStyles.paddingRight) || 0);
      const paddingY = (parseFloat(bodyStyles.paddingTop) || 0) + (parseFloat(bodyStyles.paddingBottom) || 0);
      const availableWidth = Math.max(320, windowRef.innerWidth - paddingX - 10);
      const availableHeight = Math.max(320, windowRef.innerHeight - paddingY - 10);
      const naturalWidth = Math.max(appEl.offsetWidth, appEl.scrollWidth);
      const naturalHeight = Math.max(appEl.offsetHeight, appEl.scrollHeight);
      appEl.style.zoom = previousZoom;
      if (naturalWidth <= availableWidth + 12 && naturalHeight <= availableHeight + 12) {
        return 1;
      }
      return Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
    }

    function apply() {
      if (!appEl) return;
      const scale = getScale();
      const nextZoom = scale >= 0.995 ? '1' : scale.toFixed(3);
      state.scale = scale;
      if (appEl.style.zoom !== nextZoom) appEl.style.zoom = nextZoom;
    }

    function schedule() {
      if (!requestFrame || !cancelFrame) {
        apply();
        return;
      }
      if (state.frame) cancelFrame(state.frame);
      state.frame = requestFrame(function () {
        state.frame = 0;
        apply();
      });
    }

    function bindEvents() {
      if (state.eventsBound || !windowRef) return;
      state.eventsBound = true;
      windowRef.addEventListener('load', schedule);
      windowRef.addEventListener('resize', schedule, { passive: true });
      windowRef.addEventListener('orientationchange', schedule, { passive: true });
      if (windowRef.visualViewport) {
        windowRef.visualViewport.addEventListener('resize', schedule, { passive: true });
      }
      if (!state.fontsReady && documentRef && documentRef.fonts && documentRef.fonts.ready) {
        state.fontsReady = true;
        documentRef.fonts.ready.then(function () {
          schedule();
        }).catch(function () { });
      }
    }

    return {
      getScale,
      apply,
      schedule,
      bindEvents,
      getState: function () { return { ...state }; }
    };
  }

  return { createViewportFitController };
});
