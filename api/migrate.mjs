import { connectDatabase } from './database.mjs';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for the target database');
const db = await connectDatabase(process.env.DATABASE_URL);
try { await db.migrate(); console.log('Roha database schema version 1 ready'); }
finally { await db.close(); }
