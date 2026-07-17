import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthenticatedUser } from '@dental/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SetupPasswordDto,
  UpdateProfileDto,
} from './auth.dto';

const COOKIE_NAME = 'access_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Email + password login; sets an HttpOnly session cookie.' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.login(dto.email, dto.password);
    res.cookie(COOKIE_NAME, token, this.auth.cookieOptions());
    return { user };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear the session cookie.' })
  logout(@Res({ passthrough: true }) res: Response) {
    const { maxAge: _maxAge, ...clearOpts } = this.auth.cookieOptions();
    void _maxAge;
    res.clearCookie(COOKIE_NAME, clearOpts);
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
