import pg from 'pg';
import { randomBytes } from 'node:crypto';
export async function databaseFixture() {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a test PostgreSQL server with permission to create schemas.');
  const client=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await client.connect();
  const schema='roha_test_'+randomBytes(8).toString('hex');
  await client.query(`CREATE SCHEMA ${schema}`);
  const url=new URL(process.env.TEST_DATABASE_URL);url.searchParams.set('options',`-c search_path=${schema}`);
  return {url:url.href,schema,dropSchema:()=>client.query(`DROP SCHEMA ${schema} CASCADE`),cleanup:async()=>{await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await client.end();}};
}
