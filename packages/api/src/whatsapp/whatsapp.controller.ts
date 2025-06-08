import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  async getStatus() {
    const isConnected = await this.whatsappService.isWhatsAppConnected();
    return { isConnected };
  }

  @Get('qr')
  async getQRCode() {
    const qrCode = await this.whatsappService.getQRCode();
    return { qrCode };
  }

  @Get('chats')
  async getChats() {
    const chats = await this.whatsappService.getChats();
    return { chats };
  }

  @Post('send')
  async sendMessage(@Body() body: { to: string; message: string }) {
    await this.whatsappService.sendMessage(body.to, body.message);
    return { success: true };
  }
} 