import { AuthGuard } from '@ghostfolio/client/core/auth.guard';
import { internalRoutes } from '@ghostfolio/common/routes/routes';

import { Routes } from '@angular/router';

import { RebalancingPageComponent } from './rebalancing-page.component';

export const routes: Routes = [
  {
    canActivate: [AuthGuard],
    component: RebalancingPageComponent,
    path: '',
    title: internalRoutes.portfolio.subRoutes.rebalancing.title
  }
];

