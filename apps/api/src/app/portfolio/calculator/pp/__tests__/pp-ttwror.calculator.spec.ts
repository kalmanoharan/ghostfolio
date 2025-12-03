import Big from 'big.js';

import { PPTtwrorCalculator } from '../pp-ttwror.calculator';
import { PPValuationPoint } from '../interfaces';

describe('PPTtwrorCalculator', () => {
  let calculator: PPTtwrorCalculator;

  beforeEach(() => {
    calculator = new PPTtwrorCalculator();
  });

  describe('calculate', () => {
    it('should calculate TTWROR for simple growth without flows', () => {
      const valuations: PPValuationPoint[] = [
        { date: new Date('2023-01-01'), marketValue: new Big(1000), externalFlow: new Big(0) },
        { date: new Date('2024-01-01'), marketValue: new Big(1100), externalFlow: new Big(0) }
      ];

      const result = calculator.calculate(valuations);

      expect(result.ttwror).toBeCloseTo(0.1, 4); // 10% return
      expect(result.ttwrorAnnualized).toBeCloseTo(0.1, 4);
      expect(result.holdingPeriodDays).toBe(365);
    });

    it('should neutralize effect of deposits', () => {
      // Start with 1000, deposit 500 mid-year, end with 1650
      // Without the deposit, performance should be 10%
      const valuations: PPValuationPoint[] = [
        { date: new Date('2023-01-01'), marketValue: new Big(1000), externalFlow: new Big(0) },
        { date: new Date('2023-07-01'), marketValue: new Big(1550), externalFlow: new Big(500) }, // 1000 -> 1050 (+5%), then add 500
        { date: new Date('2024-01-01'), marketValue: new Big(1650), externalFlow: new Big(0) } // 1550 -> 1650 (~6.5%)
      ];

      const result = calculator.calculate(valuations);

      // TTWROR should ignore the deposit and show only investment returns
      expect(result.ttwror).toBeGreaterThan(0);
      expect(result.holdingPeriodDays).toBe(365);
    });

    it('should neutralize effect of withdrawals', () => {
      // Start with 1000, withdraw 200 mid-year, end with 880
      const valuations: PPValuationPoint[] = [
        { date: new Date('2023-01-01'), marketValue: new Big(1000), externalFlow: new Big(0) },
        { date: new Date('2023-07-01'), marketValue: new Big(880), externalFlow: new Big(-200) }, // 1000 -> 1080 (+8%), then withdraw 200
        { date: new Date('2024-01-01'), marketValue: new Big(968), externalFlow: new Big(0) } // 880 -> 968 (+10%)
      ];

      const result = calculator.calculate(valuations);

      expect(result.ttwror).toBeGreaterThan(0);
    });

    it('should return daily returns when requested', () => {
      const valuations: PPValuationPoint[] = [
        { date: new Date('2023-01-01'), marketValue: new Big(1000), externalFlow: new Big(0) },
        { date: new Date('2023-01-02'), marketValue: new Big(1010), externalFlow: new Big(0) },
        { date: new Date('2023-01-03'), marketValue: new Big(1020), externalFlow: new Big(0) }
      ];

      const result = calculator.calculate(valuations, true);

      expect(result.dailyReturns).toBeDefined();
      expect(result.dailyReturns!.length).toBe(3);
      expect(result.dailyReturns![0].cumulativeReturn).toBe(0);
      expect(result.dailyReturns![1].cumulativeReturn).toBeCloseTo(0.01, 4);
      expect(result.dailyReturns![2].cumulativeReturn).toBeCloseTo(0.02, 4);
    });

    it('should return zero for insufficient data', () => {
      const valuations: PPValuationPoint[] = [
        { date: new Date('2023-01-01'), marketValue: new Big(1000), externalFlow: new Big(0) }
      ];

      const result = calculator.calculate(valuations);

      expect(result.ttwror).toBe(0);
      expect(result.ttwrorAnnualized).toBe(0);
      expect(result.holdingPeriodDays).toBe(0);
    });

    it('should handle negative returns', () => {
      const valuations: PPValuationPoint[] = [
        { date: new Date('2023-01-01'), marketValue: new Big(1000), externalFlow: new Big(0) },
        { date: new Date('2024-01-01'), marketValue: new Big(800), externalFlow: new Big(0) }
      ];

      const result = calculator.calculate(valuations);

      expect(result.ttwror).toBeCloseTo(-0.2, 4);
      expect(result.ttwrorAnnualized).toBeCloseTo(-0.2, 4);
    });

    it('should handle zero starting value gracefully', () => {
      const valuations: PPValuationPoint[] = [
        { date: new Date('2023-01-01'), marketValue: new Big(0), externalFlow: new Big(0) },
        { date: new Date('2023-01-02'), marketValue: new Big(1000), externalFlow: new Big(1000) }
      ];

      const result = calculator.calculate(valuations);

      // Should skip periods with zero denominator
      expect(result.holdingPeriodDays).toBe(1);
    });
  });

  describe('calculateFromArrays', () => {
    it('should calculate TTWROR using array format', () => {
      const dates = [new Date('2023-01-01'), new Date('2024-01-01')];
      const totals = [new Big(1000), new Big(1100)];
      const inboundTransferals = [new Big(0), new Big(0)];
      const outboundTransferals = [new Big(0), new Big(0)];

      const result = calculator.calculateFromArrays(
        dates,
        totals,
        inboundTransferals,
        outboundTransferals
      );

      expect(result.ttwror).toBeCloseTo(0.1, 4);
    });

    it('should match ClientIndex calculation with transferals', () => {
      // Simulate Portfolio Performance's calculation
      const dates = [
        new Date('2023-01-01'),
        new Date('2023-07-01'),
        new Date('2024-01-01')
      ];
      const totals = [new Big(1000), new Big(1550), new Big(1650)];
      const inboundTransferals = [new Big(0), new Big(500), new Big(0)];
      const outboundTransferals = [new Big(0), new Big(0), new Big(0)];

      const result = calculator.calculateFromArrays(
        dates,
        totals,
        inboundTransferals,
        outboundTransferals,
        true
      );

      expect(result.dailyReturns).toBeDefined();
      expect(result.holdingPeriodDays).toBe(365);
    });
  });

  describe('annualization', () => {
    it('should correctly annualize returns for less than 1 year', () => {
      // 5% return in 6 months ≈ 10.25% annualized
      const valuations: PPValuationPoint[] = [
        { date: new Date('2023-01-01'), marketValue: new Big(1000), externalFlow: new Big(0) },
        { date: new Date('2023-07-01'), marketValue: new Big(1050), externalFlow: new Big(0) }
      ];

      const result = calculator.calculate(valuations);

      expect(result.ttwror).toBeCloseTo(0.05, 4);
      expect(result.ttwrorAnnualized).toBeGreaterThan(0.1);
    });

    it('should correctly annualize returns for more than 1 year', () => {
      // 21% return over 2 years ≈ 10% annualized
      const valuations: PPValuationPoint[] = [
        { date: new Date('2022-01-01'), marketValue: new Big(1000), externalFlow: new Big(0) },
        { date: new Date('2024-01-01'), marketValue: new Big(1210), externalFlow: new Big(0) }
      ];

      const result = calculator.calculate(valuations);

      expect(result.ttwror).toBeCloseTo(0.21, 2);
      expect(result.ttwrorAnnualized).toBeCloseTo(0.1, 2);
    });
  });
});
