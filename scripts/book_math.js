const crypto = require('crypto');
const SlotCore = require('./slot_core');
const GameConfig = require('./game_config');

const {
  BASE_FREE_SPINS,
  BONUS_PICK_OPTIONS,
  MAX_FREE_SPINS,
  SCATTER_TRIGGER_COUNT,
  RETRIGGER_SCATTER_COUNT,
  PAYTABLE,
  SCATTER_PAYOUT,
  buildWeightedSymbols,
  initReelStrips,
  buildReelsFinal,
  pickFreeSpinSymbol,
  getSpinContext,
  advanceFeatureState,
  evaluateReels,
  scalePaytable,
  pickBonusPackage,
  applyBonusPackage,
  applyResultMultiplier
} = SlotCore;
const { DEFAULT_PAYOUT_SCALE } = GameConfig;
const DEFAULT_SCALED_PAYOUTS = scalePaytable(DEFAULT_PAYOUT_SCALE);

class Xoshiro128PlusPlus {
  constructor(seedHex = null) {
    this.state = new Uint32Array(4);
    if (seedHex) this.seedFromHex(seedHex);
    else this.seedFromCrypto();
  }

  seedFromCrypto() {
    const buffer = crypto.randomBytes(16);
    for (let index = 0; index < 4; index += 1) {
      this.state[index] = buffer.readUInt32LE(index * 4);
    }
  }

  seedFromHex(seedHex) {
    const hex = String(seedHex || '').replace(/[^0-9a-fA-F]/g, '').padEnd(32, '0').slice(0, 32);
    const buffer = Buffer.from(hex, 'hex');
    for (let index = 0; index < 4; index += 1) {
      this.state[index] = buffer.readUInt32LE(index * 4);
    }
  }

  seedHex() {
    return Buffer.from(this.state.buffer).toString('hex');
  }

  random() {
    const state = this.state;
    const result = (rotl((state[0] + state[3]) >>> 0, 7) + state[0]) >>> 0;
    const temp = (state[1] << 9) >>> 0;
    state[2] ^= state[0];
    state[3] ^= state[1];
    state[1] ^= state[2];
    state[0] ^= state[3];
    state[2] ^= temp;
    state[3] = rotl(state[3], 11);
    return result / 0x100000000;
  }
}

function rotl(value, shift) {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function simulateSpins(options = {}) {
  const {
    spins = 100000,
    seedHex = null,
    bet = 1,
    paytable = DEFAULT_SCALED_PAYOUTS.paytable,
    scatterPayout = DEFAULT_SCALED_PAYOUTS.scatterPayout
  } = options;

  const rng = new Xoshiro128PlusPlus(seedHex);
  const weightedSymbols = buildWeightedSymbols();
  const reelStrips = initReelStrips(weightedSymbols);
  let totalBet = 0;
  let totalPayout = 0;
  let baseWinSpins = 0;
  let bonusTriggers = 0;
  let freeSpinRounds = 0;
  let featureState = {
    inFreeSpins: false,
    freeSpins: 0,
    featureBet: null,
    freeSpinSymbol: null,
    bonusMultiplier: 1,
    stickyWildColumns: []
  };
  let paidSpins = 0;

  while (paidSpins < spins || featureState.freeSpins > 0) {
    const { startedInFreeSpins, spinStake } = getSpinContext(featureState, bet);
    const finalGrid = buildReelsFinal(() => rng.random(), reelStrips).final;
    let result = evaluateReels(finalGrid, {
      stake: spinStake,
      isFreeSpin: startedInFreeSpins,
      freeSpinSymbol: featureState.freeSpinSymbol,
      stickyWildColumns: featureState.stickyWildColumns,
      paytable,
      scatterPayout
    });
    if (startedInFreeSpins && featureState.bonusMultiplier > 1) {
      result = applyResultMultiplier(result, featureState.bonusMultiplier);
    }

    totalPayout += result.win;
    if (result.win > 0 && !startedInFreeSpins) baseWinSpins += 1;
    if (!startedInFreeSpins) {
      totalBet += bet;
      paidSpins += 1;
    } else {
      freeSpinRounds += 1;
    }

    featureState = advanceFeatureState(featureState, {
      startedInFreeSpins,
      finalScatter: result.finalScatter,
      scatterTriggerCount: SCATTER_TRIGGER_COUNT,
      retriggerScatterCount: RETRIGGER_SCATTER_COUNT,
      baseFreeSpins: BASE_FREE_SPINS,
      maxFreeSpins: MAX_FREE_SPINS,
      triggerFeatureBet: bet,
      pickFreeSpinSymbol: () => pickFreeSpinSymbol(() => rng.random()),
      resetFeatureBetTo: bet
    });
    if (featureState.bonusTriggered) {
      featureState = applyBonusPackage(featureState, pickBonusPackage(function () { return rng.random(); }, BONUS_PICK_OPTIONS));
      bonusTriggers += 1;
    }
  }

  return {
    seedHex: rng.seedHex(),
    totalBet,
    totalPayout,
    rtp: totalBet > 0 ? totalPayout / totalBet : 0,
    paidSpins,
    baseHitRate: paidSpins > 0 ? baseWinSpins / paidSpins : 0,
    bonusRate: paidSpins > 0 ? bonusTriggers / paidSpins : 0,
    bonusTriggers,
    freeSpinRounds
  };
}

module.exports = {
  BASE_FREE_SPINS,
  PAYTABLE,
  SCATTER_PAYOUT,
  DEFAULT_PAYOUT_SCALE,
  Xoshiro128PlusPlus,
  scalePaytable,
  simulateSpins
};
