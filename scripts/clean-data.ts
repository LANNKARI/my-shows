import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.$transaction([
    prisma.collectionItem.deleteMany({}),
    prisma.rating.deleteMany({}),
    prisma.episode.deleteMany({}),
    prisma.title.deleteMany({}),
    prisma.collection.deleteMany({}),
  ]);

  console.log("✅ Очищено:");
  console.log(`   CollectionItem: ${deleted[0].count}`);
  console.log(`   Rating:         ${deleted[1].count}`);
  console.log(`   Episode:        ${deleted[2].count}`);
  console.log(`   Title:          ${deleted[3].count}`);
  console.log(`   Collection:     ${deleted[4].count}`);
  console.log("");
  console.log("👤 Пользователи (User) сохранены.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });