import { PortfolioService } from '@ghostfolio/api/app/portfolio/portfolio.service';
import { PrismaService } from '@ghostfolio/api/services/prisma/prisma.service';
import { ASSET_CLASS_MAPPING } from '@ghostfolio/common/config';

import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  AssetClass,
  AssetClassTarget,
  AssetSubClass,
  RebalancingExclusion,
  RebalancingStrategy
} from '@prisma/client';

import {
  CreateAssetClassTargetDto,
  CreateStrategyDto,
  CreateSubClassTargetDto,
  ToggleExclusionDto,
  UpdateStrategyDto
} from './dto';
import {
  AllocationAnalysis,
  AssetClassAllocation,
  DriftSummary,
  HoldingAllocation,
  SubClassAllocation
} from './interfaces/allocation-analysis.interface';
import { RebalancingSuggestion } from './interfaces/rebalancing-suggestion.interface';

type StrategyWithTargets = RebalancingStrategy & {
  assetClassTargets: (AssetClassTarget & {
    subClassTargets: { assetSubClass: AssetSubClass; targetPercent: number }[];
  })[];
};

@Injectable()
export class RebalancingService {
  public constructor(
    private readonly prismaService: PrismaService,
    private readonly portfolioService: PortfolioService
  ) {}

  // ============================================
  // STRATEGY MANAGEMENT
  // ============================================

