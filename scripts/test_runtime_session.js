const assert = require('assert');
const RuntimeSession = require('./runtime_session');

const {
  createCabinetStateManager,
  createRuntimeSession,
  createRuntimeBridge
} = RuntimeSession;

function runTest(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`PASS ${name}`));
}

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    dump(key) {
      return values.get(key);
    }
  };
}

const symbols = [
  { name: 'S1', label: 'Ritratto 1', img: 'img/user1.png' },
  { name: 'S2', label: 'Ritratto 2', img: 'img/user2.png' }
];
const scatter = { name: 'BOOK', label: 'Libro', img: 'img/scatter.png', isScatter: true };

function createSession(storage = createMemoryStorage()) {
  return createRuntimeSession({
    storage,
    storageKey: 'runtime:test',
    minBet: 0.1,
    maxBet: 1000,
    betStep: 0.1,
    maxFreeSpins: 100,
    anteMultiplier: 25,
    initialBalance: 1000,
    initialBetPerSpin: 1,
    symbols,
    scatter,
    cloneSymbol: (symbol) => (symbol ? { ...symbol } : symbol),
    getSpinContext: (featureState, spinCost) => ({
      spinStake: featureState.inFreeSpins ? featureState.featureBet || spinCost : spinCost
    })
  });
}

function createBridgeSession() {
  let freeSpinSymbol = { name: 'S2', isScatter: false, isWild: false };
  return {
    getFeatureState: () => ({ inFreeSpins: true, freeSpins: 8, bonusMultiplier: 1.5, stickyWildColumns: [2] }),
    setFeatureState: (nextState) => nextState,
    snapshotCabinetState: () => ({ version: 1 }),
    persistCabinetState: () => true,
    restoreCabinetState: () => true,
    symbolLabel: (value) => (typeof value === 'string' ? `label:${value}` : value.label),
    formatAmount: (value) => Number(value).toFixed(2),
    formatSymbolCardValue: (value) => String(value),
    symbolValueAccent: (index) => ({ accent: `#${index}`, glow: '#000' }),
    symbolTierLabel: (index) => `tier:${index}`,
    currentFeatureBet: () => 2.5,
    getBonusMultiplier: () => 1.5,
    getSessionStats: () => ({ hitRateLabel: '50%', bestWin: 8, streakLabel: 'Win x2' }),
    resetSessionStats: () => ({ hitRateLabel: '0%', bestWin: 0, streakLabel: '-' }),
    recordSessionSpinResult: (result) => result,
    getCurrentSpinCost: () => 1.5,
    getFreeSpinSymbol: () => freeSpinSymbol,
    setFreeSpinSymbol: (value) => { freeSpinSymbol = value; }
  };
}

