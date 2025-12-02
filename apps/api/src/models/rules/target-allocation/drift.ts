import { Rule } from '@ghostfolio/api/models/rule';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data/exchange-rate-data.service';
import { RuleSettings, UserSettings } from '@ghostfolio/common/interfaces';

export class TargetAllocationDrift extends Rule<Settings> {
  private driftData: DriftData | null;

  public constructor(
    protected exchangeRateDataService: ExchangeRateDataService,
    driftData: DriftData | null,
    languageCode: string
  ) {
    super(exchangeRateDataService, {
      key: TargetAllocationDrift.name,
      languageCode
    });

    this.driftData = driftData;
  }

  public evaluate(_ruleSettings: Settings) {
    if (!this.driftData || !this.driftData.hasActiveStrategy) {
      return {
        evaluation: 'No rebalancing strategy configured',
        value: true
      };
    }

    const { maxDrift, driftThreshold, categoriesOverThreshold } = this.driftData;

    if (categoriesOverThreshold.length > 0) {
      const categoryNames = categoriesOverThreshold
        .map((c) => `${c.name} (${c.drift > 0 ? '+' : ''}${c.drift.toFixed(1)}%)`)
        .join(', ');

      return {
        evaluation: `${categoriesOverThreshold.length} asset class(es) exceed ${driftThreshold}% drift threshold: ${categoryNames}`,
        value: false
      };
    }

    if (maxDrift > driftThreshold * 0.5) {
      return {
        evaluation: `Portfolio drift is ${maxDrift.toFixed(1)}%, approaching threshold of ${driftThreshold}%`,
        value: true
      };
    }

    return {
      evaluation: `Portfolio is within target allocation (max drift: ${maxDrift.toFixed(1)}%)`,
      value: true
    };
  }

  public getCategoryName() {
    return 'Target Allocation';
  }

  public getConfiguration() {
    return {
      threshold: {
        max: 50,
        min: 1,
        step: 1,
        unit: '%'
      },
      thresholdMax: true
    };
  }

  public getName() {
    return 'Drift';
  }

  public getSettings({
    baseCurrency,
    locale,
    xRayRules
  }: UserSettings): Settings {
    return {
      baseCurrency,
      locale,
      isActive: xRayRules?.[this.getKey()]?.isActive ?? true,
      thresholdMax: xRayRules?.[this.getKey()]?.thresholdMax ?? 0.05
    };
  }
}

interface Settings extends RuleSettings {
  baseCurrency: string;
  thresholdMax: number;
}

interface DriftData {
  hasActiveStrategy: boolean;
  strategyName?: string;
  overallStatus: 'OK' | 'WARNING' | 'CRITICAL' | 'NO_STRATEGY';
  maxDrift: number;
  driftThreshold: number;
  categoriesOverThreshold: {
    name: string;
    drift: number;
    type: 'OVER' | 'UNDER';
  }[];
}

