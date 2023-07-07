import axios from 'axios'
import { Lease } from '../../../common/types'
import Config from '../../../common/config'

const tenantsLeasesServiceUrl = Config.tenantsLeasesService.url

const getLease = async (leaseId: string): Promise<Lease> => {
  const leaseResponse = await axios(
    tenantsLeasesServiceUrl + '/leases/' + leaseId
  )

  return leaseResponse.data.data
}

const getLeasesForPnr = async (
  nationalRegistrationNumber: string
): Promise<Lease[]> => {
  const leasesResponse = await axios(
    tenantsLeasesServiceUrl + '/leases/for/' + nationalRegistrationNumber
  )

  return leasesResponse.data.data
}

export { getLease, getLeasesForPnr }
