(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }
  root.AppBootstrap = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function collectDomRefs(documentRef) {
    return {
      appEl: documentRef.querySelector('.app'),
      slot: documentRef.getElementById('slot'),
      balanceEl: documentRef.getElementById('balance'),
      activeBetEl: documentRef.getElementById('activeBet'),
      modeEl: documentRef.getElementById('mode'),
      fsEl: documentRef.getElementById('fs'),
      featureStateTitleEl: documentRef.getElementById('featureStateTitle'),
      featureStateMetaEl: documentRef.getElementById('featureStateMeta'),
      showPlaqueStateEl: documentRef.getElementById('showPlaqueState'),
      winDetailsEl: documentRef.getElementById('winDetails'),
      collectMeterEl: documentRef.getElementById('collectMeter'),
      coinPayoutZoneEl: documentRef.getElementById('coinPayoutZone'),
      payoutCoinEl: documentRef.getElementById('payoutCoin'),
      coinPileEl: documentRef.getElementById('coinPile'),
      sessionHitRateEl: documentRef.getElementById('sessionHitRate'),
      sessionBestWinEl: documentRef.getElementById('sessionBestWin'),
      sessionStreakEl: documentRef.getElementById('sessionStreak'),
      spinButtonControlEl: documentRef.getElementById('spin'),
      autoSpinButtonEl: documentRef.getElementById('autoSpin'),
      betDisplayEl: documentRef.getElementById('betDisplay'),
      autoStatusEl: documentRef.getElementById('autoStatus'),
      betMinusEl: documentRef.getElementById('betMinus'),
      betPlusEl: documentRef.getElementById('betPlus'),
      speedSlowEl: documentRef.getElementById('speedSlow'),
      speedNormalEl: documentRef.getElementById('speedNormal'),
      speedFastEl: documentRef.getElementById('speedFast'),
      autoPreset10El: documentRef.getElementById('autoPreset10'),
      autoPreset25El: documentRef.getElementById('autoPreset25'),
      autoPreset50El: documentRef.getElementById('autoPreset50'),
      autoPreset100El: documentRef.getElementById('autoPreset100'),
      spinLeverEl: documentRef.getElementById('spinLever'),
      ambientToggleEl: documentRef.getElementById('ambientToggle'),
      audioToggleEl: documentRef.getElementById('sfxToggle'),
      togglePaytableEl: documentRef.getElementById('togglePaytable'),
      closePaytableEl: documentRef.getElementById('closePaytable'),
      paytablePanelEl: documentRef.getElementById('paytablePanel'),
      paytableBackdropEl: documentRef.getElementById('paytableBackdrop'),
      paytableBodyEl: documentRef.getElementById('paytableBody'),
      scatterPaytableEl: documentRef.getElementById('scatterPaytable'),
      paylineMapEl: documentRef.getElementById('paylineMap'),
      paytableTabEls: Array.from(documentRef.querySelectorAll('.paytable-tab')),
      paytableViewEls: Array.from(documentRef.querySelectorAll('.paytable-view')),
      cabinetNoticeEl: documentRef.getElementById('cabinetNotice')
    };
  }

  function createAppControllers(options = {}) {
    const modules = options.modules || {};
    const refs = options.refs || {};
    const state = options.state || {};
    const constants = options.constants || {};
    const helpers = options.helpers || {};
    const env = options.env || {};
    const bundle = {};
    const windowRef = env.windowRef || root;
    const documentRef = env.documentRef || (typeof document !== 'undefined' ? document : null);
    const performanceRef = env.performanceRef || root.performance;
    const requestAnimationFrameRef = env.requestAnimationFrameRef || root.requestAnimationFrame;
    const getComputedStyleRef = env.getComputedStyleRef || root.getComputedStyle;
    const setTimeoutRef = env.setTimeoutRef || windowRef.setTimeout.bind(windowRef);
    const clearTimeoutRef = env.clearTimeoutRef || windowRef.clearTimeout.bind(windowRef);
    const ImageCtor = env.ImageCtor || root.Image || null;

    function startAutoSpin(count) {
      return bundle.spinRuntime ? bundle.spinRuntime.startAutoSpin(count) : false;
    }

    function toggleAutoSpin() {
      if (bundle.spinRuntime) bundle.spinRuntime.toggleAutoSpin();
    }

    async function spin(options = {}) {
      return bundle.spinRuntime ? bundle.spinRuntime.spin(options) : false;
    }

    function syncCellSymbol(cell, sym, syncOptions = {}) {
      if (bundle.slotRenderer) bundle.slotRenderer.syncCellSymbol(cell, sym, syncOptions);
    }

    function resetSpinGhostStyles(cell) {
      if (bundle.slotRenderer) bundle.slotRenderer.resetSpinGhostStyles(cell);
    }

    function syncGhostFromFace(cell) {
      if (bundle.slotRenderer) bundle.slotRenderer.syncGhostFromFace(cell);
    }

    function buildReelsFinal() {
      return bundle.slotRenderer ? bundle.slotRenderer.buildReelsFinal() : { final: [], starts: [] };
    }

    function pickFreeSpinSymbol() {
      return bundle.slotRenderer ? bundle.slotRenderer.pickFreeSpinSymbol() : null;
    }

    function isAmbientEnabled() {
      return bundle.audioController ? bundle.audioController.isAmbientEnabled() : false;
    }

    function setAmbientEnabled(enabled, notify) {
      if (bundle.audioController) bundle.audioController.setAmbientEnabled(enabled, notify);
    }

    function startAmbientSound() {
      if (bundle.audioController) bundle.audioController.startAmbientSound();
    }

    function stopAmbientSound(fadeMs) {
      if (bundle.audioController) bundle.audioController.stopAmbientSound(fadeMs);
    }

    function updateAmbientToggleUI() {
      if (bundle.audioController) bundle.audioController.updateAmbientToggleUI();
    }

    function syncAmbientMood() {
      if (bundle.audioController) bundle.audioController.syncAmbientMood();
    }

    function playCoinSound() {
      if (bundle.audioController) bundle.audioController.playCoinSound();
    }

    function playCoinInsertSound() {
      if (bundle.audioController) bundle.audioController.playCoinInsertSound();
    }

    function playSpinButtonSound() {
      if (bundle.audioController) bundle.audioController.playSpinButtonSound();
    }

    function playLeverSound() {
      if (bundle.audioController) bundle.audioController.playLeverSound();
    }

    function playReelStartSound(reel, intensity) {
      if (bundle.audioController) bundle.audioController.playReelStartSound(reel, intensity);
    }

    function playReelStopSound(reel, isLast) {
      if (bundle.audioController) bundle.audioController.playReelStopSound(reel, isLast);
    }

    function playSmallWinSound() {
      if (bundle.audioController) bundle.audioController.playSmallWinSound();
    }

    function playBigWinSound() {
      if (bundle.audioController) bundle.audioController.playBigWinSound();
    }

    function playClick(freq, dur, vol) {
      if (bundle.audioController) bundle.audioController.playClick(freq, dur, vol);
    }

    bundle.audioController = modules.SlotAudio.createSlotAudioController({
      ambientToggleEl: refs.ambientToggleEl,
      getInFreeSpins: state.getInFreeSpins,
      showFloat: function (text, ttl) {
        if (bundle.runtimeUI) bundle.runtimeUI.showFloat(text, ttl);
      }
    });
    bundle.audioController.bindFirstGestureBootstrap();

    // Restore SFX toggle state from localStorage and bind sfx toggle UI
    const sfxKey = 'crashhouse_sfx';
    const legacySfxKey = ['cra', 'ckhouse_sfx'].join('');
    const storage = (windowRef && windowRef.localStorage) ? windowRef.localStorage : null;
    try {
      const sfxStored = storage ? (storage.getItem(sfxKey) || storage.getItem(legacySfxKey)) : null;
      if (sfxStored !== null && typeof bundle.audioController.setSpinSfxEnabled === 'function') {
        bundle.audioController.setSpinSfxEnabled(sfxStored === '1');
      }
    } catch (e) {}
    if (refs.audioToggleEl) {
      const updateSfxUI = function () {
        const on = (typeof bundle.audioController.isSpinSfxEnabled === 'function') ? bundle.audioController.isSpinSfxEnabled() : true;
        refs.audioToggleEl.setAttribute('aria-pressed', on ? 'true' : 'false');
        refs.audioToggleEl.textContent = on ? 'Suoni' : 'Suoni Off';
      };
      refs.audioToggleEl.addEventListener('click', function () {
        const newState = !(typeof bundle.audioController.isSpinSfxEnabled === 'function' ? bundle.audioController.isSpinSfxEnabled() : true);
        if (typeof bundle.audioController.setSpinSfxEnabled === 'function') bundle.audioController.setSpinSfxEnabled(newState);
        try {
          if (storage) {
            storage.setItem(sfxKey, newState ? '1' : '0');
            storage.removeItem(legacySfxKey);
          }
        } catch (e) {}
        updateSfxUI();
        if (bundle.runtimeUI && typeof bundle.runtimeUI.showFloat === 'function') bundle.runtimeUI.showFloat('Suoni: ' + (newState ? 'attivo' : 'spento'), 900);
      }, { passive: true });
      // initial UI reflect
      updateSfxUI();
    }

    bundle.viewportFit = modules.ViewportFit.createViewportFitController({
      appEl: refs.appEl,
      windowRef,
      documentRef
    });

    bundle.paytableUI = modules.CabinetUI.createPaytableController({
      appEl: refs.appEl,
      panelEl: refs.paytablePanelEl,
      backdropEl: refs.paytableBackdropEl,
      toggleEl: refs.togglePaytableEl,
      closeEl: refs.closePaytableEl,
      bodyEl: refs.paytableBodyEl,
      scatterEl: refs.scatterPaytableEl,
      mapEl: refs.paylineMapEl,
      tabEls: refs.paytableTabEls,
      viewEls: refs.paytableViewEls,
      rows: constants.ROWS,
      cols: constants.COLS,
      total: constants.TOTAL,
      symbols: constants.SYMBOLS,
      scatter: constants.SCATTER,
      paytable: constants.PAYTABLE,
      scatterPayout: constants.SCATTER_PAYOUT,
      baseFreeSpins: constants.BASE_FREE_SPINS,
      scatterTriggerCount: constants.SCATTER_TRIGGER_COUNT,
      retriggerScatterCount: constants.RETRIGGER_SCATTER_COUNT,
      bonusRevealCount: constants.BONUS_PICK_REVEAL_COUNT,
      bonusBasePackage: constants.BONUS_PICK_BASE_PACKAGE,
      defaultTab: constants.DEFAULT_PAYTABLE_TAB,
      animationMs: constants.PAYTABLE_TAB_ANIMATION_MS,
      getPaylines: helpers.getPaylines,
      paylineColorForIndex: helpers.paylineColorForIndex,
      symbolLabel: helpers.symbolLabel,
      formatSymbolCardValue: helpers.formatSymbolCardValue,
      symbolValueAccent: helpers.symbolValueAccent,
      symbolTierLabel: helpers.symbolTierLabel,
      scheduleLayout: function () {
        return bundle.viewportFit ? bundle.viewportFit.schedule() : undefined;
      }
    });

    bundle.runtimeUI = modules.RuntimeUI.createRuntimeUIController({
      windowRef,
      setTimeoutRef,
      clearTimeoutRef,
      autoSpinState: state.autoSpinState,
      defaultPaytableTab: constants.DEFAULT_PAYTABLE_TAB,
      appEl: refs.appEl,
      balanceEl: refs.balanceEl,
      activeBetEl: refs.activeBetEl,
      modeEl: refs.modeEl,
      fsEl: refs.fsEl,
      featureStateTitleEl: refs.featureStateTitleEl,
      featureStateMetaEl: refs.featureStateMetaEl,
      showPlaqueStateEl: refs.showPlaqueStateEl,
      betDisplayEl: refs.betDisplayEl,
      autoSpinButtonEl: refs.autoSpinButtonEl,
      autoStatusEl: refs.autoStatusEl,
      collectMeterEl: refs.collectMeterEl,
      sessionHitRateEl: refs.sessionHitRateEl,
      sessionBestWinEl: refs.sessionBestWinEl,
      sessionStreakEl: refs.sessionStreakEl,
      spinLeverEl: refs.spinLeverEl,
      getBalance: state.getBalance,
      currentFeatureBet: helpers.currentFeatureBet,
      getInFreeSpins: state.getInFreeSpins,
      getFreeSpins: state.getFreeSpins,
      getFeatureState: state.getFeatureState,
      getBonusMultiplier: state.getBonusMultiplier,
      getBetPerSpin: state.getBetPerSpin,
      getLastCollectedWin: state.getLastCollectedWin,
      getSessionStats: state.getSessionStats,
      getGridCells: function () {
        return bundle.slotRenderer ? bundle.slotRenderer.getCells() : [];
      },
      restoreCabinetState: helpers.restoreCabinetState,
      persistCabinetState: helpers.persistCabinetState,
      updateAmbientToggleUI,
      syncAmbientMood,
      playLeverSound,
      formatAmount: helpers.formatAmount,
      getPaytableUI: function () {
        return bundle.paytableUI;
      },
      getFeedbackUI: function () {
        return bundle.feedbackUI;
      },
      getViewportFit: function () {
        return bundle.viewportFit;
      },
      getRuntimeBindings: function () {
        return bundle.runtimeBindings;
      },
      getSpinRuntime: function () {
        return bundle.spinRuntime;
      }
    });

    bundle.runtimeBindings = modules.RuntimeUI.createRuntimeBindingsController({
      documentRef,
      windowRef,
      paytableUI: bundle.paytableUI,
      autoSpinState: state.autoSpinState,
      getTimings: state.getTimings,
      showFloat: bundle.runtimeUI.showFloat,
      setAmbientEnabled,
      isAmbientEnabled,
      startAutoSpin,
      toggleAutoSpin,
      spin,
      isSpinControlLocked: bundle.runtimeUI.isSpinControlLocked,
      increaseBet: function () {
        helpers.increaseBet();
        bundle.runtimeUI.updateUI();
      },
      decreaseBet: function () {
        helpers.decreaseBet();
        bundle.runtimeUI.updateUI();
      },
      persistCabinetState: helpers.persistCabinetState,
      stopAttractMode: bundle.runtimeUI.stopAttractMode,
      stopAmbientSound,
      startAmbientSound,
      syncCabinetLights: bundle.runtimeUI.syncCabinetLights,
      syncAmbientMood,
      setPaytableOpen: bundle.runtimeUI.setPaytableOpen,
      speedSlowEl: refs.speedSlowEl,
      speedNormalEl: refs.speedNormalEl,
      speedFastEl: refs.speedFastEl,
      ambientToggleEl: refs.ambientToggleEl,
      autoPreset10El: refs.autoPreset10El,
      autoPreset25El: refs.autoPreset25El,
      autoPreset50El: refs.autoPreset50El,
      autoPreset100El: refs.autoPreset100El,
      spinButtonControlEl: refs.spinButtonControlEl,
      autoSpinButtonEl: refs.autoSpinButtonEl,
      betPlusEl: refs.betPlusEl,
      betMinusEl: refs.betMinusEl,
      spinLeverEl: refs.spinLeverEl
    });

    bundle.slotRenderer = modules.SlotRenderer.createSlotRendererController({
      documentRef,
      slotEl: refs.slot,
      total: constants.TOTAL,
      rows: constants.ROWS,
      cols: constants.COLS,
      symbols: constants.SYMBOLS,
      scatter: constants.SCATTER,
      symbolWeights: constants.SYMBOL_WEIGHTS,
      scatterWeight: constants.SCATTER_WEIGHT,
      symbolLabel: helpers.symbolLabel,
      decorateCellTheme: helpers.updateCellTheme,
      cloneSymbol: helpers.cloneSymbolCore,
      buildWeightedSymbols: helpers.buildWeightedSymbolsCore,
      initReelStrips: helpers.initReelStripsCore,
      buildReelsFinal: helpers.buildReelsFinalCore,
      pickFreeSpinSymbol: helpers.pickFreeSpinSymbolCore,
      rng: helpers.rng,
      stripLength: constants.REEL_STRIP_LEN,
      reelStripSteps: constants.REEL_STRIP_STEPS,
      reelStripOffsets: constants.REEL_STRIP_OFFSETS,
      getAnteOn: state.getAnteOn,
      anteScatterBoost: constants.ANTE_SCATTER_BOOST,
      preloadUrls: constants.preloadUrls,
      ImageCtor,
      getComputedStyleRef,
      setTimeoutRef
    });

    bundle.feedbackUI = modules.CabinetUI.createFeedbackUIController({
      windowRef,
      documentRef,
      appEl: refs.appEl,
      featureStateTitleEl: refs.featureStateTitleEl,
      featureStateMetaEl: refs.featureStateMetaEl,
      showPlaqueStateEl: refs.showPlaqueStateEl,
      cabinetNoticeEl: refs.cabinetNoticeEl,
      winDetailsEl: refs.winDetailsEl,
      coinPayoutZoneEl: refs.coinPayoutZoneEl,
      payoutCoinEl: refs.payoutCoinEl,
      coinPileEl: refs.coinPileEl,
      coinFrames: constants.COIN_FRAMES,
      scheduleLayout: function () {
        return bundle.viewportFit ? bundle.viewportFit.schedule() : undefined;
      },
      getGridCells: function () {
        return bundle.slotRenderer ? bundle.slotRenderer.getCells() : [];
      },
      getInFreeSpins: state.getInFreeSpins,
      getSpinInProgress: function () {
        return bundle.spinRuntime ? bundle.spinRuntime.isSpinInProgress() : false;
      },
      paylineColorForIndex: helpers.paylineColorForIndex,
      playCoinSound,
      playClick,
      rng: helpers.rng,
      bonusRevealCount: constants.BONUS_PICK_REVEAL_COUNT,
      bonusBasePackage: constants.BONUS_PICK_BASE_PACKAGE,
      bonusPackages: constants.BONUS_PICK_OPTIONS,
      buildBonusPickDeck: helpers.buildBonusPickDeckCore,
      pickBonusPackage: helpers.pickBonusPackageCore,
      composeBonusPackage: helpers.composeBonusPackageCore,
      symbolLabel: helpers.symbolLabel,
      formatAmount: helpers.formatAmount,
      getImageElByIndex: function (index) {
        return documentRef.getElementById(`img-${index}`);
      },
      getPaylineOverlayEl: function () {
        return documentRef.getElementById('payline-overlay');
      }
    });

    bundle.spinRuntime = modules.SpinRuntime.createSpinRuntimeController({
      windowRef,
      documentRef,
      performanceRef,
      getComputedStyleRef,
      requestAnimationFrameRef,
      setTimeoutRef,
      clearTimeoutRef,
      autoSpinState: state.autoSpinState,
      timings: state.timings,
      rows: constants.ROWS,
      cols: constants.COLS,
      symbols: constants.SYMBOLS,
      fallbackSymbol: constants.SYMBOLS[0] || constants.fallbackSymbol,
      getGridCells: function () {
        return bundle.slotRenderer ? bundle.slotRenderer.getCells() : [];
      },
      getGridGhosts: function () {
        return bundle.slotRenderer ? bundle.slotRenderer.getGhosts() : [];
      },
      getSymbolFaces: function () {
        return bundle.slotRenderer ? bundle.slotRenderer.getFaces() : [];
      },
      getReelStrips: function () {
        return bundle.slotRenderer ? bundle.slotRenderer.getReelStrips() : null;
      },
      syncCellSymbol,
      resetSpinGhostStyles,
      syncGhostFromFace,
      buildReelsFinal,
      evaluateSpin: helpers.evaluateSpin,
      advanceFeatureState: helpers.advanceFeatureStateCore,
      getSpinContext: helpers.getSpinContextCore,
      pickFreeSpinSymbol,
      getFeatureState: state.getFeatureState,
      setFeatureState: state.setFeatureState,
      getCurrentSpinCost: helpers.getCurrentSpinCost,
      getBalance: state.getBalance,
      setBalance: state.setBalance,
      getBetPerSpin: state.getBetPerSpin,
      getInFreeSpins: state.getInFreeSpins,
      getBonusMultiplier: state.getBonusMultiplier,
      getFreeSpinSymbol: state.getFreeSpinSymbol,
      setLastCollectedWin: state.setLastCollectedWin,
      recordSessionSpinResult: state.recordSessionSpinResult,
      baseFreeSpins: constants.BASE_FREE_SPINS,
      scatterTriggerCount: constants.SCATTER_TRIGGER_COUNT,
      retriggerScatterCount: constants.RETRIGGER_SCATTER_COUNT,
      maxFreeSpins: constants.MAX_FREE_SPINS,
      minBet: constants.MIN_BET,
      maxBet: constants.MAX_BET,
      formatAmount: helpers.formatAmount,
      symbolLabel: helpers.symbolLabel,
      setCabinetNotice: bundle.runtimeUI.setCabinetNotice,
      clearHighlights: bundle.runtimeUI.clearHighlights,
      resetCoinTray: bundle.runtimeUI.resetCoinTray,
      syncCabinetLights: bundle.runtimeUI.syncCabinetLights,
      animateLeverPull: bundle.runtimeUI.animateLeverPull,
      playSpinButtonSound,
      playCoinInsertSound,
      updateUI: bundle.runtimeUI.updateUI,
      renderResultHighlights: function (payload) {
        if (bundle.feedbackUI) bundle.feedbackUI.renderResultHighlights(payload);
      },
      setWinDetails: bundle.runtimeUI.setWinDetails,
      showFloat: bundle.runtimeUI.showFloat,
      markWinningCells: function (wins) {
        return bundle.feedbackUI ? bundle.feedbackUI.markWinningCells(wins) : null;
      },
      resolveBonusPick: function (payload) {
        return bundle.feedbackUI ? bundle.feedbackUI.resolveBonusPick(payload) : null;
      },
      applyResultMultiplier: helpers.applyResultMultiplierCore,
      playBigWinSound,
      playSmallWinSound,
      getCellCenter: bundle.runtimeUI.getCellCenter,
      spawnCoinParticles: bundle.runtimeUI.spawnCoinParticles,
      showBigWin: bundle.runtimeUI.showBigWin,
      runCoinTrayDispense: bundle.runtimeUI.runCoinTrayDispense,
      pulseCabinetWin: bundle.runtimeUI.pulseCabinetWin,
      playReelStartSound,
      playClick,
      playReelStopSound,
      paidSpinInsertDelay: bundle.runtimeUI.paidSpinInsertDelay,
      spinButtonControlEl: refs.spinButtonControlEl,
      betMinusEl: refs.betMinusEl,
      betPlusEl: refs.betPlusEl,
      autoSpinButtonEl: refs.autoSpinButtonEl,
      autoPresetEls: [refs.autoPreset10El, refs.autoPreset25El, refs.autoPreset50El, refs.autoPreset100El]
    });

    bundle.initialize = function () {
      if (bundle.slotRenderer) {
        if (typeof bundle.slotRenderer.buildGrid === 'function') bundle.slotRenderer.buildGrid();
        if (typeof bundle.slotRenderer.preloadImages === 'function') bundle.slotRenderer.preloadImages();
        if (typeof bundle.slotRenderer.initReelStrips === 'function') bundle.slotRenderer.initReelStrips();
      }
      if (bundle.runtimeUI && typeof bundle.runtimeUI.initializeRuntimeUI === 'function') {
        bundle.runtimeUI.initializeRuntimeUI();
      }
      return bundle;
    };

    return bundle;
  }

  return {
    collectDomRefs,
    createAppControllers
  };
});
