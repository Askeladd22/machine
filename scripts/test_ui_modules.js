const assert = require('assert');

(() => {
  const CabinetUI = require('./cabinet_ui');
  const { createPaytableController } = CabinetUI;

  function createClassList() {
    const values = new Set();
    return {
      add(value) {
        values.add(value);
      },
      remove(value) {
        values.delete(value);
      },
      has(value) {
        return values.has(value);
      }
    };
  }

  function createElement(dataset = {}) {
    const listeners = new Map();
    return {
      dataset: { ...dataset },
      attributes: {},
      hidden: false,
      innerHTML: '',
      offsetWidth: 1,
      classList: createClassList(),
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return this.attributes[name];
      },
      addEventListener(type, handler) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(handler);
      },
      trigger(type, event = {}) {
        const handlers = listeners.get(type) || [];
        handlers.forEach((handler) => handler({ currentTarget: this, preventDefault() { }, ...event }));
      },
      focus() {
        this.focused = true;
      }
    };
  }

  function runTest(name, fn) {
    fn();
    console.log(`PASS ${name}`);
  }

  function buildController() {
    const appEl = createElement({ paytableOpen: 'false' });
    const panelEl = createElement({ paytableTab: 'values' });
    const backdropEl = createElement();
    const toggleEl = createElement();
    const closeEl = createElement();
    const bodyEl = createElement();
    const scatterEl = createElement();
    const mapEl = createElement();
    const tabEls = [
      createElement({ paytableTab: 'values' }),
      createElement({ paytableTab: 'lines' })
    ];
    const viewEls = [
      createElement({ paytableView: 'values' }),
      createElement({ paytableView: 'lines' })
    ];
    const scheduleCalls = [];
    const controller = createPaytableController({
      appEl,
      panelEl,
      backdropEl,
      toggleEl,
      closeEl,
      bodyEl,
      scatterEl,
      mapEl,
      tabEls,
      viewEls,
      rows: 3,
      cols: 5,
      total: 15,
      symbols: [
        { name: 'S1', label: 'Ritratto 1', img: 'img/user1.png' },
        { name: 'S2', label: 'Ritratto 2', img: 'img/user2.png' }
      ],
      scatter: { name: 'BOOK', label: 'Libro', img: 'img/scatter.png' },
      paytable: {
        S1: { 5: 1200, 4: 240, 3: 24, 2: 2.4 },
        S2: { 5: 480, 4: 96, 3: 9.6, 2: 1.2 }
      },
      scatterPayout: { 5: 480, 4: 48, 3: 4.8 },
      baseFreeSpins: 12,
      defaultTab: 'values',
      animationMs: 220,
      getPaylines: () => [
        [0, 1, 2, 3, 4],
        [5, 6, 7, 8, 9]
      ],
      paylineColorForIndex: (index) => ['#f00', '#0f0'][index] || '#00f',
      symbolLabel: (symbol) => symbol.label || symbol.name,
      formatSymbolCardValue: (value) => String(value),
      symbolValueAccent: () => ({ accent: '#fff', glow: 'rgba(255,255,255,0.2)' }),
      symbolTierLabel: (index) => (index === 0 ? 'Top' : 'Alto'),
      scheduleLayout: () => scheduleCalls.push('layout'),
      prefersReducedMotion: () => true
    });
    return { controller, appEl, panelEl, backdropEl, toggleEl, closeEl, bodyEl, scatterEl, mapEl, tabEls, viewEls, scheduleCalls };
  }

  runTest('paytable: renderPaytable builds values, scatter and line map markup', () => {
    const { controller, bodyEl, scatterEl, mapEl } = buildController();
    controller.renderPaytable();

    assert.match(bodyEl.innerHTML, /Valori simboli/);
    assert.match(bodyEl.innerHTML, /Ritratto 1/);
    assert.match(scatterEl.innerHTML, /scegli un caveau/i);
    assert.match(mapEl.innerHTML, /Tutte le 2 linee sono sempre attive/);
    assert.match(mapEl.innerHTML, /payline-pattern-card/);
  });

  runTest('paytable: setTab updates selected button and visible panel', () => {
    const { controller, panelEl, tabEls, viewEls, scheduleCalls } = buildController();
    controller.setTab('lines', { focus: true });

    assert.strictEqual(panelEl.dataset.paytableTab, 'lines');
    assert.strictEqual(tabEls[0].getAttribute('aria-selected'), 'false');
    assert.strictEqual(tabEls[1].getAttribute('aria-selected'), 'true');
    assert.strictEqual(tabEls[1].focused, true);
    assert.strictEqual(viewEls[0].hidden, true);
    assert.strictEqual(viewEls[1].hidden, false);
    assert.strictEqual(scheduleCalls.length > 0, true);
  });

  runTest('paytable: setOpen toggles app and accessibility state', () => {
    const { controller, appEl, panelEl, backdropEl, toggleEl } = buildController();
    controller.setOpen(true);

    assert.strictEqual(appEl.dataset.paytableOpen, 'true');
    assert.strictEqual(panelEl.getAttribute('aria-hidden'), 'false');
    assert.strictEqual(backdropEl.getAttribute('aria-hidden'), 'false');
    assert.strictEqual(toggleEl.getAttribute('aria-expanded'), 'true');
  });

  runTest('paytable: bindEvents wires click handlers for tabs and open state', () => {
    const { controller, tabEls, toggleEl, closeEl, appEl } = buildController();
    controller.bindEvents();

    toggleEl.trigger('click');
    assert.strictEqual(appEl.dataset.paytableOpen, 'true');

    tabEls[1].trigger('click');
    assert.strictEqual(tabEls[1].getAttribute('aria-selected'), 'true');

    closeEl.trigger('click');
    assert.strictEqual(appEl.dataset.paytableOpen, 'false');
  });
})();

