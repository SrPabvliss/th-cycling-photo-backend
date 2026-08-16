import type { ConsentType } from '../../../domain/constants/consent.constants'

export class RecordConsentsCommand {
  constructor(
    public readonly userId: string,
    public readonly types: ConsentType[],
    public readonly ipAddress?: string | null,
    public readonly userAgent?: string | null,
  ) {}
}
