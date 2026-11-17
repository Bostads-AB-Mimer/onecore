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
    A[POST /invoices/:invoiceId/send] --> B[economy GET /invoices/:invoiceId]
    B -->|404| E404I[404 invoice-not-found]
    B -->|error| E500[500 unknown]
    B --> C{invoice.type}

    C -->|Other: miscellaneous invoice| M1[In parallel: contacts service lookup of invoice.reference<br/>and economy GET /invoices/:invoiceId/file]
    M1 -->|file: invoice or file missing| E404P[404 pdf-not-found / invoice-not-found]
    M1 -->|file: download failed| E500
    M1 -->|contact not found| E422R[422 no-recipient]
    M1 -->|contact lookup failed| E500
    M1 -->|protected identity still redacted| E422R
    M1 -->|no email address| E422E[422 no-email]
    M1 --> S

    C -->|Regular: rent notice| R1[In parallel: economy GET /invoices/by-ocr/:ocr<br/>and GET /invoices/:ocr/pdf]
    R1 -->|invoice or PDF missing| E404P
    R1 -->|error| E500
    R1 --> R2[First lease id → leasing getLease → first tenant<br/>→ contacts service lookup of the tenant]
    R2 -->|no lease id / lease / tenant / contact| E422R
    R2 -->|contact lookup failed| E500
    R2 -->|protected identity still redacted| E422R
    R2 -->|no email address| E422E
    R2 --> S

    S{expirationDate?} -->|missing| E422D[422 missing-due-date]
    S --> T[communication send-invoice-notification-email<br/>with faktura-invoiceId.pdf attached]
    T -->|failed| E500S[500 send-failed]
    T --> OK[200 sent: true]
```

404 and 422 are logged at `warn` by the route. 500s are logged by the adapter that failed.

## Miscellaneous invoice PDF

Economy `GET /invoices/{invoiceNumber}/file` looks up the invoice in the ledger. It downloads `invoiceFile.url` server-side, without the ledger API token, because the link opens without a login. It answers 404 `{ reason: invoice-not-found | file-not-found }`.
