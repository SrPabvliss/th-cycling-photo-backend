import type { CommunityCampaign } from '../../../domain/community'

export class SendCommunityTestCommand {
  constructor(
    public readonly userId: string,
    public readonly campaign: CommunityCampaign,
  ) {}
}
