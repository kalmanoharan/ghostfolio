import { Injectable } from '@nestjs/common';
import Big from 'big.js';

import {
  HoldingForRebalancing,
  PPRebalancingResult,
  PPRebalancingTarget,
  PPTaxonomy,
  PPTaxonomyNode,
  RebalancingOptions
} from './interfaces';

/**
 * Rebalancing Service
 *
 * Reference: Portfolio Performance's rebalancing view
 * See: Taxonomy.java, Classification.java
 *
 * Calculates the difference between target and actual allocations
 * and suggests trades to bring the portfolio back to target.
 *
 * Supports two modes:
 * 1. Asset Class mode: Use Ghostfolio's existing asset class/sub-class hierarchy
 * 2. Taxonomy mode: PP-style custom hierarchical classifications
 */
@Injectable()
export class PPRebalancingService {
  /**
   * Calculate rebalancing needs based on target allocations
   *
   * @param holdings - Current holdings with category assignments
   * @param targets - Target allocations for each category
   * @param options - Rebalancing options
   * @returns Array of rebalancing results per category
   */
  public calculateRebalancing(
    holdings: HoldingForRebalancing[],
    targets: PPRebalancingTarget[],
    options: RebalancingOptions = {}
  ): PPRebalancingResult[] {
    const {
      newInvestment = new Big(0),
      minimumTradeSize = new Big(0),
      allowSelling = true
    } = options;

    // Calculate total portfolio value
    const currentTotalValue = holdings.reduce(
      (sum, h) => sum.plus(h.marketValue),
      new Big(0)
    );

    // Effective total includes new investment
    const effectiveTotalValue = currentTotalValue.plus(newInvestment);

    // Group holdings by category
    const holdingsByCategory = new Map<string, HoldingForRebalancing[]>();
    for (const holding of holdings) {
      const categoryHoldings =
        holdingsByCategory.get(holding.categoryId) || [];
      categoryHoldings.push(holding);
      holdingsByCategory.set(holding.categoryId, categoryHoldings);
    }

    // Calculate results for each target
    const results: PPRebalancingResult[] = [];

    for (const target of targets) {
      const categoryHoldings = holdingsByCategory.get(target.categoryId) || [];

      const actualValue = categoryHoldings.reduce(
        (sum, h) => sum.plus(h.marketValue),
        new Big(0)
      );

      const actualAllocation = currentTotalValue.gt(0)
        ? actualValue.div(currentTotalValue).toNumber()
        : 0;

      const targetValue = effectiveTotalValue.times(target.targetAllocation);
      const delta = targetValue.minus(actualValue);
      const deltaPercent = (target.targetAllocation - actualAllocation) * 100;

      // Determine action
      let action: 'BUY' | 'SELL' | 'HOLD';
      if (delta.abs().lt(minimumTradeSize)) {
        action = 'HOLD';
      } else if (delta.lt(0)) {
        action = allowSelling ? 'SELL' : 'HOLD';
      } else {
        action = 'BUY';
      }

      // Build securities list for this category
      const securities = categoryHoldings.map((h) => ({
        symbol: h.symbol,
        name: h.name,
        currentValue: h.marketValue,
        percentOfCategory: actualValue.gt(0)
          ? h.marketValue.div(actualValue).times(100).toNumber()
          : 0
      }));

      results.push({
        categoryId: target.categoryId,
        categoryName: target.categoryName,
        targetAllocation: target.targetAllocation,
        actualAllocation,
        targetValue,
        actualValue,
        delta,
        deltaPercent,
        action,
        securities
      });
    }

    // Sort by absolute delta (largest deviation first)
    results.sort((a, b) => b.delta.abs().toNumber() - a.delta.abs().toNumber());

    return results;
  }

  /**
   * Calculate rebalancing using a PP-style taxonomy
   * Handles hierarchical classifications with weighted assignments
   *
   * @param holdings - Current holdings
   * @param taxonomy - PP-style taxonomy with hierarchy and assignments
   * @param options - Rebalancing options
   */
  public calculateRebalancingWithTaxonomy(
    holdings: HoldingForRebalancing[],
    taxonomy: PPTaxonomy,
    options: RebalancingOptions = {}
  ): PPRebalancingResult[] {
    // Build a map of symbol -> market value
    const holdingValues = new Map<string, Big>();
    for (const h of holdings) {
      holdingValues.set(h.symbol, h.marketValue);
    }

    // Calculate total portfolio value
    const totalValue = holdings.reduce(
      (sum, h) => sum.plus(h.marketValue),
      new Big(0)
    );

    const effectiveTotal = totalValue.plus(options.newInvestment || new Big(0));

    // Process taxonomy tree
    const results: PPRebalancingResult[] = [];
    this.processNode(
      taxonomy.root,
      holdingValues,
      totalValue,
      effectiveTotal,
      options,
      results
    );

    return results;
  }

