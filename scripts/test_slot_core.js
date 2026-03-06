const assert = require('assert');
const SlotCore = require('./slot_core');

const {
  ROWS,
  COLS,
  BASE_FREE_SPINS,
  MAX_FREE_SPINS,
  SCATTER_TRIGGER_COUNT,
  RETRIGGER_SCATTER_COUNT,
  SYMBOLS,
  SCATTER,
  PAYTABLE,
  SCATTER_PAYOUT,
  BONUS_PICK_REVEAL_COUNT,
  BONUS_PICK_BASE_PACKAGE,
  BONUS_PICK_OPTIONS,
  payoutForCount,
  payoutForScatter,
  getPaylines,
  getSpinContext,
  advanceFeatureState,
  applyStickyWildColumns,
  expandSpecialSymbolGrid,
  evaluatePayline,
  evaluateExpandedSpecialWins,
  evaluateReels,
  scalePaytable,
  buildBonusPickDeck,
  pickBonusPackage,
  composeBonusPackage,
  applyBonusPackage,
  applyResultMultiplier
} = SlotCore;

const SYMBOL_BY_NAME = new Map(SYMBOLS.map((symbol) => [symbol.name, symbol]));

function sym(name, extra = {}) {
  const base = name === SCATTER.name ? SCATTER : SYMBOL_BY_NAME.get(name);
  assert(base, `Unknown symbol: ${name}`);
  return { ...base, ...extra };
}

function gridFromRows(rows) {
  assert.strictEqual(rows.length, ROWS, `Expected ${ROWS} rows`);
  rows.forEach((row, rowIndex) => {
    assert.strictEqual(row.length, COLS, `Expected ${COLS} columns in row ${rowIndex}`);
  });
  return rows.flat().map((cell) => {
    if (!cell) return null;
    if (typeof cell === 'string') return sym(cell);
    return { ...cell };
  });
}

