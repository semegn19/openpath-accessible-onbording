import { connectDatabase } from './database.mjs';
const days = Number(process.env.RETENTION_DAYS);
if (!process.env.DATABASE_URL || !Number.isInteger(days) || days < 1 || days > 3650) throw new Error('Set DATABASE_URL and RETENTION_DAYS (1–3650)');
if (!process.argv.includes('--apply')) throw new Error('This deletes expired records. Pass --apply after reviewing your retention policy.');
const db = await connectDatabase(process.env.DATABASE_URL);
try { console.log(JSON.stringify({ deletedSubmissions: await db.cleanup(days) })); }
finally { await db.close(); }
