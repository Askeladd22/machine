const assert = require('assert');

(() => {
  const GameConfig = require('./game_config');
  const { createGameConfig, DEFAULT_PAYOUT_SCALE } = GameConfig;

  function runTest(name, fn) {
    fn();
    console.log(`PASS ${name}`);
  }

  runTest('game config: createGameConfig builds symbol assets, preload urls and cabinet key', () => {
    const config = createGameConfig({
      imgPrefix: 'img/',
      locationPath: '/slot',
      coreSymbols: [
        { name: 'S1', label: 'Ritratto 1' },
        { name: 'S2', label: 'Ritratto 2' }
      ],
      coreScatter: { name: 'BOOK', label: 'Libro', isScatter: true },
      cloneSymbol: (value) => ({ ...value }),
      portraitSymbolCount: 2
    });

    assert.strictEqual(config.cabinetStateKey, 'discord-slot-cabinet-state-v1:/slot');
    assert.strictEqual(config.symbols[0].img, 'img/user1.png');
    assert.strictEqual(config.symbols[1].img, 'img/user2.png');
    assert.strictEqual(config.scatter.img, 'img/scatter.png');
    assert.deepStrictEqual(config.coinFrames, [
      'img/goldcoin-frame1.png',
      'img/goldcoin-frame2.png',
      'img/goldcoin-frame3.png',
      'img/goldcoin-frame4.png',
      'img/goldcoin-frame5.png',
      'img/goldcoin-frame6.png'
    ]);
    assert.deepStrictEqual(config.preloadUrls.slice(0, 3), [
      'img/user1.png',
      'img/user2.png',
      'img/scatter.png'
    ]);
  });

  runTest('game config: default payout scale builds scaled payout tables for runtime use', () => {
    const config = createGameConfig({
      basePaytable: { S1: { 5: 100, 3: 10 } },
      baseScatterPayout: { 3: 5 },
      scalePaytable: (factor, paytable, scatterPayout) => ({
        paytable: { S1: { 5: paytable.S1[5] * factor, 3: paytable.S1[3] * factor } },
        scatterPayout: { 3: scatterPayout[3] * factor }
      })
    });

    assert.strictEqual(config.payoutScale, DEFAULT_PAYOUT_SCALE);
    assert.strictEqual(config.paytable.S1[5], 100 * DEFAULT_PAYOUT_SCALE);
    assert.strictEqual(config.scatterPayout[3], 5 * DEFAULT_PAYOUT_SCALE);
  });

  runTest('game config: paylineColorForIndex wraps across the configured palette', () => {
    const config = createGameConfig({
      paylineColors: ['#111', '#222', '#333']
    });

    assert.strictEqual(config.paylineColorForIndex(0), '#111');
    assert.strictEqual(config.paylineColorForIndex(2), '#333');
    assert.strictEqual(config.paylineColorForIndex(3), '#111');
    assert.strictEqual(config.paylineColorForIndex(-1), '#333');
  });

  runTest('game config: timings and bet defaults remain aligned with the cabinet runtime', () => {
    const config = createGameConfig();

    assert.strictEqual(config.anteMultiplier, 25);
    assert.strictEqual(config.anteScatterBoost, 3);
    assert.strictEqual(config.defaultPaytableTab, 'values');
    assert.strictEqual(config.paytableTabAnimationMs, 220);
    assert.strictEqual(config.betStep, 0.1);
    assert.strictEqual(config.minBet, 0.1);
    assert.strictEqual(config.maxBet, 1000);
    assert.strictEqual(config.initialBalance, 1000);
    assert.strictEqual(config.initialBetPerSpin, 1);
    assert.strictEqual(config.timings.settle, 420);
  });
})();

(() => {
  const SeededRng = require('./seeded_rng');
  const { createSeededRngController } = SeededRng;

  function runTest(name, fn) {
    fn();
    console.log(`PASS ${name}`);
  }

  runTest('seeded rng: seedFromHex creates a deterministic sequence', () => {
    const first = createSeededRngController({ autoAdvance: false, autoInstallGlobals: false });
    const second = createSeededRngController({ autoAdvance: false, autoInstallGlobals: false });

    first.seedFromHex('00112233445566778899aabbccddeeff');
    second.seedFromHex('00112233445566778899aabbccddeeff');

    const left = [first.next(), first.next(), first.next()];
    const right = [second.next(), second.next(), second.next()];

    assert.deepStrictEqual(left, right);
  });

  runTest('seeded rng: installGlobals exposes the seed helpers on the target window', () => {
    const target = {};
    const controller = createSeededRngController({
      autoAdvance: false,
      autoInstallGlobals: false
    });

    controller.installGlobals(target);
    target._seedFromHex('deadbeef');

    assert.strictEqual(typeof target._rng, 'function');
    assert.strictEqual(typeof target._seedFromCrypto, 'function');
    assert.strictEqual(typeof target.startRng, 'function');
    assert.ok(/^[0-9a-f]{32}$/i.test(target._seedToHex()));
  });

  runTest('seeded rng: startAdvance and stopAdvance use the injected timer hooks', () => {
    const timerCalls = [];
    const clearCalls = [];
    const controller = createSeededRngController({
      autoAdvance: false,
      autoInstallGlobals: false,
      setIntervalRef(handler, delay) {
        timerCalls.push({ handler, delay });
        return 42;
      },
      clearIntervalRef(id) {
        clearCalls.push(id);
      }
    });

    assert.strictEqual(controller.startAdvance(), 42);
    assert.strictEqual(controller.startAdvance(), 42);
    assert.deepStrictEqual(timerCalls.map((entry) => entry.delay), [64]);
    assert.strictEqual(controller.stopAdvance(), true);
    assert.deepStrictEqual(clearCalls, [42]);
  });
})();

