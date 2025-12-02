import { DataService } from '@ghostfolio/client/services/data.service';
import { UserService } from '@ghostfolio/client/services/user/user.service';
import { ASSET_CLASS_MAPPING } from '@ghostfolio/common/config';
import { User } from '@ghostfolio/common/interfaces';
import { translate } from '@ghostfolio/ui/i18n';

import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AssetClass, AssetSubClass } from '@prisma/client';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Strategy {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  driftThreshold: number;
  assetClassTargets?: AssetClassTargetWithSubs[];
}

interface AssetClassTargetWithSubs {
  id: string;
  assetClass: AssetClass;
  targetPercent: number;
  subClassTargets: SubClassTarget[];
}

interface SubClassTarget {
  id: string;
  assetSubClass: AssetSubClass;
  targetPercent: number;
}

interface AllocationAnalysis {
  portfolioValue: number;
  baseCurrency: string;
  strategyId: string;
  strategyName: string;
  driftThreshold: number;
  overallStatus: 'OK' | 'WARNING' | 'CRITICAL';
  maxDrift: number;
  assetClassAllocations: AssetClassAllocation[];
  excludedHoldings: any[];
}

interface AssetClassAllocation {
  assetClass: string;
  targetPercent: number;
  targetValue: number;
  actualPercent: number;
  actualValue: number;
  driftPercent: number;
  driftValue: number;
  driftStatus: 'OK' | 'WARNING' | 'CRITICAL';
  subClassAllocations: SubClassAllocation[];
  holdings: any[];
}

interface SubClassAllocation {
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
  holdings: any[];
}

interface Suggestion {
  action: 'BUY' | 'SELL';
  assetClass: string;
  assetSubClass: string;
  symbol?: string;
  name?: string;
  suggestedAmount: number;
  suggestedShares?: number;
  sharePrice?: number;
  reason: string;
  priority: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CurrencyPipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    ReactiveFormsModule
  ],
  selector: 'gf-rebalancing-page',
  styleUrls: ['./rebalancing-page.scss'],
  templateUrl: './rebalancing-page.html'
})
export class RebalancingPageComponent implements OnDestroy, OnInit {
  public strategies: Strategy[] = [];
  public activeStrategy: Strategy | null = null;
  public analysis: AllocationAnalysis | null = null;
  public suggestions: Suggestion[] = [];
  public holdings: any[] = [];
  public isLoading = true;
  public user: User;
  public selectedTab = 0;
  public expandedAssetClasses = new Set<string>();

  // For creating new strategy
  public newStrategyName = '';
  public newStrategyDescription = '';
  public newStrategyDriftThreshold = 5;
  public isCreatingStrategy = false;

  // For editing targets
  public isEditingTargets = false;
  public editingAssetClassTargets: AssetClassTargetWithSubs[] = [];

  // Available asset classes and sub-classes
  public assetClasses = Object.values(AssetClass);
  public assetClassMapping = ASSET_CLASS_MAPPING;

  // Table columns
  public allocationColumns = [
    'assetClass',
    'target',
    'actual',
    'drift',
    'status'
  ];
  public suggestionColumns = ['priority', 'action', 'category', 'amount', 'reason'];
  public holdingColumns = [
    'exclude',
    'neverSell',
    'symbol',
    'name',
    'assetClass',
    'value'
  ];

