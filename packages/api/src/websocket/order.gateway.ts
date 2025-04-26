import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Inject, forwardRef } from '@nestjs/common';
import { WsAuthGuard } from './ws-auth.guard';
import { OrdersService } from '../orders/orders.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
@UseGuards(WsAuthGuard)
export class OrderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-kitchen')
  async handleJoinKitchen(client: Socket, locationId: string) {
    client.join(`kitchen-${locationId}`);
    return { status: 'joined' };
  }

  @SubscribeMessage('join-table')
  async handleJoinTable(client: Socket, tableId: string) {
    client.join(`table-${tableId}`);
    return { status: 'joined' };
  }

  async notifyOrderUpdate(orderId: string, locationId: string) {
    const order = await this.ordersService.findOne(orderId);
    this.server.to(`kitchen-${locationId}`).emit('order-updated', order);
    this.server.to(`table-${order.tableId}`).emit('order-updated', order);
  }

  async notifyItemStatusUpdate(orderId: string, itemId: string, locationId: string) {
    const order = await this.ordersService.findOne(orderId);
    this.server.to(`kitchen-${locationId}`).emit('item-status-updated', { orderId, itemId, status: order.items.find(item => item.id === itemId)?.status });
    this.server.to(`table-${order.tableId}`).emit('item-status-updated', { orderId, itemId, status: order.items.find(item => item.id === itemId)?.status });
  }
} 