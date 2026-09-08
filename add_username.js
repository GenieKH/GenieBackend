const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.nzurymawikvamjjfbdmz:FYBNf2RCjGaxcqF@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres' });
client.connect().then(() => {
  client.query('ALTER TABLE users ADD COLUMN username TEXT UNIQUE;')
    .then(res => { console.log("Done"); client.end(); })
    .catch(e => { console.log(e); client.end(); });
});
