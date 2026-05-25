import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import type { Namespace, Socket } from 'socket.io'

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name)

  @WebSocketServer()
  private readonly nsp: Namespace

  constructor(private readonly jwtService: JwtService) {}

  afterInit(): void {
    this.logger.log('Notifications WebSocket gateway initialized')
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string)

      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: no token`)
        client.disconnect(true)
        return
      }

      const payload = await this.jwtService.verifyAsync(token)
      client.data.user = payload

      if (payload?.sub) {
        client.join(`user:${payload.sub}`)
      }

      this.logger.log(`Client connected: ${client.id} (user: ${payload.email})`)
    } catch {
      this.logger.warn(`Client ${client.id} disconnected: invalid token`)
      client.disconnect(true)
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`)
  }

  /** Emits an event to all authenticated connected clients. */
  emitToAll(event: string, payload: unknown): void {
    this.nsp.emit(event, payload)
  }

  /** Emits an event only to the sockets of the given user ids. */
  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    if (userIds.length === 0) return
    const rooms = userIds.map((id) => `user:${id}`)
    this.nsp.to(rooms).emit(event, payload)
  }
}
