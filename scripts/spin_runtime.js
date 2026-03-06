/**
 * @fileoverview SpinRuntime - Animation and spin sequence orchestration
 * 
 * This module controls:
 * - Complete spin cycle execution
 * - Reel animation sequences and timing
 * - Win presentation and celebration effects
 * - Auto-spin functionality
 * - Coin particle effects and visual feedback
 * 
 * Works as the main controller for all spin-related animations and sequences,
 * coordinating between the renderer, audio, and UI systems.
 * 
 * @module SpinRuntime
 * @author CRACKHOUSE Slot Machine
 * @version 1.0.0
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }
  root.SpinRuntime = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  /** No-op function for default callbacks */
  function noop() { }

  /**
   * Creates a spin runtime controller
   * Manages the complete spin lifecycle from bet deduction through win presentation
   * @param {Object} [options={}] - Configuration options including dependencies and callbacks
   * @returns {Object} Spin runtime controller with methods to execute and control spins
   */
  function createSpinRuntimeController(options = {}) {
    const windowRef = options.windowRef || root;
    const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
    const performanceRef = options.performanceRef || root.performance || { now: function () { return Date.now(); } };
    const getComputedStyleRef = options.getComputedStyleRef || root.getComputedStyle || function () {
      return { getPropertyValue: function () { return '96'; } };
    };
    const requestAnimationFrameRef = options.requestAnimationFrameRef || root.requestAnimationFrame || function (cb) {
      return windowRef.setTimeout(function () { cb(performanceRef.now()); }, 16);
    };
    const setTimeoutRef = options.setTimeoutRef || function (handler, delay) { return windowRef.setTimeout(handler, delay); };
    const clearTimeoutRef = options.clearTimeoutRef || function (id) { windowRef.clearTimeout(id); };
    const autoSpinState = options.autoSpinState || { enabled: false, remaining: 0, delayMs: 700, timeoutId: 0 };
    const timings = options.timings || {};
    const rows = options.rows == null ? 3 : options.rows;
    const cols = options.cols == null ? 5 : options.cols;
    const symbols = Array.isArray(options.symbols) ? options.symbols : [];
    const fallbackSymbol = options.fallbackSymbol || symbols[0] || null;
    const getGridCells = typeof options.getGridCells === 'function' ? options.getGridCells : function () { return []; };
    const getGridGhosts = typeof options.getGridGhosts === 'function' ? options.getGridGhosts : function () { return []; };
    const getSymbolFaces = typeof options.getSymbolFaces === 'function' ? options.getSymbolFaces : function () { return []; };
    const getReelStrips = typeof options.getReelStrips === 'function' ? options.getReelStrips : function () { return null; };
    const syncCellSymbol = typeof options.syncCellSymbol === 'function' ? options.syncCellSymbol : noop;
    const resetSpinGhostStyles = typeof options.resetSpinGhostStyles === 'function' ? options.resetSpinGhostStyles : noop;
    const syncGhostFromFace = typeof options.syncGhostFromFace === 'function' ? options.syncGhostFromFace : noop;
    const buildReelsFinal = typeof options.buildReelsFinal === 'function' ? options.buildReelsFinal : function () { return { final: [], starts: [] }; };
    const evaluateSpin = typeof options.evaluateSpin === 'function' ? options.evaluateSpin : async function () { return { win: 0, finalScatter: 0, wins: [] }; };
    const advanceFeatureState = typeof options.advanceFeatureState === 'function' ? options.advanceFeatureState : function (state) { return state; };
    const getSpinContext = typeof options.getSpinContext === 'function'
      ? options.getSpinContext
      : function (state, bet) { return { startedInFreeSpins: !!(state && state.inFreeSpins), spinStake: bet }; };
    const pickFreeSpinSymbol = typeof options.pickFreeSpinSymbol === 'function' ? options.pickFreeSpinSymbol : function () { return null; };
    const getFeatureState = typeof options.getFeatureState === 'function' ? options.getFeatureState : function () { return {}; };
    const setFeatureState = typeof options.setFeatureState === 'function' ? options.setFeatureState : noop;
    const getCurrentSpinCost = typeof options.getCurrentSpinCost === 'function' ? options.getCurrentSpinCost : function () { return 0; };
    const getBalance = typeof options.getBalance === 'function' ? options.getBalance : function () { return 0; };
    const setBalance = typeof options.setBalance === 'function' ? options.setBalance : noop;
    const getBetPerSpin = typeof options.getBetPerSpin === 'function' ? options.getBetPerSpin : function () { return 0; };
    const getInFreeSpins = typeof options.getInFreeSpins === 'function' ? options.getInFreeSpins : function () { return false; };
    const getFreeSpinSymbol = typeof options.getFreeSpinSymbol === 'function' ? options.getFreeSpinSymbol : function () { return null; };
    const getBonusMultiplier = typeof options.getBonusMultiplier === 'function' ? options.getBonusMultiplier : function () { return 1; };
    const setLastCollectedWin = typeof options.setLastCollectedWin === 'function' ? options.setLastCollectedWin : noop;
    const recordSessionSpinResult = typeof options.recordSessionSpinResult === 'function'
      ? options.recordSessionSpinResult
      : noop;
    const baseFreeSpins = options.baseFreeSpins == null ? 12 : options.baseFreeSpins;
    const scatterTriggerCount = options.scatterTriggerCount == null ? 3 : options.scatterTriggerCount;
    const retriggerScatterCount = options.retriggerScatterCount == null ? 4 : options.retriggerScatterCount;
    const maxFreeSpins = options.maxFreeSpins == null ? 100 : options.maxFreeSpins;
    const minBet = options.minBet == null ? 0.1 : options.minBet;
    const maxBet = options.maxBet == null ? 1000 : options.maxBet;
    const formatAmount = typeof options.formatAmount === 'function' ? options.formatAmount : function (value) { return String(value || 0); };
    const symbolLabel = typeof options.symbolLabel === 'function' ? options.symbolLabel : function (value) { return String(value || ''); };
    const setCabinetNotice = typeof options.setCabinetNotice === 'function' ? options.setCabinetNotice : noop;
    const clearHighlights = typeof options.clearHighlights === 'function' ? options.clearHighlights : noop;
    const resetCoinTray = typeof options.resetCoinTray === 'function' ? options.resetCoinTray : noop;
    const syncCabinetLights = typeof options.syncCabinetLights === 'function' ? options.syncCabinetLights : noop;
    const animateLeverPull = typeof options.animateLeverPull === 'function' ? options.animateLeverPull : noop;
    const playSpinButtonSound = typeof options.playSpinButtonSound === 'function' ? options.playSpinButtonSound : noop;
    const playCoinInsertSound = typeof options.playCoinInsertSound === 'function' ? options.playCoinInsertSound : noop;
    const updateUI = typeof options.updateUI === 'function' ? options.updateUI : noop;
    const renderResultHighlights = typeof options.renderResultHighlights === 'function' ? options.renderResultHighlights : noop;
    const setWinDetails = typeof options.setWinDetails === 'function' ? options.setWinDetails : noop;
    const showFloat = typeof options.showFloat === 'function' ? options.showFloat : noop;
    const markWinningCells = typeof options.markWinningCells === 'function' ? options.markWinningCells : function () { return null; };
    const resolveBonusPick = typeof options.resolveBonusPick === 'function'
      ? options.resolveBonusPick
      : async function () { return null; };
    const applyResultMultiplier = typeof options.applyResultMultiplier === 'function'
      ? options.applyResultMultiplier
      : function (result) { return result; };
    const playBigWinSound = typeof options.playBigWinSound === 'function' ? options.playBigWinSound : noop;
    const playSmallWinSound = typeof options.playSmallWinSound === 'function' ? options.playSmallWinSound : noop;
    const getCellCenter = typeof options.getCellCenter === 'function' ? options.getCellCenter : function () { return { x: 0, y: 0 }; };
    const spawnCoinParticles = typeof options.spawnCoinParticles === 'function' ? options.spawnCoinParticles : noop;
    const showBigWin = typeof options.showBigWin === 'function' ? options.showBigWin : noop;
    const runCoinTrayDispense = typeof options.runCoinTrayDispense === 'function' ? options.runCoinTrayDispense : noop;
    const pulseCabinetWin = typeof options.pulseCabinetWin === 'function' ? options.pulseCabinetWin : noop;
    const playReelStartSound = typeof options.playReelStartSound === 'function' ? options.playReelStartSound : noop;
    const playClick = typeof options.playClick === 'function' ? options.playClick : noop;
    const playReelStopSound = typeof options.playReelStopSound === 'function' ? options.playReelStopSound : noop;
    const consoleRef = options.consoleRef || console;
    const paidSpinInsertDelay = typeof options.paidSpinInsertDelay === 'function'
      ? options.paidSpinInsertDelay
      : function () { return 24; };
    const {
      spinButtonControlEl = null,
      betMinusEl = null,
      betPlusEl = null,
      autoSpinButtonEl = null,
      autoPresetEls = []
    } = options;

    let spinInProgress = false;

    function wait(delay) {
      return new Promise(function (resolve) {
        setTimeoutRef(resolve, delay);
      });
    }

    function cancelFilledAnimations(target) {
      if (!target || typeof target.getAnimations !== 'function') return;
      const animations = target.getAnimations();
      if (!Array.isArray(animations) || !animations.length) return;
      animations.forEach(function (animation) {
        if (!animation || typeof animation.cancel !== 'function') return;
        try {
          animation.cancel();
        } catch (error) {
          noop();
        }
      });
    }

    function bonusMultiplierLabel(value) {
      const numeric = Number(value) || 1;
      return numeric > 1 ? `x${numeric}` : 'x1';
    }

    function stickyWildLabel(stickyWildColumns) {
      const count = Array.isArray(stickyWildColumns) ? stickyWildColumns.length : 0;
      if (count <= 0) return '';
      return count === 1 ? '1 Reel Sticky' : `${count} Reel Sticky`;
    }

    function bonusFeatureSummary(config = {}) {
      const stickyLabel = stickyWildLabel(config.stickyWildColumns);
      const freeSpins = Math.max(1, Math.floor(config.freeSpins || 0));
      if (stickyLabel) return `${freeSpins} FS ${stickyLabel}`;
      return `${freeSpins} FS ${bonusMultiplierLabel(config.multiplier)}`;
    }

    function bonusNoticeSummary(config = {}) {
      const stickyLabel = stickyWildLabel(config.stickyWildColumns);
      if (stickyLabel) return `${config.freeSpins} giri gratis e ${stickyLabel.toLowerCase()}`;
      return `${config.freeSpins} giri gratis ${bonusMultiplierLabel(config.multiplier)}`;
    }

    function getViewportCenter() {
      return {
        x: (Number(windowRef.innerWidth) || 0) / 2,
        y: (Number(windowRef.innerHeight) || 0) / 2
      };
    }

    function isSpinInProgress() {
      return spinInProgress;
    }

    function isSpinControlLocked() {
      return spinInProgress || !!(spinButtonControlEl && spinButtonControlEl.disabled);
    }

    function canAutoSpinStart() {
      return getInFreeSpins() || getBalance() >= getCurrentSpinCost();
    }

    function syncControlLockState() {
      const betLocked = spinInProgress || getInFreeSpins();
      const canStartAutoNow = canAutoSpinStart();
      const autoCanToggle = autoSpinState.enabled || (!spinInProgress && canStartAutoNow);
      if (spinButtonControlEl) spinButtonControlEl.disabled = spinInProgress;
      if (betMinusEl) betMinusEl.disabled = betLocked || getBetPerSpin() <= minBet;
      if (betPlusEl) betPlusEl.disabled = betLocked || getBetPerSpin() >= maxBet;
      if (autoSpinButtonEl) autoSpinButtonEl.disabled = !autoCanToggle;
      autoPresetEls.forEach(function (button) {
        if (!button) return;
        button.disabled = spinInProgress || autoSpinState.enabled || !canStartAutoNow;
      });
    }

    function clearAutoSpinTimer() {
      if (!autoSpinState.timeoutId) return;
      clearTimeoutRef(autoSpinState.timeoutId);
      autoSpinState.timeoutId = 0;
    }

    function scheduleAutoSpinTick(delay) {
      const nextDelay = delay == null ? autoSpinState.delayMs : delay;
      if (!autoSpinState.enabled) return;
      clearAutoSpinTimer();
      autoSpinState.timeoutId = setTimeoutRef(function () {
        autoSpinState.timeoutId = 0;
        runAutoSpinTick().catch(noop);
      }, Math.max(0, nextDelay));
    }

    function stopAutoSpin(stopOptions = {}) {
      const { clearCount = false, reason = '', tone = 'info', ttl = 0 } = stopOptions;
      autoSpinState.enabled = false;
      clearAutoSpinTimer();
      if (clearCount) autoSpinState.remaining = 0;
      if (reason) setCabinetNotice(reason, tone, ttl);
      updateUI();
    }

    async function runAutoSpinTick() {
      if (!autoSpinState.enabled) return;
      if (!canAutoSpinStart()) {
        stopAutoSpin({ reason: 'Auto interrotto: crediti insufficienti.', tone: 'warning', ttl: 2200 });
        return;
      }
      if (isSpinControlLocked()) {
        scheduleAutoSpinTick(Math.max(140, Math.round(autoSpinState.delayMs * 0.35)));
        return;
      }
      const spinCompleted = await spin({ source: 'auto' });
      if (!spinCompleted || !autoSpinState.enabled) return;
      if (autoSpinState.remaining > 0) {
        autoSpinState.remaining = Math.max(0, autoSpinState.remaining - 1);
        if (autoSpinState.remaining === 0) {
          stopAutoSpin({ clearCount: true, reason: 'Auto completata.', ttl: 1400 });
          return;
        }
      }
      updateUI();
      scheduleAutoSpinTick();
    }

    function startAutoSpin(count) {
      const nextCount = count == null ? autoSpinState.remaining : count;
      if (Number.isFinite(nextCount)) autoSpinState.remaining = Math.max(0, Math.floor(nextCount));
      if (!canAutoSpinStart()) {
        setCabinetNotice('Crediti insufficienti per avviare l\'auto.', 'warning', 2200);
        updateUI();
        return false;
      }
      autoSpinState.enabled = true;
      const remainingLabel = autoSpinState.remaining > 0 ? `${autoSpinState.remaining} giri` : 'modalita infinita';
      setCabinetNotice(`Auto attiva: ${remainingLabel}.`, 'info', 1400);
      updateUI();
      scheduleAutoSpinTick();
      return true;
    }

    function toggleAutoSpin() {
      if (autoSpinState.enabled) {
        stopAutoSpin({ reason: 'Auto fermata.', ttl: 1000 });
        return;
      }
      startAutoSpin();
    }

    async function animateReels(result) {
      const faces = getSymbolFaces();
      const gridCells = getGridCells();
      const gridGhosts = getGridGhosts();
      const computed = getComputedStyleRef(documentRef && documentRef.documentElement ? documentRef.documentElement : null);
      const unit = parseInt(computed.getPropertyValue('--cell'), 10) || 96;
      const {
        baseDuration = 820,
        perReelDelay = 220,
        perReelExtra = 160,
        cycleInterval = 140,
        settle = 420
      } = timings;
      const columnRefs = Array.from({ length: cols }, function (_, col) {
        const refs = [];
        for (let row = 0; row < rows; row += 1) {
          const imgIdx = row * cols + col;
          refs.push({
            imgIdx,
            el: faces[imgIdx] || null,
            cell: gridCells[imgIdx] || null,
            ghost: gridGhosts[imgIdx] || null
          });
        }
        return refs;
      });

      function reelEase(value) {
        if (value <= 0.16) {
          const t = value / 0.16;
          return 0.1 * t * t;
        }
        if (value <= 0.72) {
          const t = (value - 0.16) / 0.56;
          return 0.1 + t * 0.7;
        }
        const t = (value - 0.72) / 0.28;
        return 0.8 + (1 - Math.pow(1 - t, 2.6)) * 0.2;
      }

      function applyColumnMotion(col, frac, progress) {
        const offset = Math.round((0.5 - frac) * (unit * (0.72 - progress * 0.14)));
        const stretchY = 1.04 + (0.08 * (1 - Math.abs(frac - 0.5) * 2));
        const squeezeX = 1.006 - (0.016 * (1 - Math.abs(frac - 0.5) * 2));
        columnRefs[col].forEach(function (ref, rowIndex) {
          const { el, ghost } = ref;
          if (!el) return;
          const rowBias = (rowIndex - 1) * 2;
          el.style.transform = `translateY(${offset + rowBias}px) scale(${squeezeX.toFixed(3)},${stretchY.toFixed(3)})`;
          if (ghost) {
            const trailDir = offset === 0 ? (frac < 0.5 ? 1 : -1) : Math.sign(offset);
            const ghostOffset = offset + (trailDir * Math.round(unit * (0.12 + ((1 - progress) * 0.16))));
            ghost.style.opacity = `${Math.max(0.22, 0.58 - (progress * 0.2))}`;
            ghost.style.transform = `translateY(${ghostOffset + rowBias}px) scale(${Math.max(0.96, squeezeX - 0.014).toFixed(3)},${(stretchY + 0.2).toFixed(3)})`;
          }
        });
      }

      function settleColumn(col) {
        const settleDuration = Math.max(200, settle - col * 10);
        const settles = [];
        columnRefs[col].forEach(function (ref) {
          const { el, cell, ghost } = ref;
          if (!el) return;
          if (cell && cell.classList && typeof cell.classList.remove === 'function') cell.classList.remove('spinning');
          const startY = -Math.round(unit * 0.17);
          const reboundY = Math.round(unit * 0.055);
          if (ghost) {
            ghost.style.transition = 'opacity 140ms linear, transform 200ms ease, filter 200ms ease';
            ghost.style.opacity = '0';
            ghost.style.transform = `translateY(${Math.round(unit * 0.18)}px) scale(1.02,1.1)`;
            ghost.style.filter = 'blur(7px) saturate(1.1) brightness(1.08)';
          }
          const animation = typeof el.animate === 'function'
            ? el.animate([
              {
                transform: `translateY(${startY}px) scale(.992,1.065)`,
                filter: 'blur(1.2px) saturate(1.12) brightness(1.04) contrast(1.03)'
              },
              {
                transform: `translateY(${reboundY}px) scale(1.01,.985)`,
                filter: 'blur(0.45px) saturate(1.08) brightness(1.02) contrast(1.01)',
                offset: 0.62
              },
              {
                transform: 'translateY(0px) scale(1,1)',
                filter: 'drop-shadow(0 10px 14px rgba(0,0,0,0.42))'
              }
            ], {
              duration: settleDuration,
              easing: 'cubic-bezier(.16,.84,.28,1)',
              fill: 'forwards'
            })
            : null;
          settles.push(animation && animation.finished ? animation.finished.catch(noop) : Promise.resolve());
        });
        return Promise.allSettled(settles).then(function () {
          columnRefs[col].forEach(function (ref) {
            const { el, cell, ghost } = ref;
            if (!el) return;
            cancelFilledAnimations(el);
            el.style.removeProperty('transition');
            el.style.removeProperty('transform');
            el.style.removeProperty('filter');
            if (ghost) {
              cancelFilledAnimations(ghost);
              ghost.style.removeProperty('transition');
              ghost.style.removeProperty('transform');
              ghost.style.removeProperty('filter');
              ghost.style.removeProperty('opacity');
              syncGhostFromFace(cell);
            }
          });
        });
      }

      const strips = getReelStrips();
      const perReelPromises = [];
      for (let col = 0; col < cols; col += 1) {
        perReelPromises.push(new Promise(function (resolve) {
          const startDelay = perReelDelay * col;
          const totalDur = baseDuration + perReelExtra * col;
          const strip = strips && strips[col] ? strips[col] : null;
          const stripLength = strip && strip.length ? strip.length : 1;
          const startIndex = result.starts && result.starts[col] !== undefined
            ? result.starts[col]
            : Math.floor(Math.random() * stripLength);
          const steps = Math.max(20, Math.round(totalDur / Math.max(46, cycleInterval * 0.6)) * 2);
          const tickStride = Math.max(1, Math.round(cycleInterval / 78));
          let frameLastStep = -1;
          let lastSoundStep = -10;

          function startSpinFrame() {
            const t0 = performanceRef.now();
            playReelStartSound(col, col === 0 ? 1 : 0.62);
            columnRefs[col].forEach(function (ref) {
              const { cell, el, ghost } = ref;
              if (cell) {
                resetSpinGhostStyles(cell);
                syncGhostFromFace(cell);
                if (cell.classList && typeof cell.classList.add === 'function') cell.classList.add('spinning');
              }
              if (el) {
                cancelFilledAnimations(el);
                el.style.transition = 'none';
                el.style.filter = 'blur(3.2px) saturate(1.14) brightness(1.08) contrast(1.03)';
              }
              if (ghost) {
                cancelFilledAnimations(ghost);
                ghost.style.transition = 'none';
                ghost.style.filter = 'blur(7.2px) saturate(1.18) brightness(1.14)';
              }
            });

            function frame(now) {
              const elapsed = now - t0;
              const u = Math.min(1, elapsed / totalDur);
              const stepFloat = reelEase(u) * steps;
              const stepNow = Math.min(steps, Math.floor(stepFloat));
              const stepFrac = stepFloat - stepNow;

              if (stepNow !== frameLastStep) {
                const idxBase = (startIndex + stepNow) % stripLength;
                columnRefs[col].forEach(function (ref) {
                  const { imgIdx, el, cell, ghost } = ref;
                  if (!el) return;
                  const sym = strip ? strip[(idxBase + (imgIdx / cols | 0)) % stripLength] : result.final[imgIdx];
                  const prevSrc = el.currentSrc || el.src;
                  if (ghost && prevSrc && ghost.src !== prevSrc) {
                    ghost.src = prevSrc;
                    if (el.dataset.symbolName) ghost.dataset.symbolName = el.dataset.symbolName;
                  }
                  syncCellSymbol(cell, (sym && sym.img) ? sym : fallbackSymbol, { syncGhost: false, skipFaceMeta: true });
                });
                const dynamicStride = u < 0.74 ? tickStride + 2 : 1;
                if (stepNow >= lastSoundStep + dynamicStride) {
                  playClick(1280 - col * 38 - u * 120, 0.022, 0.024 + (1 - u) * 0.008);
                  lastSoundStep = stepNow;
                }
                frameLastStep = stepNow;
              }

              applyColumnMotion(col, stepFrac, u);

              if (u < 1) {
                requestAnimationFrameRef(frame);
                return;
              }
              columnRefs[col].forEach(function (ref) {
                const { imgIdx, el, cell } = ref;
                if (!el) return;
                syncCellSymbol(cell, result.final[imgIdx], { syncGhost: false });
              });
              playReelStopSound(col, col === cols - 1);
              settleColumn(col).then(resolve);
            }

            requestAnimationFrameRef(frame);
          }

          setTimeoutRef(startSpinFrame, startDelay);
        }));
      }

      await Promise.all(perReelPromises);
      await wait(Math.max(70, Math.round(settle * 0.18)));
    }

    async function animateExpandedColumns(displayGrid, columns) {
      if (!columns || !columns.length) return;
      const faces = getSymbolFaces();
      columns.forEach(function (col) {
        for (let row = 0; row < rows; row += 1) {
          const idx = row * cols + col;
          const img = faces[idx];
          if (!img) continue;
          const cell = img.parentElement;
          if (cell && cell.classList && typeof cell.classList.add === 'function') cell.classList.add('expanding');
          img.style.transition = 'transform 220ms ease, opacity 220ms ease, filter 220ms ease';
          img.style.transform = 'scale(0.86)';
          img.style.opacity = '0.35';
        }
      });
      await wait(120);
      columns.forEach(function (col) {
        for (let row = 0; row < rows; row += 1) {
          const idx = row * cols + col;
          const img = faces[idx];
          const sym = displayGrid[idx];
          if (!img || !sym) continue;
          syncCellSymbol(img.parentElement, sym);
          img.style.transform = 'scale(1.05)';
          img.style.opacity = '1';
        }
      });
      await wait(260);
      columns.forEach(function (col) {
        for (let row = 0; row < rows; row += 1) {
          const idx = row * cols + col;
          const img = faces[idx];
          if (!img) continue;
          img.style.transform = 'translateY(0)';
          if (img.parentElement && img.parentElement.classList && typeof img.parentElement.classList.remove === 'function') {
            img.parentElement.classList.remove('expanding');
          }
        }
      });
    }

    async function spin(spinOptions = {}) {
      const source = spinOptions && spinOptions.source ? spinOptions.source : 'button';
      if (spinInProgress) return false;
      let spinCompleted = false;
      let win = 0;
      let celebrationLightEffect = null;
      clearHighlights();
      setCabinetNotice('');
      resetCoinTray(true);
      spinInProgress = true;
      syncControlLockState();
      syncCabinetLights();
      if (source === 'lever') animateLeverPull();
      else if (source === 'button') playSpinButtonSound();
      const spinCost = getCurrentSpinCost();
      const spinContext = getSpinContext(getFeatureState(), spinCost);
      const startedInFreeSpins = spinContext.startedInFreeSpins;
      const spinStake = spinContext.spinStake;
      try {
        if (!startedInFreeSpins) {
          if (getBalance() < spinCost) {
            setCabinetNotice('Crediti insufficienti per questo giro.', 'warning', 2200);
            return false;
          }
          setBalance(getBalance() - spinCost);
          setTimeoutRef(function () { playCoinInsertSound(); }, paidSpinInsertDelay(source));
        }
        updateUI();
        const built = buildReelsFinal();
        await animateReels(built);
        let result = await evaluateSpin(built.final, startedInFreeSpins, spinStake);
        const activeBonusMultiplier = startedInFreeSpins ? Math.max(1, Number(getBonusMultiplier()) || 1) : 1;
        if (startedInFreeSpins && activeBonusMultiplier > 1) {
          result = applyResultMultiplier(result, activeBonusMultiplier);
        }
        const baseSpinWin = Number(result.win) || 0;
        const featureColumns = Array.isArray(result.featureColumns) && result.featureColumns.length
          ? result.featureColumns
          : result.expandedColumns;
        if (result.displayGrid && featureColumns && featureColumns.length) {
          await animateExpandedColumns(result.displayGrid, featureColumns);
        }
        win = baseSpinWin;
        const finalScatter = result.finalScatter;
        const featureOutcome = advanceFeatureState(getFeatureState(), {
          startedInFreeSpins,
          finalScatter,
          baseFreeSpins,
          scatterTriggerCount,
          retriggerScatterCount,
          maxFreeSpins,
          triggerFeatureBet: spinCost,
          pickFreeSpinSymbol,
          resetFeatureBetTo: null
        });
        const bonusTriggered = featureOutcome.bonusTriggered;
        const retriggerTriggered = featureOutcome.retriggerTriggered;
        let selectedBonusPackage = null;
        if (bonusTriggered) {
          selectedBonusPackage = await resolveBonusPick({
            source,
            freeSpinSymbol: featureOutcome.freeSpinSymbol,
            freeSpins: featureOutcome.freeSpins,
            multiplier: featureOutcome.bonusMultiplier
          });
          if (selectedBonusPackage && Number.isFinite(selectedBonusPackage.freeSpins)) {
            featureOutcome.freeSpins = Math.max(1, Math.floor(selectedBonusPackage.freeSpins));
          }
          if (selectedBonusPackage && Number.isFinite(selectedBonusPackage.multiplier)) {
            featureOutcome.bonusMultiplier = Math.max(1, Number(selectedBonusPackage.multiplier) || 1);
          }
          if (selectedBonusPackage && Array.isArray(selectedBonusPackage.stickyWildColumns)) {
            featureOutcome.stickyWildColumns = selectedBonusPackage.stickyWildColumns.slice();
          }
        }
        setFeatureState(featureOutcome);
        if (result.wins && result.wins.length) {
          renderResultHighlights({
            wins: result.wins,
            scatterWin: result.scatterWin,
            finalScatter,
            formatAmount
          });
        } else if (result.scatterWin > 0) {
          setWinDetails(`<strong>Libro:</strong> x${finalScatter} → ${formatAmount(result.scatterWin)}`);
        }
        await wait(900);
        clearHighlights({ keepDetails: true });
        if (win > 0) {
          const baseWin = win;
          const bigWinThreshold = Math.max((spinStake || 0) * 10, 6);
          const megaWinThreshold = Math.max((spinStake || 0) * 20, 14);
          const warmWinThreshold = Math.max((spinStake || 0) * 4, 2.5);
          const isMegaWin = win >= megaWinThreshold;
          const isBigWin = win >= bigWinThreshold;
          const isWarmWin = !isBigWin && win >= warmWinThreshold;
          const winTier = isMegaWin ? 'mega' : isBigWin ? 'big' : isWarmWin ? 'warm' : 'regular';
          const accent = getInFreeSpins() ? '#83e7d9' : isMegaWin ? '#f2a365' : isBigWin ? '#f1cf85' : '#ecd595';
          const firstIdx = markWinningCells(result.wins);
          const point = firstIdx !== null ? getCellCenter(firstIdx) : getViewportCenter();
          showFloat(`Vincita: ${formatAmount(win)}`, winTier === 'regular' ? 900 : 1200, {
            accent: accent,
            tier: isMegaWin ? 'mega' : isWarmWin ? 'big' : 'regular',
            flare: isMegaWin || (isWarmWin && !getInFreeSpins())
          });
          if (isBigWin) {
            playBigWinSound({ tier: isMegaWin ? 'mega' : 'big', intensity: win / Math.max(1, spinStake || 1) });
            spawnCoinParticles(point.x, point.y, isMegaWin ? 26 : 18, {
              variant: isMegaWin ? 'jackpot' : 'bigwin',
              intensity: isMegaWin ? 1.42 : 1.12,
              accent: accent
            });
            showBigWin(`Colpo Grosso: ${formatAmount(win)}`, isMegaWin ? 2550 : 2100, {
              tier: isMegaWin ? 'mega' : 'big',
              accent: accent,
              flare: true
            });
            celebrationLightEffect = {
              mode: 'bigwin',
              pulse: isMegaWin ? 'jackpot' : 'soft',
              tier: isMegaWin ? 'mega' : 'big',
              duration: isMegaWin ? 2550 : 2100
            };
          } else {
            playSmallWinSound({ intensity: isWarmWin ? 1.04 : 0.82 });
            spawnCoinParticles(point.x, point.y, isWarmWin ? 12 : 7, {
              variant: 'coins',
              intensity: isWarmWin ? 0.96 : 0.72,
              accent: accent
            });
            celebrationLightEffect = getInFreeSpins()
              ? { mode: 'freespins', pulse: 'bonus', tier: 'bonus', duration: 1800 }
              : { mode: 'win', pulse: 'soft', tier: isWarmWin ? 'big' : 'regular', duration: isWarmWin ? 1600 : 1360 };
          }
          win = Math.max(0, Number(baseWin) || 0);
          if (win > 0) {
            setBalance(getBalance() + win);
            setLastCollectedWin(win);
            runCoinTrayDispense(win, spinStake);
          } else {
            setLastCollectedWin(0);
          }
        } else {
          setLastCollectedWin(0);
        }
        if (bonusTriggered) {
          const currentBonusMultiplier = Math.max(1, Number(getBonusMultiplier()) || 1);
          const activeStickyWildColumns = Array.isArray(featureOutcome.stickyWildColumns)
            ? featureOutcome.stickyWildColumns
            : [];
          const bonusLabel = selectedBonusPackage && selectedBonusPackage.title
            ? `Bonus ${selectedBonusPackage.title}`
            : 'Bonus Neon Vault';
          showFloat(`${bonusLabel} • ${bonusFeatureSummary({
            freeSpins: featureOutcome.freeSpins,
            multiplier: currentBonusMultiplier,
            stickyWildColumns: activeStickyWildColumns
          })}`, 1500, {
            accent: '#83e7d9',
            tier: 'bonus',
            flare: true
          });
          setCabinetNotice(
            `Neon Vault attivo: ${bonusNoticeSummary({
              freeSpins: featureOutcome.freeSpins,
              multiplier: currentBonusMultiplier,
              stickyWildColumns: activeStickyWildColumns
            })} con simbolo speciale ${symbolLabel(getFreeSpinSymbol())}.`,
            'success',
            2600
          );
          if (!celebrationLightEffect || celebrationLightEffect.mode !== 'bigwin') {
            celebrationLightEffect = { mode: 'freespins', pulse: 'bonus', tier: 'bonus', duration: 2050 };
          }
        } else if (retriggerTriggered) {
          const currentFeatureState = getFeatureState();
          const retriggerStickyWildColumns = Array.isArray(currentFeatureState.stickyWildColumns)
            ? currentFeatureState.stickyWildColumns
            : [];
          showFloat(`Retrigger • +${baseFreeSpins} giri • ${stickyWildLabel(retriggerStickyWildColumns) || bonusMultiplierLabel(getBonusMultiplier())}`, 1100, {
            accent: '#83e7d9',
            tier: 'bonus',
            flare: false
          });
          setCabinetNotice(
            `Neon Vault ricaricato: +${baseFreeSpins} giri • ${stickyWildLabel(retriggerStickyWildColumns) || bonusMultiplierLabel(getBonusMultiplier())}.`,
            'success',
            2200
          );
          if (!celebrationLightEffect || celebrationLightEffect.mode !== 'bigwin') {
            celebrationLightEffect = { mode: 'freespins', pulse: 'bonus', tier: 'bonus', duration: 1800 };
          }
        }
        recordSessionSpinResult({
          baseWin: baseSpinWin,
          collectedWin: win,
          source,
          startedInFreeSpins
        });
        spinCompleted = true;
        if (!getInFreeSpins() && autoSpinState.enabled && getBalance() < getCurrentSpinCost()) {
          stopAutoSpin({ reason: 'Auto interrotto: crediti insufficienti.', tone: 'warning', ttl: 2200 });
        }
        return true;
      } catch (error) {
        if (consoleRef && typeof consoleRef.error === 'function') consoleRef.error('Spin failed', error);
        if (autoSpinState.enabled) {
          stopAutoSpin({ reason: 'Auto interrotta per un errore.', tone: 'warning', ttl: 2400 });
        } else {
          setCabinetNotice('Errore durante il giro.', 'warning', 2200);
        }
        return false;
      } finally {
        spinInProgress = false;
        if (spinCompleted && celebrationLightEffect) {
          pulseCabinetWin(celebrationLightEffect);
        } else {
          syncCabinetLights();
        }
        updateUI();
      }
    }

    return {
      isSpinInProgress,
      isSpinControlLocked,
      syncControlLockState,
      clearAutoSpinTimer,
      canAutoSpinStart,
      scheduleAutoSpinTick,
      stopAutoSpin,
      runAutoSpinTick,
      startAutoSpin,
      toggleAutoSpin,
      animateReels,
      animateExpandedColumns,
      spin
    };
  }

  return { createSpinRuntimeController };
});
