const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.nzurymawikvamjjfbdmz:FYBNf2RCjGaxcqF@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres' });
client.connect().then(() => {
  client.query('SELECT title, status, lat, lng FROM "Property" ORDER BY "createdAt" DESC LIMIT 5')
    .then(res => { console.table(res.rows); client.end(); })
    .catch(e => { console.log(e); client.end(); });
});
