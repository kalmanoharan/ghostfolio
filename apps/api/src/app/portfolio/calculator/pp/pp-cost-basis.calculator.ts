import { Injectable } from '@nestjs/common';
import Big from 'big.js';
import { randomUUID } from 'node:crypto';

import {
  PPCostBasisSummary,
  PPPurchaseLot,
  PPSaleResult
} from './interfaces';

/**
 * FIFO (First-In-First-Out) Cost Basis Calculator
 *
 * Reference: Portfolio Performance's CapitalGainsCalculation.java
 *
 * Tracks purchase lots and calculates cost basis for sales using FIFO method.
 * This is important for:
 * - Accurate capital gains calculation
 * - Tax reporting (especially for Indian STCG/LTCG rules)
 * - Understanding true investment performance
 *
 * Key concepts from Portfolio Performance:
 * - LineItem: Represents a purchase lot with shares, date, value
 * - FIFO order: Oldest purchases are sold first
 * - Realized gains: Calculated when shares are sold
 * - Unrealized gains: Current value minus cost basis of remaining shares
 */
@Injectable()
export class PPCostBasisCalculator {
  private lots: Map<string, PPPurchaseLot[]> = new Map();

  /**
   * Initialize or reset lots for a security
   */
  public initializeSecurity(securityId: string): void {
    this.lots.set(securityId, []);
  }

  /**
   * Add a purchase lot for a security
   *
   * @param securityId - The security identifier
   * @param date - Purchase date
   * @param shares - Number of shares purchased
   * @param totalCost - Total cost including fees
   * @param fees - Transaction fees (already included in totalCost)
   * @returns The created purchase lot
   */
  public addPurchase(
    securityId: string,
    date: Date,
    shares: Big,
    totalCost: Big,
    fees: Big = new Big(0)
  ): PPPurchaseLot {
    if (!this.lots.has(securityId)) {
      this.lots.set(securityId, []);
    }

    const lot: PPPurchaseLot = {
      id: randomUUID(),
      date,
      shares,
      costPerShare: shares.gt(0) ? totalCost.div(shares) : new Big(0),
      totalCost,
      remainingShares: shares,
      fees
    };

    const securityLots = this.lots.get(securityId)!;
    securityLots.push(lot);

    // Sort by date (FIFO = oldest first)
    securityLots.sort((a, b) => a.date.getTime() - b.date.getTime());

    return lot;
  }

  /**
   * Add an existing position (for valuations at start of period)
   * This is used when calculating for a reporting period that starts mid-investment
   *
   * @param securityId - The security identifier
   * @param date - Valuation date
   * @param shares - Number of shares held
   * @param value - Market value at the valuation date
   */
  public addValuationAtStart(
    securityId: string,
    date: Date,
    shares: Big,
    value: Big
  ): PPPurchaseLot {
    return this.addPurchase(securityId, date, shares, value, new Big(0));
  }

  /**
   * Process a sale using FIFO method
   *
   * @param securityId - The security being sold
   * @param sharesToSell - Number of shares to sell
   * @param salePrice - Price per share at sale
   * @param saleDate - Date of sale (for holding period calculation)
   * @returns Details of the sale including cost basis and realized gain
   */
  public processSale(
    securityId: string,
    sharesToSell: Big,
    salePrice: Big,
    saleDate: Date
  ): PPSaleResult {
    const securityLots = this.lots.get(securityId) || [];

    let remaining = sharesToSell;
    let totalCostBasis = new Big(0);
    const lotsUsed: PPSaleResult['lotsUsed'] = [];

    // Process lots in FIFO order (oldest first)
    for (const lot of securityLots) {
      if (remaining.lte(0)) {
        break;
      }
      if (lot.remainingShares.lte(0)) {
        continue;
      }

      // Determine how many shares to take from this lot
      const sharesToTakeFromLot = remaining.lt(lot.remainingShares)
        ? remaining
        : lot.remainingShares;

      // Calculate cost basis for these shares
      const costBasisForShares = sharesToTakeFromLot.times(lot.costPerShare);

      totalCostBasis = totalCostBasis.plus(costBasisForShares);
      lot.remainingShares = lot.remainingShares.minus(sharesToTakeFromLot);
      remaining = remaining.minus(sharesToTakeFromLot);

      lotsUsed.push({
        lotId: lot.id,
        lotDate: lot.date,
        sharesSold: sharesToTakeFromLot,
        costBasis: costBasisForShares
      });
    }

    const actualSharesSold = sharesToSell.minus(remaining);
    const totalProceeds = actualSharesSold.times(salePrice);
    const realizedGain = totalProceeds.minus(totalCostBasis);
    const realizedGainPercent = totalCostBasis.gt(0)
      ? realizedGain.div(totalCostBasis).times(100).toNumber()
      : 0;

    return {
      sharesSold: actualSharesSold,
      totalCostBasis,
      totalProceeds,
      realizedGain,
      realizedGainPercent,
      lotsUsed
    };
  }

