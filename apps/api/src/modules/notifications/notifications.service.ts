import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  UserRole,
  UserStatus,
} from '@dental/shared-types';
import { NotificationEntity, User } from '../../database/entities';
import { MailService } from '../../mail/mail.service';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  subject: string;
  /** Plain-text body shown in the in-app feed. */
  body: string;
  /** When provided, an email is queued in addition to the in-app record. */
  email?: { html: string; text: string };
  relatedCaseId?: string | null;
  relatedInvoiceId?: string | null;
}

/**
 * Single entry point for user-facing notifications. Every notification is
 * persisted as an in-app record (bell feed) and optionally mirrored to email
 * through the retrying mail queue — so the feed stays accurate even if an
 * email send later fails.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(NotificationEntity.name)
    private readonly repo: Model<NotificationEntity>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly mail: MailService,
  ) {}

  async notify(input: NotifyInput): Promise<NotificationEntity> {
    const record = await this.repo.create({
      userId: input.userId,
      type: input.type,
      subject: input.subject,
      body: input.body,
      channel: input.email ? NotificationChannel.EMAIL : NotificationChannel.IN_APP,
      status: NotificationStatus.PENDING,
      relatedCaseId: input.relatedCaseId ?? null,
      relatedInvoiceId: input.relatedInvoiceId ?? null,
    });

    let emailFailed = false;
    if (input.email) {
      const user = await this.users.findById(input.userId).exec();
      if (user) {
        try {
          await this.mail.enqueue({
            to: user.email,
            subject: input.subject,
            html: input.email.html,
            text: input.email.text,
          });
        } catch (err) {
          // The in-app record is already committed, and this notification is a
          // side effect of some larger operation that has itself committed
          // (a case submitted, an invoice issued). A mail-queue outage — Redis
          // unreachable — must not bubble up and turn that successful write
          // into a 500; record the email as failed and move on.
          emailFailed = true;
          this.logger.error(
            `Could not enqueue email for notification ${record.id}: ${String(err)}`,
          );
        }
      }
    }

    record.status = emailFailed ? NotificationStatus.FAILED : NotificationStatus.SENT;
    record.sentAt = emailFailed ? null : new Date();
    await record.save();
    return record;
  }

  /** Fan a notification out to every admin — used for lab-inbox events. */
  async notifyAdmins(input: Omit<NotifyInput, 'userId'>): Promise<void> {
    const admins = await this.users
      .find({ role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }, status: UserStatus.ACTIVE })
      .exec();
    await Promise.all(admins.map((admin) => this.notify({ ...input, userId: admin.id })));
  }

  /** Broadcast to every active dentist (admin ad-hoc announcement). */
  async broadcastToDentists(input: Omit<NotifyInput, 'userId'>): Promise<{ recipients: number }> {
    const dentists = await this.users
      .find({ role: UserRole.DENTIST, status: UserStatus.ACTIVE })
      .exec();
    await Promise.all(dentists.map((d) => this.notify({ ...input, userId: d.id })));
    return { recipients: dentists.length };
  }

  async listForUser(
    userId: string,
    query: { unreadOnly?: boolean; page?: number; limit?: number },
  ): Promise<Paginated<NotificationEntity>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const filter: FilterQuery<NotificationEntity> = { userId };
    if (query.unreadOnly) filter.readAt = null;

    const [data, total] = await Promise.all([
      this.repo.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).exec(),
      this.repo.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, page, limit);
  }

  countUnread(userId: string): Promise<number> {
    return this.repo.countDocuments({ userId, readAt: null }).exec();
  }

  /** Scoped to the caller so one user can never mark another's items read. */
  async markRead(userId: string, id: string): Promise<void> {
    await this.repo
      .updateOne({ _id: id, userId }, { readAt: new Date(), status: NotificationStatus.READ })
      .exec();
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.repo
      .updateMany({ userId, readAt: null }, { readAt: new Date(), status: NotificationStatus.READ })
      .exec();
    return { updated: result.modifiedCount ?? 0 };
  }

  /** Admin-facing delivery log across all users. */
  async listAll(query: {
    type?: NotificationType;
    page?: number;
    limit?: number;
  }): Promise<Paginated<NotificationEntity>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const filter: FilterQuery<NotificationEntity> = {};
    if (query.type) filter.type = query.type;

    const [data, total] = await Promise.all([
      this.repo
        .find(filter)
        .populate('user')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .exec(),
      this.repo.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, page, limit);
  }
}
