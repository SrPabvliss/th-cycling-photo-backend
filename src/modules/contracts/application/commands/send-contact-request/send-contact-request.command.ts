export type ContactReason = 'more_quota' | 'renewal'

export class SendContactRequestCommand {
  constructor(
    readonly userId: string,
    readonly reason: ContactReason,
    readonly eventsWanted: number | null,
    readonly message: string,
  ) {}
}
