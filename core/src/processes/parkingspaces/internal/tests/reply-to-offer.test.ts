import axios from 'axios'
jest.mock('onecore-utilities', () => {
  return {
    logger: {
      info: () => {
        return
      },
      error: () => {
        return
      },
      debug: () => {
        return
      },
    },
    loggedAxios: axios,
    axiosTypes: axios,
  }
})

import { ListingStatus } from 'onecore-types'

import { createOfferForInternalParkingSpace } from '../create-offer'
import * as leasingAdapter from '../../../../adapters/leasing-adapter'
import * as communicationAdapter from '../../../../adapters/communication-adapter'
import * as factory from '../../../../../test/factories'
import { ProcessStatus } from '../../../../common/types'

describe('acceptOffer', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it.todo('write tests')
})

describe('denyOffer', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it.todo('write tests')
})

describe('expireOffer', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it.todo('write tests')
})
