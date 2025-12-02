export interface RebalancingSuggestion {
  action: 'BUY' | 'SELL';
  assetClass: string;
  assetSubClass: string;
  symbol?: string;
  name?: string;
  dataSource?: string;
  symbolProfileId?: string;
  currentShares?: number;
  currentValue?: number;
  suggestedAmount: number;
  suggestedShares?: number;
  sharePrice?: number;
  reason: string;
  priority: number;
  targetPercentAfter: number;
  driftAfter: number;
}

