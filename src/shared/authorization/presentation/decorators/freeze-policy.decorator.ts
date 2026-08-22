import { SetMetadata } from '@nestjs/common'

export const BLOCKS_WHEN_FROZEN_KEY = 'freeze:blocks'
export const ALLOWED_WHEN_FROZEN_KEY = 'freeze:allowed'

export const BlocksWhenFrozen = () => SetMetadata(BLOCKS_WHEN_FROZEN_KEY, true)
export const AllowedWhenFrozen = () => SetMetadata(ALLOWED_WHEN_FROZEN_KEY, true)