  public async getStrategies(userId: string): Promise<RebalancingStrategy[]> {
    return this.prismaService.rebalancingStrategy.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  public async getStrategy(
    userId: string,
    strategyId: string
  ): Promise<StrategyWithTargets> {
    const strategy = await this.prismaService.rebalancingStrategy.findFirst({
      where: { id: strategyId, userId },
      include: {
        assetClassTargets: {
          include: {
            subClassTargets: true
          }
        }
      }
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    return strategy;
  }

  public async getActiveStrategy(
    userId: string
  ): Promise<StrategyWithTargets | null> {
    return this.prismaService.rebalancingStrategy.findFirst({
      where: { userId, isActive: true },
      include: {
        assetClassTargets: {
          include: {
            subClassTargets: true
          }
        }
      }
    });
  }

  public async createStrategy(
    userId: string,
    dto: CreateStrategyDto
  ): Promise<RebalancingStrategy> {
    // If this strategy should be active, deactivate others
    if (dto.isActive) {
      await this.prismaService.rebalancingStrategy.updateMany({
        where: { userId },
        data: { isActive: false }
      });
    }

    return this.prismaService.rebalancingStrategy.create({
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? false,
        driftThreshold: dto.driftThreshold ?? 5.0,
        userId
      }
    });
  }

  public async updateStrategy(
    userId: string,
    strategyId: string,
    dto: UpdateStrategyDto
  ): Promise<RebalancingStrategy> {
    const strategy = await this.prismaService.rebalancingStrategy.findFirst({
      where: { id: strategyId, userId }
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // If this strategy should be active, deactivate others
    if (dto.isActive) {
      await this.prismaService.rebalancingStrategy.updateMany({
        where: { userId, NOT: { id: strategyId } },
        data: { isActive: false }
      });
    }

    return this.prismaService.rebalancingStrategy.update({
      where: { id: strategyId },
      data: dto
    });
  }

  public async deleteStrategy(
    userId: string,
    strategyId: string
  ): Promise<void> {
    const strategy = await this.prismaService.rebalancingStrategy.findFirst({
      where: { id: strategyId, userId }
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    await this.prismaService.rebalancingStrategy.delete({
      where: { id: strategyId }
    });
  }

  public async activateStrategy(
    userId: string,
    strategyId: string
  ): Promise<RebalancingStrategy> {
    const strategy = await this.prismaService.rebalancingStrategy.findFirst({
      where: { id: strategyId, userId }
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // Deactivate all other strategies
    await this.prismaService.rebalancingStrategy.updateMany({
      where: { userId },
      data: { isActive: false }
    });

    // Activate this strategy
    return this.prismaService.rebalancingStrategy.update({
      where: { id: strategyId },
      data: { isActive: true }
    });
  }

  // ============================================
  // ASSET CLASS TARGETS
  // ============================================

  public async createAssetClassTarget(
    userId: string,
    strategyId: string,
    dto: CreateAssetClassTargetDto
  ): Promise<AssetClassTarget> {
    const strategy = await this.prismaService.rebalancingStrategy.findFirst({
      where: { id: strategyId, userId },
      include: { assetClassTargets: true }
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // Validate sum of targets
    const currentSum = strategy.assetClassTargets.reduce(
      (sum, t) => sum + t.targetPercent,
      0
    );
    if (currentSum + dto.targetPercent > 100) {
      throw new BadRequestException(
        'Total asset class targets cannot exceed 100%'
      );
    }

    return this.prismaService.assetClassTarget.create({
      data: {
        strategyId,
        assetClass: dto.assetClass,
        targetPercent: dto.targetPercent
      }
    });
  }

  public async updateAssetClassTarget(
    userId: string,
    targetId: string,
    targetPercent: number
  ): Promise<AssetClassTarget> {
    const target = await this.prismaService.assetClassTarget.findFirst({
      where: { id: targetId },
      include: { strategy: { include: { assetClassTargets: true } } }
    });

    if (!target || target.strategy.userId !== userId) {
      throw new NotFoundException('Target not found');
    }

    // Validate sum of targets
    const otherSum = target.strategy.assetClassTargets
      .filter((t) => t.id !== targetId)
      .reduce((sum, t) => sum + t.targetPercent, 0);

    if (otherSum + targetPercent > 100) {
      throw new BadRequestException(
        'Total asset class targets cannot exceed 100%'
      );
    }

    return this.prismaService.assetClassTarget.update({
      where: { id: targetId },
      data: { targetPercent }
    });
  }

  public async deleteAssetClassTarget(
    userId: string,
    targetId: string
  ): Promise<void> {
    const target = await this.prismaService.assetClassTarget.findFirst({
      where: { id: targetId },
      include: { strategy: true }
    });

    if (!target || target.strategy.userId !== userId) {
      throw new NotFoundException('Target not found');
    }

    await this.prismaService.assetClassTarget.delete({
      where: { id: targetId }
    });
  }

  // ============================================
  // SUB-CLASS TARGETS
  // ============================================

  public async createSubClassTarget(
    userId: string,
    assetClassTargetId: string,
    dto: CreateSubClassTargetDto
  ) {
    const assetClassTarget =
      await this.prismaService.assetClassTarget.findFirst({
        where: { id: assetClassTargetId },
        include: { strategy: true, subClassTargets: true }
      });

    if (!assetClassTarget || assetClassTarget.strategy.userId !== userId) {
      throw new NotFoundException('Asset class target not found');
    }

    // Validate sub-class belongs to asset class
    const validSubClasses = ASSET_CLASS_MAPPING.get(
      assetClassTarget.assetClass as AssetClass
    );
    if (!validSubClasses?.includes(dto.assetSubClass)) {
      throw new BadRequestException(
        `${dto.assetSubClass} is not valid for ${assetClassTarget.assetClass}`
      );
    }

    // Validate sum of sub-class targets
    const currentSum = assetClassTarget.subClassTargets.reduce(
      (sum, t) => sum + t.targetPercent,
      0
    );
    if (currentSum + dto.targetPercent > 100) {
      throw new BadRequestException(
        'Total sub-class targets cannot exceed 100% within asset class'
      );
    }

    return this.prismaService.assetSubClassTarget.create({
      data: {
        assetClassTargetId,
        assetSubClass: dto.assetSubClass,
        targetPercent: dto.targetPercent
      }
    });
  }

  public async updateSubClassTarget(
    userId: string,
    targetId: string,
    targetPercent: number
  ) {
    const target = await this.prismaService.assetSubClassTarget.findFirst({
      where: { id: targetId },
      include: {
        assetClassTarget: {
          include: { strategy: true, subClassTargets: true }
        }
      }
    });

    if (!target || target.assetClassTarget.strategy.userId !== userId) {
      throw new NotFoundException('Target not found');
    }

    // Validate sum
    const otherSum = target.assetClassTarget.subClassTargets
      .filter((t) => t.id !== targetId)
      .reduce((sum, t) => sum + t.targetPercent, 0);

    if (otherSum + targetPercent > 100) {
      throw new BadRequestException(
        'Total sub-class targets cannot exceed 100%'
      );
    }

    return this.prismaService.assetSubClassTarget.update({
      where: { id: targetId },
      data: { targetPercent }
    });
  }

  public async deleteSubClassTarget(
    userId: string,
    targetId: string
  ): Promise<void> {
    const target = await this.prismaService.assetSubClassTarget.findFirst({
      where: { id: targetId },
      include: { assetClassTarget: { include: { strategy: true } } }
    });

    if (!target || target.assetClassTarget.strategy.userId !== userId) {
      throw new NotFoundException('Target not found');
    }

    await this.prismaService.assetSubClassTarget.delete({
      where: { id: targetId }
    });
  }

  // ============================================
  // EXCLUSIONS
  // ============================================

  public async getExclusions(
    userId: string,
    strategyId?: string
  ): Promise<RebalancingExclusion[]> {
    const strategy = strategyId
      ? await this.prismaService.rebalancingStrategy.findFirst({
          where: { id: strategyId, userId }
        })
      : await this.getActiveStrategy(userId);

    if (!strategy) {
      return [];
    }

    return this.prismaService.rebalancingExclusion.findMany({
      where: { strategyId: strategy.id, userId },
      include: { symbolProfile: true }
    });
  }

  public async toggleExclusion(
    userId: string,
    dto: ToggleExclusionDto
  ): Promise<RebalancingExclusion> {
    const strategy = dto.strategyId
      ? await this.prismaService.rebalancingStrategy.findFirst({
          where: { id: dto.strategyId, userId }
        })
      : await this.getActiveStrategy(userId);

    if (!strategy) {
      throw new NotFoundException('No active strategy found');
    }

    const existing = await this.prismaService.rebalancingExclusion.findFirst({
      where: { strategyId: strategy.id, symbolProfileId: dto.symbolProfileId }
    });

    if (existing) {
      return this.prismaService.rebalancingExclusion.update({
        where: { id: existing.id },
        data: {
          excludeFromCalculation:
            dto.excludeFromCalculation ?? existing.excludeFromCalculation,
          neverSell: dto.neverSell ?? existing.neverSell,
          reason: dto.reason ?? existing.reason
        }
      });
    }

    return this.prismaService.rebalancingExclusion.create({
      data: {
        strategyId: strategy.id,
        userId,
        symbolProfileId: dto.symbolProfileId,
        excludeFromCalculation: dto.excludeFromCalculation ?? true,
        neverSell: dto.neverSell ?? false,
        reason: dto.reason
      }
    });
  }

  public async removeExclusion(
    userId: string,
    exclusionId: string
  ): Promise<void> {
    const exclusion = await this.prismaService.rebalancingExclusion.findFirst({
      where: { id: exclusionId, userId }
    });

    if (!exclusion) {
      throw new NotFoundException('Exclusion not found');
    }

    await this.prismaService.rebalancingExclusion.delete({
      where: { id: exclusionId }
    });
  }

  // ============================================
  // ANALYSIS & CALCULATIONS
  // ============================================

  public async getAllocationAnalysis(
    userId: string,
    impersonationId: string,
    strategyId?: string
  ): Promise<AllocationAnalysis> {
    const strategy = strategyId
      ? await this.getStrategy(userId, strategyId)
      : await this.getActiveStrategy(userId);

    if (!strategy) {
      throw new NotFoundException('No active rebalancing strategy found');
    }

    // Get portfolio details
    const portfolioDetails = await this.portfolioService.getDetails({
      impersonationId,
      userId,
      withSummary: true
    });

    // Get exclusions with symbol profile info
    const exclusions = await this.prismaService.rebalancingExclusion.findMany({
      where: { strategyId: strategy.id, userId },
      include: { symbolProfile: { select: { dataSource: true, symbol: true } } }
    });

    // Create a map using dataSource:symbol as key
    const exclusionMap = new Map(
      exclusions.map((e) => [
        `${e.symbolProfile.dataSource}:${e.symbolProfile.symbol}`,
        e
      ])
    );

    // Helper to get exclusion key
    const getExclusionKey = (h: { dataSource: string; symbol: string }) =>
      `${h.dataSource}:${h.symbol}`;

    // Process holdings
    const allHoldings = Object.values(portfolioDetails.holdings);
    const excludedHoldings = allHoldings.filter(
      (h) => exclusionMap.get(getExclusionKey(h))?.excludeFromCalculation
    );
    const includedHoldings = allHoldings.filter(
      (h) => !exclusionMap.get(getExclusionKey(h))?.excludeFromCalculation
    );

    // Calculate total portfolio value (only included holdings)
    const portfolioValue = includedHoldings.reduce(
      (sum, h) => sum + (h.valueInBaseCurrency ?? 0),
      0
    );

    // Group holdings by asset class and sub-class
    const holdingsByAssetClass = new Map<string, typeof includedHoldings>();
    const holdingsBySubClass = new Map<string, typeof includedHoldings>();

    for (const holding of includedHoldings) {
      const assetClass = holding.assetClass || 'UNKNOWN';
      const assetSubClass = holding.assetSubClass || 'UNKNOWN';

      if (!holdingsByAssetClass.has(assetClass)) {
        holdingsByAssetClass.set(assetClass, []);
      }
      holdingsByAssetClass.get(assetClass)!.push(holding);

      if (!holdingsBySubClass.has(assetSubClass)) {
        holdingsBySubClass.set(assetSubClass, []);
      }
      holdingsBySubClass.get(assetSubClass)!.push(holding);
    }

    // Calculate allocations
    const assetClassAllocations: AssetClassAllocation[] = [];
    let maxDrift = 0;

    for (const target of strategy.assetClassTargets) {
      const holdingsInClass =
        holdingsByAssetClass.get(target.assetClass) || [];
      const actualValue = holdingsInClass.reduce(
        (sum, h) => sum + (h.valueInBaseCurrency ?? 0),
        0
      );
      const actualPercent =
        portfolioValue > 0 ? (actualValue / portfolioValue) * 100 : 0;
      const targetValue = (target.targetPercent / 100) * portfolioValue;
      const driftPercent = actualPercent - target.targetPercent;
      const driftValue = actualValue - targetValue;

      maxDrift = Math.max(maxDrift, Math.abs(driftPercent));

      // Calculate sub-class allocations
      const subClassAllocations: SubClassAllocation[] = [];
      for (const subTarget of target.subClassTargets) {
        const holdingsInSubClass =
          holdingsBySubClass.get(subTarget.assetSubClass) || [];
        const subActualValue = holdingsInSubClass.reduce(
          (sum, h) => sum + (h.valueInBaseCurrency ?? 0),
          0
        );

        const subTargetPercentOfTotal =
          (target.targetPercent * subTarget.targetPercent) / 100;
        const subTargetValue = (subTargetPercentOfTotal / 100) * portfolioValue;
        const subActualPercentOfTotal =
          portfolioValue > 0 ? (subActualValue / portfolioValue) * 100 : 0;
        const subActualPercentOfParent =
          actualValue > 0 ? (subActualValue / actualValue) * 100 : 0;
        const subDriftPercent = subActualPercentOfTotal - subTargetPercentOfTotal;

        subClassAllocations.push({
          assetSubClass: subTarget.assetSubClass,
          targetPercentOfParent: subTarget.targetPercent,
          targetPercentOfTotal: subTargetPercentOfTotal,
          targetValue: subTargetValue,
          actualPercentOfParent: subActualPercentOfParent,
          actualPercentOfTotal: subActualPercentOfTotal,
          actualValue: subActualValue,
          driftPercent: subDriftPercent,
          driftValue: subActualValue - subTargetValue,
          driftStatus: this.getDriftStatus(
            subDriftPercent,
            strategy.driftThreshold
          ),
          holdings: this.mapHoldings(
            holdingsInSubClass,
            portfolioValue,
            actualValue,
            subActualValue,
            exclusionMap
          )
        });
      }

      assetClassAllocations.push({
        assetClass: target.assetClass,
        targetPercent: target.targetPercent,
        targetValue,
        actualPercent,
        actualValue,
        driftPercent,
        driftValue,
        driftStatus: this.getDriftStatus(driftPercent, strategy.driftThreshold),
        subClassAllocations,
        holdings: this.mapHoldings(
          holdingsInClass,
          portfolioValue,
          actualValue,
          actualValue,
          exclusionMap
        )
      });
    }

    return {
      portfolioValue,
      baseCurrency: portfolioDetails.summary?.baseCurrency || 'USD',
      strategyId: strategy.id,
      strategyName: strategy.name,
      driftThreshold: strategy.driftThreshold,
      overallStatus: this.getOverallStatus(maxDrift, strategy.driftThreshold),
      maxDrift,
      assetClassAllocations,
      excludedHoldings: excludedHoldings.map((h) => ({
        symbol: h.symbol,
        name: h.name || '',
        value: h.valueInBaseCurrency ?? 0,
        excludeFromCalculation: true,
        neverSell: exclusionMap.get(getExclusionKey(h))?.neverSell || false
      }))
    };
  }

  public async getDriftSummary(
    userId: string,
    impersonationId: string
  ): Promise<DriftSummary> {
    const strategy = await this.getActiveStrategy(userId);

    if (!strategy) {
      return {
        hasActiveStrategy: false,
        overallStatus: 'NO_STRATEGY',
        maxDrift: 0,
        driftThreshold: 5,
        categoriesOverThreshold: []
      };
    }

    const analysis = await this.getAllocationAnalysis(
      userId,
      impersonationId,
      strategy.id
    );

    const categoriesOverThreshold = analysis.assetClassAllocations
      .filter((a) => Math.abs(a.driftPercent) > strategy.driftThreshold)
      .map((a) => ({
        name: a.assetClass,
        drift: a.driftPercent,
        type: (a.driftPercent > 0 ? 'OVER' : 'UNDER') as 'OVER' | 'UNDER'
      }));

    return {
      hasActiveStrategy: true,
      strategyName: strategy.name,
      overallStatus: analysis.overallStatus,
      maxDrift: analysis.maxDrift,
      driftThreshold: strategy.driftThreshold,
      categoriesOverThreshold
    };
  }

  public async getRebalancingSuggestions(
    userId: string,
    impersonationId: string,
    strategyId?: string
  ): Promise<RebalancingSuggestion[]> {
    const analysis = await this.getAllocationAnalysis(
      userId,
      impersonationId,
      strategyId
    );

    const suggestions: RebalancingSuggestion[] = [];
    let priority = 1;

    // Find overweight categories (need to SELL)
    for (const assetClass of analysis.assetClassAllocations) {
      if (assetClass.driftPercent > 0) {
        for (const subClass of assetClass.subClassAllocations) {
          if (subClass.driftPercent > 0) {
            const amountToSell = Math.abs(subClass.driftValue);
            const sellableHoldings = subClass.holdings.filter(
              (h) => !h.neverSell
            );
            const totalSellableValue = sellableHoldings.reduce(
              (sum, h) => sum + h.value,
              0
            );

            for (const holding of sellableHoldings) {
              const proportion = holding.value / totalSellableValue;
              const holdingSellAmount = amountToSell * proportion;
              const sharesToSell = Math.floor(holdingSellAmount / holding.price);

              if (sharesToSell > 0) {
                suggestions.push({
                  action: 'SELL',
                  assetClass: assetClass.assetClass,
                  assetSubClass: subClass.assetSubClass,
                  symbol: holding.symbol,
                  name: holding.name,
                  dataSource: holding.dataSource,
                  symbolProfileId: holding.symbolProfileId,
                  currentShares: holding.shares,
                  currentValue: holding.value,
                  suggestedAmount: sharesToSell * holding.price,
                  suggestedShares: sharesToSell,
                  sharePrice: holding.price,
                  reason: `${assetClass.assetClass} is ${assetClass.driftPercent.toFixed(1)}% overweight`,
                  priority: priority++,
                  targetPercentAfter: subClass.targetPercentOfTotal,
                  driftAfter: 0
                });
              }
            }
          }
        }
      }
    }

    // Find underweight categories (need to BUY)
    for (const assetClass of analysis.assetClassAllocations) {
      if (assetClass.driftPercent < 0) {
        for (const subClass of assetClass.subClassAllocations) {
          if (subClass.driftPercent < 0) {
            const amountToBuy = Math.abs(subClass.driftValue);

            suggestions.push({
              action: 'BUY',
              assetClass: assetClass.assetClass,
              assetSubClass: subClass.assetSubClass,
              suggestedAmount: amountToBuy,
              reason: `${assetClass.assetClass} - ${subClass.assetSubClass} is ${Math.abs(subClass.driftPercent).toFixed(1)}% underweight`,
              priority: priority++,
              targetPercentAfter: subClass.targetPercentOfTotal,
              driftAfter: 0
            });
          }
        }
      }
    }

    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private getDriftStatus(
    drift: number,
    threshold: number
  ): 'OK' | 'WARNING' | 'CRITICAL' {
    const absDrift = Math.abs(drift);
    if (absDrift >= threshold) return 'CRITICAL';
    if (absDrift >= threshold * 0.5) return 'WARNING';
    return 'OK';
  }

  private getOverallStatus(
    maxDrift: number,
    threshold: number
  ): 'OK' | 'WARNING' | 'CRITICAL' {
    if (maxDrift >= threshold) return 'CRITICAL';
    if (maxDrift >= threshold * 0.5) return 'WARNING';
    return 'OK';
  }

  private mapHoldings(
    holdings: any[],
    portfolioValue: number,
    assetClassValue: number,
    subClassValue: number,
    exclusionMap: Map<string, RebalancingExclusion>
  ): HoldingAllocation[] {
    return holdings.map((h) => {
      const exclusionKey = `${h.dataSource}:${h.symbol}`;
      return {
        symbol: h.symbol,
        name: h.name || '',
        dataSource: h.dataSource,
        symbolProfileId: `${h.dataSource}:${h.symbol}`,
        shares: h.quantity ?? 0,
        price: h.marketPrice ?? 0,
        value: h.valueInBaseCurrency ?? 0,
        percentOfSubClass:
          subClassValue > 0
            ? ((h.valueInBaseCurrency ?? 0) / subClassValue) * 100
            : 0,
        percentOfAssetClass:
          assetClassValue > 0
            ? ((h.valueInBaseCurrency ?? 0) / assetClassValue) * 100
            : 0,
        percentOfTotal:
          portfolioValue > 0
            ? ((h.valueInBaseCurrency ?? 0) / portfolioValue) * 100
            : 0,
        isExcluded: exclusionMap.get(exclusionKey)?.excludeFromCalculation || false,
        neverSell: exclusionMap.get(exclusionKey)?.neverSell || false
      };
    });
  }
}

