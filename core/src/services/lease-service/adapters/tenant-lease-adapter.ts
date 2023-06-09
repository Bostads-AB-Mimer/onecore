import axios from 'axios'
import { Lease } from '../types'
import Config from '../../../common/config'

const tenantsLeasesServiceUrl = Config.tenantsLeasesService.url
console.log('tcservice', tenantsLeasesServiceUrl)

const getLease = async (leaseId: string): Promise<Lease> => {
  const leaseResponse = await axios(
    tenantsLeasesServiceUrl + '/leases/' + leaseId
  )

  return leaseResponse.data.data
}

export { getLease }