(() => {
  const CabinetUI = require('./cabinet_ui');
  const { createFeedbackUIController } = CabinetUI;

  function createClassList() {
    const values = new Set();
    return {
      add(...nextValues) {
        nextValues.forEach((value) => values.add(value));
      },
      remove(...nextValues) {
        nextValues.forEach((value) => values.delete(value));
      },
      has(value) {
        return values.has(value);
      }
    };
  }

  function createStyle() {
    return {
      setProperty(name, value) {
        this[name] = value;
      }
    };
  }

  function createElement(tagName = 'div') {
    const listeners = new Map();
    const element = {
      tagName: String(tagName).toUpperCase(),
      dataset: {},
      style: createStyle(),
      className: '',
      textContent: '',
      innerHTML: '',
      hidden: false,
      children: [],
      classList: createClassList(),
      parentElement: null,
      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
      },
      removeChild(child) {
        this.children = this.children.filter((entry) => entry !== child);
        if (child) child.parentElement = null;
        return child;
      },
      querySelector(selector) {
        if (selector === '.payout-badge') {
          return this.children.find((child) => child.className === 'payout-badge') || null;
        }
        if (selector && selector.startsWith('.')) {
          const className = selector.slice(1);
          const stack = [...this.children];
          while (stack.length) {
            const child = stack.shift();
            const classes = String(child.className || '').split(/\s+/).filter(Boolean);
            if (classes.includes(className)) return child;
            if (child.children && child.children.length) stack.push(...child.children);
          }
        }
        return null;
      },
      remove() {
        if (this.parentElement) this.parentElement.removeChild(this);
        this.removed = true;
      },
      setAttribute(name, value) {
        this[name] = String(value);
      },
      addEventListener(type, handler) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(handler);
      },
      trigger(type, event = {}) {
        const handlers = listeners.get(type) || [];
        handlers.forEach((handler) => handler({ currentTarget: this, target: this, preventDefault() { }, ...event }));
      },
      focus() {
        this.focused = true;
      },
      getBoundingClientRect() {
        return { left: 100, top: 50, width: 40, height: 40 };
      }
    };
    Object.defineProperty(element, 'firstChild', {
      get() {
        return this.children[0] || null;
      }
    });
    return element;
  }

  function createDocument(elementsById = {}) {
    const body = createElement('body');
    return {
      body,
      createElement(tagName) {
        return createElement(tagName);
      },
      createElementNS(namespace, tagName) {
        return createElement(tagName);
      },
      getElementById(id) {
        return elementsById[id] || null;
      }
    };
  }

  function runTest(name, fn) {
    fn();
    console.log(`PASS ${name}`);
  }

  async function runAsyncTest(name, fn) {
    await fn();
    console.log(`PASS ${name}`);
  }

  runTest('feedback: setCabinetNotice updates tone and clears through timer callback', () => {
    const timers = [];
    const cabinetNoticeEl = createElement('div');
    const controller = createFeedbackUIController({
      documentRef: createDocument(),
      cabinetNoticeEl,
      scheduleLayout: () => { timers.push('layout'); },
      setTimeoutRef: (handler) => {
        timers.push(handler);
        return timers.length;
      },
      clearTimeoutRef: () => { }
    });

    controller.setCabinetNotice('Bonus attivo', 'success', 1200);

    assert.strictEqual(cabinetNoticeEl.dataset.visible, 'true');
    assert.strictEqual(cabinetNoticeEl.dataset.tone, 'success');
    assert.strictEqual(cabinetNoticeEl.textContent, 'Bonus attivo');
    assert.strictEqual(timers.length >= 2, true);

    const clearTimer = timers.find((entry) => typeof entry === 'function');
    clearTimer();

    assert.strictEqual(cabinetNoticeEl.dataset.visible, 'false');
    assert.strictEqual(cabinetNoticeEl.dataset.tone, 'info');
    assert.strictEqual(cabinetNoticeEl.textContent, '');
  });

  runTest('feedback: syncCabinetLights follows runtime mode and attract state', () => {
    let inFreeSpins = false;
    let spinInProgress = false;
    const appEl = createElement('div');
    const intervals = [];
    const controller = createFeedbackUIController({
      documentRef: createDocument(),
      appEl,
      getInFreeSpins: () => inFreeSpins,
      getSpinInProgress: () => spinInProgress,
      setIntervalRef: (handler, delay) => {
        intervals.push({ handler, delay });
        return intervals.length;
      },
      clearIntervalRef: () => { }
    });

    controller.syncCabinetLights();
    assert.strictEqual(appEl.dataset.lightMode, 'normal');
    assert.strictEqual(appEl.dataset.lightPulse, 'idle');
    assert.strictEqual(appEl.dataset.winTier, 'base');
    assert.strictEqual(appEl.dataset.attract, 'left');
    assert.strictEqual(intervals[0].delay, 430);

    spinInProgress = true;
    controller.syncCabinetLights();
    assert.strictEqual(appEl.dataset.lightMode, 'spin');
    assert.strictEqual(appEl.dataset.lightPulse, 'reel');
    assert.strictEqual(appEl.dataset.attract, 'all');

    spinInProgress = false;
    inFreeSpins = true;
    controller.syncCabinetLights();
    assert.strictEqual(appEl.dataset.lightMode, 'freespins');
    assert.strictEqual(appEl.dataset.lightPulse, 'bonus');
    assert.strictEqual(appEl.dataset.winTier, 'bonus');
  });

  runTest('feedback: pulseCabinetWin accepts structured light overrides', () => {
    const appEl = createElement('div');
    const timers = [];
    const controller = createFeedbackUIController({
      documentRef: createDocument(),
      appEl,
      setTimeoutRef: (handler, delay) => {
        timers.push({ handler, delay });
        return timers.length;
      },
      clearTimeoutRef: () => { },
      setIntervalRef: () => 1,
      clearIntervalRef: () => { }
    });

    controller.pulseCabinetWin({ mode: 'bigwin', pulse: 'jackpot', tier: 'mega', duration: 2400 });

    assert.strictEqual(appEl.dataset.lightMode, 'bigwin');
    assert.strictEqual(appEl.dataset.lightPulse, 'jackpot');
    assert.strictEqual(appEl.dataset.winTier, 'mega');
    assert.strictEqual(appEl.dataset.attract, 'all');
    assert.strictEqual(timers[0].delay, 2400);

    timers[0].handler();

    assert.strictEqual(appEl.dataset.lightMode, 'normal');
    assert.strictEqual(appEl.dataset.lightPulse, 'idle');
  });

  runTest('feedback: pulseCabinetWin uses a jackpot default pulse for bigwin mode', () => {
    const appEl = createElement('div');
    const controller = createFeedbackUIController({
      documentRef: createDocument(),
      appEl,
      setTimeoutRef: () => 1,
      clearTimeoutRef: () => { },
      setIntervalRef: () => 1,
      clearIntervalRef: () => { }
    });

    controller.pulseCabinetWin('bigwin');

    assert.strictEqual(appEl.dataset.lightMode, 'bigwin');
    assert.strictEqual(appEl.dataset.lightPulse, 'jackpot');
    assert.strictEqual(appEl.dataset.winTier, 'big');
  });

  runTest('feedback: renderResultHighlights and markWinningCells decorate the winning cells', () => {
    const winDetailsEl = createElement('div');
    const cell0 = createElement('div');
    const cell1 = createElement('div');
    const cell2 = createElement('div');
    const img0 = createElement('img');
    const img1 = createElement('img');
    const img2 = createElement('img');
    cell0.appendChild(img0);
    cell1.appendChild(img1);
    cell2.appendChild(img2);
    const documentRef = createDocument({ 'img-0': img0, 'img-1': img1, 'img-2': img2 });
    const controller = createFeedbackUIController({
      documentRef,
      winDetailsEl,
      getGridCells: () => [cell0, cell1, cell2],
      getImageElByIndex: (index) => (index === 0 ? img0 : index === 1 ? img1 : img2),
      paylineColorForIndex: () => '#ff0000',
      getPaylineOverlayEl: () => null
    });

    const result = controller.renderResultHighlights({
      wins: [{
        paylineIndex: 0,
        symbol: 'Alice',
        count: 3,
        payout: 12.5,
        indices: [0, 1],
        highlightIndices: [0, 1],
        drawIndices: [0, 1]
      }],
      scatterWin: 0,
      finalScatter: 0,
      formatAmount: (value) => Number(value).toFixed(2)
    });

    assert.strictEqual(result.totalPayout, 12.5);
    assert.strictEqual(cell0.classList.has('payline'), true);
    assert.strictEqual(cell1.classList.has('payline'), true);
    assert.strictEqual(cell0.classList.has('is-muted'), false);
    assert.strictEqual(cell1.classList.has('is-muted'), false);
    assert.strictEqual(cell2.classList.has('is-muted'), true);
    assert.strictEqual(cell0.querySelector('.payout-badge').textContent, '12.50');
    assert.match(winDetailsEl.innerHTML, /Totale/);

    const firstWinIndex = controller.markWinningCells([{ highlightIndices: [0, 1] }]);
    assert.strictEqual(firstWinIndex, 0);
    assert.strictEqual(cell0.classList.has('win'), true);
    assert.strictEqual(cell1.classList.has('win'), true);

    controller.clearHighlights();
    assert.strictEqual(cell0.classList.has('win'), false);
    assert.strictEqual(cell0.classList.has('is-muted'), false);
    assert.strictEqual(cell1.classList.has('is-muted'), false);
    assert.strictEqual(cell2.classList.has('is-muted'), false);
    assert.strictEqual(cell0.querySelector('.payout-badge'), null);
  });


  runAsyncTest('feedback: resolveBonusPick opens the bonus modal and returns the selected package', async () => {
    const appEl = createElement('div');
    const featureStateTitleEl = createElement('div');
    const featureStateMetaEl = createElement('div');
    const showPlaqueStateEl = createElement('div');
    const windowRef = createElement('window');
    const documentRef = createDocument();
    const bonusDeck = [
      { id: 'vault-rush', title: 'Rush Vault', kicker: 'Long Play', freeSpins: 4, multiplier: 0.25, accent: '#ffd36b' },
      { id: 'vault-power', title: 'Power Vault', kicker: 'Power Ladder', freeSpins: 2, multiplier: 0.5, accent: '#79f1da' },
      { id: 'vault-sticky', title: 'Sticky Vault', kicker: 'Sticky Reel 5', freeSpins: 2, stickyWildColumns: [4], accent: '#ff9d63' }
    ];
    const controller = createFeedbackUIController({
      windowRef,
      documentRef,
      appEl,
      featureStateTitleEl,
      featureStateMetaEl,
      showPlaqueStateEl,
      getInFreeSpins: () => false,
      bonusRevealCount: 1,
      bonusBasePackage: {
        id: 'neon-vault',
        title: 'Neon Vault',
        kicker: 'Bonus Neon Vault',
        freeSpins: 8,
        multiplier: 1,
        stickyWildColumns: [],
        accent: '#ffd36b'
      },
      bonusPackages: bonusDeck,
      buildBonusPickDeck: () => bonusDeck,
      symbolLabel: (value) => value.label || value.name,
      setTimeoutRef: (handler) => {
        handler();
        return 1;
      },
      clearTimeoutRef: () => { },
      setIntervalRef: () => 1,
      clearIntervalRef: () => { }
    });

    const bonusPromise = controller.resolveBonusPick({
      source: 'button',
      freeSpinSymbol: { name: 'S2', label: 'Ritratto 2' },
      freeSpins: 12,
      multiplier: 1
    });
    const modal = documentRef.body.querySelector('.bonus-pick-modal');
    const grid = documentRef.body.querySelector('.bonus-pick-grid');
    const picks = [grid.children[0], grid.children[1], grid.children[2]];

    assert(modal);
    assert(grid);
    assert.strictEqual(grid.children.length, 3);
    assert.strictEqual(modal.hidden, false);
    assert.strictEqual(appEl.dataset.featureState, 'bonus-pick');
    assert.strictEqual(featureStateTitleEl.textContent, 'Bonus Neon Vault');
    assert.strictEqual(showPlaqueStateEl.textContent, 'Bonus Neon Vault');
    assert.match(featureStateMetaEl.textContent, /1 scelta/);

    picks[0].trigger('click');

    const selection = await bonusPromise;

    assert.strictEqual(selection.title, 'Neon Vault Rush');
    assert.strictEqual(selection.freeSpins, 12);
    assert.strictEqual(selection.multiplier, 1.25);
    assert.deepStrictEqual(selection.stickyWildColumns, []);
    assert.strictEqual(modal.hidden, true);
    assert.strictEqual(appEl.dataset.featureState, 'free-spins');
    assert.strictEqual(featureStateTitleEl.textContent, 'Giri Gratis Attivi');
    assert.strictEqual(showPlaqueStateEl.textContent, 'Giri Gratis Attivi');
    assert.match(featureStateMetaEl.textContent, /12 Giri/);
    assert.match(featureStateMetaEl.textContent, /x1\.25/);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
})();

