import { AppException } from '@shared/domain'
import { User } from './user.entity'

describe('User Entity', () => {
  const validData = {
    email: 'test@example.com',
    passwordHash: '$2b$10$somehash',
    firstName: 'Pablo',
    lastName: 'Villacres',
  }

  describe('create', () => {
    it('should create a valid user', () => {
      const user = User.create(validData)

      expect(user.id).toBeDefined()
      expect(user.email).toBe('test@example.com')
      expect(user.firstName).toBe('Pablo')
      expect(user.lastName).toBe('Villacres')
      expect(user.isActive).toBe(true)
      expect(user.avatarUrl).toBeNull()
      expect(user.lastLoginAt).toBeNull()
    })

    it('should reject invalid email', () => {
      expect(() => User.create({ ...validData, email: 'not-an-email' })).toThrow(AppException)
    })

    it('should reject empty first name', () => {
      expect(() => User.create({ ...validData, firstName: '' })).toThrow(AppException)
    })

    it('should reject empty last name', () => {
      expect(() => User.create({ ...validData, lastName: '' })).toThrow(AppException)
    })
  })

  describe('update', () => {
    it('should update first name and last name', () => {
      const user = User.create(validData)
      user.update({ firstName: 'Updated', lastName: 'Name' })

      expect(user.firstName).toBe('Updated')
      expect(user.lastName).toBe('Name')
    })
  })

  describe('deactivate / reactivate', () => {
    it('should deactivate an active user', () => {
      const user = User.create(validData)
      user.deactivate()
      expect(user.isActive).toBe(false)
    })

    it('should throw when deactivating already inactive user', () => {
      const user = User.create(validData)
      user.deactivate()
      expect(() => user.deactivate()).toThrow('user.already_deactivated')
    })

    it('should reactivate an inactive user', () => {
      const user = User.create(validData)
      user.deactivate()
      user.reactivate()
      expect(user.isActive).toBe(true)
    })

    it('should throw when reactivating already active user', () => {
      const user = User.create(validData)
      expect(() => user.reactivate()).toThrow('user.already_active')
    })
  })

  describe('avatar', () => {
    it('should set avatar', () => {
      const user = User.create(validData)
      user.setAvatar('https://cdn.example.com/avatar.jpg', 'users/123/avatar/avatar.jpg')

      expect(user.avatarUrl).toBe('https://cdn.example.com/avatar.jpg')
      expect(user.avatarStorageKey).toBe('users/123/avatar/avatar.jpg')
    })

    it('should remove avatar', () => {
      const user = User.create(validData)
      user.setAvatar('https://cdn.example.com/avatar.jpg', 'users/123/avatar/avatar.jpg')
      user.removeAvatar()

      expect(user.avatarUrl).toBeNull()
      expect(user.avatarStorageKey).toBeNull()
    })
  })

  describe('fromPersistence', () => {
    it('should reconstitute without validations', () => {
      const user = User.fromPersistence({
        id: 'some-id',
        email: 'bad-email',
        passwordHash: 'hash',
        firstName: null,
        lastName: null,
        avatarUrl: null,
        avatarStorageKey: null,
        isActive: false,
        createdAt: new Date(),
        lastLoginAt: null,
      })

      expect(user.id).toBe('some-id')
      expect(user.email).toBe('bad-email')
      expect(user.isActive).toBe(false)
    })
  })
})
