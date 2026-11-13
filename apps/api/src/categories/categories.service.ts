import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { productKey } from '@soi-don/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface SetCategoryResult {
  updated: number;
  rulesSaved: number;
  /** Dòng cùng tên đã có, chưa được chỉnh tay, được áp dụng quy tắc mới. */
  appliedToOthers: number;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, slug: true, name: true, parentId: true },
    });
  }

  /** Người dùng chọn danh mục cho một hoặc nhiều dòng; `remember` lưu quy tắc theo tên sản phẩm. */
  async setItemsCategory(
    userId: string,
    itemIds: string[],
    categoryId: string,
    remember: boolean,
  ): Promise<SetCategoryResult> {
    const ids = [...new Set(itemIds)];
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new BadRequestException('Danh mục không tồn tại');

    const items = await this.prisma.transactionItem.findMany({
      where: { id: { in: ids }, transaction: { userId } },
      select: { id: true, productName: true, productKey: true },
    });
    // Không phân biệt "không tồn tại" và "của người khác".
    if (items.length !== ids.length) throw new NotFoundException('Không tìm thấy sản phẩm');

    return this.prisma.$transaction(async (tx) => {
      const { count: updated } = await tx.transactionItem.updateMany({
        where: { id: { in: ids } },
        data: { categoryId, categorySource: 'MANUAL' },
      });
      if (!remember) return { updated, rulesSaved: 0, appliedToOthers: 0 };

      const byKey = new Map<string, string>();
      for (const it of items) byKey.set(it.productKey ?? productKey(it.productName), it.productName);
      for (const [pattern, label] of byKey) {
        await tx.categoryRule.upsert({
          where: { userId_match_pattern: { userId, match: 'PRODUCT_NAME', pattern } },
          update: { categoryId, label },
          create: { userId, match: 'PRODUCT_NAME', pattern, label, categoryId },
        });
      }
      const { count: appliedToOthers } = await tx.transactionItem.updateMany({
        where: {
          transaction: { userId },
          productKey: { in: [...byKey.keys()] },
          id: { notIn: ids },
          OR: [{ categorySource: null }, { categorySource: { not: 'MANUAL' } }],
        },
        data: { categoryId, categorySource: 'USER_RULE' },
      });
      return { updated, rulesSaved: byKey.size, appliedToOthers };
    });
  }

  async listRules(userId: string) {
    const rules = await this.prisma.categoryRule.findMany({
      where: { userId, match: 'PRODUCT_NAME' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        pattern: true,
        label: true,
        createdAt: true,
        category: { select: { id: true, name: true, parent: { select: { name: true } } } },
      },
    });
    return rules.map((r) => ({
      id: r.id,
      label: r.label ?? r.pattern,
      createdAt: r.createdAt,
      category: {
        id: r.category.id,
        name: r.category.parent ? `${r.category.parent.name} › ${r.category.name}` : r.category.name,
      },
    }));
  }

  /** Xóa quy tắc không đổi danh mục đã lưu của các dòng cũ. */
  async deleteRule(userId: string, id: string) {
    const { count } = await this.prisma.categoryRule.deleteMany({ where: { id, userId } });
    if (!count) throw new NotFoundException('Không tìm thấy quy tắc');
    return { deleted: count };
  }
}
