const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public/assets');
fs.mkdirSync(publicDir, { recursive: true });

// Function to generate a simple WAV file with audio tone for testing
function generateWav(filename, durationSec = 15, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // Format chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);  // PCM
  buffer.writeUInt16LE(1, 22);  // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);

  // Data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleVal = Math.sin(2 * Math.PI * 220 * t) * 0.1 * Math.exp(-t / 15);
    const intVal = Math.floor(sampleVal * 32767);
    buffer.writeInt16LE(intVal, 44 + i * 2);
  }

  fs.writeFileSync(filename, buffer);
  console.log(`Verified audio asset: ${path.basename(filename)}`);
}

const voiceoverPath = path.join(publicDir, 'voiceover.wav');
const bgmPath = path.join(publicDir, 'bgm.wav');

if (!fs.existsSync(voiceoverPath) || fs.statSync(voiceoverPath).size < 10000000) {
  generateWav(voiceoverPath, 360);
}
if (!fs.existsSync(bgmPath) || fs.statSync(bgmPath).size < 10000000) {
  generateWav(bgmPath, 360);
}

console.log('✅ Setup assets completed successfully.');
