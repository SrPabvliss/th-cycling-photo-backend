export class GalleryFacetCategory {
  id: number
  name: string
  count: number
}

export class GalleryFacetsProjection {
  /** Every live photo of the event */
  total: number
  /** No live bib row — nobody finds these by typing a number */
  withoutBib: number
  withBib: number
  /** Read by the model below its own threshold and untouched since */
  doubtfulBib: number
  /** A person wrote the bib or corrected what the model read */
  correctedBib: number
  uncategorized: number
  /** In an order whose status is paid or delivered */
  sold: number
  unsold: number
  categories: GalleryFacetCategory[]
}
