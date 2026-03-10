/**
 * Contract types
 */

export interface Contract {
  contractId: string
  promisee?: any // TODO: PartnerItem type
  promisor?: any // TODO: PartnerItem type
  accessControlInstance?: any // TODO: AccessControlInstanceItem type
  state?: string | null
  createdOn: string
  signedOn?: string | null
  validityPeriod?: any // TODO: TimeSpan type
  endsOn?: string | null
  clauses?: any[] | null // TODO: ContractClauseItem type
  tags?: any[] | null // TODO: TagItem type
}
