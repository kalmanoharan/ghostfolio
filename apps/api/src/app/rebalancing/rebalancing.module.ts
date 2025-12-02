import { PortfolioModule } from '@ghostfolio/api/app/portfolio/portfolio.module';
import { ImpersonationModule } from '@ghostfolio/api/services/impersonation/impersonation.module';
import { PrismaModule } from '@ghostfolio/api/services/prisma/prisma.module';

import { Module } from '@nestjs/common';

import { RebalancingController } from './rebalancing.controller';
import { RebalancingService } from './rebalancing.service';

@Module({
  controllers: [RebalancingController],
  exports: [RebalancingService],
  imports: [ImpersonationModule, PortfolioModule, PrismaModule],
  providers: [RebalancingService]
})
export class RebalancingModule {}

