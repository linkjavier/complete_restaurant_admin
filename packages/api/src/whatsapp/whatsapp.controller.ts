import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  async getStatus(@Query('tenantId') tenantId: string, @Query('locationId') locationId: string) {
    const isConnected = await this.whatsappService.isWhatsAppConnected(tenantId, locationId);
    return { isConnected };
  }

  @Get('qr')
  async getQRCode(@Query('tenantId') tenantId: string, @Query('locationId') locationId: string) {
    const qrCode = await this.whatsappService.getQRCode(tenantId, locationId);
    return { qrCode };
  }

  @Get('chats')
  async getChats(@Query('tenantId') tenantId: string, @Query('locationId') locationId: string) {
    const chats = await this.whatsappService.getChats(tenantId, locationId);
    return { chats };
  }

  @Post('send')
  async sendMessage(@Body() body: { tenantId: string; locationId: string; to: string; message: string }) {
    await this.whatsappService.sendMessage(body.tenantId, body.locationId, body.to, body.message);
    return { success: true };
  }
} 