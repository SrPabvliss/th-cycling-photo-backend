import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CurrentUser, type ICurrentUser, Public } from '@shared/auth'
import { AppException } from '@shared/domain'
import { ApiEnvelopeErrorResponse, ApiEnvelopeResponse, SuccessMessage } from '@shared/http'
import type { CookieOptions, Request, Response } from 'express'
import {
  ConfirmPasswordResetCommand,
  ConfirmPasswordResetDto,
  LoginCommand,
  LoginDto,
  LogoutCommand,
  RecordConsentsCommand,
  RecordConsentsDto,
  RefreshCommand,
  RegisterCommand,
  RegisterDto,
  RequestPasswordResetCommand,
  RequestPasswordResetDto,
  ValidatePasswordResetTokenCommand,
  ValidatePasswordResetTokenDto,
} from '../../application/commands'
import {
  AuthTokensProjection,
  MeProjection,
  PasswordResetTokenValidityProjection,
} from '../../application/projections'
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

  // Brute-force / spam guard. Bypasses the very permissive global short
  // bucket (1000/sec/IP) which would not stop credential stuffing or
  // automated registration.
  @Throttle({ short: { limit: 10, ttl: 60000 } })
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
      dto.birthDate ?? null,
      dto.gender ?? null,
      req.ip ?? null,
      req.headers['user-agent'] ?? null,
      dto.acceptedTerms ?? false,
      dto.guardianConsent ?? false,
    )
    const result = await this.commandBus.execute(command)

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...this.cookieOptions,
      maxAge: this.refreshCookieMaxAge,
    })

    return result.tokens
  }

  @Throttle({ short: { limit: 5, ttl: 60000 } })
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

  @Throttle({ short: { limit: 10, ttl: 60000 } })
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

  @Throttle({ short: { limit: 3, ttl: 900000 } })
  @Public()
  @Post('forgot-password')
  @HttpCode(202)
  @SuccessMessage('success.PASSWORD_RESET_REQUESTED')
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({
    status: 202,
    description: 'Always succeeds, whether or not the address is registered',
  })
  async forgotPassword(@Body() dto: RequestPasswordResetDto, @Req() req: Request) {
    await this.commandBus.execute(
      new RequestPasswordResetCommand(dto.email, req.ip ?? null, req.headers['user-agent'] ?? null),
    )
  }

  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @Public()
  @Post('reset-password/validate')
  @SuccessMessage('success.PASSWORD_RESET_TOKEN_VALIDATED')
  @ApiOperation({ summary: 'Check whether a reset token is still usable' })
  @ApiEnvelopeResponse({
    status: 201,
    description: 'Returns { valid: boolean }',
    type: PasswordResetTokenValidityProjection,
  })
  async validateResetToken(
    @Body() dto: ValidatePasswordResetTokenDto,
  ): Promise<PasswordResetTokenValidityProjection> {
    return this.commandBus.execute(new ValidatePasswordResetTokenCommand(dto.token))
  }

  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @Public()
  @Post('reset-password')
  @SuccessMessage('success.PASSWORD_UPDATED')
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  @ApiResponse({
    status: 201,
    description: 'Password updated successfully',
  })
  @ApiEnvelopeErrorResponse({
    status: 422,
    description: 'Token invalid, expired, already used, or account deactivated',
  })
  async resetPassword(@Body() dto: ConfirmPasswordResetDto) {
    await this.commandBus.execute(new ConfirmPasswordResetCommand(dto.token, dto.password))
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

  @Post('consents')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record the current policy consents for the logged-in user' })
  @ApiResponse({ status: 204, description: 'Consents recorded' })
  @ApiEnvelopeErrorResponse({ status: 401, description: 'Invalid or expired JWT' })
  async recordConsents(
    @Body() dto: RecordConsentsDto,
    @CurrentUser() user: ICurrentUser,
    @Req() req: Request,
  ) {
    await this.commandBus.execute(
      new RecordConsentsCommand(
        user.userId,
        dto.types,
        req.ip ?? null,
        req.headers['user-agent'] ?? null,
      ),
    )
  }
}
