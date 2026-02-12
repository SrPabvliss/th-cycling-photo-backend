import { Injectable } from '@nestjs/common'
import type { Photo } from '@photos/domain/entities'
import type { IPhotoReadRepository } from '@photos/domain/ports'
import { PrismaService } from '@shared/infrastructure'
import * as PhotoMapper from '../mappers/photo.mapper'

@Injectable()
export class PhotoReadRepository implements IPhotoReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds a photo by ID (no soft-delete filter — photos use hard delete). */
  async findById(id: string): Promise<Photo | null> {
    const record = await this.prisma.photo.findUnique({ where: { id } })
    return record ? PhotoMapper.toEntity(record) : null
  }
}
