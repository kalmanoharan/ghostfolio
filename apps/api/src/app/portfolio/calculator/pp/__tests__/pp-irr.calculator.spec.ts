import Big from 'big.js';

import { PPIrrCalculator } from '../pp-irr.calculator';

describe('PPIrrCalculator', () => {
  let calculator: PPIrrCalculator;

  beforeEach(() => {
    calculator = new PPIrrCalculator();
  });

  describe('calculate', () => {
    it('should calculate IRR for simple investment with 10% gain over 1 year', () => {
      // Invest 1000, grows to 1100 in 1 year = 10% return
      const cashFlows = [
        { date: new Date('2023-01-01'), amount: new Big(-1000) }
      ];
      const endValue = new Big(1100);
      const endDate = new Date('2024-01-01');

      const result = calculator.calculate(cashFlows, endValue, endDate);

      expect(result.converged).toBe(true);
      expect(result.irrAnnualized).toBeCloseTo(0.1, 2);
    });

    it('should calculate IRR for investment with 20% loss', () => {
      // Invest 1000, drops to 800 in 1 year = -20% return
      const cashFlows = [
        { date: new Date('2023-01-01'), amount: new Big(-1000) }
      ];
      const endValue = new Big(800);
      const endDate = new Date('2024-01-01');

      const result = calculator.calculate(cashFlows, endValue, endDate);

      expect(result.converged).toBe(true);
      expect(result.irrAnnualized).toBeCloseTo(-0.2, 2);
    });

    it('should handle multiple cash flows', () => {
      // Invest 1000 initially, add 500 mid-year, end with 1650
      // This should be approximately 10% return
      const cashFlows = [
        { date: new Date('2023-01-01'), amount: new Big(-1000) },
        { date: new Date('2023-07-01'), amount: new Big(-500) }
      ];
      const endValue = new Big(1650);
      const endDate = new Date('2024-01-01');

      const result = calculator.calculate(cashFlows, endValue, endDate);

      expect(result.converged).toBe(true);
      expect(result.irr).toBeGreaterThan(0);
      expect(result.irrAnnualized).toBeGreaterThan(0);
    });

    it('should handle investment with dividends', () => {
      // Invest 1000, receive 50 dividend mid-year, end with 1050
      const cashFlows = [
        { date: new Date('2023-01-01'), amount: new Big(-1000) },
        { date: new Date('2023-07-01'), amount: new Big(50), type: 'DIVIDEND' as const }
      ];
      const endValue = new Big(1050);
      const endDate = new Date('2024-01-01');

      const result = calculator.calculate(cashFlows, endValue, endDate);

      expect(result.converged).toBe(true);
      expect(result.irrAnnualized).toBeCloseTo(0.1, 1);
    });

    it('should return empty result for no cash flows', () => {
      const result = calculator.calculate([], new Big(1000), new Date());

      expect(result.irr).toBeNull();
      expect(result.irrAnnualized).toBeNull();
      expect(result.converged).toBe(false);
      expect(result.iterations).toBe(0);
    });

    it('should handle short holding period', () => {
      // Invest 1000, grows to 1010 in 1 month (about 12% annualized)
      const cashFlows = [
        { date: new Date('2023-01-01'), amount: new Big(-1000) }
      ];
      const endValue = new Big(1010);
      const endDate = new Date('2023-02-01');

      const result = calculator.calculate(cashFlows, endValue, endDate);

      expect(result.converged).toBe(true);
      expect(result.irr).toBeCloseTo(0.01, 2); // 1% for the month
      expect(result.irrAnnualized).toBeGreaterThan(0.1); // ~12% annualized
    });

    it('should handle same day transaction and valuation', () => {
      const cashFlows = [
        { date: new Date('2023-01-01'), amount: new Big(-1000) }
      ];
      const endValue = new Big(1000);
      const endDate = new Date('2023-01-01');

      const result = calculator.calculate(cashFlows, endValue, endDate);

      // Should return 0% return for same-day
      expect(result.irr).toBeCloseTo(0, 5);
    });

    it('should handle break-even scenario', () => {
      const cashFlows = [
        { date: new Date('2023-01-01'), amount: new Big(-1000) }
      ];
      const endValue = new Big(1000);
      const endDate = new Date('2024-01-01');

      const result = calculator.calculate(cashFlows, endValue, endDate);

      expect(result.converged).toBe(true);
      expect(result.irr).toBeCloseTo(0, 5);
      expect(result.irrAnnualized).toBeCloseTo(0, 5);
    });

    it('should handle total loss', () => {
      const cashFlows = [
        { date: new Date('2023-01-01'), amount: new Big(-1000) }
      ];
      const endValue = new Big(0);
      const endDate = new Date('2024-01-01');

      const result = calculator.calculate(cashFlows, endValue, endDate);

      expect(result.converged).toBe(true);
      expect(result.irr).toBeCloseTo(-1, 2);
      expect(result.irrAnnualized).toBeCloseTo(-1, 2);
    });

    it('should handle doubling investment over 2 years', () => {
      // 100% return over 2 years = about 41.4% annualized
      const cashFlows = [
        { date: new Date('2022-01-01'), amount: new Big(-1000) }
      ];
      const endValue = new Big(2000);
      const endDate = new Date('2024-01-01');

      const result = calculator.calculate(cashFlows, endValue, endDate);

      expect(result.converged).toBe(true);
      expect(result.irr).toBeCloseTo(1.0, 2); // 100% total return
      expect(result.irrAnnualized).toBeCloseTo(0.414, 2); // ~41.4% annualized
    });
  });
});
