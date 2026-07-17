import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { CaseFileType } from '@dental/shared-types';
import { BaseEntity } from './base.entity';
import { DentalCase } from './case.entity';
import { User } from './user.entity';

/** A file attached to a case — STL scan, image, document, or lab output. */
@Entity('case_files')
export class CaseFile extends BaseEntity {
  @Column({ type: 'uuid' })
  caseId: string;

  @ManyToOne(() => DentalCase, (c) => c.files, { onDelete: 'CASCADE' })
  @JoinColumn()
  case: DentalCase;

  @Column({ type: 'enum', enum: CaseFileType })
  fileType: CaseFileType;

  @Column({ type: 'varchar', length: 255 })
  originalFilename: string;

  /** Relative path on the active storage backend (never a web-root path). */
  @Column({ type: 'varchar', length: 512 })
  storedPath: string;

  @Column({ type: 'varchar', length: 150 })
  mimeType: string;

  @Column({ type: 'bigint' })
  sizeBytes: number;

  @Column({ type: 'uuid', nullable: true })
  uploadedByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  uploadedByUser: User | null;
}
