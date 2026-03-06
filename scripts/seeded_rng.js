(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.SeededRng = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createSeededRngController(options = {}) {
    const windowRef = options.windowRef || null;
    const cryptoRef = options.cryptoRef || (windowRef && windowRef.crypto) || null;
    const setIntervalRef = options.setIntervalRef || (windowRef && windowRef.setInterval ? windowRef.setInterval.bind(windowRef) : null);
    const clearIntervalRef = options.clearIntervalRef || (windowRef && windowRef.clearInterval ? windowRef.clearInterval.bind(windowRef) : null);
    const intervalMs = options.intervalMs == null ? 64 : options.intervalMs;
    const stepsPerTick = options.stepsPerTick == null ? 8 : options.stepsPerTick;

    let state = new Uint32Array(4);
    let advanceIntervalId = 0;

    function rotl(value, shift) {
      return ((value << shift) | (value >>> (32 - shift))) >>> 0;
    }

    function next() {
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

    function seedFromBytes(bytes) {
      const source = bytes || [];
      const view = new DataView(new ArrayBuffer(16));
      for (let index = 0; index < 4; index += 1) {
        const offset = index * 4;
        const value =
          (source[offset] || 0) |
          ((source[offset + 1] || 0) << 8) |
          ((source[offset + 2] || 0) << 16) |
          ((source[offset + 3] || 0) << 24);
        view.setUint32(offset, value, true);
      }
      state = new Uint32Array(view.buffer);
      return state;
    }

    function seedFromHex(hex) {
      const normalized = String(hex || '').replace(/[^0-9a-fA-F]/g, '');
      const padded = (normalized + '0'.repeat(32)).slice(0, 32);
      const bytes = new Uint8Array(16);
      for (let index = 0; index < 16; index += 1) {
        bytes[index] = parseInt(padded.slice(index * 2, index * 2 + 2), 16) || 0;
      }
      return seedFromBytes(bytes);
    }

    function seedToHex() {
      const view = new DataView(state.buffer.slice(0));
      let output = '';
      for (let index = 0; index < 4; index += 1) {
        output += view.getUint32(index * 4, true).toString(16).padStart(8, '0');
      }
      return output.slice(0, 32);
    }

    function seedFromCrypto() {
      if (!cryptoRef || typeof cryptoRef.getRandomValues !== 'function') return false;
      const nextState = new Uint32Array(4);
      cryptoRef.getRandomValues(nextState);
      state = nextState;
      return true;
    }

    function startAdvance() {
      if (advanceIntervalId || !setIntervalRef) return advanceIntervalId;
      advanceIntervalId = setIntervalRef(function () {
        for (let index = 0; index < stepsPerTick; index += 1) next();
      }, intervalMs);
      return advanceIntervalId;
    }

    function stopAdvance() {
      if (!advanceIntervalId || !clearIntervalRef) return false;
      clearIntervalRef(advanceIntervalId);
      advanceIntervalId = 0;
      return true;
    }

    function installGlobals(target = windowRef) {
      if (!target) return null;
      target._rng = next;
      target._seedFromBytes = seedFromBytes;
      target._seedFromCrypto = seedFromCrypto;
      target._seedFromHex = seedFromHex;
      target._seedToHex = seedToHex;
      target.startRng = startAdvance;
      target.stopRng = stopAdvance;
      return target;
    }

    const controller = {
      next,
      seedFromBytes,
      seedFromHex,
      seedToHex,
      seedFromCrypto,
      startAdvance,
      stopAdvance,
      installGlobals
    };

    if (options.autoInstallGlobals !== false) installGlobals(windowRef);
    if (options.autoAdvance !== false) startAdvance();

    return controller;
  }

  return { createSeededRngController };
});
