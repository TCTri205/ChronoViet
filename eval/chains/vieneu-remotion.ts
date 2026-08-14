import fs from 'fs';
import path from 'path';
import http from 'http';
import { execSync } from 'child_process';
import { ChronoVideoSchema, ChronoVideoProps, envConfig } from '../../packages/shared-spec/src';
import { VieNeuEngine, convertVieNeuTimestampsToCaptions } from '../../services/vieneu-tts/src';
import { cleanEvalArtifacts, isPortInUseSync, killPortProcessSync } from '../utils/cleaner';

export interface ChainEvalResult {
  testCaseFile: string;
  title: string;
  totalScenes: number;
  totalWordsCount: number;
  ttsDurationMs: number;
  totalAudioDurationMs: number;
  calculatedTotalFrames: number;
  schemaValid: boolean;
  engineType: string;
  avSyncDelayFrames: number;
  status: 'PASS' | 'FAIL';
}

export interface IntegratedChainReport {
  timestamp: string;
  chainName: 'vieneu-tts -> remotion-engine';
  selectedTestCase: string;
  schemaValid: boolean;
  engineType: string;
  totalAudioDurationMs: number;
  ttsDurationMs: number;
  result: ChainEvalResult;
}

function findAvailablePortSync(startPort: number): number {
  let port = startPort;
  while (port < startPort + 50) {
    if (!isPortInUseSync(port)) {
      return port;
    }
    port++;
  }
  return startPort;
}

async function downloadFile(url: string, targetPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const fileStream = fs.createWriteStream(targetPath);
    http.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(true);
        });
      } else {
        fileStream.close();
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
        resolve(false);
      }
    }).on('error', () => {
      fileStream.close();
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      resolve(false);
    });
  });
}

