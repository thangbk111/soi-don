import { PrismaClient } from '@prisma/client';
import { DEFAULT_CATEGORIES } from '@soi-don/shared';

const prisma = new PrismaClient();

async function main() {
  const ids = new Map<string, string>();
  // Cha đứng trước con trong DEFAULT_CATEGORIES nên parentId luôn có sẵn.
  for (const [sortOrder, c] of DEFAULT_CATEGORIES.entries()) {
    const parentId = c.parent ? (ids.get(c.parent) ?? null) : null;
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, parentId, sortOrder },
      create: { slug: c.slug, name: c.name, parentId, sortOrder },
    });
    ids.set(c.slug, row.id);
  }

  // Danh mục cũ không còn trong danh sách: chỉ xóa khi không còn dòng sản phẩm/quy tắc nào dùng.
  const stale = await prisma.category.deleteMany({
    where: {
      slug: { notIn: DEFAULT_CATEGORIES.map((c) => c.slug) },
      items: { none: {} },
      rules: { none: {} },
      children: { none: {} },
    },
  });
  console.log(`Seeded ${DEFAULT_CATEGORIES.length} categories, removed ${stale.count} unused`);
}

main().finally(() => prisma.$disconnect());
