import { Injectable } from '@nestjs/common';
import { Big } from 'big.js';
import { differenceInDays } from 'date-fns';

import {
  PPCashFlow,
  PPCostBasisSummary,
  PPIrrResult,
  PPPerformanceMetrics,
  PPTtwrorResult,
  PPValuationPoint
} from './interfaces';
import { PPCostBasisCalculator } from './pp-cost-basis.calculator';
import { PPIrrCalculator } from './pp-irr.calculator';
import { PPTtwrorCalculator } from './pp-ttwror.calculator';

/**
 * Activity types from Ghostfolio
 */
export type ActivityType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'INTEREST'
  | 'FEE'
  | 'ITEM'
  | 'LIABILITY';

/**
 * Activity/Order from Ghostfolio
 */
export interface GhostfolioActivity {
  date: Date;
  type: ActivityType;
  symbol?: string;
  quantity: Big;
  unitPrice: Big;
  fee: Big;
  currency: string;
  value?: Big; // Total value of transaction
}

/**
 * Daily valuation from Ghostfolio
 */
export interface GhostfolioValuation {
  date: Date;
  totalValue: Big;
  deposits: Big;
  withdrawals: Big;
}

/**
 * Combined PP Performance Service
 *
 * Integrates all PP calculators to provide comprehensive performance metrics
 * that can be compared side-by-side with Ghostfolio's ROAI calculations.
 */
@Injectable()
export class PPPerformanceService {
  constructor(
    private readonly irrCalculator: PPIrrCalculator,
    private readonly ttwrorCalculator: PPTtwrorCalculator,
    private readonly costBasisCalculator: PPCostBasisCalculator
  ) {}

  /**
   * Calculate all PP performance metrics for a portfolio
   *
   * @param activities - Trading activities from Ghostfolio
   * @param valuations - Daily portfolio valuations
   * @param startDate - Start of reporting period
   * @param endDate - End of reporting period
   * @param currentValue - Current portfolio value
   * @returns Combined PP performance metrics
   */
  public calculatePerformance(
    activities: GhostfolioActivity[],
    valuations: GhostfolioValuation[],
    startDate: Date,
    endDate: Date,
    currentValue: Big
  ): PPPerformanceMetrics {
    // Filter activities within the date range
    const periodActivities = activities.filter(
      (a) => a.date >= startDate && a.date <= endDate
    );

    // Calculate IRR
    const cashFlows = this.activityToCashFlows(periodActivities);
    const irrResult = this.irrCalculator.calculate(
      cashFlows,
      currentValue,
      endDate
    );

    // Calculate TTWROR
    const valuationPoints = this.valuationsToPoints(valuations);
    const ttwrorResult = this.ttwrorCalculator.calculate(valuationPoints, true);

    // Calculate cost basis and capital gains
    const capitalGains = this.calculateCapitalGains(
      activities,
      currentValue,
      endDate
    );

    // Calculate income and expenses
    const dividends = this.sumByType(periodActivities, 'DIVIDEND');
    const fees = this.sumFees(periodActivities);
    const taxes = new Big(0); // Would need tax transaction support

    // Calculate absolute performance
    const totalInvestment = this.calculateTotalInvestment(periodActivities);
    const absolutePerformance = currentValue.minus(totalInvestment);
    const absolutePerformancePercent = totalInvestment.gt(0)
      ? absolutePerformance.div(totalInvestment).times(100).toNumber()
      : 0;

    return {
      irr: irrResult,
      ttwror: ttwrorResult,
      capitalGains,
      dividends,
      fees,
      taxes,
      absolutePerformance,
      absolutePerformancePercent
    };
  }