function runTest(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

runTest('getPaylines returns the expected 25 fixed lines', () => {
  const expectedRowPatterns = [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [2, 1, 1, 1, 2],
    [0, 1, 0, 1, 0],
    [2, 1, 2, 1, 2],
    [1, 0, 1, 0, 1],
    [1, 2, 1, 2, 1],
    [0, 0, 1, 0, 0],
    [2, 2, 1, 2, 2],
    [1, 2, 2, 2, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
    [1, 1, 0, 1, 1],
    [1, 1, 2, 1, 1],
    [0, 2, 0, 2, 0],
    [2, 0, 2, 0, 2],
    [1, 0, 2, 0, 1],
    [1, 2, 0, 2, 1],
    [0, 0, 2, 0, 0],
    [2, 2, 0, 2, 2],
    [0, 2, 2, 2, 0],
    [2, 0, 0, 0, 2]
  ];
  const expectedPaylines = expectedRowPatterns.map((line) => line.map((row, col) => row * COLS + col));
  const paylines = getPaylines();

  assert.strictEqual(paylines.length, 25);
  assert.deepStrictEqual(paylines, expectedPaylines);
});

runTest('core symbol list exposes S8 as the dedicated wild and BOOK as scatter-only', () => {
  assert.strictEqual(SYMBOLS[7].name, 'S8');
  assert.strictEqual(SYMBOLS[7].label, 'Wild');
  assert.strictEqual(SYMBOLS[7].isWild, true);
  assert.strictEqual(SCATTER.isScatter, true);
  assert.strictEqual(!!SCATTER.isWild, false);
});

runTest('payout helpers match the configured paytable thresholds', () => {
  assert.strictEqual(payoutForCount(PAYTABLE, 'S1', 1), 0);
  assert.strictEqual(payoutForCount(PAYTABLE, 'S1', 2), 2.4);
  assert.strictEqual(payoutForCount(PAYTABLE, 'S1', 6), 1200);
  assert.strictEqual(payoutForCount(PAYTABLE, 'S13', 2), 0);
  assert.strictEqual(payoutForCount(PAYTABLE, 'S13', 3), 0.8);
  assert.strictEqual(payoutForScatter(SCATTER_PAYOUT, 2), 0);
  assert.strictEqual(payoutForScatter(SCATTER_PAYOUT, 3), 4.8);
  assert.strictEqual(payoutForScatter(SCATTER_PAYOUT, 6), 480);
});

runTest('spin context uses feature bet only during free spins', () => {
  assert.deepStrictEqual(getSpinContext({ inFreeSpins: false, freeSpins: 0, featureBet: 5 }, 2), {
    startedInFreeSpins: false,
    spinStake: 2
  });
  assert.deepStrictEqual(getSpinContext({ inFreeSpins: true, freeSpins: 7, featureBet: 5 }, 2), {
    startedInFreeSpins: true,
    spinStake: 5
  });
});

runTest('advanceFeatureState triggers a bonus from base game', () => {
  const nextState = advanceFeatureState(
    { inFreeSpins: false, freeSpins: 0, featureBet: null, freeSpinSymbol: null },
    {
      finalScatter: SCATTER_TRIGGER_COUNT,
      triggerFeatureBet: 2,
      pickFreeSpinSymbol: () => sym('S3'),
      resetFeatureBetTo: null
    }
  );

  assert.strictEqual(nextState.bonusTriggered, true);
  assert.strictEqual(nextState.retriggerTriggered, false);
  assert.strictEqual(nextState.inFreeSpins, true);
  assert.strictEqual(nextState.freeSpins, BASE_FREE_SPINS);
  assert.strictEqual(nextState.featureBet, 2);
  assert.strictEqual(nextState.freeSpinSymbol.name, 'S3');
  assert.strictEqual(nextState.bonusMultiplier, 1);
  assert.deepStrictEqual(nextState.stickyWildColumns, []);
});

runTest('advanceFeatureState retriggers and consumes the current free spin once', () => {
  const nextState = advanceFeatureState(
    { inFreeSpins: true, freeSpins: 4, featureBet: 2, freeSpinSymbol: sym('S3'), bonusMultiplier: 1.5 },
    {
      startedInFreeSpins: true,
      finalScatter: RETRIGGER_SCATTER_COUNT,
      triggerFeatureBet: 2,
      resetFeatureBetTo: null
    }
  );

  assert.strictEqual(nextState.bonusTriggered, false);
  assert.strictEqual(nextState.retriggerTriggered, true);
  assert.strictEqual(nextState.inFreeSpins, true);
  assert.strictEqual(nextState.freeSpins, 4 + BASE_FREE_SPINS - 1);
  assert.strictEqual(nextState.featureBet, 2);
  assert.strictEqual(nextState.freeSpinSymbol.name, 'S3');
  assert.strictEqual(nextState.bonusMultiplier, 1.5);
  assert.deepStrictEqual(nextState.stickyWildColumns, []);
});

runTest('advanceFeatureState does not retrigger the feature with only 3 scatters', () => {
  const nextState = advanceFeatureState(
    { inFreeSpins: true, freeSpins: 4, featureBet: 2, freeSpinSymbol: sym('S3') },
    {
      startedInFreeSpins: true,
      finalScatter: SCATTER_TRIGGER_COUNT,
      resetFeatureBetTo: null
    }
  );

  assert.strictEqual(nextState.bonusTriggered, false);
  assert.strictEqual(nextState.retriggerTriggered, false);
  assert.strictEqual(nextState.inFreeSpins, true);
  assert.strictEqual(nextState.freeSpins, 3);
  assert.deepStrictEqual(nextState.stickyWildColumns, []);
});

runTest('advanceFeatureState closes the feature after the last free spin', () => {
  const nextState = advanceFeatureState(
    { inFreeSpins: true, freeSpins: 1, featureBet: 2, freeSpinSymbol: sym('S3'), bonusMultiplier: 2 },
    {
      startedInFreeSpins: true,
      finalScatter: 0,
      resetFeatureBetTo: null
    }
  );

  assert.strictEqual(nextState.inFreeSpins, false);
  assert.strictEqual(nextState.freeSpins, 0);
  assert.strictEqual(nextState.featureBet, null);
  assert.strictEqual(nextState.freeSpinSymbol, null);
  assert.strictEqual(nextState.bonusMultiplier, 1);
  assert.deepStrictEqual(nextState.stickyWildColumns, []);
});

runTest('advanceFeatureState respects the configured free-spin cap', () => {
  const nextState = advanceFeatureState(
    { inFreeSpins: true, freeSpins: MAX_FREE_SPINS, featureBet: 2, freeSpinSymbol: sym('S3') },
    {
      startedInFreeSpins: true,
      finalScatter: RETRIGGER_SCATTER_COUNT,
      maxFreeSpins: MAX_FREE_SPINS,
      resetFeatureBetTo: null
    }
  );

  assert.strictEqual(nextState.freeSpins, MAX_FREE_SPINS - 1);
});

runTest('evaluatePayline uses only the left-to-right valid prefix', () => {
  const paylines = getPaylines();
  const grid = gridFromRows([
    ['S7', 'S8', 'S9', 'S10', 'S11'],
    ['S1', 'S8', 'S1', 'S1', 'S2'],
    ['S12', 'S13', 'S14', 'S7', 'S8']
  ]);

  const win = evaluatePayline(grid, paylines[0], 2);

  assert(win);
  assert.strictEqual(win.symbolName, 'S1');
  assert.strictEqual(win.count, 4);
  assert.strictEqual(win.payoutMultiplier, 240);
  assert.strictEqual(win.payout, 480);
  assert.deepStrictEqual(win.indices, [5, 6, 7, 8]);
});

runTest('evaluatePayline requires at least one natural symbol', () => {
  const paylines = getPaylines();
  const grid = gridFromRows([
    ['S7', 'S8', 'S9', 'S10', 'S11'],
    [
      { name: 'STICKY_WILD', label: 'Wild Sticky', isWild: true },
      { name: 'STICKY_WILD', label: 'Wild Sticky', isWild: true },
      { name: 'STICKY_WILD', label: 'Wild Sticky', isWild: true },
      { name: 'STICKY_WILD', label: 'Wild Sticky', isWild: true },
      { name: 'STICKY_WILD', label: 'Wild Sticky', isWild: true }
    ],
    ['S12', 'S13', 'S14', 'S7', 'S8']
  ]);

  const win = evaluatePayline(grid, paylines[0], 1);

  assert.strictEqual(win, null);
});

runTest('evaluateReels pays scatter anywhere without forcing a payline win', () => {
  const grid = gridFromRows([
    ['S1', 'S2', 'BOOK', 'S3', 'S4'],
    ['S5', 'S6', 'S7', 'BOOK', 'S9'],
    ['S10', 'S11', 'S12', 'S13', 'BOOK']
  ]);

  const result = evaluateReels(grid, { stake: 1 });

  assert.strictEqual(result.finalScatter, 3);
  assert.strictEqual(result.scatterWin, 4.8);
  assert.strictEqual(result.win, 4.8);
  assert.strictEqual(result.wins.length, 0);
});

runTest('evaluateReels activates every configured fixed payline', () => {
  const paylines = getPaylines();
  const fillerSymbols = ['S9', 'S10', 'S11', 'S12', 'S13', 'S14'];
  const targetSymbol = 'S7';

  const gridForPaylineIndex = (targetIndex) => {
    const grid = Array.from({ length: ROWS * COLS }, (_, cellIndex) => sym(fillerSymbols[cellIndex % fillerSymbols.length]));
    const targetLine = paylines[targetIndex];
    for (let reel = 0; reel < 3; reel += 1) {
      grid[targetLine[reel]] = sym(targetSymbol);
    }
    return grid;
  };

  paylines.forEach((line, paylineIndex) => {
    const result = evaluateReels(gridForPaylineIndex(paylineIndex), { stake: 1 });
    const matchingWin = result.wins.find((win) => win.paylineIndex === paylineIndex && win.symbolName === targetSymbol && win.count === 3);
    assert(matchingWin, `Expected payline ${paylineIndex + 1} to produce a 3-of-a-kind win`);
    assert.deepStrictEqual(matchingWin.line, line);
  });
});

runTest('expanded-symbol wins stop at the first invalid reel', () => {
  const paylines = getPaylines();
  const freeSpinSymbol = sym('S1');
  const grid = gridFromRows([
    ['S1', 'S7', 'S9', 'S1', 'S8'],
    ['S5', 'S1', 'S10', 'S6', 'S1'],
    ['S11', 'S12', 'S13', 'S14', 'S2']
  ]);

  const expandedState = expandSpecialSymbolGrid(grid, freeSpinSymbol);
  const wins = evaluateExpandedSpecialWins(
    expandedState.displayGrid,
    expandedState.expandedColumns,
    [paylines[1]],
    1,
    { freeSpinSymbol }
  );

  assert.deepStrictEqual(expandedState.expandedColumns, [0, 1, 3, 4]);
  assert.strictEqual(wins.length, 1);
  assert.strictEqual(wins[0].count, 2);
  assert.strictEqual(wins[0].payoutMultiplier, 2.4);
  assert.strictEqual(wins[0].payout, 2.4);
  assert.deepStrictEqual(wins[0].highlightIndices, [0, 1]);
});

runTest('sticky wild columns overlay a persistent non-scatter wild reel', () => {
  const grid = gridFromRows([
    ['S1', 'S7', 'S9', 'S1', 'S8'],
    ['S5', 'BOOK', 'S10', 'S6', 'S1'],
    ['S11', 'S12', 'S13', 'S14', 'S2']
  ]);

  const stickyState = applyStickyWildColumns(grid, [2]);

  assert.deepStrictEqual(stickyState.stickyColumns, [2]);
  assert.strictEqual(stickyState.displayGrid[2].isSticky, true);
  assert.strictEqual(stickyState.displayGrid[2].isWild, true);
  assert.strictEqual(stickyState.displayGrid[2].isScatter, false);
  assert.strictEqual(stickyState.displayGrid[7].name, 'STICKY_WILD');
  assert.strictEqual(stickyState.displayGrid[12].label, 'Wild Sticky');
});

runTest('free spins exclude the special symbol from normal line wins', () => {
  const freeSpinSymbol = sym('S1');
  const grid = gridFromRows([
    ['S1', 'S7', 'S9', 'S1', 'S8'],
    ['S5', 'S1', 'S10', 'S6', 'S1'],
    ['S11', 'S12', 'S13', 'S14', 'S2']
  ]);

  const result = evaluateReels(grid, {
    stake: 1,
    isFreeSpin: true,
    freeSpinSymbol
  });

  assert.deepStrictEqual(result.expandedColumns, [0, 1, 3, 4]);
  assert.strictEqual(result.wins.some((win) => win.symbolName === 'S1' && !win.isExpansion), false);
  assert.strictEqual(result.wins.some((win) => win.symbolName === 'S1' && win.isExpansion), true);
});

runTest('evaluateReels applies sticky wild columns before counting scatters and line wins', () => {
  const grid = gridFromRows([
    ['S1', 'S1', 'S1', 'S7', 'S8'],
    ['S5', 'BOOK', 'S10', 'S6', 'S1'],
    ['S11', 'S12', 'S13', 'S14', 'S2']
  ]);

  const result = evaluateReels(grid, {
    stake: 1,
    stickyWildColumns: [1]
  });

  assert.deepStrictEqual(result.stickyColumns, [1]);
  assert.deepStrictEqual(result.featureColumns, [1]);
  assert.strictEqual(result.finalScatter, 0);
  assert.strictEqual(result.displayGrid[1].isSticky, true);
  assert.strictEqual(result.wins.some((win) => win.symbolName === 'S1' && win.count >= 2), true);
});

runTest('bonus board helpers compose and apply the final feature package', () => {
  const deck = buildBonusPickDeck(() => 0, BONUS_PICK_OPTIONS);
  const composed = composeBonusPackage([
    { id: 'fs4', title: '+4 FS', kicker: 'Giri Gratis', freeSpins: 4, accent: '#ffd36b' },
    { id: 'mx05', title: '+0.50x', kicker: 'Moltiplicatore', multiplier: 0.5, accent: '#79f1da' },
    { id: 'sticky4', title: 'Sticky 4', kicker: 'Rullo Wild', stickyWildColumns: [3], accent: '#ff9d63' },
    { id: 'sticky5', title: 'Sticky 5', kicker: 'Rullo Wild', stickyWildColumns: [4], accent: '#ff6f61' }
  ], {
    basePackage: BONUS_PICK_BASE_PACKAGE,
    revealCount: BONUS_PICK_REVEAL_COUNT
  });
  const selected = pickBonusPackage(() => 0, BONUS_PICK_OPTIONS, {
    basePackage: BONUS_PICK_BASE_PACKAGE,
    revealCount: BONUS_PICK_REVEAL_COUNT
  });
  const nextFeatureState = applyBonusPackage({ inFreeSpins: true, freeSpins: 12, bonusMultiplier: 1 }, selected);

  assert.strictEqual(deck.length, BONUS_PICK_OPTIONS.length);
  assert.strictEqual(composed.title, 'Neon Vault Supreme');
  assert.strictEqual(composed.freeSpins, 12);
  assert.strictEqual(composed.multiplier, 1.5);
  assert.deepStrictEqual(composed.stickyWildColumns, [4]);
  assert.strictEqual(selected.id, BONUS_PICK_BASE_PACKAGE.id);
  assert.strictEqual(selected.revealCount, BONUS_PICK_REVEAL_COUNT);
  assert.strictEqual(selected.freeSpins >= BONUS_PICK_BASE_PACKAGE.freeSpins && selected.freeSpins <= 14, true);
  assert.strictEqual(selected.multiplier >= 1 && selected.multiplier <= 1.75, true);
  assert.strictEqual(nextFeatureState.freeSpins, selected.freeSpins);
  assert.strictEqual(nextFeatureState.bonusMultiplier, selected.multiplier);
  assert.deepStrictEqual(nextFeatureState.stickyWildColumns, selected.stickyWildColumns);
});

runTest('applyResultMultiplier scales total, scatter and line payouts together', () => {
  const result = applyResultMultiplier({
    win: 10,
    scatterWin: 2,
    wins: [{ payout: 4 }, { payout: 6 }]
  }, 1.5);

  assert.strictEqual(result.win, 15);
  assert.strictEqual(result.scatterWin, 3);
  assert.deepStrictEqual(result.wins.map((win) => win.payout), [6, 9]);
});

runTest('scalePaytable scales line and scatter payouts together', () => {
  const scaled = scalePaytable(2);

  assert.strictEqual(scaled.paytable.S1[2], 4.8);
  assert.strictEqual(scaled.paytable.S6[5], 72);
  assert.strictEqual(scaled.paytable.S13[2], undefined);
  assert.strictEqual(scaled.paytable.S13[5], 36);
  assert.strictEqual(scaled.scatterPayout[3], 9.6);
  assert.strictEqual(scaled.scatterPayout[2], undefined);
  assert.strictEqual(scaled.scatterPayout[5], 960);
});

console.log('All slot core tests passed.');
