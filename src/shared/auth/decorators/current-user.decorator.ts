import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

export interface ICurrentUser {
  userId: string
  email: string
  role: string
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ICurrentUser => {
    const request = ctx.switchToHttp().getRequest()
    return request.user as ICurrentUser
  },
)
