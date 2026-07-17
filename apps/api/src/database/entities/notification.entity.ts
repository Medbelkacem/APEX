import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@dental/shared-types';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

/** Email and in-app notification log. */
@Entity('notifications')
@Index(['userId', 'status'])
export class NotificationEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, (u) => u.notifications, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
  status: NotificationStatus;

  @Column({ type: 'uuid', nullable: true })
  relatedCaseId: string | null;

  @Column({ type: 'uuid', nullable: true })
  relatedInvoiceId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;
}