  /**
   * Process a taxonomy node recursively
   */
  private processNode(
    node: PPTaxonomyNode,
    holdingValues: Map<string, Big>,
    totalValue: Big,
    effectiveTotal: Big,
    options: RebalancingOptions,
    results: PPRebalancingResult[]
  ): Big {
    let nodeActualValue = new Big(0);

    // Calculate value from direct assignments
    for (const assignment of node.assignments) {
      const holdingValue = holdingValues.get(assignment.symbol) || new Big(0);
      // Apply assignment weight (weight is 0-10000 for 0-100%)
      const weightFraction = assignment.weight / 10000;
      nodeActualValue = nodeActualValue.plus(
        holdingValue.times(weightFraction)
      );
    }

    // Add values from children
    for (const child of node.children) {
      const childValue = this.processNode(
        child,
        holdingValues,
        totalValue,
        effectiveTotal,
        options,
        results
      );
      // Apply child's weight to parent
      const childWeightFraction = child.weight / 10000;
      nodeActualValue = nodeActualValue.plus(
        childValue.times(childWeightFraction)
      );
    }

    // Calculate target allocation based on node weight
    const targetAllocation = node.weight / 10000;
    const targetValue = effectiveTotal.times(targetAllocation);

    const actualAllocation = totalValue.gt(0)
      ? nodeActualValue.div(totalValue).toNumber()
      : 0;

    const delta = targetValue.minus(nodeActualValue);
    const deltaPercent = (targetAllocation - actualAllocation) * 100;

    const minimumTradeSize = options.minimumTradeSize || new Big(0);
    const allowSelling = options.allowSelling !== false;

    let action: 'BUY' | 'SELL' | 'HOLD';
    if (delta.abs().lt(minimumTradeSize)) {
      action = 'HOLD';
    } else if (delta.lt(0)) {
      action = allowSelling ? 'SELL' : 'HOLD';
    } else {
      action = 'BUY';
    }

    // Build securities list from assignments
    const securities = node.assignments.map((assignment) => {
      const value = holdingValues.get(assignment.symbol) || new Big(0);
      const weightedValue = value.times(assignment.weight / 10000);
      return {
        symbol: assignment.symbol,
        name: assignment.symbol, // Would need lookup for actual name
        currentValue: weightedValue,
        percentOfCategory: nodeActualValue.gt(0)
          ? weightedValue.div(nodeActualValue).times(100).toNumber()
          : 0
      };
    });

    // Only add leaf nodes or nodes with assignments to results
    if (node.assignments.length > 0 || node.children.length === 0) {
      results.push({
        categoryId: node.id,
        categoryName: node.name,
        targetAllocation,
        actualAllocation,
        targetValue,
        actualValue: nodeActualValue,
        delta,
        deltaPercent,
        action,
        securities
      });
    }

    return nodeActualValue;
  }