  /**
   * Convert Ghostfolio activities to PP cash flows
   * Cash flow convention: negative = money out, positive = money in
   */
  private activityToCashFlows(activities: GhostfolioActivity[]): PPCashFlow[] {
    const cashFlows: PPCashFlow[] = [];

    for (const activity of activities) {
      let amount: Big;
      let type: PPCashFlow['type'];

      const value =
        activity.value || activity.quantity.times(activity.unitPrice);

      switch (activity.type) {
        case 'BUY':
          // Money goes out (negative)
          amount = value.plus(activity.fee).neg();
          type = 'BUY';
          break;

        case 'SELL':
          // Money comes in (positive)
          amount = value.minus(activity.fee);
          type = 'SELL';
          break;

        case 'DIVIDEND':
          // Money comes in (positive)
          amount = value.minus(activity.fee);
          type = 'DIVIDEND';
          break;

        case 'INTEREST':
          // Money comes in (positive)
          amount = value;
          type = 'DIVIDEND'; // Treat interest similar to dividend
          break;

        case 'FEE':
          // Money goes out (negative)
          amount = value.neg();
          type = 'FEE';
          break;

        default:
          continue;
      }

      cashFlows.push({
        date: activity.date,
        amount,
        type
      });
    }

    // Sort by date
    return cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Convert Ghostfolio valuations to PP valuation points
   */
  private valuationsToPoints(
    valuations: GhostfolioValuation[]
  ): PPValuationPoint[] {
    return valuations.map((v) => ({
      date: v.date,
      marketValue: v.totalValue,
      externalFlow: v.deposits.minus(v.withdrawals)
    }));
  }

  /**
   * Calculate capital gains using FIFO method
   */
  private calculateCapitalGains(
    activities: GhostfolioActivity[],
    currentValue: Big,
    endDate: Date
  ): { realized: Big; unrealized: Big; total: Big } {
    // Reset cost basis calculator
    this.costBasisCalculator.clear();

    let totalRealized = new Big(0);
    let totalUnrealized = new Big(0);

    // Group activities by symbol
    const bySymbol = new Map<string, GhostfolioActivity[]>();
    for (const activity of activities) {
      if (!activity.symbol) continue;

      const symbolActivities = bySymbol.get(activity.symbol) || [];
      symbolActivities.push(activity);
      bySymbol.set(activity.symbol, symbolActivities);
    }

    // Process each symbol
    for (const [symbol, symbolActivities] of bySymbol.entries()) {
      // Sort by date
      const sorted = symbolActivities.sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );

      let latestPrice = new Big(0);

      for (const activity of sorted) {
        const value =
          activity.value || activity.quantity.times(activity.unitPrice);

        switch (activity.type) {
          case 'BUY':
            this.costBasisCalculator.addPurchase(
              symbol,
              activity.date,
              activity.quantity,
              value.plus(activity.fee),
              activity.fee
            );
            latestPrice = activity.unitPrice;
            break;

          case 'SELL':
            const saleResult = this.costBasisCalculator.processSale(
              symbol,
              activity.quantity,
              activity.unitPrice,
              activity.date
            );
            totalRealized = totalRealized.plus(saleResult.realizedGain);
            latestPrice = activity.unitPrice;
            break;
        }
      }

      // Calculate unrealized gains for remaining shares
      if (latestPrice.gt(0)) {
        const summary = this.costBasisCalculator.getCostBasisSummary(
          symbol,
          latestPrice
        );
        totalUnrealized = totalUnrealized.plus(summary.unrealizedGain);
      }
    }

    return {
      realized: totalRealized,
      unrealized: totalUnrealized,
      total: totalRealized.plus(totalUnrealized)
    };
  }

  /**
   * Sum values for a specific activity type
   */
  private sumByType(activities: GhostfolioActivity[], type: ActivityType): Big {
    return activities
      .filter((a) => a.type === type)
      .reduce((sum, a) => {
        const value = a.value || a.quantity.times(a.unitPrice);
        return sum.plus(value);
      }, new Big(0));
  }

  /**
   * Sum all fees from activities
   */
  private sumFees(activities: GhostfolioActivity[]): Big {
    return activities.reduce((sum, a) => sum.plus(a.fee), new Big(0));
  }

