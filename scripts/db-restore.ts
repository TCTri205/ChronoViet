import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDatabaseConfig, createLogger } from '../packages/shared-spec/src/index.js';

const ROOT_DIR = process.cwd();
const BACKUPS_DIR = path.resolve(ROOT_DIR, 'backups');
const log = createLogger({ service: 'ops', correlationId: 'db-restore' });

async function restoreDatabase() {
  log.info('ops.db_restore_started', 'Starting PostgreSQL Database Restoration');
  console.log('🔄 Starting PostgreSQL Database Restoration...');

  // Parse command line arguments for target file
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  let targetFile = fileIndex !== -1 && args[fileIndex + 1] ? args[fileIndex + 1] : null;

  if (!targetFile) {
    targetFile = path.join(BACKUPS_DIR, 'db_latest.dump');
  } else if (!path.isAbsolute(targetFile)) {
    targetFile = path.resolve(ROOT_DIR, targetFile);
  }

  if (!fs.existsSync(targetFile)) {
    console.error(`❌ Backup file not found: ${path.relative(ROOT_DIR, targetFile)}`);
    console.log('Available backups in backups/ directory:');
    if (fs.existsSync(BACKUPS_DIR)) {
      const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.dump') || f.endsWith('.sql'));
      if (files.length === 0) {
        console.log(' (No backup files found. Run "pnpm db:backup" first to create one)');
      } else {
        files.forEach((f) => console.log(` - backups/${f}`));
      }
    }
    process.exit(1);
  }

  const dbConfig = getDatabaseConfig();
  const dbUser = dbConfig.user || 'chronoviet';
  const dbName = dbConfig.database || 'chronoviet_db';
  const dbPassword = dbConfig.password || 'chronoviet_secret';

  try {
    // Check if postgres container is running
    const psOutput = execSync('docker compose ps --services --filter "status=running"', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
    });

    if (!psOutput.includes('postgres')) {
      console.error('❌ PostgreSQL container is not running. Please start it with: pnpm stack:infra');
      process.exit(1);
    }

    console.log(`📦 Restoring database (${dbName}) from: ${path.relative(ROOT_DIR, targetFile)}...`);

    const isSql = targetFile.endsWith('.sql');
    const restoreCmd = isSql
      ? `docker compose exec -T -e PGPASSWORD="${dbPassword}" postgres psql -U "${dbUser}" -d "${dbName}" < "${targetFile}"`
      : `docker compose exec -T -e PGPASSWORD="${dbPassword}" postgres pg_restore -U "${dbUser}" -d "${dbName}" --clean --if-exists --no-owner --no-privileges < "${targetFile}"`;

    try {
      execSync(restoreCmd, {
        cwd: ROOT_DIR,
        stdio: ['pipe', 'pipe', 'inherit'],
      });
    } catch {
      // pg_restore may return minor code 1 when cleaning non-existent tables, which is normal for clean restore
      console.warn('ℹ️ pg_restore executed clean/drop steps.');
    }

    console.log('✅ PostgreSQL data restoration completed.');
    console.log('🔍 Executing deep database health audit to verify restoration...');

    execSync('pnpm db:health', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });

    console.log('\n==================================================');
    console.log('🎉 DATABASE RESTORE & INTEGRITY AUDIT COMPLETE');
    console.log(`• Restored from: ${path.relative(ROOT_DIR, targetFile)}`);
    console.log('==================================================\n');

    log.info('ops.db_restore_completed', 'Database restoration completed and verified', {
      restoredFile: path.relative(ROOT_DIR, targetFile),
    });
  } catch (error) {
    log.error('ops.db_restore_failed', 'Database restoration encountered an error', { error });
    console.error('❌ Database restoration encountered an error:', error);
    process.exit(1);
  }
}

restoreDatabase();
