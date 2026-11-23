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
import Stripe from 'stripe';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentMethod } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('stripe/checkout')
  async createStripeCheckout(@Body() body: { plan: string }) {
    try {
      // Verificar que la clave de Stripe esté configurada
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new HttpException('Stripe configuration missing', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Stripe Price IDs - Actualizar con los IDs reales de tu cuenta de Stripe
      const prices: Record<string, string> = {
        'Starter': 'price_1RssTb4hcZSxv6KjMd7Jjyf1', // Plan gratuito de 5 días
        'Professional': 'price_1RssTb4hcZSxv6KjMd7Jjyf2', // Plan profesional
        'Enterprise': 'price_1RssTb4hcZSxv6KjMd7Jjyf3', // Plan enterprise
        '入门版': 'price_1RssTb4hcZSxv6KjMd7Jjyf1', // Plan starter en chino
        '专业版': 'price_1RssTb4hcZSxv6KjMd7Jjyf2', // Plan professional en chino
        'Enterprise Personalizado': 'price_1RssTb4hcZSxv6KjMd7Jjyf3', // Plan enterprise
        'Plan Básico': 'price_1RssTb4hcZSxv6KjMd7Jjyf1',
        'Plan Pro': 'price_1RssTb4hcZSxv6KjMd7Jjyf2',
        'PTD Pay The Day': 'price_1RssTb4hcZSxv6KjMd7Jjyf1',
      };

      const priceId = prices[body.plan];
      if (!priceId) {
        throw new HttpException('Plan no válido', HttpStatus.BAD_REQUEST);
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { 
        apiVersion: '2022-11-15' 
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: body.plan === 'Starter' ? 'payment' : 'subscription',
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/cancel`,
        metadata: {
          plan: body.plan,
        },
      });

      return { url: session.url };
    } catch (error) {
      console.error('Error creating Stripe checkout session:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error iniciando el pago: ' + (error.message || 'Error desconocido'),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('test/checkout')
  async createTestCheckout(@Body() body: { plan: string }) {
    try {
      // Simular checkout sin Stripe para desarrollo
      const prices: Record<string, string> = {
        'Starter': 'price_1RssTb4hcZSxv6KjMd7Jjyf1',
        'Professional': 'price_1RssTb4hcZSxv6KjMd7Jjyf2',
        'Enterprise': 'price_1RssTb4hcZSxv6KjMd7Jjyf3',
        '入门版': 'price_1RssTb4hcZSxv6KjMd7Jjyf1',
        '专业版': 'price_1RssTb4hcZSxv6KjMd7Jjyf2',
        'Enterprise Personalizado': 'price_1RssTb4hcZSxv6KjMd7Jjyf3',
        'Plan Básico': 'price_1RssTb4hcZSxv6KjMd7Jjyf1',
        'Plan Pro': 'price_1RssTb4hcZSxv6KjMd7Jjyf2',
        'PTD Pay The Day': 'price_1RssTb4hcZSxv6KjMd7Jjyf1',
      };

      const priceId = prices[body.plan];
      if (!priceId) {
        throw new HttpException('Plan no válido', HttpStatus.BAD_REQUEST);
      }

      // Simular URL de éxito
      const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/success?session_id=test_session_123&plan=${encodeURIComponent(body.plan)}`;
      
      return { 
        url: successUrl,
        message: 'Pago simulado exitosamente',
        plan: body.plan
      };
    } catch (error) {
      console.error('Error creating test checkout session:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error iniciando el pago de prueba: ' + (error.message || 'Error desconocido'),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get payment details for an order' })
  @ApiResponse({ status: 200, description: 'Return payment details' })
  async getOrderPaymentDetails(@Param('orderId') orderId: string) {
    return this.paymentsService.getOrderPaymentDetails(orderId);
  }

  @Post('process')
  @UseGuards(JwtAuthGuard)
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
      const order = await this.paymentsService['prisma'].order.findUnique({ where: { id: paymentData.orderId } });
      if (!order) throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      return await this.paymentsService.processPayment(
        paymentData.orderId,
        paymentData.amount,
        paymentData.method,
        order.tenantId,
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error processing payment',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a payment by ID' })
  @ApiResponse({ status: 200, description: 'Return the payment' })
  async findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }
}