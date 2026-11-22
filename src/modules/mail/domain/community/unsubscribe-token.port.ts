export interface IUnsubscribeTokenService {
  sign(userId: string): string
  /** The user id the token was signed for, or null when it was not signed by us. */
  verify(token: string): string | null
}

export const UNSUBSCRIBE_TOKEN_SERVICE = Symbol('UNSUBSCRIBE_TOKEN_SERVICE')
