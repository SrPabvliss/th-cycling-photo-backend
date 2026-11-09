import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AppException } from '@shared/domain'
import { PrismaService } from '@shared/infrastructure'
import { compareSync } from 'bcryptjs'
import { CONFIRM_PASSWORD_KEY } from '../decorators/confirm-password.decorator'

@Injectable()
export class PasswordConfirmationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(CONFIRM_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required) return true

    // Guards run before the validation pipe, so `password` is still on the raw
    // body here even though `forbidNonWhitelisted` would strip an undeclared field.
    const request = context.switchToHttp().getRequest()
    const password = request.body?.password
    if (typeof password !== 'string' || password.length === 0) {
      throw AppException.businessRule('auth.password_confirmation_invalid')
    }

    const account = await this.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { password_hash: true },
    })
    if (!account || !compareSync(password, account.password_hash)) {
      throw AppException.businessRule('auth.password_confirmation_invalid')
    }

    return true
  }
}
