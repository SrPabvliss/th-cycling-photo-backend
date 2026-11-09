import { PhotoWriteRepository } from './photo-write.repository'

describe('PhotoWriteRepository.claimPhotoQuota', () => {
  const makeTx = (affected: number) =>
    ({ $executeRaw: jest.fn().mockResolvedValue(affected) }) as never

  it('reports the claim as granted when a row was updated', async () => {
    const repo = new PhotoWriteRepository({} as never)
    await expect(repo.claimPhotoQuota('event-1', 3, makeTx(1))).resolves.toBe(true)
  })

  it('reports the claim as refused when the cap would be exceeded', async () => {
    const repo = new PhotoWriteRepository({} as never)
    await expect(repo.claimPhotoQuota('event-1', 3, makeTx(0))).resolves.toBe(false)
  })
})
