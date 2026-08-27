export class OrganizersStatsProjection {
  active: number
  noQuota: number
  expiring: number
  pending: number
  tabs: {
    all: number
    active: number
    noQuota: number
    expiring: number
    invitations: number
  }
}
