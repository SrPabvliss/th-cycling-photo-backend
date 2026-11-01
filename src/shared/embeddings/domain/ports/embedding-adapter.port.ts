export interface EmbeddingResult {
  embedding: number[]
  totalTokens: number
  imagePixels: number | null
}

export interface IEmbeddingAdapter {
  generateImageEmbedding(imageBase64: string): Promise<EmbeddingResult>
}

export const EMBEDDING_ADAPTER = Symbol('EMBEDDING_ADAPTER')
