import type { ColorRegion } from '@generated/prisma/client'

export class AddPhotoColorCommand {
  constructor(
    public readonly photoId: string,
    public readonly region: ColorRegion,
    public readonly primaryColor: string,
    public readonly secondaryColor: string | null,
    public readonly reviewerId: string,
  ) {}
}
