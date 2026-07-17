import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

/** A submission from the public marketing contact form. */
@Entity('contact_messages')
export class ContactMessage extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  /** Whether an admin has followed up on this message. */
  @Column({ type: 'boolean', default: false })
  isHandled: boolean;
}
