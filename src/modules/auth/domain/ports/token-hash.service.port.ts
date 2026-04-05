export interface ITokenHashService {
  /**
   * Hashes a raw token string using SHA-256.
   * Used to securely store and compare refresh tokens.
   */
  hash(rawToken: string): string

  /**
   * Generates a new random UUID token.
   */
  generateToken(): string
}

export const TOKEN_HASH_SERVICE = Symbol('TOKEN_HASH_SERVICE')
