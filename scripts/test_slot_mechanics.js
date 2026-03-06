const assert = require('assert');
const SlotCore = require('./slot_core');
const SlotRenderer = require('./slot_renderer');
const SeededRng = require('./seeded_rng');

const { buildWeightedSymbols, initReelStrips, buildReelsFinal, SYMBOLS, SCATTER, SYMBOL_WEIGHTS, SCATTER_WEIGHT } = SlotCore;
const { createSlotRendererController } = SlotRenderer;
const { createSeededRngController } = SeededRng;

function runTest(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

runTest('slot mechanics: buildReelsFinal stays deterministic for a repeated RNG seed', () => {
  const weighted = buildWeightedSymbols({
    symbols: SYMBOLS,
    scatter: SCATTER,
    symbolWeights: SYMBOL_WEIGHTS,
    scatterWeight: SCATTER_WEIGHT
  });
  const reelStrips = initReelStrips(weighted);
  const firstRng = createSeededRngController({ autoAdvance: false, autoInstallGlobals: false });
  const secondRng = createSeededRngController({ autoAdvance: false, autoInstallGlobals: false });
  const seedHex = '0123456789abcdef0123456789abcdef';

  firstRng.seedFromHex(seedHex);
  secondRng.seedFromHex(seedHex);

  const first = buildReelsFinal(() => firstRng.next(), reelStrips);
  const second = buildReelsFinal(() => secondRng.next(), reelStrips);

  assert.deepStrictEqual(second.starts, first.starts);
  assert.deepStrictEqual(
    second.final.map((symbol) => symbol && symbol.name),
    first.final.map((symbol) => symbol && symbol.name)
  );
});

runTest('slot mechanics: slot renderer rebuilds reel strips when ante weighting changes', () => {
  let anteOn = false;
  const initCalls = [];
  const buildCalls = [];
  const baseStripSet = [['base-0'], ['base-1'], ['base-2'], ['base-3'], ['base-4']];
  const anteStripSet = [['ante-0'], ['ante-1'], ['ante-2'], ['ante-3'], ['ante-4']];
  const controller = createSlotRendererController({
    rows: 3,
    cols: 5,
    symbols: [{ name: 'S1' }],
    scatter: { name: 'BOOK', isScatter: true },
    symbolWeights: [2],
    scatterWeight: 3,
    buildWeightedSymbols: (options) => [
      { sym: { ...options.symbols[0] }, weight: options.symbolWeights[0] },
      { sym: { ...options.scatter }, weight: options.scatterWeight }
    ],
    cloneSymbol: (symbol) => ({ ...symbol }),
    getAnteOn: () => anteOn,
    anteScatterBoost: 4,
    initReelStrips: (weighted) => {
      initCalls.push(weighted.map((item) => ({ name: item.sym.name, weight: item.weight })));
      return anteOn ? anteStripSet : baseStripSet;
    },
    buildReelsFinal: (rng, strips) => {
      buildCalls.push(strips);
      return { final: [], starts: [] };
    },
    rng: () => 0.25
  });

  controller.buildReelsFinal();
  controller.buildReelsFinal();
  anteOn = true;
  controller.buildReelsFinal();

  assert.strictEqual(initCalls.length, 2);
  assert.deepStrictEqual(initCalls[0], [
    { name: 'S1', weight: 2 },
    { name: 'BOOK', weight: 3 }
  ]);
  assert.deepStrictEqual(initCalls[1], [
    { name: 'S1', weight: 2 },
    { name: 'BOOK', weight: 12 }
  ]);
  assert.strictEqual(buildCalls[0], baseStripSet);
  assert.strictEqual(buildCalls[1], baseStripSet);
  assert.strictEqual(buildCalls[2], anteStripSet);
});

console.log('All slot mechanics tests passed.');
