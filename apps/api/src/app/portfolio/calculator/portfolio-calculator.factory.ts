import { CurrentRateService } from '@ghostfolio/api/app/portfolio/current-rate.service';
import { RedisCacheService } from '@ghostfolio/api/app/redis-cache/redis-cache.service';
import { ConfigurationService } from '@ghostfolio/api/services/configuration/configuration.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { PortfolioSnapshotService } from '@ghostfolio/api/services/queues/portfolio-snapshot/portfolio-snapshot.service';
import {
  Activity,
  Filter,
  HistoricalDataItem
} from '@ghostfolio/common/interfaces';
import { PerformanceCalculationType } from '@ghostfolio/common/types/performance-calculation-type.type';

import { Injectable } from '@nestjs/common';

import { MwrPortfolioCalculator } from './mwr/portfolio-calculator';
import { PortfolioCalculator } from './portfolio-calculator';
import {
  PPCostBasisCalculator,
  PPIrrCalculator,
  PPPerformanceService,
  PPRebalancingService,
  PPTtwrorCalculator
} from './pp';
import { RoaiPortfolioCalculator } from './roai/portfolio-calculator';
import { RoiPortfolioCalculator } from './roi/portfolio-calculator';
import { TwrPortfolioCalculator } from './twr/portfolio-calculator';

@Injectable()
export class PortfolioCalculatorFactory {
  public constructor(
    private readonly configurationService: ConfigurationService,
    private readonly currentRateService: CurrentRateService,
    private readonly exchangeRateDataService: ExchangeRateDataService,
    private readonly portfolioSnapshotService: PortfolioSnapshotService,
    private readonly redisCacheService: RedisCacheService
  ) {}

  public createCalculator({
    accountBalanceItems = [],
    activities,
    calculationType,
    currency,
    filters = [],
    userId
  }: {
    accountBalanceItems?: HistoricalDataItem[];
    activities: Activity[];
    calculationType: PerformanceCalculationType;
    currency: string;
    filters?: Filter[];
    userId: string;
  }): PortfolioCalculator {
    switch (calculationType) {
      case PerformanceCalculationType.MWR:
        return new MwrPortfolioCalculator({
          accountBalanceItems,
          activities,
          currency,
          filters,
          userId,
          configurationService: this.configurationService,
          currentRateService: this.currentRateService,
          exchangeRateDataService: this.exchangeRateDataService,
          portfolioSnapshotService: this.portfolioSnapshotService,
          redisCacheService: this.redisCacheService
        });

      case PerformanceCalculationType.ROAI:
        return new RoaiPortfolioCalculator({
          accountBalanceItems,
          activities,
          currency,
          filters,
          userId,
          configurationService: this.configurationService,
          currentRateService: this.currentRateService,
          exchangeRateDataService: this.exchangeRateDataService,
          portfolioSnapshotService: this.portfolioSnapshotService,
          redisCacheService: this.redisCacheService
        });

      case PerformanceCalculationType.ROI:
        return new RoiPortfolioCalculator({
          accountBalanceItems,
          activities,
          currency,
          filters,
          userId,
          configurationService: this.configurationService,
          currentRateService: this.currentRateService,
          exchangeRateDataService: this.exchangeRateDataService,
          portfolioSnapshotService: this.portfolioSnapshotService,
          redisCacheService: this.redisCacheService
        });

      case PerformanceCalculationType.TWR:
        return new TwrPortfolioCalculator({
          accountBalanceItems,
          activities,
          currency,
          filters,
          userId,
          configurationService: this.configurationService,
          currentRateService: this.currentRateService,
          exchangeRateDataService: this.exchangeRateDataService,
          portfolioSnapshotService: this.portfolioSnapshotService,
          redisCacheService: this.redisCacheService
        });

      default:
        throw new Error('Invalid calculation type');
    }
  }

  /**
   * Create PP IRR Calculator
   * Ported from Portfolio Performance - uses Newton-Raphson method
   */
  public createPPIrrCalculator(): PPIrrCalculator {
    return new PPIrrCalculator();
  }

  /**
   * Create PP TTWROR Calculator
   * Ported from Portfolio Performance - True Time-Weighted Rate of Return
   */
  public createPPTtwrorCalculator(): PPTtwrorCalculator {
    return new PPTtwrorCalculator();
  }

  /**
   * Create PP Cost Basis Calculator
   * FIFO-based cost basis tracking for capital gains
   */
  public createPPCostBasisCalculator(): PPCostBasisCalculator {
    return new PPCostBasisCalculator();
  }

  /**
   * Create PP Rebalancing Service
   * Calculates target vs actual allocations and suggests trades
   */
  public createPPRebalancingService(): PPRebalancingService {
    return new PPRebalancingService();
  }

  /**
   * Create PP Performance Service
   * Combined service that integrates all PP calculators
   */
  public createPPPerformanceService(): PPPerformanceService {
    return new PPPerformanceService(
      this.createPPIrrCalculator(),
      this.createPPTtwrorCalculator(),
      this.createPPCostBasisCalculator()
    );
  }
}
