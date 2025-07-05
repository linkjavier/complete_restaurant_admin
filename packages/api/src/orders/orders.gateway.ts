import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  OnGatewayInit,
  WsResponse,
  WsException
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { Order } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:3001',
        'http://localhost:3000'
      ];
      const originIsAllowed = !origin || allowedOrigins.includes(origin);
      callback(null, originIsAllowed);
    },
    credentials: true
  },
  namespace: 'orders',
  transports: ['websocket', 'polling']
})
export class OrdersGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(OrdersGateway.name);
  private readonly clientsMap = new Map<string, Set<string>>(); // locationId -> Set of client IDs

  constructor(private configService: ConfigService) {}

  afterInit(server: Server) {
    this.logger.log('Orders WebSocket Gateway initialized');
    server.use((socket, next) => {
      try {
        next();
      } catch (error) {
        this.logger.error(`Socket authentication error: ${error.message}`, error.stack);
        next(new Error('Authentication error'));
      }
    });
  }

  handleConnection(client: Socket) {
    try {
      this.logger.log(`Client connected: ${client.id}`);
      client.conn.on('ping', () => {
        this.logger.debug(`Ping from client ${client.id}`);
      });
      
      client.conn.on('error', (error) => {
        this.logger.error(`Connection error for client ${client.id}: ${error.message}`);
      });
    } catch (error) {
      this.logger.error(`Error handling connection for client ${client.id}: ${error.message}`, error.stack);
    }
  }

  handleDisconnect(client: Socket) {
    try {
      this.logger.log(`Client disconnected: ${client.id}`);
      
      for (const [locationId, clients] of this.clientsMap.entries()) {
        if (clients.has(client.id)) {
          clients.delete(client.id);
          this.logger.log(`Removed client ${client.id} from location ${locationId}`);
          
          if (clients.size === 0) {
            this.clientsMap.delete(locationId);
            this.logger.log(`No more clients for location ${locationId}, removed from tracking`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error handling disconnect for client ${client.id}: ${error.message}`, error.stack);
    }
  }

  @SubscribeMessage('join-kitchen')
  handleJoinKitchen(client: Socket, locationId: string): WsResponse<string> {
    try {
      if (!locationId) {
        throw new WsException('Location ID is required');
      }
      
      this.logger.log(`Client ${client.id} joining kitchen room for location: ${locationId}`);
      
      // Leave all other kitchen rooms first
      Object.keys(client.rooms).forEach(room => {
        if (room.startsWith('kitchen-')) {
          client.leave(room);
          const locationFromRoom = room.replace('kitchen-', '');
          const clientsForLocation = this.clientsMap.get(locationFromRoom);
          if (clientsForLocation) {
            clientsForLocation.delete(client.id);
          }
        }
      });
      
      // Join the specific kitchen room
      const roomName = `kitchen-${locationId}`;
      client.join(roomName);
      
      // Track client in the location map
      if (!this.clientsMap.has(locationId)) {
        this.clientsMap.set(locationId, new Set());
      }
      this.clientsMap.get(locationId)!.add(client.id);
      
      this.logger.log(`Client ${client.id} joined ${roomName}. Current clients for location: ${this.clientsMap.get(locationId)?.size}`);
      
      return { event: 'joinedKitchen', data: roomName };
    } catch (error) {
      this.logger.error(`Error in join-kitchen for client ${client.id}: ${error.message}`, error.stack);
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket, data: any) {
    this.logger.log(`Received ping from client ${client.id}`);
    return { event: 'pong', data: { time: new Date().toISOString(), clientId: client.id } };
  }

  emitNewOrder(order: Order, locationId: string) {
    try {
      if (!order || !locationId) {
        this.logger.warn(`Invalid order or locationId for emitNewOrder: order=${!!order}, locationId=${locationId}`);
        return;
      }
      
      this.logger.log(`Emitting new_order_created event to kitchen-${locationId}`);
      
      // Send to specific room
      this.server.to(`kitchen-${locationId}`).emit('new_order_created', order);
      
      // Log delivery stats
      const clientCount = this.clientsMap.get(locationId)?.size || 0;
      this.logger.log(`Event new_order_created sent to ${clientCount} clients in kitchen-${locationId}`);
      
      // No broadcast global. Si no hay clientes, solo loguear.
      if (clientCount === 0) {
        this.logger.log('No clients in kitchen room for this location. No event broadcasted globally.');
      }
    } catch (error) {
      this.logger.error(`Error emitting new_order_created for location ${locationId}: ${error.message}`, error.stack);
    }
  }

  emitOrderUpdated(order: Order, locationId: string) {
    try {
      if (!order || !locationId) {
        this.logger.warn(`Invalid order or locationId for emitOrderUpdated: order=${!!order}, locationId=${locationId}`);
        return;
      }
      
      this.logger.log(`Emitting order_updated event to kitchen-${locationId}`);
      this.server.to(`kitchen-${locationId}`).emit('order_updated', order);
      
      const clientCount = this.clientsMap.get(locationId)?.size || 0;
      this.logger.log(`Event order_updated sent to ${clientCount} clients`);
    } catch (error) {
      this.logger.error(`Error emitting order_updated for location ${locationId}: ${error.message}`, error.stack);
    }
  }

  emitOrderItemUpdated(orderItem: any, locationId: string) {
    try {
      if (!orderItem || !locationId) {
        this.logger.warn(`Invalid orderItem or locationId for emitOrderItemUpdated: orderItem=${!!orderItem}, locationId=${locationId}`);
        return;
      }
      
      this.logger.log(`Emitting order_item_updated event to kitchen-${locationId}`);
      this.server.to(`kitchen-${locationId}`).emit('order_item_updated', orderItem);
      
      const clientCount = this.clientsMap.get(locationId)?.size || 0;
      this.logger.log(`Event order_item_updated sent to ${clientCount} clients`);
    } catch (error) {
      this.logger.error(`Error emitting order_item_updated for location ${locationId}: ${error.message}`, error.stack);
    }
  }
}