  /**
   * Process a transfer between portfolios
   * Maintains FIFO order and cost basis information
   *
   * @param securityId - The security being transferred
   * @param sharesToTransfer - Number of shares to transfer
   * @param transferDate - Date of transfer
   * @returns The lots that were transferred (with updated references)
   */
  public processTransfer(
    securityId: string,
    sharesToTransfer: Big,
    transferDate: Date
  ): PPPurchaseLot[] {
    const securityLots = this.lots.get(securityId) || [];
    const transferredLots: PPPurchaseLot[] = [];

    let remaining = sharesToTransfer;

    for (const lot of securityLots) {
      if (remaining.lte(0)) {
        break;
      }
      if (lot.remainingShares.lte(0)) {
        continue;
      }

      const sharesToTake = remaining.lt(lot.remainingShares)
        ? remaining
        : lot.remainingShares;

      // Calculate proportional cost for transferred shares
      const transferValue = sharesToTake.times(lot.costPerShare);

      if (sharesToTake.eq(lot.remainingShares)) {
        // Transfer entire lot
        transferredLots.push({
          ...lot,
          id: randomUUID(), // New ID for the transferred lot
          date: lot.date, // Keep original purchase date for holding period
          shares: sharesToTake,
          remainingShares: sharesToTake
        });
        lot.remainingShares = new Big(0);
      } else {
        // Partial transfer - create new lot with portion of original
        transferredLots.push({
          id: randomUUID(),
          date: lot.date,
          shares: sharesToTake,
          costPerShare: lot.costPerShare,
          totalCost: transferValue,
          remainingShares: sharesToTake,
          fees: lot.fees.times(sharesToTake).div(lot.shares) // Proportional fees
        });
        lot.remainingShares = lot.remainingShares.minus(sharesToTake);
      }

      remaining = remaining.minus(sharesToTake);
    }

    return transferredLots;
  }

  /**
   * Get cost basis summary for a security
   *
   * @param securityId - The security to summarize
   * @param currentPrice - Current market price per share
   * @returns Summary including total shares, cost basis, and unrealized gains
   */
  public getCostBasisSummary(
    securityId: string,
    currentPrice: Big
  ): PPCostBasisSummary {
    const securityLots = this.lots.get(securityId) || [];
    const activeLots = securityLots.filter((lot) => lot.remainingShares.gt(0));

    const totalShares = activeLots.reduce(
      (sum, lot) => sum.plus(lot.remainingShares),
      new Big(0)
    );

    const totalCostBasis = activeLots.reduce(
      (sum, lot) => sum.plus(lot.remainingShares.times(lot.costPerShare)),
      new Big(0)
    );

    const averageCostPerShare = totalShares.gt(0)
      ? totalCostBasis.div(totalShares)
      : new Big(0);

    const currentValue = totalShares.times(currentPrice);
    const unrealizedGain = currentValue.minus(totalCostBasis);
    const unrealizedGainPercent = totalCostBasis.gt(0)
      ? unrealizedGain.div(totalCostBasis).times(100).toNumber()
      : 0;

    return {
      totalShares,
      totalCostBasis,
      averageCostPerShare,
      lots: activeLots,
      unrealizedGain,
      unrealizedGainPercent
    };
  }

  /**
   * Get all lots for a security (including exhausted ones)
   */
  public getAllLots(securityId: string): PPPurchaseLot[] {
    return this.lots.get(securityId) || [];
  }

  /**
   * Get active lots for a security (with remaining shares)
   */
  public getActiveLots(securityId: string): PPPurchaseLot[] {
    const allLots = this.lots.get(securityId) || [];
    return allLots.filter((lot) => lot.remainingShares.gt(0));
  }

  /**
   * Calculate total realized gains across all sales for a security
   */
  public getTotalRealizedGains(securityId: string): Big {
    const allLots = this.lots.get(securityId) || [];
    // Realized gains would need to be tracked separately during sales
    // This is a placeholder - actual implementation would need sale history
    return new Big(0);
  }

  /**
   * Get holding period for the oldest remaining lot
   * Useful for determining long-term vs short-term capital gains
   */
  public getOldestHoldingPeriodDays(
    securityId: string,
    asOfDate: Date
  ): number | null {
    const activeLots = this.getActiveLots(securityId);

    if (activeLots.length === 0) {
      return null;
    }

    // Lots are already sorted by date (FIFO order)
    const oldestLot = activeLots[0];
    const diffTime = asOfDate.getTime() - oldestLot.date.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if holding qualifies for long-term capital gains
   * For India: >24 months for equity, >36 months for other assets
   * For US: >12 months
   */
  public isLongTermHolding(
    securityId: string,
    asOfDate: Date,
    longTermThresholdDays: number = 365
  ): boolean {
    const holdingPeriod = this.getOldestHoldingPeriodDays(securityId, asOfDate);
    return holdingPeriod !== null && holdingPeriod > longTermThresholdDays;
  }

  /**
   * Clear all data (useful for testing or recalculation)
   */
  public clear(): void {
    this.lots.clear();
  }

  /**
   * Clear data for a specific security
   */
  public clearSecurity(securityId: string): void {
    this.lots.delete(securityId);
  }

  /**
   * Get all tracked securities
   */
  public getTrackedSecurities(): string[] {
    return Array.from(this.lots.keys());
  }
}