(() => {
  const RuntimeUI = require('./runtime_ui');
  const { createRuntimeUIController } = RuntimeUI;

  function runTest(name, fn) {
    fn();
    console.log(`PASS ${name}`);
  }

  function createClassList() {
    const values = new Set();
    return {
      add(...entries) {
        entries.forEach((entry) => values.add(entry));
      },
      remove(...entries) {
        entries.forEach((entry) => values.delete(entry));
      },
      has(entry) {
        return values.has(entry);
      }
    };
  }

  function createElement() {
    return {
      textContent: '',
      dataset: {},
      classList: createClassList(),
      offsetWidth: 42
    };
  }

  runTest('runtime ui: initializeRuntimeUI syncs meters, paytable and bindings', () => {
    const calls = [];
    const appEl = createElement();
    const balanceEl = createElement();
    const activeBetEl = createElement();
    const modeEl = createElement();
    const fsEl = createElement();
    const featureStateTitleEl = createElement();
    const featureStateMetaEl = createElement();
    const showPlaqueStateEl = createElement();
    const betDisplayEl = createElement();
    const autoSpinButtonEl = createElement();
    const autoStatusEl = createElement();
    const collectMeterEl = createElement();
    const sessionHitRateEl = createElement();
    const sessionBestWinEl = createElement();
    const sessionStreakEl = createElement();
    const cells = [{ dataset: { special: 'true' } }, { dataset: { special: 'true' } }];

    const controller = createRuntimeUIController({
      autoSpinState: { enabled: true, remaining: 25, delayMs: 700 },
      defaultPaytableTab: 'values',
      appEl,
      balanceEl,
      activeBetEl,
      modeEl,
      fsEl,
      featureStateTitleEl,
      featureStateMetaEl,
      showPlaqueStateEl,
      betDisplayEl,
      autoSpinButtonEl,
      autoStatusEl,
      collectMeterEl,
      sessionHitRateEl,
      sessionBestWinEl,
      sessionStreakEl,
      getBalance: () => 88.8,
      currentFeatureBet: () => 2.5,
      getInFreeSpins: () => false,
      getFreeSpins: () => 0,
      getBetPerSpin: () => 1.2,
      getLastCollectedWin: () => 7.4,
      getSessionStats: () => ({ hitRateLabel: '42%', bestWin: 12.6, streakLabel: 'Miss x3' }),
      getGridCells: () => cells,
      restoreCabinetState: () => { calls.push('restore'); return true; },
      persistCabinetState: () => { calls.push('persist'); return true; },
      updateAmbientToggleUI: () => calls.push('ambient-toggle'),
      syncAmbientMood: () => calls.push('ambient-mood'),
      formatAmount: (value) => Number(value).toFixed(2),
      getPaytableUI: () => ({
        renderPaytable: () => calls.push('render-paytable'),
        setTab: (tab) => calls.push(`tab:${tab}`),
        setOpen: (open) => calls.push(`open:${open}`)
      }),
      getFeedbackUI: () => ({
        syncCabinetLights: () => calls.push('lights')
      }),
      getViewportFit: () => ({
        bindEvents: () => calls.push('viewport-bind'),
        schedule: () => calls.push('viewport-schedule')
      }),
      getRuntimeBindings: () => ({
        bindControlEvents: () => calls.push('bind-controls'),
        bindLifecycleEvents: () => calls.push('bind-lifecycle')
      }),
      getSpinRuntime: () => ({
        syncControlLockState: () => calls.push('sync-lock')
      })
    });

    controller.initializeRuntimeUI();

    assert.strictEqual(balanceEl.textContent, '88.80');
    assert.strictEqual(activeBetEl.textContent, '2.50');
    assert.strictEqual(modeEl.textContent, 'Base');
    assert.strictEqual(fsEl.textContent, '0');
    assert.strictEqual(appEl.dataset.featureState, 'base');
    assert.strictEqual(featureStateTitleEl.textContent, 'Gioco Base');
    assert.strictEqual(showPlaqueStateEl.textContent, 'Gioco Base');
    assert.strictEqual(featureStateMetaEl.textContent, '25 linee attive');
    assert.strictEqual(betDisplayEl.textContent, '1.20');
    assert.strictEqual(autoSpinButtonEl.textContent, 'Ferma Auto');
    assert.strictEqual(autoStatusEl.textContent, '25');
    assert.strictEqual(collectMeterEl.textContent, '7.40');
    assert.strictEqual(sessionHitRateEl.textContent, '42%');
    assert.strictEqual(sessionBestWinEl.textContent, '12.60');
    assert.strictEqual(sessionStreakEl.textContent, 'Miss x3');
    assert.deepStrictEqual(cells.map((cell) => cell.dataset.special), ['false', 'false']);
    assert.deepStrictEqual(cells.map((cell) => cell.dataset.sticky), ['false', 'false']);
    assert.deepStrictEqual(calls, [
      'restore',
      'lights',
      'ambient-toggle',
      'render-paytable',
      'tab:values',
      'open:false',
      'sync-lock',
      'lights',
      'ambient-mood',
      'persist',
      'bind-controls',
      'viewport-bind',
      'bind-lifecycle',
      'viewport-schedule'
    ]);
  });

  runTest('runtime ui: updateUI exposes bonus and free-spin states in the persistent banner', () => {
    const appEl = createElement();
    const modeEl = createElement();
    const fsEl = createElement();
    const featureStateTitleEl = createElement();
    const featureStateMetaEl = createElement();
    const showPlaqueStateEl = createElement();

    let bonusPickOpen = true;
    let inFreeSpins = false;
    let freeSpins = 8;
    let bonusMultiplier = 1;
    let stickyWildColumns = [];

    const controller = createRuntimeUIController({
      appEl,
      modeEl,
      fsEl,
      featureStateTitleEl,
      featureStateMetaEl,
      showPlaqueStateEl,
      getInFreeSpins: () => inFreeSpins,
      getFreeSpins: () => freeSpins,
      getBonusMultiplier: () => bonusMultiplier,
      getFeatureState: () => ({ stickyWildColumns }),
      getFeedbackUI: () => ({
        isBonusPickOpen: () => bonusPickOpen,
        syncCabinetLights: () => { }
      })
    });

    controller.updateUI();
    assert.strictEqual(modeEl.textContent, 'Bonus');
    assert.strictEqual(appEl.dataset.featureState, 'bonus-pick');
    assert.strictEqual(featureStateTitleEl.textContent, 'Bonus Neon Vault');
    assert.strictEqual(showPlaqueStateEl.textContent, 'Bonus Neon Vault');
    assert.match(featureStateMetaEl.textContent, /Scegli un caveau/);

    bonusPickOpen = false;
    inFreeSpins = true;
    freeSpins = 6;
    bonusMultiplier = 1.5;
    stickyWildColumns = [4];

    controller.updateUI();
    assert.strictEqual(modeEl.textContent, 'Giri Gratis');
    assert.strictEqual(fsEl.textContent, '6');
    assert.strictEqual(appEl.dataset.featureState, 'free-spins');
    assert.strictEqual(featureStateTitleEl.textContent, 'Giri Gratis Attivi');
    assert.strictEqual(showPlaqueStateEl.textContent, 'Giri Gratis Attivi');
    assert.match(featureStateMetaEl.textContent, /6 rimasti/);
    assert.match(featureStateMetaEl.textContent, /x1\.50/);
    assert.match(featureStateMetaEl.textContent, /1 sticky reel/);
  });

  runTest('runtime ui: animateLeverPull triggers sound and clears the pulled class after the timer', () => {
    const timers = [];
    let cleared = 0;
    let leverSounds = 0;
    const spinLeverEl = createElement();
    const controller = createRuntimeUIController({
      spinLeverEl,
      playLeverSound: () => { leverSounds += 1; },
      setTimeoutRef: (handler, delay) => {
        timers.push({ handler, delay });
        return timers.length;
      },
      clearTimeoutRef: () => { cleared += 1; }
    });

    controller.animateLeverPull();

    assert.strictEqual(spinLeverEl.classList.has('is-pulled'), true);
    assert.strictEqual(leverSounds, 1);
    assert.deepStrictEqual(timers.map((entry) => entry.delay), [400]);

    timers[0].handler();

    assert.strictEqual(spinLeverEl.classList.has('is-pulled'), false);
    assert.strictEqual(cleared, 0);
  });

  runTest('runtime ui: spin runtime helpers proxy through the injected controller getters', () => {
    const scheduled = [];
    const controller = createRuntimeUIController({
      autoSpinState: { enabled: false, remaining: 0, delayMs: 700 },
      getSpinRuntime: () => ({
        isSpinControlLocked: () => true,
        canAutoSpinStart: () => false,
        clearAutoSpinTimer: () => scheduled.push('clear'),
        scheduleAutoSpinTick: (delay) => scheduled.push(delay)
      })
    });

    assert.strictEqual(controller.isSpinControlLocked(), true);
    assert.strictEqual(controller.canAutoSpinStart(), false);
    controller.clearAutoSpinTimer();
    controller.scheduleAutoSpinTick();

    assert.deepStrictEqual(scheduled, ['clear', 700]);
  });
})();

