import type { TemplateKey } from '../../../domain/permission-template.constants'

export class ApplyTemplateCommand {
  constructor(
    public readonly userId: string,
    public readonly templateKey: TemplateKey,
    public readonly appliedById: string,
  ) {}
}
