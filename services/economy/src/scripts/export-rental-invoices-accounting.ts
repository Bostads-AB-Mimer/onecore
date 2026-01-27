import { exportRentalInvoicesAccounting } from '@src/services/invoice-service/servicev2'

/**
 * Exports rental invoices from the rental system (Tenfast), enriches
 * and adds accounting information, and exports the accounting to
 * the ERP system (Xledger)
 */
const exportRentalInvoicesScript = async () => {
  await exportRentalInvoicesAccounting('')
}

exportRentalInvoicesScript()
