export class ChangePasswordCommand {
  constructor(
    readonly userId: string,
    readonly currentPassword: string,
    readonly newPassword: string,
    readonly role: string,
    readonly refreshToken: string | null,
  ) {}
}
