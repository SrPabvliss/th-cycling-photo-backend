const ASSET_PREFIX = 'asset:'

export class CdnSubject {
  static forAsset(assetId: string): string {
    return `${ASSET_PREFIX}${assetId}`
  }
}
