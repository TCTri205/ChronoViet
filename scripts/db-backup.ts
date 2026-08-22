import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDatabaseConfig, createLogger } from '../packages/shared-spec/src/index.js';

const ROOT_DIR = process.cwd();
const BACKUPS_DIR = path.resolve(ROOT_DIR, 'backups');
const log = createLogger({ service: 'ops', correlationId: 'db-backup' });

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

async function backupDatabase() {
  log.info('ops.db_backup_started', 'Starting PostgreSQL Database Backup');

  // Ensure backups directory exists
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  // Parse command line arguments
  const args = process.argv.slice(2);
  const nameIndex = args.indexOf('--name');
  const customName = nameIndex !== -1 && args[nameIndex + 1] ? args[nameIndex + 1] : null;

  const dbConfig = getDatabaseConfig();
  const dbUser = dbConfig.user || 'chronoviet';
  const dbName = dbConfig.database || 'chronoviet_db';
  const dbPassword = dbConfig.password || 'chronoviet_secret';

  const timestamp = getTimestamp();
  const filename = customName ? `${customName}.dump` : `db_backup_${timestamp}.dump`;
  const targetFile = path.join(BACKUPS_DIR, filename);
  const latestFile = path.join(BACKUPS_DIR, 'db_latest.dump');

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

    console.log(`📦 Dumping PostgreSQL database (${dbName}) to: ${path.relative(ROOT_DIR, targetFile)}...`);

    // Execute pg_dump inside postgres container and write output to host file
    const dumpCmd = `docker compose exec -T -e PGPASSWORD="${dbPassword}" postgres pg_dump -U "${dbUser}" -d "${dbName}" -Fc > "${targetFile}"`;
    execSync(dumpCmd, {
      cwd: ROOT_DIR,
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    if (!fs.existsSync(targetFile) || fs.statSync(targetFile).size === 0) {
      console.error('❌ Backup failed: generated file is empty or missing.');
      if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile);
      process.exit(1);
    }

    // Copy to db_latest.dump for convenient restoration
    fs.copyFileSync(targetFile, latestFile);

    const stats = fs.statSync(targetFile);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('\n==================================================');
    console.log('✅ DATABASE BACKUP SUCCESSFUL');
    console.log(`• Snapshot file: backups/${filename}`);
    console.log(`• Latest link:   backups/db_latest.dump`);
    console.log(`• Size:          ${sizeMb} MB (${stats.size} bytes)`);
    console.log('==================================================\n');

    log.info('ops.db_backup_completed', 'DB backup completed successfully', {
      file: `backups/${filename}`,
      sizeBytes: stats.size,
      sizeMb,
    });
  } catch (error) {
    log.error('ops.db_backup_failed', 'Database backup encountered an error', { error });
    console.error('❌ Database backup encountered an error:', error);
    process.exit(1);
  }
}

backupDatabase();
