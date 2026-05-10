import type { BibReadingStatus } from '@generated/prisma/client'

export class AddPhotoBibCommand {
  constructor(
    public readonly photoId: string,
    public readonly digits: string,
    public readonly status: BibReadingStatus | undefined,
    public readonly reviewerId: string,
  ) {}
}
