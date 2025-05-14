import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentMethod } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Get payment details for an order' })
  @ApiResponse({ status: 200, description: 'Return payment details' })
  async getOrderPaymentDetails(@Param('orderId') orderId: string) {
    return this.paymentsService.getOrderPaymentDetails(orderId);
  }

  @Post('process')
  @ApiOperation({ summary: 'Process a payment for an order' })
  @ApiResponse({ status: 200, description: 'Payment processed successfully' })
  async processPayment(
    @Body()
    paymentData: {
      orderId: string;
      amount: number;
      method: PaymentMethod;
    },
  ) {
    try {
      return await this.paymentsService.processPayment(
        paymentData.orderId,
        paymentData.amount,
        paymentData.method,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error processing payment',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a payment by ID' })
  @ApiResponse({ status: 200, description: 'Return the payment' })
  async findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }
}