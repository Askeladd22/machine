(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }
  root.RuntimeUI = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const DEFAULT_SPEED_PRESETS = {
    slow: { label: 'Lenta', baseDuration: 1000, perReelDelay: 280, perReelExtra: 220, cycleInterval: 180, fastSwipe: 340, settle: 520 },
    normal: { label: 'Normale', baseDuration: 820, perReelDelay: 220, perReelExtra: 160, cycleInterval: 140, fastSwipe: 260, settle: 420 },
    fast: { label: 'Rapida', baseDuration: 560, perReelDelay: 140, perReelExtra: 100, cycleInterval: 96, fastSwipe: 180, settle: 300 }
  };

  function noop() { }

  function createRuntimeBindingsController(options = {}) {
    const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
    const windowRef = options.windowRef || root;
    const paytableUI = options.paytableUI || null;
    const autoSpinState = options.autoSpinState || { enabled: false, remaining: 0, delayMs: 700 };
    const getTimings = typeof options.getTimings === 'function'
      ? options.getTimings
      : function () { return options.timings || null; };
    const showFloat = typeof options.showFloat === 'function' ? options.showFloat : noop;
    const setAmbientEnabled = typeof options.setAmbientEnabled === 'function' ? options.setAmbientEnabled : noop;
    const isAmbientEnabled = typeof options.isAmbientEnabled === 'function' ? options.isAmbientEnabled : function () { return false; };
    const startAutoSpin = typeof options.startAutoSpin === 'function' ? options.startAutoSpin : noop;
    const toggleAutoSpin = typeof options.toggleAutoSpin === 'function' ? options.toggleAutoSpin : noop;
    const spin = typeof options.spin === 'function' ? options.spin : noop;
    const isSpinControlLocked = typeof options.isSpinControlLocked === 'function' ? options.isSpinControlLocked : function () { return false; };
    const increaseBet = typeof options.increaseBet === 'function' ? options.increaseBet : noop;
    const decreaseBet = typeof options.decreaseBet === 'function' ? options.decreaseBet : noop;
    const persistCabinetState = typeof options.persistCabinetState === 'function' ? options.persistCabinetState : noop;
    const stopAttractMode = typeof options.stopAttractMode === 'function' ? options.stopAttractMode : noop;
    const stopAmbientSound = typeof options.stopAmbientSound === 'function' ? options.stopAmbientSound : noop;
    const startAmbientSound = typeof options.startAmbientSound === 'function' ? options.startAmbientSound : noop;
    const syncCabinetLights = typeof options.syncCabinetLights === 'function' ? options.syncCabinetLights : noop;
    const syncAmbientMood = typeof options.syncAmbientMood === 'function' ? options.syncAmbientMood : noop;
    const setPaytableOpen = typeof options.setPaytableOpen === 'function' ? options.setPaytableOpen : noop;
    const speedPresets = options.speedPresets || DEFAULT_SPEED_PRESETS;
    const {
      speedSlowEl = null,
      speedNormalEl = null,
      speedFastEl = null,
      ambientToggleEl = null,
      autoPreset10El = null,
      autoPreset25El = null,
      autoPreset50El = null,
      autoPreset100El = null,
      spinButtonControlEl = null,
      autoSpinButtonEl = null,
      betPlusEl = null,
      betMinusEl = null,
      spinLeverEl = null
    } = options;

    let lifecycleBound = false;
    let controlsBound = false;

    function applySpeedPreset(presetKey) {
      const preset = speedPresets[presetKey];
      if (!preset) return;
      const timings = getTimings();
      if (timings) {
        const label = preset.label;
        const timingValues = { ...preset };
        delete timingValues.label;
        Object.assign(timings, timingValues);
      }
      autoSpinState.delayMs = Math.max(240, preset.settle + 260);
      showFloat(`Velocita: ${preset.label || 'Normale'}`, 800);
    }

    function handleVisibilityChange() {
      if (!documentRef || !documentRef.hidden) {
        if (isAmbientEnabled()) startAmbientSound();
        syncCabinetLights();
        syncAmbientMood();
        return;
      }
      persistCabinetState();
      stopAttractMode('off');
      stopAmbientSound(220);
    }

    function handleEscapeKey(event) {
      if (event && event.key === 'Escape') setPaytableOpen(false);
    }

    function handleSpacebarKey(event) {
      // Spacebar to trigger lever pull (only if spin control is not locked)
      if (event && event.code === 'Space' && spinLeverEl) {
        event.preventDefault();
        if (!isSpinControlLocked()) {
          spin({ source: 'lever' });
        }
      }
    }

    function bindLifecycleEvents() {
      if (lifecycleBound) return;
      lifecycleBound = true;
      if (documentRef && typeof documentRef.addEventListener === 'function') {
        documentRef.addEventListener('visibilitychange', handleVisibilityChange);
      }
      if (windowRef && typeof windowRef.addEventListener === 'function') {
        windowRef.addEventListener('pagehide', persistCabinetState, { passive: true });
        windowRef.addEventListener('beforeunload', persistCabinetState);
        windowRef.addEventListener('keydown', handleEscapeKey);
        windowRef.addEventListener('keydown', handleSpacebarKey);
      }
    }

    function bindControlEvents() {
      if (controlsBound) return;
      controlsBound = true;
      if (speedSlowEl) speedSlowEl.addEventListener('click', function () { applySpeedPreset('slow'); });
      if (speedNormalEl) speedNormalEl.addEventListener('click', function () { applySpeedPreset('normal'); });
      if (speedFastEl) speedFastEl.addEventListener('click', function () { applySpeedPreset('fast'); });
      if (ambientToggleEl) ambientToggleEl.addEventListener('click', function () { setAmbientEnabled(!isAmbientEnabled(), true); });
      if (autoPreset10El) autoPreset10El.addEventListener('click', function () { startAutoSpin(10); });
      if (autoPreset25El) autoPreset25El.addEventListener('click', function () { startAutoSpin(25); });
      if (autoPreset50El) autoPreset50El.addEventListener('click', function () { startAutoSpin(50); });
      if (autoPreset100El) autoPreset100El.addEventListener('click', function () { startAutoSpin(100); });
      if (spinButtonControlEl) spinButtonControlEl.addEventListener('click', function () { spin({ source: 'button' }); });
      if (autoSpinButtonEl) autoSpinButtonEl.addEventListener('click', toggleAutoSpin);
      if (betPlusEl) betPlusEl.addEventListener('click', increaseBet);
      if (betMinusEl) betMinusEl.addEventListener('click', decreaseBet);
      if (spinLeverEl) {
        spinLeverEl.addEventListener('click', function () {
          if (isSpinControlLocked()) return;
          spin({ source: 'lever' });
        });
      }
      if (paytableUI && typeof paytableUI.bindEvents === 'function') paytableUI.bindEvents();
    }

    return {
      applySpeedPreset,
      bindLifecycleEvents,
      bindControlEvents
    };
  }

  function createRuntimeUIController(options = {}) {
    const autoSpinState = options.autoSpinState || { enabled: false, remaining: 0, delayMs: 700 };
    const defaultPaytableTab = options.defaultPaytableTab || 'values';
    const appEl = options.appEl || null;
    const balanceEl = options.balanceEl || null;
    const activeBetEl = options.activeBetEl || null;
    const modeEl = options.modeEl || null;
    const fsEl = options.fsEl || null;
    const featureStateTitleEl = options.featureStateTitleEl || null;
    const featureStateMetaEl = options.featureStateMetaEl || null;
    const showPlaqueStateEl = options.showPlaqueStateEl || null;
    const betDisplayEl = options.betDisplayEl || null;
    const autoSpinButtonEl = options.autoSpinButtonEl || null;
    const autoStatusEl = options.autoStatusEl || null;
    const collectMeterEl = options.collectMeterEl || null;
    const sessionHitRateEl = options.sessionHitRateEl || null;
    const sessionBestWinEl = options.sessionBestWinEl || null;
    const sessionStreakEl = options.sessionStreakEl || null;
    const spinLeverEl = options.spinLeverEl || null;
    const getBalance = typeof options.getBalance === 'function' ? options.getBalance : function () { return 0; };
    const currentFeatureBet = typeof options.currentFeatureBet === 'function' ? options.currentFeatureBet : function () { return 0; };
    const getInFreeSpins = typeof options.getInFreeSpins === 'function' ? options.getInFreeSpins : function () { return false; };
    const getFreeSpins = typeof options.getFreeSpins === 'function' ? options.getFreeSpins : function () { return 0; };
    const getFeatureState = typeof options.getFeatureState === 'function' ? options.getFeatureState : function () { return {}; };
    const getBonusMultiplier = typeof options.getBonusMultiplier === 'function' ? options.getBonusMultiplier : function () { return 1; };
    const getBetPerSpin = typeof options.getBetPerSpin === 'function' ? options.getBetPerSpin : function () { return 0; };
    const getLastCollectedWin = typeof options.getLastCollectedWin === 'function' ? options.getLastCollectedWin : function () { return 0; };
    const getSessionStats = typeof options.getSessionStats === 'function'
      ? options.getSessionStats
      : function () { return { hitRateLabel: '0%', bestWin: 0, streakLabel: '-' }; };
    const getGridCells = typeof options.getGridCells === 'function' ? options.getGridCells : function () { return []; };
    const restoreCabinetState = typeof options.restoreCabinetState === 'function' ? options.restoreCabinetState : noop;
    const persistCabinetState = typeof options.persistCabinetState === 'function' ? options.persistCabinetState : noop;
    const updateAmbientToggleUI = typeof options.updateAmbientToggleUI === 'function' ? options.updateAmbientToggleUI : noop;
    const syncAmbientMood = typeof options.syncAmbientMood === 'function' ? options.syncAmbientMood : noop;
    const playLeverSound = typeof options.playLeverSound === 'function' ? options.playLeverSound : noop;
    const formatAmount = typeof options.formatAmount === 'function' ? options.formatAmount : function (value) { return String(value || 0); };
    const getPaytableUI = typeof options.getPaytableUI === 'function' ? options.getPaytableUI : function () { return null; };
    const getFeedbackUI = typeof options.getFeedbackUI === 'function' ? options.getFeedbackUI : function () { return null; };
    const getViewportFit = typeof options.getViewportFit === 'function' ? options.getViewportFit : function () { return null; };
    const getRuntimeBindings = typeof options.getRuntimeBindings === 'function' ? options.getRuntimeBindings : function () { return null; };
    const getSpinRuntime = typeof options.getSpinRuntime === 'function' ? options.getSpinRuntime : function () { return null; };
    const windowRef = options.windowRef || root;
    const setTimeoutRef = options.setTimeoutRef || function (handler, delay) { return windowRef.setTimeout(handler, delay); };
    const clearTimeoutRef = options.clearTimeoutRef || function (id) { windowRef.clearTimeout(id); };

    let leverPullTimer = 0;

    function setFeatureStateUI(state, title, meta) {
      if (appEl && appEl.dataset) appEl.dataset.featureState = state;
      if (featureStateTitleEl) featureStateTitleEl.textContent = title || '';
      if (featureStateMetaEl) featureStateMetaEl.textContent = meta || '';
      if (showPlaqueStateEl) showPlaqueStateEl.textContent = title || '';
    }

    function joinFeatureMeta(parts) {
      return parts.filter(Boolean).join(' • ');
    }

    function formatMultiplierLabel(value) {
      const numeric = Math.max(1, Number(value) || 1);
      return `x${numeric.toFixed(numeric % 1 === 0 ? 0 : 2)}`;
    }

    function autoButtonLabel() {
      return autoSpinState.enabled ? 'Ferma Auto' : 'Auto';
    }

    function autoStatusLabel() {
      return autoSpinState.enabled
        ? (autoSpinState.remaining > 0 ? String(autoSpinState.remaining) : '?')
        : '?';
    }

    function setCabinetNotice(message = '', tone = 'info', ttl = 0) {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) feedbackUI.setCabinetNotice(message, tone, ttl);
    }

    function renderPaylineMap() {
      const paytableUI = getPaytableUI();
      if (paytableUI) paytableUI.renderPaylineMap();
    }

    function renderPaytable() {
      const paytableUI = getPaytableUI();
      if (paytableUI) paytableUI.renderPaytable();
    }

    function setPaytableTab(tab, nextOptions = {}) {
      const paytableUI = getPaytableUI();
      if (paytableUI) paytableUI.setTab(tab, nextOptions);
    }

    function setPaytableOpen(open) {
      const paytableUI = getPaytableUI();
      if (paytableUI) paytableUI.setOpen(open);
    }

    function togglePaytable(forceOpen) {
      const paytableUI = getPaytableUI();
      if (paytableUI) paytableUI.toggle(forceOpen);
    }

    function animateLeverPull() {
      if (!spinLeverEl) return;
      // Remove animation class to reset it
      spinLeverEl.classList.remove('is-pulled');
      // Force reflow to trigger animation restart
      void spinLeverEl.offsetWidth;
      // Trigger the 400ms vintage lever pull animation (0° → 45° → 0°)
      spinLeverEl.classList.add('is-pulled');
      playLeverSound();
      if (leverPullTimer) clearTimeoutRef(leverPullTimer);
      // Remove class after animation completes (400ms)
      leverPullTimer = setTimeoutRef(function () {
        spinLeverEl.classList.remove('is-pulled');
        leverPullTimer = 0;
      }, 400);
    }

    function paidSpinInsertDelay(source = 'button') {
      if (source === 'lever') return 128;
      if (source === 'button') return 42;
      return 24;
    }

    function stopAttractMode(nextState = 'off') {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) feedbackUI.stopAttractMode(nextState);
    }

    function syncCabinetLights() {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) feedbackUI.syncCabinetLights();
    }

    function pulseCabinetWin(effect = 1800) {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) feedbackUI.pulseCabinetWin(effect);
    }

    function getViewportFitScale() {
      const viewportFit = getViewportFit();
      return viewportFit ? viewportFit.getScale() : 1;
    }

    function applyViewportFit() {
      const viewportFit = getViewportFit();
      if (viewportFit) viewportFit.apply();
    }

    function scheduleViewportFit() {
      const viewportFit = getViewportFit();
      if (viewportFit) viewportFit.schedule();
    }

    function bindViewportFitEvents() {
      const viewportFit = getViewportFit();
      if (viewportFit) viewportFit.bindEvents();
    }

    function bindLifecycleEvents() {
      const runtimeBindings = getRuntimeBindings();
      if (runtimeBindings) runtimeBindings.bindLifecycleEvents();
    }

    function isSpinControlLocked() {
      const spinRuntime = getSpinRuntime();
      return spinRuntime ? spinRuntime.isSpinControlLocked() : false;
    }

    function syncControlLockState() {
      const spinRuntime = getSpinRuntime();
      if (spinRuntime) spinRuntime.syncControlLockState();
    }

    function clearAutoSpinTimer() {
      const spinRuntime = getSpinRuntime();
      if (spinRuntime) spinRuntime.clearAutoSpinTimer();
    }

    function canAutoSpinStart() {
      const spinRuntime = getSpinRuntime();
      return spinRuntime ? spinRuntime.canAutoSpinStart() : false;
    }

    function scheduleAutoSpinTick(delay = autoSpinState.delayMs) {
      const spinRuntime = getSpinRuntime();
      if (spinRuntime) spinRuntime.scheduleAutoSpinTick(delay);
    }

    function bindControlEvents() {
      const runtimeBindings = getRuntimeBindings();
      if (runtimeBindings) runtimeBindings.bindControlEvents();
    }

    function setWinDetails(html = '') {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) feedbackUI.setWinDetails(html);
    }

    function clearHighlights(nextOptions = {}) {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) feedbackUI.clearHighlights(nextOptions);
    }

    function updateUI() {
      const sessionStats = getSessionStats();
      const feedbackUI = getFeedbackUI();
      const bonusMultiplier = getBonusMultiplier();
      const inFreeSpins = getInFreeSpins();
      const freeSpins = getFreeSpins();
      const bonusPickOpen = !!(feedbackUI && typeof feedbackUI.isBonusPickOpen === 'function' && feedbackUI.isBonusPickOpen());
      const featureState = getFeatureState();
      const stickyWildCount = Array.isArray(featureState.stickyWildColumns) ? featureState.stickyWildColumns.length : 0;
      if (balanceEl) balanceEl.textContent = formatAmount(getBalance());
      if (activeBetEl) activeBetEl.textContent = formatAmount(currentFeatureBet());
      if (modeEl) modeEl.textContent = bonusPickOpen ? 'Bonus' : (inFreeSpins ? 'Giri Gratis' : 'Base');
      if (fsEl) fsEl.textContent = String(freeSpins);
      if (bonusPickOpen) {
        setFeatureStateUI('bonus-pick', 'Bonus Neon Vault', joinFeatureMeta([
          freeSpins > 0 ? `${freeSpins} giri base` : null,
          'Scegli un caveau'
        ]));
      } else if (inFreeSpins) {
        setFeatureStateUI('free-spins', 'Giri Gratis Attivi', joinFeatureMeta([
          `${freeSpins} rimasti`,
          bonusMultiplier > 1 ? formatMultiplierLabel(bonusMultiplier) : null,
          stickyWildCount > 0 ? (stickyWildCount === 1 ? '1 sticky reel' : `${stickyWildCount} sticky reel`) : null
        ]));
      } else {
        setFeatureStateUI('base', 'Gioco Base', '25 linee attive');
      }
      if (betDisplayEl) betDisplayEl.textContent = formatAmount(getBetPerSpin());
      if (autoSpinButtonEl) autoSpinButtonEl.textContent = autoButtonLabel();
      if (autoStatusEl) autoStatusEl.textContent = autoStatusLabel();
      if (collectMeterEl) collectMeterEl.textContent = formatAmount(getLastCollectedWin());
      if (sessionHitRateEl) sessionHitRateEl.textContent = sessionStats.hitRateLabel || '0%';
      if (sessionBestWinEl) sessionBestWinEl.textContent = formatAmount(sessionStats.bestWin || 0);
      if (sessionStreakEl) sessionStreakEl.textContent = sessionStats.streakLabel || '-';
      if (!inFreeSpins) {
        getGridCells().forEach(function (cell) {
          if (!cell) return;
          cell.dataset.special = 'false';
          cell.dataset.sticky = 'false';
        });
      }
      syncControlLockState();
      syncCabinetLights();
      syncAmbientMood();
      persistCabinetState();
    }

    function showFloat(text, ttl = 900, options = {}) {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) feedbackUI.showFloat(text, ttl, options);
    }

    function showBigWin(text, ttl = 1600, options = {}) {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) feedbackUI.showBigWin(text, ttl, options);
    }

    function resetCoinTray(resetPile = true) {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) feedbackUI.resetCoinTray(resetPile);
    }

    function runCoinTrayDispense(win, stake = 1) {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) feedbackUI.runCoinTrayDispense(win, stake);
    }

    function spawnCoinParticles(x, y, count = 8, options = {}) {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) feedbackUI.spawnCoinParticles(x, y, count, options);
    }

    function getCellCenter(index, relativeToRect = null) {
      const feedbackUI = getFeedbackUI();
      return feedbackUI ? feedbackUI.getCellCenter(index, relativeToRect) : { x: 0, y: 0 };
    }

    async function drawPaylines(wins) {
      const feedbackUI = getFeedbackUI();
      if (feedbackUI) await feedbackUI.drawPaylines(wins);
    }

    function initializeRuntimeUI() {
      restoreCabinetState();
      syncCabinetLights();
      updateAmbientToggleUI();
      renderPaytable();
      setPaytableTab(defaultPaytableTab);
      setPaytableOpen(false);
      updateUI();
      bindControlEvents();
      bindViewportFitEvents();
      bindLifecycleEvents();
      scheduleViewportFit();
    }

    return {
      autoButtonLabel,
      autoStatusLabel,
      setCabinetNotice,
      renderPaylineMap,
      renderPaytable,
      setPaytableTab,
      setPaytableOpen,
      togglePaytable,
      animateLeverPull,
      paidSpinInsertDelay,
      stopAttractMode,
      syncCabinetLights,
      pulseCabinetWin,
      getViewportFitScale,
      applyViewportFit,
      scheduleViewportFit,
      bindViewportFitEvents,
      bindLifecycleEvents,
      isSpinControlLocked,
      syncControlLockState,
      clearAutoSpinTimer,
      canAutoSpinStart,
      scheduleAutoSpinTick,
      bindControlEvents,
      initializeRuntimeUI,
      setWinDetails,
      clearHighlights,
      updateUI,
      showFloat,
      showBigWin,
      resetCoinTray,
      runCoinTrayDispense,
      spawnCoinParticles,
      getCellCenter,
      drawPaylines
    };
  }

  return { DEFAULT_SPEED_PRESETS, createRuntimeBindingsController, createRuntimeUIController };
});