(() => {
  const SlotRenderer = require('./slot_renderer');
  const { createSlotRendererController } = SlotRenderer;

  function createStyle() {
    return {
      setProperty(name, value) {
        this[name] = value;
      },
      removeProperty(name) {
        delete this[name];
      }
    };
  }

  function createElement(tagName = 'div') {
    return {
      tagName: String(tagName).toUpperCase(),
      className: '',
      dataset: {},
      style: createStyle(),
      children: [],
      parentElement: null,
      innerHTML: '',
      src: '',
      alt: '',
      title: '',
      appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
      },
      setAttribute(name, value) {
        this.attributes = this.attributes || {};
        this.attributes[name] = String(value);
      },
      querySelector(selector) {
        if (selector === '.symbol-face') return this.children.find((child) => child.className === 'symbol-face') || null;
        if (selector === '.spin-ghost') return this.children.find((child) => child.className === 'spin-ghost') || null;
        return null;
      },
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 100, height: 100 };
      }
    };
  }

  function createDocument() {
    return {
      documentElement: {},
      createElement(tagName) {
        return createElement(tagName);
      }
    };
  }

  async function runAsyncTest(name, fn) {
    await fn();
    console.log(`PASS ${name}`);
  }

  async function main() {
    await runAsyncTest('slot renderer: buildGrid creates cells, faces and ghosts with default symbols', async () => {
      const slotEl = createElement('div');
      const themeCalls = [];
      const renderer = createSlotRendererController({
        documentRef: createDocument(),
        slotEl,
        total: 4,
        cols: 2,
        symbols: [
          { name: 'S1', label: 'Uno', img: 'img/u1.png' },
          { name: 'S2', label: 'Due', img: 'img/u2.png' }
        ],
        symbolLabel: (sym) => sym.label,
        decorateCellTheme: (cell, sym) => themeCalls.push({ cell, sym })
      });

      renderer.buildGrid();

      assert.strictEqual(renderer.getCells().length, 4);
      assert.strictEqual(renderer.getFaces().length, 4);
      assert.strictEqual(renderer.getGhosts().length, 4);
      assert.strictEqual(slotEl.children.length, 4);
      assert.strictEqual(renderer.getFaces()[0].src, 'img/u1.png');
      assert.strictEqual(renderer.getFaces()[1].src, 'img/u2.png');
      assert.strictEqual(renderer.getFaces()[0].alt, 'Uno');
      assert.strictEqual(themeCalls.length, 4);
    });

    await runAsyncTest('slot renderer: syncCellSymbol updates face and ghost metadata', async () => {
      const slotEl = createElement('div');
      const renderer = createSlotRendererController({
        documentRef: createDocument(),
        slotEl,
        total: 1,
        cols: 1,
        symbols: [{ name: 'S1', label: 'Uno', img: 'img/u1.png' }],
        symbolLabel: (sym) => sym.label
      });
      renderer.buildGrid();
      const cell = renderer.getCells()[0];

      renderer.syncCellSymbol(cell, { name: 'BOOK', label: 'Libro', img: 'img/book.png', isScatter: true });
      renderer.syncGhostFromFace(cell);
      renderer.resetSpinGhostStyles(cell);

      const face = renderer.getFaces()[0];
      const ghost = renderer.getGhosts()[0];
      assert.strictEqual(face.dataset.symbolName, 'BOOK');
      assert.strictEqual(face.src, 'img/book.png');
      assert.strictEqual(face.alt, 'Libro');
      assert.strictEqual(ghost.dataset.symbolName, 'BOOK');
      assert.strictEqual(ghost.src, 'img/book.png');
    });

    await runAsyncTest('slot renderer: animateTumble updates transforms and resolves', async () => {
      const slotEl = createElement('div');
      const renderer = createSlotRendererController({
        documentRef: createDocument(),
        slotEl,
        total: 2,
        cols: 2,
        symbols: [
          { name: 'S1', label: 'Uno', img: 'img/u1.png' },
          { name: 'S2', label: 'Due', img: 'img/u2.png' }
        ],
        getComputedStyleRef: () => ({ getPropertyValue: () => '96' }),
        setTimeoutRef: (handler) => {
          handler();
          return 1;
        }
      });
      renderer.buildGrid();

      await renderer.animateTumble(
        [
          { name: 'S2', label: 'Due', img: 'img/u2.png' },
          { name: 'S1', label: 'Uno', img: 'img/u1.png' }
        ],
        [1, 2],
        [true, false]
      );

      assert.strictEqual(renderer.getFaces()[0].style.transform, 'translateY(0)');
      assert.strictEqual(renderer.getFaces()[0].style.opacity, '1');
      assert.match(renderer.getFaces()[0].style.transition, /transform 900ms/);
    });

    console.log('All slot renderer tests passed.');
  }

  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
})();

