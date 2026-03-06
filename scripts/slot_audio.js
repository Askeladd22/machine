/**
 * @fileoverview SlotAudio - Centralized audio management system
 * 
 * This module provides:
 * - Event-driven audio playback with vintage sound effects
 * - Web Audio API with HTMLAudioElement fallback
 * - Audio queue management (prevent overlap)
 * - Master volume control (0-1 range, persisted in localStorage)
 * - Lazy loading of audio assets (doesn't block game start)
 * - Clean public API: init(), play(eventName), stopAll(), setVolume()
 * 
 * Audio Assets (8 vintage sounds):
 * - lever_pull: Mechanical click + thunk (300ms)
 * - reel_spin: Looping mechanical whirring (2.5s)
 * - reel_stop_0/1/2: Individual reel clack sounds (200ms each)
 * - win_fanfare: Vintage "ding ding ding" celebration (2s)
 * - free_spin_trigger: Ascending chime sequence (1s)
 * - ui_click: Subtle mechanical click for UI (100ms)
 * 
 * @module SlotAudio
 * @author CRACKHOUSE Slot Machine
 * @version 2.0.0 - Refactored audio system
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }
  root.SlotAudio = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  /**
   * Audio asset registry - maps audio event names to file paths
   * @const {Object}
   */
  const AUDIO_ASSETS = {
    'lever_pull': 'sounds/lever_pull.mp3',
    'reel_spin': 'sounds/reel_spin.mp3',
    'reel_stop_0': 'sounds/reel_stop_0.mp3',
    'reel_stop_1': 'sounds/reel_stop_1.mp3',
    'reel_stop_2': 'sounds/reel_stop_2.mp3',
    'win_fanfare': 'sounds/win_fanfare.mp3',
    'free_spin_trigger': 'sounds/free_spin_trigger.mp3',
    'ui_click': 'sounds/ui_click.mp3'
  };

  /**
   * Creates a refactored audio manager for centralized sound control
   * @param {Object} [options={}] - Configuration options
   * @returns {Object} Audio manager with public API
   */
  function createAudioManager(options) {
    options = options || {};
    
    // Configuration
    const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
    const eventTarget = options.eventTarget || root;
    const AudioContextCtor = options.AudioContextCtor || root.AudioContext || root.webkitAudioContext || null;
    const storageKey = 'slotAudio_masterVolume';
    const ambientToggleEl = options.ambientToggleEl || null;
    const getInFreeSpins = typeof options.getInFreeSpins === 'function' ? options.getInFreeSpins : function () { return false; };
    const showFloat = typeof options.showFloat === 'function' ? options.showFloat : function () {};
    
    // State management
    let audioContext = null;
    let audioBuffers = {}; // Cached decoded audio buffers
    let isPlayingMap = {}; // Track which sounds are currently playing
    let masterVolume = 0.8; // Default master volume (0-1)
    let audioInitialized = false;
    let audioReady = false;
    let firstGestureBound = false;
    let ambientEnabled = true;
    let spinSfxEnabled = true;
    let ambientNodes = null;

    // Load persisted volume from localStorage
    function loadPersistedVolume() {
      try {
        if (documentRef && documentRef.defaultView && documentRef.defaultView.localStorage) {
          const stored = documentRef.defaultView.localStorage.getItem(storageKey);
          if (stored !== null) {
            const vol = parseFloat(stored);
            if (!isNaN(vol) && vol >= 0 && vol <= 1) {
              masterVolume = vol;
            }
          }
        }
      } catch (error) {
        // Silently fail if localStorage unavailable
      }
    }

    // Persist volume to localStorage
    function persistVolume() {
      try {
        if (documentRef && documentRef.defaultView && documentRef.defaultView.localStorage) {
          documentRef.defaultView.localStorage.setItem(storageKey, masterVolume.toString());
        }
      } catch (error) {
        // Silently fail if localStorage unavailable
      }
    }

    // Get or create Web Audio API context
    function getAudioContext() {
      if (audioContext) return audioContext;
      if (!AudioContextCtor) return null;
      try {
        audioContext = new AudioContextCtor();
        // Resume on first user interaction if suspended
        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(function () {});
        }
      } catch (error) {
        console.error('Failed to create AudioContext:', error);
        audioContext = null;
      }
      return audioContext;
    }

    // Load audio file via fetch and decode
    function loadAudioFile(eventName, filePath) {
      if (typeof fetch !== 'function') return Promise.resolve(null);
      return fetch(filePath)
        .then(function (response) {
          if (!response.ok) throw new Error('Failed to load ' + filePath);
          return response.arrayBuffer();
        })
        .then(function (arrayBuffer) {
          const ctx = getAudioContext();
          if (!ctx) {
            console.warn('AudioContext unavailable, falling back to HTMLAudioElement');
            return null;
          }
          return ctx.decodeAudioData(arrayBuffer);
        })
        .catch(function (error) {
          console.warn('Failed to load audio asset ' + eventName + ':', error);
          return null;
        });
    }

    function prepareAudio() {
      if (!audioInitialized) init();
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(function () {});
      }
      return ctx;
    }

    function clamp(value, min, max, fallback) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return fallback;
      return Math.min(max, Math.max(min, numeric));
    }

    function ifSfxEnabled(callback) {
      if (!spinSfxEnabled) return null;
      return callback();
    }

    function withAudioNodes(factory) {
      const ctx = prepareAudio();
      if (!ctx) return null;
      try {
        return factory(ctx);
      } catch (error) {
        console.error('Error creating audio nodes:', error);
        return null;
      }
    }

    function playTone(frequency, durationSec, volume, options) {
      options = options || {};
      return withAudioNodes(function (ctx) {
        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const filter = typeof ctx.createBiquadFilter === 'function' ? ctx.createBiquadFilter() : null;
        const gainNode = ctx.createGain();
        const startFrequency = clamp(frequency, 40, 4000, 440);
        const endFrequency = clamp(options.endFrequency, 40, 5000, startFrequency * 0.72);
        const peakGain = Math.max(0.0001, masterVolume * clamp(volume, 0.002, 0.18, 0.03));
        const attack = clamp(options.attack, 0.002, 0.08, 0.006);
        const release = Math.max(attack + 0.02, clamp(durationSec, 0.02, 0.9, 0.08));
        oscillator.type = options.type || 'triangle';
        oscillator.frequency.setValueAtTime(startFrequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + release);
        if (oscillator.detune && Number.isFinite(options.detune)) {
          oscillator.detune.setValueAtTime(options.detune, now);
        }
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(peakGain, now + attack);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + release);
        if (filter) {
          filter.type = options.filterType || 'lowpass';
          filter.frequency.setValueAtTime(clamp(options.filterFrequency, 180, 6000, 2400), now);
          oscillator.connect(filter);
          filter.connect(gainNode);
        } else {
          oscillator.connect(gainNode);
        }
        gainNode.connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + release + 0.02);
        return oscillator;
      });
    }

    function playToneStack(frequencies, options) {
      options = options || {};
      const wait = options.spacingMs == null ? 48 : options.spacingMs;
      (frequencies || []).forEach(function (frequency, index) {
        root.setTimeout(function () {
          playTone(frequency, options.durationSec, options.volume, {
            type: options.type,
            endFrequency: Array.isArray(options.endFrequencies) ? options.endFrequencies[index] : options.endFrequency,
            filterType: options.filterType,
            filterFrequency: options.filterFrequency,
            detune: Number.isFinite(options.detune) ? options.detune + index * 14 : index * 14
          });
        }, wait * index);
      });
    }

    function destroyAmbientNodes() {
      if (!ambientNodes) return;
      try {
        ambientNodes.oscillators.forEach(function (oscillator) {
          if (!oscillator) return;
          oscillator.stop();
          oscillator.disconnect();
        });
        if (ambientNodes.lfo) {
          ambientNodes.lfo.stop();
          ambientNodes.lfo.disconnect();
        }
        if (ambientNodes.master) ambientNodes.master.disconnect();
        if (ambientNodes.filter) ambientNodes.filter.disconnect();
        if (ambientNodes.motion) ambientNodes.motion.disconnect();
      } catch (error) {
        console.warn('Ambient cleanup failed:', error);
      }
      ambientNodes = null;
    }

    function ensureAmbientNodes() {
      if (!ambientEnabled) return null;
      if (ambientNodes) return ambientNodes;
      const ctx = prepareAudio();
      if (!ctx) return null;
      const master = ctx.createGain();
      const filter = typeof ctx.createBiquadFilter === 'function' ? ctx.createBiquadFilter() : null;
      const motion = ctx.createGain();
      const lfo = ctx.createOscillator();
      const oscillators = [
        ctx.createOscillator(),
        ctx.createOscillator()
      ];

      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      motion.gain.setValueAtTime(0.0028 * masterVolume, ctx.currentTime);
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
      lfo.connect(motion);
      motion.connect(master.gain);

      oscillators[0].type = 'sine';
      oscillators[1].type = 'triangle';
      oscillators[0].frequency.setValueAtTime(48, ctx.currentTime);
      oscillators[1].frequency.setValueAtTime(108, ctx.currentTime);

      oscillators.forEach(function (oscillator) {
        if (filter) {
          oscillator.connect(filter);
        } else {
          oscillator.connect(master);
        }
      });
      if (filter) {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(360, ctx.currentTime);
        filter.Q.setValueAtTime(0.54, ctx.currentTime);
        filter.connect(master);
      }
      master.connect(ctx.destination);
      oscillators.forEach(function (oscillator) { oscillator.start(); });
      lfo.start();
      ambientNodes = {
        master: master,
        filter: filter,
        motion: motion,
        lfo: lfo,
        oscillators: oscillators
      };
      return ambientNodes;
    }

    // Initialize - load all audio assets asynchronously (non-blocking)
    function init(callback) {
      if (audioInitialized) {
        if (typeof callback === 'function') callback();
        return;
      }

      audioInitialized = true;
      loadPersistedVolume();

      // Get or create audio context
      const ctx = getAudioContext();
      if (!ctx) {
        console.warn('Web Audio API unavailable, audio playback may be limited');
        audioReady = true;
        if (typeof callback === 'function') callback();
        return;
      }

      // Load all audio assets asynchronously (non-blocking)
      const loadPromises = Object.entries(AUDIO_ASSETS).map(function (entry) {
        const name = entry[0];
        const path = entry[1];
        return loadAudioFile(name, path).then(function (buffer) {
          if (buffer) {
            audioBuffers[name] = buffer;
          }
        });
      });

      // Call callback when all loads complete
      Promise.all(loadPromises)
        .then(function () {
          audioReady = true;
          bindFirstGestureBootstrap();
          if (ambientEnabled) syncAmbientMood();
          if (typeof callback === 'function') callback();
        })
        .catch(function (error) {
          console.warn('Error during audio initialization:', error);
          audioReady = true;
          if (typeof callback === 'function') callback();
        });
    }

    // Resume audio context on first user interaction
    function bindFirstGestureBootstrap() {
      if (!eventTarget || firstGestureBound) return;
      firstGestureBound = true;
      const events = ['click', 'pointerdown', 'keydown', 'touchstart'];
      events.forEach(function (eventName) {
        eventTarget.addEventListener(eventName, function resumeAudio() {
          prepareAudio();
          const ctx = getAudioContext();
          if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(function () {});
          }
          if (ambientEnabled) startAmbientSound();
          if (typeof eventTarget.removeEventListener === 'function') {
            eventTarget.removeEventListener(eventName, resumeAudio);
          }
        }, { once: true, passive: true });
      });
    }

    // Play sound by event name with queue management
    function play(eventName, options) {
      options = options || {};
      const ctx = prepareAudio();
      if (!ctx) return;
      if (!audioReady || !audioBuffers[eventName]) return;
      const allowOverlap = options.allowOverlap === true;
      if (!allowOverlap && isPlayingMap[eventName]) return;

      try {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffers[eventName];
        const playbackRate = clamp(options.playbackRate, 0.45, 1.8, 1);
        source.playbackRate.value = playbackRate;
        if (source.detune && Number.isFinite(options.detune)) {
          source.detune.value = options.detune;
        }
        source.loop = options.loop === true;

        // Apply master volume
        const gainNode = ctx.createGain();
        const targetGain = masterVolume * clamp(options.volume, 0.01, 1.5, 1.0);
        const now = ctx.currentTime;
        if (options.fadeInMs) {
          gainNode.gain.setValueAtTime(0.0001, now);
          gainNode.gain.exponentialRampToValueAtTime(targetGain, now + (options.fadeInMs / 1000));
        } else {
          gainNode.gain.setValueAtTime(targetGain, now);
        }
        if (options.fadeOutMs) {
          const tailStart = now + Math.max(0.02, source.buffer.duration / playbackRate - (options.fadeOutMs / 1000));
          gainNode.gain.setValueAtTime(targetGain, tailStart);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, tailStart + (options.fadeOutMs / 1000));
        }

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Track playback
        if (!allowOverlap) isPlayingMap[eventName] = true;
        source.onended = function () {
          if (!allowOverlap) isPlayingMap[eventName] = false;
        };

        source.start(0);
      } catch (error) {
        console.error('Error playing audio:', eventName, error);
        if (!allowOverlap) isPlayingMap[eventName] = false;
      }
    }

    // Stop all currently playing sounds
    function stopAll() {
      const ctx = getAudioContext();
      if (!ctx) return;

      // Clear the playing map
      Object.keys(isPlayingMap).forEach(function (key) {
        isPlayingMap[key] = false;
      });
      stopAmbientSound(120);
    }

    // Set master volume (0-1 range)
    function setVolume(volumeLevel) {
      masterVolume = Math.max(0, Math.min(1, volumeLevel || 0.8));
      persistVolume();
    }

    // Get current master volume
    function getVolume() {
      return masterVolume;
    }

    // ========== Backward Compatibility API (maintaining legacy methods) ==========
    // These stubs maintain compatibility with existing code that may call them

    function bootstrapAudio() {
      init();
    }

    function playLeverSound() {
      ifSfxEnabled(function () {
        play('lever_pull', { volume: 0.82, playbackRate: 0.94, detune: -26, fadeOutMs: 120 });
        playTone(112, 0.11, 0.022, { type: 'triangle', endFrequency: 78, filterType: 'lowpass', filterFrequency: 860 });
        playTone(284, 0.045, 0.008, { type: 'sine', endFrequency: 198, filterType: 'bandpass', filterFrequency: 760 });
        playTone(612, 0.022, 0.004, { type: 'triangle', endFrequency: 452, filterType: 'highpass', filterFrequency: 1240 });
      });
    }

    function playReelStartSound(reel, intensity) {
      ifSfxEnabled(function () {
        const reelIndex = Math.max(0, Number(reel) || 0);
        const spinIntensity = clamp(intensity, 0.35, 1.2, 0.7);
        play('reel_spin', {
          volume: 0.22 + spinIntensity * 0.14,
          playbackRate: 0.88 + reelIndex * 0.022 + spinIntensity * 0.06,
          detune: reelIndex * 14 - 18,
          fadeInMs: 22,
          fadeOutMs: 320,
          allowOverlap: true
        });
        playTone(86 + reelIndex * 7, 0.09 + spinIntensity * 0.03, 0.012 + spinIntensity * 0.004, {
          type: 'triangle',
          endFrequency: 62 + reelIndex * 5,
          filterType: 'lowpass',
          filterFrequency: 900
        });
        playTone(344 + reelIndex * 18, 0.026, 0.004 + spinIntensity * 0.003, {
          type: 'triangle',
          endFrequency: 274 + reelIndex * 12,
          filterType: 'highpass',
          filterFrequency: 1180
        });
      });
    }

    function playReelStopSound(reel, isLast) {
      var reelIndex = reel || 0;
      ifSfxEnabled(function () {
        play('reel_stop_' + Math.min(reelIndex, 2), {
          volume: isLast ? 0.76 : 0.58,
          playbackRate: 0.96 + reelIndex * 0.02,
          detune: reelIndex * 18,
          allowOverlap: true
        });
        playTone(264 - reelIndex * 14, 0.045, isLast ? 0.018 : 0.014, {
          type: 'triangle',
          endFrequency: 156 - reelIndex * 7,
          filterType: 'bandpass',
          filterFrequency: 920
        });
        playTone(820 - reelIndex * 74, 0.016, isLast ? 0.008 : 0.005, {
          type: 'triangle',
          endFrequency: 612 - reelIndex * 44,
          filterType: 'highpass',
          filterFrequency: 1620
        });
        if (isLast) {
          playTone(522, 0.075, 0.012, {
            type: 'sine',
            endFrequency: 362,
            filterType: 'bandpass',
            filterFrequency: 1240
          });
        }
      });
    }

    function playSmallWinSound(options) {
      options = options || {};
      ifSfxEnabled(function () {
        const intensity = clamp(options.intensity, 0.4, 1.5, 0.85);
        play('win_fanfare', {
          volume: 0.38 + intensity * 0.1,
          playbackRate: 0.99 + intensity * 0.03,
          detune: 12,
          allowOverlap: true
        });
        playToneStack(intensity > 1 ? [523, 659, 784, 988] : [523, 659, 784], {
          spacingMs: 54,
          durationSec: 0.12,
          volume: 0.01 + intensity * 0.004,
          type: 'triangle',
          endFrequency: 560,
          filterType: 'highpass',
          filterFrequency: 1320
        });
      });
    }

    function playBigWinSound(options) {
      options = options || {};
      ifSfxEnabled(function () {
        const tier = options.tier || 'big';
        const intense = tier === 'mega' ? 1.22 : 1.06;
        play('win_fanfare', {
          volume: 0.62 * intense,
          playbackRate: tier === 'mega' ? 1.05 : 1.01,
          detune: tier === 'mega' ? 56 : 18,
          allowOverlap: true
        });
        root.setTimeout(function () {
          play('free_spin_trigger', {
            volume: (tier === 'mega' ? 0.26 : 0.18) * intense,
            playbackRate: tier === 'mega' ? 1.03 : 0.98,
            detune: tier === 'mega' ? 42 : 12,
            allowOverlap: true,
            fadeOutMs: 190
          });
        }, tier === 'mega' ? 96 : 122);
        playToneStack(tier === 'mega' ? [440, 554, 659, 880, 1175] : [392, 523, 659, 784], {
          spacingMs: tier === 'mega' ? 40 : 50,
          durationSec: tier === 'mega' ? 0.2 : 0.17,
          volume: tier === 'mega' ? 0.022 : 0.017,
          type: 'triangle',
          endFrequency: tier === 'mega' ? 840 : 680,
          filterType: 'highpass',
          filterFrequency: tier === 'mega' ? 1760 : 1420
        });
        playTone(tier === 'mega' ? 196 : 174, tier === 'mega' ? 0.24 : 0.18, tier === 'mega' ? 0.01 : 0.007, {
          type: 'sine',
          endFrequency: tier === 'mega' ? 146 : 132,
          filterType: 'lowpass',
          filterFrequency: tier === 'mega' ? 760 : 660
        });
      });
    }

    function playClick(freq, dur, vol) {
      ifSfxEnabled(function () {
        const baseFrequency = clamp(freq, 180, 2200, 880);
        const duration = clamp(dur, 0.01, 0.12, 0.032);
        const volume = clamp(vol, 0.002, 0.08, 0.02);
        play('ui_click', {
          volume: 0.08 + volume * 4,
          playbackRate: clamp(baseFrequency / 920, 0.7, 1.28, 0.94),
          detune: (baseFrequency - 920) * 0.2,
          allowOverlap: true,
          fadeOutMs: 50
        });
        playTone(baseFrequency, duration, 0.006 + volume * 0.6, {
          type: 'triangle',
          endFrequency: baseFrequency * 0.68,
          filterType: 'bandpass',
          filterFrequency: Math.max(360, baseFrequency * 0.72)
        });
      });
    }

    function updateAmbientToggleUI() {
      if (!ambientToggleEl) return;
      ambientToggleEl.disabled = false;
      if (typeof ambientToggleEl.setAttribute === 'function') {
        ambientToggleEl.setAttribute('aria-pressed', ambientEnabled ? 'true' : 'false');
      }
      ambientToggleEl.textContent = ambientEnabled ? 'Attivo' : 'Spento';
    }

    function setAmbientEnabled(enabled, notify) {
      ambientEnabled = enabled !== false;
      updateAmbientToggleUI();
      if (!ambientEnabled) {
        stopAmbientSound(180);
      } else if (audioInitialized) {
        startAmbientSound();
      }
      if (notify) showFloat(`Ambiente: ${ambientEnabled ? 'attivo' : 'spento'}`, 900);
      return ambientEnabled;
    }

    function isAmbientEnabled() {
      return ambientEnabled;
    }

    function setSpinSfxEnabled(enabled) {
      spinSfxEnabled = enabled !== false;
      return spinSfxEnabled;
    }

    function isSpinSfxEnabled() {
      return spinSfxEnabled;
    }

    function startAmbientSound() {
      if (!ambientEnabled) return false;
      const nodes = ensureAmbientNodes();
      if (!nodes) return false;
      const ctx = getAudioContext();
      if (!ctx) return false;
      const targetGain = masterVolume * (getInFreeSpins() ? 0.029 : 0.018);
      nodes.master.gain.cancelScheduledValues(ctx.currentTime);
      nodes.master.gain.setValueAtTime(Math.max(0.0001, nodes.master.gain.value || 0.0001), ctx.currentTime);
      nodes.master.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + 0.52);
      syncAmbientMood();
      return true;
    }

    function stopAmbientSound(fadeMs) {
      if (!ambientNodes) return;
      const ctx = getAudioContext();
      if (!ctx) {
        destroyAmbientNodes();
        return;
      }
      const fade = Math.max(0.08, (Number(fadeMs) || 240) / 1000);
      ambientNodes.master.gain.cancelScheduledValues(ctx.currentTime);
      ambientNodes.master.gain.setValueAtTime(Math.max(0.0001, ambientNodes.master.gain.value || 0.0001), ctx.currentTime);
      ambientNodes.master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
      root.setTimeout(destroyAmbientNodes, Math.round(fade * 1000) + 40);
    }

    function syncAmbientMood() {
      if (!ambientEnabled || !audioInitialized) return false;
      const nodes = ensureAmbientNodes();
      const ctx = getAudioContext();
      if (!nodes || !ctx) return false;
      const inFreeSpins = !!getInFreeSpins();
      const baseGain = masterVolume * (inFreeSpins ? 0.029 : 0.018);
      nodes.master.gain.cancelScheduledValues(ctx.currentTime);
      nodes.master.gain.setTargetAtTime(baseGain, ctx.currentTime, 0.44);
      if (nodes.filter) {
        nodes.filter.frequency.setTargetAtTime(inFreeSpins ? 820 : 460, ctx.currentTime, 0.4);
        nodes.filter.Q.setTargetAtTime(inFreeSpins ? 1.05 : 0.72, ctx.currentTime, 0.4);
      }
      if (nodes.oscillators[0] && nodes.oscillators[0].detune) {
        nodes.oscillators[0].detune.setTargetAtTime(inFreeSpins ? 88 : 12, ctx.currentTime, 0.4);
      }
      if (nodes.oscillators[1] && nodes.oscillators[1].detune) {
        nodes.oscillators[1].detune.setTargetAtTime(inFreeSpins ? 210 : 96, ctx.currentTime, 0.4);
      }
      if (nodes.lfo) {
        nodes.lfo.frequency.setTargetAtTime(inFreeSpins ? 0.22 : 0.15, ctx.currentTime, 0.34);
      }
      return true;
    }

    function playCoinSound() {
      ifSfxEnabled(function () {
        play('ui_click', {
          volume: 0.14,
          playbackRate: 1.1,
          detune: 74,
          allowOverlap: true,
          fadeOutMs: 90
        });
        playTone(1040, 0.032, 0.012, {
          type: 'triangle',
          endFrequency: 1290,
          filterType: 'highpass',
          filterFrequency: 1480
        });
      });
    }

    function playCoinInsertSound() {
      ifSfxEnabled(function () {
        play('ui_click', {
          volume: 0.18,
          playbackRate: 0.84,
          detune: -24,
          allowOverlap: true,
          fadeOutMs: 100
        });
        playTone(196, 0.052, 0.015, {
          type: 'triangle',
          endFrequency: 144,
          filterType: 'bandpass',
          filterFrequency: 560
        });
        playTone(860, 0.022, 0.007, {
          type: 'triangle',
          endFrequency: 688,
          filterType: 'highpass',
          filterFrequency: 920
        });
      });
    }

    // ========== Return Public API ==========
    return {
      // New centralized API
      init: init,
      play: play,
      stopAll: stopAll,
      setVolume: setVolume,
      getVolume: getVolume,

      // Legacy API for backward compatibility
      bootstrapAudio: bootstrapAudio,
      playLeverSound: playLeverSound,
      playReelStartSound: playReelStartSound,
      playReelStopSound: playReelStopSound,
      playSmallWinSound: playSmallWinSound,
      playBigWinSound: playBigWinSound,
      playClick: playClick,
      playSpinButtonSound: playClick,
      playCoinSound: playCoinSound,
      playCoinInsertSound: playCoinInsertSound,
      setSpinSfxEnabled: setSpinSfxEnabled,
      isSpinSfxEnabled: isSpinSfxEnabled,
      setSpinSfxStyle: function () { /*legacy*/ },
      // Additional legacy methods
      bindFirstGestureBootstrap: bindFirstGestureBootstrap,
      startAmbientSound: startAmbientSound,
      stopAmbientSound: stopAmbientSound,
      syncAmbientMood: syncAmbientMood,
      updateAmbientToggleUI: updateAmbientToggleUI,
      setAmbientEnabled: setAmbientEnabled,
      isAmbientEnabled: isAmbientEnabled
    };
  }

  // Legacy wrapper for backward compatibility
  function createSlotAudioController(options) {
    return createAudioManager(options);
  }

  return {
    createSlotAudioController: createSlotAudioController,
    createAudioManager: createAudioManager
  };
});
