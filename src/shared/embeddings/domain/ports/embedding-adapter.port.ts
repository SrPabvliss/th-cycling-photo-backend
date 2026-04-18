export interface EmbeddingResult {
  embedding: number[]
  totalTokens: number
}

export interface IEmbeddingAdapter {
  generateImageEmbedding(imageBase64: string): Promise<EmbeddingResult>
}

export const EMBEDDING_ADAPTER = Symbol('EMBEDDING_ADAPTER')
