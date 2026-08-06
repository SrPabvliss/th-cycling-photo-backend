import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Injectable } from '@nestjs/common'
import { compile, type TemplateDelegate } from 'handlebars'
import { convert } from 'html-to-text'
import type { ITemplateRenderer, MailTemplate, RenderedTemplate } from '../../domain/ports'

const TEMPLATES_DIR = join(__dirname, '..', 'templates')

@Injectable()
export class HtmlTemplateRenderer implements ITemplateRenderer {
  private readonly cache = new Map<MailTemplate, TemplateDelegate>()

  render(template: MailTemplate, vars: Record<string, string>): RenderedTemplate {
    const html = this.compiled(template)(vars)

    return {
      html,
      text: convert(html, {
        wordwrap: 100,
        selectors: [{ selector: 'img', format: 'skip' }],
      }),
    }
  }

  private compiled(template: MailTemplate): TemplateDelegate {
    const cached = this.cache.get(template)
    if (cached) return cached

    const source = readFileSync(join(TEMPLATES_DIR, `${template}.html`), 'utf8')
    const delegate = compile(source)
    this.cache.set(template, delegate)

    return delegate
  }
}
