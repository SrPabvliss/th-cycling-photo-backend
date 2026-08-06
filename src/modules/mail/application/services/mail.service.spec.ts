import { MailService } from './mail.service'

describe('MailService', () => {
  it('should enqueue a job with retry policy and no raw secrets', async () => {
    const queue = { add: jest.fn().mockResolvedValue(undefined) }
    const service = new MailService(queue as never)

    await service.enqueue({
      to: 'user@test.com',
      subject: 'Restablecer tu contraseña',
      template: 'password-reset',
      vars: {
        firstName: 'Pablo',
        resetUrl: 'https://app/reset-password#t=x',
        logoUrl: 'https://cdn/logo.png',
      },
    })

    expect(queue.add).toHaveBeenCalledTimes(1)
    const [name, data, options] = queue.add.mock.calls[0]
    expect(name).toBe('send')
    expect(data.template).toBe('password-reset')
    expect(options.attempts).toBe(3)
    expect(options.backoff).toEqual({ type: 'exponential', delay: 5000 })
    expect(options.removeOnComplete).toBe(true)
    expect(options.removeOnFail).toEqual({ age: 1800 })
  })
})
