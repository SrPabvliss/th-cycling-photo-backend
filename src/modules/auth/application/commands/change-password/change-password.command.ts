export class ChangePasswordCommand {
  constructor(
    readonly userId: string,
    readonly currentPassword: string,
    readonly newPassword: string,
  ) {}
}
