#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ChronoVideoSchema, createLogger } from '@chronoviet/shared-spec';

let log = createLogger({ service: 'remotion-engine' });

export interface CLIArgs {
  command: 'render' | 'still' | 'eval' | 'inspect' | 'help';
  input?: string;
  output?: string;
  outDir?: string;
  composition?: string;
  frame?: number;
  overwrite?: boolean;
  verbose?: boolean;
  correlationId?: string;
  projectId?: string;
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
    } else if (arg === '-k' || arg === '--correlation-id') {
      result.correlationId = args[++i];
    } else if (arg === '-p' || arg === '--project-id') {
      result.projectId = args[++i];
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

  if (options.correlationId || options.projectId) {
    log = createLogger({
      service: 'remotion-engine',
      correlationId: options.correlationId,
      baseFields: options.projectId ? { projectId: options.projectId } : undefined,
    });
  }

  if (options.command === 'help' || rawArgs.includes('--help')) {
    console.log(`
ChronoViet Remotion Video Render Engine CLI

Usage:
  pnpm cli render -i <input.json> [-o <output.mp4>] [-c <composition>]
  pnpm cli still -i <input.json> [-o <output.png>] [-f <frame_number>]
  pnpm cli inspect -i <input.json>
  pnpm cli eval [-d <outDir>] [-t <testCasesDir>]

Options:
  -i, --input <path>           Path to input JSON script file
  -o, --output <path>          Path to output video/image file
  -d, --outDir <path>          Directory path for output files (default: ./out)
  -c, --composition <id>       Remotion composition ID (default: ChronoVideo)
  -f, --frame <number>         Frame index for still render (default: 45)
  -k, --correlation-id <id>    Correlation identifier for distributed logging
  -p, --project-id <id>        Project identifier for tracing context
  --no-overwrite               Do not overwrite existing output file
  -v, --verbose                Print detailed render logs
  --help                       Show this help message
`);
    return;
  }

  const packageRoot = path.resolve(__dirname, '..');
  const entryFile = path.join(packageRoot, 'src', 'index.ts');

  if (options.command === 'eval') {
    log.info('render.eval_started', 'Running Remotion Engine Evaluation Suite');
    const runnerPath = path.join(packageRoot, 'eval', 'runner.ts');
    execSync(`npx tsx "${runnerPath}" ${rawArgs.join(' ')}`, {
      stdio: 'inherit',
      cwd: packageRoot,
    });
    return;
  }

  if (!options.input) {
    log.error('render.input_required', 'Input script JSON file (-i, --input) is required');
    process.exit(1);
  }

  const absoluteInputPath = path.resolve(process.cwd(), options.input);

  if (!fs.existsSync(absoluteInputPath)) {
    log.error('render.input_not_found', 'Input file not found', { inputPath: absoluteInputPath });
    process.exit(1);
  }

  // Validate JSON schema
  log.info('render.schema_validating', 'Validating JSON script', { inputPath: absoluteInputPath });
  const rawContent = fs.readFileSync(absoluteInputPath, 'utf-8');
  let jsonContent: unknown;
  try {
    jsonContent = JSON.parse(rawContent);
  } catch (e: any) {
    log.error('render.json_invalid', 'Invalid JSON format in file', {
      inputPath: absoluteInputPath,
      error: e instanceof Error ? e.message : String(e),
    });
    process.exit(1);
  }

  const parseResult = ChronoVideoSchema.safeParse(jsonContent);
  if (!parseResult.success) {
    log.error('render.schema_invalid', 'Schema validation failed', {
      inputPath: absoluteInputPath,
      issues: parseResult.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    process.exit(1);
  }
  log.info('render.schema_valid', 'JSON schema validation passed', { inputPath: absoluteInputPath });

  if (options.command === 'inspect') {
    log.info('render.inspect_complete', 'Script inspection complete; schema is 100% valid for Remotion Engine');
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
    log.info('render.still_started', 'Rendering still frame', {
      frame,
      composition: compId,
      outputPath,
      inputPath: absoluteInputPath,
    });

    const cmd = `npx remotion still "${entryFile}" ${compId} "${outputPath}" --props="${absoluteInputPath}" --frame=${frame} ${overwriteFlag}`;
    try {
      execSync(cmd, { cwd: packageRoot, stdio: 'inherit' });
      log.info('render.still_completed', 'Still frame successfully rendered', { outputPath });
    } catch (err: any) {
      log.error('render.still_failed', 'Failed to render still frame', {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  } else {
    log.info('render.video_started', 'Rendering full video', {
      composition: compId,
      outputPath,
      inputPath: absoluteInputPath,
    });

    const cmd = `npx remotion render "${entryFile}" ${compId} "${outputPath}" --props="${absoluteInputPath}" ${overwriteFlag}`;
    try {
      execSync(cmd, { cwd: packageRoot, stdio: 'inherit' });
      log.info('render.video_completed', 'Video successfully rendered', { outputPath });
    } catch (err: any) {
      log.error('render.video_failed', 'Failed to render video', {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  }
}

if (require.main === module) {
  runCLI();
}
