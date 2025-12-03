import { Injectable } from '@nestjs/common';
import { Big } from 'big.js';
import { differenceInDays } from 'date-fns';

import { PPTtwrorResult, PPValuationPoint } from './interfaces';

/**
 * True Time-Weighted Rate of Return Calculator
 *
 * Reference: /Users/kalmanoharan/Documents/portfolio/name.abuchen.portfolio/src/name/abuchen/portfolio/snapshot/ClientIndex.java
 *
 * TTWROR measures portfolio performance independent of cash flows.
 * It answers: "How well did my investments perform?" (not "How much money did I make?")
 *
 * Formula:
 * TTWROR = Π(1 + r_i) - 1
 *
 * Where r_i (period return) = (MVE - MVB - CF) / (MVB + CF)
 *        = (thisValuation + outboundTransferals) / (valuation + inboundTransferals) - 1
 *
 * - MVE = Market Value End of period
 * - MVB = Market Value Beginning of period
 * - CF = External Cash Flow during period
 */
@Injectable()
export class PPTtwrorCalculator {
  /**
   * Calculate TTWROR from a series of daily valuations
   *
   * @param valuations - Daily market values with external flows
   * @param includeDailyReturns - Whether to include daily return series (for charts)
   * @returns TTWROR result with cumulative and annualized values
   */
  public calculate(
    valuations: PPValuationPoint[],
    includeDailyReturns: boolean = false
  ): PPTtwrorResult {
    if (valuations.length < 2) {
      return {
        ttwror: 0,
        ttwrorAnnualized: 0,
        holdingPeriodDays: 0,
        dailyReturns: includeDailyReturns ? [] : undefined
      };
    }

    // Sort by date
    const sorted = [...valuations].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    let cumulativeReturn = new Big(1);
    const dailyReturns: Array<{ date: Date; cumulativeReturn: number }> = [];

    if (includeDailyReturns) {
      dailyReturns.push({
        date: sorted[0].date,
        cumulativeReturn: 0
      });
    }

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      // External flow handling based on Portfolio Performance's approach:
      // Inbound transferals are added to the denominator (starting value)
      // Outbound transferals are added to the numerator (ending value)
      //
      // This matches the Modified Dietz method where:
      // Period return = (End Value + Outflows) / (Start Value + Inflows) - 1

      const inboundFlow = curr.externalFlow.gt(0) ? curr.externalFlow : new Big(0);
      const outboundFlow = curr.externalFlow.lt(0) ? curr.externalFlow.abs() : new Big(0);

      // Denominator: Previous market value + inbound flows
      const denominator = prev.marketValue.plus(inboundFlow);

      if (denominator.lte(0)) {
        // Skip this period if starting value is zero or negative
        if (includeDailyReturns) {
          dailyReturns.push({
            date: curr.date,
            cumulativeReturn: cumulativeReturn.minus(1).toNumber()
          });
        }
        continue;
      }

      // Period return: (MVE + outbound) / (MVB + inbound) - 1
      // This formula ensures external flows don't affect the return calculation
      const periodReturn = curr.marketValue
        .plus(outboundFlow)
        .div(denominator)
        .minus(1);

      // Geometric linking: multiply cumulative by (1 + period return)
      cumulativeReturn = cumulativeReturn.times(new Big(1).plus(periodReturn));

      if (includeDailyReturns) {
        dailyReturns.push({
          date: curr.date,
          cumulativeReturn: cumulativeReturn.minus(1).toNumber()
        });
      }
    }

    // Calculate holding period
    const firstDate = sorted[0].date;
    const lastDate = sorted[sorted.length - 1].date;
    const holdingPeriodDays = differenceInDays(lastDate, firstDate);

    const ttwror = cumulativeReturn.minus(1).toNumber();
    const ttwrorAnnualized = this.annualize(ttwror, holdingPeriodDays);

    return {
      ttwror,
      ttwrorAnnualized,
      holdingPeriodDays,
      dailyReturns: includeDailyReturns ? dailyReturns : undefined
    };
  }

  /**
   * Calculate TTWROR using the accumulated delta approach from Portfolio Performance
   * This method matches the exact calculation in ClientIndex.java
   *
   * @param dates - Array of dates
   * @param totals - Array of portfolio values at each date
   * @param inboundTransferals - Array of inbound transfers at each date
   * @param outboundTransferals - Array of outbound transfers at each date
   * @param includeDailyReturns - Whether to include daily return series
   */
  public calculateFromArrays(
    dates: Date[],
    totals: Big[],
    inboundTransferals: Big[],
    outboundTransferals: Big[],
    includeDailyReturns: boolean = false
  ): PPTtwrorResult {
    if (dates.length < 2) {
      return {
        ttwror: 0,
        ttwrorAnnualized: 0,
        holdingPeriodDays: 0,
        dailyReturns: includeDailyReturns ? [] : undefined
      };
    }

    const delta: number[] = new Array(dates.length).fill(0);
    const accumulated: number[] = new Array(dates.length).fill(0);
    const dailyReturns: Array<{ date: Date; cumulativeReturn: number }> = [];

    // First value = reference value
    delta[0] = 0;
    accumulated[0] = 0;
    let valuation = totals[0];

    if (includeDailyReturns) {
      dailyReturns.push({ date: dates[0], cumulativeReturn: 0 });
    }

    // Calculate series - matches ClientIndex.calculate()
    for (let i = 1; i < dates.length; i++) {
      const thisValuation = totals[i];

      const denominator = valuation.plus(inboundTransferals[i]);

      if (denominator.eq(0)) {
        // No assets at start of period
        delta[i] = 0;
      } else {
        // delta = (thisValuation + outboundTransferals) / (valuation + inboundTransferals) - 1
        delta[i] = thisValuation
          .plus(outboundTransferals[i])
          .div(denominator)
          .minus(1)
          .toNumber();
      }

      // accumulated[i] = ((accumulated[i-1] + 1) * (delta[i] + 1)) - 1
      accumulated[i] = (accumulated[i - 1] + 1) * (delta[i] + 1) - 1;

      if (includeDailyReturns) {
        dailyReturns.push({
          date: dates[i],
          cumulativeReturn: accumulated[i]
        });
      }

      valuation = thisValuation;
    }

    const holdingPeriodDays = differenceInDays(
      dates[dates.length - 1],
      dates[0]
    );
    const ttwror = accumulated[accumulated.length - 1];
    const ttwrorAnnualized = this.annualize(ttwror, holdingPeriodDays);

    return {
      ttwror,
      ttwrorAnnualized,
      holdingPeriodDays,
      dailyReturns: includeDailyReturns ? dailyReturns : undefined
    };
  }

  /**
   * Annualize a cumulative return
   * Formula: (1 + r)^(365/days) - 1
   * Matches PerformanceIndex.getFinalAccumulatedAnnualizedPercentage()
   */
  private annualize(cumulativeReturn: number, days: number): number {
    if (days <= 0) {
      return 0;
    }
    if (days === 365) {
      return cumulativeReturn;
    }

    const base = 1 + cumulativeReturn;
    if (base <= 0) {
      return -1;
    }

    return Math.pow(base, 365 / days) - 1;
  }
}
