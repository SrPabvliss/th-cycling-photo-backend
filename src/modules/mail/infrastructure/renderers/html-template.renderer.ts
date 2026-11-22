import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Injectable } from '@nestjs/common'
import Handlebars, { type TemplateDelegate } from 'handlebars'
import { convert } from 'html-to-text'
import type { ITemplateRenderer, MailTemplate, RenderedTemplate } from '../../domain/ports'

const TEMPLATES_DIR = join(__dirname, '..', 'templates')
const PARTIALS_DIR = join(TEMPLATES_DIR, 'partials')

/**
 * Every email shares the B3 layout (navy band, illustration bridge, light body, navy footer) and its
 * pieces, registered as Handlebars partials from templates/partials. Images are served by the web
 * front under `<webBaseUrl>/brand/email`.
 */
@Injectable()
export class HtmlTemplateRenderer implements ITemplateRenderer {
  private readonly handlebars = Handlebars.create()
  private readonly cache = new Map<MailTemplate, TemplateDelegate>()
  private readonly assetsUrl: string

  constructor(webBaseUrl = 'https://titantv.com.ec', assetsUrl = '') {
    this.assetsUrl = (assetsUrl || `${webBaseUrl.replace(/\/+$/, '')}/brand/email`).replace(
      /\/+$/,
      '',
    )
    this.handlebars.registerHelper('concat', (...args: unknown[]) =>
      args
        .slice(0, -1)
        .map((part) => (part == null ? '' : String(part)))
        .join(''),
    )
    for (const file of readdirSync(PARTIALS_DIR)) {
      if (!file.endsWith('.html')) continue
      this.handlebars.registerPartial(
        file.slice(0, -'.html'.length),
        readFileSync(join(PARTIALS_DIR, file), 'utf8'),
      )
    }
  }

  render(template: MailTemplate, vars: Record<string, string>): RenderedTemplate {
    const html = this.compiled(template)({
      ...vars,
      assetsUrl: this.assetsUrl,
      currentYear: String(new Date().getFullYear()),
    })

    return {
      html,
      text: convert(html, {
        wordwrap: 100,
        selectors: [
          { selector: 'img', format: 'skip' },
          { selector: 'h1', options: { uppercase: false } },
        ],
      }),
    }
  }

  private compiled(template: MailTemplate): TemplateDelegate {
    const cached = this.cache.get(template)
    if (cached) return cached

    const source = readFileSync(join(TEMPLATES_DIR, `${template}.html`), 'utf8')
    const delegate = this.handlebars.compile(source, { strict: false })
    this.cache.set(template, delegate)

    return delegate
  }
}
