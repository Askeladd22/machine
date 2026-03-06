/**
 * @fileoverview CabinetUI - User interface panels and controls
 * 
 * This module manages:
 * - Paytable panel (symbol values and payline visualization)
 * - Settings and configuration panels
 * - Leaderboard display
 * - Info overlays and notifications
 * - Tab switching and panel animations
 * 
 * Provides the cabinet-style UI elements that enhance the slot machine experience
 * with information panels and interactive controls.
 * 
 * @module CabinetUI
 * @author CRASHHOUSE Slot Machine
 * @version 1.0.0
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }
  root.CabinetUI = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  /** No-op function for default callbacks */
  function noop() { }

  function roundCurrency(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? +numeric.toFixed(2) : 0;
  }

  /**
   * Creates a paytable controller for displaying game rules and payouts
   * @param {Object} [options={}] - Configuration options including DOM references and game settings
   * @returns {Object} Paytable controller with methods to show/hide and manage the panel
   */
  function createPaytableController(options = {}) {
    const {
      appEl,
      panelEl,
      backdropEl,
      toggleEl,
      closeEl,
      bodyEl,
      scatterEl,
      mapEl,
      tabEls = [],
      viewEls = [],
      rows = 3,
      cols = 5,
      total = rows * cols,
      symbols = [],
      scatter = null,
      paytable = {},
      scatterPayout = {},
      baseFreeSpins = 12,
      scatterTriggerCount = 3,
      retriggerScatterCount = 4,
      bonusRevealCount = 1,
      bonusBasePackage = { title: 'Neon Vault', freeSpins: 8, accent: '#ffd36b' },
      defaultTab = 'values',
      animationMs = 220,
      getPaylines = function () { return []; },
      paylineColorForIndex = function () { return '#ffd966'; },
      symbolLabel = function (value) { return String(value || ''); },
      formatSymbolCardValue = function (value) { return String(value || ''); },
      symbolValueAccent = function () { return { accent: '#ffd966', glow: 'rgba(255, 217, 102, 0.34)' }; },
      symbolTierLabel = function () { return ''; },
      scheduleLayout = function () { },
      prefersReducedMotion = function () {
        return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
      }
    } = options;

    let paytableTabAnimationTimer = 0;

    function isValidTab(tab) {
      return tab === 'values' || tab === 'lines';
    }

    function clearTabAnimation() {
      if (paytableTabAnimationTimer) {
        clearTimeout(paytableTabAnimationTimer);
        paytableTabAnimationTimer = 0;
      }
      viewEls.forEach((view) => {
        if (view) view.classList.remove('is-animating');
      });
    }

    function renderPaylineMap() {
      if (!mapEl) return;
      const paylines = getPaylines(rows, cols);
      const routeLabelForLine = (line) => line
        .map(function (cellIndex) { return Math.floor(cellIndex / cols) + 1; })
        .join('-');
      const cellsMarkupForLine = (line, index) => {
        const activeCells = new Set(line);
        const color = paylineColorForIndex(index);
        return Array.from({ length: total }, function (_, cellIndex) {
          const active = activeCells.has(cellIndex);
          return `<span class="payline-pattern-cell${active ? ' is-active' : ''}" style="--line-color:${color}" aria-hidden="true"></span>`;
        }).join('');
      };
      const patternsMarkup = paylines.map((line, index) => `
        <article class="payline-pattern-card" style="--line-color:${paylineColorForIndex(index)}">
          <div class="payline-pattern-head">
            <span class="payline-pattern-index">${index + 1}</span>
            <span class="payline-pattern-route">Righe ${routeLabelForLine(line)}</span>
          </div>
          <div class="payline-pattern-mini" role="img" aria-label="Linea ${index + 1}">
            ${cellsMarkupForLine(line, index)}
          </div>
        </article>`).join('');
      mapEl.innerHTML = `
        <section class="payline-atlas" aria-label="Atlante delle paylines">
          <div class="payline-atlas-summary">
            <span class="payline-atlas-chip"><strong>${paylines.length}</strong> linee fisse</span>
            <span class="payline-atlas-chip"><strong>LTR</strong> pagano da sinistra</span>
            <span class="payline-atlas-chip"><strong>5x3</strong> schema rulli</span>
          </div>
          <div class="payline-pattern-grid">
            ${patternsMarkup}
          </div>
          <div class="payline-map-note">Tutte le ${paylines.length} linee sono sempre attive. Ogni card mostra il tracciato completo della payline sui 5 rulli.</div>
        </section>`;
    }

    function renderPaytable() {
      renderPaylineMap();
      const wildSymbol = symbols.find((symbol) => symbol && symbol.isWild) || null;
      if (bodyEl) {
        const ledgerSummary = `
          <div class="values-summary-strip" aria-label="Riepilogo tabella vincite">
            <span class="values-summary-chip"><strong>${getPaylines(rows, cols).length}</strong> linee fisse</span>
            <span class="values-summary-chip"><strong>2-5</strong> simboli consecutivi</span>
            <span class="values-summary-chip"><strong>LTR</strong> pagamento da sinistra</span>
            <span class="values-summary-chip"><strong>${rows}x${cols}</strong> griglia rulli</span>
          </div>`;
        const symbolCards = symbols.map((sym, index) => {
          const payouts = paytable[sym.name] || {};
          const accentState = symbolValueAccent(index);
          const payoutChips = [5, 4, 3, 2].map((count) => {
            const value = payouts[count];
            return `
              <div class="values-pay-slot${value ? '' : ' is-empty'}">
                <span class="values-pay-hit">${count}x</span>
                ${value
                  ? `<span class="pay-value">${formatSymbolCardValue(value)}</span>`
                  : '<span class="pay-value is-empty">-</span>'}
              </div>`;
          }).join('');
          const tags = [
            `<span class="values-card-tag${sym.isWild ? ' is-wild' : ''}">${sym.isWild ? 'Wild' : symbolTierLabel(index)}</span>`
          ];
          if (payouts[2]) {
            tags.push('<span class="values-card-tag is-two">Paga con 2</span>');
          }
          const note = sym.isWild
            ? 'Sostituisce tutti i simboli linea, ma non il Libro scatter.'
            : payouts[2]
              ? 'Premia anche con 2 simboli consecutivi sulla linea attiva.'
              : 'Paga da 3 simboli consecutivi da sinistra sulla linea attiva.';
          return `
            <article class="values-card${payouts[2] ? ' is-premium' : ''}${sym.isWild ? ' is-wild' : ''}" style="--symbol-accent:${accentState.accent}; --symbol-glow:${accentState.glow};" role="listitem">
              <div class="values-card-head">
                <div class="symbol-cell">
                  <div class="symbol-badge">
                    <img src="${sym.img}" alt="${symbolLabel(sym)}" />
                  </div>
                  <div class="symbol-meta">
                    <span class="symbol-name">${symbolLabel(sym)}</span>
                    <span class="symbol-tier">${sym.isWild ? 'Wild dedicato' : symbolTierLabel(index)}</span>
                  </div>
                </div>
                <div class="values-card-tags">${tags.join('')}</div>
              </div>
              <div class="values-pay-grid" aria-label="Pagamenti ${symbolLabel(sym)}">
                ${payoutChips}
              </div>
              <p class="values-card-note">${note}</p>
            </article>`;
        }).join('');
        bodyEl.innerHTML = `
          <section class="paytable-ledger" aria-label="Valori simboli">
            <div class="paytable-ledger-head">
              <div>
                <p class="paytable-ledger-kicker">Valori simboli</p>
                <h4 class="paytable-ledger-title">Ledger payout del cabinet</h4>
                <p class="paytable-ledger-copy">Ogni simbolo mostra i premi reali sulle 25 linee fisse. I valori sono in multipli della puntata attiva.</p>
              </div>
              <div class="paytable-ledger-badge">2 / 3 / 4 / 5 di fila</div>
            </div>
            ${ledgerSummary}
            <div class="values-card-grid" role="list" aria-label="Card valori simbolo">${symbolCards}</div>
          </section>`;
      }
      if (scatterEl && scatter) {
        const scatterCounts = Object.keys(scatterPayout)
          .map(Number)
          .filter((count) => Number.isFinite(count))
          .sort((a, b) => b - a);
        const minScatterPayCount = scatterCounts.length ? scatterCounts[scatterCounts.length - 1] : scatterTriggerCount;
        const scatterCells = scatterCounts.map((count) => `
          <div class="scatter-cell">
            <span class="scatter-count">${count} Libri</span>
            <span class="scatter-value">${formatSymbolCardValue(scatterPayout[count])}</span>
          </div>`).join('');
        const revealCount = Math.max(1, Math.floor(bonusRevealCount || 1));
        const baseFeatureSpins = Math.max(1, Math.floor((bonusBasePackage && bonusBasePackage.freeSpins) || 8));
        const bonusTitle = (bonusBasePackage && bonusBasePackage.title) || 'Neon Vault';
        const bonusLabel = `Bonus ${bonusTitle}`;
        scatterEl.innerHTML = `
          <section class="feature-desk" aria-label="Riepilogo simboli speciali">
            <div class="feature-desk-head">
              <div>
                <p class="feature-desk-kicker">Simboli speciali</p>
                <h4 class="feature-desk-title">Scatter, Wild e Neon Vault</h4>
              </div>
              <div class="feature-desk-badge">Regole</div>
            </div>
            <article class="feature-panel is-scatter">
              <div class="feature-panel-head">
                <div class="symbol-badge">
                  <img src="${scatter.img}" alt="${symbolLabel(scatter)}" />
                </div>
                <div class="symbol-meta">
                  <span class="symbol-name">${symbolLabel(scatter)}</span>
                  <span class="symbol-tier">Scatter Trigger</span>
                </div>
              </div>
              <div class="scatter-grid">${scatterCells}</div>
              <p class="feature-panel-copy">Il Libro paga ovunque con ${minScatterPayCount} o piu simboli. Con ${scatterTriggerCount}+ Libri apre il ${bonusLabel}: scegli un caveau. Nel Bonus Neon Vault, ${retriggerScatterCount}+ Libri lo ricaricano.</p>
            </article>
            ${wildSymbol ? `
              <article class="feature-panel is-wild">
                <div class="feature-panel-head">
                  <div class="symbol-badge">
                    <img src="${wildSymbol.img}" alt="${symbolLabel(wildSymbol)}" />
                  </div>
                  <div class="symbol-meta">
                    <span class="symbol-name">${symbolLabel(wildSymbol)}</span>
                    <span class="symbol-tier">Wild dedicato</span>
                  </div>
                </div>
                <div class="feature-fact-list">
                  <div class="feature-fact-item">Sostituisce tutti i simboli linea.</div>
                  <div class="feature-fact-item">Non sostituisce il Libro scatter.</div>
                  <div class="feature-fact-item">Ha anche pagamenti propri sulla linea.</div>
                </div>
              </article>` : ''}
            <article class="feature-panel is-bonus">
              <div>
                <p class="feature-panel-kicker">Bonus Neon Vault</p>
                <h4 class="feature-panel-title">${bonusTitle}</h4>
                <p class="feature-panel-copy">Tre caveau, una scelta: il caveau selezionato assegna il pacchetto bonus finale.</p>
              </div>
              <div class="feature-fact-grid">
                <div class="feature-fact-stat">
                  <span class="feature-fact-label">Trigger</span>
                  <strong class="feature-fact-value">${scatterTriggerCount}+ Libri</strong>
                </div>
                <div class="feature-fact-stat">
                  <span class="feature-fact-label">Scelta</span>
                  <strong class="feature-fact-value">${revealCount} su 3</strong>
                </div>
                <div class="feature-fact-stat">
                  <span class="feature-fact-label">Base</span>
                  <strong class="feature-fact-value">${baseFeatureSpins} FS</strong>
                </div>
                <div class="feature-fact-stat">
                  <span class="feature-fact-label">Esito</span>
                  <strong class="feature-fact-value">FS / Mult / Sticky</strong>
                </div>
              </div>
            </article>
          </section>
          `;
      }
    }

    function setTab(tab, setTabOptions = {}) {
      const nextTab = isValidTab(tab) ? tab : defaultTab;
      const previousTab = panelEl ? panelEl.dataset.paytableTab : '';
      const shouldAnimate = setTabOptions.animate !== false
        && previousTab
        && previousTab !== nextTab
        && !prefersReducedMotion();
      if (panelEl) panelEl.dataset.paytableTab = nextTab;
      let activeButton = null;
      let activeView = null;
      clearTabAnimation();
      tabEls.forEach((button) => {
        const isActive = !!button && button.dataset.paytableTab === nextTab;
        if (!button) return;
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        button.setAttribute('tabindex', isActive ? '0' : '-1');
        if (isActive) activeButton = button;
      });
      viewEls.forEach((view) => {
        if (!view) return;
        const isActive = view.dataset.paytableView === nextTab;
        view.hidden = !isActive;
        view.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        if (isActive) activeView = view;
      });
      if (shouldAnimate && activeView) {
        void activeView.offsetWidth;
        activeView.classList.add('is-animating');
        paytableTabAnimationTimer = root.setTimeout(() => {
          activeView.classList.remove('is-animating');
          paytableTabAnimationTimer = 0;
        }, animationMs + 40);
      }
      if (setTabOptions.focus && activeButton) activeButton.focus();
      scheduleLayout();
    }

    function handleTabKeydown(event) {
      if (!tabEls.length) return;
      const currentIndex = tabEls.indexOf(event.currentTarget);
      if (currentIndex < 0) return;
      let nextIndex = -1;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % tabEls.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + tabEls.length) % tabEls.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = tabEls.length - 1;
      }
      if (nextIndex < 0) return;
      event.preventDefault();
      const nextButton = tabEls[nextIndex];
      setTab(nextButton && nextButton.dataset.paytableTab, { focus: true });
    }

    function setOpen(open) {
      if (!appEl) return;
      const isOpen = Boolean(open);
      appEl.dataset.paytableOpen = isOpen ? 'true' : 'false';
      if (isOpen && panelEl && !isValidTab(panelEl.dataset.paytableTab)) {
        setTab(defaultTab);
      }
      if (panelEl) panelEl.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      if (backdropEl) backdropEl.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      if (toggleEl) toggleEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      scheduleLayout();
    }

    function toggle(forceOpen) {
      const isOpen = appEl && appEl.dataset.paytableOpen === 'true';
      setOpen(typeof forceOpen === 'boolean' ? forceOpen : !isOpen);
    }

    function bindEvents() {
      tabEls.forEach((button) => {
        if (!button) return;
        button.addEventListener('click', () => setTab(button.dataset.paytableTab));
        button.addEventListener('keydown', handleTabKeydown);
      });
      if (toggleEl) toggleEl.addEventListener('click', () => toggle());
      if (closeEl) closeEl.addEventListener('click', () => setOpen(false));
      if (backdropEl) backdropEl.addEventListener('click', () => setOpen(false));
    }

    return {
      bindEvents,
      renderPaylineMap,
      renderPaytable,
      setTab,
      setOpen,
      toggle
    };
  }

  function createFeedbackUIController(options = {}) {
    const windowRef = options.windowRef || root;
    const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
    const appEl = options.appEl || null;
    const featureStateTitleEl = options.featureStateTitleEl || null;
    const featureStateMetaEl = options.featureStateMetaEl || null;
    const showPlaqueStateEl = options.showPlaqueStateEl || null;
    const cabinetNoticeEl = options.cabinetNoticeEl || null;
    const winDetailsEl = options.winDetailsEl || null;
    const coinPayoutZoneEl = options.coinPayoutZoneEl || null;
    const payoutCoinEl = options.payoutCoinEl || null;
    const coinPileEl = options.coinPileEl || null;
    const coinFrames = Array.isArray(options.coinFrames) && options.coinFrames.length ? options.coinFrames : [''];
    const scheduleLayout = typeof options.scheduleLayout === 'function' ? options.scheduleLayout : noop;
    const getGridCells = typeof options.getGridCells === 'function'
      ? options.getGridCells
      : function () { return options.gridCells || []; };
    const getInFreeSpins = typeof options.getInFreeSpins === 'function'
      ? options.getInFreeSpins
      : function () { return false; };
    const getSpinInProgress = typeof options.getSpinInProgress === 'function'
      ? options.getSpinInProgress
      : function () { return false; };
    const paylineColorForIndex = typeof options.paylineColorForIndex === 'function'
      ? options.paylineColorForIndex
      : function () { return '#ffd966'; };
    const playCoinSound = typeof options.playCoinSound === 'function' ? options.playCoinSound : noop;
    const playClick = typeof options.playClick === 'function' ? options.playClick : noop;
    const rng = typeof options.rng === 'function' ? options.rng : Math.random;
    const bonusRevealCount = Number.isInteger(options.bonusRevealCount) && options.bonusRevealCount > 0
      ? options.bonusRevealCount
      : 1;
    const bonusBasePackage = options.bonusBasePackage
      ? { ...options.bonusBasePackage }
      : {
        id: 'neon-vault',
        title: 'Neon Vault',
        kicker: 'Bonus Neon Vault',
        freeSpins: 8,
        multiplier: 1,
        stickyWildColumns: [],
        accent: '#ffd36b'
      };
    const bonusPackages = Array.isArray(options.bonusPackages) ? options.bonusPackages : [];
    const buildBonusPickDeck = typeof options.buildBonusPickDeck === 'function'
      ? options.buildBonusPickDeck
      : function (randomFn, packages = bonusPackages) { return (packages || []).map(function (item) { return item ? { ...item } : item; }).filter(Boolean); };
    const pickBonusPackage = typeof options.pickBonusPackage === 'function' ? options.pickBonusPackage : null;
    const composeBonusPackageCore = typeof options.composeBonusPackage === 'function' ? options.composeBonusPackage : null;
    const symbolLabel = typeof options.symbolLabel === 'function'
      ? options.symbolLabel
      : function (value) { return String(value || ''); };
    const formatAmountValue = typeof options.formatAmount === 'function'
      ? options.formatAmount
      : function (value) { return Number(value || 0).toFixed(2); };
    const getImageElByIndex = typeof options.getImageElByIndex === 'function'
      ? options.getImageElByIndex
      : function (index) {
        return documentRef && typeof documentRef.getElementById === 'function'
          ? documentRef.getElementById(`img-${index}`)
          : null;
      };
    const getPaylineOverlayEl = typeof options.getPaylineOverlayEl === 'function'
      ? options.getPaylineOverlayEl
      : function () {
        return documentRef && typeof documentRef.getElementById === 'function'
          ? documentRef.getElementById('payline-overlay')
          : null;
      };
    const setTimeoutRef = typeof options.setTimeoutRef === 'function'
      ? options.setTimeoutRef
      : function (handler, delay) { return windowRef.setTimeout(handler, delay); };
    const clearTimeoutRef = typeof options.clearTimeoutRef === 'function'
      ? options.clearTimeoutRef
      : function (id) { windowRef.clearTimeout(id); };
    const setIntervalRef = typeof options.setIntervalRef === 'function'
      ? options.setIntervalRef
      : function (handler, delay) { return windowRef.setInterval(handler, delay); };
    const clearIntervalRef = typeof options.clearIntervalRef === 'function'
      ? options.clearIntervalRef
      : function (id) { windowRef.clearInterval(id); };

    const feedbackState = {
      noticeTimer: 0,
      coinDispenseTimer: 0,
      coinDispenseResetTimer: 0,
      coinDispenseToken: 0,
      cabinetLightOverride: null,
      cabinetLightOverrideTimer: 0,
      attractModeTimer: 0,
      attractModeDelay: 0,
      gambleUI: null,
      gambleResolve: null,
      gambleBusy: false,
      gambleOpen: false,
      gambleAmount: 0,
      gambleHistory: [],
      bonusUI: null,
      bonusResolve: null,
      bonusOpen: false,
      bonusBusy: false,
      bonusDeck: [],
      bonusSelections: [],
      bonusBasePackage: { ...bonusBasePackage }
    };

    function setFeatureStateUI(state, title, meta) {
      if (appEl && appEl.dataset) appEl.dataset.featureState = state;
      if (featureStateTitleEl) featureStateTitleEl.textContent = title || '';
      if (featureStateMetaEl) featureStateMetaEl.textContent = meta || '';
      if (showPlaqueStateEl) showPlaqueStateEl.textContent = title || '';
    }

    function wait(delay) {
      return new Promise(function (resolve) {
        setTimeoutRef(resolve, delay);
      });
    }

    function createElement(tagName) {
      return documentRef && typeof documentRef.createElement === 'function'
        ? documentRef.createElement(tagName)
        : null;
    }

    function createElementNS(namespace, tagName) {
      if (!documentRef) return null;
      if (typeof documentRef.createElementNS === 'function') return documentRef.createElementNS(namespace, tagName);
      if (typeof documentRef.createElement === 'function') return documentRef.createElement(tagName);
      return null;
    }

    function getViewportCenter() {
      return {
        x: (Number(windowRef && windowRef.innerWidth) || 0) / 2,
        y: (Number(windowRef && windowRef.innerHeight) || 0) / 2
      };
    }

    function getGridCellByIndex(index) {
      const imageEl = getImageElByIndex(index);
      return imageEl && imageEl.parentElement ? imageEl.parentElement : null;
    }

    function randomValue() {
      const next = Number(rng());
      if (!Number.isFinite(next)) return Math.random();
      return Math.min(0.999999, Math.max(0, next));
    }

    function cloneBonusOption(option) {
      return option
        ? {
          ...option,
          stickyWildColumns: Array.isArray(option.stickyWildColumns) ? option.stickyWildColumns.slice() : [],
          reveals: Array.isArray(option.reveals)
            ? option.reveals.map(function (tile) { return tile ? { ...tile } : tile; }).filter(Boolean)
            : []
        }
        : null;
    }

    function cloneBonusTile(tile) {
      return tile
        ? {
          ...tile,
          freeSpins: Math.max(0, Math.floor(tile.freeSpins || 0)),
          multiplier: Number.isFinite(Number(tile.multiplier)) ? +(Number(tile.multiplier) || 0).toFixed(2) : 0,
          stickyWildColumns: Array.isArray(tile.stickyWildColumns) ? tile.stickyWildColumns.slice() : []
        }
        : null;
    }

    function bonusMultiplierLabel(value) {
      const numeric = Number(value) || 1;
      return `x${numeric}`;
    }

    function normalizeStickyColumns(columns = []) {
      if (!Array.isArray(columns)) return [];
      const normalized = columns
        .map(function (entry) { return Math.floor(Number(entry)); })
        .filter(function (entry) { return Number.isInteger(entry) && entry >= 0; })
        .sort(function (left, right) { return left - right; });
      return Array.from(new Set(normalized)).slice(-1);
    }

    function composeBonusPackage(revealedTiles = [], composeOptions = {}) {
      const tiles = Array.isArray(revealedTiles)
        ? revealedTiles.map(cloneBonusTile).filter(Boolean)
        : [];
      if (composeBonusPackageCore) {
        return cloneBonusOption(composeBonusPackageCore(tiles, {
          basePackage: composeOptions.basePackage || bonusBasePackage,
          revealCount: composeOptions.revealCount || bonusRevealCount
        }));
      }
      const basePackage = cloneBonusOption(composeOptions.basePackage || bonusBasePackage) || cloneBonusOption(bonusBasePackage);
      const freeSpins = Math.min(
        14,
        Math.max(1, Math.floor(basePackage.freeSpins || 8) + tiles.reduce(function (sum, tile) {
          return sum + Math.max(0, Math.floor(tile.freeSpins || 0));
        }, 0))
      );
      const multiplier = Math.min(
        1.75,
        +(Math.max(1, Number(basePackage.multiplier) || 1) + tiles.reduce(function (sum, tile) {
          return sum + (Number.isFinite(Number(tile.multiplier)) ? Number(tile.multiplier) : 0);
        }, 0)).toFixed(2)
      );
      const stickyWildColumns = normalizeStickyColumns(
        tiles.reduce(function (all, tile) {
          return all.concat(Array.isArray(tile.stickyWildColumns) ? tile.stickyWildColumns : []);
        }, Array.isArray(basePackage.stickyWildColumns) ? basePackage.stickyWildColumns.slice() : [])
      );
      let title = 'Neon Vault';
      let kicker = 'Free Spin Ladder';
      let accent = '#ffd36b';
      if (stickyWildColumns.length && multiplier > 1) {
        title = 'Neon Vault Supreme';
        kicker = stickyWildColumns[0] >= 4 ? 'Sticky Reel 5' : 'Sticky Reel 4';
        accent = '#d987ff';
      } else if (stickyWildColumns.length) {
        title = 'Neon Vault Sticky';
        kicker = stickyWildColumns[0] >= 4 ? 'Sticky Reel 5' : 'Sticky Reel 4';
        accent = '#ff9d63';
      } else if (freeSpins >= 12 && multiplier > 1) {
        title = 'Neon Vault Rush';
        kicker = 'Rush Vault';
        accent = '#ffd36b';
      } else if (multiplier >= 1.5) {
        title = 'Neon Vault Power';
        kicker = 'Power Vault';
        accent = '#79f1da';
      } else if (freeSpins >= 12) {
        title = 'Neon Vault Rush';
        kicker = 'Long Play';
        accent = '#ffd36b';
      } else if (multiplier > 1) {
        title = 'Neon Vault Boost';
        kicker = 'Boost Vault';
        accent = '#79f1da';
      }
      return cloneBonusOption({
        ...basePackage,
        title,
        kicker,
        accent,
        freeSpins,
        multiplier,
        stickyWildColumns,
        reveals: tiles,
        revealCount: tiles.length,
        maxReveals: Math.max(1, Math.floor(composeOptions.revealCount || bonusRevealCount))
      });
    }

    function getBonusDeck() {
      const deck = buildBonusPickDeck(function () { return randomValue(); }, bonusPackages);
      return deck.length ? deck.map(cloneBonusTile) : [];
    }

    function getResolvedBonusPackage(selectionIndexes = []) {
      const revealedTiles = selectionIndexes
        .map(function (index) { return feedbackState.bonusDeck[index] || null; })
        .filter(Boolean);
      return composeBonusPackage(revealedTiles, {
        basePackage: feedbackState.bonusBasePackage,
        revealCount: bonusRevealCount
      });
    }

    function buildAutoBonusChoice() {
      if (pickBonusPackage) {
        return cloneBonusOption(pickBonusPackage(
          function () { return randomValue(); },
          bonusPackages,
          { basePackage: bonusBasePackage, revealCount: bonusRevealCount }
        ));
      }
      const deck = getBonusDeck();
      return composeBonusPackage(deck.slice(0, bonusRevealCount), {
        basePackage: bonusBasePackage,
        revealCount: bonusRevealCount
      });
    }

    function clearGambleSelection(ui) {
      if (!ui) return;
      [ui.collectButton, ui.redButton, ui.blackButton].forEach(function (button) {
        if (button && button.classList && typeof button.classList.remove === 'function') {
          button.classList.remove('is-selected');
        }
      });
    }

    function setGambleButtonsDisabled(ui, disabled) {
      if (!ui) return;
      [ui.collectButton, ui.redButton, ui.blackButton].forEach(function (button) {
        if (button) button.disabled = disabled;
      });
    }

    function renderGambleHistory(ui) {
      if (!ui || !ui.historyEl) return;
      ui.historyEl.textContent = feedbackState.gambleHistory.length
        ? feedbackState.gambleHistory.join(' | ')
        : 'Scegli un colore per il raddoppio o incassa.';
    }

    function syncGambleMeters(ui) {
      if (!ui) return;
      const currentAmount = roundCurrency(feedbackState.gambleAmount);
      const nextAmount = roundCurrency(currentAmount * 2);
      if (ui.currentValueEl) ui.currentValueEl.textContent = formatAmountValue(currentAmount);
      if (ui.nextValueEl) ui.nextValueEl.textContent = formatAmountValue(nextAmount);
      if (ui.ledEl) ui.ledEl.textContent = currentAmount > 0 ? 'READY' : 'LOCK';
    }

    function resetGambleCard(ui) {
      if (!ui || !ui.cardEl) return;
      ui.cardEl.dataset.color = 'black';
      if (ui.cardEl.classList && typeof ui.cardEl.classList.remove === 'function') {
        ui.cardEl.classList.remove('is-win', 'is-lose', 'is-collect', 'is-revealing');
        ui.cardEl.classList.add('is-hidden');
      }
      [ui.rankTopEl, ui.rankBottomEl].forEach(function (el) {
        if (el) el.textContent = '?';
      });
      [ui.suitTopEl, ui.suitBottomEl, ui.suitCenterEl].forEach(function (el) {
        if (el) el.textContent = '•';
      });
    }

    function applyGambleCard(ui, card) {
      if (!ui || !ui.cardEl || !card) return;
      ui.cardEl.dataset.color = card.color;
      if (ui.rankTopEl) ui.rankTopEl.textContent = card.rank;
      if (ui.rankBottomEl) ui.rankBottomEl.textContent = card.rank;
      if (ui.suitTopEl) ui.suitTopEl.textContent = card.suit;
      if (ui.suitBottomEl) ui.suitBottomEl.textContent = card.suit;
      if (ui.suitCenterEl) ui.suitCenterEl.textContent = card.suit;
    }

    function buildGambleCard(choice) {
      const color = randomValue() < 0.5 ? 'red' : 'black';
      const redSuits = ['♥', '♦'];
      const blackSuits = ['♠', '♣'];
      const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
      const suits = color === 'red' ? redSuits : blackSuits;
      return {
        color,
        suit: suits[Math.floor(randomValue() * suits.length)],
        rank: ranks[Math.floor(randomValue() * ranks.length)],
        win: color === choice
      };
    }

    function createGambleButton(label, className) {
      const button = createElement('button');
      if (!button) return null;
      button.type = 'button';
      button.className = `gamble-button ${className}`.trim();
      button.textContent = label;
      return button;
    }

    function ensureGambleUI() {
      if (feedbackState.gambleUI) return feedbackState.gambleUI;
      if (!documentRef || !documentRef.body) return null;

      const modal = createElement('div');
      const panel = createElement('section');
      const head = createElement('div');
      const lampRow = createElement('div');
      const headerRow = createElement('div');
      const titleWrap = createElement('div');
      const titleEl = createElement('h2');
      const copyEl = createElement('p');
      const ledEl = createElement('div');
      const stage = createElement('div');
      const cardShell = createElement('div');
      const cardEl = createElement('div');
      const cornerTop = createElement('div');
      const rankTopEl = createElement('span');
      const suitTopEl = createElement('span');
      const cornerBottom = createElement('div');
      const rankBottomEl = createElement('span');
      const suitBottomEl = createElement('span');
      const suitCenterEl = createElement('span');
      const meters = createElement('div');
      const currentMeter = createElement('div');
      const currentLabel = createElement('span');
      const currentValueEl = createElement('strong');
      const nextMeter = createElement('div');
      const nextLabel = createElement('span');
      const nextValueEl = createElement('strong');
      const actions = createElement('div');
      const collectButton = createGambleButton('Incassa', 'gamble-button-collect');
      const redButton = createGambleButton('Rosso', 'gamble-button-red');
      const blackButton = createGambleButton('Nero', 'gamble-button-black');
      const historyEl = createElement('div');

      if (!modal || !panel || !head || !lampRow || !headerRow || !titleWrap || !titleEl || !copyEl || !ledEl
        || !stage || !cardShell || !cardEl || !cornerTop || !rankTopEl || !suitTopEl || !cornerBottom
        || !rankBottomEl || !suitBottomEl || !suitCenterEl || !meters || !currentMeter || !currentLabel
        || !currentValueEl || !nextMeter || !nextLabel || !nextValueEl || !actions || !collectButton
        || !redButton || !blackButton || !historyEl) {
        return null;
      }

      modal.className = 'gamble-modal';
      modal.hidden = true;
      if (typeof modal.setAttribute === 'function') {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Raddoppio');
      }
      panel.className = 'gamble-panel';
      head.className = 'gamble-head';
      lampRow.className = 'gamble-lamp-row';
      headerRow.className = 'gamble-header-row';
      ledEl.className = 'gamble-led';
      titleEl.className = 'gamble-title';
      titleEl.textContent = 'Raddoppio';
      copyEl.className = 'gamble-copy';
      copyEl.textContent = 'Scegli rosso o nero. Se vinci, la somma raddoppia. Se perdi, la vincita viene annullata.';
      ledEl.textContent = 'READY';
      stage.className = 'gamble-stage';
      cardShell.className = 'gamble-card-shell';
      cardEl.className = 'gamble-card is-hidden';
      cardEl.dataset.color = 'black';
      cornerTop.className = 'gamble-corner gamble-corner-top';
      rankTopEl.className = 'gamble-rank';
      suitTopEl.className = 'gamble-suit';
      cornerBottom.className = 'gamble-corner gamble-corner-bottom';
      rankBottomEl.className = 'gamble-rank';
      suitBottomEl.className = 'gamble-suit';
      suitCenterEl.className = 'gamble-suit';
      meters.className = 'gamble-meters';
      currentMeter.className = 'gamble-meter';
      currentLabel.textContent = 'Vincita Corrente';
      currentValueEl.className = 'gamble-value';
      nextMeter.className = 'gamble-meter';
      nextLabel.textContent = 'Prossimo Colpo';
      nextValueEl.className = 'gamble-value';
      actions.className = 'gamble-actions';
      historyEl.className = 'gamble-history';

      for (let index = 0; index < 10; index += 1) {
        const lamp = createElement('span');
        if (!lamp) continue;
        lamp.className = 'gamble-lamp';
        lampRow.appendChild(lamp);
      }

      cornerTop.appendChild(rankTopEl);
      cornerTop.appendChild(suitTopEl);
      cornerBottom.appendChild(rankBottomEl);
      cornerBottom.appendChild(suitBottomEl);
      cardEl.appendChild(cornerTop);
      cardEl.appendChild(suitCenterEl);
      cardEl.appendChild(cornerBottom);
      titleWrap.appendChild(titleEl);
      titleWrap.appendChild(copyEl);
      headerRow.appendChild(titleWrap);
      headerRow.appendChild(ledEl);
      head.appendChild(lampRow);
      head.appendChild(headerRow);
      currentMeter.appendChild(currentLabel);
      currentMeter.appendChild(currentValueEl);
      nextMeter.appendChild(nextLabel);
      nextMeter.appendChild(nextValueEl);
      meters.appendChild(currentMeter);
      meters.appendChild(nextMeter);
      cardShell.appendChild(cardEl);
      stage.appendChild(cardShell);
      stage.appendChild(meters);
      actions.appendChild(collectButton);
      actions.appendChild(redButton);
      actions.appendChild(blackButton);
      panel.appendChild(head);
      panel.appendChild(stage);
      panel.appendChild(actions);
      panel.appendChild(historyEl);
      modal.appendChild(panel);
      documentRef.body.appendChild(modal);

      const ui = {
        modal,
        copyEl,
        ledEl,
        cardEl,
        rankTopEl,
        suitTopEl,
        rankBottomEl,
        suitBottomEl,
        suitCenterEl,
        currentValueEl,
        nextValueEl,
        collectButton,
        redButton,
        blackButton,
        historyEl
      };

      function handleCollect() {
        if (!feedbackState.gambleOpen || feedbackState.gambleBusy) return;
        playClick();
        collectButton.classList.add('is-selected');
        if (ui.cardEl && ui.cardEl.classList && typeof ui.cardEl.classList.add === 'function') {
          ui.cardEl.classList.remove('is-hidden', 'is-win', 'is-lose');
          ui.cardEl.classList.add('is-collect');
        }
        setGambleButtonsDisabled(ui, true);
        feedbackState.gambleBusy = true;
        setCabinetNotice(`Incasso: ${formatAmountValue(feedbackState.gambleAmount)} crediti.`, 'success', 1800);
        showFloat(`Incasso ${formatAmountValue(feedbackState.gambleAmount)}`, 1100);
        setTimeoutRef(function () {
          closeGamble(feedbackState.gambleAmount);
        }, 260);
      }

      function handleChoice(choice) {
        if (!feedbackState.gambleOpen || feedbackState.gambleBusy) return;
        playClick();
        feedbackState.gambleBusy = true;
        clearGambleSelection(ui);
        setGambleButtonsDisabled(ui, true);
        const choiceButton = choice === 'red' ? redButton : blackButton;
        if (choiceButton && choiceButton.classList && typeof choiceButton.classList.add === 'function') {
          choiceButton.classList.add('is-selected');
        }
        const card = buildGambleCard(choice);
        applyGambleCard(ui, card);
        if (ui.cardEl && ui.cardEl.classList) {
          ui.cardEl.classList.remove('is-hidden', 'is-win', 'is-lose', 'is-collect');
          ui.cardEl.classList.add('is-revealing');
        }
        feedbackState.gambleHistory.push(`${choice === 'red' ? 'Rosso' : 'Nero'} vs ${card.rank}${card.suit}`);
        renderGambleHistory(ui);
        setCabinetNotice(`Carta rivelata: ${card.rank}${card.suit}.`, 'info', 1200);

        setTimeoutRef(function () {
          if (!ui.cardEl || !ui.cardEl.classList) return;
          ui.cardEl.classList.remove('is-revealing');
          ui.cardEl.classList.add(card.win ? 'is-win' : 'is-lose');
          if (card.win) {
            feedbackState.gambleAmount = roundCurrency(feedbackState.gambleAmount * 2);
            feedbackState.gambleHistory.push(`Raddoppio centrato → ${formatAmountValue(feedbackState.gambleAmount)}`);
            renderGambleHistory(ui);
            syncGambleMeters(ui);
            pulseCabinetWin(1000);
            showFloat(`Raddoppio: ${formatAmountValue(feedbackState.gambleAmount)}`, 1100);
            setCabinetNotice('Raddoppio riuscito. Puoi incassare o continuare.', 'success', 1800);
            clearGambleSelection(ui);
            setGambleButtonsDisabled(ui, false);
            feedbackState.gambleBusy = false;
            return;
          }
          feedbackState.gambleHistory.push('Carta sbagliata → vincita azzerata');
          renderGambleHistory(ui);
          feedbackState.gambleAmount = 0;
          syncGambleMeters(ui);
          setCabinetNotice('Raddoppio perso. Vincita azzerata.', 'warning', 2200);
          showFloat('Raddoppio perso', 1100);
          closeGamble(0, 480);
        }, 620);
      }

      if (typeof collectButton.addEventListener === 'function') {
        collectButton.addEventListener('click', handleCollect);
      }
      if (typeof redButton.addEventListener === 'function') {
        redButton.addEventListener('click', function () { handleChoice('red'); });
      }
      if (typeof blackButton.addEventListener === 'function') {
        blackButton.addEventListener('click', function () { handleChoice('black'); });
      }
      if (windowRef && typeof windowRef.addEventListener === 'function') {
        windowRef.addEventListener('keydown', function (event) {
          if (!feedbackState.gambleOpen || feedbackState.gambleBusy) return;
          if (!event) return;
          if (event.key === 'Escape' || event.key === 'Enter') {
            if (typeof event.preventDefault === 'function') event.preventDefault();
            handleCollect();
          } else if (event.key === 'r' || event.key === 'R') {
            if (typeof event.preventDefault === 'function') event.preventDefault();
            handleChoice('red');
          } else if (event.key === 'n' || event.key === 'N' || event.key === 'b' || event.key === 'B') {
            if (typeof event.preventDefault === 'function') event.preventDefault();
            handleChoice('black');
          }
        });
      }

      feedbackState.gambleUI = ui;
      resetGambleCard(ui);
      return ui;
    }

    function closeGamble(finalAmount, delay = 180) {
      const ui = feedbackState.gambleUI;
      const resolve = feedbackState.gambleResolve;
      feedbackState.gambleResolve = null;
      feedbackState.gambleOpen = false;
      setTimeoutRef(function () {
        if (ui && ui.modal) ui.modal.hidden = true;
        if (ui) {
          clearGambleSelection(ui);
          setGambleButtonsDisabled(ui, false);
          resetGambleCard(ui);
        }
        feedbackState.gambleBusy = false;
        feedbackState.cabinetLightOverride = null;
        syncCabinetLights();
        if (typeof resolve === 'function') resolve(roundCurrency(finalAmount));
      }, delay);
    }

    function resolveGambleWin(options = {}) {
      const baseWin = roundCurrency(options.win);
      const source = options.source || 'button';
      const startedInFreeSpins = options.startedInFreeSpins === true;
      const spinStake = roundCurrency(options.spinStake);
      const offerThreshold = roundCurrency(
        options.offerThreshold == null ? Math.max(spinStake || 0, 1) : options.offerThreshold
      );
      const ui = ensureGambleUI();
      if (!ui || !(baseWin > 0) || source === 'auto' || startedInFreeSpins || baseWin < offerThreshold) {
        return Promise.resolve(baseWin);
      }

      if (feedbackState.gambleResolve) {
        const previousResolve = feedbackState.gambleResolve;
        feedbackState.gambleResolve = null;
        previousResolve(baseWin);
      }

      feedbackState.gambleAmount = baseWin;
      feedbackState.gambleHistory = [`Win base ${formatAmountValue(baseWin)}`];
      feedbackState.gambleBusy = false;
      feedbackState.gambleOpen = true;
      feedbackState.cabinetLightOverride = 'win';
      syncCabinetLights();
      clearGambleSelection(ui);
      setGambleButtonsDisabled(ui, false);
      resetGambleCard(ui);
      renderGambleHistory(ui);
      syncGambleMeters(ui);
      if (ui.copyEl) {
        ui.copyEl.textContent = 'Scegli rosso o nero. Ogni carta corretta raddoppia la somma corrente; una carta errata la annulla.';
      }
      if (ui.modal) ui.modal.hidden = false;
      setCabinetNotice('Raddoppio: scegli un colore o incassa.', 'info');
      scheduleLayout();

      return new Promise(function (resolve) {
        feedbackState.gambleResolve = resolve;
      });
    }

    function bonusStickyWildCount(option) {
      return Array.isArray(option && option.stickyWildColumns) ? option.stickyWildColumns.length : 0;
    }

    function bonusStickyWildLabel(option) {
      const stickyCount = bonusStickyWildCount(option);
      if (!stickyCount) return '';
      const reelNumber = Math.max.apply(null, option.stickyWildColumns.map(function (value) { return Number(value) || 0; })) + 1;
      return `Sticky Reel ${reelNumber}`;
    }

    function bonusTileMeta(option) {
      if (!option) return '';
      const stickyCount = bonusStickyWildCount(option);
      const stickyLabel = bonusStickyWildLabel(option);
      const freeSpins = Math.max(0, Math.floor(option.freeSpins || 0));
      const multiplier = Number(option.multiplier) || 0;
      if (stickyCount > 0 && freeSpins > 0 && multiplier > 0) return `+${freeSpins} Giri • ${stickyLabel} • +${multiplier.toFixed(2)}x`;
      if (stickyCount > 0 && freeSpins > 0) return `+${freeSpins} Giri • ${stickyLabel}`;
      if (stickyCount > 0 && multiplier > 0) return `${stickyLabel} • +${multiplier.toFixed(2)}x`;
      if (stickyCount > 0) return stickyLabel;
      if ((Number(option.freeSpins) || 0) > 0 && (Number(option.multiplier) || 0) > 0) {
        return `+${Math.floor(option.freeSpins || 0)} Giri • +${Number(option.multiplier).toFixed(2)}x`;
      }
      if ((Number(option.freeSpins) || 0) > 0) {
        return `+${Math.floor(option.freeSpins || 0)} Giri Gratis`;
      }
      if ((Number(option.multiplier) || 0) > 0) {
        return `+${Number(option.multiplier).toFixed(2)}x Win`;
      }
      return 'Upgrade';
    }

    function bonusTileFoot(option) {
      if (!option) return '';
      const stickyCount = bonusStickyWildCount(option);
      const freeSpins = Math.max(0, Math.floor(option.freeSpins || 0));
      if (stickyCount > 0 && freeSpins > 0) return 'Giri gratis con rullo wild sticky';
      if (stickyCount > 0) return 'Blocca un rullo wild nel bonus';
      if ((Number(option.freeSpins) || 0) > 0 && (Number(option.multiplier) || 0) > 0) return 'Giri e moltiplicatore';
      if ((Number(option.freeSpins) || 0) > 0) return 'Allunga il round bonus';
      if ((Number(option.multiplier) || 0) > 0) return 'Aumenta il moltiplicatore finale';
      return 'Da rivelare';
    }

    function bonusOptionMeta(option) {
      const stickyCount = bonusStickyWildCount(option);
      const parts = [`${option.freeSpins} Giri`];
      if ((Number(option.multiplier) || 1) > 1) parts.push(bonusMultiplierLabel(option.multiplier));
      if (stickyCount > 0) parts.push('Sticky');
      return parts.join(' • ');
    }

    function bonusOptionFoot(option) {
      const stickyCount = bonusStickyWildCount(option);
      if (stickyCount > 0) {
        const stickyLabel = bonusStickyWildLabel(option);
        return stickyCount === 1 ? `${stickyLabel} attivo` : `${stickyCount} rulli wild sticky`;
      }
      if ((Number(option.multiplier) || 1) > 1) return `Moltiplicatore ${bonusMultiplierLabel(option.multiplier)}`;
      return 'Standard';
    }

    function bonusOptionStatus(option) {
      if (!option) return '';
      return `${option.title} • ${bonusOptionMeta(option)} • ${bonusOptionFoot(option)}`;
    }

    function bonusFeatureStateMeta(option) {
      if (!option) return '';
      return [bonusOptionMeta(option), bonusOptionFoot(option)].filter(Boolean).join(' • ');
    }

    function renderBonusDeck(ui, revealAll = false) {
      if (!ui || !Array.isArray(ui.bookButtons)) return;
      const selectedIndexes = Array.isArray(feedbackState.bonusSelections) ? feedbackState.bonusSelections.slice() : [];
      ui.bookButtons.forEach(function (entry, index) {
        const option = feedbackState.bonusDeck[index] || null;
        if (!entry || !entry.button) return;
        const isSelected = selectedIndexes.indexOf(index) >= 0;
        const isDimmed = revealAll && !isSelected;
        const reveal = (revealAll || isSelected) && !!option;
        const hasRemainingPicks = selectedIndexes.length < bonusRevealCount;
        entry.button.disabled = feedbackState.bonusBusy || isSelected || !hasRemainingPicks;
        entry.button.dataset.revealed = reveal ? 'true' : 'false';
        entry.button.dataset.selected = isSelected ? 'true' : 'false';
        entry.button.dataset.dimmed = isDimmed ? 'true' : 'false';
        if (entry.button.classList) {
          if (reveal) entry.button.classList.add('is-revealed');
          else entry.button.classList.remove('is-revealed');
          if (isSelected) entry.button.classList.add('is-selected');
          else entry.button.classList.remove('is-selected');
          if (isDimmed) entry.button.classList.add('is-dimmed');
          else entry.button.classList.remove('is-dimmed');
        }
        if (!option) {
          entry.kickerEl.textContent = 'Caveau';
          entry.titleEl.textContent = 'Sigillato';
          entry.metaEl.textContent = 'Bonus Neon Vault';
          entry.footEl.textContent = 'Premi per aprire';
          return;
        }
        entry.kickerEl.textContent = reveal ? (option.kicker || 'Vault') : `Caveau ${index + 1}`;
        entry.titleEl.textContent = reveal ? option.title : 'Sigillato';
        entry.metaEl.textContent = reveal
          ? bonusTileMeta(option)
          : '1 scelta disponibile';
        entry.footEl.textContent = reveal
          ? bonusTileFoot(option)
          : 'Premi per aprire';
        if (entry.button.style) {
          entry.button.style.setProperty('--bonus-accent', option.accent || '#ffd36b');
        }
      });
    }

    function ensureBonusPickUI() {
      if (feedbackState.bonusUI) return feedbackState.bonusUI;
      if (!documentRef || !documentRef.body) return null;

      const modal = createElement('div');
      const panel = createElement('section');
      const header = createElement('div');
      const kickerEl = createElement('p');
      const titleEl = createElement('h2');
      const copyEl = createElement('p');
      const grid = createElement('div');
      const statusEl = createElement('div');
      if (!modal || !panel || !header || !kickerEl || !titleEl || !copyEl || !grid || !statusEl) {
        return null;
      }

      modal.className = 'bonus-pick-modal';
      modal.hidden = true;
      if (typeof modal.setAttribute === 'function') {
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Bonus Neon Vault');
      }
      panel.className = 'bonus-pick-panel';
      header.className = 'bonus-pick-head';
      kickerEl.className = 'bonus-pick-kicker';
      kickerEl.textContent = 'Bonus Neon Vault';
      titleEl.className = 'bonus-pick-title';
      titleEl.textContent = 'Scegli un caveau';
      copyEl.className = 'bonus-pick-copy';
      statusEl.className = 'bonus-pick-status';
      grid.className = 'bonus-pick-grid';

      const boardSize = Math.max(1, bonusPackages.length || 3);
      const bookButtons = Array.from({ length: boardSize }, function (_, index) {
        const button = createElement('button');
        const shine = createElement('span');
        const kicker = createElement('span');
        const title = createElement('strong');
        const meta = createElement('span');
        const foot = createElement('span');
        if (!button || !shine || !kicker || !title || !meta || !foot) return null;
        button.type = 'button';
        button.className = 'bonus-pick-book';
        button.dataset.slot = String(index);
        shine.className = 'bonus-pick-book-shine';
        kicker.className = 'bonus-pick-book-kicker';
        title.className = 'bonus-pick-book-title';
        meta.className = 'bonus-pick-book-meta';
        foot.className = 'bonus-pick-book-foot';
        button.appendChild(shine);
        button.appendChild(kicker);
        button.appendChild(title);
        button.appendChild(meta);
        button.appendChild(foot);
        grid.appendChild(button);
        return { button, kickerEl: kicker, titleEl: title, metaEl: meta, footEl: foot };
      }).filter(Boolean);

      panel.appendChild(header);
      header.appendChild(kickerEl);
      header.appendChild(titleEl);
      header.appendChild(copyEl);
      panel.appendChild(grid);
      panel.appendChild(statusEl);
      modal.appendChild(panel);
      documentRef.body.appendChild(modal);

      const ui = {
        modal,
        titleEl,
        copyEl,
        statusEl,
        bookButtons
      };

      function handlePick(index) {
        if (!feedbackState.bonusOpen || feedbackState.bonusBusy) return;
        const option = feedbackState.bonusDeck[index];
        if (feedbackState.bonusSelections.indexOf(index) >= 0) return;
        if (!option) return;
        playClick();
        feedbackState.bonusSelections = feedbackState.bonusSelections.concat(index);
        const resolvedPackage = getResolvedBonusPackage(feedbackState.bonusSelections);
        const completed = feedbackState.bonusSelections.length >= bonusRevealCount;
        renderBonusDeck(ui, completed);
        if (ui.statusEl) {
          ui.statusEl.textContent = completed
            ? `Esito: ${bonusOptionStatus(resolvedPackage)}`
            : 'Scegli un caveau';
        }
        showFloat(`${option.title}: ${bonusTileMeta(option)}`, 1100);
        pulseCabinetWin(completed ? 1200 : 820);
        if (!completed) {
          setCabinetNotice(
            `Neon Vault: ${option.title}.`,
            'info',
            1800
          );
          return;
        }
        feedbackState.bonusBusy = true;
        setCabinetNotice(
          `Bonus Neon Vault definito: ${resolvedPackage.title} • ${bonusOptionFoot(resolvedPackage)}.`,
          'success',
          2600
        );
        setTimeoutRef(function () {
          closeBonusPick(resolvedPackage);
        }, 920);
      }

      ui.bookButtons.forEach(function (entry, index) {
        if (entry.button && typeof entry.button.addEventListener === 'function') {
          entry.button.addEventListener('click', function () { handlePick(index); });
        }
      });
      if (windowRef && typeof windowRef.addEventListener === 'function') {
        windowRef.addEventListener('keydown', function (event) {
          if (!feedbackState.bonusOpen || feedbackState.bonusBusy || !event) return;
          const keyMap = {
            '1': 0, '2': 1, '3': 2, '4': 3,
            '5': 4, '6': 5, '7': 6, '8': 7,
            '9': 8, q: 9, Q: 9, w: 10, W: 10, e: 11, E: 11
          };
          if (Object.prototype.hasOwnProperty.call(keyMap, event.key)) {
            if (typeof event.preventDefault === 'function') event.preventDefault();
            handlePick(keyMap[event.key]);
          }
        });
      }

      feedbackState.bonusUI = ui;
      return ui;
    }

    function closeBonusPick(selection, delay = 120) {
      const ui = feedbackState.bonusUI;
      const resolve = feedbackState.bonusResolve;
      feedbackState.bonusResolve = null;
      feedbackState.bonusOpen = false;
      setTimeoutRef(function () {
        if (ui && ui.modal) ui.modal.hidden = true;
        feedbackState.bonusBusy = false;
        feedbackState.bonusDeck = [];
        feedbackState.bonusSelections = [];
        feedbackState.bonusBasePackage = cloneBonusOption(bonusBasePackage);
        if (selection && ((typeof getInFreeSpins === 'function' && getInFreeSpins()) || selection.freeSpins > 0)) {
          setFeatureStateUI('free-spins', 'Giri Gratis Attivi', bonusFeatureStateMeta(selection));
        } else {
          setFeatureStateUI('base', 'Gioco Base', '25 linee attive');
        }
        if (typeof resolve === 'function') resolve(cloneBonusOption(selection));
      }, delay);
    }

    function resolveBonusPick(options = {}) {
      const source = options.source || 'button';
      const freeSpinSymbol = options.freeSpinSymbol || null;
      const deck = getBonusDeck();
      const basePackage = cloneBonusOption(bonusBasePackage);
      const autoChoice = buildAutoBonusChoice();
      const ui = ensureBonusPickUI();

      if (!ui || source === 'auto' || !deck.length) {
        return Promise.resolve(autoChoice);
      }

      if (feedbackState.bonusResolve) {
        const previousResolve = feedbackState.bonusResolve;
        feedbackState.bonusResolve = null;
        previousResolve(autoChoice);
      }

      feedbackState.bonusDeck = deck;
      feedbackState.bonusSelections = [];
      feedbackState.bonusBasePackage = basePackage;
      feedbackState.bonusBusy = false;
      feedbackState.bonusOpen = true;
      if (ui.copyEl) {
        ui.copyEl.textContent = freeSpinSymbol
          ? `Scegli un caveau. Parti da ${basePackage.freeSpins} giri gratis; il simbolo speciale sara ${symbolLabel(freeSpinSymbol)}.`
          : `Scegli un caveau. Parti da ${basePackage.freeSpins} giri gratis e assegna il pacchetto finale del bonus.`;
      }
      if (ui.statusEl) {
        ui.statusEl.textContent = `1 scelta • Base ${bonusOptionStatus(basePackage)}`;
      }
      renderBonusDeck(ui, false);
      if (ui.modal) ui.modal.hidden = false;
      setFeatureStateUI('bonus-pick', 'Bonus Neon Vault', `1 scelta • ${basePackage.freeSpins} giri base`);
      setCabinetNotice('Bonus Neon Vault: scegli un caveau.', 'info', 2200);
      scheduleLayout();

      return new Promise(function (resolve) {
        feedbackState.bonusResolve = resolve;
      });
    }

    function setCabinetNotice(message = '', tone = 'info', ttl = 0) {
      if (!cabinetNoticeEl) return;
      if (feedbackState.noticeTimer) {
        clearTimeoutRef(feedbackState.noticeTimer);
        feedbackState.noticeTimer = 0;
      }
      const text = String(message || '').trim();
      const visible = !!text;
      cabinetNoticeEl.dataset.visible = visible ? 'true' : 'false';
      cabinetNoticeEl.dataset.tone = visible ? tone : 'info';
      cabinetNoticeEl.textContent = text;
      if (visible && ttl > 0) {
        feedbackState.noticeTimer = setTimeoutRef(function () {
          if (cabinetNoticeEl && cabinetNoticeEl.textContent === text) {
            setCabinetNotice('');
          }
        }, ttl);
      }
      scheduleLayout();
    }

    function setWinDetails(html = '') {
      if (!winDetailsEl) return;
      const visible = !!String(html).trim();
      winDetailsEl.dataset.visible = visible ? 'true' : 'false';
      winDetailsEl.innerHTML = visible ? html : '';
      scheduleLayout();
    }

    function clearHighlights(options = {}) {
      const keepDetails = options.keepDetails === true;
      getGridCells().forEach(function (cell) {
        if (!cell) return;
        if (cell.classList && typeof cell.classList.remove === 'function') {
          cell.classList.remove('win', 'payline', 'expanding', 'is-muted');
        }
        if (cell.style) {
          cell.style.outlineColor = '';
          cell.style.boxShadow = '';
        }
        const badge = typeof cell.querySelector === 'function' ? cell.querySelector('.payout-badge') : null;
        if (badge && typeof badge.remove === 'function') badge.remove();
      });
      if (!keepDetails) setWinDetails('');
    }

    function showToast(text, options = {}) {
      if (!documentRef || !documentRef.body) return;
      const {
        className = 'floatWin',
        ttl = 900,
        fadeMs = 600,
        accent = '#ffd36b',
        tier = 'regular',
        driftY = className === 'bigWin' ? -34 : -18,
        rotation = ((randomValue() * 5.2) - 2.6).toFixed(2),
        flare = className === 'bigWin'
      } = options;
      const el = createElement('div');
      if (!el) return;
      el.className = className;
      el.textContent = text;
      if (el.dataset) el.dataset.tier = tier;
      if (el.style && typeof el.style.setProperty === 'function') {
        el.style.setProperty('--toast-accent', accent);
        el.style.setProperty('--toast-drift-y', `${driftY}px`);
        el.style.setProperty('--toast-tilt', `${rotation}deg`);
      }
      documentRef.body.appendChild(el);
      if (flare) {
        const flareEl = createElement('div');
        if (flareEl) {
          flareEl.className = 'celebration-flare';
          if (flareEl.dataset) flareEl.dataset.tier = tier;
          if (flareEl.style && typeof flareEl.style.setProperty === 'function') {
            flareEl.style.setProperty('--flare-accent', accent);
            flareEl.style.setProperty('--flare-strength', tier === 'mega' ? '1' : className === 'bigWin' ? '0.78' : '0.58');
          }
          documentRef.body.appendChild(flareEl);
          setTimeoutRef(function () {
            if (flareEl.style) {
              flareEl.style.transition = `opacity ${Math.max(240, fadeMs)}ms ease`;
              flareEl.style.opacity = '0';
            }
            setTimeoutRef(function () {
              if (typeof flareEl.remove === 'function') flareEl.remove();
            }, Math.max(240, fadeMs));
          }, Math.max(280, ttl - 260));
        }
      }
      setTimeoutRef(function () {
        if (el.style) {
          el.style.transition = `opacity ${fadeMs}ms ease, transform ${fadeMs}ms ease, filter ${fadeMs}ms ease`;
          el.style.opacity = '0';
          el.style.transform = `translate(-50%, var(--toast-drift-y, -16px)) rotate(var(--toast-tilt, 0deg)) scale(.96)`;
        }
        setTimeoutRef(function () {
          if (typeof el.remove === 'function') el.remove();
        }, fadeMs);
      }, ttl);
    }

    function showFloat(text, ttl = 900, options = {}) {
      showToast(text, {
        className: 'floatWin',
        ttl,
        fadeMs: 660,
        accent: options.accent || '#ffd36b',
        tier: options.tier || 'regular',
        driftY: options.driftY == null ? -16 : options.driftY,
        flare: options.flare === true
      });
    }

    function showBigWin(text, ttl = 1600, options = {}) {
      showToast(text, {
        className: 'bigWin',
        ttl,
        fadeMs: 980,
        accent: options.accent || '#ffd36b',
        tier: options.tier || 'big',
        driftY: options.driftY == null ? -30 : options.driftY,
        flare: options.flare !== false
      });
    }

    function resetCoinTray(resetPile = true) {
      feedbackState.coinDispenseToken += 1;
      if (feedbackState.coinDispenseTimer) {
        clearIntervalRef(feedbackState.coinDispenseTimer);
        feedbackState.coinDispenseTimer = 0;
      }
      if (feedbackState.coinDispenseResetTimer) {
        clearTimeoutRef(feedbackState.coinDispenseResetTimer);
        feedbackState.coinDispenseResetTimer = 0;
      }
      if (coinPayoutZoneEl) coinPayoutZoneEl.dataset.active = 'false';
      if (payoutCoinEl) {
        if (payoutCoinEl.classList && typeof payoutCoinEl.classList.remove === 'function') {
          payoutCoinEl.classList.remove('is-dropping');
        }
        if (payoutCoinEl.style && typeof payoutCoinEl.style.setProperty === 'function') {
          payoutCoinEl.style.setProperty('--coin-dx', '0px');
        }
        payoutCoinEl.src = coinFrames[0];
      }
      if (resetPile && coinPileEl) coinPileEl.innerHTML = '';
    }

    function addCoinToTray(index) {
      if (!coinPileEl) return;
      const coin = createElement('img');
      if (!coin) return;
      coin.className = 'tray-coin';
      coin.src = coinFrames[index % coinFrames.length];
      coin.alt = '';
      if (typeof coin.setAttribute === 'function') coin.setAttribute('aria-hidden', 'true');
      const leftPositions = [8, 28, 48, 68, 18, 38, 58];
      const bottomPositions = [0, 4, 2, 6, 10, 8, 12];
      const rotates = ['-16deg', '8deg', '-6deg', '14deg', '-12deg', '5deg', '-2deg'];
      if (coin.style) {
        coin.style.left = `${leftPositions[index % leftPositions.length]}px`;
        coin.style.bottom = `${bottomPositions[index % bottomPositions.length]}px`;
        if (typeof coin.style.setProperty === 'function') {
          coin.style.setProperty('--tray-rotate', rotates[index % rotates.length]);
        }
      }
      coinPileEl.appendChild(coin);
      while (coinPileEl.children && coinPileEl.children.length > 7) {
        coinPileEl.removeChild(coinPileEl.firstChild);
      }
    }

    function animatePayoutCoin(dx) {
      if (!payoutCoinEl) return;
      payoutCoinEl.src = coinFrames[0];
      if (payoutCoinEl.style && typeof payoutCoinEl.style.setProperty === 'function') {
        payoutCoinEl.style.setProperty('--coin-dx', `${dx}px`);
      }
      if (payoutCoinEl.classList && typeof payoutCoinEl.classList.remove === 'function') {
        payoutCoinEl.classList.remove('is-dropping');
      }
      void payoutCoinEl.offsetWidth;
      if (payoutCoinEl.classList && typeof payoutCoinEl.classList.add === 'function') {
        payoutCoinEl.classList.add('is-dropping');
      }
      let frame = 0;
      const frameTimer = setIntervalRef(function () {
        frame = (frame + 1) % coinFrames.length;
        if (payoutCoinEl) payoutCoinEl.src = coinFrames[frame];
      }, 50);
      setTimeoutRef(function () {
        clearIntervalRef(frameTimer);
        if (!payoutCoinEl) return;
        if (payoutCoinEl.classList && typeof payoutCoinEl.classList.remove === 'function') {
          payoutCoinEl.classList.remove('is-dropping');
        }
        payoutCoinEl.src = coinFrames[0];
      }, 430);
    }

    function runCoinTrayDispense(win, stake = 1) {
      if (!coinPayoutZoneEl || !payoutCoinEl || !coinPileEl || !(win > 0)) return;
      resetCoinTray(true);
      const token = feedbackState.coinDispenseToken;
      const baseStake = Math.max(0.1, Number(stake) || 0.1);
      const pileCoins = Math.min(7, Math.max(2, Math.round(win / Math.max(baseStake * 2, 0.5))));
      const drops = Math.min(10, pileCoins + (win >= baseStake * 10 ? 3 : 1));
      const offsets = [-16, -8, 10, 18, 4, -12, 14, -4];
      let emitted = 0;
      coinPayoutZoneEl.dataset.active = 'true';

      const drop = function () {
        if (token !== feedbackState.coinDispenseToken) return;
        animatePayoutCoin(offsets[emitted % offsets.length]);
        if (emitted < pileCoins) addCoinToTray(emitted);
        if (emitted === 0 || emitted % 2 === 0) playCoinSound();
        emitted += 1;
        if (emitted >= drops) {
          if (feedbackState.coinDispenseTimer) {
            clearIntervalRef(feedbackState.coinDispenseTimer);
            feedbackState.coinDispenseTimer = 0;
          }
          feedbackState.coinDispenseResetTimer = setTimeoutRef(function () {
            if (token !== feedbackState.coinDispenseToken || !coinPayoutZoneEl) return;
            coinPayoutZoneEl.dataset.active = 'false';
            feedbackState.coinDispenseResetTimer = 0;
          }, 900);
        }
      };

      drop();
      feedbackState.coinDispenseTimer = setIntervalRef(drop, 180);
    }

    function stopAttractMode(nextState = 'off') {
      if (feedbackState.attractModeTimer) {
        clearIntervalRef(feedbackState.attractModeTimer);
        feedbackState.attractModeTimer = 0;
      }
      feedbackState.attractModeDelay = 0;
      if (appEl) appEl.dataset.attract = nextState;
    }

    function attractDelayForMode(mode) {
      if (mode === 'bigwin') return 140;
      if (mode === 'win') return 200;
      if (mode === 'freespins') return 280;
      return 430;
    }

    function normalizeLightOverride(value) {
      if (!value) return null;
      if (typeof value === 'number') {
        return { mode: 'win', pulse: 'soft', tier: 'regular', duration: Math.max(180, value) };
      }
      if (typeof value === 'string') {
        return {
          mode: value,
          pulse: value === 'spin' ? 'reel' : value === 'freespins' ? 'bonus' : value === 'bigwin' ? 'jackpot' : 'soft',
          tier: value === 'freespins' ? 'bonus' : value === 'bigwin' ? 'big' : 'regular',
          duration: 1800
        };
      }
      return {
        mode: value.mode || 'win',
        pulse: value.pulse || (value.mode === 'spin' ? 'reel' : value.mode === 'freespins' ? 'bonus' : value.mode === 'bigwin' ? 'jackpot' : 'soft'),
        tier: value.tier || (value.mode === 'freespins' ? 'bonus' : value.mode === 'bigwin' ? 'big' : 'regular'),
        duration: Math.max(180, Number(value.duration) || 1800)
      };
    }

    function getCabinetLightState() {
      const override = normalizeLightOverride(feedbackState.cabinetLightOverride);
      if (override) return override;
      if (getSpinInProgress()) return { mode: 'spin', pulse: 'reel', tier: 'base', duration: 0 };
      if (getInFreeSpins()) return { mode: 'freespins', pulse: 'bonus', tier: 'bonus', duration: 0 };
      return { mode: 'normal', pulse: 'idle', tier: 'base', duration: 0 };
    }

    function syncCabinetLights() {
      if (!appEl) return;
      const lightState = getCabinetLightState();
      const mode = lightState.mode || 'normal';
      appEl.dataset.lightMode = mode;
      appEl.dataset.lightPulse = lightState.pulse || 'idle';
      appEl.dataset.winTier = lightState.tier || 'base';
      if (mode === 'spin' || mode === 'bigwin' || lightState.pulse === 'jackpot') {
        stopAttractMode('all');
        return;
      }
      const nextDelay = attractDelayForMode(mode);
      if (feedbackState.attractModeTimer && feedbackState.attractModeDelay === nextDelay) return;
      stopAttractMode('left');
      let leftSide = true;
      feedbackState.attractModeDelay = nextDelay;
      feedbackState.attractModeTimer = setIntervalRef(function () {
        leftSide = !leftSide;
        if (appEl) appEl.dataset.attract = leftSide ? 'left' : 'right';
      }, nextDelay);
    }

    function pulseCabinetWin(duration = 1800) {
      const lightOverride = normalizeLightOverride(duration) || { mode: 'win', pulse: 'soft', tier: 'regular', duration: 1800 };
      feedbackState.cabinetLightOverride = lightOverride;
      syncCabinetLights();
      if (feedbackState.cabinetLightOverrideTimer) {
        clearTimeoutRef(feedbackState.cabinetLightOverrideTimer);
      }
      feedbackState.cabinetLightOverrideTimer = setTimeoutRef(function () {
        feedbackState.cabinetLightOverride = null;
        feedbackState.cabinetLightOverrideTimer = 0;
        syncCabinetLights();
      }, lightOverride.duration);
    }

    function spawnCoinParticles(x, y, count = 8, options = {}) {
      if (!documentRef || !documentRef.body) return;
      const variant = options.variant || 'coins';
      const intensity = Math.max(0.55, Math.min(2.1, Number(options.intensity) || 1));
      const accent = options.accent || '#ffd36b';
      const coinCount = Math.max(1, Math.floor(count || 0));
      const sparkCount = variant === 'jackpot'
        ? Math.max(5, Math.round(coinCount * 0.42))
        : variant === 'bigwin'
          ? Math.max(2, Math.round(coinCount * 0.24))
          : Math.max(1, Math.round(coinCount * 0.1));
      const total = coinCount + sparkCount;
      for (let index = 0; index < total; index += 1) {
        const particle = createElement('div');
        if (!particle) return;
        const isSpark = index >= coinCount;
        particle.className = isSpark ? 'coin-particle is-spark' : 'coin-particle';
        if (particle.dataset) particle.dataset.variant = variant;
        documentRef.body.appendChild(particle);
        const angle = (Math.PI * 2) * (index / total) + (randomValue() - 0.5) * (isSpark ? 1.05 : 0.62);
        const speed = (isSpark ? 82 : 50) * intensity + randomValue() * (isSpark ? 74 : 62);
        const scale = isSpark ? (0.68 + randomValue() * 0.36) : (0.9 + randomValue() * 0.24);
        if (particle.style) {
          particle.style.left = `${x - 9}px`;
          particle.style.top = `${y - 9}px`;
          particle.style.opacity = '1';
          particle.style.transform = 'translateY(0) scale(1)';
          if (typeof particle.style.setProperty === 'function') {
            particle.style.setProperty('--particle-accent', accent);
            particle.style.setProperty('--particle-scale', scale.toFixed(3));
            particle.style.setProperty('--particle-tilt', `${((randomValue() * 38) - 19).toFixed(2)}deg`);
          }
        }
        const dx = Math.cos(angle) * speed;
        const dy = Math.sin(angle) * speed * -1.18;
        if (typeof particle.animate === 'function') {
          particle.animate([
            { transform: `translate(0px,0px) rotate(0deg) scale(${scale})`, opacity: 1 },
            { transform: `translate(${dx}px,${dy}px) rotate(${(dx * 0.2).toFixed(2)}deg) scale(${(scale * (isSpark ? 1.24 : 1.14)).toFixed(3)})`, opacity: 0 }
          ], {
            duration: (isSpark ? 620 : 1020) + randomValue() * (isSpark ? 220 : 320),
            easing: isSpark ? 'cubic-bezier(.15,.92,.32,1)' : 'cubic-bezier(.2,.8,.2,1)'
          });
        }
        setTimeoutRef(function () {
          if (typeof particle.remove === 'function') particle.remove();
        }, isSpark ? 1140 : 1560);
      }
    }

    function getCellCenter(index, relativeToRect = null) {
      const target = getGridCellByIndex(index) || getImageElByIndex(index);
      if (!target || typeof target.getBoundingClientRect !== 'function') {
        const fallback = getViewportCenter();
        return relativeToRect
          ? { x: fallback.x - relativeToRect.left, y: fallback.y - relativeToRect.top }
          : fallback;
      }
      const rect = target.getBoundingClientRect();
      const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      return relativeToRect
        ? { x: point.x - relativeToRect.left, y: point.y - relativeToRect.top }
        : point;
    }

    function hexToRgba(hex, alpha = 1) {
      if (!hex) return `rgba(255,220,120,${alpha})`;
      const normalized = hex.replace('#', '');
      const raw = normalized.length === 3
        ? normalized.split('').map(function (chunk) { return chunk + chunk; }).join('')
        : normalized;
      const value = parseInt(raw, 16);
      const r = (value >> 16) & 255;
      const g = (value >> 8) & 255;
      const b = value & 255;
      return `rgba(${r},${g},${b},${alpha})`;
    }

    function clearPaylineOverlay() {
      const overlayEl = getPaylineOverlayEl();
      if (!overlayEl) return null;
      while (overlayEl.firstChild) overlayEl.removeChild(overlayEl.firstChild);
      return overlayEl;
    }

    function drawPayline(indices, color) {
      const overlayEl = clearPaylineOverlay();
      if (!overlayEl || typeof overlayEl.getBoundingClientRect !== 'function') return Promise.resolve();
      const overlayRect = overlayEl.getBoundingClientRect();
      if (typeof overlayEl.setAttribute === 'function') {
        overlayEl.setAttribute('viewBox', `0 0 ${overlayRect.width} ${overlayRect.height}`);
        overlayEl.setAttribute('preserveAspectRatio', 'none');
      }
      const points = indices.map(function (index) { return getCellCenter(index, overlayRect); });
      if (points.length < 2) return Promise.resolve();
      const pathData = points.map(function (point, pointIndex) {
        return `${pointIndex === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
      }).join(' ');
      const glow = createElementNS('http://www.w3.org/2000/svg', 'path');
      const line = createElementNS('http://www.w3.org/2000/svg', 'path');
      if (!glow || !line) return Promise.resolve();
      if (typeof glow.setAttribute === 'function') {
        glow.setAttribute('d', pathData);
        glow.setAttribute('class', 'glow');
        glow.setAttribute('stroke', hexToRgba(color, 0.9));
      }
      if (typeof line.setAttribute === 'function') {
        line.setAttribute('d', pathData);
        line.setAttribute('class', 'line');
        line.setAttribute('stroke', hexToRgba(color, 1));
      }
      overlayEl.appendChild(glow);
      overlayEl.appendChild(line);
      const length = typeof line.getTotalLength === 'function' ? line.getTotalLength() : 1;
      if (line.style) {
        line.style.strokeDasharray = `${length}`;
        line.style.strokeDashoffset = `${length}`;
      }
      if (typeof line.animate === 'function') {
        line.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: 700, easing: 'cubic-bezier(.2,.9,.2,1)' });
      }
      if (glow.style) glow.style.opacity = '0.9';
      if (typeof glow.animate === 'function') {
        glow.animate([{ opacity: 0 }, { opacity: 0.9 }], { duration: 350, fill: 'forwards' });
      }
      return new Promise(function (resolve) {
        setTimeoutRef(function () {
          clearPaylineOverlay();
          resolve();
        }, 900);
      });
    }

    async function drawPaylines(wins) {
      if (!wins || !wins.length) return;
      for (let index = 0; index < wins.length; index += 1) {
        const win = wins[index];
        const color = paylineColorForIndex(win.paylineIndex);
        if (!win.drawIndices || win.drawIndices.length < 2) continue;
        try {
          await drawPayline(win.drawIndices, color);
        } catch (error) { }
        await new Promise(function (resolve) {
          setTimeoutRef(resolve, 140);
        });
      }
    }

    function createPayoutBadge(text, color) {
      const badge = createElement('div');
      if (!badge) return null;
      badge.className = 'payout-badge';
      badge.textContent = text;
      if (badge.style) {
        badge.style.background = hexToRgba(color, 0.12);
        badge.style.color = hexToRgba(color, 0.98);
        badge.style.border = `1px solid ${hexToRgba(color, 0.18)}`;
        badge.style.boxShadow = `0 4px 12px ${hexToRgba(color, 0.18)}`;
      }
      return badge;
    }

    function renderResultHighlights(options = {}) {
      const wins = Array.isArray(options.wins) ? options.wins : [];
      const scatterWin = Number(options.scatterWin) || 0;
      const finalScatter = Number(options.finalScatter) || 0;
      const formatAmount = typeof options.formatAmount === 'function'
        ? options.formatAmount
        : function (value) { return String(value || 0); };

      if (wins.length) {
        clearHighlights();
        let totalPayout = 0;
        const linesText = [];
        const highlightedCells = new Set();
        if (scatterWin > 0) linesText.push(`Libro x${finalScatter} → ${formatAmount(scatterWin)}`);
        wins.forEach(function (win, index) {
          const lineNumber = Number.isInteger(win.paylineIndex) ? (win.paylineIndex + 1) : (index + 1);
          const color = paylineColorForIndex(win.paylineIndex);
          const highlightIndices = win.highlightIndices || win.indices || [];
          totalPayout += win.payout || 0;
          linesText.push(`${win.isExpansion ? `Linea ${lineNumber} Espansa` : `Linea ${lineNumber}`}: ${win.symbol} x${win.count} → ${formatAmount(win.payout)}`);
          highlightIndices.forEach(function (cellIndex, cellIndexPosition) {
            const cell = getGridCellByIndex(cellIndex);
            if (!cell) return;
            highlightedCells.add(cellIndex);
            if (cell.classList && typeof cell.classList.add === 'function') cell.classList.add('payline');
            if (cell.style) {
              cell.style.outlineColor = color;
              cell.style.boxShadow = `0 6px 18px ${color}40`;
            }
            if (cellIndexPosition === 0) {
              const badge = createPayoutBadge(formatAmount(win.payout || 0), color);
              if (badge) cell.appendChild(badge);
            }
          });
        });
        getGridCells().forEach(function (cell, cellIndex) {
          if (!cell || !cell.classList || typeof cell.classList.add !== 'function' || typeof cell.classList.remove !== 'function') return;
          if (highlightedCells.has(cellIndex)) {
            cell.classList.remove('is-muted');
            return;
          }
          cell.classList.add('is-muted');
        });
        drawPaylines(wins).catch(noop);
        setWinDetails(`<strong>Totale:</strong> ${formatAmount(totalPayout + scatterWin)} &nbsp; — &nbsp; ${linesText.join(' • ')}`);
        return { totalPayout, linesText };
      }
      if (scatterWin > 0) {
        setWinDetails(`<strong>Libro:</strong> x${finalScatter} → ${formatAmount(scatterWin)}`);
      } else {
        setWinDetails('');
      }
      return { totalPayout: 0, linesText: [] };
    }

    function markWinningCells(wins) {
      getGridCells().forEach(function (cell) {
        if (cell && cell.classList && typeof cell.classList.remove === 'function') {
          cell.classList.remove('win');
        }
      });
      let firstWinIndex = null;
      (wins || []).forEach(function (win) {
        (win.highlightIndices || win.indices || []).forEach(function (cellIndex) {
          const cell = getGridCellByIndex(cellIndex);
          if (!cell) return;
          if (cell.classList && typeof cell.classList.add === 'function') cell.classList.add('win');
          if (firstWinIndex === null) firstWinIndex = cellIndex;
        });
      });
      return firstWinIndex;
    }

    return {
      setCabinetNotice,
      setWinDetails,
      clearHighlights,
      showFloat,
      showBigWin,
      resetCoinTray,
      runCoinTrayDispense,
      stopAttractMode,
      syncCabinetLights,
      pulseCabinetWin,
      spawnCoinParticles,
      getCellCenter,
      drawPaylines,
      renderResultHighlights,
      markWinningCells,
      isBonusPickOpen: function () { return feedbackState.bonusOpen === true; },
      resolveBonusPick
    };
  }

  return { createPaytableController, createFeedbackUIController };
});