(() => {
  const SlotAudio = require('./slot_audio');
  const { createSlotAudioController } = SlotAudio;

  function createButton() {
    return {
      disabled: true,
      textContent: '',
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return this.attributes[name];
      }
    };
  }

  function createEventTarget() {
    const listeners = [];
    return {
      listeners,
      addEventListener(type, handler, options) {
        listeners.push({ type, handler, options });
      }
    };
  }

  function runTest(name, fn) {
    fn();
    console.log(`PASS ${name}`);
  }

  runTest('slot audio: ambient toggle UI reflects enabled state', () => {
    const button = createButton();
    const controller = createSlotAudioController({
      ambientToggleEl: button,
      eventTarget: createEventTarget()
    });

    controller.updateAmbientToggleUI();

    assert.strictEqual(button.disabled, false);
    assert.strictEqual(button.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(button.textContent, 'Attivo');
  });

  runTest('slot audio: setAmbientEnabled updates state and notifies through showFloat', () => {
    const button = createButton();
    const messages = [];
    const controller = createSlotAudioController({
      ambientToggleEl: button,
      eventTarget: createEventTarget(),
      showFloat: (text, ttl) => messages.push({ text, ttl })
    });

    controller.setAmbientEnabled(false, true);

    assert.strictEqual(controller.isAmbientEnabled(), false);
    assert.strictEqual(button.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(button.textContent, 'Spento');
    assert.deepStrictEqual(messages, [{ text: 'Ambiente: spento', ttl: 900 }]);
  });

  runTest('slot audio: bindFirstGestureBootstrap registers one bootstrap listener per gesture', () => {
    const eventTarget = createEventTarget();
    const controller = createSlotAudioController({ eventTarget });

    controller.bindFirstGestureBootstrap();
    controller.bindFirstGestureBootstrap();

    assert.strictEqual(eventTarget.listeners.length, 4);
    assert.deepStrictEqual(eventTarget.listeners.map((entry) => entry.type), ['click', 'pointerdown', 'keydown', 'touchstart']);
    eventTarget.listeners.forEach((entry) => entry.handler());
  });

  runTest('slot audio: spin SFX toggle reflects the current enabled state', () => {
    const controller = createSlotAudioController({ eventTarget: createEventTarget() });

    controller.setSpinSfxEnabled(false);
    assert.strictEqual(controller.isSpinSfxEnabled(), false);

    controller.setSpinSfxEnabled(true);
    assert.strictEqual(controller.isSpinSfxEnabled(), true);
  });

  console.log('All slot audio tests passed.');
})();

(() => {
  const ViewportFit = require('./viewport_fit');
  const { createViewportFitController } = ViewportFit;

  function runTest(name, fn) {
    fn();
    console.log(`PASS ${name}`);
  }

  runTest('viewport fit: getScale returns 1 below the desktop threshold', () => {
    const appEl = {
      style: { zoom: '1' },
      offsetWidth: 1600,
      scrollWidth: 1600,
      offsetHeight: 900,
      scrollHeight: 900
    };
    const controller = createViewportFitController({
      appEl,
      windowRef: { innerWidth: 1000, innerHeight: 800 },
      documentRef: { body: {} },
      getComputedStyleRef: () => ({ paddingLeft: '0', paddingRight: '0', paddingTop: '0', paddingBottom: '0' })
    });

    assert.strictEqual(controller.getScale(), 1);
  });

  runTest('viewport fit: getScale shrinks oversized layouts on wide screens', () => {
    const appEl = {
      style: { zoom: '1' },
      offsetWidth: 1500,
      scrollWidth: 1500,
      offsetHeight: 1000,
      scrollHeight: 1000
    };
    const controller = createViewportFitController({
      appEl,
      windowRef: { innerWidth: 1200, innerHeight: 900 },
      documentRef: { body: {} },
      getComputedStyleRef: () => ({ paddingLeft: '20', paddingRight: '20', paddingTop: '10', paddingBottom: '10' })
    });

    const scale = controller.getScale();
    assert(scale < 1);
    assert(scale > 0);
  });

  runTest('viewport fit: schedule uses the provided animation frame hooks', () => {
    const appEl = {
      style: { zoom: '1' },
      offsetWidth: 1500,
      scrollWidth: 1500,
      offsetHeight: 1000,
      scrollHeight: 1000
    };
    let frameId = 0;
    let scheduled = 0;
    const controller = createViewportFitController({
      appEl,
      windowRef: { innerWidth: 1200, innerHeight: 900 },
      documentRef: { body: {} },
      getComputedStyleRef: () => ({ paddingLeft: '0', paddingRight: '0', paddingTop: '0', paddingBottom: '0' }),
      requestFrame: (cb) => {
        scheduled += 1;
        cb();
        frameId += 1;
        return frameId;
      },
      cancelFrame: () => { }
    });

    controller.schedule();

    assert.strictEqual(scheduled, 1);
    assert.notStrictEqual(appEl.style.zoom, '1');
  });

  console.log('All viewport fit tests passed.');
})();

(() => {
  const SlotRenderer = require('./slot_renderer');
  const { createSlotRendererController } = SlotRenderer;

  class FakeImage {
    constructor() {
      this.src = '';
    }
  }

  function runTest(name, fn) {
    fn();
    console.log(`PASS ${name}`);
  }

  runTest('slot renderer: getEffectiveWeightedSymbols boosts scatter weight when ante is active', () => {
    let anteOn = false;
    const controller = createSlotRendererController({
      symbols: [{ name: 'S1' }, { name: 'S2' }],
      scatter: { name: 'BOOK', isScatter: true },
      buildWeightedSymbols: () => [
        { sym: { name: 'S1' }, weight: 2 },
        { sym: { name: 'BOOK', isScatter: true }, weight: 3 }
      ],
      cloneSymbol: (symbol) => ({ ...symbol }),
      getAnteOn: () => anteOn,
      anteScatterBoost: 4
    });

    const base = controller.getEffectiveWeightedSymbols();
    anteOn = true;
    const boosted = controller.getEffectiveWeightedSymbols();

    assert.strictEqual(base[1].weight, 3);
    assert.strictEqual(boosted[1].weight, 12);
    assert.strictEqual(boosted[0].weight, 2);
  });

  runTest('slot renderer: preloadImages caches every url only once', () => {
    const controller = createSlotRendererController({
      preloadUrls: ['img/a.png', 'img/b.png', 'img/a.png'],
      ImageCtor: FakeImage
    });

    const cache = controller.preloadImages();
    controller.preloadImages();

    assert.strictEqual(cache.size, 2);
    assert.strictEqual(cache.get('img/a.png').src, 'img/a.png');
    assert.strictEqual(cache.get('img/b.png').src, 'img/b.png');
  });

  runTest('slot renderer: buildReelsFinal initializes strips lazily and uses injected core helpers', () => {
    const calls = {
      init: [],
      build: []
    };
    const strips = [['A'], ['B'], ['C'], ['D'], ['E']];
    const controller = createSlotRendererController({
      symbols: [{ name: 'S1' }],
      scatter: { name: 'BOOK', isScatter: true },
      symbolWeights: [2],
      scatterWeight: 1.5,
      buildWeightedSymbols: (options) => [
        { sym: options.symbols[0], weight: options.symbolWeights[0] },
        { sym: options.scatter, weight: options.scatterWeight }
      ],
      cloneSymbol: (symbol) => ({ ...symbol }),
      initReelStrips: (weighted, options) => {
        calls.init.push({ weighted, options });
        return strips;
      },
      buildReelsFinal: (rng, reelStrips, options) => {
        calls.build.push({ rng, reelStrips, options });
        return { final: ['ok'], starts: [1] };
      },
      rng: () => 0.25,
      rows: 3,
      cols: 5,
      stripLength: 256,
      reelStripSteps: [1, 2, 3, 4, 5],
      reelStripOffsets: [5, 4, 3, 2, 1]
    });

    const result = controller.buildReelsFinal();

    assert.deepStrictEqual(result, { final: ['ok'], starts: [1] });
    assert.strictEqual(calls.init.length, 1);
    assert.strictEqual(calls.build.length, 1);
    assert.strictEqual(calls.build[0].reelStrips, strips);
    assert.deepStrictEqual(calls.build[0].options, { rows: 3, cols: 5 });
  });

  runTest('slot renderer: pickFreeSpinSymbol forwards rng and symbol list', () => {
    const symbols = [{ name: 'S1' }, { name: 'S2' }];
    const controller = createSlotRendererController({
      symbols,
      pickFreeSpinSymbol: (rng, list) => ({ rngValue: rng(), symbol: list[1] }),
      rng: () => 0.75
    });

    const picked = controller.pickFreeSpinSymbol();

    assert.deepStrictEqual(picked, { rngValue: 0.75, symbol: symbols[1] });
  });

  console.log('All slot renderer tests passed.');
})();

(() => {
  const RuntimeUI = require('./runtime_ui');
  const { createRuntimeBindingsController } = RuntimeUI;

  function createEventTarget(initialState = {}) {
    const listeners = new Map();
    return {
      ...initialState,
      addEventListener(type, handler) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(handler);
      },
      trigger(type, event = {}) {
        const handlers = listeners.get(type) || [];
        handlers.forEach((handler) => handler({ currentTarget: this, preventDefault() { }, ...event }));
      }
    };
  }

  function createButton() {
    return createEventTarget({ disabled: false });
  }

  function runTest(name, fn) {
    fn();
    console.log(`PASS ${name}`);
  }

  runTest('runtime bindings: control bindings wire speed, auto, bet and lever actions', () => {
    const documentRef = createEventTarget({ hidden: false });
    const windowRef = createEventTarget();
    const speedSlowEl = createButton();
    const speedNormalEl = createButton();
    const speedFastEl = createButton();
    const ambientToggleEl = createButton();
    const autoPreset25El = createButton();
    const spinButtonControlEl = createButton();
    const autoSpinButtonEl = createButton();
    const betPlusEl = createButton();
    const betMinusEl = createButton();
    const spinLeverEl = createButton();
    const timings = {
      baseDuration: 820,
      perReelDelay: 220,
      perReelExtra: 160,
      cycleInterval: 140,
      fastSwipe: 260,
      settle: 420
    };
    const autoSpinState = { enabled: false, remaining: 0, delayMs: 700 };
    const floatMessages = [];
    const ambientCalls = [];
    const autoSpinCalls = [];
    const spinCalls = [];
    const betCalls = [];
    let autoToggleCalls = 0;
    let paytableBindCalls = 0;
    let locked = true;

    const controller = createRuntimeBindingsController({
      documentRef,
      windowRef,
      paytableUI: { bindEvents() { paytableBindCalls += 1; } },
      autoSpinState,
      getTimings: () => timings,
      showFloat: (text, ttl) => floatMessages.push({ text, ttl }),
      setAmbientEnabled: (enabled, notify) => ambientCalls.push({ enabled, notify }),
      isAmbientEnabled: () => false,
      startAutoSpin: (count) => autoSpinCalls.push(count),
      toggleAutoSpin: () => { autoToggleCalls += 1; },
      spin: (options) => spinCalls.push(options),
      isSpinControlLocked: () => locked,
      increaseBet: () => betCalls.push('plus'),
      decreaseBet: () => betCalls.push('minus'),
      speedSlowEl,
      speedNormalEl,
      speedFastEl,
      ambientToggleEl,
      autoPreset25El,
      spinButtonControlEl,
      autoSpinButtonEl,
      betPlusEl,
      betMinusEl,
      spinLeverEl
    });

    controller.bindControlEvents();

    speedFastEl.trigger('click');
    ambientToggleEl.trigger('click');
    autoPreset25El.trigger('click');
    spinButtonControlEl.trigger('click');
    autoSpinButtonEl.trigger('click');
    betPlusEl.trigger('click');
    betMinusEl.trigger('click');
    spinLeverEl.trigger('click');
    locked = false;
    spinLeverEl.trigger('click');

    assert.strictEqual(timings.baseDuration, 560);
    assert.strictEqual(timings.settle, 300);
    assert.strictEqual(autoSpinState.delayMs, 560);
    assert.deepStrictEqual(floatMessages[0], { text: 'Velocita: Rapida', ttl: 800 });
    assert.deepStrictEqual(ambientCalls, [{ enabled: true, notify: true }]);
    assert.deepStrictEqual(autoSpinCalls, [25]);
    assert.deepStrictEqual(spinCalls, [{ source: 'button' }, { source: 'lever' }]);
    assert.strictEqual(autoToggleCalls, 1);
    assert.deepStrictEqual(betCalls, ['plus', 'minus']);
    assert.strictEqual(paytableBindCalls, 1);
  });

  runTest('runtime bindings: lifecycle bindings persist on hide and restore on visibility', () => {
    const documentRef = createEventTarget({ hidden: true });
    const windowRef = createEventTarget();
    const calls = {
      persist: 0,
      stopAttractMode: [],
      stopAmbientSound: [],
      startAmbientSound: 0,
      syncCabinetLights: 0,
      syncAmbientMood: 0,
      setPaytableOpen: []
    };
    const controller = createRuntimeBindingsController({
      documentRef,
      windowRef,
      persistCabinetState: () => { calls.persist += 1; },
      stopAttractMode: (value) => calls.stopAttractMode.push(value),
      stopAmbientSound: (value) => calls.stopAmbientSound.push(value),
      startAmbientSound: () => { calls.startAmbientSound += 1; },
      isAmbientEnabled: () => true,
      syncCabinetLights: () => { calls.syncCabinetLights += 1; },
      syncAmbientMood: () => { calls.syncAmbientMood += 1; },
      setPaytableOpen: (value) => calls.setPaytableOpen.push(value)
    });

    controller.bindLifecycleEvents();

    documentRef.trigger('visibilitychange');
    documentRef.hidden = false;
    documentRef.trigger('visibilitychange');
    windowRef.trigger('pagehide');
    windowRef.trigger('beforeunload');
    windowRef.trigger('keydown', { key: 'Escape' });

    assert.strictEqual(calls.persist, 3);
    assert.deepStrictEqual(calls.stopAttractMode, ['off']);
    assert.deepStrictEqual(calls.stopAmbientSound, [220]);
    assert.strictEqual(calls.startAmbientSound, 1);
    assert.strictEqual(calls.syncCabinetLights, 1);
    assert.strictEqual(calls.syncAmbientMood, 1);
    assert.deepStrictEqual(calls.setPaytableOpen, [false]);
  });

  console.log('All runtime bindings tests passed.');
})();
