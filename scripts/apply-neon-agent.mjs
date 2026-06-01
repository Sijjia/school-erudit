// Применяет миграцию 20260601020000_agent_core к Neon через HTTP-драйвер (443).
// Запуск: DATABASE_URL="<pooled neon url>" node scripts/apply-neon-agent.mjs
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const MIGRATION = '20260601020000_agent_core';
const sqlText = readFileSync(`prisma/migrations/${MIGRATION}/migration.sql`, 'utf8');
const checksum = createHash('sha256').update(readFileSync(`prisma/migrations/${MIGRATION}/migration.sql`)).digest('hex');

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL не задан'); process.exit(1); }
const sql = neon(url);

const run = async () => {
  // выполняем каждое выражение миграции по отдельности (HTTP-драйвер — одно на вызов)
  for (const raw of sqlText.split(';')) {
    const stmt = raw.replace(/--[^\n]*\n/g, '').trim();
    if (!stmt) continue;
    await sql.query(stmt);
  }
  console.log('✔ agent_core tables + indexes ensured');

  const existing = await sql`SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION} LIMIT 1`;
  if (existing.length === 0) {
    await sql.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)`,
      [checksum, MIGRATION],
    );
    console.log('✔ recorded in _prisma_migrations');
  } else {
    console.log('• already recorded');
  }
  const t = await sql`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'Agent%' ORDER BY table_name`;
  console.log('Agent tables:', t.map((x) => x.table_name).join(', '));
};

run().then(() => process.exit(0)).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
