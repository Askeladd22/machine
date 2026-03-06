/**
 * @fileoverview RuntimeSession - Game state management and persistence
 * 
 * This module handles:
 * - Balance and bet amount management
 * - Free spins feature state tracking
 * - localStorage persistence of game state
 * - State validation and bounds checking
 * - Formatting utilities for display
 * 
 * Provides a centralized state manager that coordinates the game's persistent
 * state across sessions and ensures data consistency.
 * 
 * @module RuntimeSession
 * @author CRACKHOUSE Slot Machine
 * @version 1.0.0
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.RuntimeSession = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Default color accents for symbol values in the paytable
   * @const {Array<{accent: string, glow: string}>}
   */
  const DEFAULT_SYMBOL_VALUE_ACCENTS = [
    { accent: '#ff3ec8', glow: 'rgba(255, 62, 200, 0.34)' },
    { accent: '#b98a11', glow: 'rgba(185, 138, 17, 0.34)' },
    { accent: '#6940ff', glow: 'rgba(105, 64, 255, 0.34)' },
    { accent: '#24b8ff', glow: 'rgba(36, 184, 255, 0.34)' },
    { accent: '#2ddf58', glow: 'rgba(45, 223, 88, 0.34)' },
    { accent: '#42d7ff', glow: 'rgba(66, 215, 255, 0.34)' },
    { accent: '#ff6f32', glow: 'rgba(255, 111, 50, 0.32)' }
  ];

  function roundMoney(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return +numeric.toFixed(2);
  }

  function normalizeBonusMultiplier(value, fallback = 1) {
    const rounded = roundMoney(value, fallback);
    return rounded >= 1 ? rounded : fallback;
  }

  function normalizeStickyWildColumns(value, cols = 5) {
    if (!Array.isArray(value)) return [];
    const normalized = value
      .map(function (entry) { return Math.floor(Number(entry)); })
      .filter(function (entry) { return Number.isInteger(entry) && entry >= 0 && entry < cols; });
    return Array.from(new Set(normalized)).sort(function (left, right) { return left - right; });
  }

  function clampMoney(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return roundMoney(Math.min(max, Math.max(min, numeric)), fallback);
  }

  function clampCount(value, maxCount) {
    return Math.min(maxCount, Math.max(0, Math.floor(value || 0)));
  }

  function cloneValue(value, cloneSymbol) {
    if (!value) return null;
    return typeof cloneSymbol === 'function' ? cloneSymbol(value) : { ...value };
  }

  function createSessionStatsState() {
    return {
      totalSpins: 0,
      hitSpins: 0,
      bestWin: 0,
      currentWinStreak: 0,
      currentLossStreak: 0
    };
  }

  function createCabinetStateManager(options = {}) {
    const minBet = options.minBet == null ? 0.1 : options.minBet;
    const maxBet = options.maxBet == null ? 1000 : options.maxBet;
    const maxFreeSpins = options.maxFreeSpins == null ? 100 : options.maxFreeSpins;
    const storageKey = options.storageKey || '';
    const storage = options.storage || null;
    const cloneSymbol = options.cloneSymbol || null;
    const findSymbolByName = typeof options.findSymbolByName === 'function'
      ? options.findSymbolByName
      : function () { return null; };

    function getFeatureState(source = {}) {
      return {
        inFreeSpins: source.inFreeSpins === true,
        freeSpins: clampCount(source.freeSpins, maxFreeSpins),
        featureBet: source.featureBet == null ? null : clampMoney(source.featureBet, minBet, maxBet, null),
        freeSpinSymbol: cloneValue(source.freeSpinSymbol, cloneSymbol),
        bonusMultiplier: normalizeBonusMultiplier(source.bonusMultiplier, 1),
        stickyWildColumns: normalizeStickyWildColumns(source.stickyWildColumns)
      };
    }

    function applyFeatureState(currentState = {}, nextState = {}) {
      return getFeatureState({ ...currentState, ...nextState });
    }

    function snapshot(state = {}) {
      const featureState = getFeatureState(state);
      return {
        version: 1,
        balance: clampMoney(state.balance, 0, Number.POSITIVE_INFINITY, 0),
        betPerSpin: clampMoney(state.betPerSpin, minBet, maxBet, minBet),
        lastCollectedWin: clampMoney(state.lastCollectedWin, 0, Number.POSITIVE_INFINITY, 0),
        inFreeSpins: featureState.inFreeSpins,
        freeSpins: featureState.freeSpins,
        featureBet: featureState.featureBet,
        freeSpinSymbol: featureState.freeSpinSymbol ? featureState.freeSpinSymbol.name : null,
        bonusMultiplier: featureState.bonusMultiplier,
        stickyWildColumns: featureState.stickyWildColumns
      };
    }

    function restore() {
      if (!storage || !storageKey) return null;
      let raw = '';
      try {
        raw = storage.getItem(storageKey) || '';
      } catch (error) {
        return null;
      }
      if (!raw) return null;
      try {
        const saved = JSON.parse(raw);
        const restored = {};
        if (Number.isFinite(saved.balance) && saved.balance >= 0) {
          restored.balance = roundMoney(saved.balance);
        }
        if (Number.isFinite(saved.betPerSpin)) {
          restored.betPerSpin = clampMoney(saved.betPerSpin, minBet, maxBet, minBet);
        }
        if (Number.isFinite(saved.lastCollectedWin) && saved.lastCollectedWin >= 0) {
          restored.lastCollectedWin = roundMoney(saved.lastCollectedWin);
        }
        const restoredFreeSpins = clampCount(saved.freeSpins, maxFreeSpins);
        const restoredFeatureBet = saved.featureBet == null ? null : clampMoney(saved.featureBet, minBet, maxBet, null);
        const restoredFreeSpinSymbol = findSymbolByName(saved.freeSpinSymbol);
        const restoredBonusMultiplier = normalizeBonusMultiplier(saved.bonusMultiplier, 1);
        const restoredStickyWildColumns = normalizeStickyWildColumns(saved.stickyWildColumns);
        const featureState = saved.inFreeSpins && restoredFreeSpins > 0 && restoredFreeSpinSymbol
          ? {
            inFreeSpins: true,
            freeSpins: restoredFreeSpins,
            featureBet: restoredFeatureBet,
            freeSpinSymbol: restoredFreeSpinSymbol,
            bonusMultiplier: restoredBonusMultiplier,
            stickyWildColumns: restoredStickyWildColumns
          }
          : {
            inFreeSpins: false,
            freeSpins: 0,
            featureBet: null,
            freeSpinSymbol: null,
            bonusMultiplier: 1,
            stickyWildColumns: []
          };
        return { ...restored, ...getFeatureState(featureState) };
      } catch (error) {
        return null;
      }
    }

    function persist(state = {}) {
      if (!storage || !storageKey) return false;
      try {
        storage.setItem(storageKey, JSON.stringify(snapshot(state)));
        return true;
      } catch (error) {
        return false;
      }
    }

    return {
      getFeatureState,
      applyFeatureState,
      snapshot,
      restore,
      persist
    };
  }

  function createRuntimeSession(options = {}) {
    const createStateManager = typeof options.createCabinetStateManager === 'function'
      ? options.createCabinetStateManager
      : createCabinetStateManager;

    const minBet = options.minBet == null ? 0.1 : options.minBet;
    const maxBet = options.maxBet == null ? 1000 : options.maxBet;
    const betStep = options.betStep == null ? 0.1 : options.betStep;
    const maxFreeSpins = options.maxFreeSpins == null ? 100 : options.maxFreeSpins;
    const anteMultiplier = options.anteMultiplier == null ? 25 : options.anteMultiplier;
    const initialBalance = options.initialBalance == null ? 1000 : options.initialBalance;
    const initialBetPerSpin = options.initialBetPerSpin == null ? 1 : options.initialBetPerSpin;
    const initialLastCollectedWin = options.initialLastCollectedWin == null ? 0 : options.initialLastCollectedWin;
    const initialAnteOn = options.initialAnteOn === true;
    const symbols = Array.isArray(options.symbols) ? options.symbols : [];
    const scatter = options.scatter || null;
    const cloneSymbol = typeof options.cloneSymbol === 'function'
      ? options.cloneSymbol
      : function (symbol) { return symbol ? { ...symbol } : symbol; };
    const getSpinContext = typeof options.getSpinContext === 'function'
      ? options.getSpinContext
      : function () { return { spinStake: 0 }; };
    const symbolValueAccents = options.symbolValueAccents || DEFAULT_SYMBOL_VALUE_ACCENTS;

    function findSymbolByName(name) {
      if (!name) return null;
      return symbols.find(function (symbol) { return symbol.name === name; }) ||
        (scatter && scatter.name === name ? scatter : null);
    }

    const cabinetStateManager = createStateManager({
      storage: options.storage || null,
      storageKey: options.storageKey || '',
      minBet,
      maxBet,
      maxFreeSpins,
      cloneSymbol,
      findSymbolByName
    });

    function normalizeSymbol(symbolOrName) {
      if (!symbolOrName) return null;
      if (typeof symbolOrName === 'string') return cloneValue(findSymbolByName(symbolOrName), cloneSymbol);
      return cloneValue(symbolOrName, cloneSymbol);
    }

    let balance = roundMoney(initialBalance, 0);
    let betPerSpin = clampMoney(initialBetPerSpin, minBet, maxBet, minBet);
    let lastCollectedWin = roundMoney(initialLastCollectedWin, 0);
    let anteOn = initialAnteOn;
    let inFreeSpins = false;
    let freeSpins = 0;
    let featureBet = null;
    let freeSpinSymbol = null;
    let bonusMultiplier = 1;
    let stickyWildColumns = [];
    let sessionStats = createSessionStatsState();

    setFeatureState({
      inFreeSpins: options.initialInFreeSpins === true,
      freeSpins: clampCount(options.initialFreeSpins, maxFreeSpins),
      featureBet: options.initialFeatureBet == null ? null : clampMoney(options.initialFeatureBet, minBet, maxBet, null),
      freeSpinSymbol: normalizeSymbol(options.initialFreeSpinSymbol),
      bonusMultiplier: normalizeBonusMultiplier(options.initialBonusMultiplier, 1),
      stickyWildColumns: normalizeStickyWildColumns(options.initialStickyWildColumns)
    });

    function getFeatureState() {
      return cabinetStateManager.getFeatureState({
        inFreeSpins,
        freeSpins,
        featureBet,
        freeSpinSymbol,
        bonusMultiplier,
        stickyWildColumns
      });
    }

    function setFeatureState(nextState = {}) {
      const shouldReset = !nextState || Object.keys(nextState).length === 0;
      const hasFreeSpinSymbol = !shouldReset && Object.prototype.hasOwnProperty.call(nextState, 'freeSpinSymbol');
      const mergedState = shouldReset
        ? {
          inFreeSpins: false,
          freeSpins: 0,
          featureBet: null,
          freeSpinSymbol: null,
          bonusMultiplier: 1,
          stickyWildColumns: []
        }
        : {
          ...getFeatureState(),
          ...nextState,
          freeSpinSymbol: hasFreeSpinSymbol
            ? normalizeSymbol(nextState.freeSpinSymbol)
            : normalizeSymbol(freeSpinSymbol)
        };
      const normalizedState = cabinetStateManager.applyFeatureState(getFeatureState(), mergedState);
      inFreeSpins = normalizedState.inFreeSpins;
      freeSpins = normalizedState.freeSpins;
      featureBet = normalizedState.featureBet;
      freeSpinSymbol = cloneValue(normalizedState.freeSpinSymbol, cloneSymbol);
      bonusMultiplier = normalizeBonusMultiplier(normalizedState.bonusMultiplier, 1);
      stickyWildColumns = normalizeStickyWildColumns(normalizedState.stickyWildColumns);
      return getFeatureState();
    }

    function snapshotCabinetState() {
      return cabinetStateManager.snapshot({
        balance,
        betPerSpin,
        lastCollectedWin,
        inFreeSpins,
        freeSpins,
        featureBet,
        freeSpinSymbol,
        bonusMultiplier,
        stickyWildColumns
      });
    }

    function persistCabinetState() {
      return cabinetStateManager.persist({
        balance,
        betPerSpin,
        lastCollectedWin,
        inFreeSpins,
        freeSpins,
        featureBet,
        freeSpinSymbol,
        bonusMultiplier,
        stickyWildColumns
      });
    }

    function restoreCabinetState() {
      const restored = cabinetStateManager.restore();
      if (!restored) return false;
      if (restored.balance !== undefined) balance = roundMoney(restored.balance, balance);
      if (restored.betPerSpin !== undefined) betPerSpin = clampMoney(restored.betPerSpin, minBet, maxBet, betPerSpin);
      if (restored.lastCollectedWin !== undefined) lastCollectedWin = roundMoney(restored.lastCollectedWin, lastCollectedWin);
      setFeatureState(restored);
      return true;
    }

    function getBalance() {
      return balance;
    }

    function setBalance(value) {
      balance = Math.max(0, roundMoney(value, balance));
      return balance;
    }

    function getBetPerSpin() {
      return betPerSpin;
    }

    function setBetPerSpin(value) {
      betPerSpin = clampMoney(value, minBet, maxBet, betPerSpin);
      return betPerSpin;
    }

    function increaseBet() {
      return setBetPerSpin(betPerSpin + betStep);
    }

    function decreaseBet() {
      return setBetPerSpin(betPerSpin - betStep);
    }

    function getLastCollectedWin() {
      return lastCollectedWin;
    }

    function setLastCollectedWin(value) {
      lastCollectedWin = Math.max(0, roundMoney(value, lastCollectedWin));
      return lastCollectedWin;
    }

    function getAnteOn() {
      return anteOn;
    }

    function setAnteOn(value) {
      anteOn = value === true;
      return anteOn;
    }

    function getInFreeSpins() {
      return inFreeSpins;
    }

    function getFreeSpins() {
      return freeSpins;
    }

    function getFeatureBet() {
      return featureBet;
    }

    function getBonusMultiplier() {
      return bonusMultiplier;
    }

    function getFreeSpinSymbol() {
      return cloneValue(freeSpinSymbol, cloneSymbol);
    }

    function getCurrentSpinCost() {
      return anteOn ? betPerSpin * anteMultiplier : betPerSpin;
    }

    function currentFeatureBet() {
      return getSpinContext(getFeatureState(), getCurrentSpinCost()).spinStake;
    }

    function symbolLabel(symbolOrName) {
      if (!symbolOrName) return '';
      if (typeof symbolOrName === 'string') {
        const found = findSymbolByName(symbolOrName);
        return found ? (found.label || found.name) : symbolOrName;
      }
      return symbolOrName.label || symbolOrName.name || '';
    }

    function formatAmount(value) {
      return Number(value || 0).toFixed(2);
    }

    function formatSymbolCardValue(value) {
      if (value === undefined || value === null || value === 0) return '?';
      const numeric = Number(value);
      if (Number.isInteger(numeric)) return String(numeric);
      if (numeric >= 100) return numeric.toFixed(0);
      if (numeric >= 10) return numeric.toFixed(1).replace(/\.0$/, '');
      return numeric.toFixed(2).replace(/\.?0+$/, '');
    }

    function symbolValueAccent(index) {
      return symbolValueAccents[index % symbolValueAccents.length];
    }

    function symbolTierLabel(index) {
      if (index < 2) return 'Top';
      if (index < 4) return 'Alto';
      if (index < 6) return 'Medio';
      return 'Basso';
    }

    function getSessionStats() {
      const totalSpins = sessionStats.totalSpins;
      const hitSpins = sessionStats.hitSpins;
      const hitRate = totalSpins > 0 ? hitSpins / totalSpins : 0;
      const streakType = sessionStats.currentWinStreak > 0
        ? 'win'
        : (sessionStats.currentLossStreak > 0 ? 'loss' : 'none');
      const streakCount = streakType === 'win'
        ? sessionStats.currentWinStreak
        : (streakType === 'loss' ? sessionStats.currentLossStreak : 0);
      const streakLabel = streakType === 'win'
        ? `Win x${streakCount}`
        : (streakType === 'loss' ? `Miss x${streakCount}` : '-');
      return {
        totalSpins,
        hitSpins,
        hitRate,
        hitRateLabel: `${Math.round(hitRate * 100)}%`,
        bestWin: roundMoney(sessionStats.bestWin, 0),
        streakType,
        streakCount,
        streakLabel
      };
    }

    function resetSessionStats() {
      sessionStats = createSessionStatsState();
      return getSessionStats();
    }

    function recordSessionSpinResult(result = {}) {
      const baseWin = Math.max(0, roundMoney(result.baseWin, 0));
      const collectedWin = Math.max(0, roundMoney(result.collectedWin, 0));
      const didHit = baseWin > 0;
      sessionStats.totalSpins += 1;
      if (didHit) {
        sessionStats.hitSpins += 1;
        sessionStats.currentWinStreak += 1;
        sessionStats.currentLossStreak = 0;
      } else {
        sessionStats.currentLossStreak += 1;
        sessionStats.currentWinStreak = 0;
      }
      sessionStats.bestWin = Math.max(sessionStats.bestWin, collectedWin);
      return getSessionStats();
    }

    return {
      cabinetStateManager,
      findSymbolByName,
      getFeatureState,
      setFeatureState,
      snapshotCabinetState,
      persistCabinetState,
      restoreCabinetState,
      getBalance,
      setBalance,
      getBetPerSpin,
      setBetPerSpin,
      increaseBet,
      decreaseBet,
      getLastCollectedWin,
      setLastCollectedWin,
      getAnteOn,
      setAnteOn,
      getInFreeSpins,
      getFreeSpins,
      getFeatureBet,
      getBonusMultiplier,
      getFreeSpinSymbol,
      getCurrentSpinCost,
      currentFeatureBet,
      symbolLabel,
      formatAmount,
      formatSymbolCardValue,
      symbolValueAccent,
      symbolTierLabel,
      getSessionStats,
      resetSessionStats,
      recordSessionSpinResult
    };
  }

  function createRuntimeBridge(options = {}) {
    const runtimeSession = options.runtimeSession;
    if (!runtimeSession) throw new Error('runtimeSession is required');
    const rngController = options.rngController || null;
    const evaluateReels = typeof options.evaluateReels === 'function' ? options.evaluateReels : null;
    const paytable = options.paytable || {};
    const scatterPayout = options.scatterPayout || {};
    const symbols = Array.isArray(options.symbols) ? options.symbols : [];
    const scatter = options.scatter || null;
    const rows = options.rows == null ? 3 : options.rows;
    const cols = options.cols == null ? 5 : options.cols;

    function getFeatureState() {
      return runtimeSession.getFeatureState();
    }

    function setFeatureState(nextState = {}) {
      return runtimeSession.setFeatureState(nextState);
    }

    function snapshotCabinetState() {
      return runtimeSession.snapshotCabinetState();
    }

    function persistCabinetState() {
      return runtimeSession.persistCabinetState();
    }

    function restoreCabinetState() {
      return runtimeSession.restoreCabinetState();
    }

    function rng() {
      return rngController ? rngController.next() : Math.random();
    }

    function symbolLabel(symbolOrName) {
      return runtimeSession.symbolLabel(symbolOrName);
    }

    function formatAmount(value) {
      return runtimeSession.formatAmount(value);
    }

    function formatSymbolCardValue(value) {
      return runtimeSession.formatSymbolCardValue(value);
    }

    function symbolValueAccent(index) {
      return runtimeSession.symbolValueAccent(index);
    }

    function symbolTierLabel(index) {
      return runtimeSession.symbolTierLabel(index);
    }

    function currentFeatureBet() {
      return runtimeSession.currentFeatureBet();
    }

    function getBonusMultiplier() {
      return runtimeSession.getBonusMultiplier();
    }

    function getSessionStats() {
      return runtimeSession.getSessionStats();
    }

    function resetSessionStats() {
      return runtimeSession.resetSessionStats();
    }

    function recordSessionSpinResult(result = {}) {
      return runtimeSession.recordSessionSpinResult(result);
    }

    function getCurrentSpinCost() {
      return runtimeSession.getCurrentSpinCost();
    }

    function updateCellTheme(cell, symbol) {
      if (!cell) return;
      const freeSpinSymbol = runtimeSession.getFreeSpinSymbol();
      cell.dataset.scatter = symbol && symbol.isScatter ? 'true' : 'false';
      cell.dataset.wild = symbol && symbol.isWild ? 'true' : 'false';
      cell.dataset.sticky = symbol && symbol.isSticky ? 'true' : 'false';
      cell.dataset.special = freeSpinSymbol && symbol && symbol.name === freeSpinSymbol.name ? 'true' : 'false';
    }

    function getCoreRuntimeOptions(overrides = {}) {
      return {
        paytable,
        scatterPayout,
        symbols,
        scatterSymbol: scatter,
        rows,
        cols,
        symbolLabel,
        ...overrides
      };
    }

    async function evaluateSpin(grid, isFreeSpin = false, stake = 1) {
      if (!evaluateReels) {
        throw new Error('evaluateReels is required to evaluate a spin');
      }
      const featureState = runtimeSession.getFeatureState();
      return evaluateReels(grid, getCoreRuntimeOptions({
        stake,
        isFreeSpin,
        freeSpinSymbol: featureState.freeSpinSymbol || runtimeSession.getFreeSpinSymbol(),
        stickyWildColumns: featureState.stickyWildColumns
      }));
    }

    return {
      session: runtimeSession,
      rngController,
      getFeatureState,
      setFeatureState,
      snapshotCabinetState,
      persistCabinetState,
      restoreCabinetState,
      rng,
      symbolLabel,
      formatAmount,
      formatSymbolCardValue,
      symbolValueAccent,
      symbolTierLabel,
      currentFeatureBet,
      getBonusMultiplier,
      getSessionStats,
      resetSessionStats,
      recordSessionSpinResult,
      getCurrentSpinCost,
      updateCellTheme,
      getCoreRuntimeOptions,
      evaluateSpin
    };
  }

  return {
    DEFAULT_SYMBOL_VALUE_ACCENTS,
    roundMoney,
    clampMoney,
    clampCount,
    cloneValue,
    createCabinetStateManager,
    createRuntimeSession,
    createRuntimeBridge
  };
});
