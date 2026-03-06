/**
 * @fileoverview SlotCore - Core slot machine game logic module
 * 
 * This module provides the fundamental game mechanics for a slot machine including:
 * - Reel strip generation and symbol distribution
 * - Payline evaluation and win calculation
 * - Free spins feature logic with symbol expansion
 * - Scatter symbol handling and bonus triggers
 * 
 * The module is designed to be pure and deterministic, with all randomness
 * injected via function parameters for testability.
 * 
 * @module SlotCore
 * @author CRASHHOUSE Slot Machine
 * @version 1.0.0
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.SlotCore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ==================== CONFIGURATION CONSTANTS ====================
  
  /** @const {number} Number of rows in the slot grid */
  const ROWS = 3;
  
  /** @const {number} Number of columns (reels) in the slot grid */
  const COLS = 5;
  
  /** @const {number} Total number of visible symbol positions */
  const TOTAL = ROWS * COLS;
  
  /** @const {number} Number of free spins awarded when bonus is triggered */
  const BASE_FREE_SPINS = 12;
  
  /** @const {number} Maximum allowed free spins */
  const MAX_FREE_SPINS = 100;
  
  /** @const {number} Minimum scatter symbols to trigger free spins */
  const SCATTER_TRIGGER_COUNT = 3;
  
  /** @const {number} Minimum scatter symbols to retrigger free spins during bonus */
  const RETRIGGER_SCATTER_COUNT = 4;
  
  /** @const {number} Length of each virtual reel strip */
  const REEL_STRIP_LEN = 256;
  
  /** @const {number} Weight for scatter symbol distribution */
  const SCATTER_WEIGHT = 2.2;
  
  /** @const {number[]} Step values for distributing symbols on each reel */
  const REEL_STRIP_STEPS = [37, 73, 101, 129, 157];
  
  /** @const {number[]} Offset values for symbol distribution on each reel */
  const REEL_STRIP_OFFSETS = [5, 17, 29, 43, 61];
  
  /** @const {number} Number of different portrait symbols */
  const PORTRAIT_SYMBOL_COUNT = 14;
  
  /** @const {number[]} Weight distribution for each symbol (affects frequency) */
  const SYMBOL_WEIGHTS = [2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 8, 9, 10, 10];

  /**
   * Array of all regular symbols used in the game
   * @typedef {Object} Symbol
   * @property {string} name - Unique identifier for the symbol (e.g., 'S1', 'S2')
   * @property {string} label - Display label for the symbol
   * @property {boolean} [isScatter] - Whether this symbol is a scatter
   * @property {boolean} [isWild] - Whether this symbol acts as a wild
   * @property {boolean} [isExpanded] - Whether this symbol is expanded during free spins
   * 
   * @const {Symbol[]}
   */
  const SYMBOLS = Array.from({ length: PORTRAIT_SYMBOL_COUNT }, function (_, index) {
    const symbolIndex = index + 1;
    if (symbolIndex === 8) {
      return { name: 'S8', label: 'Wild', isWild: true };
    }
    return { name: 'S' + symbolIndex, label: 'Ritratto ' + symbolIndex };
  });

  /**
   * The scatter/book symbol that triggers free spins
   * @const {Symbol}
   */
  const SCATTER = { name: 'BOOK', label: 'Libro', isScatter: true };

  /**
   * Paytable defining win multipliers for each symbol and count combination
   * Keys are symbol names, values are objects mapping count to multiplier
   * @example { S1: { 5: 1200, 4: 240, 3: 24, 2: 2.4 } }
   * @const {Object.<string, Object.<number, number>>}
   */
  const PAYTABLE = {
    S1: { 5: 1200, 4: 240, 3: 24, 2: 2.4 },
    S2: { 5: 480, 4: 96, 3: 9.6, 2: 1.2 },
    S3: { 5: 180, 4: 24, 3: 7.2, 2: 1.2 },
    S4: { 5: 180, 4: 24, 3: 7.2, 2: 1.2 },
    S5: { 5: 36, 4: 9.6, 3: 1.2 },
    S6: { 5: 36, 4: 9.6, 3: 1.2 },
    S7: { 5: 24, 4: 6, 3: 1.2 },
    S8: { 5: 24, 4: 6, 3: 1.2 },
    S9: { 5: 24, 4: 6, 3: 1.2 },
    S10: { 5: 24, 4: 6, 3: 1.2 },
    S11: { 5: 24, 4: 6, 3: 1.2 },
    S12: { 5: 24, 4: 6, 3: 1.2 },
    S13: { 5: 18, 4: 4.5, 3: 0.8 },
    S14: { 5: 18, 4: 4.5, 3: 0.8 }
  };

  /**
   * Scatter symbol payout multipliers based on count
   * @const {Object.<number, number>}
   */
  const SCATTER_PAYOUT = { 5: 480, 4: 48, 3: 4.8 };

  /** @const {number} Player choices resolved in the bonus game */
  const BONUS_PICK_REVEAL_COUNT = 1;

  /** @const {number} Maximum free spins reachable from the bonus board */
  const BONUS_PICK_MAX_FREE_SPINS = 14;

  /** @const {number} Maximum multiplier reachable from the bonus board */
  const BONUS_PICK_MAX_MULTIPLIER = 1.75;

  /** @const {number} Maximum number of sticky wild reels awarded by the bonus board */
  const BONUS_PICK_MAX_STICKY_REELS = 1;

  /**
   * Base package used by the bonus board before any reveal.
   * @const {{id: string, title: string, kicker: string, freeSpins: number, multiplier: number, stickyWildColumns: number[], accent: string}}
   */
  const BONUS_PICK_BASE_PACKAGE = {
    id: 'neon-vault',
    title: 'Neon Vault',
    kicker: 'Bonus Neon Vault',
    freeSpins: 8,
    multiplier: 1,
    stickyWildColumns: [],
    accent: '#ffd36b'
  };

  /**
   * Vault pool for the Neon Vault bonus.
   * The player chooses one vault, which reveals a full bonus package delta.
   * @const {Array<{id: string, title: string, kicker: string, freeSpins?: number, multiplier?: number, stickyWildColumns?: number[], accent: string}>}
   */
  const BONUS_PICK_OPTIONS = [
    { id: 'vault-rush', title: 'Rush Vault', kicker: 'Long Play', freeSpins: 4, multiplier: 0.25, accent: '#ffd36b' },
    { id: 'vault-power', title: 'Power Vault', kicker: 'Power Ladder', freeSpins: 2, multiplier: 0.5, accent: '#79f1da' },
    { id: 'vault-sticky', title: 'Sticky Vault', kicker: 'Sticky Reel 5', freeSpins: 2, stickyWildColumns: [4], accent: '#ff9d63' }
  ];

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Creates a shallow copy of a symbol object
   * @param {Symbol|null} symbol - The symbol to clone
   * @returns {Symbol|null} A copy of the symbol, or null if input is null
   * @example
   * const copy = cloneSymbol({ name: 'S1', label: 'Portrait 1' });
   */
  function cloneSymbol(symbol) {
    return symbol ? { ...symbol } : symbol;
  }

  function normalizeBonusMultiplier(value, fallback = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) return fallback;
    return +numeric.toFixed(2);
  }

  function normalizeStickyWildColumns(value, cols = COLS) {
    if (!Array.isArray(value)) return [];
    const normalized = value
      .map(function (entry) { return Math.floor(Number(entry)); })
      .filter(function (entry) { return Number.isInteger(entry) && entry >= 0 && entry < cols; });
    return Array.from(new Set(normalized)).sort(function (left, right) { return left - right; });
  }

  function cloneBonusPickOption(option) {
    if (!option) return null;
    return {
      id: option.id || BONUS_PICK_BASE_PACKAGE.id,
      title: option.title || BONUS_PICK_BASE_PACKAGE.title,
      kicker: option.kicker || '',
      freeSpins: Math.max(1, Math.floor(option.freeSpins || BONUS_PICK_BASE_PACKAGE.freeSpins)),
      multiplier: normalizeBonusMultiplier(option.multiplier, 1),
      stickyWildColumns: normalizeStickyWildColumns(option.stickyWildColumns),
      accent: option.accent || BONUS_PICK_BASE_PACKAGE.accent,
      reveals: Array.isArray(option.reveals)
        ? option.reveals.map(function (tile) { return tile ? { ...tile } : tile; }).filter(Boolean)
        : [],
      revealCount: Math.max(0, Math.floor(option.revealCount || 0)),
      maxReveals: Math.max(1, Math.floor(option.maxReveals || BONUS_PICK_REVEAL_COUNT))
    };
  }

  function cloneBonusPickTile(tile) {
    if (!tile) return null;
    return {
      id: tile.id || 'bonus-tile',
      title: tile.title || 'Mystery',
      kicker: tile.kicker || 'Bonus',
      freeSpins: Math.max(0, Math.floor(tile.freeSpins || 0)),
      multiplier: Number.isFinite(Number(tile.multiplier)) ? +(Number(tile.multiplier) || 0).toFixed(2) : 0,
      stickyWildColumns: normalizeStickyWildColumns(tile.stickyWildColumns),
      accent: tile.accent || BONUS_PICK_BASE_PACKAGE.accent
    };
  }

  function resolveBonusStickyWildColumns(columns, maxStickyReels = BONUS_PICK_MAX_STICKY_REELS) {
    const limit = Math.max(0, Math.floor(maxStickyReels || 0));
    if (!limit) return [];
    const normalized = normalizeStickyWildColumns(columns);
    if (!normalized.length) return [];
    return normalized.slice(-limit);
  }

  function bonusPackageTitle(config = {}) {
    const freeSpins = Math.max(1, Math.floor(config.freeSpins || BONUS_PICK_BASE_PACKAGE.freeSpins));
    const multiplier = normalizeBonusMultiplier(config.multiplier, BONUS_PICK_BASE_PACKAGE.multiplier);
    const stickyWildColumns = normalizeStickyWildColumns(config.stickyWildColumns);
    if (stickyWildColumns.length && multiplier > 1) return 'Neon Vault Supreme';
    if (stickyWildColumns.length) return 'Neon Vault Sticky';
    if (freeSpins >= 12 && multiplier > 1) return 'Neon Vault Rush';
    if (multiplier >= 1.5) return 'Neon Vault Power';
    if (freeSpins >= 12) return 'Neon Vault Rush';
    if (multiplier > 1) return 'Neon Vault Boost';
    return BONUS_PICK_BASE_PACKAGE.title;
  }

  function bonusPackageKicker(config = {}) {
    const multiplier = normalizeBonusMultiplier(config.multiplier, BONUS_PICK_BASE_PACKAGE.multiplier);
    const stickyWildColumns = normalizeStickyWildColumns(config.stickyWildColumns);
    const freeSpins = Math.max(1, Math.floor(config.freeSpins || BONUS_PICK_BASE_PACKAGE.freeSpins));
    if (stickyWildColumns.length) return stickyWildColumns[0] >= 4 ? 'Sticky Reel 5' : 'Sticky Reel 4';
    if (freeSpins >= 12 && multiplier > 1) return 'Rush Vault';
    if (multiplier >= 1.5) return 'Power Vault';
    if (freeSpins >= 12) return 'Long Play';
    if (multiplier > 1) return 'Boost Vault';
    return 'Free Spin Ladder';
  }

  function bonusPackageAccent(config = {}) {
    const freeSpins = Math.max(1, Math.floor(config.freeSpins || BONUS_PICK_BASE_PACKAGE.freeSpins));
    const multiplier = normalizeBonusMultiplier(config.multiplier, BONUS_PICK_BASE_PACKAGE.multiplier);
    const stickyWildColumns = normalizeStickyWildColumns(config.stickyWildColumns);
    if (stickyWildColumns.length && multiplier > 1) return '#d987ff';
    if (stickyWildColumns.length) return '#ff9d63';
    if (multiplier > 1) return '#79f1da';
    if (freeSpins > BONUS_PICK_BASE_PACKAGE.freeSpins) return '#ffd36b';
    return BONUS_PICK_BASE_PACKAGE.accent;
  }

  function composeBonusPackage(revealedTiles = [], options = {}) {
    const tiles = Array.isArray(revealedTiles)
      ? revealedTiles.map(cloneBonusPickTile).filter(Boolean)
      : [];
    const basePackage = cloneBonusPickOption(options.basePackage || BONUS_PICK_BASE_PACKAGE) || cloneBonusPickOption(BONUS_PICK_BASE_PACKAGE);
    const maxFreeSpins = Math.max(1, Math.floor(options.maxFreeSpins || BONUS_PICK_MAX_FREE_SPINS));
    const maxMultiplier = Number.isFinite(Number(options.maxMultiplier))
      ? +Math.max(1, Number(options.maxMultiplier)).toFixed(2)
      : BONUS_PICK_MAX_MULTIPLIER;
    const freeSpins = Math.min(
      maxFreeSpins,
      basePackage.freeSpins + tiles.reduce(function (sum, tile) { return sum + Math.max(0, Math.floor(tile.freeSpins || 0)); }, 0)
    );
    const multiplier = Math.min(
      maxMultiplier,
      +(
        basePackage.multiplier + tiles.reduce(function (sum, tile) {
          return sum + (Number.isFinite(Number(tile.multiplier)) ? Number(tile.multiplier) : 0);
        }, 0)
      ).toFixed(2)
    );
    const stickyWildColumns = resolveBonusStickyWildColumns(
      tiles.reduce(function (all, tile) { return all.concat(normalizeStickyWildColumns(tile.stickyWildColumns)); }, basePackage.stickyWildColumns.slice()),
      options.maxStickyReels || BONUS_PICK_MAX_STICKY_REELS
    );
    return cloneBonusPickOption({
      ...basePackage,
      freeSpins,
      multiplier,
      stickyWildColumns,
      title: bonusPackageTitle({ freeSpins, multiplier, stickyWildColumns }),
      kicker: bonusPackageKicker({ freeSpins, multiplier, stickyWildColumns }),
      accent: bonusPackageAccent({ freeSpins, multiplier, stickyWildColumns }),
      reveals: tiles,
      revealCount: tiles.length,
      maxReveals: Math.max(1, Math.floor(options.revealCount || BONUS_PICK_REVEAL_COUNT))
    });
  }

  function buildStickyWildSymbol(symbol = SCATTER) {
    const base = cloneSymbol(symbol) || cloneSymbol(SCATTER) || {};
    return {
      ...base,
      name: 'STICKY_WILD',
      label: 'Wild Sticky',
      isScatter: false,
      isWild: true,
      isSticky: true
    };
  }

  /**
   * Gets the display label for a symbol or symbol name
   * @param {Symbol|string|null} symbolOrName - A symbol object or symbol name string
   * @returns {string} The label to display for this symbol
   * @example
   * symbolLabel('S1'); // Returns 'Ritratto 1'
   * symbolLabel({ name: 'BOOK', label: 'Libro' }); // Returns 'Libro'
   */
  function symbolLabel(symbolOrName) {
    if (!symbolOrName) return '';
    if (typeof symbolOrName === 'string') {
      const found = SYMBOLS.find(function (symbol) { return symbol.name === symbolOrName; });
      if (found) return found.label || found.name;
      if (symbolOrName === SCATTER.name) return SCATTER.label || SCATTER.name;
      return symbolOrName;
    }
    return symbolOrName.label || symbolOrName.name || '';
  }

  /**
   * Calculates the payout multiplier for a given symbol and count
   * @param {Object.<string, Object.<number, number>>} paytable - The paytable lookup object
   * @param {string} name - The symbol name to look up
   * @param {number} count - Number of matching symbols on a payline
   * @returns {number} The payout multiplier for this symbol and count
   * @example
   * payoutForCount(PAYTABLE, 'S1', 5); // Returns 1200
   */
  function payoutForCount(paytable, name, count) {
    const table = paytable[name];
    if (!table) return 0;
    const keys = Object.keys(table).map(Number).sort(function (a, b) { return a - b; });
    let matched = 0;
    for (const key of keys) {
      if (count >= key) matched = key;
    }
    return matched ? table[matched] : 0;
  }

  /**
   * Calculates the scatter symbol payout for a given count
   * @param {Object.<number, number>} scatterPayout - Scatter payout table
   * @param {number} count - Number of scatter symbols visible
   * @returns {number} The payout multiplier for this scatter count
   * @example
   * payoutForScatter(SCATTER_PAYOUT, 3); // Returns 4.8
   */
  function payoutForScatter(scatterPayout, count) {
    const keys = Object.keys(scatterPayout).map(Number).sort(function (a, b) { return b - a; });
    for (const key of keys) {
      if (count >= key) return scatterPayout[key] || 0;
    }
    return 0;
  }

  /**
   * Gets the minimum count needed for a symbol to award a payout
   * @param {Object.<string, Object.<number, number>>} paytable - The paytable lookup object
   * @param {string} name - The symbol name to check
   * @returns {number} Minimum matching symbols needed for a win
   * @example
   * minCountForSymbol(PAYTABLE, 'S1'); // Returns 2
   */
  function minCountForSymbol(paytable, name) {
    const table = paytable[name];
    return table ? Math.min.apply(null, Object.keys(table).map(Number)) : 0;
  }

  /**
   * Exact 25 fixed-line row patterns used by the cabinet.
   * Each inner array stores the row index (0-2) hit on each reel from left to right.
   * The order matches the paytable numbering shown to the player.
   * @const {number[][]}
   */
  const FIXED_PAYLINE_ROWS_25 = [
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

  /**
   * Generates all payline patterns for the game grid
   * Returns an array of paylines, where each payline is an array of cell indices
   * @param {number} [rows=3] - Number of rows in the grid
   * @param {number} [cols=5] - Number of columns in the grid
   * @returns {number[][]} Array of paylines, each containing cell indices (0-14)
   * @example
   * getPaylines(3, 5); // Returns 25 paylines
   * // First payline (top row): [0, 1, 2, 3, 4]
   */
  function getPaylines(rows = ROWS, cols = COLS) {
    if (rows !== 3 || cols !== 5) return [];
    return FIXED_PAYLINE_ROWS_25.map(function (line) {
      return line.map(function (row, col) {
        return row * cols + col;
      });
    });
  }

  /**
   * Builds a weighted list of symbols with their relative frequencies
   * @param {Object} [options={}] - Configuration options
   * @param {Symbol[]} [options.symbols] - Array of regular symbols
   * @param {Symbol} [options.scatter] - The scatter symbol
   * @param {number[]} [options.symbolWeights] - Weight for each symbol
   * @param {number} [options.scatterWeight] - Weight for scatter symbol
   * @returns {Array.<{sym: Symbol, weight: number}>} Weighted symbol array
   */
  function buildWeightedSymbols(options = {}) {
    const symbols = options.symbols || SYMBOLS;
    const scatter = options.scatter || SCATTER;
    const symbolWeights = options.symbolWeights || SYMBOL_WEIGHTS;
    const scatterWeight = options.scatterWeight == null ? SCATTER_WEIGHT : options.scatterWeight;
    const weighted = symbols.map(function (symbol, index) {
      return { sym: symbol, weight: symbolWeights[index] };
    });
    weighted.push({ sym: scatter, weight: scatterWeight });
    return weighted;
  }

  /**
   * Allocates symbols to fill a reel strip based on their weights
   * Uses proportional allocation with remainder distribution
   * @param {Array.<{sym: Symbol, weight: number}>} weighted - Weighted symbols
   * @param {number} [stripLength=256] - Length of the reel strip
   * @returns {Array.<{sym: Symbol, count: number, remainder: number}>} Symbol allocations
   */
  function buildStripAllocations(weighted, stripLength = REEL_STRIP_LEN) {
    const totalWeight = weighted.reduce(function (sum, item) { return sum + item.weight; }, 0);
    const allocations = weighted.map(function (item) {
      const exact = (item.weight / totalWeight) * stripLength;
      return {
        sym: item.sym,
        count: Math.floor(exact),
        remainder: exact - Math.floor(exact)
      };
    });
    const assigned = allocations.reduce(function (sum, item) { return sum + item.count; }, 0);
    const remaining = stripLength - assigned;
    allocations
      .slice()
      .sort(function (a, b) { return b.remainder - a.remainder; })
      .slice(0, remaining)
      .forEach(function (item) { item.count += 1; });
    return allocations.filter(function (item) { return item.count > 0; });
  }

  /**
   * Initializes virtual reel strips with symbols distributed using step patterns
   * This creates the "virtual reels" that are randomly sampled during each spin
   * @param {Array.<{sym: Symbol, weight: number}>} [weighted] - Weighted symbols
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.cols] - Number of reels
   * @param {number} [options.stripLength] - Length of each strip
   * @param {number[]} [options.reelStripSteps] - Step patterns for distribution
   * @param {number[]} [options.reelStripOffsets] - Offset patterns
   * @returns {Symbol[][]} Array of reel strips, one per column
   */
  function initReelStrips(weighted = buildWeightedSymbols(), options = {}) {
    const cols = options.cols || COLS;
    const stripLength = options.stripLength || REEL_STRIP_LEN;
    const stripSteps = options.reelStripSteps || REEL_STRIP_STEPS;
    const stripOffsets = options.reelStripOffsets || REEL_STRIP_OFFSETS;
    const allocations = buildStripAllocations(weighted, stripLength);
    const strips = [];
    for (let reel = 0; reel < cols; reel += 1) {
      const pool = [];
      allocations.forEach(function (item) {
        for (let index = 0; index < item.count; index += 1) {
          pool.push(cloneSymbol(item.sym));
        }
      });
      const strip = Array(pool.length);
      const step = stripSteps[reel % stripSteps.length];
      const offset = stripOffsets[reel % stripOffsets.length];
      for (let index = 0; index < pool.length; index += 1) {
        strip[(index * step + offset) % pool.length] = pool[index];
      }
      strips.push(strip);
    }
    return strips;
  }

  /**
   * Generates a final reel outcome by random sampling from reel strips
   * @param {Function} randomFn - Random number generator function (0-1)
   * @param {Symbol[][]} reelStrips - Array of virtual reel strips
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.rows] - Number of visible rows
   * @param {number} [options.cols] - Number of columns/reels
   * @returns {{final: Symbol[], starts: number[]}} Final grid and strip start positions
   * @example
   * const result = buildReelsFinal(Math.random, reelStrips);
   * // result.final is a flat array of 15 symbols (3 rows × 5 columns)
   */
  function buildReelsFinal(randomFn, reelStrips, options = {}) {
    const nextRandom = typeof randomFn === 'function' ? randomFn : Math.random;
    const rows = options.rows || ROWS;
    const cols = options.cols || COLS;
    const final = Array(rows * cols).fill(null);
    const starts = [];
    for (let col = 0; col < cols; col += 1) {
      const strip = reelStrips[col];
      const start = Math.floor(nextRandom() * strip.length);
      starts.push(start);
      for (let row = 0; row < rows; row += 1) {
        final[row * cols + col] = cloneSymbol(strip[(start + row) % strip.length]);
      }
    }
    return { final, starts };
  }

  /**
   * Randomly selects a symbol to be the special symbol during free spins
   * @param {Function} randomFn - Random number generator function (0-1)
   * @param {Symbol[]} [symbols] - Array of symbols to choose from
   * @returns {Symbol} The chosen free spin symbol
   */
  function pickFreeSpinSymbol(randomFn, symbols = SYMBOLS) {
    const nextRandom = typeof randomFn === 'function' ? randomFn : Math.random;
    return cloneSymbol(symbols[Math.floor(nextRandom() * symbols.length)]);
  }

  function buildBonusPickDeck(randomFn, bonusPackages = BONUS_PICK_OPTIONS) {
    const nextRandom = typeof randomFn === 'function' ? randomFn : Math.random;
    const deck = bonusPackages
      .map(cloneBonusPickTile)
      .filter(function (option) { return !!option; });
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(nextRandom() * (index + 1));
      const current = deck[index];
      deck[index] = deck[swapIndex];
      deck[swapIndex] = current;
    }
    return deck;
  }

  function pickBonusPackage(randomFn, bonusPackages = BONUS_PICK_OPTIONS, options = {}) {
    const deck = buildBonusPickDeck(randomFn, bonusPackages);
    const revealCount = Math.max(1, Math.floor(options.revealCount || BONUS_PICK_REVEAL_COUNT));
    return composeBonusPackage(deck.slice(0, revealCount), options);
  }

  function applyBonusPackage(featureState = {}, bonusPackage = null) {
    const selected = cloneBonusPickOption(bonusPackage) || composeBonusPackage([], {});
    return {
      ...featureState,
      freeSpins: Math.max(1, Math.floor(selected.freeSpins || featureState.freeSpins || BASE_FREE_SPINS)),
      bonusMultiplier: normalizeBonusMultiplier(selected.multiplier, 1),
      stickyWildColumns: normalizeStickyWildColumns(selected.stickyWildColumns)
    };
  }

  // ==================== FEATURE STATE MANAGEMENT ====================

  /**
   * Checks if the free spins feature is currently active
   * @param {Object} [state={}] - Current game state
   * @param {boolean} [state.inFreeSpins] - Whether in free spins mode
   * @param {number} [state.freeSpins] - Remaining free spins count
   * @returns {boolean} True if feature is active
   */
  function isFeatureSpinActive(state = {}) {
    return state.inFreeSpins === true || Math.max(0, Math.floor(state.freeSpins || 0)) > 0;
  }

  /**
   * Gets the context for the current spin (stake and feature status)
   * @param {Object} [state={}] - Current game state
   * @param {number} [bet=1] - Current bet amount
   * @returns {{startedInFreeSpins: boolean, spinStake: number}} Spin context
   */
  function getSpinContext(state = {}, bet = 1) {
    const startedInFreeSpins = isFeatureSpinActive(state);
    const featureBet = state.featureBet == null ? bet : state.featureBet;
    return {
      startedInFreeSpins,
      spinStake: startedInFreeSpins ? featureBet : bet
    };
  }

  /**
   * Advances the feature state based on scatter count and current state
   * Handles bonus triggers, retriggers, and free spin countdown
   * @param {Object} [state={}] - Current feature state
   * @param {Object} [options={}] - Configuration and spin result
   * @param {number} [options.finalScatter] - Number of scatter symbols in result
   * @param {boolean} [options.startedInFreeSpins] - Whether spin started in feature
   * @param {number} [options.scatterTriggerCount] - Scatters needed to trigger
   * @param {number} [options.retriggerScatterCount] - Scatters needed to retrigger
   * @param {number} [options.baseFreeSpins] - Free spins awarded per trigger
   * @param {number} [options.maxFreeSpins] - Maximum free spins allowed
   * @param {number} [options.triggerFeatureBet] - Bet amount when triggering
   * @param {Function} [options.pickFreeSpinSymbol] - Function to pick special symbol
   * @returns {{inFreeSpins: boolean, freeSpins: number, featureBet: number|null, freeSpinSymbol: Symbol|null, bonusMultiplier: number, stickyWildColumns: number[], bonusTriggered: boolean, retriggerTriggered: boolean}} New feature state
   */
  function advanceFeatureState(state = {}, options = {}) {
    const startedInFreeSpins = options.startedInFreeSpins == null
      ? isFeatureSpinActive(state)
      : options.startedInFreeSpins === true;
    const finalScatter = Number(options.finalScatter) || 0;
    const scatterTriggerCount = options.scatterTriggerCount == null
      ? SCATTER_TRIGGER_COUNT
      : options.scatterTriggerCount;
    const retriggerScatterCount = options.retriggerScatterCount == null
      ? RETRIGGER_SCATTER_COUNT
      : options.retriggerScatterCount;
    const baseFreeSpins = options.baseFreeSpins == null ? BASE_FREE_SPINS : options.baseFreeSpins;
    const maxFreeSpins = options.maxFreeSpins == null ? MAX_FREE_SPINS : options.maxFreeSpins;
    const triggerFeatureBet = Object.prototype.hasOwnProperty.call(options, 'triggerFeatureBet')
      ? options.triggerFeatureBet
      : state.featureBet;
    const resetFeatureBetTo = Object.prototype.hasOwnProperty.call(options, 'resetFeatureBetTo')
      ? options.resetFeatureBetTo
      : null;
    const pickSymbol = typeof options.pickFreeSpinSymbol === 'function' ? options.pickFreeSpinSymbol : null;
    let inFreeSpins = state.inFreeSpins === true;
    let freeSpins = Math.max(0, Math.floor(state.freeSpins || 0));
    let featureBet = state.featureBet == null ? null : state.featureBet;
    let freeSpinSymbol = state.freeSpinSymbol ? cloneSymbol(state.freeSpinSymbol) : null;
    let bonusMultiplier = normalizeBonusMultiplier(state.bonusMultiplier, 1);
    let stickyWildColumns = normalizeStickyWildColumns(state.stickyWildColumns);
    let bonusTriggered = false;
    let retriggerTriggered = false;

    if (!startedInFreeSpins && finalScatter >= scatterTriggerCount) {
      bonusTriggered = true;
      inFreeSpins = true;
      freeSpins = Math.min(maxFreeSpins, freeSpins + baseFreeSpins);
      featureBet = triggerFeatureBet;
      bonusMultiplier = 1;
      stickyWildColumns = [];
      if (pickSymbol) freeSpinSymbol = cloneSymbol(pickSymbol());
    } else if (startedInFreeSpins && finalScatter >= retriggerScatterCount) {
      retriggerTriggered = true;
      inFreeSpins = true;
      freeSpins = Math.min(maxFreeSpins, freeSpins + baseFreeSpins);
    }

    if (startedInFreeSpins) {
      freeSpins = Math.max(0, freeSpins - 1);
      if (freeSpins === 0) {
        inFreeSpins = false;
        freeSpinSymbol = null;
        featureBet = resetFeatureBetTo;
        bonusMultiplier = 1;
        stickyWildColumns = [];
      } else {
        inFreeSpins = true;
      }
    }

    return {
      inFreeSpins,
      freeSpins,
      featureBet,
      freeSpinSymbol,
      bonusMultiplier,
      stickyWildColumns,
      bonusTriggered,
      retriggerTriggered
    };
  }

  /**
   * Expands special symbols to fill entire reels during free spins
   * When the free spin symbol appears on a reel, all positions on that reel
   * become the special symbol
   * @param {Symbol[]} grid - The current symbol grid (flat array)
   * @param {Symbol|null} freeSpinSymbol - The special expansion symbol
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.rows] - Number of rows
   * @param {number} [options.cols] - Number of columns
   * @returns {{displayGrid: Symbol[], expandedColumns: number[]}} Expanded grid and column indices
   */
  function expandSpecialSymbolGrid(grid, freeSpinSymbol, options = {}) {
    const rows = options.rows || ROWS;
    const cols = options.cols || COLS;
    const displayGrid = grid.map(cloneSymbol);
    const expandedColumns = [];
    if (!freeSpinSymbol) return { displayGrid, expandedColumns };
    for (let col = 0; col < cols; col += 1) {
      let hasSpecial = false;
      for (let row = 0; row < rows; row += 1) {
        const index = row * cols + col;
        if (displayGrid[index] && displayGrid[index].name === freeSpinSymbol.name) {
          hasSpecial = true;
          break;
        }
      }
      if (!hasSpecial) continue;
      expandedColumns.push(col);
      for (let row = 0; row < rows; row += 1) {
        const index = row * cols + col;
        displayGrid[index] = { ...cloneSymbol(freeSpinSymbol), isExpanded: true };
      }
    }
    return { displayGrid, expandedColumns };
  }

  function applyStickyWildColumns(grid, stickyWildColumns, options = {}) {
    const rows = options.rows || ROWS;
    const cols = options.cols || COLS;
    const displayGrid = grid.map(cloneSymbol);
    const stickyColumns = normalizeStickyWildColumns(stickyWildColumns, cols);
    if (!stickyColumns.length) return { displayGrid, stickyColumns };
    const baseStickyWildSymbol = options.stickyWildSymbol
      || (Array.isArray(options.symbols)
        ? options.symbols.find(function (symbol) { return symbol && symbol.isWild; })
        : null)
      || SYMBOLS.find(function (symbol) { return symbol && symbol.isWild; })
      || options.scatterSymbol
      || SCATTER;
    const stickyWildSymbol = buildStickyWildSymbol(baseStickyWildSymbol);
    stickyColumns.forEach(function (col) {
      for (let row = 0; row < rows; row += 1) {
        const index = row * cols + col;
        displayGrid[index] = {
          ...cloneSymbol(stickyWildSymbol),
          isSticky: true
        };
      }
    });
    return { displayGrid, stickyColumns };
  }

  /**
   * Evaluates a single payline to determine the best winning combination
   * @param {Symbol[]} grid - The symbol grid (flat array)
   * @param {number[]} payline - Array of cell indices forming the payline
   * @param {number} stake - Bet amount for this spin
   * @param {Object} [options={}] - Configuration options
   * @param {Symbol[]} [options.symbols] - Array of symbols to check
   * @param {Object} [options.paytable] - Paytable for lookups
   * @param {string} [options.excludedName] - Symbol name to exclude from evaluation
   * @param {number} [options.paylineIndex] - Index of this payline
   * @param {Function} [options.symbolLabel] - Function to get symbol labels
   * @returns {Object|null} Win object or null if no win
   * @property {number[]} line - The payline indices
   * @property {string} symbol - Display name of winning symbol
   * @property {string} symbolName - Internal name of winning symbol
   * @property {number} count - Number of matching symbols
   * @property {number} payoutMultiplier - Win multiplier
   * @property {number} payout - Total payout amount
   * @property {number[]} indices - Indices of winning symbols
   */
  function evaluatePayline(grid, payline, stake, options = {}) {
    const symbols = options.symbols || SYMBOLS;
    const paytable = options.paytable || PAYTABLE;
    const excludedName = options.excludedName || null;
    const paylineIndex = Number.isInteger(options.paylineIndex) ? options.paylineIndex : -1;
    const labelForSymbol = options.symbolLabel || symbolLabel;
    let bestWin = null;
    for (const candidate of symbols) {
      if (excludedName && candidate.name === excludedName) continue;
      let count = 0;
      let naturalCount = 0;
      const indices = [];
      for (let index = 0; index < payline.length; index += 1) {
        const symbol = grid[payline[index]];
        if (symbol && (symbol.name === candidate.name || symbol.isWild)) {
          count += 1;
          indices.push(payline[index]);
          if (symbol.name === candidate.name) naturalCount += 1;
          continue;
        }
        break;
      }
      const payoutMultiplier = payoutForCount(paytable, candidate.name, count);
      if (count < minCountForSymbol(paytable, candidate.name) || naturalCount === 0 || !payoutMultiplier) continue;
      const payout = payoutMultiplier * stake;
      if (!bestWin || payout > bestWin.payout || (payout === bestWin.payout && count > bestWin.count)) {
        bestWin = {
          line: payline,
          symbol: labelForSymbol(candidate),
          symbolName: candidate.name,
          count,
          payoutMultiplier,
          payout,
          indices,
          paylineIndex,
          drawIndices: indices,
          highlightIndices: indices
        };
      }
    }
    return bestWin;
  }

  /**
   * Evaluates wins from expanded special symbols during free spins
   * @param {Symbol[]} displayGrid - Grid with expanded symbols
   * @param {number[]} expandedColumns - Columns that were expanded
   * @param {number[][]} paylines - All paylines to check
   * @param {number} stake - Bet amount
   * @param {Object} [options={}] - Configuration options
   * @returns {Object[]} Array of win objects from expanded symbols
   */
  function evaluateExpandedSpecialWins(displayGrid, expandedColumns, paylines, stake, options = {}) {
    const freeSpinSymbol = options.freeSpinSymbol || null;
    const paytable = options.paytable || PAYTABLE;
    const labelForSymbol = options.symbolLabel || symbolLabel;
    if (!freeSpinSymbol) return [];
    const wins = [];
    const minCount = minCountForSymbol(paytable, freeSpinSymbol.name);
    if (!expandedColumns || expandedColumns.length < minCount) return wins;
    for (let paylineIndex = 0; paylineIndex < paylines.length; paylineIndex += 1) {
      const payline = paylines[paylineIndex];
      let count = 0;
      let naturalCount = 0;
      const highlightIndices = [];
      for (let index = 0; index < payline.length; index += 1) {
        const cellIndex = payline[index];
        const symbol = displayGrid[cellIndex];
        if (symbol && (symbol.name === freeSpinSymbol.name || symbol.isWild)) {
          count += 1;
          highlightIndices.push(cellIndex);
          if (symbol.name === freeSpinSymbol.name) naturalCount += 1;
          continue;
        }
        break;
      }
      const payoutMultiplier = payoutForCount(paytable, freeSpinSymbol.name, count);
      if (count < minCount || naturalCount === 0 || !payoutMultiplier) continue;
      wins.push({
        line: payline,
        symbol: labelForSymbol(freeSpinSymbol) + ' Espanso',
        symbolName: freeSpinSymbol.name,
        count,
        payoutMultiplier,
        payout: payoutMultiplier * stake,
        indices: highlightIndices,
        paylineIndex,
        drawIndices: payline,
        highlightIndices,
        isExpansion: true
      });
    }
    return wins;
  }

  /**
   * Evaluates the entire reel outcome including all paylines and scatter wins
   * This is the main evaluation function called after each spin
   * @param {Symbol[]} grid - The final symbol grid to evaluate
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.stake] - Bet amount
   * @param {boolean} [options.isFreeSpin] - Whether this is a free spin
   * @param {Symbol} [options.freeSpinSymbol] - Special symbol for free spins
   * @param {Object} [options.paytable] - Paytable for lookups
   * @param {Object} [options.scatterPayout] - Scatter payout table
   * @param {Symbol[]} [options.symbols] - All symbols
   * @param {number} [options.rows] - Grid rows
   * @param {number} [options.cols] - Grid columns
   * @param {number[]} [options.stickyWildColumns] - Sticky wild reel indices active during the bonus
   * @returns {{win: number, finalScatter: number, wins: Object[], displayGrid: Symbol[], expandedColumns: number[], stickyColumns: number[], featureColumns: number[], scatterWin: number}} Complete evaluation result
   */
  function evaluateReels(grid, options = {}) {
    const stake = options.stake == null ? 1 : options.stake;
    const isFreeSpin = options.isFreeSpin === true;
    const freeSpinSymbol = options.freeSpinSymbol || null;
    const paytable = options.paytable || PAYTABLE;
    const scatterPayout = options.scatterPayout || SCATTER_PAYOUT;
    const symbols = options.symbols || SYMBOLS;
    const rows = options.rows || ROWS;
    const cols = options.cols || COLS;
    const labelForSymbol = options.symbolLabel || symbolLabel;
    const stickyWildColumns = normalizeStickyWildColumns(options.stickyWildColumns, cols);

    const paylines = getPaylines(rows, cols);
    let total = 0;
    let scatterCount = 0;
    const wins = [];
    const stickyState = applyStickyWildColumns(grid, stickyWildColumns, {
      rows,
      cols,
      symbols,
      stickyWildSymbol: options.stickyWildSymbol,
      scatterSymbol: options.scatterSymbol || SCATTER
    });
    const evaluationGrid = stickyState.displayGrid;
    for (const symbol of evaluationGrid) {
      if (symbol && symbol.isScatter) scatterCount += 1;
    }

    const scatterWin = payoutForScatter(scatterPayout, scatterCount) * stake;
    total += scatterWin;
    let displayGrid = evaluationGrid.map(cloneSymbol);
    let expandedColumns = [];
    let featureColumns = stickyState.stickyColumns.slice();

    for (let paylineIndex = 0; paylineIndex < paylines.length; paylineIndex += 1) {
      const payline = paylines[paylineIndex];
      const win = evaluatePayline(evaluationGrid, payline, stake, {
        symbols,
        paytable,
        excludedName: isFreeSpin && freeSpinSymbol ? freeSpinSymbol.name : null,
        paylineIndex,
        symbolLabel: labelForSymbol
      });
      if (!win) continue;
      total += win.payout;
      wins.push(win);
    }

    if (isFreeSpin && freeSpinSymbol) {
      const expandedState = expandSpecialSymbolGrid(evaluationGrid, freeSpinSymbol, { rows, cols });
      if (expandedState.expandedColumns.length) {
        displayGrid = expandedState.displayGrid;
        expandedColumns = expandedState.expandedColumns;
        featureColumns = Array.from(new Set(featureColumns.concat(expandedColumns)))
          .sort(function (left, right) { return left - right; });
      }
      const specialWins = evaluateExpandedSpecialWins(expandedState.displayGrid, expandedState.expandedColumns, paylines, stake, {
        freeSpinSymbol,
        paytable,
        symbolLabel: labelForSymbol
      });
      if (specialWins.length) {
        specialWins.forEach(function (win) {
          total += win.payout;
          wins.push(win);
        });
      }
    }

    return {
      win: total,
      finalScatter: scatterCount,
      wins,
      displayGrid,
      expandedColumns,
      stickyColumns: stickyState.stickyColumns,
      featureColumns,
      scatterWin
    };
  }

  /**
   * Scales all paytable values by a given factor
   * Useful for implementing bet multipliers or different stake levels
   * @param {number} factor - Multiplier to apply to all payouts
   * @param {Object} [paytable] - Regular symbol paytable
   * @param {Object} [scatterPayout] - Scatter payout table
   * @returns {{paytable: Object, scatterPayout: Object}} Scaled paytable and scatter payout
   * @example
   * const scaled = scalePaytable(2, PAYTABLE, SCATTER_PAYOUT);
   * // All payouts are now doubled
   */
  function scalePaytable(factor, paytable = PAYTABLE, scatterPayout = SCATTER_PAYOUT) {
    const scaledPaytable = {};
    Object.entries(paytable).forEach(function (entry) {
      const name = entry[0];
      const table = entry[1];
      scaledPaytable[name] = {};
      Object.entries(table).forEach(function (countEntry) {
        scaledPaytable[name][countEntry[0]] = countEntry[1] * factor;
      });
    });
    const scaledScatter = {};
    Object.entries(scatterPayout).forEach(function (entry) {
      scaledScatter[entry[0]] = entry[1] * factor;
    });
    return { paytable: scaledPaytable, scatterPayout: scaledScatter };
  }

  function applyResultMultiplier(result = {}, multiplier = 1) {
    const factor = normalizeBonusMultiplier(multiplier, 1);
    if (!(factor > 1)) return result;
    const scaledWins = Array.isArray(result.wins)
      ? result.wins.map(function (win) {
        return win
          ? { ...win, payout: (Number(win.payout) || 0) * factor }
          : win;
      })
      : result.wins;
    return {
      ...result,
      win: (Number(result.win) || 0) * factor,
      scatterWin: (Number(result.scatterWin) || 0) * factor,
      wins: scaledWins
    };
  }

  // ==================== PUBLIC API ====================
  
  /**
   * SlotCore module exports
   * Provides all constants, configuration, and functions for slot game logic
   */
  return {
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
    PORTRAIT_SYMBOL_COUNT,
    SYMBOL_WEIGHTS,
    BONUS_PICK_REVEAL_COUNT,
    BONUS_PICK_MAX_FREE_SPINS,
    BONUS_PICK_MAX_MULTIPLIER,
    BONUS_PICK_MAX_STICKY_REELS,
    BONUS_PICK_BASE_PACKAGE,
    SYMBOLS,
    SCATTER,
    PAYTABLE,
    SCATTER_PAYOUT,
    BONUS_PICK_OPTIONS,
    cloneSymbol,
    normalizeBonusMultiplier,
    normalizeStickyWildColumns,
    cloneBonusPickOption,
    cloneBonusPickTile,
    resolveBonusStickyWildColumns,
    composeBonusPackage,
    buildStickyWildSymbol,
    symbolLabel,
    payoutForCount,
    payoutForScatter,
    minCountForSymbol,
    getPaylines,
    buildWeightedSymbols,
    buildStripAllocations,
    initReelStrips,
    buildReelsFinal,
    pickFreeSpinSymbol,
    buildBonusPickDeck,
    pickBonusPackage,
    applyBonusPackage,
    isFeatureSpinActive,
    getSpinContext,
    advanceFeatureState,
    expandSpecialSymbolGrid,
    applyStickyWildColumns,
    evaluatePayline,
    evaluateExpandedSpecialWins,
    evaluateReels,
    scalePaytable,
    applyResultMultiplier
  };
});
