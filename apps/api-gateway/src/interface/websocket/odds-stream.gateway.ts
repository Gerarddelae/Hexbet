import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'stream/odds',
  cors: { origin: '*' },
})
export class OddsStreamGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private subscriptions = new Map<string, Set<string>>();

  handleConnection(client: Socket): void {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    console.log(`Client disconnected: ${client.id}`);
    this.subscriptions.forEach((clients) => {
      clients.delete(client.id);
    });
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, matchId: string): void {
    client.join(`match:${matchId}`);

    if (!this.subscriptions.has(matchId)) {
      this.subscriptions.set(matchId, new Set());
    }
    this.subscriptions.get(matchId)?.add(client.id);

    console.log(`Client ${client.id} subscribed to match ${matchId}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, matchId: string): void {
    client.leave(`match:${matchId}`);
    this.subscriptions.get(matchId)?.delete(client.id);
  }

  broadcastOddsUpdate(matchId: string, odds: { home: number; draw: number; away: number; timestamp: string }): void {
    this.server.to(`match:${matchId}`).emit('odds.updated', {
      matchId,
      odds,
      timestamp: odds.timestamp,
    });
  }
}