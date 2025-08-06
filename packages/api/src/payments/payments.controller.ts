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
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register-with-payment')
  @ApiOperation({ summary: 'Register user with payment' })
  @ApiResponse({ status: 201, description: 'User registered and payment initiated' })
  async registerWithPayment(@Body() body: {
    tenantName: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    plan: string;
  }) {
    try {
      // Verificar que la clave de Stripe esté configurada
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new HttpException('Stripe configuration missing', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Stripe Price IDs - Actualizar con los IDs reales de tu cuenta de Stripe
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

      // Crear el usuario y tenant
      const registerData = {
        tenantName: body.tenantName,
        email: body.email,
        password: body.password,
        firstName: body.firstName,
        lastName: body.lastName,
        role: 'SUPER_ADMIN' as any,
      };

      const user = await this.authService.register(registerData, undefined);

      // Obtener el tenant del usuario registrado
      const userWithTenant = await this.prisma.user.findUnique({
        where: { id: user.user.id },
        include: { tenant: true }
      });

      if (!userWithTenant || !userWithTenant.tenant) {
        throw new HttpException('Error al obtener datos del tenant', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Crear la suscripción en la base de datos
      const subscription = await this.prisma.subscription.create({
        data: {
          tenantId: userWithTenant.tenant.id,
          userId: user.user.id,
          planName: body.plan,
          planPrice: this.getPlanPrice(body.plan),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
          status: 'TRIAL',
        },
      });

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { 
        apiVersion: '2022-11-15' 
      });

      // Crear sesión de checkout con metadata
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: body.plan === 'Starter' ? 'payment' : 'subscription',
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/success?session_id={CHECKOUT_SESSION_ID}&subscription_id=${subscription.id}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/cancel`,
        metadata: {
          plan: body.plan,
          subscriptionId: subscription.id,
          tenantId: userWithTenant.tenant.id,
          userId: user.user.id,
        },
        customer_email: body.email,
      });

      return { 
        url: session.url,
        subscriptionId: subscription.id,
        message: 'Usuario registrado y pago iniciado'
      };
    } catch (error) {
      console.error('Error in register with payment:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Error en el registro con pago: ' + (error.message || 'Error desconocido'),
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private getPlanPrice(plan: string): number {
    const prices: Record<string, number> = {
      'Starter': 0,
      'Professional': 50,
      'Enterprise': 100,
      '入门版': 0,
      '专业版': 50,
      'Enterprise Personalizado': 100,
      'Plan Básico': 0,
      'Plan Pro': 50,
      'PTD Pay The Day': 0,
    };
    return prices[plan] || 0;
  }

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