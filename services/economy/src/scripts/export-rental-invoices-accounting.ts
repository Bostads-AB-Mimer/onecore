import { exportRentalInvoicesAccounting } from '@src/services/invoice-service/servicev2'

/**
 * Exports rental invoices from the rental system (Tenfast), enriches
 * and adds accounting information, and exports the accounting to
 * the ERP system (Xledger)
 */
const exportRentalInvoicesScript = async () => {
  const errors: { invoiceNumber: string; error: string }[] = []
  let keepGoing = true

  do {
    const exportResults = await exportRentalInvoicesAccounting('')
    console.log(`Exported ${exportResults.exportedInvoices?.length} invoices`)

    if (exportResults.errors) {
      errors.push(...exportResults.errors)
      console.log('Errors:')
      console.log(
        exportResults.errors
          .map((error) => {
            return `${error.invoiceNumber}: ${error.error}`
          })
          .join('\n')
      )
    }

    if (exportResults.exportedInvoices?.length <= 0) {
      keepGoing = false
    }
  } while (keepGoing)

  console.log('Export complete')
}

exportRentalInvoicesScript()
