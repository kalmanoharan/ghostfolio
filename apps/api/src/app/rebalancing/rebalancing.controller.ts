import { HasPermission } from '@ghostfolio/api/decorators/has-permission.decorator';
import { HasPermissionGuard } from '@ghostfolio/api/guards/has-permission.guard';
import { ImpersonationService } from '@ghostfolio/api/services/impersonation/impersonation.service';
import { permissions } from '@ghostfolio/common/permissions';
import type { RequestWithUser } from '@ghostfolio/common/types';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import {
  CreateAssetClassTargetDto,
  CreateStrategyDto,
  CreateSubClassTargetDto,
  ToggleExclusionDto,
  UpdateStrategyDto
} from './dto';
import { RebalancingService } from './rebalancing.service';

@Controller('rebalancing')
export class RebalancingController {
  public constructor(
    private readonly impersonationService: ImpersonationService,
    private readonly rebalancingService: RebalancingService,
    @Inject(REQUEST) private readonly request: RequestWithUser
  ) {}

  // ============================================
  // STRATEGY MANAGEMENT
  // ============================================

  @Get('strategies')
  @HasPermission(permissions.readPortfolio)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getStrategies() {
    return this.rebalancingService.getStrategies(this.request.user.id);
  }

  @Get('strategies/:id')
  @HasPermission(permissions.readPortfolio)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getStrategy(@Param('id') id: string) {
    return this.rebalancingService.getStrategy(this.request.user.id, id);
  }

  @Post('strategies')
  @HasPermission(permissions.createOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async createStrategy(@Body() dto: CreateStrategyDto) {
    return this.rebalancingService.createStrategy(this.request.user.id, dto);
  }

  @Put('strategies/:id')
  @HasPermission(permissions.updateOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async updateStrategy(
    @Param('id') id: string,
    @Body() dto: UpdateStrategyDto
  ) {
    return this.rebalancingService.updateStrategy(this.request.user.id, id, dto);
  }

  @Delete('strategies/:id')
  @HasPermission(permissions.deleteOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteStrategy(@Param('id') id: string) {
    return this.rebalancingService.deleteStrategy(this.request.user.id, id);
  }

  @Post('strategies/:id/activate')
  @HasPermission(permissions.updateOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async activateStrategy(@Param('id') id: string) {
    return this.rebalancingService.activateStrategy(this.request.user.id, id);
  }

  // ============================================
  // ASSET CLASS TARGETS
  // ============================================

  @Post('strategies/:strategyId/asset-class-targets')
  @HasPermission(permissions.createOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async createAssetClassTarget(
    @Param('strategyId') strategyId: string,
    @Body() dto: CreateAssetClassTargetDto
  ) {
    return this.rebalancingService.createAssetClassTarget(
      this.request.user.id,
      strategyId,
      dto
    );
  }

  @Put('asset-class-targets/:id')
  @HasPermission(permissions.updateOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async updateAssetClassTarget(
    @Param('id') id: string,
    @Body('targetPercent') targetPercent: number
  ) {
    return this.rebalancingService.updateAssetClassTarget(
      this.request.user.id,
      id,
      targetPercent
    );
  }

  @Delete('asset-class-targets/:id')
  @HasPermission(permissions.deleteOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteAssetClassTarget(@Param('id') id: string) {
    return this.rebalancingService.deleteAssetClassTarget(
      this.request.user.id,
      id
    );
  }

  // ============================================
  // SUB-CLASS TARGETS
  // ============================================

  @Post('asset-class-targets/:assetClassTargetId/sub-class-targets')
  @HasPermission(permissions.createOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async createSubClassTarget(
    @Param('assetClassTargetId') assetClassTargetId: string,
    @Body() dto: CreateSubClassTargetDto
  ) {
    return this.rebalancingService.createSubClassTarget(
      this.request.user.id,
      assetClassTargetId,
      dto
    );
  }

  @Put('sub-class-targets/:id')
  @HasPermission(permissions.updateOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async updateSubClassTarget(
    @Param('id') id: string,
    @Body('targetPercent') targetPercent: number
  ) {
    return this.rebalancingService.updateSubClassTarget(
      this.request.user.id,
      id,
      targetPercent
    );
  }

  @Delete('sub-class-targets/:id')
  @HasPermission(permissions.deleteOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteSubClassTarget(@Param('id') id: string) {
    return this.rebalancingService.deleteSubClassTarget(this.request.user.id, id);
  }

  // ============================================
  // EXCLUSIONS
  // ============================================

  @Get('exclusions')
  @HasPermission(permissions.readPortfolio)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getExclusions(@Query('strategyId') strategyId?: string) {
    return this.rebalancingService.getExclusions(
      this.request.user.id,
      strategyId
    );
  }

  @Post('exclusions')
  @HasPermission(permissions.createOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async toggleExclusion(@Body() dto: ToggleExclusionDto) {
    return this.rebalancingService.toggleExclusion(this.request.user.id, dto);
  }

  @Delete('exclusions/:id')
  @HasPermission(permissions.deleteOrder)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  public async removeExclusion(@Param('id') id: string) {
    return this.rebalancingService.removeExclusion(this.request.user.id, id);
  }

  // ============================================
  // ANALYSIS & CALCULATIONS
  // ============================================

  @Get('analysis')
  @HasPermission(permissions.readPortfolio)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getAllocationAnalysis(@Query('strategyId') strategyId?: string) {
    const impersonationId =
      await this.impersonationService.validateImpersonationId(
        this.request.user.id,
        this.request.user.id
      );

    return this.rebalancingService.getAllocationAnalysis(
      this.request.user.id,
      impersonationId,
      strategyId
    );
  }

  @Get('drift-summary')
  @HasPermission(permissions.readPortfolio)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getDriftSummary() {
    const impersonationId =
      await this.impersonationService.validateImpersonationId(
        this.request.user.id,
        this.request.user.id
      );

    return this.rebalancingService.getDriftSummary(
      this.request.user.id,
      impersonationId
    );
  }

  @Get('suggestions')
  @HasPermission(permissions.readPortfolio)
  @UseGuards(AuthGuard('jwt'), HasPermissionGuard)
  public async getRebalancingSuggestions(
    @Query('strategyId') strategyId?: string
  ) {
    const impersonationId =
      await this.impersonationService.validateImpersonationId(
        this.request.user.id,
        this.request.user.id
      );

    return this.rebalancingService.getRebalancingSuggestions(
      this.request.user.id,
      impersonationId,
      strategyId
    );
  }
}

