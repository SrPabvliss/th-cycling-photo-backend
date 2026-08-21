import { AppException } from '@shared/domain'
import { TenantProfile } from '../../../domain/entities/tenant-profile.entity'
import { ConfirmWatermarkUploadCommand } from './confirm-watermark-upload.command'
import { ConfirmWatermarkUploadHandler } from './confirm-watermark-upload.handler'

describe('ConfirmWatermarkUploadHandler', () => {
  const TENANT_ID = 't-1'
  let handler: ConfirmWatermarkUploadHandler
  let profileRepo: { findByTenantId: jest.Mock; save: jest.Mock }
  let userRepo: { findTenantId: jest.Mock }
  let storage: { delete: jest.Mock }
  let kv: { write: jest.Mock; delete: jest.Mock }

  const profileWith = (watermarkStorageKey: string | null) =>
    TenantProfile.fromPersistence({
      id: TENANT_ID,
      name: 'Foto Andes',
      publicName: 'Foto Andes',
      watermarkStorageKey,
      whatsappNumber: '+593987654321',
      whatsappVerifiedAt: null,
    })

  beforeEach(() => {
    profileRepo = { findByTenantId: jest.fn(), save: jest.fn() }
    userRepo = { findTenantId: jest.fn().mockResolvedValue(TENANT_ID) }
    storage = { delete: jest.fn().mockResolvedValue(undefined) }
    kv = { write: jest.fn().mockResolvedValue(undefined), delete: jest.fn() }
    handler = new ConfirmWatermarkUploadHandler(
      profileRepo as never,
      userRepo as never,
      storage as never,
      kv as never,
    )
  })

  it('rejects a storage key outside the caller tenant prefix', async () => {
    profileRepo.findByTenantId.mockResolvedValue(profileWith(null))

    await expect(
      handler.execute(
        new ConfirmWatermarkUploadCommand('u-1', 'tenants/t-2/watermark/uuid-logo.png'),
      ),
    ).rejects.toThrow(AppException)

    expect(profileRepo.save).not.toHaveBeenCalled()
    expect(kv.write).not.toHaveBeenCalled()
  })

  it('stores the key, publishes it to KV and deletes the replaced object', async () => {
    profileRepo.findByTenantId.mockResolvedValue(profileWith('tenants/t-1/watermark/old-logo.png'))

    await handler.execute(
      new ConfirmWatermarkUploadCommand('u-1', 'tenants/t-1/watermark/new-logo.png'),
    )

    expect(profileRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ watermarkStorageKey: 'tenants/t-1/watermark/new-logo.png' }),
    )
    expect(storage.delete).toHaveBeenCalledWith('tenants/t-1/watermark/old-logo.png')
    expect(kv.write).toHaveBeenCalledWith('wm-tenant-t-1', 'tenants/t-1/watermark/new-logo.png')
  })
})
