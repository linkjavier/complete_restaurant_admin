import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification as NotificationModel, Prisma } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  async create(@Body() data: Prisma.NotificationCreateInput): Promise<NotificationModel> {
    return this.notificationsService.createNotification(data);
  }

  @Get()
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('where') where?: string,
    @Query('orderBy') orderBy?: string,
  ): Promise<NotificationModel[]> {
    const params: {
      skip?: number;
      take?: number;
      where?: Prisma.NotificationWhereInput;
      orderBy?: Prisma.NotificationOrderByWithRelationInput;
    } = {};

    if (skip) params.skip = parseInt(skip, 10);
    if (take) params.take = parseInt(take, 10);
    if (where) params.where = JSON.parse(where);
    if (orderBy) params.orderBy = JSON.parse(orderBy);

    return this.notificationsService.notifications(params);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<NotificationModel | null> {
    return this.notificationsService.notification({ id });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Prisma.NotificationUpdateInput,
  ): Promise<NotificationModel> {
    return this.notificationsService.updateNotification({
      where: { id },
      data,
    });
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<NotificationModel> {
    return this.notificationsService.deleteNotification({ id });
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string): Promise<NotificationModel> {
    return this.notificationsService.markAsRead(id);
  }
} 