const assert = require('assert');
const SpinRuntime = require('./spin_runtime');

const { createSpinRuntimeController } = SpinRuntime;

function createButton() {
  return { disabled: false };
}

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

function createStyle() {
  return {
    removeProperty(name) {
      delete this[name];
    }
  };
}

async function runTest(name, fn) {
  await fn();
  console.log(`PASS ${name}`);
}

async function main() {
  await runTest('syncControlLockState disables bet and auto controls coherently', async () => {
  const spinButtonControlEl = createButton();
  const betMinusEl = createButton();
  const betPlusEl = createButton();
  const autoSpinButtonEl = createButton();
  const autoPresetEls = [createButton(), createButton()];
  const autoSpinState = { enabled: false, remaining: 0, delayMs: 700, timeoutId: 0 };

  const controller = createSpinRuntimeController({
    autoSpinState,
    getBalance: () => 0.2,
    getCurrentSpinCost: () => 1,
    getBetPerSpin: () => 0.1,
    getInFreeSpins: () => false,
    minBet: 0.1,
    maxBet: 1000,
    spinButtonControlEl,
    betMinusEl,
    betPlusEl,
    autoSpinButtonEl,
    autoPresetEls
  });

  controller.syncControlLockState();

  assert.strictEqual(spinButtonControlEl.disabled, false);
  assert.strictEqual(betMinusEl.disabled, true);
  assert.strictEqual(betPlusEl.disabled, false);
  assert.strictEqual(autoSpinButtonEl.disabled, true);
  assert.strictEqual(autoPresetEls[0].disabled, true);
  assert.strictEqual(autoPresetEls[1].disabled, true);
  });

  await runTest('startAutoSpin enables auto mode, shows notice and schedules a tick', async () => {
  const autoSpinState = { enabled: false, remaining: 0, delayMs: 700, timeoutId: 0 };
  const notices = [];
  const timers = [];
  let updateUICalls = 0;
  const controller = createSpinRuntimeController({
    autoSpinState,
    getBalance: () => 50,
    getCurrentSpinCost: () => 1,
    getBetPerSpin: () => 1,
    getInFreeSpins: () => false,
    setCabinetNotice: (message, tone, ttl) => notices.push({ message, tone, ttl }),
    updateUI: () => { updateUICalls += 1; },
    setTimeoutRef: (handler, delay) => {
      timers.push({ handler, delay });
      return timers.length;
    },
    clearTimeoutRef: () => { }
  });

  const started = controller.startAutoSpin(25);

  assert.strictEqual(started, true);
  assert.strictEqual(autoSpinState.enabled, true);
  assert.strictEqual(autoSpinState.remaining, 25);
  assert.deepStrictEqual(notices[0], { message: 'Auto attiva: 25 giri.', tone: 'info', ttl: 1400 });
  assert.strictEqual(updateUICalls, 1);
  assert.strictEqual(timers[0].delay, 700);
  });

  await runTest('spin aborts cleanly when credits are insufficient', async () => {
  const notices = [];
  let updateUICalls = 0;
  const controller = createSpinRuntimeController({
    getBalance: () => 0.5,
    setBalance: () => { throw new Error('setBalance should not be called'); },
    getCurrentSpinCost: () => 1,
    getFeatureState: () => ({ inFreeSpins: false }),
    getSpinContext: () => ({ startedInFreeSpins: false, spinStake: 1 }),
    getInFreeSpins: () => false,
    getBetPerSpin: () => 1,
    setCabinetNotice: (message, tone, ttl) => notices.push({ message, tone, ttl }),
    clearHighlights: () => { },
    resetCoinTray: () => { },
    syncCabinetLights: () => { },
    updateUI: () => { updateUICalls += 1; },
    buildReelsFinal: () => {
      throw new Error('buildReelsFinal should not be called');
    }
  });

  const completed = await controller.spin({ source: 'button' });

  assert.strictEqual(completed, false);
  assert.strictEqual(controller.isSpinInProgress(), false);
  assert.deepStrictEqual(notices[1], { message: 'Crediti insufficienti per questo giro.', tone: 'warning', ttl: 2200 });
  assert.strictEqual(updateUICalls >= 1, true);
  });

  await runTest('spin credits the base win directly without opening a gamble step', async () => {
  let balance = 20;
  let lastCollectedWin = -1;
  const sessionSpinResults = [];
  const controller = createSpinRuntimeController({
    getBalance: () => balance,
    setBalance: (value) => { balance = value; },
    getCurrentSpinCost: () => 2,
    getFeatureState: () => ({ inFreeSpins: false }),
    getSpinContext: () => ({ startedInFreeSpins: false, spinStake: 2 }),
    getInFreeSpins: () => false,
    getBetPerSpin: () => 2,
    setLastCollectedWin: (value) => { lastCollectedWin = value; },
    clearHighlights: () => { },
    resetCoinTray: () => { },
    syncCabinetLights: () => { },
    updateUI: () => { },
    buildReelsFinal: () => ({ final: ['A'], starts: [0] }),
    evaluateSpin: async () => ({ win: 4, finalScatter: 0, wins: [{ highlightIndices: [0] }], scatterWin: 0 }),
    advanceFeatureState: (state) => ({ ...state, bonusTriggered: false, retriggerTriggered: false }),
    renderResultHighlights: () => { },
    markWinningCells: () => 0,
    getCellCenter: () => ({ x: 0, y: 0 }),
    spawnCoinParticles: () => { },
    playSmallWinSound: () => { },
    showFloat: () => { },
    runCoinTrayDispense: () => { },
    recordSessionSpinResult: (result) => { sessionSpinResults.push(result); }
  });

  const completed = await controller.spin({ source: 'button' });

  assert.strictEqual(completed, true);
  assert.deepStrictEqual(sessionSpinResults, [{
    baseWin: 4,
    collectedWin: 4,
    source: 'button',
    startedInFreeSpins: false
  }]);
  assert.strictEqual(balance, 22);
  assert.strictEqual(lastCollectedWin, 4);
  });

  await runTest('spin applies the selected bonus package when scatters trigger the feature', async () => {
  let featureState = {
    inFreeSpins: false,
    freeSpins: 0,
    featureBet: null,
    freeSpinSymbol: null,
    bonusMultiplier: 1,
    stickyWildColumns: []
  };
  const bonusCalls = [];
  const controller = createSpinRuntimeController({
    getBalance: () => 20,
    setBalance: () => { },
    getCurrentSpinCost: () => 1,
    getFeatureState: () => featureState,
    setFeatureState: (nextState) => { featureState = { ...featureState, ...nextState }; return featureState; },
    getSpinContext: () => ({ startedInFreeSpins: false, spinStake: 1 }),
    getInFreeSpins: () => featureState.inFreeSpins,
    getFreeSpinSymbol: () => featureState.freeSpinSymbol,
    getBonusMultiplier: () => featureState.bonusMultiplier,
    getBetPerSpin: () => 1,
    clearHighlights: () => { },
    resetCoinTray: () => { },
    syncCabinetLights: () => { },
    updateUI: () => { },
    setLastCollectedWin: () => { },
    buildReelsFinal: () => ({ final: ['BOOK'], starts: [0] }),
    evaluateSpin: async () => ({ win: 0, finalScatter: 3, wins: [], scatterWin: 4.8 }),
    advanceFeatureState: (state) => ({
      ...state,
      inFreeSpins: true,
      freeSpins: 12,
      featureBet: 1,
      freeSpinSymbol: { name: 'S2', label: 'Ritratto 2' },
      bonusMultiplier: 1,
      stickyWildColumns: [],
      bonusTriggered: true,
      retriggerTriggered: false
    }),
    resolveBonusPick: async (payload) => {
      bonusCalls.push(payload);
      return { title: 'Libro Sticky', freeSpins: 8, multiplier: 1, stickyWildColumns: [4] };
    },
    renderResultHighlights: () => { },
    setWinDetails: () => { },
    showFloat: () => { }
  });

  const completed = await controller.spin({ source: 'button' });

  assert.strictEqual(completed, true);
  assert.strictEqual(bonusCalls.length, 1);
  assert.strictEqual(featureState.inFreeSpins, true);
  assert.strictEqual(featureState.freeSpins, 8);
  assert.strictEqual(featureState.bonusMultiplier, 1);
  assert.deepStrictEqual(featureState.stickyWildColumns, [4]);
  });

  await runTest('spin scales free-spin wins by the active bonus multiplier', async () => {
  let balance = 10;
  let lastCollectedWin = 0;
  const rendered = [];
  let featureState = {
    inFreeSpins: true,
    freeSpins: 5,
    featureBet: 1,
    freeSpinSymbol: null,
    bonusMultiplier: 2,
    stickyWildColumns: []
  };
  const controller = createSpinRuntimeController({
    getBalance: () => balance,
    setBalance: (value) => { balance = value; },
    getCurrentSpinCost: () => 1,
    getFeatureState: () => featureState,
    setFeatureState: (nextState) => { featureState = { ...featureState, ...nextState }; return featureState; },
    getSpinContext: () => ({ startedInFreeSpins: true, spinStake: 1 }),
    getInFreeSpins: () => featureState.inFreeSpins,
    getFreeSpinSymbol: () => featureState.freeSpinSymbol,
    getBonusMultiplier: () => featureState.bonusMultiplier,
    getBetPerSpin: () => 1,
    setLastCollectedWin: (value) => { lastCollectedWin = value; },
    clearHighlights: () => { },
    resetCoinTray: () => { },
    syncCabinetLights: () => { },
    updateUI: () => { },
    buildReelsFinal: () => ({ final: ['A'], starts: [0] }),
    evaluateSpin: async () => ({ win: 4, finalScatter: 0, wins: [{ highlightIndices: [0], payout: 4 }], scatterWin: 0 }),
    advanceFeatureState: (state) => ({ ...state, inFreeSpins: true, freeSpins: 4, bonusTriggered: false, retriggerTriggered: false }),
    renderResultHighlights: (payload) => { rendered.push(payload); },
    markWinningCells: () => 0,
    getCellCenter: () => ({ x: 0, y: 0 }),
    spawnCoinParticles: () => { },
    playSmallWinSound: () => { },
    showFloat: () => { },
    runCoinTrayDispense: () => { },
    resolveGambleWin: async (payload) => payload.win,
    applyResultMultiplier: (result, multiplier) => ({
      ...result,
      win: result.win * multiplier,
      wins: result.wins.map((win) => ({ ...win, payout: win.payout * multiplier }))
    })
  });

  const completed = await controller.spin({ source: 'button' });

  assert.strictEqual(completed, true);
  assert.strictEqual(balance, 18);
  assert.strictEqual(lastCollectedWin, 8);
  assert.strictEqual(rendered[0].wins[0].payout, 8);
  });

  await runTest('animateReels clears filled animations so reel blur can replay on later spins', async () => {
  const rows = 3;
  const cols = 5;
  const total = rows * cols;
  let now = 0;
  let canceledAnimations = 0;
  const cells = [];
  const faces = [];
  const ghosts = [];
  const final = Array.from({ length: total }, (_, index) => ({
    name: `S${(index % 7) + 1}`,
    label: `Sym ${index + 1}`,
    img: `img/user${(index % 7) + 1}.png`
  }));

  for (let index = 0; index < total; index += 1) {
    const cell = { style: createStyle(), classList: createClassList() };
    const animations = [];
    const face = {
      style: createStyle(),
      dataset: {},
      src: final[index].img,
      parentElement: cell,
      animate() {
        const animation = {
          canceled: false,
          cancel() {
            if (this.canceled) return;
            this.canceled = true;
            canceledAnimations += 1;
          },
          finished: Promise.resolve()
        };
        animations.push(animation);
        return animation;
      },
      getAnimations() {
        return animations.filter((animation) => !animation.canceled);
      }
    };
    const ghost = {
      style: createStyle(),
      dataset: {},
      src: final[index].img,
      getAnimations() {
        return [];
      }
    };
    cell._faceEl = face;
    cell._ghostEl = ghost;
    cells.push(cell);
    faces.push(face);
    ghosts.push(ghost);
  }

  const controller = createSpinRuntimeController({
    rows,
    cols,
    getGridCells: () => cells,
    getGridGhosts: () => ghosts,
    getSymbolFaces: () => faces,
    getReelStrips: () => null,
    syncCellSymbol: (cell, sym) => {
      if (!cell || !cell._faceEl || !sym) return;
      cell._faceEl.src = sym.img;
      cell._faceEl.dataset.symbolName = sym.name;
    },
    resetSpinGhostStyles: (cell) => {
      if (!cell || !cell._ghostEl) return;
      cell._ghostEl.style.removeProperty('transition');
      cell._ghostEl.style.removeProperty('transform');
      cell._ghostEl.style.removeProperty('filter');
      cell._ghostEl.style.removeProperty('opacity');
    },
    syncGhostFromFace: (cell) => {
      if (!cell || !cell._faceEl || !cell._ghostEl) return;
      cell._ghostEl.src = cell._faceEl.src;
      cell._ghostEl.dataset.symbolName = cell._faceEl.dataset.symbolName;
    },
    requestAnimationFrameRef: (handler) => {
      now += 2000;
      handler(now);
      return now;
    },
    performanceRef: { now: () => now },
    setTimeoutRef: (handler) => {
      handler();
      return 0;
    },
    clearTimeoutRef: () => { },
    getComputedStyleRef: () => ({ getPropertyValue: () => '96' }),
    playReelStartSound: () => { },
    playReelStopSound: () => { },
    playClick: () => { }
  });

  await controller.animateReels({ final, starts: [0, 0, 0, 0, 0] });

  assert.strictEqual(canceledAnimations, total);
  faces.forEach((face) => {
    assert.strictEqual(face.getAnimations().length, 0);
  });
  });

  console.log('All spin runtime tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