(() => {
  const AppBootstrap = require('./app_bootstrap');
  const { collectDomRefs, createAppControllers } = AppBootstrap;

  function createRef(id) {
    return { id };
  }

  function createFactory(name) {
    const calls = [];
    return {
      calls,
      create(parameters) {
        calls.push(parameters);
        return { name, parameters };
      }
    };
  }

  function runTest(name, fn) {
    fn();
    console.log(`PASS ${name}`);
  }

  runTest('app bootstrap: collectDomRefs gathers the expected DOM handles', () => {
    const refs = {
      app: createRef('app'),
      slot: createRef('slot'),
      balance: createRef('balance'),
      tab1: createRef('tab1'),
      tab2: createRef('tab2'),
      view1: createRef('view1')
    };
    const documentRef = {
      querySelector(selector) {
        if (selector === '.app') return refs.app;
        return null;
      },
      getElementById(id) {
        return refs[id] || createRef(id);
      },
      querySelectorAll(selector) {
        if (selector === '.paytable-tab') return [refs.tab1, refs.tab2];
        if (selector === '.paytable-view') return [refs.view1];
        return [];
      }
    };

    const domRefs = collectDomRefs(documentRef);

    assert.strictEqual(domRefs.appEl, refs.app);
    assert.strictEqual(domRefs.slot, refs.slot);
    assert.strictEqual(domRefs.balanceEl, refs.balance);
    assert.deepStrictEqual(domRefs.paytableTabEls, [refs.tab1, refs.tab2]);
    assert.deepStrictEqual(domRefs.paytableViewEls, [refs.view1]);
  });

  runTest('app bootstrap: createAppControllers instantiates and wires every controller', () => {
    const audioCalls = [];
    const audioFactory = {
      calls: [],
      create(parameters) {
        this.calls.push(parameters);
        return {
          name: 'audio',
          parameters,
          bound: false,
          bindFirstGestureBootstrap() {
            this.bound = true;
          },
          isAmbientEnabled() {
            audioCalls.push('isAmbientEnabled');
            return true;
          },
          setAmbientEnabled(enabled, notify) {
            audioCalls.push(['setAmbientEnabled', enabled, notify]);
          },
          startAmbientSound() {
            audioCalls.push('startAmbientSound');
          },
          stopAmbientSound(value) {
            audioCalls.push(['stopAmbientSound', value]);
          },
          updateAmbientToggleUI() {
            audioCalls.push('updateAmbientToggleUI');
          },
          syncAmbientMood() {
            audioCalls.push('syncAmbientMood');
          },
          playCoinSound() {
            audioCalls.push('playCoinSound');
          },
          playCoinInsertSound() {
            audioCalls.push('playCoinInsertSound');
          },
          playSpinButtonSound() {
            audioCalls.push('playSpinButtonSound');
          },
          playLeverSound() {
            audioCalls.push('playLeverSound');
          },
          playReelStartSound(reel, intensity) {
            audioCalls.push(['playReelStartSound', reel, intensity]);
          },
          playReelStopSound(reel, isLast) {
            audioCalls.push(['playReelStopSound', reel, isLast]);
          },
          playSmallWinSound() {
            audioCalls.push('playSmallWinSound');
          },
          playBigWinSound() {
            audioCalls.push('playBigWinSound');
          },
          playClick(freq, dur, vol) {
            audioCalls.push(['playClick', freq, dur, vol]);
          }
        };
      }
    };
    const viewportFactory = createFactory('viewport');
    const cabinetUiFactory = {
      calls: [],
      createPaytable(parameters) {
        this.calls.push({ kind: 'paytable', parameters });
        return { name: 'paytable', parameters };
      },
      createFeedback(parameters) {
        this.calls.push({ kind: 'feedback', parameters });
        return { name: 'feedback', parameters };
      }
    };
    const runtimeUiFactory = {
      calls: [],
      create(parameters) {
        this.calls.push(parameters);
        return {
          name: 'runtimeUI',
          parameters,
          ...parameters,
          initialized: false,
          initializeRuntimeUI() {
            this.initialized = true;
          }
        };
      }
    };
    const runtimeFactory = createFactory('runtimeBindings');
    const slotRendererFactory = {
      calls: [],
      create(parameters) {
        this.calls.push(parameters);
        return {
          name: 'slotRenderer',
          parameters,
          built: false,
          preloaded: false,
          initialized: false,
          buildGrid() {
            this.built = true;
          },
          getCells() { return []; },
          getGhosts() { return []; },
          getFaces() { return []; },
          syncCellSymbol: noop,
          resetSpinGhostStyles: noop,
          syncGhostFromFace: noop,
          preloadImages() {
            this.preloaded = true;
            return new Map();
          },
          initReelStrips() {
            this.initialized = true;
            return [];
          },
          getReelStrips() { return []; },
          buildReelsFinal() { return { final: [], starts: [] }; },
          pickFreeSpinSymbol() { return null; }
        };
      }
    };
    const spinFactory = {
      calls: [],
      create(parameters) {
        this.calls.push(parameters);
        return {
          name: 'spin',
          parameters,
          startAutoSpin: noop,
          toggleAutoSpin: noop,
          spin: noop
        };
      }
    };

    const modules = {
      SlotAudio: { createSlotAudioController: (params) => audioFactory.create(params) },
      ViewportFit: { createViewportFitController: (params) => viewportFactory.create(params) },
      CabinetUI: {
        createPaytableController: (params) => cabinetUiFactory.createPaytable(params),
        createFeedbackUIController: (params) => cabinetUiFactory.createFeedback(params)
      },
      RuntimeUI: {
        createRuntimeUIController: (params) => runtimeUiFactory.create(params),
        createRuntimeBindingsController: (params) => runtimeFactory.create(params)
      },
      SlotRenderer: { createSlotRendererController: (params) => slotRendererFactory.create(params) },
      SpinRuntime: { createSpinRuntimeController: (params) => spinFactory.create(params) }
    };

    const refs = {
      appEl: createRef('app'),
      slot: createRef('slot'),
      ambientToggleEl: createRef('ambient'),
      paytablePanelEl: createRef('panel'),
      paytableBackdropEl: createRef('backdrop'),
      togglePaytableEl: createRef('toggle'),
      closePaytableEl: createRef('close'),
      paytableBodyEl: createRef('body'),
      scatterPaytableEl: createRef('scatter'),
      paylineMapEl: createRef('map'),
      paytableTabEls: [createRef('tab1')],
      paytableViewEls: [createRef('view1')],
      speedSlowEl: createRef('speedSlow'),
      speedNormalEl: createRef('speedNormal'),
      speedFastEl: createRef('speedFast'),
      autoPreset10El: createRef('auto10'),
      autoPreset25El: createRef('auto25'),
      autoPreset50El: createRef('auto50'),
      autoPreset100El: createRef('auto100'),
      spinButtonControlEl: createRef('spin'),
      autoSpinButtonEl: createRef('auto'),
      betPlusEl: createRef('betPlus'),
      betMinusEl: createRef('betMinus'),
      spinLeverEl: createRef('lever'),
      cabinetNoticeEl: createRef('notice'),
      winDetailsEl: createRef('details'),
      coinPayoutZoneEl: createRef('payoutZone'),
      payoutCoinEl: createRef('coin'),
      coinPileEl: createRef('pile')
    };
    const constants = {
      ROWS: 3,
      COLS: 5,
      TOTAL: 15,
      BASE_FREE_SPINS: 12,
      MAX_FREE_SPINS: 100,
      SCATTER_TRIGGER_COUNT: 3,
      RETRIGGER_SCATTER_COUNT: 4,
      REEL_STRIP_LEN: 256,
      SCATTER_WEIGHT: 2.2,
      REEL_STRIP_STEPS: [1, 2, 3, 4, 5],
      REEL_STRIP_OFFSETS: [5, 4, 3, 2, 1],
      SYMBOL_WEIGHTS: [2, 2],
      SYMBOLS: [{ name: 'S1', img: 'a' }, { name: 'S2', img: 'b' }],
      SCATTER: { name: 'BOOK', img: 'book', isScatter: true },
      PAYTABLE: {},
      SCATTER_PAYOUT: {},
      DEFAULT_PAYTABLE_TAB: 'values',
      PAYTABLE_TAB_ANIMATION_MS: 220,
      MIN_BET: 0.1,
      MAX_BET: 1000,
      ANTE_SCATTER_BOOST: 3,
      COIN_FRAMES: ['c1.png'],
      BONUS_PICK_OPTIONS: [],
      preloadUrls: ['a.png', 'b.png']
    };
    const noop = () => { };
    const state = {
      autoSpinState: { enabled: false, remaining: 0, delayMs: 700, timeoutId: 0 },
      timings: { settle: 420 },
      getTimings: () => ({ settle: 420 }),
      getAnteOn: () => false,
      getInFreeSpins: () => false,
      getFeatureState: () => ({}),
      setFeatureState: noop,
      getBalance: () => 100,
      setBalance: noop,
      getBetPerSpin: () => 1,
      getFreeSpins: () => 0,
      getFreeSpinSymbol: () => null,
      getBonusMultiplier: () => 1,
      getLastCollectedWin: () => 0,
      setLastCollectedWin: noop
      ,
      getSessionStats: () => ({ hitRateLabel: '0%', bestWin: 0, streakLabel: '-' }),
      recordSessionSpinResult: noop
    };
    const helpers = {
      setAmbientEnabled: noop,
      isAmbientEnabled: () => true,
      increaseBet: noop,
      decreaseBet: noop,
      currentFeatureBet: () => 1,
      restoreCabinetState: noop,
      persistCabinetState: noop,
      stopAmbientSound: noop,
      startAmbientSound: noop,
      updateAmbientToggleUI: noop,
      syncAmbientMood: noop,
      playLeverSound: noop,
      getPaylines: () => [],
      paylineColorForIndex: () => '#fff',
      symbolLabel: () => 'label',
      formatSymbolCardValue: () => '1',
      symbolValueAccent: () => ({ accent: '#fff', glow: '#000' }),
      symbolTierLabel: () => 'Top',
      updateCellTheme: noop,
      cloneSymbolCore: (value) => ({ ...value }),
      buildWeightedSymbolsCore: () => [],
      initReelStripsCore: () => [],
      buildReelsFinalCore: () => ({ final: [], starts: [] }),
      pickFreeSpinSymbolCore: () => null,
      rng: () => 0.5,
      evaluateSpin: async () => ({ win: 0, finalScatter: 0, wins: [] }),
      advanceFeatureStateCore: noop,
      getSpinContextCore: () => ({ startedInFreeSpins: false, spinStake: 1 }),
      getCurrentSpinCost: () => 1,
      formatAmount: () => '1.00',
      playSpinButtonSound: noop,
      playCoinInsertSound: noop,
      playBigWinSound: noop,
      playSmallWinSound: noop,
      playReelStartSound: noop,
      playClick: noop,
      playReelStopSound: noop,
      playCoinSound: noop
    };
    const env = {
      windowRef: { setTimeout: noop, clearTimeout: noop },
      documentRef: { getElementById: () => null },
      performanceRef: { now: () => 0 },
      requestAnimationFrameRef: noop,
      getComputedStyleRef: noop,
      setTimeoutRef: noop,
      clearTimeoutRef: noop,
      ImageCtor: function FakeImage() { this.src = ''; }
    };

    const bundle = createAppControllers({ modules, refs, state, constants, helpers, env });

    assert.strictEqual(bundle.audioController.bound, true);
    assert.strictEqual(audioFactory.calls.length, 1);
    assert.strictEqual(viewportFactory.calls[0].appEl, refs.appEl);
    assert.strictEqual(cabinetUiFactory.calls[0].parameters.panelEl, refs.paytablePanelEl);
    assert.strictEqual(runtimeUiFactory.calls[0].getPaytableUI(), bundle.paytableUI);
    assert.strictEqual(runtimeFactory.calls[0].paytableUI, bundle.paytableUI);
    assert.strictEqual(runtimeFactory.calls[0].showFloat, bundle.runtimeUI.parameters.showFloat);
    assert.strictEqual(typeof runtimeFactory.calls[0].startAutoSpin, 'function');
    assert.strictEqual(typeof runtimeFactory.calls[0].toggleAutoSpin, 'function');
    assert.strictEqual(typeof runtimeFactory.calls[0].spin, 'function');
    assert.strictEqual(slotRendererFactory.calls[0].slotEl, refs.slot);
    assert.strictEqual(slotRendererFactory.calls[0].symbols, constants.SYMBOLS);
    assert.strictEqual(slotRendererFactory.calls[0].scatter, constants.SCATTER);
    assert.strictEqual(cabinetUiFactory.calls[1].parameters.coinFrames, constants.COIN_FRAMES);
    assert.strictEqual(typeof spinFactory.calls[0].syncCellSymbol, 'function');
    assert.strictEqual(typeof spinFactory.calls[0].buildReelsFinal, 'function');
    assert.strictEqual(typeof spinFactory.calls[0].pickFreeSpinSymbol, 'function');
    assert.strictEqual(typeof spinFactory.calls[0].resolveBonusPick, 'function');
    assert.strictEqual(spinFactory.calls[0].updateUI, bundle.runtimeUI.parameters.updateUI);
    assert.strictEqual(spinFactory.calls[0].autoPresetEls.length, 4);

    runtimeUiFactory.calls[0].updateAmbientToggleUI();
    runtimeFactory.calls[0].setAmbientEnabled(true, true);
    cabinetUiFactory.calls[1].parameters.playCoinSound();
    spinFactory.calls[0].playSpinButtonSound();

    assert.deepStrictEqual(audioCalls, [
      'updateAmbientToggleUI',
      ['setAmbientEnabled', true, true],
      'playCoinSound',
      'playSpinButtonSound'
    ]);

    bundle.initialize();

    assert.strictEqual(bundle.slotRenderer.built, true);
    assert.strictEqual(bundle.slotRenderer.preloaded, true);
    assert.strictEqual(bundle.slotRenderer.initialized, true);
    assert.strictEqual(bundle.runtimeUI.initialized, true);
  });
})();

