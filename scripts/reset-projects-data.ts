import * as fs from 'node:fs';
import * as path from 'node:path';
import { query, isPgAvailable, createLogger, closePool } from '@chronoviet/infra';

const log = createLogger({ service: 'ops', correlationId: 'reset-projects-data' });
const ROOT_DIR = process.cwd();

async function cleanDirectories() {
  const dirsToClean = [
    path.join(ROOT_DIR, 'apps/web/media/projects'),
    path.join(ROOT_DIR, 'apps/web/media/audio-cache'),
    path.join(ROOT_DIR, 'apps/render-worker/media/projects'),
    path.join(ROOT_DIR, 'packages/agent-orchestrator/media/projects'),
    path.join(ROOT_DIR, 'packages/agent-orchestrator/media/audio-cache'),
    path.join(ROOT_DIR, 'packages/vlm-inspector/media/projects'),
    path.join(ROOT_DIR, 'media/rendered-videos'),
    path.join(ROOT_DIR, 'media/audio-cache'),
  ];

  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        if (item === '.gitkeep') continue;
        const itemPath = path.join(dir, item);
        fs.rmSync(itemPath, { recursive: true, force: true });
      }
      console.log(`🧹 Cleaned directory: ${path.relative(ROOT_DIR, dir)}`);
    }
  }
}

async function cleanDatabase() {
  const pgUp = await isPgAvailable();
  if (!pgUp) {
    console.log('⚠️ PostgreSQL is not connected. Skipped database record cleanup.');
    return;
  }

  try {
    await query('DELETE FROM conversation_messages;');
    await query('DELETE FROM video_briefs;');
    await query('DELETE FROM conversations;');
    await query('DELETE FROM orchestrator_checkpoints;');

    console.log('✅ PostgreSQL Cleaned:');
    console.log('  - Deleted all conversation_messages');
    console.log('  - Deleted all video_briefs');
    console.log('  - Deleted all conversations');
    console.log('  - Deleted all orchestrator_checkpoints');
  } catch (err: any) {
    console.error('❌ Error cleaning database tables:', err.message);
  }
}

async function main() {
  console.log('\n==================================================');
  console.log('🚀 ChronoViet — Reset Projects & Chat History');
  console.log('==================================================\n');

  await cleanDatabase();
  await cleanDirectories();
  await closePool();

  console.log('\n✨ Reset completed! Workspaces and history are now clean.\n');
}

main().catch((err) => {
  console.error('Fatal reset error:', err);
  process.exit(1);
});
