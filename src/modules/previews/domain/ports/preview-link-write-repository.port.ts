import type { PreviewLink } from '../entities'

export interface IPreviewLinkWriteRepository {
  save(previewLink: PreviewLink): Promise<PreviewLink>
  savePhotos(previewLinkId: string, photoIds: string[]): Promise<void>
}

export const PREVIEW_LINK_WRITE_REPOSITORY = Symbol('PREVIEW_LINK_WRITE_REPOSITORY')
