import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { CategoriesService } from './categories.service';

const SetCategoryBody = z.object({
  itemIds: z.array(z.string().uuid()).min(1).max(500),
  categoryId: z.string().uuid(),
  remember: z.boolean().default(false),
});

@Controller()
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get('categories')
  list() {
    return this.categories.list();
  }

  /** Body: { itemIds: string[], categoryId: string, remember?: boolean } */
  @Patch('items/category')
  setCategory(@UserId() userId: string, @Body() body: unknown) {
    const parsed = SetCategoryBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Dữ liệu không hợp lệ');
    const { itemIds, categoryId, remember } = parsed.data;
    return this.categories.setItemsCategory(userId, itemIds, categoryId, remember);
  }

  @Get('category-rules')
  rules(@UserId() userId: string) {
    return this.categories.listRules(userId);
  }

  @Delete('category-rules/:id')
  deleteRule(@UserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.categories.deleteRule(userId, id);
  }
}
