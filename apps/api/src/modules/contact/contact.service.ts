import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { FilterQuery, Model } from 'mongoose';
import { ContactMessage } from '../../database/entities';
import { MailService } from '../../mail/mail.service';
import { MailConfig } from '../../config/mail';
import { emailTemplates } from '../../mail/templates';
import { Paginated, paginate, resolvePagination } from '../../common/utils/pagination';
import { CreateContactDto, ListContactDto } from './contact.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(ContactMessage.name) private readonly repo: Model<ContactMessage>,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateContactDto, ipAddress: string | null): Promise<ContactMessage> {
    const message = await this.repo.create({
      name: dto.name,
      email: dto.email,
      subject: dto.subject,
      message: dto.message,
      ipAddress,
    });

    // Notify the lab inbox (fire-and-forget via the email queue).
    const mailCfg = this.config.get<MailConfig>('mail')!;
    const tpl = emailTemplates.contactReceived(dto);
    await this.mail.enqueue({ to: mailCfg.fromAddress, ...tpl });

    return message;
  }

  async list(query: ListContactDto): Promise<Paginated<ContactMessage>> {
    const { skip, take, page, limit } = resolvePagination(query.page, query.limit);
    const filter: FilterQuery<ContactMessage> = {};
    if (query.handled !== undefined) filter.isHandled = query.handled;

    const [data, total] = await Promise.all([
      this.repo.find(filter).sort({ createdAt: -1 }).skip(skip).limit(take).exec(),
      this.repo.countDocuments(filter).exec(),
    ]);
    return paginate(data, total, page, limit);
  }

  async markHandled(id: string): Promise<ContactMessage> {
    const msg = await this.repo.findById(id).exec();
    if (!msg) throw new NotFoundException('Message not found');
    msg.isHandled = true;
    return msg.save();
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.deleteOne({ _id: id }).exec();
    if (!res.deletedCount) throw new NotFoundException('Message not found');
  }
}
