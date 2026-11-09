import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const before = await c.query(`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at`);
console.log("before", before.rows);
await c.query(`DELETE FROM "_prisma_migrations"`);
console.log("cleared");
await c.end();
