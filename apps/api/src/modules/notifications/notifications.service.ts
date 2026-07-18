import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repo: Repository<NotificationEntity>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly mail: MailService,
  ) {}

  async notify(input: NotifyInput): Promise<NotificationEntity> {
    const record = await this.repo.save(
      this.repo.create({
        userId: input.userId,
        type: input.type,
        subject: input.subject,
        body: input.body,
        channel: input.email ? NotificationChannel.EMAIL : NotificationChannel.IN_APP,
        status: NotificationStatus.PENDING,
        relatedCaseId: input.relatedCaseId ?? null,
        relatedInvoiceId: input.relatedInvoiceId ?? null,
      }),
    );

    if (input.email) {
      const user = await this.users.findOne({ where: { id: input.userId } });
      if (user) {
        await this.mail.enqueue({
          to: user.email,
          subject: input.subject,
          html: input.email.html,
          text: input.email.text,
        });
      }
    }

    await this.repo.update(record.id, {
      status: NotificationStatus.SENT,
      sentAt: new Date(),
    });
    record.status = NotificationStatus.SENT;
    return record;
  }

  /** Fan a notification out to every admin — used for lab-inbox events. */
  async notifyAdmins(input: Omit<NotifyInput, 'userId'>): Promise<void> {
    const admins = await this.users.find({
      where: {
        role: In([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
        status: UserStatus.ACTIVE,
      },
    });
    await Promise.all(admins.map((admin) => this.notify({ ...input, userId: admin.id })));
  }

  /** Broadcast to every active dentist (admin ad-hoc announcement). */
  async broadcastToDentists(input: Omit<NotifyInput, 'userId'>): Promise<{ recipients: number }> {
    const dentists = await this.users.find({
      where: { role: UserRole.DENTIST, status: UserStatus.ACTIVE },
    });
    await Promise.all(dentists.map((d) => this.notify({ ...input, userId: d.id })));
    return { recipients: dentists.length };
  }

  async listForUser(
    userId: string,
    query: { unreadOnly?: boolean; page?: number; limit?: number },
  ): Promise<Paginated<NotificationEntity>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip(skip)
      .take(take);
    if (query.unreadOnly) qb.andWhere('n.readAt IS NULL');
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  countUnread(userId: string): Promise<number> {
    return this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId AND n.readAt IS NULL', { userId })
      .getCount();
  }

  /** Scoped to the caller so one user can never mark another's items read. */
  async markRead(userId: string, id: string): Promise<void> {
    await this.repo.update(
      { id, userId },
      { readAt: new Date(), status: NotificationStatus.READ },
    );
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.repo
      .createQueryBuilder()
      .update(NotificationEntity)
      .set({ readAt: new Date(), status: NotificationStatus.READ })
      .where('userId = :userId AND readAt IS NULL', { userId })
      .execute();
    return { updated: result.affected ?? 0 };
  }

  /** Admin-facing delivery log across all users. */
  async listAll(query: {
    type?: NotificationType;
    page?: number;
    limit?: number;
  }): Promise<Paginated<NotificationEntity>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const qb = this.repo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.user', 'user')
      .orderBy('n.createdAt', 'DESC')
      .skip(skip)
      .take(take);
    if (query.type) qb.andWhere('n.type = :type', { type: query.type });
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }
}
