import type { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain'
import { VoyageAIEmbeddingAdapter } from './voyage-ai.adapter'

jest.mock('voyageai', () => ({
  VoyageAIClient: jest.fn().mockImplementation(() => ({
    multimodalEmbed: jest.fn(),
  })),
}))

describe('VoyageAIEmbeddingAdapter', () => {
  let adapter: VoyageAIEmbeddingAdapter
  let mockMultimodalEmbed: jest.Mock

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-api-key'),
  } as unknown as ConfigService

  beforeEach(() => {
    jest.clearAllMocks()
    adapter = new VoyageAIEmbeddingAdapter(mockConfigService)
    mockMultimodalEmbed = (adapter as unknown as { client: { multimodalEmbed: jest.Mock } }).client
      .multimodalEmbed
  })

  it('should generate an image embedding successfully', async () => {
    const mockEmbedding = Array.from({ length: 1024 }, (_, i) => i * 0.001)
    mockMultimodalEmbed.mockResolvedValueOnce({
      data: [{ embedding: mockEmbedding }],
      usage: { totalTokens: 42 },
    })

    const base64 = 'data:image/jpeg;base64,/9j/4AAQ...'
    const result = await adapter.generateImageEmbedding(base64)

    expect(result.embedding).toEqual(mockEmbedding)
    expect(result.totalTokens).toBe(42)
    expect(mockMultimodalEmbed).toHaveBeenCalledWith({
      inputs: [{ content: [{ type: 'image_base64', imageBase64: base64 }] }],
      model: 'voyage-multimodal-3.5',
    })
  })

  it('returns the pixels Voyage billed when the response carries them', async () => {
    mockMultimodalEmbed.mockResolvedValueOnce({
      data: [{ embedding: [0.1] }],
      usage: { totalTokens: 3046, image_pixels: 1705600 },
    })

    const result = await adapter.generateImageEmbedding('data:image/jpeg;base64,test')

    expect(result.imagePixels).toBe(1705600)
  })

  it('returns no pixel count when the response does not carry one', async () => {
    mockMultimodalEmbed.mockResolvedValueOnce({
      data: [{ embedding: [0.1] }],
      usage: { totalTokens: 3046 },
    })

    const result = await adapter.generateImageEmbedding('data:image/jpeg;base64,test')

    expect(result.imagePixels).toBeNull()
  })

  it('should throw AppException when no embedding is returned', async () => {
    mockMultimodalEmbed.mockResolvedValueOnce({
      data: [],
      usage: { totalTokens: 0 },
    })

    const error = await adapter
      .generateImageEmbedding('data:image/jpeg;base64,test')
      .catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('EXTERNAL_SERVICE')
  })

  it('should throw AppException on SDK error', async () => {
    mockMultimodalEmbed.mockRejectedValueOnce(new Error('API rate limit exceeded'))

    const error = await adapter
      .generateImageEmbedding('data:image/jpeg;base64,test')
      .catch((e) => e)

    expect(error).toBeInstanceOf(AppException)
    expect(error.code).toBe('EXTERNAL_SERVICE')
    expect(error.context).toEqual(
      expect.objectContaining({ service: 'VoyageAI', originalError: 'API rate limit exceeded' }),
    )
  })
})
