import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain'
import { VoyageAIClient } from 'voyageai'
import type { EmbeddingResult, IEmbeddingAdapter } from '../../domain/ports'

@Injectable()
export class VoyageAIEmbeddingAdapter implements IEmbeddingAdapter {
  private readonly client: VoyageAIClient

  constructor(configService: ConfigService) {
    const apiKey = configService.get<string>('voyageAi.apiKey')
    this.client = new VoyageAIClient({ apiKey })
  }

  /** Generates an image embedding from a base64-encoded data URL (data:image/jpeg;base64,...). */
  async generateImageEmbedding(imageBase64: string): Promise<EmbeddingResult> {
    try {
      const response = await this.client.multimodalEmbed({
        inputs: [{ content: [{ type: 'image_base64', imageBase64 }] }],
        model: 'voyage-multimodal-3.5',
      })

      const embedding = response.data?.[0]?.embedding
      if (!embedding) {
        throw new Error('No embedding returned from VoyageAI')
      }

      return {
        embedding,
        totalTokens: response.usage?.totalTokens ?? 0,
      }
    } catch (error) {
      if (error instanceof AppException) throw error
      throw AppException.externalService('VoyageAI', error instanceof Error ? error : undefined)
    }
  }
}
