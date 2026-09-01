import { canvasFor, needsMargin } from './watermark-canvas'

describe('watermark canvas', () => {
  it('leaves the platform mark alone: it already carries its own margin', () => {
    expect(needsMargin({ width: 200, height: 255 }, { width: 380, height: 380 })).toBe(false)
  })

  it('flags a logo cropped to its own edges', () => {
    expect(needsMargin({ width: 2222, height: 2830 }, { width: 2222, height: 2831 })).toBe(true)
  })

  it('flags a logo that fills one axis even when the other has room', () => {
    expect(needsMargin({ width: 400, height: 100 }, { width: 400, height: 400 })).toBe(true)
  })

  it('sizes a square canvas so the longest side keeps the platform ratio', () => {
    expect(canvasFor({ width: 2222, height: 2830 })).toEqual({ width: 4101, height: 4101 })
    expect(canvasFor({ width: 200, height: 100 })).toEqual({ width: 290, height: 290 })
  })

  it('squares an oblong logo so the gaps come out even in both directions', () => {
    const canvas = canvasFor({ width: 600, height: 150 })
    expect(canvas.width).toBe(canvas.height)
  })
})
