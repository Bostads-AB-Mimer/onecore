import { Lease, Contact } from '../../../common/types'
import Config from '../../../common/config'

const createLease = async (
  fromDate: Date,
  rentalPropertyId: string,
  tenantCode: string
) => {
  console.log('createLease')

  var soap = require('strong-soap').soap
  var WSDL = soap.WSDL

  var wsdlUrl =
    'https://pdatest.mimer.nu:9055/Incit/Service/External/ServiceCatalogue/?singleWsdl'

  var options = {}

  await WSDL.open(wsdlUrl, options, async (err: any, wsdl: any) => {
    if (err) {
      console.log(err)
      return
    }
    // console.log('wsdl', wsdl)
    // You should be able to get to any information of this WSDL from this object. Traverse
    // the WSDL tree to get  bindings, operations, services, portTypes, messages,
    // parts, and XSD elements/Attributes.

    // Set the wsdl object in the cache. The key (e.g. 'stockquotewsdl')
    // can be anything, but needs to match the parameter passed into soap.createClient()
    var clientOptions = {
      WSDL_CACHE: {
        mywsdlkey: wsdl,
      },
    }

    // console.log('wsdl.definitions.bindings', wsdl.definitions.bindings)
    await soap.createClient(
      'mywsdlkey',
      clientOptions,
      async (err: any, client: any) => {
        if (err) {
          console.log(err)
          return
        }
        // console.log('hej')
        // console.log('client', client)
        // console.log(
        //   'client[ExternalServiceCatalogue08352]',
        //   client['ExternalServiceCatalogue08352']
        // )
        // console.log(
        //   'client[ExternalServiceCatalogue08352][WSHttpBinding_ExternalServiceCatalogue]',
        //   client['ExternalServiceCatalogue08352'][
        //     'WSHttpBinding_ExternalServiceCatalogue'
        //   ]
        // )
        var method =
          client['ExternalServiceCatalogue08352'][
            'WSHttpBinding_ExternalServiceCatalogue'
          ]['CreateRentContract']

        console.log('method', method)

        var requestArgs = {
          foo: 'bar',
        }
        await method(
          requestArgs,
          async (err: any, result: any, envelope: any, soapHeader: any) => {
            if (err) {
              console.log(err)
              return
            }
            //response envelope
            console.log('Response Envelope: \n' + envelope)
            //'result' is the response body
            console.log('Result: \n' + JSON.stringify(result))
          }
        )
      }
    )
  })
}

export { createLease }
