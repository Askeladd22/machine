/**
 * @fileoverview SlotRenderer - Handles rendering and visual presentation of slot symbols
 * 
 * This module manages:
 * - Grid creation and DOM manipulation for symbol cells
 * - Symbol image loading and caching
 * - Visual synchronization between face and ghost elements (for animations)
 * - Reel strip initialization with weighted symbol distribution
 * - Tumble animations and visual effects
 * 
 * Works in conjunction with SpinRuntime to provide smooth visual feedback
 * during spins and win presentations.
 * 
 * @module SlotRenderer
 * @author CRASHHOUSE Slot Machine
 * @version 1.0.0
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }
  root.SlotRenderer = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  /** No-op function for default callbacks */
  function noop() { }

  /**
   * Default function to get symbol label
   * @param {Object} value - Symbol object
   * @returns {string} Symbol label
   */
  function defaultSymbolLabel(value) {
    return value && (value.label || value.name) ? (value.label || value.name) : '';
  }

  /**
   * Default function to clone a symbol
   * @param {Object} symbol - Symbol to clone
   * @returns {Object} Cloned symbol
   */
  function defaultCloneSymbol(symbol) {
    return symbol ? { ...symbol } : symbol;
  }

  /**
   * Creates a slot renderer controller
   * Manages the visual representation of the slot grid and symbol rendering
   * @param {Object} [options={}] - Configuration options
   * @param {HTMLElement} [options.slotEl] - Container element for the slot grid
   * @param {number} [options.total=15] - Total number of symbol positions
   * @param {number} [options.cols=5] - Number of columns
   * @param {number} [options.rows=3] - Number of rows
   * @param {Array} [options.symbols] - Array of symbol definitions
   * @param {Object} [options.scatter] - Scatter symbol definition
   * @param {Function} [options.symbolLabel] - Function to get symbol labels
   * @param {Function} [options.decorateCellTheme] - Function to decorate cells with themes
   * @param {Function} [options.rng] - Random number generator
   * @returns {Object} Renderer controller with methods to manage visual presentation
   */
  function createSlotRendererController(options = {}) {
    const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
    const slotEl = options.slotEl || null;
    const total = options.total == null ? 15 : options.total;
    const cols = options.cols == null ? 5 : options.cols;
    const rows = options.rows == null ? 3 : options.rows;
    const symbols = Array.isArray(options.symbols) ? options.symbols : [];
    const scatter = options.scatter || null;
    const symbolWeights = Array.isArray(options.symbolWeights) ? options.symbolWeights : [];
    const scatterWeight = options.scatterWeight == null ? 1 : options.scatterWeight;
    const symbolLabel = typeof options.symbolLabel === 'function' ? options.symbolLabel : defaultSymbolLabel;
    const decorateCellTheme = typeof options.decorateCellTheme === 'function' ? options.decorateCellTheme : noop;
    const getComputedStyleRef = options.getComputedStyleRef || root.getComputedStyle || function () {
      return { getPropertyValue: function () { return '96'; } };
    };
    const setTimeoutRef = options.setTimeoutRef || function (handler, delay) { return root.setTimeout(handler, delay); };
    const cloneSymbol = typeof options.cloneSymbol === 'function' ? options.cloneSymbol : defaultCloneSymbol;
    const buildWeightedSymbols = typeof options.buildWeightedSymbols === 'function' ? options.buildWeightedSymbols : function () { return []; };
    const initReelStripsCore = typeof options.initReelStrips === 'function' ? options.initReelStrips : function () { return []; };
    const buildReelsFinalCore = typeof options.buildReelsFinal === 'function'
      ? options.buildReelsFinal
      : function () { return { final: [], starts: [] }; };
    const pickFreeSpinSymbolCore = typeof options.pickFreeSpinSymbol === 'function'
      ? options.pickFreeSpinSymbol
      : function () { return null; };
    const rng = typeof options.rng === 'function' ? options.rng : Math.random;
    const stripLength = options.stripLength == null ? 256 : options.stripLength;
    const reelStripSteps = options.reelStripSteps || [];
    const reelStripOffsets = options.reelStripOffsets || [];
    const getAnteOn = typeof options.getAnteOn === 'function' ? options.getAnteOn : function () { return false; };
    const anteScatterBoost = options.anteScatterBoost == null ? 1 : options.anteScatterBoost;
    const preloadUrls = Array.isArray(options.preloadUrls) ? options.preloadUrls : [];
    const ImageCtor = options.ImageCtor || root.Image || null;

    let gridCells = [];
    let gridFaces = [];
    let gridGhosts = [];
    let reelStrips = null;
    let reelStripVariantKey = null;

    const baseWeightedSymbols = buildWeightedSymbols({
      symbols,
      scatter,
      symbolWeights,
      scatterWeight
    });
    const imageCache = new Map();

    function getCells() {
      return gridCells;
    }

    function getFaces() {
      return gridFaces;
    }

    function getGhosts() {
      return gridGhosts;
    }

    function getCellParts(cell) {
      if (!cell) return { face: null, ghost: null };
      const face = cell._faceEl || (typeof cell.querySelector === 'function' ? cell.querySelector('.symbol-face') : null);
      const ghost = cell._ghostEl || (typeof cell.querySelector === 'function' ? cell.querySelector('.spin-ghost') : null);
      if (face && !cell._faceEl) cell._faceEl = face;
      if (ghost && !cell._ghostEl) cell._ghostEl = ghost;
      return { face, ghost };
    }

    function syncGhostFromFace(cell) {
      if (!cell) return;
      const parts = getCellParts(cell);
      const face = parts.face;
      const ghost = parts.ghost;
      if (!face || !ghost) return;
      const src = face.currentSrc || face.src;
      if (src && ghost.src !== src) ghost.src = src;
      if (face.dataset && face.dataset.symbolName) ghost.dataset.symbolName = face.dataset.symbolName;
      ghost.alt = '';
    }

    function resetSpinGhostStyles(cell) {
      if (!cell) return;
      const ghost = getCellParts(cell).ghost;
      if (!ghost || !ghost.style) return;
      ghost.style.removeProperty('transition');
      ghost.style.removeProperty('transform');
      ghost.style.removeProperty('filter');
      ghost.style.removeProperty('opacity');
    }

    function syncCellSymbol(cell, sym, syncOptions = {}) {
      if (!cell || !sym) return;
      const syncGhost = syncOptions.syncGhost !== false;
      const skipFaceMeta = syncOptions.skipFaceMeta === true;
      const parts = getCellParts(cell);
      const face = parts.face;
      const ghost = parts.ghost;
      const symbolName = sym.name || '';
      const label = skipFaceMeta ? '' : symbolLabel(sym);
      if (face) {
        if (!face.dataset) face.dataset = {};
        if (face.dataset.symbolName !== symbolName) {
          face.src = sym.img;
          face.dataset.symbolName = symbolName;
        }
        if (!skipFaceMeta) {
          face.alt = label;
          face.title = label;
        }
      }
      if (syncGhost && ghost) {
        if (!ghost.dataset) ghost.dataset = {};
        if (ghost.dataset.symbolName !== symbolName) {
          ghost.src = sym.img;
          ghost.dataset.symbolName = symbolName;
        }
        ghost.alt = '';
      }
      decorateCellTheme(cell, sym);
    }

    function buildGrid() {
      if (!slotEl || !documentRef || typeof documentRef.createElement !== 'function') return;
      slotEl.innerHTML = '';
      gridCells = Array(total);
      gridFaces = Array(total);
      gridGhosts = Array(total);
      for (let index = 0; index < total; index += 1) {
        const cell = documentRef.createElement('div');
        cell.className = 'cell';
        cell.dataset.col = String((index % cols) + 1);
        cell.dataset.row = String(Math.floor(index / cols) + 1);
        const ghost = documentRef.createElement('img');
        ghost.className = 'spin-ghost';
        ghost.alt = '';
        if (typeof ghost.setAttribute === 'function') ghost.setAttribute('aria-hidden', 'true');
        const face = documentRef.createElement('img');
        face.id = `img-${index}`;
        face.className = 'symbol-face';
        cell._ghostEl = ghost;
        cell._faceEl = face;
        gridCells[index] = cell;
        gridFaces[index] = face;
        gridGhosts[index] = ghost;
        const symIdx = index % Math.max(1, symbols.length);
        const sym = symbols[symIdx] || symbols[0] || null;
        cell.appendChild(ghost);
        cell.appendChild(face);
        if (sym) syncCellSymbol(cell, sym);
        slotEl.appendChild(cell);
      }
    }

    function animateTumble(finalGrid, drop, newFlag) {
      const faces = getFaces();
      const unit = parseInt(getComputedStyleRef(documentRef && documentRef.documentElement ? documentRef.documentElement : null).getPropertyValue('--cell'), 10) || 96;
      faces.forEach(function (img, index) {
        if (!img) return;
        img.style.transition = 'none';
        syncCellSymbol(img.parentElement, finalGrid[index]);
        img.style.transform = `translateY(${-drop[index] * unit}px)`;
        img.style.opacity = newFlag[index] ? '0' : '1';
      });
      if (slotEl && typeof slotEl.getBoundingClientRect === 'function') slotEl.getBoundingClientRect();
      faces.forEach(function (img, index) {
        if (!img) return;
        const col = index % cols;
        const delay = col * 60;
        img.style.transition = `transform 900ms cubic-bezier(.2,.9,.2,1) ${delay}ms, opacity 900ms ${delay}ms`;
        img.style.transform = 'translateY(0)';
        img.style.opacity = '1';
      });
      return new Promise(function (resolve) {
        setTimeoutRef(resolve, 1250);
      });
    }

    function getBaseWeightedSymbols() {
      return baseWeightedSymbols.map(function (item) {
        return { sym: cloneSymbol(item.sym), weight: item.weight };
      });
    }

    function getEffectiveWeightedSymbols() {
      const effective = getBaseWeightedSymbols();
      if (getAnteOn()) {
        effective.forEach(function (item) {
          if (item.sym && item.sym.isScatter) item.weight *= anteScatterBoost;
        });
      }
      return effective;
    }

    function initReelStrips() {
      reelStripVariantKey = getAnteOn() ? 'ante' : 'base';
      reelStrips = initReelStripsCore(getEffectiveWeightedSymbols(), {
        cols,
        stripLength,
        reelStripSteps,
        reelStripOffsets
      });
      return reelStrips;
    }

    function getReelStrips() {
      return reelStrips;
    }

    function invalidateReelStrips() {
      reelStrips = null;
      reelStripVariantKey = null;
      return reelStrips;
    }

    function ensureReelStrips() {
      const nextVariantKey = getAnteOn() ? 'ante' : 'base';
      if (!reelStrips || reelStripVariantKey !== nextVariantKey) {
        return initReelStrips();
      }
      return reelStrips;
    }

    function preloadImages() {
      if (!ImageCtor) return imageCache;
      preloadUrls.forEach(function (url) {
        if (!url || imageCache.has(url)) return;
        const image = new ImageCtor();
        image.src = url;
        imageCache.set(url, image);
      });
      return imageCache;
    }

    function getImageCache() {
      return imageCache;
    }

    function buildReelsFinal() {
      return buildReelsFinalCore(rng, ensureReelStrips(), { rows, cols });
    }

    function pickFreeSpinSymbol() {
      return pickFreeSpinSymbolCore(rng, symbols);
    }

    return {
      getCells,
      getFaces,
      getGhosts,
      getCellParts,
      syncGhostFromFace,
      resetSpinGhostStyles,
      syncCellSymbol,
      buildGrid,
      animateTumble,
      getBaseWeightedSymbols,
      getEffectiveWeightedSymbols,
      initReelStrips,
      getReelStrips,
      invalidateReelStrips,
      preloadImages,
      getImageCache,
      buildReelsFinal,
      pickFreeSpinSymbol
    };
  }

  return { createSlotRendererController };
});
