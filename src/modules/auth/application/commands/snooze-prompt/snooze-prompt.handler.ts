import { Inject } from '@nestjs/common'
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs'
import { AppException } from '@shared/domain'
import {
  PROMPT_PRIORITY,
  PROMPT_SNOOZE_DURATION_MS,
  type PromptKey,
} from '../../../domain/constants/user-prompt.constants'
import {
  type IUserPromptSnoozeRepository,
  USER_PROMPT_SNOOZE_REPOSITORY,
} from '../../../domain/ports'
import { SnoozePromptCommand } from './snooze-prompt.command'

const isKnownPromptKey = (key: string): key is PromptKey =>
  (PROMPT_PRIORITY as string[]).includes(key)

@CommandHandler(SnoozePromptCommand)
export class SnoozePromptHandler implements ICommandHandler<SnoozePromptCommand> {
  constructor(
    @Inject(USER_PROMPT_SNOOZE_REPOSITORY)
    private readonly promptSnoozeRepo: IUserPromptSnoozeRepository,
  ) {}

  async execute(command: SnoozePromptCommand): Promise<void> {
    if (!isKnownPromptKey(command.promptKey)) {
      throw AppException.businessRule('auth.prompt_key_unknown')
    }

    const until = new Date(Date.now() + PROMPT_SNOOZE_DURATION_MS)
    await this.promptSnoozeRepo.snooze(command.userId, command.promptKey, until)
  }
}
