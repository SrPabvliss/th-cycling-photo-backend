export class GetPreviewByTokenQuery {
  constructor(
    public readonly token: string,
    /** The signed-in viewer, or null for an anonymous one. */
    public readonly viewerUserId: string | null = null,
  ) {}
}
