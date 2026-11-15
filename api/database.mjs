/** One organisation per database. All SQL values use parameters. */
export async function connectDatabase(connectionString) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000, statement_timeout: 5000, application_name: 'roha' });
  pool.on('error', () => console.error('database pool connection failed'));
  const db = {
    async migrate() {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(72460401)');
        await client.query(`
          CREATE TABLE IF NOT EXISTS roha_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
          CREATE TABLE IF NOT EXISTS roha_submissions (
            id text PRIMARY KEY, form_id text NOT NULL, client_ref text, received_at timestamptz NOT NULL,
            record jsonb NOT NULL, UNIQUE(form_id, client_ref));
          CREATE INDEX IF NOT EXISTS roha_submissions_received ON roha_submissions(received_at);
          CREATE TABLE IF NOT EXISTS roha_ai_config (id integer PRIMARY KEY CHECK(id=1), revision integer NOT NULL, encrypted jsonb NOT NULL);
          CREATE TABLE IF NOT EXISTS roha_limits (id text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
          CREATE TABLE IF NOT EXISTS roha_sessions (id text PRIMARY KEY, expires_at timestamptz NOT NULL);
          INSERT INTO roha_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
        `);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    async ready() { await pool.query('SELECT version FROM roha_migrations WHERE version=1').then(r=>{if(!r.rows.length)throw new Error('migration-required');}); },
    async saveSubmission(record) {
      const result = await pool.query(`INSERT INTO roha_submissions(id,form_id,client_ref,received_at,record)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(form_id,client_ref) DO NOTHING RETURNING record`,
        [record.id,record.formId,record.clientRef || null,record.receivedAt,record]);
      if (result.rows.length) return { record: result.rows[0].record, duplicate:false };
      const existing = await db.findSubmission(record.formId,record.clientRef);
      if (!existing) throw new Error('submission-unavailable');
      return { record:existing,duplicate:true };
    },
    async findSubmission(formId,ref) {
      const result = await pool.query('SELECT record FROM roha_submissions WHERE form_id=$1 AND client_ref=$2',[formId,ref]);
      return result.rows[0]?.record;
    },
    async getSubmission(id) { return (await pool.query('SELECT record FROM roha_submissions WHERE id=$1',[id])).rows[0]?.record; },
    async getConfig() { return (await pool.query('SELECT encrypted FROM roha_ai_config WHERE id=1')).rows[0]?.encrypted; },
    async setConfig(box, revision) {
      const result = revision === 0
        ? await pool.query('INSERT INTO roha_ai_config(id,revision,encrypted) VALUES(1,1,$1) ON CONFLICT DO NOTHING RETURNING revision',[box])
        : await pool.query('UPDATE roha_ai_config SET revision=revision+1,encrypted=$1 WHERE id=1 AND revision=$2 RETURNING revision',[box,revision]);
      if (!result.rows.length) throw Object.assign(new Error('configuration-changed'),{status:409,code:'configuration-changed'});
    },
    async reserve(id, limit, duration) {
      // Atomic across workers, including reset at the fixed window boundary.
      const result = await pool.query(`INSERT INTO roha_limits(id,count,expires_at) VALUES($1,1,now()+$2*interval '1 millisecond')
        ON CONFLICT(id) DO UPDATE SET
          count=CASE WHEN roha_limits.expires_at<=now() THEN 1 ELSE LEAST(roha_limits.count+1,1000001) END,
          expires_at=CASE WHEN roha_limits.expires_at<=now() THEN now()+$2*interval '1 millisecond' ELSE roha_limits.expires_at END
        RETURNING count`,[id,duration]);
      return result.rows[0].count <= limit;
    },
    async createSession(id) { await pool.query("INSERT INTO roha_sessions(id,expires_at) VALUES($1,now()+interval '1 hour')",[id]); },
    async hasSession(id) { return (await pool.query('SELECT id FROM roha_sessions WHERE id=$1 AND expires_at>now()',[id])).rows.length > 0; },
    async deleteSession(id) { await pool.query('DELETE FROM roha_sessions WHERE id=$1',[id]); },
    async cleanup(retentionDays) {
      await pool.query('DELETE FROM roha_sessions WHERE expires_at<=now()');
      await pool.query('DELETE FROM roha_limits WHERE expires_at<=now()');
      if (retentionDays) return (await pool.query("DELETE FROM roha_submissions WHERE received_at<now()-$1*interval '1 day'",[retentionDays])).rowCount;
      return 0;
    },
    async close() { await pool.end(); },
  };
  await pool.query('SELECT 1');
  return db;
}
