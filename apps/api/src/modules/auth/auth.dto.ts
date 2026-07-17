import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { checkPasswordPolicy } from '../../common/utils/password-policy';

/** Password field validated against the DRS policy (length + classes + deny-list). */
export const strongPassword = z.string().superRefine((val, ctx) => {
  const { valid, errors } = checkPasswordPolicy(val);
  if (!valid) {
    for (const message of errors) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  }
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});
export class LoginDto extends createZodDto(loginSchema) {}

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

export const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  token: z.string().min(10),
  password: strongPassword,
});
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}

/** First-login: a newly invited dentist sets their initial password. */
export const setupPasswordSchema = resetPasswordSchema;
export class SetupPasswordDto extends createZodDto(setupPasswordSchema) {}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPassword,
});
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
});
export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
