import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseRangeOrThrow } from '../common/date-range';
import { ScanService } from './scan.service';

@Controller('scans')
@UseGuards(AuthGuard)
export class ScanController {
  constructor(private readonly scans: ScanService) {}

  /** Body: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" } theo ngày đặt hàng (giờ VN). */
  @Post()
  start(@UserId() userId: string, @Body() body: { from?: unknown; to?: unknown }) {
    const { range, start, endExclusive } = parseRangeOrThrow(body);
    return this.scans.start(userId, range, start, endExclusive);
  }

  @Get('latest')
  latest(@UserId() userId: string) {
    return this.scans.latest(userId);
  }
}
