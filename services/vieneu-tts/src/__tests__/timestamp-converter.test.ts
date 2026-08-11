import { convertVieNeuTimestampsToCaptions, calculateSceneDurationInFrames } from '../timestamp-converter.js';
import { WordTimestamp } from '@chronoviet/shared-spec';

function runTests() {
  console.log('--- Testing timestamp-converter ---');

  // Test Case 1: calculateSceneDurationInFrames
  // 7400ms audio + 300ms padding = 7700ms => 7.7s * 30fps = 231 frames
  const durationInFrames = calculateSceneDurationInFrames(7400, 300, 30);
  if (durationInFrames !== 231) {
    throw new Error(`Test 1 Failed: Expected 231, got ${durationInFrames}`);
  }
  console.log('✅ Test 1 Passed: calculateSceneDurationInFrames (7400ms + 300ms) = 231 frames');

  // Test Case 2: convertVieNeuTimestampsToCaptions
  const mockTimestamps: WordTimestamp[] = [
    { word: 'Đêm', startMs: 0, endMs: 350 },
    { word: 'mùng', startMs: 360, endMs: 620 },
    { word: '4', startMs: 630, endMs: 950 },
    { word: 'Tết', startMs: 960, endMs: 1250 },
  ];

  const captions = convertVieNeuTimestampsToCaptions(mockTimestamps, 30);
  if (captions.length !== 4) {
    throw new Error(`Test 2 Failed: Expected 4 captions, got ${captions.length}`);
  }

  if (captions[0].startFrame !== 0 || captions[0].endFrame !== 11) {
    throw new Error(`Test 2 Failed for 'Đêm': Expected [0, 11], got [${captions[0].startFrame}, ${captions[0].endFrame}]`);
  }

  console.log('✅ Test 2 Passed: convertVieNeuTimestampsToCaptions frame alignment verified');
  console.log('All timestamp-converter tests PASSED!');
}

runTests();
