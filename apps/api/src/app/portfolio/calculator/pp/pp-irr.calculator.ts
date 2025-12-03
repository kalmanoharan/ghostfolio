import { Injectable } from '@nestjs/common';
import { Big } from 'big.js';
import { differenceInDays } from 'date-fns';

import { PPCashFlow, PPIrrResult } from './interfaces';

/**
 * IRR Calculator ported from Portfolio Performance
 *
 * Reference: /Users/kalmanoharan/Documents/portfolio/name.abuchen.portfolio/src/name/abuchen/portfolio/math/IRR.java
 *
 * Uses Newton-Raphson method with bisection fallback to find the discount rate where NPV = 0
 *
 * The IRR equation:
 * NPV = Σ CF_t / (1 + r)^(days_t/365) = 0
 *
 * Where:
 * - CF_t = Cash flow at time t (negative for outflows, positive for inflows)
 * - r = Internal Rate of Return (what we're solving for)
 * - days_t = Days from first cash flow to cash flow t
 */
@Injectable()
export class PPIrrCalculator {
  private readonly MAX_ITERATIONS = 500;
  private readonly PRECISION = 0.00001;
  private readonly EPSILON = 1e-10;

  /**
   * Calculate IRR for a series of cash flows ending with a final value
   *
   * @param cashFlows - Array of dated cash flows (negative = investment, positive = return)
   * @param endValue - Final market value at endDate (treated as positive inflow)
   * @param endDate - End date of the calculation period
   * @returns IRR result with both periodic and annualized rates
   *
   * @example
   * // Buy 10 shares at $100 each, sell at $150 after 2 years
   * const result = calculator.calculate(
   *   [{ date: new Date('2022-01-01'), amount: new Big(-1000) }],
   *   new Big(1500),
   *   new Date('2024-01-01')
   * );
   * // result.irrAnnualized ≈ 0.2247 (22.47% per year)
   */
  public calculate(
    cashFlows: PPCashFlow[],
    endValue: Big,
    endDate: Date
  ): PPIrrResult {
    // Handle edge cases
    if (cashFlows.length === 0) {
      return this.emptyResult();
    }

    // Sort cash flows by date (oldest first)
    const sortedFlows = [...cashFlows].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    // Filter out cash flows after end date
    const validFlows = sortedFlows.filter((cf) => cf.date <= endDate);

    if (validFlows.length === 0) {
      return this.emptyResult();
    }

    // Check if all cash flows are zero
    const totalFlow = validFlows.reduce(
      (sum, cf) => sum.plus(cf.amount.abs()),
      new Big(0)
    );
    if (totalFlow.eq(0) && endValue.eq(0)) {
      return this.emptyResult();
    }

    // Prepare data for NPV calculation
    const firstDate = validFlows[0].date;
    const days: number[] = [];
    const values: number[] = [];

    for (const cf of validFlows) {
      days.push(differenceInDays(cf.date, firstDate));
      values.push(cf.amount.toNumber());
    }

    // Add end value as final cash flow
    days.push(differenceInDays(endDate, firstDate));
    values.push(endValue.toNumber());

    // Find initial guess using bisection
    const guess = this.findInitialGuess(days, values);

    // Newton-Raphson iteration
    const { rate, converged, iterations } = this.newtonRaphson(
      days,
      values,
      guess
    );

    // Calculate holding period for annualization
    const holdingPeriodDays = Math.max(1, differenceInDays(endDate, firstDate));

    const irr = rate - 1; // Convert from (1+r) to r
    const irrAnnualized = this.annualizeRate(irr, holdingPeriodDays);

    return {
      irr,
      irrAnnualized,
      converged,
      iterations
    };
  }

  /**
   * Calculate NPV at a given rate
   * NPV = Σ value_i / rate^(days_i/365)
   */
  private calculateNPV(days: number[], values: number[], rate: number): number {
    let npv = 0;

    for (let i = 0; i < days.length; i++) {
      const exponent = days[i] / 365.0;
      const discountFactor = Math.pow(rate, exponent);

      if (discountFactor === 0 || !isFinite(discountFactor)) {
        continue;
      }

      npv += values[i] / discountFactor;
    }

    return npv;
  }

