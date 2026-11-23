import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  SaveWhatsappCloudIntegrationDto,
  WhatsappCloudAiToggleDto,
  WhatsappCloudConversationActionDto,
} from './whatsapp-cloud.dto';
import { WhatsappCloudService } from './whatsapp-cloud.service';

@Controller('whatsapp-cloud')
@UseGuards(JwtAuthGuard)
export class WhatsappCloudController {
  constructor(private readonly whatsappCloudService: WhatsappCloudService) {}

  @Get('integration')
  getIntegration(@Query('locationId') locationId: string, @CurrentTenant() tenantId: string) {
    return this.whatsappCloudService.getIntegration(tenantId, locationId);
  }

  @Put('integration')
  saveIntegration(
    @Body() data: SaveWhatsappCloudIntegrationDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    if (role !== UserRole.ADMIN && role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only tenant administrators can configure WhatsApp Cloud API');
    }
    return this.whatsappCloudService.saveIntegration(tenantId, data);
  }

  @Get('conversations')
  listConversations(@Query('locationId') locationId: string, @CurrentTenant() tenantId: string) {
    return this.whatsappCloudService.listConversations(tenantId, locationId);
  }

  @Get('conversations/:conversationId/messages')
  listMessages(
    @Param('conversationId') conversationId: string,
    @Query('locationId') locationId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.whatsappCloudService.listMessages(tenantId, locationId, conversationId);
  }

  @Post('conversations/:conversationId/messages')
  sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() data: WhatsappCloudConversationActionDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.whatsappCloudService.sendManualMessage(
      tenantId,
      data.locationId,
      conversationId,
      data.message,
    );
  }

  @Patch('conversations/:conversationId/ai')
  toggleConversationAi(
    @Param('conversationId') conversationId: string,
    @Body() data: WhatsappCloudAiToggleDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.whatsappCloudService.setConversationAi(
      tenantId,
      data.locationId,
      conversationId,
      data.aiEnabled,
    );
  }
}
