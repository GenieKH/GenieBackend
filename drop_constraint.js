const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.nzurymawikvamjjfbdmz:FYBNf2RCjGaxcqF@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres' });
client.connect().then(() => {
  client.query('ALTER TABLE users DROP CONSTRAINT users_username_key;')
    .then(res => { console.log("Dropped"); client.end(); })
    .catch(e => { console.log(e); client.end(); });
});
