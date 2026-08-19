export class GetPhotoDownloadUrlQuery {
  constructor(
    public readonly photoId: string,
    public readonly type: 'original' | 'retouched',
    public readonly userId: string,
  ) {}
}
