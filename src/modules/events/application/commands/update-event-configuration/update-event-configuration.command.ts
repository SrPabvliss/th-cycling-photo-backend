import type { ConfigurationSelection } from '@events/application/services/event-configuration.service'

export class UpdateEventConfigurationCommand {
  constructor(
    public readonly id: string,
    public readonly actorUserId: string,
    public readonly selection: ConfigurationSelection,
  ) {}
}
