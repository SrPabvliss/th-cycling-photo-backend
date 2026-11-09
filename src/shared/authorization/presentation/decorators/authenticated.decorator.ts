import { SetMetadata } from '@nestjs/common'

export const IS_AUTHENTICATED_KEY = 'authz:authenticated'

/** Valid JWT, acting on own resource. No authorization decision is made. */
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED_KEY, true)
