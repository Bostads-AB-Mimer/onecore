import { Factory } from 'fishery'
import { TenfastRentalObjectByRentalObjectCodeResponse } from '../../../../../../common/adapters/tenfast/schemas'

export const TenfastRentalObjectByRentalObjectCodeResponseSchemaFactory =
  Factory.define<TenfastRentalObjectByRentalObjectCodeResponse>(
    ({ sequence }) => ({
      records: [
        {
          _id: '67eb8af5545c8f1195bef2e6',
          hyresvard: '6344b398b63ff59d5bde8257',
          externalId: '941-721-00-0014',
          roomCount: null,
          typ: 'parkering',
          parkeringType: 'personbil',
          originalType: 'Parkeringsplats med el',
          hyra: 287.17,
          hyror: [],
          createdAt: '2025-04-01T06:43:01.357Z',
          nummer: '19105',
          postadress: 'Testvägen 3',
          postnummer: '72212',
          stad: 'Västerås',
          avtalStates: ['reserved', 'vacant'],
          lastStateChanged: '2025-11-18T05:32:58.980Z',
          updatedAt: '2025-11-18T05:32:58.980Z',
          __v: 1,
          article: '67eb8aea545c8f1195bea0ba',
          comments: [],
          commonName: null,
          description: null,
          files: [],
          images: [],
          kvm: null,
          rentFreePeriod: null,
          skvNummer: null,
          tags: [],
          displayName: 'Testvägen 3 - nr. 19105',
          subType: 'Personbil',
          states: ['reserved', 'vacant'],
        },
      ],
      prev: null,
      next: null,
      totalCount: 1,
    })
  )
