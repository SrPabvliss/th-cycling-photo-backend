/**
 * The name a message greets the buyer by. The order's frozen name comes first: the account can be
 * renamed after the sale, the order cannot.
 */
export function customerFirstName(source: {
  snapFirstName?: string | null
  userName?: string | null
}): string {
  return (source.snapFirstName ?? source.userName ?? '').split(' ')[0] ?? ''
}
