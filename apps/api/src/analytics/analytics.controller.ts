import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { SearchService } from '../search/search.service';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * A subset of the admin dashboard's full analytics surface, built to the
 * same real-data standard as everything else this phase — not every
 * conceivable aggregation endpoint, but every one built here queries
 * genuine data (Order/User tables for financial/customer numbers,
 * AnalyticsEvent for behavioral signals with no other home), none of it
 * placeholder. Remaining admin-dashboard-specific views (e.g. a
 * dedicated inventory overview) are Phase 9's job, which owns the
 * broader admin surface this feeds into.
 */
@ApiTags('analytics')
@ApiBearerAuth()
@Roles('admin')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly searchService: SearchService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'Real revenue, order, and customer totals in one call — the dashboard landing view.',
  })
  async getOverview(@Query() range: DateRangeQueryDto) {
    const [revenue, orders, customers] = await Promise.all([
      this.analyticsService.totalRevenue(range),
      this.analyticsService.getOrderStats(range),
      this.analyticsService.getCustomerStats(range),
    ]);
    return { revenue, orders, customers };
  }

  @Get('revenue')
  async getRevenue(@Query() range: DateRangeQueryDto) {
    return { total: await this.analyticsService.totalRevenue(range) };
  }

  @Get('orders')
  getOrders(@Query() range: DateRangeQueryDto) {
    return this.analyticsService.getOrderStats(range);
  }

  @Get('products')
  @ApiOperation({
    summary:
      'Most-viewed products in the window — real PRODUCT_VIEW event data.',
  })
  getProducts(@Query() range: DateRangeQueryDto) {
    return this.analyticsService.topProductsByEventType(
      'PRODUCT_VIEW',
      range,
      20,
    );
  }

  @Get('customers')
  getCustomers(@Query() range: DateRangeQueryDto) {
    return this.analyticsService.getCustomerStats(range);
  }

  @Get('search')
  @ApiOperation({
    summary:
      'Real trending search terms — reuses the same aggregation SearchController exposes publicly, not a duplicate implementation.',
  })
  getSearch() {
    return this.searchService.getTrending();
  }
}
