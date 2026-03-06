# CRASHHOUSE Slot Machine - Architecture Documentation

This document provides a comprehensive overview of the system architecture, design patterns, and module relationships.

## Table of Contents

- [System Overview](#system-overview)
- [Design Principles](#design-principles)
- [Module Architecture](#module-architecture)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Dependency Injection](#dependency-injection)
- [Testing Strategy](#testing-strategy)
- [Performance Considerations](#performance-considerations)

## System Overview

The CRASHHOUSE slot machine is built as a modular, client-side JavaScript application with zero external dependencies. The architecture follows functional programming principles with clear separation of concerns.

### High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                          Browser Environment                     │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │    DOM     │  │ localStorage│  │  Web Audio │                │
│  └─────┬──────┘  └──────┬─────┘  └──────┬─────┘                │
│        │                 │                │                       │
└────────┼─────────────────┼────────────────┼───────────────────────┘
         │                 │                │
    ┌────▼─────────────────▼────────────────▼─────┐
    │              MainApp                         │
    │   (Dependency Injection Container)           │
    └────┬─────────────────┬────────────────┬─────┘
         │                 │                │
    ┌────▼─────┐     ┌────▼─────┐    ┌────▼─────┐
    │ SlotCore │     │ Runtime  │    │ UI Layer │
    │  (Logic) │     │ Services │    │(Rendering)│
    └──────────┘     └──────────┘    └──────────┘
```

### Layer Responsibilities

1. **Core Logic Layer** (`SlotCore`)
   - Pure game mechanics
   - Reel generation and evaluation
   - Win calculation
   - No side effects or DOM manipulation

2. **Runtime Services Layer**
   - **RuntimeSession**: State management and persistence
   - **SeededRng**: Random number generation
   - **RuntimeBridge**: Connects UI to core logic

3. **UI/Presentation Layer**
   - **SlotRenderer**: DOM manipulation and visual updates
   - **SpinRuntime**: Animation orchestration
   - **CabinetUI**: Control panels and overlays
   - **SlotAudio**: Sound effect management

4. **Orchestration Layer** (`MainApp`)
   - Dependency resolution
   - Module wiring
   - Application lifecycle

## Design Principles

### 1. Separation of Concerns

Each module has a single, well-defined responsibility:

```javascript
// SlotCore: Pure game logic, no side effects
const result = SlotCore.evaluateReels(grid, { stake: 1.0 });

// SlotRenderer: Only handles visual presentation
renderer.syncCellSymbol(cell, symbol);

// RuntimeSession: Only manages state
session.setBetPerSpin(10);
```

### 2. Dependency Injection

Dependencies are explicitly injected rather than imported globally:

```javascript
function createSlotRendererController(options = {}) {
  // Injected dependencies
  const documentRef = options.documentRef;
  const setTimeoutRef = options.setTimeoutRef;
  const rng = options.rng;
  
  // Controller logic...
}
```

Benefits:
- Testability (mock any dependency)
- Flexibility (swap implementations)
- Loose coupling

### 3. Pure Functions

Core game logic uses pure functions for determinism and testability:

```javascript
// Always produces the same output for the same input
function buildReelsFinal(randomFn, reelStrips, options) {
  // No global state, no side effects
  const nextRandom = typeof randomFn === 'function' ? randomFn : Math.random;
  // ... generate reels
  return { final, starts };
}
```

### 4. Immutability

State updates create new objects rather than mutating existing ones:

```javascript
// Clone symbols to avoid mutation
function cloneSymbol(symbol) {
  return symbol ? { ...symbol } : symbol;
}

// State updates return new state
function advanceFeatureState(state, options) {
  // Create new state object
  return {
    inFreeSpins: updatedValue,
    freeSpins: updatedCount,
    // ...
  };
}
```

### 5. Functional Composition

Complex behavior is built by composing simple functions:

```javascript
// Build reel strips from weighted symbols
const weighted = buildWeightedSymbols(options);
const allocations = buildStripAllocations(weighted, stripLength);
const strips = initReelStrips(weighted, options);
const { final, starts } = buildReelsFinal(rng, strips, options);
```

## Module Architecture

### Core Module: SlotCore

**Purpose**: Contains all game rules and mathematical logic

**Exports**:
- Constants (ROWS, COLS, PAYTABLE, etc.)
- Utility functions (cloneSymbol, symbolLabel)
- Reel generation (initReelStrips, buildReelsFinal)
- Win evaluation (evaluateReels, evaluatePayline)
- Feature logic (advanceFeatureState, expandSpecialSymbolGrid)

**Dependencies**: None (pure logic)

**Key Characteristics**:
- Stateless
- Side-effect free
- Fully testable with deterministic RNG

### Orchestrator: MainApp

**Purpose**: Wires together all application modules

**Functions**:
- `resolveAppDependencies()`: Loads modules from global scope
- `createMainAppContext()`: Sets up environment and config
- `createRuntimeServices()`: Initializes state management
- `buildAppControllerOptions()`: Prepares controller config
- `startMainApp()`: Bootstrap and run application

**Pattern**: Dependency Injection Container

```javascript
// MainApp resolves and injects everything
const app = MainApp.startMainApp({
  windowRef: window,
  documentRef: document,
  storage: localStorage
});

// App now has all controllers wired and ready
app.appControllers.spin(); // Everything just works
```

### Renderer: SlotRenderer

**Purpose**: Manages visual representation of the slot grid

**Key Methods**:
- `buildGrid()`: Creates DOM structure
- `syncCellSymbol(cell, symbol)`: Updates cell visuals
- `animateTumble(finalGrid, drop, newFlag)`: Animates transitions
- `preloadImages()`: Preloads symbol images

**Design Pattern**: Controller with encapsulated state

```javascript
const renderer = SlotRenderer.createSlotRendererController({
  slotEl: document.getElementById('slot'),
  symbols: SYMBOLS,
  scatter: SCATTER,
  rng: rng.next
});

renderer.buildGrid(); // Creates cells
const cells = renderer.getCells(); // Access grid
```

### Animation Controller: SpinRuntime

**Purpose**: Orchestrates spin sequences and animations

**Responsibilities**:
- Execute complete spin cycle
- Animate reel movement
- Present wins with effects
- Control auto-spin feature

**Async Flow**:

```javascript
async function performSpin() {
  // 1. Deduct bet
  deductSpinCost();
  
  // 2. Generate outcome
  const { final, starts } = await generateOutcome();
  
  // 3. Animate reels
  await animate(final, starts);
  
  // 4. Evaluate wins
  const result = await evaluateSpin(final);
  
  // 5. Award winnings
  await celebrateWin(result);
  
  // 6. Update state
  updateGameState(result);
}
```

### State Manager: RuntimeSession

**Purpose**: Manages game state and persistence

**State Structure**:

```javascript
{
  balance: 1000.0,              // Current balance
  betPerSpin: 10.0,             // Bet amount per spin
  anteOn: false,                // Ante bet toggle
  inFreeSpins: false,           // In bonus feature?
  freeSpins: 0,                 // Remaining free spins
  featureBet: null,             // Bet when bonus triggered
  freeSpinSymbol: null,         // Special expansion symbol
  lastCollectedWin: 0           // Most recent win amount
}
```

**Persistence**:
- State saved to localStorage on changes
- Restored on page load
- Configurable storage key

### Audio System: SlotAudio

**Purpose**: Manages all sound effects

**Sounds**:
- Lever pull
- Reel start/stop
- Coin insert
- Small win celebration
- Big win celebration
- UI clicks

**Pattern**: Lazy loading with pooling

```javascript
const audio = SlotAudio.createSlotAudioController({
  audioContext: new AudioContext(),
  soundPath: 'sounds/'
});

audio.playReelStartSound(); // Plays immediately if loaded
```

### UI Controller: CabinetUI

**Purpose**: Manages UI panels and overlays

**Components**:
- Paytable panel (symbol values and paylines)
- Settings panel
- Leaderboard
- Info displays

**Features**:
- Tab switching with animations
- Responsive layout
- Accessibility support

## Data Flow

### Spin Cycle Data Flow

```text
User Action (Click Spin)
    │
    ▼
┌─────────────────────┐
│   SpinRuntime       │──▶ Validate (enough balance?)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  RuntimeSession     │──▶ Deduct bet from balance
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   SeededRng         │──▶ Generate random numbers
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   SlotCore          │──▶ Build reel outcome
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  SlotRenderer       │──▶ Animate reels
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   SlotCore          │──▶ Evaluate wins
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  RuntimeSession     │──▶ Add winnings to balance
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  RuntimeUI          │──▶ Update UI displays
└─────────────────────┘
```

### Event Flow

```text
DOM Event (click, touch)
    │
    ▼
Event Handler (in controller)
    │
    ▼
State Update (RuntimeSession)
    │
    ▼
UI Synchronization (RuntimeUI)
    │
    ▼
Visual Feedback (DOM update)
```

## State Management

### State Architecture

```javascript
// Central state
{
  // Session state (persisted)
  session: {
    balance: number,
    betPerSpin: number,
    anteOn: boolean,
    // ...
  },
  
  // Feature state (persisted during feature)
  feature: {
    inFreeSpins: boolean,
    freeSpins: number,
    featureBet: number,
    freeSpinSymbol: Symbol
  },
  
  // UI state (ephemeral)
  ui: {
    spinInProgress: boolean,
    autoSpinState: {
      enabled: boolean,
      remaining: number
    }
  }
}
```

### State Updates

State updates follow a unidirectional flow:

1. **Action**: User interaction or system event
2. **Update**: Session.setX() modifies state
3. **Persist**: State saved to localStorage
4. **Notify**: UI controllers notified
5. **Render**: UI updated to reflect new state

```javascript
// Example: Increasing bet
function handleIncreaseBet() {
  session.increaseBet();           // 1. Update state
  persistCabinetState();           // 2. Save to storage
  updateUI();                      // 3. Refresh UI
}
```

## Dependency Injection

### Injection Patterns

#### 1. Factory Function Pattern

```javascript
function createController(options = {}) {
  // Extract dependencies from options
  const documentRef = options.documentRef || document;
  const windowRef = options.windowRef || window;
  
  // Use dependencies in closure
  function doSomething() {
    const element = documentRef.getElementById('foo');
    windowRef.setTimeout(() => {}, 100);
  }
  
  // Return public API
  return { doSomething };
}
```

#### 2. Options Object Pattern

```javascript
const controller = createController({
  // Core dependencies
  documentRef: document,
  windowRef: window,
  
  // Game logic
  symbols: SlotCore.SYMBOLS,
  scatter: SlotCore.SCATTER,
  
  // Functions
  rng: () => Math.random(),
  formatAmount: (n) => n.toFixed(2),
  
  // Configuration
  rows: 3,
  cols: 5
});
```

#### 3. Cascading Injection

MainApp injects dependencies down the chain:

```javascript
// MainApp creates context
const context = createMainAppContext({
  windowRef: window,
  documentRef: document
});

// Context passed to services
const services = createRuntimeServices({
  windowRef: context.env.windowRef,
  storage: context.cabinetStorage
});

// Services passed to controllers
const controllers = createAppControllers({
  session: services.session,
  rng: services.rngController.next
});
```

### Testing with DI

Dependency injection enables easy testing:

```javascript
// Test with mock dependencies
const mockDocument = {
  getElementById: () => mockElement,
  createElement: () => mockElement
};

const controller = createController({
  documentRef: mockDocument,
  rng: () => 0.5 // Deterministic
});

// Test behavior with controlled inputs
controller.buildGrid();
assert(mockElement.appendChild.called);
```

## Testing Strategy

### Unit Tests

Each module has comprehensive unit tests:

```javascript
// Test pure functions
function testBuildReelsFinal() {
  const mockRng = () => 0.5;
  const strips = [
    [S1, S2, S3],
    [S4, S5, S6]
  ];
  
  const { final, starts } = buildReelsFinal(mockRng, strips);
  
  assert(final.length === 6);
  assert(starts.length === 2);
}
```

### Integration Tests

Test module interactions:

```javascript
function testSpinCycle() {
  const mockSession = createMockSession();
  const mockRenderer = createMockRenderer();
  
  const runtime = createSpinRuntime({
    session: mockSession,
    renderer: mockRenderer
  });
  
  await runtime.performSpin();
  
  assert(mockSession.balance < initialBalance);
  assert(mockRenderer.animateCalled);
}
```

### Browser Tests

Some tests run in browser for DOM APIs:

```html
<script src="slot_core.js"></script>
<script src="test_slot_core.js"></script>
<script>
  runTests();
</script>
```

## Performance Considerations

### Optimization Strategies

1. **Image Preloading**
   ```javascript
   // Preload all symbol images on init
   preloadImages(symbolUrls);
   ```

2. **Event Delegation**
   ```javascript
   // One listener for multiple cells
   slotEl.addEventListener('click', handleCellClick);
   ```

3. **RequestAnimationFrame**
   ```javascript
   // Smooth animations using RAF
   function animate() {
     requestAnimationFrame(animate);
     updateReelPositions();
   }
   ```

4. **CSS Hardware Acceleration**
   ```css
   .spin-ghost {
     transform: translateY(0);
     will-change: transform;
   }
   ```

5. **Debouncing/Throttling**
   ```javascript
   // Prevent rapid clicks during spin
   if (spinInProgress) return;
   spinInProgress = true;
   ```

### Memory Management

- **Dispose handlers** when removing elements
- **Clear timeouts** when stopping animations
- **Cache compiled functions** in closures
- **Reuse objects** instead of creating new ones

### Bundle Size

- **Zero dependencies**: No framework overhead
- **Vanilla JS**: ~50KB minified
- **Modular**: Can remove unused modules
- **CSS**: ~20KB

Total footprint: ~70KB (excluding images/audio)

## Extensibility

### Adding New Features

#### Example: Adding a New Symbol

1. **Update Core**: Add to SYMBOLS and PAYTABLE
2. **Update Config**: Add image URL
3. **Update Weights**: Adjust SYMBOL_WEIGHTS
4. **Update UI**: Add to paytable display

```javascript
// 1. Add symbol definition
const NEW_SYMBOL = { name: 'S15', label: 'New Portrait' };
SYMBOLS.push(NEW_SYMBOL);

// 2. Add payout
PAYTABLE.S15 = { 5: 50, 4: 10, 3: 2 };

// 3. Add weight
SYMBOL_WEIGHTS.push(8);

// 4. Add image
preloadUrls.push('img/symbol_15.png');
```

#### Example: Adding a Bonus Round

1. **Extend Feature State**: Add new fields
2. **Add Trigger Logic**: Detect trigger condition
3. **Add Presentation**: Create UI for bonus
4. **Add Animation**: Build bonus animation sequence

### Plugin Architecture Possibility

The current architecture could support plugins:

```javascript
// Future plugin system concept
const plugins = [
  MultiplierPlugin,
  CascadeReelsPlugin,
  ProgressiveJackpotPlugin
];

const app = MainApp.startMainApp({
  plugins: plugins.map(p => p.init())
});
```

## Conclusion

The CRASHHOUSE slot machine architecture demonstrates:

- **Modularity**: Clear module boundaries
- **Testability**: Pure functions and DI enable comprehensive testing
- **Maintainability**: Separation of concerns makes changes localized
- **Extensibility**: New features can be added without major refactoring
- **Performance**: Optimized for smooth 60fps animations
- **Simplicity**: No complex build tools or frameworks required

The architecture prioritizes **developer experience** while maintaining **user experience**, making it both pleasant to work with and performant to play.