  /**
   * Calculate total net investment (buys - sells)
   */
  private calculateTotalInvestment(activities: GhostfolioActivity[]): Big {
    let total = new Big(0);

    for (const activity of activities) {
      const value =
        activity.value || activity.quantity.times(activity.unitPrice);

      switch (activity.type) {
        case 'BUY':
          total = total.plus(value).plus(activity.fee);
          break;
        case 'SELL':
          total = total.minus(value).plus(activity.fee);
          break;
      }
    }

    return total;
  }

  /**
   * Get cost basis summary for all holdings
   */
  public getCostBasisSummaries(
    activities: GhostfolioActivity[],
    currentPrices: Map<string, Big>
  ): Map<string, PPCostBasisSummary> {
    // Process all activities first
    this.costBasisCalculator.clear();

    // Group and process by symbol
    const bySymbol = new Map<string, GhostfolioActivity[]>();
    for (const activity of activities) {
      if (!activity.symbol) continue;
      const symbolActivities = bySymbol.get(activity.symbol) || [];
      symbolActivities.push(activity);
      bySymbol.set(activity.symbol, symbolActivities);
    }

    for (const [symbol, symbolActivities] of bySymbol.entries()) {
      const sorted = symbolActivities.sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );

      for (const activity of sorted) {
        const value =
          activity.value || activity.quantity.times(activity.unitPrice);

        if (activity.type === 'BUY') {
          this.costBasisCalculator.addPurchase(
            symbol,
            activity.date,
            activity.quantity,
            value.plus(activity.fee),
            activity.fee
          );
        } else if (activity.type === 'SELL') {
          this.costBasisCalculator.processSale(
            symbol,
            activity.quantity,
            activity.unitPrice,
            activity.date
          );
        }
      }
    }

    // Get summaries
    const summaries = new Map<string, PPCostBasisSummary>();
    for (const symbol of this.costBasisCalculator.getTrackedSecurities()) {
      const price = currentPrices.get(symbol) || new Big(0);
      const summary = this.costBasisCalculator.getCostBasisSummary(
        symbol,
        price
      );
      summaries.set(symbol, summary);
    }

    return summaries;
  }

  /**
   * Calculate performance for a specific holding
   */
  public calculateHoldingPerformance(
    symbol: string,
    activities: GhostfolioActivity[],
    currentPrice: Big,
    endDate: Date
  ): {
    irr: PPIrrResult;
    costBasis: PPCostBasisSummary;
    holdingPeriodDays: number | null;
    isLongTerm: boolean;
  } {
    // Filter activities for this symbol
    const symbolActivities = activities.filter((a) => a.symbol === symbol);

    // Calculate IRR
    const cashFlows = this.activityToCashFlows(symbolActivities);

    // Get remaining shares and current value
    this.costBasisCalculator.clear();
    for (const activity of symbolActivities.sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    )) {
      const value =
        activity.value || activity.quantity.times(activity.unitPrice);
      if (activity.type === 'BUY') {
        this.costBasisCalculator.addPurchase(
          symbol,
          activity.date,
          activity.quantity,
          value.plus(activity.fee),
          activity.fee
        );
      } else if (activity.type === 'SELL') {
        this.costBasisCalculator.processSale(
          symbol,
          activity.quantity,
          activity.unitPrice,
          activity.date
        );
      }
    }

    const costBasis = this.costBasisCalculator.getCostBasisSummary(
      symbol,
      currentPrice
    );
    const currentValue = costBasis.totalShares.times(currentPrice);

    const irr = this.irrCalculator.calculate(cashFlows, currentValue, endDate);

    const holdingPeriodDays = this.costBasisCalculator.getOldestHoldingPeriodDays(
      symbol,
      endDate
    );

    // Indian tax rules: equity > 12 months is LTCG
    const isLongTerm = this.costBasisCalculator.isLongTermHolding(
      symbol,
      endDate,
      365
    );

    return {
      irr,
      costBasis,
      holdingPeriodDays,
      isLongTerm
    };
  }
}
