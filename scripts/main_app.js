/**
 * @fileoverview MainApp - Main application orchestrator and dependency injection container
 * 
 * This module is responsible for:
 * - Resolving and injecting all application dependencies
 * - Creating and configuring the runtime environment
 * - Bootstrapping all controllers and UI modules
 * - Managing the application lifecycle
 * 
 * It acts as the central wiring point that connects all game modules together
 * (SlotCore, UI controllers, audio, rendering, runtime session, etc.)
 * 
 * @module MainApp
 * @author CRACKHOUSE Slot Machine
 * @version 1.0.0
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }
  root.MainApp = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  /**
   * Names of all application modules that must be loaded
   * @const {string[]}
   */
  const APP_MODULE_NAMES = [
    'CabinetUI',
    'SlotAudio',
    'ViewportFit',
    'SlotRenderer',
    'SpinRuntime',
    'AppBootstrap',
    'SlotCore',
    'GameConfig',
    'RuntimeUI',
    'RuntimeSession',
    'SeededRng'
  ];

  /**
   * Names of controller modules that interact with the UI
   * @const {string[]}
   */
  const CONTROLLER_MODULE_NAMES = [
    'SlotAudio',
    'ViewportFit',
    'CabinetUI',
    'RuntimeUI',
    'SlotRenderer',
    'SpinRuntime'
  ];

  /**
   * Default state for auto-spin functionality
   * @const {Object}
   * @property {boolean} enabled - Whether auto-spin is active
   * @property {number} remaining - Number of auto-spins remaining
   * @property {number} delayMs - Delay between auto-spins in milliseconds
   * @property {number} timeoutId - Timeout ID for the next auto-spin
   */
  const DEFAULT_AUTO_SPIN_STATE = { enabled: false, remaining: 0, delayMs: 700, timeoutId: 0 };

  /**
   * Resolves all required application dependencies from the global scope
   * @param {Object} [options={}] - Configuration options
   * @param {Object} [options.dependencies] - Pre-resolved dependencies (used for testing)
   * @param {Object} [options.globalRoot] - Global object to resolve from (defaults to window/global)
   * @returns {Object} Object containing all resolved module dependencies
   * @throws {Error} If any required module is missing
   */
  function resolveAppDependencies(options = {}) {
    if (options.dependencies) return options.dependencies;
    const globalRoot = options.globalRoot || root;
    return APP_MODULE_NAMES.reduce(function (resolved, name) {
      const value = globalRoot[name];
      if (!value) throw new Error(name + ' module missing');
      resolved[name] = value;
      return resolved;
    }, {});
  }

  /**
   * Safely accesses localStorage from the window reference
   * @param {Window} windowRef - Window object
   * @returns {Storage|null} localStorage object or null if unavailable
   */
  function getCabinetStorage(windowRef) {
    if (!windowRef) return null;
    try {
      return windowRef.localStorage;
    } catch (error) {
      return null;
    }
  }

  /**
   * Binds a method from the window object to preserve its context
   * @param {Window} windowRef - Window object
   * @param {string} name - Name of the method to bind
   * @returns {Function|null} Bound method or null if unavailable
   */
  function bindWindowMethod(windowRef, name) {
    if (!windowRef || typeof windowRef[name] !== 'function') return null;
    return windowRef[name].bind(windowRef);
  }

  /**
   * Creates the main application context with all environment references and configuration
   * This includes DOM references, game config, browser APIs, and storage
   * @param {Object} [options={}] - Configuration options
   * @param {Function} options.createGameConfig - Factory for game configuration
   * @param {Function} options.collectDomRefs - Factory to collect DOM references
   * @returns {{gameConfig: Object, refs: Object, autoSpinState: Object, cabinetStorage: Storage|null, env: Object}} Application context
   * @throws {Error} If required factory functions are missing
   */
  function createMainAppContext(options = {}) {
    const createGameConfig = options.createGameConfig;
    const collectDomRefs = options.collectDomRefs;
    if (typeof createGameConfig !== 'function') throw new Error('createGameConfig is required');
    if (typeof collectDomRefs !== 'function') throw new Error('collectDomRefs is required');

    const slotCore = options.slotCore || {};
    const globalRoot = options.globalRoot || root;
    const windowRef = options.windowRef || globalRoot;
    const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
    const performanceRef = options.performanceRef || globalRoot.performance || null;
    const requestAnimationFrameRef = options.requestAnimationFrameRef || globalRoot.requestAnimationFrame || null;
    const getComputedStyleRef = options.getComputedStyleRef || globalRoot.getComputedStyle || null;
    const setTimeoutRef = options.setTimeoutRef || bindWindowMethod(windowRef, 'setTimeout') || bindWindowMethod(globalRoot, 'setTimeout');
    const clearTimeoutRef = options.clearTimeoutRef || bindWindowMethod(windowRef, 'clearTimeout') || bindWindowMethod(globalRoot, 'clearTimeout');
    const setIntervalRef = options.setIntervalRef || bindWindowMethod(windowRef, 'setInterval') || bindWindowMethod(globalRoot, 'setInterval');
    const clearIntervalRef = options.clearIntervalRef || bindWindowMethod(windowRef, 'clearInterval') || bindWindowMethod(globalRoot, 'clearInterval');
    const {
      PORTRAIT_SYMBOL_COUNT,
      SYMBOLS: CORE_SYMBOLS,
      SCATTER: CORE_SCATTER,
      cloneSymbol: cloneSymbolCore
    } = slotCore;

    const gameConfig = createGameConfig({
      imgPrefix: options.imgPrefix || 'img/',
      locationPath: options.locationPath || ((windowRef.location && windowRef.location.pathname) || 'index'),
      coreSymbols: CORE_SYMBOLS,
      coreScatter: CORE_SCATTER,
      basePaytable: slotCore.PAYTABLE || {},
      baseScatterPayout: slotCore.SCATTER_PAYOUT || {},
      scalePaytable: slotCore.scalePaytable,
      cloneSymbol: cloneSymbolCore,
      portraitSymbolCount: PORTRAIT_SYMBOL_COUNT
    });
    const refs = options.refs || collectDomRefs(documentRef);
    const autoSpinState = { ...DEFAULT_AUTO_SPIN_STATE, ...(options.autoSpinState || {}) };
    const cabinetStorage = options.storage !== undefined
      ? options.storage
      : getCabinetStorage(windowRef);

    return {
      gameConfig,
      refs,
      autoSpinState,
      cabinetStorage,
      env: {
        windowRef,
        documentRef,
        performanceRef,
        requestAnimationFrameRef,
        getComputedStyleRef,
        setTimeoutRef,
        clearTimeoutRef,
        setIntervalRef,
        clearIntervalRef,
        cryptoRef: options.cryptoRef || (windowRef && windowRef.crypto) || null,
        ImageCtor: options.ImageCtor || (windowRef && windowRef.Image) || null
      }
    };
  }

  /**
   * Creates all runtime services including session management, RNG, and game logic bridge
   * @param {Object} [options={}] - Configuration options
   * @param {Function} options.createCabinetStateManager - Factory for state manager
   * @param {Function} options.createRuntimeSession - Factory for runtime session
   * @param {Function} options.createRuntimeBridge - Factory for runtime bridge
   * @param {Function} options.createSeededRngController - Factory for RNG controller
   * @returns {{runtimeSession: Object, runtimeBridge: Object, session: Object, rngController: Object}} Runtime services
   * @throws {Error} If required factory functions are missing
   */
  function createRuntimeServices(options = {}) {
    const createCabinetStateManager = options.createCabinetStateManager;
    const createRuntimeSession = options.createRuntimeSession;
    const createRuntimeBridge = options.createRuntimeBridge;
    const createSeededRngController = options.createSeededRngController;

    if (typeof createCabinetStateManager !== 'function') throw new Error('createCabinetStateManager is required');
    if (typeof createRuntimeSession !== 'function') throw new Error('createRuntimeSession is required');
    if (typeof createRuntimeBridge !== 'function') throw new Error('createRuntimeBridge is required');
    if (typeof createSeededRngController !== 'function') throw new Error('createSeededRngController is required');

    const slotCore = options.slotCore || {};
    const gameConfig = options.gameConfig || {};
    const windowRef = options.windowRef || root;

    const {
      ROWS,
      COLS,
      MAX_FREE_SPINS,
      cloneSymbol: cloneSymbolCore,
      evaluateReels: evaluateReelsCore,
      getSpinContext: getSpinContextCore
    } = slotCore;
    const {
      anteMultiplier: ANTE_MULT,
      betStep: BET_STEP,
      minBet: MIN_BET,
      maxBet: MAX_BET,
      initialBalance: INITIAL_BALANCE,
      initialBetPerSpin: INITIAL_BET_PER_SPIN,
      cabinetStateKey: CABINET_STATE_KEY,
      paytable: PAYTABLE = slotCore.PAYTABLE,
      scatterPayout: SCATTER_PAYOUT = slotCore.SCATTER_PAYOUT,
      symbols: SYMBOLS,
      scatter: SCATTER
    } = gameConfig;

    const runtimeSession = createRuntimeSession({
      createCabinetStateManager,
      storage: options.storage || null,
      storageKey: CABINET_STATE_KEY,
      minBet: MIN_BET,
      maxBet: MAX_BET,
      betStep: BET_STEP,
      maxFreeSpins: MAX_FREE_SPINS,
      anteMultiplier: ANTE_MULT,
      initialBalance: INITIAL_BALANCE,
      initialBetPerSpin: INITIAL_BET_PER_SPIN,
      symbols: SYMBOLS,
      scatter: SCATTER,
      cloneSymbol: cloneSymbolCore,
      getSpinContext: getSpinContextCore
    });
    const rngController = createSeededRngController({
      windowRef,
      cryptoRef: options.cryptoRef || (windowRef && windowRef.crypto) || null,
      setIntervalRef: options.setIntervalRef || null,
      clearIntervalRef: options.clearIntervalRef || null
    });
    const runtimeBridge = createRuntimeBridge({
      runtimeSession,
      rngController,
      evaluateReels: evaluateReelsCore,
      paytable: PAYTABLE,
      scatterPayout: SCATTER_PAYOUT,
      symbols: SYMBOLS,
      scatter: SCATTER,
      rows: ROWS,
      cols: COLS
    });

    return {
      runtimeSession,
      runtimeBridge,
      session: runtimeBridge.session,
      rngController
    };
  }

  /**
   * Selects only the controller modules from the full dependencies object
   * @param {Object} [dependencies={}] - All dependencies
   * @returns {Object} Object containing only controller modules
   */
  function pickControllerModules(dependencies = {}) {
    return CONTROLLER_MODULE_NAMES.reduce(function (selected, name) {
      selected[name] = dependencies[name];
      return selected;
    }, {});
  }

  /**
   * Builds the complete options object needed to initialize all app controllers
   * Aggregates modules, refs, state, constants, helpers, and environment
   * @param {Object} [options={}] - Configuration options
   * @param {Object} options.modules - Controller modules
   * @param {Object} options.refs - DOM references
   * @param {Object} options.session - Runtime session
   * @param {Object} options.runtimeBridge - Runtime bridge
   * @param {Object} options.slotCore - SlotCore module
   * @param {Object} options.gameConfig - Game configuration
   * @param {Object} options.autoSpinState - Auto-spin state
   * @param {Object} options.env - Environment references
   * @returns {Object} Complete controller options
   * @throws {Error} If session is missing
   */
  function buildAppControllerOptions(options = {}) {
    const controllerModules = options.modules || {};
    const refs = options.refs || {};
    const session = options.session;
    const runtimeBridge = options.runtimeBridge || {};
    const slotCore = options.slotCore || {};
    const gameConfig = options.gameConfig || {};
    const autoSpinState = options.autoSpinState || {};
    const env = options.env || {};

    if (!session) throw new Error('session is required');

    const {
      ROWS,
      COLS,
      TOTAL,
      BASE_FREE_SPINS,
      MAX_FREE_SPINS,
      SCATTER_TRIGGER_COUNT,
      RETRIGGER_SCATTER_COUNT,
      REEL_STRIP_LEN,
      SCATTER_WEIGHT,
      REEL_STRIP_STEPS,
      REEL_STRIP_OFFSETS,
      SYMBOL_WEIGHTS,
      BONUS_PICK_REVEAL_COUNT,
      BONUS_PICK_BASE_PACKAGE,
      BONUS_PICK_OPTIONS,
      PAYTABLE: BASE_PAYTABLE,
      SCATTER_PAYOUT: BASE_SCATTER_PAYOUT,
      cloneSymbol: cloneSymbolCore,
      buildWeightedSymbols: buildWeightedSymbolsCore,
      initReelStrips: initReelStripsCore,
      buildReelsFinal: buildReelsFinalCore,
      pickFreeSpinSymbol: pickFreeSpinSymbolCore,
      buildBonusPickDeck: buildBonusPickDeckCore,
      pickBonusPackage: pickBonusPackageCore,
      composeBonusPackage: composeBonusPackageCore,
      getSpinContext: getSpinContextCore,
      advanceFeatureState: advanceFeatureStateCore,
      applyResultMultiplier: applyResultMultiplierCore,
      getPaylines
    } = slotCore;
    const {
      anteScatterBoost: ANTE_SCATTER_BOOST,
      defaultPaytableTab: DEFAULT_PAYTABLE_TAB,
      paytableTabAnimationMs: PAYTABLE_TAB_ANIMATION_MS,
      minBet: MIN_BET,
      maxBet: MAX_BET,
      coinFrames: COIN_FRAMES,
      symbols: SYMBOLS,
      scatter: SCATTER,
      paytable: PAYTABLE = BASE_PAYTABLE,
      scatterPayout: SCATTER_PAYOUT = BASE_SCATTER_PAYOUT,
      preloadUrls,
      paylineColorForIndex
    } = gameConfig;
    const {
      getFeatureState,
      setFeatureState,
      persistCabinetState,
      restoreCabinetState,
      rng,
      symbolLabel,
      formatAmount,
      formatSymbolCardValue,
      symbolValueAccent,
      symbolTierLabel,
      currentFeatureBet,
      updateCellTheme,
      getCurrentSpinCost,
      evaluateSpin
    } = runtimeBridge;

    return {
      modules: controllerModules,
      refs: { ...refs },
      state: {
        autoSpinState,
        timings: gameConfig.timings,
        getTimings: function () { return gameConfig.timings; },
        getAnteOn: function () { return session.getAnteOn(); },
        getInFreeSpins: function () { return session.getInFreeSpins(); },
        getFeatureState,
        setFeatureState,
        getBalance: function () { return session.getBalance(); },
        setBalance: function (value) { session.setBalance(value); },
        getBetPerSpin: function () { return session.getBetPerSpin(); },
        getFreeSpins: function () { return session.getFreeSpins(); },
        getFreeSpinSymbol: function () { return session.getFreeSpinSymbol(); },
        getBonusMultiplier: function () { return session.getBonusMultiplier(); },
        getLastCollectedWin: function () { return session.getLastCollectedWin(); },
        setLastCollectedWin: function (value) { session.setLastCollectedWin(value); },
        getSessionStats: function () { return session.getSessionStats(); },
        recordSessionSpinResult: function (result) { return session.recordSessionSpinResult(result); }
      },
      constants: {
        ROWS,
        COLS,
        TOTAL,
        BASE_FREE_SPINS,
        MAX_FREE_SPINS,
        SCATTER_TRIGGER_COUNT,
        RETRIGGER_SCATTER_COUNT,
        REEL_STRIP_LEN,
        SCATTER_WEIGHT,
        REEL_STRIP_STEPS,
        REEL_STRIP_OFFSETS,
        SYMBOL_WEIGHTS,
        BONUS_PICK_REVEAL_COUNT,
        BONUS_PICK_BASE_PACKAGE,
        BONUS_PICK_OPTIONS,
        SYMBOLS,
        SCATTER,
        PAYTABLE,
        SCATTER_PAYOUT,
        DEFAULT_PAYTABLE_TAB,
        PAYTABLE_TAB_ANIMATION_MS,
        MIN_BET,
        MAX_BET,
        ANTE_SCATTER_BOOST,
        COIN_FRAMES,
        preloadUrls
      },
      helpers: {
        increaseBet: function () { session.increaseBet(); },
        decreaseBet: function () { session.decreaseBet(); },
        currentFeatureBet,
        restoreCabinetState,
        persistCabinetState,
        getPaylines,
        paylineColorForIndex,
        symbolLabel,
        formatSymbolCardValue,
        symbolValueAccent,
        symbolTierLabel,
        updateCellTheme,
        cloneSymbolCore,
        buildWeightedSymbolsCore,
        initReelStripsCore,
        buildReelsFinalCore,
        pickFreeSpinSymbolCore,
        buildBonusPickDeckCore,
        pickBonusPackageCore,
        composeBonusPackageCore,
        rng,
        evaluateSpin,
        advanceFeatureStateCore,
        applyResultMultiplierCore,
        getSpinContextCore,
        getCurrentSpinCost,
        formatAmount
      },
      env: { ...env }
    };
  }

  /**
   * Builds the complete application by wiring together all dependencies and services
   * @param {Object} [options={}] - Configuration options
   * @param {Object} options.dependencies - All resolved module dependencies
   * @returns {Object} Complete application object with all components
   */
  function buildMainApp(options = {}) {
    const globalRoot = options.globalRoot || root;
    const dependencies = options.dependencies || {};
    const {
      AppBootstrap,
      SlotCore,
      GameConfig,
      RuntimeSession,
      SeededRng
    } = dependencies;

    const mainAppContext = createMainAppContext({
      createGameConfig: GameConfig.createGameConfig,
      collectDomRefs: AppBootstrap.collectDomRefs,
      slotCore: SlotCore,
      globalRoot,
      windowRef: options.windowRef || globalRoot,
      documentRef: options.documentRef || (typeof document !== 'undefined' ? document : null),
      performanceRef: options.performanceRef || globalRoot.performance || null,
      requestAnimationFrameRef: options.requestAnimationFrameRef || globalRoot.requestAnimationFrame || null,
      getComputedStyleRef: options.getComputedStyleRef || globalRoot.getComputedStyle || null,
      setTimeoutRef: options.setTimeoutRef,
      clearTimeoutRef: options.clearTimeoutRef,
      setIntervalRef: options.setIntervalRef,
      clearIntervalRef: options.clearIntervalRef,
      cryptoRef: options.cryptoRef,
      ImageCtor: options.ImageCtor,
      imgPrefix: options.imgPrefix,
      locationPath: options.locationPath,
      refs: options.refs,
      autoSpinState: options.autoSpinState,
      storage: options.storage
    });
    const {
      gameConfig,
      refs,
      autoSpinState,
      cabinetStorage,
      env
    } = mainAppContext;

    const runtimeServices = createRuntimeServices({
      createCabinetStateManager: RuntimeSession.createCabinetStateManager,
      createRuntimeSession: RuntimeSession.createRuntimeSession,
      createRuntimeBridge: RuntimeSession.createRuntimeBridge,
      createSeededRngController: SeededRng.createSeededRngController,
      slotCore: SlotCore,
      gameConfig,
      storage: cabinetStorage,
      windowRef: env.windowRef,
      cryptoRef: env.cryptoRef,
      setIntervalRef: env.setIntervalRef,
      clearIntervalRef: env.clearIntervalRef
    });
    const { runtimeSession, runtimeBridge, session, rngController } = runtimeServices;
    const appControllerOptions = buildAppControllerOptions({
      modules: pickControllerModules(dependencies),
      refs,
      session,
      runtimeBridge,
      slotCore: SlotCore,
      gameConfig,
      autoSpinState,
      env
    });

    const appControllers = AppBootstrap.createAppControllers(appControllerOptions);

    return {
      dependencies,
      slotCore: SlotCore,
      gameConfig,
      mainAppContext,
      refs,
      autoSpinState,
      runtimeSession,
      runtimeBridge,
      runtimeServices,
      session,
      rngController,
      appControllerOptions,
      appControllers
    };
  }

  /**
   * Creates the main application by resolving dependencies and building
   * @param {Object} [options={}] - Configuration options
   * @returns {Object} Complete application instance
   */
  function createMainApp(options = {}) {
    const globalRoot = options.globalRoot || root;
    const dependencies = resolveAppDependencies({
      globalRoot,
      dependencies: options.dependencies
    });

    return buildMainApp({
      dependencies,
      globalRoot,
      windowRef: options.windowRef,
      documentRef: options.documentRef,
      performanceRef: options.performanceRef,
      requestAnimationFrameRef: options.requestAnimationFrameRef,
      getComputedStyleRef: options.getComputedStyleRef,
      setTimeoutRef: options.setTimeoutRef,
      clearTimeoutRef: options.clearTimeoutRef,
      setIntervalRef: options.setIntervalRef,
      clearIntervalRef: options.clearIntervalRef,
      cryptoRef: options.cryptoRef,
      ImageCtor: options.ImageCtor,
      imgPrefix: options.imgPrefix,
      locationPath: options.locationPath,
      refs: options.refs,
      autoSpinState: options.autoSpinState,
      storage: options.storage
    });
  }

  /**
   * Creates and starts the main application
   * Initializes RNG, controllers, and begins the game lifecycle
   * @param {Object} [options={}] - Configuration options
   * @returns {Object} Started application instance
   * @example
   * const app = MainApp.startMainApp();
   */
  function startMainApp(options = {}) {
    const app = createMainApp(options);
    app.rngController.seedFromCrypto();
    app.appControllers.initialize();
    return app;
  }

  /**
   * MainApp module exports
   * Provides application orchestration and dependency injection
   */
  return {
    APP_MODULE_NAMES,
    CONTROLLER_MODULE_NAMES,
    DEFAULT_AUTO_SPIN_STATE,
    resolveAppDependencies,
    getCabinetStorage,
    bindWindowMethod,
    createMainAppContext,
    createRuntimeServices,
    pickControllerModules,
    buildAppControllerOptions,
    buildMainApp,
    createMainApp,
    startMainApp
  };
});
