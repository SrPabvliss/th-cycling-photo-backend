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

  async generateImageEmbedding(imageUrl: string): Promise<EmbeddingResult> {
    try {
      const response = await this.client.multimodalEmbed({
        inputs: [{ content: [{ type: 'image_url', imageUrl }] }],
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
