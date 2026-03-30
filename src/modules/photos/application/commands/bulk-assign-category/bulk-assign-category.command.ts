export class BulkAssignCategoryCommand {
  constructor(
    public readonly photoIds: string[],
    public readonly photoCategoryId: string | null,
  ) {}
}
