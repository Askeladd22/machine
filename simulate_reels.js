const { simulateSpins } = require('./scripts/book_math');

const args = process.argv.slice(2);
let spins = 100000;
let seedHex = null;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--spins' && args[i + 1]) {
    spins = Number(args[i + 1]);
    i += 1;
  } else if (args[i] === '--seed' && args[i + 1]) {
    seedHex = args[i + 1];
    i += 1;
  }
}

if (!Number.isFinite(spins) || spins <= 0) spins = 100000;

const result = simulateSpins({ spins, seedHex, bet: 1 });
console.log(`spins=${result.paidSpins} seed=${seedHex || '(random)'} totalBet=${result.totalBet.toFixed(2)} totalPayout=${result.totalPayout.toFixed(2)} RTP=${(result.rtp * 100).toFixed(4)}% hitRate=${(result.baseHitRate * 100).toFixed(4)}% bonusRate=${(result.bonusRate * 100).toFixed(4)}% freeSpinRounds=${result.freeSpinRounds}`);
