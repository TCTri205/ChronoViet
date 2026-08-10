#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ChronoVideoSchema } from '@chronoviet/shared-spec';

export interface CLIArgs {
  command: 'render' | 'still' | 'eval' | 'inspect' | 'help';
  input?: string;
  output?: string;
  outDir?: string;
  composition?: string;
  frame?: number;
  overwrite?: boolean;
  verbose?: boolean;
}

export function parseArgs(args: string[]): CLIArgs {
  const result: CLIArgs = {
    command: 'render',
    composition: 'ChronoVideo',
    frame: 45,
    overwrite: true,
    verbose: false,
  };

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === 'render' || arg === 'still' || arg === 'eval' || arg === 'inspect' || arg === 'help') {
      result.command = arg;
    } else if (arg === '-i' || arg === '--input') {
      result.input = args[++i];
    } else if (arg === '-o' || arg === '--output') {
      result.output = args[++i];
    } else if (arg === '-d' || arg === '--outDir') {
      result.outDir = args[++i];
    } else if (arg === '-c' || arg === '--composition') {
      result.composition = args[++i];
    } else if (arg === '-f' || arg === '--frame') {
      result.frame = parseInt(args[++i], 10);
    } else if (arg === '--no-overwrite') {
      result.overwrite = false;
    } else if (arg === '-v' || arg === '--verbose') {
      result.verbose = true;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0 && !result.input && result.command !== 'eval' && result.command !== 'help') {
    result.input = positional[0];
  }

  return result;
}

export function runCLI() {
  const rawArgs = process.argv.slice(2);
  const options = parseArgs(rawArgs);

  if (options.command === 'help' || rawArgs.includes('--help')) {
    console.log(`
ChronoViet Remotion Video Render Engine CLI

Usage:
  pnpm cli render -i <input.json> [-o <output.mp4>] [-c <composition>]
  pnpm cli still -i <input.json> [-o <output.png>] [-f <frame_number>]
  pnpm cli inspect -i <input.json>
  pnpm cli eval [-d <outDir>] [-t <testCasesDir>]

Options:
  -i, --input <path>         Path to input JSON script file
  -o, --output <path>        Path to output video/image file
  -d, --outDir <path>        Directory path for output files (default: ./out)
  -c, --composition <id>     Remotion composition ID (default: ChronoVideo)
  -f, --frame <number>       Frame index for still render (default: 45)
  --no-overwrite             Do not overwrite existing output file
  -v, --verbose              Print detailed render logs
  --help                     Show this help message
`);
    return;
  }

  const packageRoot = path.resolve(__dirname, '..');
  const entryFile = path.join(packageRoot, 'src', 'index.ts');

  if (options.command === 'eval') {
    console.log('🚀 Running Remotion Engine Evaluation Suite...');
    const runnerPath = path.join(packageRoot, 'eval', 'runner.ts');
    execSync(`npx tsx "${runnerPath}" ${rawArgs.join(' ')}`, {
      stdio: 'inherit',
      cwd: packageRoot,
    });
    return;
  }

  if (!options.input) {
    console.error('❌ Error: Input script JSON file (-i, --input) is required.');
    process.exit(1);
  }

  const absoluteInputPath = path.resolve(process.cwd(), options.input);

  if (!fs.existsSync(absoluteInputPath)) {
    console.error(`❌ Error: Input file not found at [${absoluteInputPath}]`);
    process.exit(1);
  }

  // Validate JSON schema
  console.log(`🔍 Validating JSON script: [${absoluteInputPath}]...`);
  const rawContent = fs.readFileSync(absoluteInputPath, 'utf-8');
  let jsonContent: unknown;
  try {
    jsonContent = JSON.parse(rawContent);
  } catch (e: any) {
    console.error(`❌ Invalid JSON format in file [${absoluteInputPath}]:`, e.message);
    process.exit(1);
  }

  const parseResult = ChronoVideoSchema.safeParse(jsonContent);
  if (!parseResult.success) {
    console.error(`❌ Schema Validation Failed for [${absoluteInputPath}]:`);
    parseResult.error.issues.forEach((err: any) => {
      console.error(`   - [${err.path.join('.')}]: ${err.message}`);
    });
    process.exit(1);
  }
  console.log('✅ JSON Schema Validation Passed.');

  if (options.command === 'inspect') {
    console.log('ℹ️ Script inspection complete. Schema is 100% valid for Remotion Engine.');
    return;
  }

  // Determine output path
  const targetDir = options.outDir ? path.resolve(process.cwd(), options.outDir) : path.join(packageRoot, 'out');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const defaultExt = options.command === 'still' ? '.png' : '.mp4';
  const inputBaseName = path.basename(absoluteInputPath, path.extname(absoluteInputPath));
  const outputPath = options.output
    ? path.resolve(process.cwd(), options.output)
    : path.join(targetDir, `${inputBaseName}${defaultExt}`);

  const compId = options.composition || 'ChronoVideo';
  const overwriteFlag = options.overwrite !== false ? '--overwrite' : '';

  if (options.command === 'still') {
    const frame = options.frame ?? 45;
    console.log(`⚡ Rendering STILL image [frame ${frame}] for composition [${compId}]...`);
    console.log(`📄 Output: ${outputPath}`);

    const cmd = `npx remotion still "${entryFile}" ${compId} "${outputPath}" --props="${absoluteInputPath}" --frame=${frame} ${overwriteFlag}`;
    try {
      execSync(cmd, { cwd: packageRoot, stdio: 'inherit' });
      console.log(`✅ Still frame successfully rendered to: ${outputPath}`);
    } catch (err: any) {
      console.error(`❌ Failed to render still frame:`, err.message);
      process.exit(1);
    }
  } else {
    console.log(`🎬 Rendering FULL VIDEO for composition [${compId}]...`);
    console.log(`📄 Output: ${outputPath}`);

    const cmd = `npx remotion render "${entryFile}" ${compId} "${outputPath}" --props="${absoluteInputPath}" ${overwriteFlag}`;
    try {
      execSync(cmd, { cwd: packageRoot, stdio: 'inherit' });
      console.log(`✅ Video successfully rendered to: ${outputPath}`);
    } catch (err: any) {
      console.error(`❌ Failed to render video:`, err.message);
      process.exit(1);
    }
  }
}

if (require.main === module) {
  runCLI();
}
