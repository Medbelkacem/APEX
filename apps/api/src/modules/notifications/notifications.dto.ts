import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { NotificationType } from '@dental/shared-types';

export const listNotificationsSchema = z.object({
  // `z.coerce.boolean()` is `Boolean(value)`, which makes the *string* "false"
  // truthy — so ?unreadOnly=false would filter to unread-only, the opposite of
  // what was asked. Parse the string explicitly instead.
  unreadOnly: z.preprocess(
    (v) => (typeof v === 'string' ? v === 'true' || v === '1' : v),
    z.boolean().optional(),
  ),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export class ListNotificationsDto extends createZodDto(listNotificationsSchema) {}

export const listNotificationLogSchema = z.object({
  type: z.nativeEnum(NotificationType).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export class ListNotificationLogDto extends createZodDto(listNotificationLogSchema) {}

/** Ad-hoc admin message: to one dentist by user id, or to every active dentist. */
export const broadcastSchema = z
  .object({
    userId: z.string().uuid().optional(),
    broadcast: z.boolean().optional(),
    subject: z.string().min(1).max(255),
    message: z.string().min(1).max(5000),
  })
  .refine((v) => Boolean(v.userId) !== Boolean(v.broadcast), {
    message: 'Provide either a userId or broadcast: true, not both',
  });
export class BroadcastDto extends createZodDto(broadcastSchema) {}
