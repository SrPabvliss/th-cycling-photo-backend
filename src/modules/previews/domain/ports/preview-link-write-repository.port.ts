import type { PreviewLink } from '../entities'

export interface IPreviewLinkWriteRepository {
  save(previewLink: PreviewLink): Promise<PreviewLink>
  saveWithPhotos(previewLink: PreviewLink, photoIds: string[]): Promise<PreviewLink>
}

export const PREVIEW_LINK_WRITE_REPOSITORY = Symbol('PREVIEW_LINK_WRITE_REPOSITORY')
