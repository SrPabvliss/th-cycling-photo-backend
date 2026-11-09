import type { UpdateMyProfileDto } from './update-my-profile.dto'

export class UpdateMyProfileCommand {
  constructor(
    public readonly userId: string,
    public readonly data: UpdateMyProfileDto,
  ) {}
}