  /**
   * Calculate how to invest new money to move toward targets
   *
   * @param newAmount - Amount to invest
   * @param rebalancingResults - Current rebalancing state
   * @returns Suggested allocation of new money
   */
  public suggestNewInvestmentAllocation(
    newAmount: Big,
    rebalancingResults: PPRebalancingResult[]
  ): Array<{
    categoryId: string;
    categoryName: string;
    amount: Big;
    percent: number;
  }> {
    // Find underweight categories (positive delta = need to buy)
    const underweight = rebalancingResults.filter((r) => r.delta.gt(0));

    if (underweight.length === 0) {
      // All at or above target - distribute proportionally to targets
      return rebalancingResults.map((r) => ({
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        amount: newAmount.times(r.targetAllocation),
        percent: r.targetAllocation * 100
      }));
    }

    // Allocate to underweight categories proportionally to their shortfall
    const totalShortfall = underweight.reduce(
      (sum, r) => sum.plus(r.delta),
      new Big(0)
    );

    const suggestions = underweight.map((r) => {
      const proportion = r.delta.div(totalShortfall);
      // Don't allocate more than the shortfall
      const amount = newAmount.times(proportion).lt(r.delta)
        ? newAmount.times(proportion)
        : r.delta;

      return {
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        amount,
        percent: newAmount.gt(0)
          ? amount.div(newAmount).times(100).toNumber()
          : 0
      };
    });

    // Calculate remaining amount after proportional allocation
    const allocated = suggestions.reduce(
      (sum, s) => sum.plus(s.amount),
      new Big(0)
    );
    const remaining = newAmount.minus(allocated);

    // Add remaining to largest underweight category
    if (remaining.gt(0) && suggestions.length > 0) {
      // Sort by delta (largest shortfall first) and add remaining there
      suggestions.sort((a, b) => {
        const deltaA =
          underweight.find((u) => u.categoryId === a.categoryId)?.delta ||
          new Big(0);
        const deltaB =
          underweight.find((u) => u.categoryId === b.categoryId)?.delta ||
          new Big(0);
        return deltaB.minus(deltaA).toNumber();
      });

      suggestions[0].amount = suggestions[0].amount.plus(remaining);
      suggestions[0].percent = newAmount.gt(0)
        ? suggestions[0].amount.div(newAmount).times(100).toNumber()
        : 0;
    }

    return suggestions;
  }

  /**
   * Generate specific trade recommendations
   *
   * @param rebalancingResults - Rebalancing calculation results
   * @param holdingPrices - Map of symbol to current price
   * @returns List of recommended trades
   */
  public generateTradeRecommendations(
    rebalancingResults: PPRebalancingResult[],
    holdingPrices: Map<string, Big>
  ): Array<{
    categoryId: string;
    categoryName: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    amount: Big;
    shares: Big;
    currentPrice: Big;
  }> {
    const trades: Array<{
      categoryId: string;
      categoryName: string;
      symbol: string;
      action: 'BUY' | 'SELL';
      amount: Big;
      shares: Big;
      currentPrice: Big;
    }> = [];

    for (const result of rebalancingResults) {
      if (result.action === 'HOLD') {
        continue;
      }

      // For each category, distribute the delta among its securities
      const amountToTrade = result.delta.abs();

      // Simple approach: if single security, trade that
      // If multiple, distribute proportionally
      if (result.securities.length === 1) {
        const security = result.securities[0];
        const price = holdingPrices.get(security.symbol) || new Big(1);
        const shares = amountToTrade.div(price).round(4, Big.roundDown);

        if (shares.gt(0)) {
          trades.push({
            categoryId: result.categoryId,
            categoryName: result.categoryName,
            symbol: security.symbol,
            action: result.action,
            amount: amountToTrade,
            shares,
            currentPrice: price
          });
        }
      } else if (result.securities.length > 1) {
        // Distribute proportionally based on current allocation within category
        for (const security of result.securities) {
          const proportion = security.percentOfCategory / 100;
          const securityAmount = amountToTrade.times(proportion);
          const price = holdingPrices.get(security.symbol) || new Big(1);
          const shares = securityAmount.div(price).round(4, Big.roundDown);

          if (shares.gt(0)) {
            trades.push({
              categoryId: result.categoryId,
              categoryName: result.categoryName,
              symbol: security.symbol,
              action: result.action,
              amount: securityAmount,
              shares,
              currentPrice: price
            });
          }
        }
      }
    }

    return trades;
  }

  /**
   * Validate that target allocations sum to 100% (or less)
   */
  public validateTargets(targets: PPRebalancingTarget[]): {
    valid: boolean;
    totalAllocation: number;
    message: string;
  } {
    const totalAllocation = targets.reduce(
      (sum, t) => sum + t.targetAllocation,
      0
    );

    if (totalAllocation > 1.0001) {
      // Allow small floating point error
      return {
        valid: false,
        totalAllocation,
        message: `Target allocations sum to ${(totalAllocation * 100).toFixed(2)}%, which exceeds 100%`
      };
    }

    if (totalAllocation < 0.9999) {
      return {
        valid: true,
        totalAllocation,
        message: `Target allocations sum to ${(totalAllocation * 100).toFixed(2)}%. ${((1 - totalAllocation) * 100).toFixed(2)}% is unallocated.`
      };
    }

    return {
      valid: true,
      totalAllocation,
      message: 'Target allocations are valid'
    };
  }
}