  private unsubscribeSubject = new Subject<void>();

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dataService: DataService,
    private userService: UserService
  ) {}

  public ngOnInit() {
    this.userService.stateChanged
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe((state) => {
        if (state?.user) {
          this.user = state.user;
          this.loadData();
        }
      });
  }

  public ngOnDestroy() {
    this.unsubscribeSubject.next();
    this.unsubscribeSubject.complete();
  }

  public loadData() {
    this.isLoading = true;
    this.changeDetectorRef.markForCheck();

    this.dataService
      .fetchRebalancingStrategies()
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe({
        next: (strategies) => {
          this.strategies = strategies;
          this.activeStrategy = strategies.find((s) => s.isActive) || null;

          if (this.activeStrategy) {
            this.loadAnalysis();
          } else {
            this.isLoading = false;
            this.changeDetectorRef.markForCheck();
          }
        },
        error: () => {
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  public loadAnalysis() {
    if (!this.activeStrategy) {
      this.isLoading = false;
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.dataService
      .fetchAllocationAnalysis(this.activeStrategy.id)
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe({
        next: (analysis) => {
          this.analysis = analysis;
          this.loadSuggestions();
        },
        error: () => {
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  public loadSuggestions() {
    this.dataService
      .fetchRebalancingSuggestions(this.activeStrategy?.id)
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe({
        next: (suggestions) => {
          this.suggestions = suggestions;
          this.loadStrategy();
        },
        error: () => {
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  public loadStrategy() {
    if (!this.activeStrategy) {
      this.isLoading = false;
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.dataService
      .fetchRebalancingStrategy(this.activeStrategy.id)
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe({
        next: (strategy) => {
          this.activeStrategy = strategy;
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  public onStrategyChange(strategyId: string) {
    this.dataService
      .activateRebalancingStrategy(strategyId)
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe(() => {
        this.loadData();
      });
  }

  public createStrategy() {
    if (!this.newStrategyName.trim()) return;

    this.isCreatingStrategy = true;
    this.changeDetectorRef.markForCheck();

    this.dataService
      .createRebalancingStrategy({
        name: this.newStrategyName.trim(),
        description: this.newStrategyDescription.trim() || undefined,
        isActive: true,
        driftThreshold: this.newStrategyDriftThreshold
      })
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe({
        next: () => {
          this.newStrategyName = '';
          this.newStrategyDescription = '';
          this.newStrategyDriftThreshold = 5;
          this.isCreatingStrategy = false;
          this.loadData();
        },
        error: () => {
          this.isCreatingStrategy = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  public deleteStrategy(strategyId: string) {
    if (!confirm('Are you sure you want to delete this strategy?')) return;

    this.dataService
      .deleteRebalancingStrategy(strategyId)
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe(() => {
        this.loadData();
      });
  }

  public toggleAssetClassExpand(assetClass: string) {
    if (this.expandedAssetClasses.has(assetClass)) {
      this.expandedAssetClasses.delete(assetClass);
    } else {
      this.expandedAssetClasses.add(assetClass);
    }
    this.changeDetectorRef.markForCheck();
  }

  public isExpanded(assetClass: string): boolean {
    return this.expandedAssetClasses.has(assetClass);
  }

  public startEditingTargets() {
    if (this.activeStrategy?.assetClassTargets) {
      this.editingAssetClassTargets = JSON.parse(
        JSON.stringify(this.activeStrategy.assetClassTargets)
      );
    } else {
      this.editingAssetClassTargets = [];
    }
    this.isEditingTargets = true;
    this.changeDetectorRef.markForCheck();
  }

  public cancelEditingTargets() {
    this.isEditingTargets = false;
    this.editingAssetClassTargets = [];
    this.changeDetectorRef.markForCheck();
  }

  public getAssetClassTargetTotal(): number {
    return this.editingAssetClassTargets.reduce(
      (sum, t) => sum + t.targetPercent,
      0
    );
  }

  public getSubClassTargetTotal(target: AssetClassTargetWithSubs): number {
    return target.subClassTargets.reduce((sum, s) => sum + s.targetPercent, 0);
  }

  public getAvailableAssetClasses(): AssetClass[] {
    const usedClasses = new Set(
      this.editingAssetClassTargets.map((t) => t.assetClass)
    );
    return this.assetClasses.filter((c) => !usedClasses.has(c));
  }

  public getAvailableSubClasses(assetClass: AssetClass): AssetSubClass[] {
    const validSubClasses = this.assetClassMapping.get(assetClass) || [];
    const target = this.editingAssetClassTargets.find(
      (t) => t.assetClass === assetClass
    );
    const usedSubClasses = new Set(
      target?.subClassTargets.map((s) => s.assetSubClass) || []
    );
    return validSubClasses.filter((s) => !usedSubClasses.has(s));
  }

  public addAssetClassTarget() {
    const available = this.getAvailableAssetClasses();
    if (available.length === 0) return;

    this.editingAssetClassTargets.push({
      id: '',
      assetClass: available[0],
      targetPercent: 0,
      subClassTargets: []
    });
    this.changeDetectorRef.markForCheck();
  }

  public removeAssetClassTarget(index: number) {
    const target = this.editingAssetClassTargets[index];

    if (target.id) {
      // Delete from backend
      this.dataService
        .deleteAssetClassTarget(target.id)
        .pipe(takeUntil(this.unsubscribeSubject))
        .subscribe(() => {
          this.editingAssetClassTargets.splice(index, 1);
          this.changeDetectorRef.markForCheck();
        });
    } else {
      this.editingAssetClassTargets.splice(index, 1);
      this.changeDetectorRef.markForCheck();
    }
  }

  public addSubClassTarget(targetIndex: number) {
    const target = this.editingAssetClassTargets[targetIndex];
    const available = this.getAvailableSubClasses(target.assetClass);
    if (available.length === 0) return;

    target.subClassTargets.push({
      id: '',
      assetSubClass: available[0],
      targetPercent: 0
    });
    this.changeDetectorRef.markForCheck();
  }

  public removeSubClassTarget(targetIndex: number, subIndex: number) {
    const subTarget =
      this.editingAssetClassTargets[targetIndex].subClassTargets[subIndex];

    if (subTarget.id) {
      this.dataService
        .deleteSubClassTarget(subTarget.id)
        .pipe(takeUntil(this.unsubscribeSubject))
        .subscribe(() => {
          this.editingAssetClassTargets[targetIndex].subClassTargets.splice(
            subIndex,
            1
          );
          this.changeDetectorRef.markForCheck();
        });
    } else {
      this.editingAssetClassTargets[targetIndex].subClassTargets.splice(
        subIndex,
        1
      );
      this.changeDetectorRef.markForCheck();
    }
  }

  public async saveTargets() {
    if (!this.activeStrategy) return;

    const total = this.getAssetClassTargetTotal();
    if (total > 100) {
      alert('Asset class targets cannot exceed 100%');
      return;
    }

    for (const target of this.editingAssetClassTargets) {
      const subTotal = this.getSubClassTargetTotal(target);
      if (subTotal > 100) {
        alert(
          `Sub-class targets for ${target.assetClass} cannot exceed 100%`
        );
        return;
      }
    }

    // Save each target
    for (const target of this.editingAssetClassTargets) {
      if (target.id) {
        // Update existing
        await this.dataService
          .updateAssetClassTarget(target.id, target.targetPercent)
          .toPromise();
      } else {
        // Create new
        const result = await this.dataService
          .createAssetClassTarget(this.activeStrategy.id, {
            assetClass: target.assetClass,
            targetPercent: target.targetPercent
          })
          .toPromise();
        target.id = result.id;
      }

      // Save sub-class targets
      for (const subTarget of target.subClassTargets) {
        if (subTarget.id) {
          await this.dataService
            .updateSubClassTarget(subTarget.id, subTarget.targetPercent)
            .toPromise();
        } else {
          const result = await this.dataService
            .createSubClassTarget(target.id, {
              assetSubClass: subTarget.assetSubClass,
              targetPercent: subTarget.targetPercent
            })
            .toPromise();
          subTarget.id = result.id;
        }
      }
    }

    this.isEditingTargets = false;
    this.loadData();
  }

  public toggleExclusion(
    holding: any,
    field: 'excludeFromCalculation' | 'neverSell',
    value: boolean
  ) {
    this.dataService
      .toggleRebalancingExclusion({
        symbolProfileId: holding.symbolProfileId,
        strategyId: this.activeStrategy?.id,
        [field]: value
      })
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe(() => {
        this.loadData();
      });
  }

  public getStatusClass(status: string): string {
    switch (status) {
      case 'OK':
        return 'status-ok';
      case 'WARNING':
        return 'status-warning';
      case 'CRITICAL':
        return 'status-critical';
      default:
        return '';
    }
  }

  public getDriftClass(drift: number): string {
    if (drift > 0) return 'drift-over';
    if (drift < 0) return 'drift-under';
    return '';
  }

  public translateAssetClass(assetClass: string): string {
    return translate(assetClass);
  }

  public getAllHoldings(): any[] {
    if (!this.analysis) return [];

    const holdings: any[] = [];
    for (const ac of this.analysis.assetClassAllocations) {
      for (const sc of ac.subClassAllocations) {
        for (const h of sc.holdings) {
          holdings.push({
            ...h,
            assetClass: ac.assetClass,
            assetSubClass: sc.assetSubClass
          });
        }
      }
    }
    return holdings;
  }
}

