import { HtmlTemplateRenderer } from './html-template.renderer'

describe('HtmlTemplateRenderer', () => {
  const renderer = new HtmlTemplateRenderer()

  it('should substitute variables into the reset template', () => {
    const result = renderer.render('password-reset', {
      firstName: 'Pablo',
      resetUrl: 'https://titantv.com.ec/reset-password#t=abc.def',
      logoUrl: 'https://titantv.com.ec/brand/logo-email.png',
    })

    expect(result.html).toContain('Pablo')
    expect(result.html).not.toContain('{{')
  })

  it('should derive a non-empty plain-text alternative', () => {
    const result = renderer.render('password-reset', {
      firstName: 'Pablo',
      resetUrl: 'https://titantv.com.ec/reset-password#t=abc.def',
      logoUrl: 'https://titantv.com.ec/brand/logo-email.png',
    })

    expect(result.text).toContain('Pablo')
    expect(result.text).toContain('https://titantv.com.ec/reset-password#t=abc.def')
    expect(result.text).not.toContain('<td')
  })

  it('should escape user-supplied firstName to prevent markup injection', () => {
    const result = renderer.render('password-reset', {
      firstName: '<img src=x onerror=alert(1)>',
      resetUrl: 'https://titantv.com.ec/reset-password#t=abc.def',
      logoUrl: 'https://titantv.com.ec/brand/logo-email.png',
    })

    expect(result.html).not.toContain('<img src=x onerror=alert(1)>')
  })

  it('should render the password-changed template', () => {
    const result = renderer.render('password-changed', {
      firstName: 'Pablo',
      changedTime: '15:30',
      changedDate: '5 ago 2026',
      logoUrl: 'https://titantv.com.ec/brand/logo-email.png',
    })

    expect(result.html).toContain('15:30')
    expect(result.html).toContain('5 ago 2026')
    expect(result.html).not.toContain('{{')
  })
})
