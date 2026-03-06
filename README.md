# CRACKHOUSE - Slot Machine Game

A browser-based slot machine game with mechanical reel behavior, interactive controls, and engaging visual and audio effects. Designed for friends to play casually via a shared link hosted on GitHub Pages.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Module Documentation](#module-documentation)
- [Game Mechanics](#game-mechanics)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Overview

CRACKHOUSE is a fully client-side slot machine game that runs entirely in the browser. It features:

- **3×5 reel grid** with 10 paylines
- **14 portrait symbols** with varying payouts
- **Scatter/Wild symbol** (Book) that triggers free spins
- **Free spins bonus** with special symbol expansion
- **Interactive lever** for spinning
- **Sound effects** and visual animations
- **Local leaderboard** persisted in localStorage

## Features

### Core Gameplay

- ✨ **Realistic Reel Mechanics**: Weighted symbol distribution with configurable reel strips
- 🎰 **Multiple Paylines**: 10 different payline patterns for winning combinations
- 📖 **Scatter Symbol**: Land 3+ Book symbols to trigger 12 free spins
- 🎁 **Free Spins Feature**: Random symbol expands to fill entire reels
- 🔄 **Re-triggers**: Land 4+ scatters during free spins to win more spins

### User Interface

- 🎮 **Interactive Lever**: Click/touch to trigger spins
- 💰 **Bet Controls**: Adjust bet size with +/- buttons
- 🤖 **Auto-Spin**: Set up to 100 automatic spins
- 📊 **Paytable Panel**: View symbol values and payline patterns
- 🏆 **Leaderboard**: Track high scores locally
- 🔊 **Sound System**: Reel sounds, win celebrations, and ambient effects

### Technical Features

- 🚀 **Zero Dependencies**: Pure vanilla JavaScript (no frameworks)
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 💾 **Client-Side Persistence**: Game state saved in localStorage
- 🎲 **Seeded RNG**: Deterministic random number generation for testability
- 🧪 **Comprehensive Tests**: Unit tests for core modules

## Quick Start

### Playing the Game

1. Open `index.html` in a modern web browser
2. Click the lever or press the spin button to play
3. Use the +/- buttons to adjust your bet
4. Try to land 3+ Book symbols to trigger free spins!

### For Developers

```bash
# Clone the repository
git clone https://github.com/yourusername/discord_slot.git
cd discord_slot

# Open in your browser
open index.html

# Or serve with a local server
python -m http.server 8000
# Then visit http://localhost:8000
```

## Architecture

The application follows a modular architecture with clear separation of concerns:

```text
┌─────────────────────────────────────────────────────────┐
│                       MainApp                           │
│         (Dependency Injection & Orchestration)          │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│   SlotCore     │  │  SpinRuntime │  │  SlotRenderer   │
│ (Game Logic)   │  │  (Animation) │  │   (Visuals)     │
└────────────────┘  └──────────────┘  └─────────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│   CabinetUI    │  │  SlotAudio  │  │ RuntimeSession  │
│ (UI Controls)  │  │   (Sound)   │  │  (State Mgmt)   │
└────────────────┘  └─────────────┘  └─────────────────┘
```

### Key Concepts

- **Pure Game Logic**: `SlotCore` contains all game rules and math (no side effects)
- **Presentation Layer**: `SlotRenderer` handles DOM manipulation and visuals
- **Animation Controller**: `SpinRuntime` orchestrates spin sequences and timing
- **State Management**: `RuntimeSession` manages game state and persistence
- **Dependency Injection**: `MainApp` wires everything together

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## Module Documentation

### Core Modules

#### [SlotCore](./scripts/slot_core.js)

Pure game logic module containing:

- Reel strip generation with weighted symbol distribution
- Payline evaluation and win calculation
- Free spins feature logic with symbol expansion
- Scatter/wild symbol handling

**Key Functions:**

- `buildReelsFinal(randomFn, reelStrips, options)` - Generates spin outcome
- `evaluateReels(grid, options)` - Calculates wins from symbol grid
- `advanceFeatureState(state, options)` - Manages free spins state
- `getPaylines(rows, cols)` - Returns payline patterns

#### [MainApp](./scripts/main_app.js)

Application orchestrator responsible for:

- Resolving and injecting dependencies
- Creating runtime environment
- Bootstrapping all controllers
- Managing application lifecycle

**Key Functions:**

- `startMainApp(options)` - Creates and starts the application
- `createMainAppContext(options)` - Sets up environment and config
- `createRuntimeServices(options)` - Initializes game services

#### [SlotRenderer](./scripts/slot_renderer.js)

Visual rendering controller that:

- Creates and manages the symbol grid DOM
- Handles symbol image loading and caching
- Syncs visual elements during animations
- Manages tumble effects and transitions

**Key Functions:**

- `buildGrid()` - Creates the slot grid DOM structure
- `syncCellSymbol(cell, symbol)` - Updates a cell with new symbol
- `animateTumble(finalGrid, drop, newFlag)` - Animates symbol changes

#### [SpinRuntime](./scripts/spin_runtime.js)

Animation and timing controller:

- Orchestrates spin sequences
- Manages reel animations
- Handles win presentations
- Controls auto-spin functionality

**Key Functions:**

- `performSpin()` - Executes a complete spin cycle
- `animate(finalGrid, starts)` - Animates reel spin
- `celebrateWin(result)` - Displays win animations

### Supporting Modules

- **[CabinetUI](./scripts/cabinet_ui.js)**: UI controls (paytable, settings, leaderboard)
- **[SlotAudio](./scripts/slot_audio.js)**: Sound effect management
- **[RuntimeSession](./scripts/runtime_session.js)**: State management and persistence
- **[GameConfig](./scripts/game_config.js)**: Configuration and constants
- **[SeededRng](./scripts/seeded_rng.js)**: Deterministic random number generation
- **[ViewportFit](./scripts/viewport_fit.js)**: Responsive layout management
- **[RuntimeUI](./scripts/runtime_ui.js)**: UI state synchronization

## Game Mechanics

### Symbol Distribution

The game uses 14 portrait symbols (S1-S14) with different rarities:

| Symbol | Weight | 5-of-a-kind | 4-of-a-kind | 3-of-a-kind | 2-of-a-kind |
|--------|--------|-------------|-------------|-------------|-------------|
| S1     | 2      | 1200×       | 240×        | 24×         | 2.4×        |
| S2     | 2      | 480×        | 96×         | 9.6×        | 1.2×        |
| S3-S4  | 3 each | 180×        | 24×         | 7.2×        | 1.2×        |
| S5-S6  | 4 each | 36×         | 9.6×        | 1.2×        | 0.1×        |
| S7-S14 | 5-10   | 24×         | 6×          | 1.2×        | -           |

### Scatter Symbol (Book)

- **Weight**: 2.2 (appears less frequently than most symbols)
- **Wild**: Substitutes for any symbol
- **Scatter Pay**: 2/3/4/5 = 0.4×/4.8×/48×/480× (doesn't need to be on a line)
- **Bonus Trigger**: 3+ Books trigger 12 free spins

### Free Spins Feature

1. Land 3+ scatter symbols to trigger
2. A random symbol is chosen as the "special symbol"
3. During free spins, if the special symbol appears on a reel, it expands to fill the entire reel
4. All expanded symbols count as wins on all paylines
5. 4+ scatter symbols retrigger additional free spins (max 100)

### Paylines

10 fixed paylines covering various patterns:

- Lines 1-3: Horizontal (top, middle, bottom)
- Lines 4-5: Diagonal (V-shape patterns)
- Lines 6-10: Mixed patterns (zigzag, waves)

Win evaluation is left-to-right, requiring consecutive matches starting from the leftmost reel.

### RTP & Volatility

- **Base RTP**: ~96% (configurable via paytable scaling)
- **Volatility**: Medium-high
- **Max Win**: Theoretical maximum is 6000× bet (5 S1 symbols on all 10 paylines)

## Development

### Project Structure

```text
discord_slot/
├── index.html              # Main HTML file
├── README.md               # This file
├── ARCHITECTURE.md         # Architecture documentation
├── API.md                  # API reference
├── simulate_reels.js       # RTP simulation utility
├── img/                    # Symbol images and assets
├── sounds/                 # Sound effects
└── scripts/                # JavaScript modules
    ├── main.js             # Entry point
    ├── slot_core.js        # Core game logic
    ├── main_app.js         # Application orchestrator
    ├── slot_renderer.js    # Visual rendering
    ├── spin_runtime.js     # Animation controller
    ├── cabinet_ui.js       # UI components
    ├── slot_audio.js       # Audio system
    ├── runtime_session.js  # State management
    ├── game_config.js      # Configuration
    ├── seeded_rng.js       # Random number generator
    ├── viewport_fit.js     # Responsive utilities
    ├── runtime_ui.js       # UI synchronization
    ├── app_bootstrap.js    # Bootstrap logic
    ├── book_math.js        # Mathematical utilities
    └── test_*.js           # Test files
```

### Code Style

- **Pure Functions**: Prefer pure, testable functions
- **Dependency Injection**: Pass dependencies via parameters
- **JSDoc Comments**: Document all public functions
- **ES5 Compatibility**: Uses ES5+ features with function expressions
- **No Frameworks**: Vanilla JavaScript only

### Adding New Symbols

1. Add symbol definition to `SYMBOLS` array in [game_config.js](./scripts/game_config.js)
2. Add corresponding image to `img/` directory
3. Update `PAYTABLE` in [slot_core.js](./scripts/slot_core.js)
4. Adjust `SYMBOL_WEIGHTS` to control frequency

### Modifying Paytable

Use the `scalePaytable()` function to adjust payouts:

```javascript
// Double all payouts
const { paytable, scatterPayout } = SlotCore.scalePaytable(2.0);
```

## Testing

The project includes comprehensive unit tests for core modules.

### Running Tests

Tests can be run in two ways:

1. **In Browser**: Open test HTML files directly

   ```bash
   open test_*.html
   ```

2. **Command Line**: Using Node.js

   ```bash
   node scripts/test_slot_core.js
   node scripts/test_spin_runtime.js
   node scripts/test_runtime_session.js
   ```

### Test Coverage

- ✅ **SlotCore**: Reel generation, payline evaluation, feature logic
- ✅ **RuntimeSession**: State management, bet controls, persistence
- ✅ **SpinRuntime**: Spin sequences, timing, animations
- ✅ **UI Modules**: Controller initialization, event handling

### Writing Tests

Tests use a simple assertion library:

```javascript
function testEvaluatePayline() {
  const grid = [...]; // Test grid
  const payline = [0, 1, 2, 3, 4];
  const result = SlotCore.evaluatePayline(grid, payline, 1.0);
  
  assert(result !== null, 'Should find a win');
  assert(result.count === 5, 'Should match 5 symbols');
}
```

## Deployment

### GitHub Pages

1. Push code to GitHub repository
2. Enable GitHub Pages in repository settings
3. Select branch and folder (usually `main` and `/root`)
4. Access game at `https://yourusername.github.io/discord_slot/`

### Custom Domain

1. Add `CNAME` file with your domain
2. Configure DNS settings at your domain provider
3. Enable HTTPS in GitHub Pages settings

### Static Hosting

The game can be hosted on any static file server:

- Netlify
- Vercel
- AWS S3 + CloudFront
- Firebase Hosting

Simply upload all files and point to `index.html`.

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

### Required Features

- ES6+ syntax (arrow functions, destructuring, spread operator)
- CSS Grid and Flexbox
- Web Audio API (for sound)
- localStorage API (for persistence)

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Contribution Areas

- 🐛 Bug fixes
- ✨ New features (new symbols, bonus rounds, etc.)
- 📝 Documentation improvements
- 🎨 Visual enhancements
- 🔊 Sound effects and music
- 🧪 Additional tests

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by classic slot machine games
- Built for the Discord community
- Special thanks to all contributors

## Support

For questions, issues, or feature requests:

- Open an issue on GitHub
- Contact via Discord
- Check the [API documentation](./API.md)

---

**Have fun and good luck!** 🎰✨
