import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

// Load .env if present
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const connectionString =
  process.env.DATABASE_URL ||
  process.argv[2] ||
  (process.env.DB_PASSWORD ? `postgresql://postgres:${encodeURIComponent(process.env.DB_PASSWORD)}@db.lyltljxzbzrjqpzgsyvm.supabase.co:5432/postgres` : null);

if (!connectionString) {
  console.error('\n❌ No DATABASE_URL or database password provided.');
  console.log('You can either:');
  console.log('  1. Provide the connection string as an argument:');
  console.log('     node scripts/migrate.js "postgresql://postgres:[PASSWORD]@db.lyltljxzbzrjqpzgsyvm.supabase.co:5432/postgres"');
  console.log('  2. Set DATABASE_URL in .env');
  console.log('  3. Or copy supabase/schema.sql and paste it into the Supabase Dashboard SQL Editor:\n     https://supabase.com/dashboard/project/lyltljxzbzrjqpzgsyvm/sql/new\n');
  process.exit(1);
}

async function run() {
  console.log('Connecting to Supabase PostgreSQL database...');
  const sql = postgres(connectionString, {
    ssl: 'require',
    max: 1,
  });

  try {
    const schemaSql = fs.readFileSync(path.resolve('supabase/schema.sql'), 'utf-8');
    console.log('Executing schema.sql...');
    await sql.unsafe(schemaSql);
    console.log('✅ Schema migration executed successfully!');

    // Verify tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    console.log('\nVerified tables in public schema:');
    tables.forEach((t) => console.log(' - ' + t.table_name));

    const records = await sql`SELECT count(*) FROM public.qr_records;`;
    console.log(`\nVerified qr_records row count: ${records[0].count}`);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
