const { PrismaClient } = require('@genie/prisma-client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const connectionString = "postgresql://postgres.nzurymawikvamjjfbdmz:FYBNf2RCjGaxcqF@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true";
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const properties = await prisma.property.findMany({
    where: {
      status: 'Active',
    },
    select: {
      id: true,
      title: true,
      price: true,
      status: true,
      boundaryPoints: true,
      userId: true
    }
  });
  console.log(JSON.stringify(properties, null, 2));
  await prisma.$disconnect();
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
