# CRASHHOUSE Slot Machine - API Reference

Complete API documentation for all public modules and functions.

## Table of Contents

- [SlotCore](#slotcore)
- [MainApp](#mainapp)
- [SlotRenderer](#slotrenderer)
- [SpinRuntime](#spinruntime)
- [RuntimeSession](#runtimesession)
- [CabinetUI](#cabinetui)
- [SlotAudio](#slotaudio)
- [SeededRng](#seededrng)
- [GameConfig](#gameconfig)
- [ViewportFit](#viewportfit)
- [RuntimeUI](#runtimeui)

---

## SlotCore

Core game logic module containing all slot mathematics and rules.

### Constants

```javascript
SlotCore.ROWS                      // Number of rows (3)
SlotCore.COLS                      // Number of columns (5)
SlotCore.TOTAL                     // Total cells (15)
SlotCore.BASE_FREE_SPINS           // Free spins awarded (12)
SlotCore.MAX_FREE_SPINS            // Maximum free spins (100)
SlotCore.SCATTER_TRIGGER_COUNT     // Scatters to trigger (3)
SlotCore.RETRIGGER_SCATTER_COUNT   // Scatters to retrigger (4)
SlotCore.REEL_STRIP_LEN            // Virtual reel length (256)
SlotCore.SYMBOLS                   // Array of symbol definitions
SlotCore.SCATTER                   // Scatter symbol definition
SlotCore.PAYTABLE                  // Paytable object
SlotCore.SCATTER_PAYOUT            // Scatter payout table
```

### Functions

#### `cloneSymbol(symbol)`

Creates a shallow copy of a symbol object.

**Parameters:**
- `symbol` (Object|null) - Symbol to clone

**Returns:** (Object|null) - Cloned symbol

**Example:**
```javascript
const copy = SlotCore.cloneSymbol({ name: 'S1', label: 'Portrait 1' });
```

#### `symbolLabel(symbolOrName)`

Gets the display label for a symbol.

**Parameters:**
- `symbolOrName` (Object|string|null) - Symbol object or name string

**Returns:** (string) - Display label

**Example:**
```javascript
const label = SlotCore.symbolLabel('S1'); // Returns 'Ritratto 1'
```

#### `payoutForCount(paytable, name, count)`

Calculates payout multiplier for a symbol and count.

**Parameters:**
- `paytable` (Object) - Paytable lookup object
- `name` (string) - Symbol name
- `count` (number) - Number of matching symbols

**Returns:** (number) - Payout multiplier

**Example:**
```javascript
const multiplier = SlotCore.payoutForCount(SlotCore.PAYTABLE, 'S1', 5);
// Returns 1200
```

#### `getPaylines(rows, cols)`

Generates all payline patterns.

**Parameters:**
- `rows` (number) - Number of rows (default: 3)
- `cols` (number) - Number of columns (default: 5)

**Returns:** (Array<Array<number>>) - Array of paylines

**Example:**
```javascript
const paylines = SlotCore.getPaylines(3, 5);
// Returns [[0,1,2,3,4], [5,6,7,8,9], ...]
```

#### `buildWeightedSymbols(options)`

Builds weighted symbol list with relative frequencies.

**Parameters:**
- `options` (Object) - Configuration object
  - `symbols` (Array) - Array of symbols
  - `scatter` (Object) - Scatter symbol
  - `symbolWeights` (Array<number>) - Weight for each symbol
  - `scatterWeight` (number) - Scatter weight

**Returns:** (Array<{sym: Object, weight: number}>) - Weighted symbols

#### `initReelStrips(weighted, options)`

Initializes virtual reel strips with distributed symbols.

**Parameters:**
- `weighted` (Array) - Weighted symbols
- `options` (Object) - Configuration
  - `cols` (number) - Number of reels
  - `stripLength` (number) - Length of each strip
  - `reelStripSteps` (Array<number>) - Step patterns
  - `reelStripOffsets` (Array<number>) - Offset patterns

**Returns:** (Array<Array<Symbol>>) - Array of reel strips

#### `buildReelsFinal(randomFn, reelStrips, options)`

Generates final reel outcome by sampling from strips.

**Parameters:**
- `randomFn` (Function) - Random number generator (0-1)
- `reelStrips` (Array<Array<Symbol>>) - Virtual reel strips
- `options` (Object) - Configuration
  - `rows` (number) - Visible rows
  - `cols` (number) - Number of reels

**Returns:** (Object) - `{ final: Symbol[], starts: number[] }`

**Example:**
```javascript
const { final, starts } = SlotCore.buildReelsFinal(
  Math.random,
  reelStrips,
  { rows: 3, cols: 5 }
);
```

#### `evaluateReels(grid, options)`

Evaluates complete spin result including all paylines and scatters.

**Parameters:**
- `grid` (Array<Symbol>) - Flat array of 15 symbols
- `options` (Object) - Configuration
  - `stake` (number) - Bet amount
  - `isFreeSpin` (boolean) - Whether in free spins
  - `freeSpinSymbol` (Symbol) - Special expansion symbol
  - `paytable` (Object) - Paytable
  - `scatterPayout` (Object) - Scatter payouts
  - `symbols` (Array) - All symbols
  - `rows` (number) - Grid rows
  - `cols` (number) - Grid columns

**Returns:** (Object) - Evaluation result
```javascript
{
  win: number,              // Total win amount
  finalScatter: number,     // Number of scatter symbols
  wins: Array<Object>,      // Individual win details
  displayGrid: Array,       // Grid with expansions
  expandedColumns: Array,   // Expanded column indices
  scatterWin: number        // Scatter contribution
}
```

#### `advanceFeatureState(state, options)`

Advances feature state based on spin result.

**Parameters:**
- `state` (Object) - Current feature state
- `options` (Object) - Spin result and configuration
  - `finalScatter` (number) - Scatter count
  - `startedInFreeSpins` (boolean) - Started in feature
  - `scatterTriggerCount` (number) - Trigger threshold
  - `retriggerScatterCount` (number) - Retrigger threshold
  - `baseFreeSpins` (number) - Spins awarded
  - `triggerFeatureBet` (number) - Bet when triggered
  - `pickFreeSpinSymbol` (Function) - Symbol picker

**Returns:** (Object) - New feature state
```javascript
{
  inFreeSpins: boolean,
  freeSpins: number,
  featureBet: number|null,
  freeSpinSymbol: Symbol|null,
  bonusTriggered: boolean,
  retriggerTriggered: boolean
}
```

#### `scalePaytable(factor, paytable, scatterPayout)`

Scales all paytable values by a multiplier.

**Parameters:**
- `factor` (number) - Multiplier
- `paytable` (Object) - Original paytable
- `scatterPayout` (Object) - Original scatter payouts

**Returns:** (Object) - `{ paytable: Object, scatterPayout: Object }`

**Example:**
```javascript
// Double all payouts
const scaled = SlotCore.scalePaytable(2.0);
```

---

## MainApp

Application orchestrator managing dependency injection and lifecycle.

### Functions

#### `startMainApp(options)`

Creates and starts the complete application.

**Parameters:**
- `options` (Object) - Configuration
  - `windowRef` (Window) - Window object
  - `documentRef` (Document) - Document object
  - `globalRoot` (Object) - Global scope
  - `storage` (Storage) - localStorage reference
  - Plus browser API references (setTimeout, requestAnimationFrame, etc.)

**Returns:** (Object) - Application instance with all controllers

**Example:**
```javascript
const app = MainApp.startMainApp({
  windowRef: window,
  documentRef: document,
  storage: localStorage
});
```

#### `createMainApp(options)`

Creates application without starting it.

**Parameters:** Same as `startMainApp`

**Returns:** (Object) - Application instance (not initialized)

#### `buildAppControllerOptions(options)`

Builds configuration for app controllers.

**Parameters:**
- `options` (Object) - Dependencies and configuration

**Returns:** (Object) - Complete controller options

---

## SlotRenderer

Manages visual rendering of the slot grid.

### `createSlotRendererController(options)`

Creates a renderer controller.

**Parameters:**
- `options` (Object) - Configuration
  - `slotEl` (HTMLElement) - Container element
  - `documentRef` (Document) - Document reference
  - `symbols` (Array) - Symbol definitions
  - `scatter` (Object) - Scatter symbol
  - `rng` (Function) - Random number generator
  - `symbolLabel` (Function) - Label formatter
  - `cloneSymbol` (Function) - Symbol cloner
  - `buildWeightedSymbols` (Function) - Weight builder
  - `initReelStrips` (Function) - Strip initializer
  - `buildReelsFinal` (Function) - Outcome generator
  - Plus many other options...

**Returns:** (Object) - Renderer controller

### Controller Methods

#### `buildGrid()`

Creates the DOM structure for the slot grid.

**Returns:** void

#### `getCells()`

Gets all cell elements.

**Returns:** (Array<HTMLElement>) - Cell elements

#### `getFaces()`

Gets all symbol face image elements.

**Returns:** (Array<HTMLImageElement>) - Face images

#### `syncCellSymbol(cell, symbol, options)`

Updates a cell with a new symbol.

**Parameters:**
- `cell` (HTMLElement) - Cell element
- `symbol` (Object) - Symbol to display
- `options` (Object) - Sync options
  - `syncGhost` (boolean) - Also sync ghost element
  - `skipFaceMeta` (boolean) - Skip alt/title

**Returns:** void

#### `animateTumble(finalGrid, drop, newFlag)`

Animates symbol changes with tumble effect.

**Parameters:**
- `finalGrid` (Array<Symbol>) - New symbols
- `drop` (Array<number>) - Drop distances
- `newFlag` (Array<boolean>) - New symbol flags

**Returns:** (Promise) - Resolves when animation completes

#### `preloadImages()`

Preloads all symbol images.

**Returns:** (Map) - Image cache

#### `initReelStrips()`

Initializes virtual reel strips.

**Returns:** (Array<Array<Symbol>>) - Reel strips

#### `buildReelsFinal()`

Generates a random spin outcome.

**Returns:** (Object) - `{ final: Symbol[], starts: number[] }`

---

## SpinRuntime

Controls spin sequences and animations.

### `createSpinRuntimeController(options)`

Creates spin runtime controller.

**Parameters:**
- Extensive options object with:
  - DOM references
  - Browser API references
  - State accessors
  - Callback functions
  - Configuration constants

**Returns:** (Object) - Runtime controller

### Controller Methods

#### `performSpin()`

Executes a complete spin cycle.

**Returns:** (Promise) - Resolves when spin completes

**Example:**
```javascript
await spinRuntime.performSpin();
```

#### `startAutoSpin(count)`

Starts auto-spin mode.

**Parameters:**
- `count` (number) - Number of auto-spins

**Returns:** void

#### `stopAutoSpin()`

Stops auto-spin mode.

**Returns:** void

#### `isAutoSpinActive()`

Checks if auto-spin is running.

**Returns:** (boolean) - True if active

---

## RuntimeSession

Manages game state and persistence.

### `createRuntimeSession(options)`

Creates runtime session manager.

**Parameters:**
- `options` (Object) - Configuration
  - `storage` (Storage) - localStorage reference
  - `storageKey` (string) - Storage key
  - `minBet` (number) - Minimum bet
  - `maxBet` (number) - Maximum bet
  - `betStep` (number) - Bet increment
  - `initialBalance` (number) - Starting balance
  - `initialBetPerSpin` (number) - Initial bet
  - Plus game configuration...

**Returns:** (Object) - Session manager

### Session Methods

#### `getBalance()`

Gets current balance.

**Returns:** (number) - Balance

#### `setBalance(value)`

Sets balance.

**Parameters:**
- `value` (number) - New balance

**Returns:** void

#### `getBetPerSpin()`

Gets current bet amount.

**Returns:** (number) - Bet amount

#### `setBetPerSpin(value)`

Sets bet amount.

**Parameters:**
- `value` (number) - New bet

**Returns:** void

#### `increaseBet()`

Increases bet by one step.

**Returns:** void

#### `decreaseBet()`

Decreases bet by one step.

**Returns:** void

#### `getAnteOn()`

Checks if ante bet is enabled.

**Returns:** (boolean) - Ante status

#### `setAnteOn(value)`

Sets ante bet status.

**Parameters:**
- `value` (boolean) - Ante enabled

**Returns:** void

#### `getInFreeSpins()`

Checks if in free spins mode.

**Returns:** (boolean) - Free spins status

#### `getFreeSpins()`

Gets remaining free spins.

**Returns:** (number) - Free spin count

#### `getFreeSpinSymbol()`

Gets special free spin symbol.

**Returns:** (Symbol|null) - Expansion symbol

---

## CabinetUI

Manages UI panels and overlays.

### `createPaytableController(options)`

Creates paytable panel controller.

**Parameters:**
- Extensive options with DOM references, game config, and callbacks

**Returns:** (Object) - Paytable controller

### Paytable Methods

#### `openPaytable()`

Opens the paytable panel.

**Returns:** void

#### `closePaytable()`

Closes the paytable panel.

**Returns:** void

#### `switchTab(tabName)`

Switches to a different paytable tab.

**Parameters:**
- `tabName` (string) - 'values' or 'lines'

**Returns:** void

---

## SlotAudio

Manages all sound effects.

### `createSlotAudioController(options)`

Creates audio controller.

**Parameters:**
- `options` (Object) - Configuration
  - `audioContext` (AudioContext) - Web Audio context
  - `soundPath` (string) - Path to sound files
  - Plus volume settings

**Returns:** (Object) - Audio controller

### Audio Methods

#### `playReelStartSound()`

Plays reel start sound.

**Returns:** void

#### `playReelStopSound()`

Plays reel stop sound.

**Returns:** void

#### `playSmallWinSound()`

Plays small win celebration.

**Returns:** void

#### `playBigWinSound()`

Plays big win celebration.

**Returns:** void

#### `playClick()`

Plays UI click sound.

**Returns:** void

---

## SeededRng

Seeded random number generator for deterministic outcomes.

### `createSeededRngController(options)`

Creates RNG controller.

**Parameters:**
- `options` (Object) - Configuration
  - `windowRef` (Window) - Window reference
  - `cryptoRef` (Crypto) - Web Crypto API

**Returns:** (Object) - RNG controller

### RNG Methods

#### `next()`

Generates next random number.

**Returns:** (number) - Random value between 0 and 1

#### `seedFromCrypto()`

Seeds the RNG from crypto.getRandomValues.

**Returns:** void

#### `setSeed(seed)`

Sets a specific seed.

**Parameters:**
- `seed` (number|Array) - Seed value(s)

**Returns:** void

---

## GameConfig

Configuration factory for game settings.

### `createGameConfig(options)`

Creates game configuration object.

**Parameters:**
- `options` (Object) - Configuration
  - `imgPrefix` (string) - Image path prefix
  - `coreSymbols` (Array) - Symbol definitions
  - `coreScatter` (Object) - Scatter definition
  - Plus many other settings

**Returns:** (Object) - Game configuration

### Config Properties

```javascript
{
  symbols: Array,           // All symbols with image URLs
  scatter: Object,          // Scatter symbol
  preloadUrls: Array,       // URLs to preload
  timings: Object,          // Animation timings
  minBet: number,           // Minimum bet
  maxBet: number,           // Maximum bet
  betStep: number,          // Bet increment
  initialBalance: number,   // Starting balance
  // ... many more
}
```

---

## ViewportFit

Responsive layout utilities.

### `createViewportFitController(options)`

Creates viewport controller.

**Parameters:**
- `options` (Object) - Configuration with DOM references

**Returns:** (Object) - Viewport controller

### Viewport Methods

#### `updateDimensions()`

Updates viewport dimensions and CSS variables.

**Returns:** void

#### `scheduleUpdate()`

Schedules a dimension update on next frame.

**Returns:** void

---

## RuntimeUI

UI synchronization utilities.

### `createRuntimeUIController(options)`

Creates runtime UI controller.

**Parameters:**
- Extensive options with state accessors and DOM references

**Returns:** (Object) - UI controller

### UI Methods

#### `updateUI()`

Updates all UI displays to match current state.

**Returns:** void

#### `syncCabinetLights(state)`

Syncs cabinet light state.

**Parameters:**
- `state` (string) - Light state ('idle', 'spinning', 'win')

**Returns:** void

---

## Type Definitions

### Symbol

```typescript
interface Symbol {
  name: string;           // Unique identifier (e.g., 'S1')
  label: string;          // Display label
  img?: string;           // Image URL
  isScatter?: boolean;    // Is scatter symbol
  isWild?: boolean;       // Is wild symbol
  isExpanded?: boolean;   // Is expanded (during free spins)
}
```

### Win

```typescript
interface Win {
  line: number[];         // Payline indices
  symbol: string;         // Display name
  symbolName: string;     // Internal name
  count: number;          // Matching symbols
  payoutMultiplier: number;  // Win multiplier
  payout: number;         // Win amount
  indices: number[];      // Winning positions
  paylineIndex: number;   // Payline number
  drawIndices: number[];  // Positions to draw line
  highlightIndices: number[];  // Positions to highlight
  isExpansion?: boolean;  // Is expansion win
}
```

### FeatureState

```typescript
interface FeatureState {
  inFreeSpins: boolean;
  freeSpins: number;
  featureBet: number | null;
  freeSpinSymbol: Symbol | null;
}
```

---

## Usage Examples

### Complete Integration Example

```javascript
// 1. Start the application
const app = MainApp.startMainApp();

// 2. Access controllers
const { appControllers, session, slotCore } = app;

// 3. Perform actions
session.increaseBet();
await appControllers.spinRuntime.performSpin();

// 4. Check state
const balance = session.getBalance();
const inBonus = session.getInFreeSpins();

// 5. Access core logic
const paylines = slotCore.getPaylines();
```

### Testing Example

```javascript
// Mock dependencies for testing
const mockRng = () => 0.5;
const mockDocument = { createElement: () => ({}) };

// Create isolated controller
const renderer = SlotRenderer.createSlotRendererController({
  documentRef: mockDocument,
  rng: mockRng,
  symbols: testSymbols
});

// Test functionality
renderer.buildGrid();
const cells = renderer.getCells();
assert(cells.length === 15);
```

---

## Best Practices

1. **Always inject dependencies** - Don't use globals
2. **Use type checking** - Validate parameters
3. **Handle nulls** - Check for null/undefined
4. **Clone when mutating** - Avoid side effects
5. **Return promises** - For async operations
6. **Document edge cases** - Add JSDoc comments
7. **Test with mocks** - Use dependency injection

---

## Support

For questions or issues:
- Check the [README](./README.md) for general info
- See [ARCHITECTURE](./ARCHITECTURE.md) for design details
- File issues on GitHub
- Reach out via Discord

**Happy coding!** 🎰✨
