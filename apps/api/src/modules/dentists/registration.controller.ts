import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { DentistsService } from './dentists.service';
import { RegisterDentistDto, VerifyEmailDto } from './dentists.dto';

/**
 * Public dentist self-registration.
 *
 * Separate from DentistsController because that one is `@Roles(ADMIN,
 * SUPER_ADMIN)` at the class level — these two routes are the only part of
 * dentist management an anonymous caller may reach, and keeping them in their
 * own controller means the admin surface cannot be opened up by accident.
 */
@ApiTags('auth')
@Controller('auth')
export class RegistrationController {
  constructor(private readonly dentists: DentistsService) {}

  @Public()
  @Post('register')
  @HttpCode(202)
  // Registration writes a row and sends mail on an unauthenticated route, so
  // the limit is tighter than login's.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register as a dentist; sends an email verification link.' })
  async register(@Body() dto: RegisterDentistDto) {
    await this.dentists.register(dto);
    // Deliberately identical whether or not the address was already taken —
    // anything else turns this form into a "does X bank with this lab?" oracle.
    return {
      message: 'Check your email for a link to confirm your address.',
    };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Confirm a registration email address.' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const { status } = await this.dentists.verifyEmail(dto.userId, dto.token);
    return {
      status,
      message:
        status === 'active'
          ? 'Your email is confirmed and your account is open. You can sign in.'
          : 'Thanks — your email is confirmed. The laboratory will review your application and email you once your account is open.',
    };
  }
}
