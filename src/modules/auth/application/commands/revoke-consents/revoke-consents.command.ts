import type { ConsentType } from '../../../domain/constants/consent.constants'

export class RevokeConsentsCommand {
  constructor(
    public readonly userId: string,
    public readonly types: ConsentType[],
  ) {}
}
