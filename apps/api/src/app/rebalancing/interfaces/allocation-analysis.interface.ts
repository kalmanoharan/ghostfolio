export interface AllocationAnalysis {
  portfolioValue: number;
  baseCurrency: string;
  strategyId: string;
  strategyName: string;
  driftThreshold: number;
  overallStatus: 'OK' | 'WARNING' | 'CRITICAL';
  maxDrift: number;
  assetClassAllocations: AssetClassAllocation[];
  excludedHoldings: ExcludedHolding[];
}

export interface AssetClassAllocation {
  assetClass: string;
  targetPercent: number;
  targetValue: number;
  actualPercent: number;
  actualValue: number;
  driftPercent: number;
  driftValue: number;
  driftStatus: 'OK' | 'WARNING' | 'CRITICAL';
  subClassAllocations: SubClassAllocation[];
  holdings: HoldingAllocation[];
}

export interface SubClassAllocation {
  assetSubClass: string;
  targetPercentOfParent: number;
  targetPercentOfTotal: number;
  targetValue: number;
  actualPercentOfParent: number;
  actualPercentOfTotal: number;
  actualValue: number;
  driftPercent: number;
  driftValue: number;
  driftStatus: 'OK' | 'WARNING' | 'CRITICAL';
  holdings: HoldingAllocation[];
}

export interface HoldingAllocation {
  symbol: string;
  name: string;
  dataSource: string;
  symbolProfileId: string;
  shares: number;
  price: number;
  value: number;
  percentOfSubClass: number;
  percentOfAssetClass: number;
  percentOfTotal: number;
  isExcluded: boolean;
  neverSell: boolean;
}

export interface ExcludedHolding {
  symbol: string;
  name: string;
  value: number;
  excludeFromCalculation: boolean;
  neverSell: boolean;
}

export interface DriftSummary {
  hasActiveStrategy: boolean;
  strategyName?: string;
  overallStatus: 'OK' | 'WARNING' | 'CRITICAL' | 'NO_STRATEGY';
  maxDrift: number;
  driftThreshold: number;
  categoriesOverThreshold: CategoryDrift[];
}

export interface CategoryDrift {
  name: string;
  drift: number;
  type: 'OVER' | 'UNDER';
}

