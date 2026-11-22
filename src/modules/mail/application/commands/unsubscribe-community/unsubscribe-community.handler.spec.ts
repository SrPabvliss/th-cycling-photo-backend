import { RevokeConsentsCommand } from '@auth/application/commands/revoke-consents/revoke-consents.command'
import { CONSENT_TYPE } from '@auth/domain/constants/consent.constants'
import type { CommandBus } from '@nestjs/cqrs'
import type { IUnsubscribeTokenService } from '../../../domain/community'
import { UnsubscribeCommunityCommand } from './unsubscribe-community.command'
import { UnsubscribeCommunityHandler } from './unsubscribe-community.handler'

describe('UnsubscribeCommunityHandler', () => {
  const tokens: jest.Mocked<IUnsubscribeTokenService> = { sign: jest.fn(), verify: jest.fn() }
  const commandBus = {
    execute: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<CommandBus>
  const handler = new UnsubscribeCommunityHandler(tokens, commandBus)

  beforeEach(() => jest.clearAllMocks())

  it('withdraws the community emails consent of the user the token names', async () => {
    tokens.verify.mockReturnValue('user-1')

    await expect(handler.execute(new UnsubscribeCommunityCommand('good'))).resolves.toEqual({
      unsubscribed: true,
    })
    expect(commandBus.execute).toHaveBeenCalledWith(
      new RevokeConsentsCommand('user-1', [CONSENT_TYPE.COMMUNITY_EMAILS]),
    )
  })

  it('rejects a token it did not sign', async () => {
    tokens.verify.mockReturnValue(null)

    await expect(handler.execute(new UnsubscribeCommunityCommand('forged'))).rejects.toThrow()
    expect(commandBus.execute).not.toHaveBeenCalled()
  })
})