(async function main() {
  await runTest('cabinet state snapshot clamps wallet and feature values', () => {
    const manager = createCabinetStateManager({
      storage: createMemoryStorage(),
      storageKey: 'cabinet:test',
      minBet: 0.1,
      maxBet: 1000,
      maxFreeSpins: 100,
      cloneSymbol: (symbol) => (symbol ? { ...symbol } : symbol),
      findSymbolByName: (name) => ({ S1: symbols[0], BOOK: scatter }[name] || null)
    });
    const snapshot = manager.snapshot({
      balance: -10,
      betPerSpin: 2000,
      lastCollectedWin: 12.345,
      inFreeSpins: true,
      freeSpins: 999,
      featureBet: 1500,
      freeSpinSymbol: symbols[0],
      stickyWildColumns: [2, 8, 2]
    });

    assert.deepStrictEqual(snapshot, {
      version: 1,
      balance: 0,
      betPerSpin: 1000,
      lastCollectedWin: 12.35,
      inFreeSpins: true,
      freeSpins: 100,
      featureBet: 1000,
      freeSpinSymbol: 'S1',
      bonusMultiplier: 1,
      stickyWildColumns: [2]
    });
  });

  await runTest('bet controls clamp and round money values', () => {
    const session = createSession();

    assert.strictEqual(session.getBetPerSpin(), 1);
    assert.strictEqual(session.increaseBet(), 1.1);
    assert.strictEqual(session.decreaseBet(), 1);
    assert.strictEqual(session.setBetPerSpin(5000), 1000);
    assert.strictEqual(session.setBetPerSpin(-10), 0.1);
  });

  await runTest('feature state and currentFeatureBet stay coherent with free spins', () => {
    const session = createSession();

    session.setFeatureState({
      inFreeSpins: true,
      freeSpins: 8,
      featureBet: 2.5,
      freeSpinSymbol: 'S2',
      bonusMultiplier: 1.5,
      stickyWildColumns: [2]
    });

    assert.deepStrictEqual(session.getFeatureState(), {
      inFreeSpins: true,
      freeSpins: 8,
      featureBet: 2.5,
      freeSpinSymbol: symbols[1],
      bonusMultiplier: 1.5,
      stickyWildColumns: [2]
    });
    assert.strictEqual(session.currentFeatureBet(), 2.5);
    assert.strictEqual(session.getBonusMultiplier(), 1.5);

    session.setFeatureState({ freeSpinSymbol: null });
    assert.deepStrictEqual(session.getFeatureState(), {
      inFreeSpins: true,
      freeSpins: 8,
      featureBet: 2.5,
      freeSpinSymbol: null,
      bonusMultiplier: 1.5,
      stickyWildColumns: [2]
    });

    session.setFeatureState({});
    assert.deepStrictEqual(session.getFeatureState(), {
      inFreeSpins: false,
      freeSpins: 0,
      featureBet: null,
      freeSpinSymbol: null,
      bonusMultiplier: 1,
      stickyWildColumns: []
    });
  });

  await runTest('persist and restore roundtrip the runtime state through cabinet storage', () => {
    const storage = createMemoryStorage();
    const first = createSession(storage);
    const second = createSession(storage);

    first.setBalance(88.88);
    first.setBetPerSpin(1.5);
    first.setLastCollectedWin(7.2);
    first.setFeatureState({
      inFreeSpins: true,
      freeSpins: 9,
      featureBet: 1.5,
      freeSpinSymbol: 'S1',
      bonusMultiplier: 2,
      stickyWildColumns: [1, 3]
    });
    assert.strictEqual(first.persistCabinetState(), true);

    assert.strictEqual(second.restoreCabinetState(), true);
    assert.strictEqual(second.getBalance(), 88.88);
    assert.strictEqual(second.getBetPerSpin(), 1.5);
    assert.strictEqual(second.getLastCollectedWin(), 7.2);
    assert.deepStrictEqual(second.getFeatureState(), {
      inFreeSpins: true,
      freeSpins: 9,
      featureBet: 1.5,
      freeSpinSymbol: symbols[0],
      bonusMultiplier: 2,
      stickyWildColumns: [1, 3]
    });
  });

  await runTest('format helpers keep the existing paytable display style', () => {
    const session = createSession();

    assert.strictEqual(session.symbolLabel('BOOK'), 'Libro');
    assert.strictEqual(session.formatAmount(12), '12.00');
    assert.strictEqual(session.formatSymbolCardValue(1200), '1200');
    assert.strictEqual(session.formatSymbolCardValue(48), '48');
    assert.strictEqual(session.formatSymbolCardValue(4.8), '4.8');
    assert.deepStrictEqual(session.symbolValueAccent(8), session.symbolValueAccent(1));
    assert.strictEqual(session.symbolTierLabel(0), 'Top');
    assert.strictEqual(session.symbolTierLabel(5), 'Medio');
  });

  await runTest('session stats track hit rate, best collected win and streaks', () => {
    const session = createSession();

    assert.deepStrictEqual(session.getSessionStats(), {
      totalSpins: 0,
      hitSpins: 0,
      hitRate: 0,
      hitRateLabel: '0%',
      bestWin: 0,
      streakType: 'none',
      streakCount: 0,
      streakLabel: '-'
    });

    session.recordSessionSpinResult({ baseWin: 2.4, collectedWin: 4.8 });
    session.recordSessionSpinResult({ baseWin: 0, collectedWin: 0 });
    session.recordSessionSpinResult({ baseWin: 1.2, collectedWin: 0 });

    assert.deepStrictEqual(session.getSessionStats(), {
      totalSpins: 3,
      hitSpins: 2,
      hitRate: 2 / 3,
      hitRateLabel: '67%',
      bestWin: 4.8,
      streakType: 'win',
      streakCount: 1,
      streakLabel: 'Win x1'
    });

    assert.deepStrictEqual(session.resetSessionStats(), {
      totalSpins: 0,
      hitSpins: 0,
      hitRate: 0,
      hitRateLabel: '0%',
      bestWin: 0,
      streakType: 'none',
      streakCount: 0,
      streakLabel: '-'
    });
  });

  await runTest('runtime bridge proxies session helpers and rng controller', async () => {
    const session = createBridgeSession();
    const bridge = createRuntimeBridge({
      runtimeSession: session,
      rngController: { next: () => 0.25 }
    });

    assert.deepStrictEqual(bridge.getFeatureState(), { inFreeSpins: true, freeSpins: 8, bonusMultiplier: 1.5, stickyWildColumns: [2] });
    assert.strictEqual(bridge.setFeatureState({ inFreeSpins: false }).inFreeSpins, false);
    assert.strictEqual(bridge.snapshotCabinetState().version, 1);
    assert.strictEqual(bridge.persistCabinetState(), true);
    assert.strictEqual(bridge.restoreCabinetState(), true);
    assert.strictEqual(bridge.rng(), 0.25);
    assert.strictEqual(bridge.symbolLabel('BOOK'), 'label:BOOK');
    assert.strictEqual(bridge.formatAmount(3), '3.00');
    assert.strictEqual(bridge.formatSymbolCardValue(48), '48');
    assert.deepStrictEqual(bridge.symbolValueAccent(2), { accent: '#2', glow: '#000' });
    assert.strictEqual(bridge.symbolTierLabel(1), 'tier:1');
    assert.strictEqual(bridge.currentFeatureBet(), 2.5);
    assert.strictEqual(bridge.getBonusMultiplier(), 1.5);
    assert.deepStrictEqual(bridge.getSessionStats(), { hitRateLabel: '50%', bestWin: 8, streakLabel: 'Win x2' });
    assert.deepStrictEqual(bridge.recordSessionSpinResult({ baseWin: 3 }), { baseWin: 3 });
    assert.deepStrictEqual(bridge.resetSessionStats(), { hitRateLabel: '0%', bestWin: 0, streakLabel: '-' });
    assert.strictEqual(bridge.getCurrentSpinCost(), 1.5);
  });

  await runTest('runtime bridge updateCellTheme marks scatter, wild, sticky and free spin symbol state', async () => {
    const session = createBridgeSession();
    const bridge = createRuntimeBridge({ runtimeSession: session });
    const cell = { dataset: {} };

    bridge.updateCellTheme(cell, { name: 'S2', isScatter: true, isWild: true, isSticky: true });
    assert.deepStrictEqual(cell.dataset, {
      scatter: 'true',
      wild: 'true',
      sticky: 'true',
      special: 'true'
    });

    session.setFreeSpinSymbol(null);
    bridge.updateCellTheme(cell, { name: 'S1', isScatter: false, isWild: false });
    assert.deepStrictEqual(cell.dataset, {
      scatter: 'false',
      wild: 'false',
      sticky: 'false',
      special: 'false'
    });
  });

  await runTest('runtime bridge evaluateSpin forwards normalized runtime options to evaluateReels', async () => {
    const session = createBridgeSession();
    const calls = [];
    const bridge = createRuntimeBridge({
      runtimeSession: session,
      evaluateReels: async (grid, options) => {
        calls.push({ grid, options });
        return { win: 10 };
      },
      paytable: { S1: { 3: 1 } },
      scatterPayout: { 3: 1 },
      symbols: [{ name: 'S1' }],
      rows: 3,
      cols: 5
    });

    const result = await bridge.evaluateSpin(['S1'], true, 2);

    assert.deepStrictEqual(result, { win: 10 });
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0].grid, ['S1']);
    assert.strictEqual(calls[0].options.stake, 2);
    assert.strictEqual(calls[0].options.isFreeSpin, true);
    assert.deepStrictEqual(calls[0].options.freeSpinSymbol, { name: 'S2', isScatter: false, isWild: false });
    assert.deepStrictEqual(calls[0].options.stickyWildColumns, [2]);
    assert.strictEqual(typeof calls[0].options.symbolLabel, 'function');
  });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
