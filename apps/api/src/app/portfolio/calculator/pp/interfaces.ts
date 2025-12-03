import Big from 'big.js';

/**
 * Cash flow for IRR/TTWROR calculations
 * Convention: Negative = money out (buy/deposit), Positive = money in (sell/dividend)
 */
export interface PPCashFlow {
  date: Date;
  amount: Big;
  type?: 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL' | 'FEE' | 'TAX';
}

/**
 * Daily valuation point for TTWROR calculation
 */
export interface PPValuationPoint {
  date: Date;
  marketValue: Big;
  externalFlow: Big; // Net external flow on this day (deposits - withdrawals)
}

/**
 * Result of IRR calculation
 */
export interface PPIrrResult {
  /** IRR for the holding period (not annualized) */
  irr: number | null;
  /** Annualized IRR */
  irrAnnualized: number | null;
  /** Whether the Newton-Raphson method converged */
  converged: boolean;
  /** Number of iterations used */
  iterations: number;
}

/**
 * Result of TTWROR calculation
 */
export interface PPTtwrorResult {
  /** Cumulative TTWROR for the period */
  ttwror: number;
  /** Annualized TTWROR */
  ttwrorAnnualized: number;
  /** Number of days in the period */
  holdingPeriodDays: number;
  /** Daily returns for charting */
  dailyReturns?: Array<{ date: Date; cumulativeReturn: number }>;
}

/**
 * Purchase lot for FIFO tracking
 */
export interface PPPurchaseLot {
  id: string;
  date: Date;
  shares: Big;
  costPerShare: Big;
  totalCost: Big;
  remainingShares: Big;
  fees: Big;
}

/**
 * Result of a sale using FIFO
 */
export interface PPSaleResult {
  sharesSold: Big;
  totalCostBasis: Big;
  totalProceeds: Big;
  realizedGain: Big;
  realizedGainPercent: number;
  lotsUsed: Array<{
    lotId: string;
    lotDate: Date;
    sharesSold: Big;
    costBasis: Big;
  }>;
}

/**
 * Cost basis summary for a holding
 */
export interface PPCostBasisSummary {
  totalShares: Big;
  totalCostBasis: Big;
  averageCostPerShare: Big;
  lots: PPPurchaseLot[];
  unrealizedGain: Big;
  unrealizedGainPercent: number;
}

/**
 * Rebalancing target for a category
 */
export interface PPRebalancingTarget {
  categoryId: string;
  categoryName: string;
  targetAllocation: number; // 0.0 to 1.0
}

/**
 * Rebalancing result for a category
 */
export interface PPRebalancingResult {
  categoryId: string;
  categoryName: string;
  targetAllocation: number;
  actualAllocation: number;
  targetValue: Big;
  actualValue: Big;
  delta: Big;
  deltaPercent: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  securities: Array<{
    symbol: string;
    name: string;
    currentValue: Big;
    percentOfCategory: number;
  }>;
}

/**
 * Combined PP performance metrics
 */
export interface PPPerformanceMetrics {
  irr: PPIrrResult;
  ttwror: PPTtwrorResult;
  capitalGains: {
    realized: Big;
    unrealized: Big;
    total: Big;
  };
  dividends: Big;
  fees: Big;
  taxes: Big;
  absolutePerformance: Big;
  absolutePerformancePercent: number;
}

/**
 * Holding data for rebalancing calculations
 */
export interface HoldingForRebalancing {
  symbol: string;
  name: string;
  categoryId: string;
  marketValue: Big;
}

/**
 * Options for rebalancing calculations
 */
export interface RebalancingOptions {
  /** Amount of new money to invest (optional) */
  newInvestment?: Big;
  /** Minimum trade size to suggest (avoid tiny rebalancing trades) */
  minimumTradeSize?: Big;
  /** Whether to suggest sells or only buys */
  allowSelling?: boolean;
}

/**
 * Taxonomy node for PP-style hierarchical classification
 */
export interface PPTaxonomyNode {
  id: string;
  name: string;
  color?: string;
  weight: number; // 0 to 10000 (represents 0% to 100% with 2 decimal precision)
  parentId?: string;
  children: PPTaxonomyNode[];
  assignments: PPTaxonomyAssignment[];
}

/**
 * Assignment of a security to a taxonomy classification
 */
export interface PPTaxonomyAssignment {
  symbol: string;
  weight: number; // 0 to 10000 (partial assignment support)
}

/**
 * Complete taxonomy structure
 */
export interface PPTaxonomy {
  id: string;
  name: string;
  root: PPTaxonomyNode;
}
