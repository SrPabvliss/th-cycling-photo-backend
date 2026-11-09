import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { AUTH_USER_REPOSITORY, type IAuthUserRepository } from '../../domain/ports'

export interface JwtPayload {
  sub: string
  email: string
  role: string
  pv?: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepo: IAuthUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    })
  }

  async validate(payload: JwtPayload) {
    const session = await this.authUserRepo.findSessionVersion(payload.sub)
    if (!session?.isActive || session.version !== payload.pv) {
      throw new UnauthorizedException('Session is no longer valid')
    }
    return { userId: payload.sub, email: payload.email, role: payload.role }
  }
}
