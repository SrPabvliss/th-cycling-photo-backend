import { ConfigModule } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import configuration from '../../../../config/configuration'
import { validate } from '../../../../config/env.validation'
import { type IStorageAdapter, STORAGE_ADAPTER } from '../../domain/ports'
import { BackblazeB2Adapter } from './backblaze-b2.adapter'

const hasCredentials = Boolean(
  process.env.B2_APPLICATION_KEY_ID && process.env.B2_APPLICATION_KEY_ID !== 'test-key-id',
)

const describeIf = hasCredentials ? describe : describe.skip

describeIf('BackblazeB2Adapter (Integration)', () => {
  let module: TestingModule
  let adapter: IStorageAdapter
  const testKey = `integration-test/${Date.now()}-test.txt`

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
          validate,
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [{ provide: STORAGE_ADAPTER, useClass: BackblazeB2Adapter }],
    }).compile()

    adapter = module.get<IStorageAdapter>(STORAGE_ADAPTER)
  })

  afterAll(async () => {
    // Clean up: delete test file
    try {
      await adapter.delete(testKey)
    } catch {
      // Ignore cleanup errors
    }
    await module.close()
  })

  it('should upload a file and return a public URL', async () => {
    const result = await adapter.upload({
      buffer: Buffer.from('integration test content'),
      key: testKey,
      contentType: 'text/plain',
    })

    expect(result.key).toBe(testKey)
    expect(result.url).toContain(testKey)
  })

  it('should generate a public URL for a key', () => {
    const url = adapter.getPublicUrl(testKey)
    expect(url).toContain(testKey)
  })

  it('should delete a file without error', async () => {
    await expect(adapter.delete(testKey)).resolves.not.toThrow()
  })
})
