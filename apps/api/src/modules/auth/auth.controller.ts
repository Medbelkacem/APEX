import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthenticatedUser } from '@dental/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { RequestContext } from './refresh-token.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SetupPasswordDto,
  UpdateProfileDto,
} from './auth.dto';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Where the request came from, for the refresh token's audit fields. */
  private contextOf(req: Request): RequestContext {
    return { ipAddress: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
  }

  private setSessionCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(ACCESS_COOKIE, accessToken, this.auth.accessCookieOptions());
    res.cookie(REFRESH_COOKIE, refreshToken, this.auth.refreshCookieOptions());
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Email + password login; sets HttpOnly session cookies.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.login(
      dto.email,
      dto.password,
      this.contextOf(req),
    );
    this.setSessionCookies(res, accessToken, refreshToken);
    return { user };
  }

  /**
   * Public because the expired access token is exactly what cannot be presented
   * here. The refresh cookie is the credential, and it is verified against the
   * database rather than merely decoded.
   */
  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange the refresh cookie for a new session pair.' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    if (!presented) {
      throw new UnauthorizedException('Session expired — please sign in again');
    }

    try {
      const { accessToken, refreshToken, user } = await this.auth.refreshSession(
        presented,
        this.contextOf(req),
      );
      this.setSessionCookies(res, accessToken, refreshToken);
      return { user };
    } catch (err) {
      // The refresh token is spent or repudiated either way, so leaving the
      // cookies in place would only produce a client that retries forever.
      this.clearSessionCookies(res);
      throw err;
    }
  }

  private clearSessionCookies(res: Response): void {
    const options = this.auth.clearCookieOptions();
    res.clearCookie(ACCESS_COOKIE, options);
    res.clearCookie(REFRESH_COOKIE, options);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Revoke the refresh token and clear the session cookies.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Clearing the cookie alone would leave a stolen refresh token usable for
    // its full lifetime, so the server-side row is revoked first.
    await this.auth.logout((req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE]);
    this.clearSessionCookies(res);
    return { success: true };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password reset email (always returns 202).' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Set a new password using a reset token.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.userId, dto.token, dto.password);
    return { success: true };
  }

  @Public()
  @Post('setup-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'First-login password setup from an invitation token.' })
  async setupPassword(@Body() dto: SetupPasswordDto) {
    await this.auth.resetPassword(dto.userId, dto.token, dto.password);
    return { success: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user profile.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile.' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.id, dto);
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change the current user password.' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { success: true };
  }
}
