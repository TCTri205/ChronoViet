/**
 * LangGraph.js Native Checkpointer for ChronoViet Orchestrator
 * Inherits MemorySaver with automatic persistence to PostgreSQL & Workspace Disk
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { MemorySaver } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { createLogger, getDatabaseClient, initProjectWorkspace } from '@chronoviet/infra';
import { ChronoGraphState } from './state.js';

const log = createLogger({ service: 'agent-orchestrator' });

export class ChronoCheckpointer extends MemorySaver {
  override async put(
    config: RunnableConfig,
    checkpoint: any,
    metadata: any
  ): Promise<RunnableConfig> {
    const savedConfig = await super.put(config, checkpoint, metadata);
    const threadId = (config.configurable?.thread_id || config.configurable?.projectId) as string | undefined;

    if (threadId && checkpoint?.channel_values) {
      const stateData = checkpoint.channel_values as ChronoGraphState;
      await this.persistToDiskAndPostgres(threadId, stateData);
    }

    return savedConfig;
  }

  private async persistToDiskAndPostgres(projectId: string, state: ChronoGraphState): Promise<void> {
    // 1. Persist to project workspace disk asynchronously
    try {
      const paths = initProjectWorkspace(projectId);
      const checkpointFile = path.join(paths.rootDir, 'checkpoint_state.json');
      await fsPromises.writeFile(checkpointFile, JSON.stringify(state, null, 2), 'utf-8');
      log.debug('checkpointer.disk_saved', `Saved checkpoint state to disk for ${projectId}`, { projectId });
    } catch (err: any) {
      log.warn('checkpointer.disk_save_skipped', `Disk checkpoint write skipped or failed: ${err.message}`, {
        projectId,
        error: err.message,
      });
    }

    // 2. Persist to PostgreSQL if pool is available
    try {
      const pool = getDatabaseClient();
      if (pool) {
        await pool.query(
          `INSERT INTO orchestrator_checkpoints (project_id, current_step, status, state_data, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (project_id)
           DO UPDATE SET current_step = EXCLUDED.current_step,
                         status = EXCLUDED.status,
                         state_data = EXCLUDED.state_data,
                         updated_at = NOW()`,
          [projectId, state.currentStep || 1, state.status || 'INIT', JSON.stringify(state)]
        );
        log.debug('checkpointer.postgres_saved', `Saved checkpoint to PostgreSQL for project ${projectId}`, { projectId });
      }
    } catch (dbErr: any) {
      // Postgres table may not exist yet or local offline mode
      log.debug('checkpointer.postgres_save_failed', `Postgres checkpoint save failed: ${dbErr.message}`, {
        projectId,
        error: dbErr.message,
      });
    }
  }

  /**
   * Directly load latest saved project state from Disk or Postgres
   */
  async loadLatestProjectState(projectId: string): Promise<ChronoGraphState | null> {
    // 1. Try disk workspace
    try {
      const paths = initProjectWorkspace(projectId);
      const checkpointFile = path.join(paths.rootDir, 'checkpoint_state.json');
      if (fs.existsSync(checkpointFile)) {
        const raw = await fsPromises.readFile(checkpointFile, 'utf-8');
        return JSON.parse(raw) as ChronoGraphState;
      }
    } catch (diskErr: any) {
      log.warn('checkpointer.disk_load_failed', `Failed reading disk checkpoint for ${projectId}: ${diskErr.message}`, {
        projectId,
        error: diskErr.message,
      });
    }

    // 2. Try PostgreSQL
    try {
      const pool = getDatabaseClient();
      if (pool) {
        const res = await pool.query(
          `SELECT state_data FROM orchestrator_checkpoints WHERE project_id = $1 LIMIT 1`,
          [projectId]
        );
        if (res.rows.length > 0) {
          return res.rows[0].state_data as ChronoGraphState;
        }
      }
    } catch (pgErr: any) {
      log.debug('checkpointer.postgres_load_failed', `PostgreSQL checkpoint query failed for ${projectId}: ${pgErr.message}`, {
        projectId,
        error: pgErr.message,
      });
    }

    return null;
  }
}

export const defaultCheckpointer = new ChronoCheckpointer();
