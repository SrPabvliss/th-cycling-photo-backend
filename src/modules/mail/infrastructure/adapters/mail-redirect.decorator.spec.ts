import type { IMailer, MailMessage } from '../../domain/ports'
import { MailRedirectDecorator } from './mail-redirect.decorator'

describe('MailRedirectDecorator', () => {
  const message: MailMessage = {
    to: 'real@customer.com',
    subject: 'Restablecer tu contraseña',
    html: '<p>hola</p>',
    text: 'hola',
  }

  const buildInner = () => {
    const send = jest.fn().mockResolvedValue(undefined)
    return { send } as unknown as IMailer & { send: jest.Mock }
  }

  it('should pass the message through untouched when no redirect is configured', async () => {
    const inner = buildInner()
    await new MailRedirectDecorator(inner, '').send(message)

    expect(inner.send).toHaveBeenCalledWith(message)
  })

  it('should rewrite recipient, subject and body when a redirect is configured', async () => {
    const inner = buildInner()
    await new MailRedirectDecorator(inner, 'dev@personal.com').send(message)

    const sent = inner.send.mock.calls[0][0]
    expect(sent.to).toBe('dev@personal.com')
    expect(sent.subject).toBe('[DEV -> real@customer.com] Restablecer tu contraseña')
    expect(sent.html).toContain('real@customer.com')
    expect(sent.html).toContain('<p>hola</p>')
    expect(sent.text).toContain('real@customer.com')
    expect(sent.text).toContain('hola')
    expect(sent.headers['X-Original-To']).toBe('real@customer.com')
  })

  it('should preserve headers set upstream while adding X-Original-To', async () => {
    const inner = buildInner()
    await new MailRedirectDecorator(inner, 'dev@personal.com').send({
      ...message,
      headers: { 'X-Custom': 'keep-me' },
    })

    const sent = inner.send.mock.calls[0][0]
    expect(sent.headers['X-Custom']).toBe('keep-me')
    expect(sent.headers['X-Original-To']).toBe('real@customer.com')
  })
})
