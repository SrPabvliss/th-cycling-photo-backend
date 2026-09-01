/**
 * The gallery mosaic repeats the watermark edge to edge: Cloudflare has no spacing option, so the
 * only air between stamps is the transparency the file itself carries. The platform's own mark
 * leaves the logo at about two thirds of its canvas, and that is the density calibrated over real
 * photos: enough air to read the picture, tight enough that the mark still covers it.
 *
 * An organiser uploading a logo cropped to its own edges would tile it solid and bury the picture,
 * so every mark is re-centred on a canvas built to this ratio before it is ever drawn.
 */
export const LOGO_SHARE_OF_CANVAS = 0.69

/**
 * Anything already this airy is left alone: re-encoding it would only lose quality. The platform's
 * own mark sits at 0.67 on its tallest side, so the bar has to clear that.
 */
export const ACCEPTABLE_LOGO_SHARE = 0.75

export interface Box {
  width: number
  height: number
}

export function needsMargin(content: Box, canvas: Box): boolean {
  const share = Math.max(content.width / canvas.width, content.height / canvas.height)
  return share > ACCEPTABLE_LOGO_SHARE
}

/**
 * Square canvas sized so the trimmed logo occupies `LOGO_SHARE_OF_CANVAS` of its longest side. A
 * square keeps the horizontal and vertical gaps even whatever the logo's own proportions.
 */
export function canvasFor(content: Box): Box {
  const side = Math.round(Math.max(content.width, content.height) / LOGO_SHARE_OF_CANVAS)
  return { width: side, height: side }
}
