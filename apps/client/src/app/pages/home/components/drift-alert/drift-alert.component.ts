import { DataService } from '@ghostfolio/client/services/data.service';
import { internalRoutes } from '@ghostfolio/common/routes/routes';

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface DriftSummary {
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

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatIconModule, RouterModule],
  selector: 'gf-drift-alert',
  styleUrls: ['./drift-alert.component.scss'],
  templateUrl: './drift-alert.component.html'
})
export class GfDriftAlertComponent implements OnDestroy, OnInit {
  public driftSummary: DriftSummary | null = null;
  public isLoading = true;
  public rebalancingRoute = internalRoutes.portfolio.subRoutes.rebalancing.routerLink;

  private unsubscribeSubject = new Subject<void>();

  public constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private dataService: DataService
  ) {}

  public ngOnInit() {
    this.loadDriftSummary();
  }

  public ngOnDestroy() {
    this.unsubscribeSubject.next();
    this.unsubscribeSubject.complete();
  }

  private loadDriftSummary() {
    this.dataService
      .fetchDriftSummary()
      .pipe(takeUntil(this.unsubscribeSubject))
      .subscribe({
        next: (summary) => {
          this.driftSummary = summary;
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        },
        error: () => {
          this.driftSummary = null;
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  public shouldShowAlert(): boolean {
    return (
      this.driftSummary?.hasActiveStrategy === true &&
      this.driftSummary?.overallStatus !== 'OK' &&
      this.driftSummary?.overallStatus !== 'NO_STRATEGY'
    );
  }

  public getStatusClass(): string {
    switch (this.driftSummary?.overallStatus) {
      case 'WARNING':
        return 'warning';
      case 'CRITICAL':
        return 'critical';
      default:
        return '';
    }
  }
}

