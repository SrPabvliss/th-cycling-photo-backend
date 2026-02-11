import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppException } from '@shared/domain/exceptions/app.exception'
import type { IStorageAdapter, UploadParams, UploadResult } from '../../domain/ports'

/**
 * Storage adapter for Backblaze B2 using the S3-compatible API.
 * Uses `@aws-sdk/client-s3` with a custom endpoint to interact with B2.
 */
@Injectable()
export class BackblazeB2Adapter implements IStorageAdapter {
  private readonly logger = new Logger(BackblazeB2Adapter.name)
  private readonly client: S3Client
  private readonly bucketName: string
  private readonly cdnUrl: string | undefined

  constructor(private readonly config: ConfigService) {
    const region = this.config.getOrThrow<string>('storage.b2.region')
    this.bucketName = this.config.getOrThrow<string>('storage.b2.bucketName')
    this.cdnUrl = this.config.get<string>('storage.cdnUrl')

    this.client = new S3Client({
      endpoint: `https://s3.${region}.backblazeb2.com`,
      region,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('storage.b2.applicationKeyId'),
        secretAccessKey: this.config.getOrThrow<string>('storage.b2.applicationKey'),
      },
    })
  }

  /** Uploads a file to Backblaze B2 and returns the storage key and public URL. */
  async upload(params: UploadParams): Promise<UploadResult> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: params.key,
          Body: params.buffer,
          ContentType: params.contentType,
        }),
      )

      return {
        key: params.key,
        url: this.getPublicUrl(params.key),
      }
    } catch (error) {
      this.logger.error(`Failed to upload file: ${params.key}`, error)
      throw AppException.externalService('BackblazeB2', error as Error)
    }
  }

  /** Constructs the public URL for a given storage key using CDN or B2 direct URL. */
  getPublicUrl(key: string): string {
    if (this.cdnUrl) return `${this.cdnUrl}/${key}`
    return `https://f005.backblazeb2.com/file/${this.bucketName}/${key}`
  }

  /** Deletes a file from Backblaze B2 by its storage key. */
  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      )
    } catch (error) {
      this.logger.error(`Failed to delete file: ${key}`, error)
      throw AppException.externalService('BackblazeB2', error as Error)
    }
  }
}
