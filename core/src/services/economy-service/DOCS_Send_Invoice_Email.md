# Download and email an invoice

Invoices in the tenant ledger (property-tree) can be downloaded and emailed to the customer.

- **Download rent notice**: `GET /invoices/{ocr}/pdf`. Shown when the invoice has `hasRentNoticePdf`, which economy sets on invoices found in the rent system with an OCR number. Miscellaneous invoices keep their own "Se PDF" link (`invoiceFileUrl`). Invoices from the old system have no PDF.
- **Email invoice**: `POST /invoices/{invoiceId}/send`. Works for rent notices with a PDF and for miscellaneous invoices with a ledger file.

`POST /invoices/notify-batch` runs the same rent notice branch (`sendRentNoticeEmail`) for many OCR numbers. It reports failures as strings in `failed[]`, the same strings as before (`toNotifyBatchError`); a tenant whose protected identity is still redacted is reported as `protected-identity`.

Both branches take the recipient from the contacts service (`tenantAwareContactLookup`), never from leasing, and fail closed: a protected identity that is not revealed is not emailed. The email goes to the primary address, falling back to the first one. The greeting uses the first name (full name if missing) of a person, or the name of an organisation.

Outside production every email goes to `config.emailAddresses.tenantDefault`.

## Email flow

```mermaid
flowchart TD
    A[POST /invoices/:invoiceId/send] --> T{body invoiceType}
    T -->|Other| B
    T -->|Regular or not given| R1[In parallel: economy GET /invoices/by-ocr/:invoiceId<br/>and GET /invoices/:invoiceId/pdf]
    R1 -->|rent notice found, PDF missing| E404P[404 pdf-not-found]
    R1 -->|error| E500[500 unknown]
    R1 -->|rent notice found| R2[First lease id → leasing getLease → the tenant in body contactCode,<br/>or the first tenant → contacts service lookup of the tenant]
    R2 -->|no lease id / lease / tenant / contact| E422R[422 no-recipient]
    R2 -->|contactCode is not a tenant on the lease| E422R
    R2 -->|contact lookup failed| E500
    R2 -->|protected identity still redacted| E422R
    R2 -->|no email address| E422E[422 no-email]
    R2 --> S

    R1 -->|not a rent notice in the rent system| B[economy GET /invoices/:invoiceId]
    B -->|404| E404I[404 invoice-not-found]
    B -->|error| E500
    B -->|Regular: rent notice from the old system| E404P
    B -->|Other: miscellaneous invoice| M1[In parallel: contacts service lookup of invoice.reference<br/>and economy GET /invoices/:invoiceId/file]
    M1 -->|file: invoice or file missing| E404F[404 pdf-not-found / invoice-not-found]
    M1 -->|file: download failed| E500
    M1 -->|contact not found| E422R
    M1 -->|contact lookup failed| E500
    M1 -->|protected identity still redacted| E422R
    M1 -->|no email address| E422E
    M1 --> S

    S{expirationDate?} -->|missing| E422D[422 missing-due-date]
    S --> T[communication send-invoice-notification-email<br/>with faktura-invoiceId.pdf attached]
    T -->|failed| E500S[500 send-failed]
    T --> OK[200 sent: true]
```

The rent system is asked first (`sendInvoiceEmail`): a rent notice is there before it reaches the ledger, and that one lookup returns everything the email needs. The ledger is only asked about invoices the rent system does not have.

A rent notice on a lease with several tenants is in each tenant's ledger. The app sends the ledger's contact as `contactCode`, and core emails that tenant once it has checked the contact is a tenant on the lease (422 `no-recipient` otherwise). Without `contactCode`, as in `notify-batch`, the first tenant is emailed. A miscellaneous invoice always goes to the customer it is billed to.

A miscellaneous invoice is never in the rent system. The app knows the invoice's type and sends it as `invoiceType`; for `Other` core goes straight to the ledger. The value only saves the lookup: the type the ledger reports decides whether the invoice is emailed as a miscellaneous invoice.

404 and 422 are logged at `warn` by the route. 500s are logged by the adapter that failed.

## Miscellaneous invoice PDF

Economy `GET /invoices/{invoiceNumber}/file` looks up the invoice in the ledger. It downloads `invoiceFile.url` server-side, without the ledger API token, because the link opens without a login. It answers 404 `{ reason: invoice-not-found | file-not-found }`.
