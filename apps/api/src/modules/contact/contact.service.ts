import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ContactMessage } from '../../database/entities';
import { MailService } from '../../mail/mail.service';
import { MailConfig } from '../../config/mail';
import { emailTemplates } from '../../mail/templates';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';
import { CreateContactDto, ListContactDto } from './contact.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactMessage) private readonly repo: Repository<ContactMessage>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateContactDto, ipAddress: string | null): Promise<ContactMessage> {
    const message = await this.repo.save(
      this.repo.create({
        name: dto.name,
        email: dto.email,
        subject: dto.subject,
        message: dto.message,
        ipAddress,
      }),
    );

    // Notify the lab inbox (fire-and-forget via the email queue).
    const mailCfg = this.config.get<MailConfig>('mail')!;
    const tpl = emailTemplates.contactReceived(dto);
    await this.mail.enqueue({ to: mailCfg.fromAddress, ...tpl });

    return message;
  }

  async list(query: ListContactDto): Promise<Paginated<ContactMessage>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const qb = this.repo.createQueryBuilder('c');
    if (query.handled !== undefined) qb.andWhere('c.isHandled = :h', { h: query.handled });
    qb.orderBy('c.createdAt', 'DESC').skip(skip).take(take);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, page, limit);
  }

  async markHandled(id: string): Promise<ContactMessage> {
    const msg = await this.repo.findOne({ where: { id } });
    if (!msg) throw new NotFoundException('Message not found');
    msg.isHandled = true;
    return this.repo.save(msg);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Message not found');
  }
}