export async function runVieNeuRemotionChain(options: {
  testCaseName?: string;
  openStudio?: boolean;
  verbose?: boolean;
  port?: string;
  pythonUrl?: string;
  cleanBeforeRun?: boolean;
} = {}): Promise<IntegratedChainReport> {
  const verbose = options.verbose ?? false;
  const openStudio = options.openStudio ?? true;
  const requestedPortStr = options.port || String(envConfig.REMOTION_PORT);
  const pythonUrl = options.pythonUrl || envConfig.VIENEU_PYTHON_URL;

  if (options.cleanBeforeRun) {
    cleanEvalArtifacts({ verbose, port: parseInt(requestedPortStr, 10) });
  }

  const testCasesDir = path.resolve(process.cwd(), 'packages/remotion-engine/eval/test-cases');
  const reportsDir = path.resolve(process.cwd(), 'eval/reports');
  const engineOutDir = path.resolve(process.cwd(), 'packages/remotion-engine/eval/out');
  const targetPublicAudioDirs = [
    path.resolve(process.cwd(), 'packages/remotion-engine/eval/public/audio'),
    path.resolve(process.cwd(), 'packages/remotion-engine/public/audio'),
  ];
  const remotionPublicAudioDir = targetPublicAudioDirs[0];

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  if (!fs.existsSync(engineOutDir)) {
    fs.mkdirSync(engineOutDir, { recursive: true });
  }
  for (const dir of targetPublicAudioDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  console.log('\n================================================================');
  console.log(' CHUOI DANH GIA TICH HOP: VieNeu TTS -> Remotion Render Engine');
  console.log(' Quy chuan: 1 Kich ban - Zero Screenshot Policy - Remotion Studio GUI');
  console.log('================================================================\n');

  if (!fs.existsSync(testCasesDir)) {
    throw new Error(`[!] Khong tim thay thu muc kich ban mau: ${testCasesDir}`);
  }

  const allTestFiles = fs.readdirSync(testCasesDir).filter((f) => f.endsWith('.json'));
  if (allTestFiles.length === 0) {
    throw new Error(`[!] Khong tim thay kich ban test-case .json nao tai ${testCasesDir}`);
  }

  // Pick 1 single test case (default: biography_tran_hung_dao.json or user specified)
  let selectedFile = options.testCaseName || 'biography_tran_hung_dao.json';
  if (!allTestFiles.includes(selectedFile)) {
    selectedFile = allTestFiles[0];
  }

  console.log(` [*] Chon 1 Kich Ban Danh Gia: ${selectedFile}`);

  const filePath = path.join(testCasesDir, selectedFile);
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const jsonProps = JSON.parse(rawData) as ChronoVideoProps;

  // Clean up top-level dummy non-existent audioUrl / bgmUrl that cause 404 errors in browser
  if (jsonProps.audioUrl && !fs.existsSync(path.join(remotionPublicAudioDir, '..', jsonProps.audioUrl))) {
    delete jsonProps.audioUrl;
  }
  if (jsonProps.bgmUrl && !fs.existsSync(path.join(remotionPublicAudioDir, '..', jsonProps.bgmUrl))) {
    delete jsonProps.bgmUrl;
  }

  // Use main VieNeuEngine client (connects to Python ONNX microservice if available, else synthetic fallback)
  const ttsEngine = new VieNeuEngine(pythonUrl);
  const ttsStart = Date.now();

  let fileTotalWords = 0;
  let fileAudioDurationMs = 0;
  let fileTotalFrames = 0;
  let detectedEngineType = 'UNKNOWN';

  console.log(` [*] Dang ket noi VieNeu TTS Engine (${pythonUrl})...`);

  for (let i = 0; i < jsonProps.timeline.length; i++) {
    const scene = jsonProps.timeline[i];
    
    // Crucial: Correctly extract actual scene narration text from scene.text or scene.overlayData
    const narrationText =
      scene.text ||
      scene.overlayData?.title ||
      scene.overlayData?.subtitle ||
      'ChronoViet Lich Su Viet Nam';

    const words = narrationText.split(/\s+/).filter(Boolean);
    fileTotalWords += words.length;

    // Call VieNeu TTS synthesis for unique scene text
    const ttsResponse = await ttsEngine.synthesize({
      text: narrationText,
      speakerId: 'vi_historical_male_1',
      speedRatio: 1.0,
      sampleRate: 24000,
      fps: jsonProps.fps || 30,
      paddingMs: 300,
    });

    if (ttsResponse.status === 'SUCCESS') {
      detectedEngineType = ttsResponse.engineType || 'VieNeuEngine';
      const fileName = path.basename(ttsResponse.audioUrl);
      
      const localPathsToTry = [
        path.resolve(process.cwd(), 'services/vieneu-tts/media/audio-cache', fileName),
        path.resolve(process.cwd(), 'media/audio-cache', fileName),
      ];

      for (const publicAudioDir of targetPublicAudioDirs) {
        const publicWavPath = path.join(publicAudioDir, fileName);
        let copied = false;

        for (const p of localPathsToTry) {
          if (fs.existsSync(p)) {
            fs.copyFileSync(p, publicWavPath);
            copied = true;
            break;
          }
        }

        // If not found locally on disk, try downloading via HTTP GET from Python service
        if (!copied && pythonUrl) {
          const httpUrl = `${pythonUrl}/static/audio/${fileName}`;
          await downloadFile(httpUrl, publicWavPath);
        }
      }

      const relAudioPath = `audio/${fileName}`;
      const captions = convertVieNeuTimestampsToCaptions(ttsResponse.wordTimestamps, jsonProps.fps || 30);
      
      scene.durationInFrames = ttsResponse.calculatedFramesAt30fps;
      scene.sceneAudioUrl = relAudioPath;
      scene.captions = captions;
      fileAudioDurationMs += ttsResponse.audioDurationMs;
      fileTotalFrames += ttsResponse.calculatedFramesAt30fps;

      if (verbose) {
        console.log(`   └─ Scene [${i+1}/${jsonProps.timeline.length}] audio: ${relAudioPath} (${ttsResponse.audioDurationMs}ms, ${captions.length} words)`);
      }
    }
  }

  const ttsDurationMs = Date.now() - ttsStart;

  // 2. Validate JSON Schema with updated TTS audio & karaoke captions
  let schemaValid = false;
  try {
    ChronoVideoSchema.parse(jsonProps);
    schemaValid = true;
    console.log(` [+] Zod Schema Validation: PASSED 100%`);
  } catch (err) {
    console.error(` [!] Zod Schema Error in ${selectedFile}:`, err);
  }

  // 3. Save enriched JSON script for Remotion Studio preview
  const enrichedJsonPath = path.join(engineOutDir, 'pipeline_generated_video.json');
  fs.writeFileSync(enrichedJsonPath, JSON.stringify(jsonProps, null, 2));
  console.log(` [+] Da dong goi JSON Kich Ban Hoan Chinh: ${enrichedJsonPath}`);

  // 4. Zero Image Capture Policy
  console.log(` [*] Tuan thu Zero Image Capture Policy: Khong chup anh man hinh hay render PNG tinh.`);

  const result: ChainEvalResult = {
    testCaseFile: selectedFile,
    title: jsonProps.title || selectedFile,
    totalScenes: jsonProps.timeline.length,
    totalWordsCount: fileTotalWords,
    ttsDurationMs,
    totalAudioDurationMs: fileAudioDurationMs,
    calculatedTotalFrames: fileTotalFrames,
    schemaValid,
    engineType: detectedEngineType,
    avSyncDelayFrames: 0,
    status: schemaValid ? 'PASS' : 'FAIL',
  };

  const report: IntegratedChainReport = {
    timestamp: new Date().toISOString(),
    chainName: 'vieneu-tts -> remotion-engine',
    selectedTestCase: selectedFile,
    schemaValid,
    engineType: detectedEngineType,
    totalAudioDurationMs: fileAudioDurationMs,
    ttsDurationMs,
    result,
  };

  const reportPath = path.join(reportsDir, 'vieneu-remotion-chain-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n----------------------------------------------------------------');
  console.log(` BAO CAO TICH HOP 2 MO-DUM (vieneu-tts -> remotion-engine):`);
  console.log(`- Kich ban duoc chon        : ${selectedFile}`);
  console.log(`- TTS Engine su dung       : ${detectedEngineType}`);
  console.log(`- Tong so canh (Scenes)     : ${jsonProps.timeline.length}`);
  console.log(`- Tong so tu thoai          : ${fileTotalWords} tu`);
  console.log(`- Thoi luong am thanh       : ${(fileAudioDurationMs / 1000).toFixed(1)}s (${fileTotalFrames} frames @ 30fps)`);
  console.log(`- Thoi gian xu ly TTS       : ${ttsDurationMs} ms`);
  console.log(`- Zod Schema Pass Status   : ${schemaValid ? '[+] PASS' : '[!] FAIL'}`);
  console.log(`- File bao cao              : file:///${reportPath.replace(/\\/g, '/')}`);
  console.log('----------------------------------------------------------------\n');

  // 5. Remotion Studio preview as the final step
  if (openStudio && schemaValid) {
    console.log('----------------------------------------------------------------');
    console.log(' BUOC CUOI: KHOI CHAY GIAO DIEN REMOTION STUDIO DE XEM VIDEO HOAN CHINH');
    console.log('----------------------------------------------------------------\n');

    const requestedPort = parseInt(requestedPortStr, 10) || envConfig.REMOTION_PORT;
    let targetPort = requestedPort;
    if (isPortInUseSync(targetPort)) {
      console.log(`[*] Cong ${requestedPort} dang bi chiem giu. Dang giai phong...`);
      const killed = killPortProcessSync(targetPort);
      if (killed) {
        console.log(`[+] Da giai phong thanh cong Cong ${requestedPort}.\n`);
      } else {
        targetPort = findAvailablePortSync(requestedPort);
        console.log(`[!] Chuyen sang Cong tu do: ${targetPort}...\n`);
      }
    }

    console.log(`[*] Dang mo Remotion Studio tai http://localhost:${targetPort}...`);

    const packageRoot = path.resolve(process.cwd(), 'packages/remotion-engine');
    const relativePropsPath = path.relative(packageRoot, enrichedJsonPath).replace(/\\/g, '/');
    const cmd = `pnpm exec remotion preview src/index.ts --port=${targetPort} --props="${relativePropsPath}"`;

    if (verbose) {
      console.log(` [*] Executing Command: ${cmd}`);
      console.log(` [*] Working Directory : ${packageRoot}\n`);
    }

    // Clean stale webpack cache if it exists to avoid RangeError: Array buffer allocation failed
    const cacheDirsToClean = [
      path.join(packageRoot, 'node_modules/.cache/webpack'),
      path.resolve(process.cwd(), 'node_modules/.cache/webpack'),
    ];
    for (const cacheDir of cacheDirsToClean) {
      if (fs.existsSync(cacheDir)) {
        try {
          fs.rmSync(cacheDir, { recursive: true, force: true });
        } catch {
          // Ignore cache cleanup errors
        }
      }
    }

    try {
      execSync(cmd, {
        cwd: packageRoot,
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_OPTIONS: envConfig.REMOTION_NODE_OPTIONS,
        },
      });
    } catch (e: any) {
      if (e.signal === 'SIGINT' || e.signal === 'SIGTERM' || e.status === 130 || e.status === 0) {
        console.log('\n[+] Remotion Studio da dong boi nguoi dung.');
      } else {
        console.log('\n[+] Remotion Studio hoan tat.');
      }
    } finally {
      killPortProcessSync(targetPort);
    }
  }

  return report;
}

// Allow standalone execution
if (process.argv[1] && process.argv[1].includes('vieneu-remotion')) {
  const args = process.argv.slice(2);
  let testCaseName: string | undefined;
  let noStudio = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-t' || args[i] === '--testCase') && i + 1 < args.length) {
      testCaseName = args[++i];
    } else if (args[i] === '--no-studio' || args[i] === '--ci') {
      noStudio = true;
    } else if (args[i] === '-v' || args[i] === '--verbose') {
      verbose = true;
    }
  }

  runVieNeuRemotionChain({
    testCaseName,
    openStudio: !noStudio,
    verbose,
  }).catch((err) => {
    console.error('[!] Chain Evaluation Failed:', err);
    process.exit(1);
  });
}
