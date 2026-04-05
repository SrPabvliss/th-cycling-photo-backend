import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser, type ICurrentUser, Public } from '@shared/auth'
import { AppException } from '@shared/domain'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import type { CookieOptions, Request, Response } from 'express'
import {
  LoginCommand,
  LoginDto,
  LogoutCommand,
  RefreshCommand,
  RegisterCommand,
  RegisterDto,
} from '../../application/commands'
import { AuthTokensProjection, MeProjection } from '../../application/projections'
import { GetMeQuery } from '../../application/queries'

const REFRESH_COOKIE_NAME = 'refresh_token'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions
  private readonly refreshCookieMaxAge: number

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    configService: ConfigService,
  ) {
    const refreshExpiryDays = configService.get<number>('jwt.refreshExpiryDays', 30)
    this.refreshCookieMaxAge = refreshExpiryDays * 24 * 60 * 60 * 1000

    this.cookieOptions = {
      httpOnly: true,
      secure: configService.get('nodeEnv') === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    }
  }

  @Public()
  @Post('register')
  @SuccessMessage('success.CREATED', { entity: 'entities.user' })
  @ApiOperation({ summary: 'Register a new customer account' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Registration successful, access token returned and refresh token set in cookie',
    type: AuthTokensProjection,
  })
  @ApiEnvelopeErrorResponse({
    status: 409,
    description: 'Email already exists',
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const command = new RegisterCommand(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
      dto.phoneNumber,
      dto.countryId,
      dto.provinceId ?? null,
      dto.cantonId ?? null,
      req.ip ?? null,
      req.headers['user-agent'] ?? null,
    )
    const result = await this.commandBus.execute(command)

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...this.cookieOptions,
      maxAge: this.refreshCookieMaxAge,
    })

    return result.tokens
  }

  @Public()
  @Post('login')
  @SuccessMessage('success.CREATED', { entity: 'entities.session' })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Login successful, access token returned and refresh token set in cookie',
    type: AuthTokensProjection,
  })
  @ApiEnvelopeErrorResponse({
    status: 422,
    description: 'Invalid credentials or account deactivated',
  })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const command = new LoginCommand(dto.email, dto.password)
    const result = await this.commandBus.execute(command)

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...this.cookieOptions,
      maxAge: this.refreshCookieMaxAge,
    })

    return result.tokens
  }

  @Public()
  @Post('refresh')
  @SuccessMessage('success.CREATED', { entity: 'entities.access_token' })
  @ApiOperation({ summary: 'Refresh access token using httpOnly cookie' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'New access token issued',
    type: AuthTokensProjection,
  })
  @ApiEnvelopeErrorResponse({
    status: 422,
    description: 'Invalid, expired, or revoked refresh token',
  })
  async refresh(@Req() req: Request) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME]
    if (!refreshToken) {
      throw AppException.businessRule('auth.no_refresh_token')
    }

    const command = new RefreshCommand(refreshToken)
    return this.commandBus.execute(command)
  }

  @Public()
  @Post('logout')
  @SuccessMessage('success.DELETED', { entity: 'entities.session' })
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME]
    if (refreshToken) {
      await this.commandBus.execute(new LogoutCommand(refreshToken))
    }

    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions)
  }

  @Get('me')
  @ApiBearerAuth()
  @SuccessMessage('success.FETCHED', { entity: 'entities.user' })
  @ApiOperation({ summary: 'Get current user from JWT payload (no DB query)' })
  @ApiEnvelopeResponse({
    status: 200,
    description: 'Current user profile from token',
    type: MeProjection,
  })
  @ApiEnvelopeErrorResponse({ status: 401, description: 'Invalid or expired JWT' })
  async me(@CurrentUser() user: ICurrentUser) {
    return this.queryBus.execute(new GetMeQuery(user.userId, user.email, user.role))
  }
}
