import { Test } from '@nestjs/testing'
import { KV_STORAGE_ADAPTER } from '@shared/cloudflare/domain/ports'
import { AppException } from '@shared/domain'
import { WatermarkNormalizer } from '@shared/images'
import { STORAGE_ADAPTER } from '@shared/storage/domain/ports'
import { USER_READ_REPOSITORY } from '@users/domain/ports'
import { TenantProfile } from '../../../domain/entities/tenant-profile.entity'
import { TENANT_PROFILE_REPOSITORY } from '../../../domain/ports/tenant-profile-repository.port'
import { ConfirmWatermarkUploadCommand } from './confirm-watermark-upload.command'
import { ConfirmWatermarkUploadHandler } from './confirm-watermark-upload.handler'

describe('ConfirmWatermarkUploadHandler', () => {
  const TENANT_ID = 't-1'
  let handler: ConfirmWatermarkUploadHandler
  let profileRepo: { findByTenantId: jest.Mock; save: jest.Mock }
  let userRepo: { findTenantId: jest.Mock }
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
    kv = { write: jest.fn().mockResolvedValue(undefined), delete: jest.fn() }
    handler = new ConfirmWatermarkUploadHandler(
      profileRepo as never,
      userRepo as never,
      kv as never,
      { normalize: jest.fn().mockResolvedValue(undefined) } as never,
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

  it('rejects a path-traversal key that lexically starts with the caller tenant prefix', async () => {
    profileRepo.findByTenantId.mockResolvedValue(profileWith(null))

    await expect(
      handler.execute(
        new ConfirmWatermarkUploadCommand('u-1', 'tenants/t-1/watermark/../../other/photos/x.jpg'),
      ),
    ).rejects.toThrow(AppException)

    expect(profileRepo.save).not.toHaveBeenCalled()
    expect(kv.write).not.toHaveBeenCalled()
  })

  it('stores the key and publishes it to KV', async () => {
    profileRepo.findByTenantId.mockResolvedValue(profileWith('tenants/t-1/watermark/old-logo.png'))

    await handler.execute(
      new ConfirmWatermarkUploadCommand('u-1', 'tenants/t-1/watermark/new-logo.png'),
    )

    expect(profileRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ watermarkStorageKey: 'tenants/t-1/watermark/new-logo.png' }),
    )
    expect(kv.write).toHaveBeenCalledWith('wm-tenant-t-1', 'tenants/t-1/watermark/new-logo.png')
  })

  it('never deletes the replaced object, which existing events are still frozen onto', async () => {
    profileRepo.findByTenantId.mockResolvedValue(profileWith('tenants/t-1/watermark/old-logo.png'))
    const storage = { delete: jest.fn().mockResolvedValue(undefined) }
    // Resolved through DI so a re-added STORAGE_ADAPTER injection would be wired and caught here.
    const module = await Test.createTestingModule({
      providers: [
        ConfirmWatermarkUploadHandler,
        { provide: TENANT_PROFILE_REPOSITORY, useValue: profileRepo },
        { provide: USER_READ_REPOSITORY, useValue: userRepo },
        { provide: KV_STORAGE_ADAPTER, useValue: kv },
        { provide: STORAGE_ADAPTER, useValue: storage },
        { provide: WatermarkNormalizer, useValue: { normalize: jest.fn() } },
      ],
    }).compile()

    await module
      .get(ConfirmWatermarkUploadHandler)
      .execute(new ConfirmWatermarkUploadCommand('u-1', 'tenants/t-1/watermark/new-logo.png'))

    expect(storage.delete).not.toHaveBeenCalled()
  })
})