  /**
   * Calculate pseudo-derivative of NPV using numerical differentiation
   * This matches Portfolio Performance's PseudoDerivativeFunction.java
   * Uses central difference: f'(x) ≈ (f(x+δ) - f(x-δ)) / (2δ)
   */
  private calculateNPVDerivative(
    days: number[],
    values: number[],
    rate: number
  ): number {
    const delta = Math.abs(rate) / 1e6;

    const left = this.calculateNPV(days, values, rate - delta);
    const right = this.calculateNPV(days, values, rate + delta);

    return (right - left) / (2 * delta);
  }

  /**
   * Find initial guess using bisection method
   * Based on Portfolio Performance's halving approach
   */
  private findInitialGuess(days: number[], values: number[]): number {
    // NPV at rate approaching 0 is dominated by the most discounted (last) cash flow
    const fLeft = values[values.length - 1];

    // NPV at rate = 1 is the sum of undiscounted flows
    const fRight = values.reduce((sum, v) => sum + v, 0);

    // If they have the same sign, can't use bisection, use default guess
    if (Math.sign(fLeft) === Math.sign(fRight)) {
      return 1.05; // 5% return as default guess
    }

    // Bisection between 0 and 1 to find crude initial guess
    return this.bisection(days, values, 0.001, 1, fLeft, fRight);
  }

  /**
   * Bisection method to find rough estimate
   */
  private bisection(
    days: number[],
    values: number[],
    left: number,
    right: number,
    fLeft: number,
    fRight: number
  ): number {
    if (right - left < 0.001) {
      return (left + right) / 2;
    }

    const center = (left + right) / 2;
    const fCenter = this.calculateNPV(days, values, center);

    if (fCenter === 0) {
      return center;
    } else if (Math.sign(fCenter) === Math.sign(fRight)) {
      return this.bisection(days, values, left, center, fLeft, fCenter);
    } else {
      return this.bisection(days, values, center, right, fCenter, fRight);
    }
  }

  /**
   * Newton-Raphson iteration
   * x(i+1) = x(i) - f(x(i)) / f'(x(i))
   */
  private newtonRaphson(
    days: number[],
    values: number[],
    x0: number
  ): { rate: number; converged: boolean; iterations: number } {
    let xi = x0;
    let converged = false;
    let iterations = 0;

    for (let i = 0; i < this.MAX_ITERATIONS; i++) {
      iterations = i + 1;

      const fxi = this.calculateNPV(days, values, xi);
      const fdxi = this.calculateNPVDerivative(days, values, xi);

      // Check if derivative is too small
      if (Math.abs(fdxi) < this.EPSILON) {
        break;
      }

      const xi1 = xi - fxi / fdxi;
      const delta = Math.abs(xi1 - xi);

      if (delta < this.PRECISION) {
        xi = xi1;
        converged = true;
        break;
      }

      // Bound the rate to prevent wild oscillations
      if (xi1 < 0.0001) {
        xi = 0.0001;
      } else if (xi1 > 100) {
        xi = 100;
      } else {
        xi = xi1;
      }
    }

    return { rate: xi, converged, iterations };
  }

  /**
   * Annualize a periodic return
   * Formula: (1 + r)^(365/days) - 1
   */
  private annualizeRate(rate: number, days: number): number {
    if (days <= 0) {
      return 0;
    }
    if (days === 365) {
      return rate;
    }

    const base = 1 + rate;
    if (base <= 0) {
      return -1; // Total loss
    }

    return Math.pow(base, 365 / days) - 1;
  }

  private emptyResult(): PPIrrResult {
    return {
      irr: null,
      irrAnnualized: null,
      converged: false,
      iterations: 0
    };
  }
}