(() => {
  const MainApp = require('./main_app');
  const {
    APP_MODULE_NAMES,
    CONTROLLER_MODULE_NAMES,
    DEFAULT_AUTO_SPIN_STATE,
    resolveAppDependencies,
    getCabinetStorage,
    createMainAppContext,
    createRuntimeServices,
    pickControllerModules,
    buildAppControllerOptions,
    createMainApp,
    startMainApp
  } = MainApp;

  function runTest(name, fn) {
    fn();
    console.log(`PASS ${name}`);
  }

  function createDependencies(log) {
    const session = {
      getAnteOn: () => false,
      getInFreeSpins: () => false,
      getBalance: () => 100,
      setBalance: (value) => { log.balance = value; },
      getBetPerSpin: () => 1,
      getFreeSpins: () => 0,
      getFreeSpinSymbol: () => null,
      getBonusMultiplier: () => 1,
      getLastCollectedWin: () => 0,
      setLastCollectedWin: (value) => { log.lastCollectedWin = value; },
      getSessionStats: () => ({ hitRateLabel: '55%', bestWin: 9.5, streakLabel: 'Win x2' }),
      recordSessionSpinResult: (result) => { log.sessionSpinResult = result; },
      increaseBet: () => { log.increaseBet = true; },
      decreaseBet: () => { log.decreaseBet = true; }
    };
    const runtimeBridge = {
      session,
      getFeatureState: () => ({ inFreeSpins: false, freeSpins: 0 }),
      setFeatureState: (nextState) => nextState,
      persistCabinetState: () => true,
      restoreCabinetState: () => true,
      rng: () => 0.5,
      symbolLabel: (value) => String(value),
      formatAmount: (value) => Number(value).toFixed(2),
      formatSymbolCardValue: (value) => String(value),
      symbolValueAccent: (index) => ({ accent: index }),
      symbolTierLabel: (index) => `tier:${index}`,
      currentFeatureBet: () => 1,
      updateCellTheme: () => {},
      getCurrentSpinCost: () => 1,
      evaluateSpin: async () => ({ totalWin: 0 })
    };
    const appControllers = {
      initializeCalled: false,
      initialize() {
        this.initializeCalled = true;
      }
    };

    return {
      CabinetUI: { id: 'cabinet-ui' },
      SlotAudio: { id: 'audio' },
      ViewportFit: { id: 'viewport' },
      SlotRenderer: { id: 'slot-renderer' },
      SpinRuntime: { id: 'spin' },
      AppBootstrap: {
        collectDomRefs(documentRef) {
          log.collectDomRefs = documentRef;
          return {
            appEl: { id: 'app' },
            autoStatusEl: { id: 'autoStatus' }
          };
        },
        createAppControllers(parameters) {
          log.createAppControllers = parameters;
          return appControllers;
        }
      },
      SlotCore: {
        ROWS: 3,
        COLS: 5,
        TOTAL: 15,
        BASE_FREE_SPINS: 12,
        MAX_FREE_SPINS: 100,
        SCATTER_TRIGGER_COUNT: 3,
        RETRIGGER_SCATTER_COUNT: 4,
        REEL_STRIP_LEN: 256,
        SCATTER_WEIGHT: 2.2,
        REEL_STRIP_STEPS: [1, 2, 3, 4, 5],
        REEL_STRIP_OFFSETS: [0, 1, 2, 3, 4],
        PORTRAIT_SYMBOL_COUNT: 2,
        SYMBOL_WEIGHTS: [1, 1],
        SYMBOLS: [{ name: 'A' }, { name: 'B' }],
        SCATTER: { name: 'BOOK', isScatter: true },
        PAYTABLE: { A: { 3: 1 } },
        SCATTER_PAYOUT: { 2: 0.4, 3: 4.8 },
        cloneSymbol: (symbol) => ({ ...symbol }),
        buildWeightedSymbols: () => [],
        initReelStrips: () => [],
        buildReelsFinal: () => ({ final: [], starts: [] }),
        pickFreeSpinSymbol: () => null,
        evaluateReels: async () => ({ totalWin: 0 }),
        getSpinContext: () => ({ spinStake: 1 }),
        advanceFeatureState: () => ({}),
        getPaylines: () => []
      },
      GameConfig: {
        createGameConfig(parameters) {
          log.gameConfig = parameters;
          return {
            anteMultiplier: 25,
            anteScatterBoost: 3,
            defaultPaytableTab: 'values',
            paytableTabAnimationMs: 220,
            betStep: 0.1,
            minBet: 0.1,
            maxBet: 1000,
            initialBalance: 1000,
            initialBetPerSpin: 1,
            cabinetStateKey: 'cabinet-key',
            coinFrames: ['coin-1'],
            symbols: [{ name: 'A', img: 'a.png' }],
            scatter: { name: 'BOOK', img: 'book.png', isScatter: true },
            timings: { baseDuration: 820 },
            paylineColorForIndex: (index) => `#${index}`,
            preloadUrls: ['a.png', 'book.png']
          };
        }
      },
      RuntimeUI: { id: 'runtime-ui' },
      RuntimeSession: {
        createCabinetStateManager() {
          log.createCabinetStateManager = true;
          return {};
        },
        createRuntimeSession(parameters) {
          log.runtimeSession = parameters;
          return session;
        },
        createRuntimeBridge(parameters) {
          log.runtimeBridge = parameters;
          return runtimeBridge;
        }
      },
      SeededRng: {
        createSeededRngController(parameters) {
          log.rngController = parameters;
          return {
            seeded: false,
            next() { return 0.5; },
            seedFromCrypto() {
              this.seeded = true;
            }
          };
        }
      }
    };
  }

  runTest('main app: resolveAppDependencies prefers injected dependencies', () => {
    const dependencies = { SlotCore: { id: 'slot-core' } };
    const resolved = resolveAppDependencies({ globalRoot: {}, dependencies });
    assert.strictEqual(resolved, dependencies);
  });

  runTest('main app: resolveAppDependencies resolves the consolidated bootstrap globals', () => {
    const globals = APP_MODULE_NAMES.reduce(function (acc, name) {
      acc[name] = { name };
      return acc;
    }, {});

    const resolved = resolveAppDependencies({ globalRoot: globals });

    assert.deepStrictEqual(Object.keys(resolved), APP_MODULE_NAMES);
    assert.strictEqual(resolved.SlotCore.name, 'SlotCore');
    assert.strictEqual(resolved.RuntimeSession.name, 'RuntimeSession');
  });

  runTest('main app: getCabinetStorage returns null when localStorage throws', () => {
    const storage = getCabinetStorage({
      get localStorage() {
        throw new Error('denied');
      }
    });

    assert.strictEqual(storage, null);
  });

  runTest('main app: createMainAppContext builds config, refs, storage and env', () => {
    const log = {};
    const documentRef = { id: 'document' };
    const windowRef = {
      location: { pathname: '/slot' },
      crypto: { id: 'crypto' },
      setTimeout() {},
      clearTimeout() {},
      setInterval() {},
      clearInterval() {},
      Image: function Image() {},
      localStorage: { id: 'storage' }
    };
    const slotCore = {
      PORTRAIT_SYMBOL_COUNT: 2,
      SYMBOLS: [{ name: 'A' }],
      SCATTER: { name: 'BOOK' },
      cloneSymbol: (symbol) => ({ ...symbol })
    };
    const refs = { appEl: { id: 'app' } };

    const context = createMainAppContext({
      createGameConfig(parameters) {
        log.gameConfig = parameters;
        return { id: 'game-config', symbols: [], scatter: null };
      },
      collectDomRefs(doc) {
        log.collectDomRefs = doc;
        return refs;
      },
      slotCore,
      windowRef,
      documentRef,
      refs,
      performanceRef: { now: () => 1 },
      requestAnimationFrameRef: () => 1,
      getComputedStyleRef: () => ({ zoom: 1 })
    });

    assert.strictEqual(log.gameConfig.locationPath, '/slot');
    assert.strictEqual(log.gameConfig.portraitSymbolCount, 2);
    assert.strictEqual(log.collectDomRefs, undefined);
    assert.strictEqual(context.gameConfig.id, 'game-config');
    assert.strictEqual(context.refs, refs);
    assert.strictEqual(context.autoSpinState.delayMs, DEFAULT_AUTO_SPIN_STATE.delayMs);
    assert.strictEqual(context.cabinetStorage.id, 'storage');
    assert.strictEqual(context.env.windowRef, windowRef);
    assert.strictEqual(context.env.documentRef, documentRef);
    assert.strictEqual(context.env.cryptoRef.id, 'crypto');
    assert.strictEqual(typeof context.env.setIntervalRef, 'function');
    assert.strictEqual(typeof context.env.clearTimeoutRef, 'function');
  });

  runTest('main app: createRuntimeServices composes session, rng and bridge from shared inputs', () => {
    const log = {};
    const session = { id: 'session' };
    const bridge = { session, id: 'bridge' };
    const rngController = {
      id: 'rng',
      seedFromCrypto() {}
    };

    const result = createRuntimeServices({
      createCabinetStateManager: function createCabinetStateManager() {
        return { id: 'cabinet-manager' };
      },
      createRuntimeSession: function createRuntimeSession(parameters) {
        log.runtimeSession = parameters;
        return session;
      },
      createRuntimeBridge: function createRuntimeBridge(parameters) {
        log.runtimeBridge = parameters;
        return bridge;
      },
      createSeededRngController: function createSeededRngController(parameters) {
        log.rngController = parameters;
        return rngController;
      },
      slotCore: {
        ROWS: 3,
        COLS: 5,
        MAX_FREE_SPINS: 100,
        PAYTABLE: { A: { 3: 1 } },
        SCATTER_PAYOUT: { 2: 0.4, 3: 4.8 },
        cloneSymbol: (symbol) => ({ ...symbol }),
        evaluateReels: async () => ({ totalWin: 0 }),
        getSpinContext: () => ({ spinStake: 1 })
      },
      gameConfig: {
        anteMultiplier: 25,
        betStep: 0.1,
        minBet: 0.1,
        maxBet: 1000,
        initialBalance: 1000,
        initialBetPerSpin: 1,
        cabinetStateKey: 'cabinet-key',
        symbols: [{ name: 'A' }],
        scatter: { name: 'BOOK', isScatter: true }
      },
      storage: { id: 'storage' },
      windowRef: { id: 'window', crypto: { id: 'crypto' } },
      setIntervalRef: function setIntervalRef() {},
      clearIntervalRef: function clearIntervalRef() {}
    });

    assert.strictEqual(log.runtimeSession.storage.id, 'storage');
    assert.strictEqual(log.runtimeSession.storageKey, 'cabinet-key');
    assert.strictEqual(log.runtimeSession.maxFreeSpins, 100);
    assert.strictEqual(log.rngController.windowRef.id, 'window');
    assert.strictEqual(log.rngController.cryptoRef.id, 'crypto');
    assert.strictEqual(log.runtimeBridge.runtimeSession, session);
    assert.strictEqual(log.runtimeBridge.rngController, rngController);
    assert.strictEqual(log.runtimeBridge.rows, 3);
    assert.strictEqual(log.runtimeBridge.cols, 5);
    assert.strictEqual(result.runtimeSession, session);
    assert.strictEqual(result.runtimeBridge, bridge);
    assert.strictEqual(result.session, session);
    assert.strictEqual(result.rngController, rngController);
  });

  runTest('main app: pickControllerModules selects only controller dependencies', () => {
    const dependencies = CONTROLLER_MODULE_NAMES.reduce(function (acc, name) {
      acc[name] = { name };
      return acc;
    }, {
      SlotCore: { name: 'SlotCore' },
      MainApp: { name: 'MainApp' }
    });

    const selected = pickControllerModules(dependencies);

    assert.deepStrictEqual(Object.keys(selected), CONTROLLER_MODULE_NAMES);
    assert.strictEqual(selected.SlotAudio.name, 'SlotAudio');
    assert.strictEqual(selected.SpinRuntime.name, 'SpinRuntime');
    assert.strictEqual(selected.SlotCore, undefined);
  });

  runTest('main app: buildAppControllerOptions wires state, constants, helpers and env', () => {
    const log = {};
    const session = {
      getAnteOn: () => true,
      getInFreeSpins: () => false,
      getBalance: () => 120,
      setBalance: (value) => { log.balance = value; },
      getBetPerSpin: () => 1.5,
      getFreeSpins: () => 0,
      getFreeSpinSymbol: () => ({ name: 'S1' }),
      getBonusMultiplier: () => 1.5,
      getLastCollectedWin: () => 7.5,
      setLastCollectedWin: (value) => { log.lastCollectedWin = value; },
      getSessionStats: () => ({ hitRateLabel: '55%', bestWin: 9.5, streakLabel: 'Win x2' }),
      recordSessionSpinResult: (result) => { log.sessionSpinResult = result; },
      increaseBet: () => { log.increaseBet = true; },
      decreaseBet: () => { log.decreaseBet = true; }
    };
    const runtimeBridge = {
      getFeatureState: () => ({ inFreeSpins: false }),
      setFeatureState: (value) => value,
      persistCabinetState: () => true,
      restoreCabinetState: () => true,
      rng: () => 0.25,
      symbolLabel: (value) => String(value),
      formatAmount: (value) => Number(value).toFixed(2),
      formatSymbolCardValue: (value) => String(value),
      symbolValueAccent: (index) => ({ accent: index }),
      symbolTierLabel: (index) => `tier:${index}`,
      currentFeatureBet: () => 2,
      updateCellTheme: () => { log.updateCellTheme = true; },
      getCurrentSpinCost: () => 1.5,
      evaluateSpin: async () => ({ totalWin: 0 })
    };
    const slotCore = {
      ROWS: 3,
      COLS: 5,
      TOTAL: 15,
      BASE_FREE_SPINS: 12,
      MAX_FREE_SPINS: 100,
      SCATTER_TRIGGER_COUNT: 3,
      RETRIGGER_SCATTER_COUNT: 4,
      REEL_STRIP_LEN: 256,
      SCATTER_WEIGHT: 2.2,
      REEL_STRIP_STEPS: [1, 2, 3, 4, 5],
      REEL_STRIP_OFFSETS: [0, 1, 2, 3, 4],
      SYMBOL_WEIGHTS: [1, 1],
      PAYTABLE: { A: { 3: 1 } },
      SCATTER_PAYOUT: { 2: 0.4, 3: 4.8 },
      cloneSymbol: (symbol) => ({ ...symbol }),
      buildWeightedSymbols: () => [],
      initReelStrips: () => [],
      buildReelsFinal: () => ({ final: [], starts: [] }),
      pickFreeSpinSymbol: () => null,
      getSpinContext: () => ({ stake: 1 }),
      advanceFeatureState: () => ({}),
      getPaylines: () => [0, 1, 2, 3, 4]
    };
    const gameConfig = {
      anteScatterBoost: 3,
      defaultPaytableTab: 'values',
      paytableTabAnimationMs: 220,
      minBet: 0.1,
      maxBet: 1000,
      coinFrames: ['coin-1'],
      symbols: [{ name: 'A' }],
      scatter: { name: 'BOOK' },
      preloadUrls: ['a.png'],
      timings: { baseDuration: 820 },
      paylineColorForIndex: (index) => `#${index}`
    };
    const refs = { appEl: { id: 'app' }, autoStatusEl: { id: 'autoStatus' } };
    const modules = { SlotAudio: { id: 'audio' } };
    const env = { windowRef: { id: 'window' }, documentRef: { id: 'document' } };

    const options = buildAppControllerOptions({
      modules,
      refs,
      session,
      runtimeBridge,
      slotCore,
      gameConfig,
      autoSpinState: { enabled: false, remaining: 0, delayMs: 700, timeoutId: 0 },
      env
    });

    assert.notStrictEqual(options.refs, refs);
    assert.strictEqual(options.refs.appEl, refs.appEl);
    assert.strictEqual(options.modules, modules);
    assert.strictEqual(options.state.getAnteOn(), true);
    assert.strictEqual(options.state.getBalance(), 120);
    options.state.setBalance(99);
    assert.strictEqual(log.balance, 99);
    assert.strictEqual(options.state.getLastCollectedWin(), 7.5);
    assert.strictEqual(options.state.getBonusMultiplier(), 1.5);
    options.state.setLastCollectedWin(12);
    assert.strictEqual(log.lastCollectedWin, 12);
    assert.deepStrictEqual(options.state.getSessionStats(), { hitRateLabel: '55%', bestWin: 9.5, streakLabel: 'Win x2' });
    options.state.recordSessionSpinResult({ collectedWin: 3 });
    assert.deepStrictEqual(log.sessionSpinResult, { collectedWin: 3 });
    assert.strictEqual(options.constants.ROWS, 3);
    assert.strictEqual(options.constants.DEFAULT_PAYTABLE_TAB, 'values');
    assert.strictEqual(options.constants.COIN_FRAMES[0], 'coin-1');
    assert.strictEqual(options.helpers.getCurrentSpinCost(), 1.5);
    assert.strictEqual(options.helpers.symbolLabel('BOOK'), 'BOOK');
    options.helpers.increaseBet();
    options.helpers.decreaseBet();
    assert.strictEqual(log.increaseBet, true);
    assert.strictEqual(log.decreaseBet, true);
    assert.strictEqual(options.env.windowRef.id, 'window');
  });

  runTest('main app: createMainApp composes config, runtime services and app controllers', () => {
    const log = {};
    const dependencies = createDependencies(log);
    const documentRef = { id: 'document' };
    const windowRef = {
      location: { pathname: '/slot' },
      crypto: { getRandomValues() {} },
      setInterval() {},
      clearInterval() {},
      setTimeout() {},
      clearTimeout() {},
      Image: function Image() {},
      localStorage: { id: 'storage' }
    };
    const app = createMainApp({
      globalRoot: dependencies,
      dependencies,
      windowRef,
      documentRef,
      performanceRef: { now: () => 1 },
      requestAnimationFrameRef: () => 1,
      getComputedStyleRef: () => ({ zoom: 1 })
    });

    assert.strictEqual(log.gameConfig.locationPath, '/slot');
    assert.strictEqual(log.collectDomRefs.id, 'document');
    assert.strictEqual(log.runtimeSession.storage.id, 'storage');
    assert.strictEqual(log.runtimeSession.createCabinetStateManager, dependencies.RuntimeSession.createCabinetStateManager);
    assert.strictEqual(log.runtimeBridge.runtimeSession, app.runtimeSession);
    assert.strictEqual(log.rngController.windowRef, windowRef);
    assert.strictEqual(log.createAppControllers.modules.SlotAudio, dependencies.SlotAudio);
    assert.strictEqual(log.createAppControllers.helpers.getCurrentSpinCost(), 1);
    assert.strictEqual(log.createAppControllers.env.windowRef, windowRef);
    assert.strictEqual(app.dependencies, dependencies);
    assert.strictEqual(app.slotCore, dependencies.SlotCore);
    assert.strictEqual(app.session, app.runtimeSession);
    assert.strictEqual(app.runtimeServices.session, app.session);
  });

  runTest('main app: startMainApp seeds rng and initializes app controllers', () => {
    const log = {};
    const dependencies = createDependencies(log);
    const app = startMainApp({
      globalRoot: dependencies,
      dependencies,
      windowRef: {
        location: { pathname: '/slot' },
        crypto: { getRandomValues() {} },
        setInterval() {},
        clearInterval() {},
        setTimeout() {},
        clearTimeout() {},
        Image: function Image() {}
      },
      documentRef: { id: 'document' }
    });

    assert.strictEqual(app.rngController.seeded, true);
    assert.strictEqual(app.appControllers.initializeCalled, true);
  });
})();
