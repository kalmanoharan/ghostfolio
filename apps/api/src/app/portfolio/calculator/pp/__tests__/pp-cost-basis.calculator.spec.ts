import Big from 'big.js';

import { PPCostBasisCalculator } from '../pp-cost-basis.calculator';

describe('PPCostBasisCalculator', () => {
  let calculator: PPCostBasisCalculator;

  beforeEach(() => {
    calculator = new PPCostBasisCalculator();
  });

  describe('addPurchase', () => {
    it('should add a purchase lot', () => {
      const lot = calculator.addPurchase(
        'AAPL',
        new Date('2023-01-01'),
        new Big(10),
        new Big(1500),
        new Big(10)
      );

      expect(lot.shares.toNumber()).toBe(10);
      expect(lot.totalCost.toNumber()).toBe(1500);
      expect(lot.costPerShare.toNumber()).toBe(150);
      expect(lot.remainingShares.toNumber()).toBe(10);
      expect(lot.fees.toNumber()).toBe(10);
    });

    it('should maintain FIFO order when adding lots', () => {
      calculator.addPurchase('AAPL', new Date('2023-03-01'), new Big(10), new Big(1600));
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1400));
      calculator.addPurchase('AAPL', new Date('2023-02-01'), new Big(10), new Big(1500));

      const lots = calculator.getAllLots('AAPL');

      expect(lots.length).toBe(3);
      expect(lots[0].date).toEqual(new Date('2023-01-01'));
      expect(lots[1].date).toEqual(new Date('2023-02-01'));
      expect(lots[2].date).toEqual(new Date('2023-03-01'));
    });
  });

  describe('processSale', () => {
    it('should process a complete sale of first lot using FIFO', () => {
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1000));
      calculator.addPurchase('AAPL', new Date('2023-02-01'), new Big(10), new Big(1200));

      const result = calculator.processSale(
        'AAPL',
        new Big(10),
        new Big(120),
        new Date('2023-03-01')
      );

      expect(result.sharesSold.toNumber()).toBe(10);
      expect(result.totalCostBasis.toNumber()).toBe(1000);
      expect(result.totalProceeds.toNumber()).toBe(1200);
      expect(result.realizedGain.toNumber()).toBe(200);
      expect(result.realizedGainPercent).toBeCloseTo(20, 1);
      expect(result.lotsUsed.length).toBe(1);
      expect(result.lotsUsed[0].lotDate).toEqual(new Date('2023-01-01'));
    });

    it('should process a sale spanning multiple lots', () => {
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1000)); // $100/share
      calculator.addPurchase('AAPL', new Date('2023-02-01'), new Big(10), new Big(1200)); // $120/share

      const result = calculator.processSale(
        'AAPL',
        new Big(15),
        new Big(130),
        new Date('2023-03-01')
      );

      expect(result.sharesSold.toNumber()).toBe(15);
      // Cost basis: 10 shares @ $100 + 5 shares @ $120 = $1000 + $600 = $1600
      expect(result.totalCostBasis.toNumber()).toBe(1600);
      // Proceeds: 15 shares @ $130 = $1950
      expect(result.totalProceeds.toNumber()).toBe(1950);
      expect(result.realizedGain.toNumber()).toBe(350);
      expect(result.lotsUsed.length).toBe(2);
    });

    it('should handle sale with loss', () => {
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1500));

      const result = calculator.processSale(
        'AAPL',
        new Big(10),
        new Big(100),
        new Date('2023-03-01')
      );

      expect(result.sharesSold.toNumber()).toBe(10);
      expect(result.totalProceeds.toNumber()).toBe(1000);
      expect(result.realizedGain.toNumber()).toBe(-500);
      expect(result.realizedGainPercent).toBeCloseTo(-33.33, 1);
    });

    it('should only sell available shares', () => {
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1000));

      const result = calculator.processSale(
        'AAPL',
        new Big(15),
        new Big(120),
        new Date('2023-03-01')
      );

      expect(result.sharesSold.toNumber()).toBe(10); // Only 10 available
    });
  });

  describe('getCostBasisSummary', () => {
    it('should calculate correct summary with multiple lots', () => {
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1000)); // $100/share
      calculator.addPurchase('AAPL', new Date('2023-02-01'), new Big(10), new Big(1200)); // $120/share

      const summary = calculator.getCostBasisSummary('AAPL', new Big(130));

      expect(summary.totalShares.toNumber()).toBe(20);
      expect(summary.totalCostBasis.toNumber()).toBe(2200);
      expect(summary.averageCostPerShare.toNumber()).toBe(110);
      expect(summary.lots.length).toBe(2);
      // Unrealized gain: (20 * 130) - 2200 = 2600 - 2200 = 400
      expect(summary.unrealizedGain.toNumber()).toBe(400);
      expect(summary.unrealizedGainPercent).toBeCloseTo(18.18, 1);
    });

    it('should exclude exhausted lots from summary', () => {
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1000));
      calculator.addPurchase('AAPL', new Date('2023-02-01'), new Big(10), new Big(1200));

      // Sell all of first lot
      calculator.processSale('AAPL', new Big(10), new Big(120), new Date('2023-03-01'));

      const summary = calculator.getCostBasisSummary('AAPL', new Big(130));

      expect(summary.totalShares.toNumber()).toBe(10);
      expect(summary.totalCostBasis.toNumber()).toBe(1200);
      expect(summary.lots.length).toBe(1);
    });

    it('should handle unrealized loss', () => {
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1500));

      const summary = calculator.getCostBasisSummary('AAPL', new Big(100));

      expect(summary.unrealizedGain.toNumber()).toBe(-500);
      expect(summary.unrealizedGainPercent).toBeCloseTo(-33.33, 1);
    });
  });

  describe('getOldestHoldingPeriodDays', () => {
    it('should return correct holding period', () => {
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1000));
      calculator.addPurchase('AAPL', new Date('2023-06-01'), new Big(10), new Big(1100));

      const days = calculator.getOldestHoldingPeriodDays('AAPL', new Date('2024-01-01'));

      expect(days).toBe(365);
    });

    it('should return null for no holdings', () => {
      const days = calculator.getOldestHoldingPeriodDays('AAPL', new Date('2024-01-01'));

      expect(days).toBeNull();
    });

    it('should update when oldest lot is sold', () => {
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1000));
      calculator.addPurchase('AAPL', new Date('2023-07-01'), new Big(10), new Big(1100));

      // Sell the oldest lot
      calculator.processSale('AAPL', new Big(10), new Big(120), new Date('2023-08-01'));

      const days = calculator.getOldestHoldingPeriodDays('AAPL', new Date('2024-01-01'));

      // Now oldest holding is from July
      expect(days).toBe(184); // Approximately 6 months
    });
  });

  describe('isLongTermHolding', () => {
    it('should identify long-term holding (>365 days)', () => {
      calculator.addPurchase('AAPL', new Date('2022-01-01'), new Big(10), new Big(1000));

      const isLongTerm = calculator.isLongTermHolding('AAPL', new Date('2024-01-01'), 365);

      expect(isLongTerm).toBe(true);
    });

    it('should identify short-term holding (<365 days)', () => {
      calculator.addPurchase('AAPL', new Date('2023-07-01'), new Big(10), new Big(1000));

      const isLongTerm = calculator.isLongTermHolding('AAPL', new Date('2024-01-01'), 365);

      expect(isLongTerm).toBe(false);
    });
  });

  describe('processTransfer', () => {
    it('should transfer shares between portfolios', () => {
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1000));

      const transferred = calculator.processTransfer('AAPL', new Big(5), new Date('2023-06-01'));

      expect(transferred.length).toBe(1);
      expect(transferred[0].shares.toNumber()).toBe(5);

      const remaining = calculator.getCostBasisSummary('AAPL', new Big(100));
      expect(remaining.totalShares.toNumber()).toBe(5);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      calculator.addPurchase('AAPL', new Date('2023-01-01'), new Big(10), new Big(1000));
      calculator.addPurchase('GOOGL', new Date('2023-01-01'), new Big(5), new Big(5000));

      calculator.clear();

      expect(calculator.getTrackedSecurities().length).toBe(0);
    });
  });
});
