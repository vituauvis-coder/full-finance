import { query } from '../db.js';

let ready = false;

export async function ensureCofrinhoBucketGoalDeadlineColumn() {
    if (ready) return;
    await query(`
        ALTER TABLE cofrinho_bucket_goals
            ADD COLUMN IF NOT EXISTS target_deadline DATE
    `);
    ready = true;
}