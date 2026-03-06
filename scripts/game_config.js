(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.GameConfig = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_PAYLINE_COLORS = ['#fff200', '#0b5fa5', '#7ab70f', '#18e6f2', '#af30cd', '#25ef15', '#ffab08', '#b72200', '#b81f74', '#9a3dd7'];
  const DEFAULT_PAYOUT_SCALE = 0.132;

  const DEFAULT_TIMINGS = {
    cycles: 5,
    baseDuration: 820,
    perReelDelay: 220,
    perReelExtra: 160,
    cycleInterval: 140,
    fastSwipe: 260,
    settle: 420,
    beepBaseFreq: 640,
    beepGain: 0.045
  };

  function cloneDefault(value) {
    return value ? { ...value } : value;
  }

  function paylineColorForIndex(index, colors) {
    const palette = Array.isArray(colors) && colors.length ? colors : DEFAULT_PAYLINE_COLORS;
    const normalized = Number.isInteger(index) ? index : 0;
    return palette[((normalized % palette.length) + palette.length) % palette.length] || '#ffd966';
  }

  function createGameConfig(options = {}) {
    const imgPrefix = options.imgPrefix || 'img/';
    const locationPath = options.locationPath || 'index';
    const cloneSymbol = typeof options.cloneSymbol === 'function' ? options.cloneSymbol : cloneDefault;
    const coreSymbols = Array.isArray(options.coreSymbols) ? options.coreSymbols : [];
    const coreScatter = options.coreScatter || null;
    const portraitSymbolCount = options.portraitSymbolCount == null ? coreSymbols.length : options.portraitSymbolCount;
    const paylineColors = options.paylineColors || DEFAULT_PAYLINE_COLORS;
    const payoutScale = options.payoutScale == null ? DEFAULT_PAYOUT_SCALE : Number(options.payoutScale) || DEFAULT_PAYOUT_SCALE;
    const basePaytable = options.basePaytable || {};
    const baseScatterPayout = options.baseScatterPayout || {};
    const scalePaytable = typeof options.scalePaytable === 'function' ? options.scalePaytable : null;
    const timings = { ...DEFAULT_TIMINGS, ...(options.timings || {}) };
    const coinFrames = Array.from({ length: 6 }, function (_, index) {
      return imgPrefix + 'goldcoin-frame' + (index + 1) + '.png';
    });
    const symbols = coreSymbols.map(function (symbol, index) {
      return { ...cloneSymbol(symbol), img: imgPrefix + 'user' + (index + 1) + '.png' };
    });
    const scatter = coreScatter ? { ...cloneSymbol(coreScatter), img: imgPrefix + 'scatter.png' } : null;
    const preloadUrls = []
      .concat(Array.from({ length: portraitSymbolCount }, function (_, index) {
        return imgPrefix + 'user' + (index + 1) + '.png';
      }))
      .concat(scatter ? [scatter.img] : [])
      .concat(coinFrames);
    const scaledPayouts = scalePaytable
      ? scalePaytable(payoutScale, basePaytable, baseScatterPayout)
      : { paytable: basePaytable, scatterPayout: baseScatterPayout };

    return {
      anteMultiplier: options.anteMultiplier == null ? 25 : options.anteMultiplier,
      anteScatterBoost: options.anteScatterBoost == null ? 3 : options.anteScatterBoost,
      payoutScale,
      defaultPaytableTab: options.defaultPaytableTab || 'values',
      paytableTabAnimationMs: options.paytableTabAnimationMs == null ? 220 : options.paytableTabAnimationMs,
      betStep: options.betStep == null ? 0.1 : options.betStep,
      minBet: options.minBet == null ? 0.1 : options.minBet,
      maxBet: options.maxBet == null ? 1000 : options.maxBet,
      initialBalance: options.initialBalance == null ? 1000 : options.initialBalance,
      initialBetPerSpin: options.initialBetPerSpin == null ? 1 : options.initialBetPerSpin,
      cabinetStateKey: 'discord-slot-cabinet-state-v1:' + locationPath,
      imgPrefix,
      coinFrames,
      symbols,
      scatter,
      paytable: scaledPayouts.paytable,
      scatterPayout: scaledPayouts.scatterPayout,
      timings,
      paylineColors,
      paylineColorForIndex: function (index) {
        return paylineColorForIndex(index, paylineColors);
      },
      preloadUrls
    };
  }

  return {
    DEFAULT_PAYLINE_COLORS,
    DEFAULT_PAYOUT_SCALE,
    DEFAULT_TIMINGS,
    createGameConfig,
    paylineColorForIndex
  };
});
