const { PrismaClient } = require('@genie/prisma-client');
const prisma = new PrismaClient();

async function main() {
  const properties = await prisma.property.findMany({
    where: {
      status: 'Active',
    },
    select: {
      id: true,
      title: true,
      price: true,
      lat: true,
      lng: true,
      propertyType: true,
      boundaryPoints: true,
      status: true
    }
  });
  console.log(JSON.stringify(properties, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
