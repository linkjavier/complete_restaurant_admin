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
    
    // Configure socket middleware for authentication if needed
    server.use((socket, next) => {
      try {
        // You can add authentication logic here if necessary
        // e.g., verify token, check permissions, etc.
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
      
      // Set ping timeout and interval for better connection monitoring
      client.conn.on('ping', () => {
        this.logger.debug(`Ping from client ${client.id}`);
      });
      
      // Handle errors at the connection level
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
      
      // Remove client from location maps
      for (const [locationId, clients] of this.clientsMap.entries()) {
        if (clients.has(client.id)) {
          clients.delete(client.id);
          this.logger.log(`Removed client ${client.id} from location ${locationId}`);
          
          // If no more clients for this location, clean up
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
          
          // Update tracking maps
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
      
      // Log the clients that should receive this event
      let clientCount = 0;
      let socketIds = '';
      
      try {
        // Safely check rooms - avoid "Cannot read properties of undefined (reading 'rooms')" error
        if (this.server && this.server.sockets) {
          const adapter = this.server.sockets.adapter;
          const roomName = `kitchen-${locationId}`;
          
          // Only try to access rooms if adapter exists
          if (adapter && adapter.rooms) {
            const clientsInRoom = adapter.rooms.get(roomName);
            clientCount = clientsInRoom?.size || 0;
            this.logger.log(`Room ${roomName} has ${clientCount} clients connected to receive the event`);
            
            // Log the actual socket IDs that should receive this
            if (clientCount > 0) {
              socketIds = '[';
              clientsInRoom?.forEach(socketId => {
                socketIds += `${socketId}, `;
              });
              socketIds = socketIds.substring(0, socketIds.length - 2) + ']';
              this.logger.log(`Socket IDs in room ${roomName}: ${socketIds}`);
            } else {
              this.logger.warn(`No clients in room ${roomName} to receive new_order_created event`);
            }
          } else {
            this.logger.warn('Server sockets adapter or rooms not available, skipping room check');
          }
        } else {
          this.logger.warn('Server or server.sockets not available, cannot check rooms');
        }
      } catch (error) {
        // Catch any errors when trying to access adapter or rooms
        this.logger.error(`Error checking socket rooms: ${error.message}`, error.stack);
      }
      
      // Log event listeners and connected clients
      try {
        const listenerCount = this.server?.listenerCount ? this.server.listenerCount('new_order_created') : 'unknown';
        this.logger.log(`Number of 'new_order_created' event listeners on server: ${listenerCount}`);
        
        // Log total connected clients - safely
        if (this.server && this.server.sockets && this.server.sockets.sockets) {
          const allClientIds = [...this.server.sockets.sockets.keys()];
          this.logger.log(`Total clients connected to namespace: ${allClientIds.length}`);
          this.logger.log(`All client IDs: ${allClientIds.join(', ') || 'none'}`);
        } else {
          this.logger.log('Cannot list connected clients - server.sockets.sockets not available');
        }
      } catch (error) {
        this.logger.error(`Error checking listeners: ${error.message}`);
      }
      
      // Send the event - wrap in try/catch for more safety
      try {
        // Emit to room first
        this.server.to(`kitchen-${locationId}`).emit('new_order_created', order);
        this.logger.log(`Emitted 'new_order_created' to room kitchen-${locationId}`);
      } catch (error) {
        this.logger.error(`Error emitting to room: ${error.message}`);
      }
      
      try {
        // BACKUP: Also broadcast to ALL clients (for testing)
        this.logger.log('BACKUP: Broadcasting new_order_created to ALL clients');
        this.server.emit('new_order_created', order);
      } catch (error) {
        this.logger.error(`Error broadcasting to all clients: ${error.message}`);
      }
      
      // Log how many clients received the event
      const clientCount2 = this.clientsMap.get(locationId)?.size || 0;
      this.logger.log(`Event new_order_created for location ${locationId} sent to ${clientCount2} clients (tracked in clientsMap)`);
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
      this.logger.log(`Event order_updated for location ${locationId} sent to ${clientCount} clients`);
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
      this.logger.log(`Event order_item_updated for location ${locationId} sent to ${clientCount} clients`);
    } catch (error) {
      this.logger.error(`Error emitting order_item_updated for location ${locationId}: ${error.message}`, error.stack);
    }
  }
} 