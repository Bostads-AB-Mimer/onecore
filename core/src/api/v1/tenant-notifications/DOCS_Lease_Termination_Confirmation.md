# Lease termination confirmation

Tenfast calls `POST /v1/tenant-notifications/lease-termination-confirmation`
after a parking lease termination is confirmed. OneCore enriches the
notification from the lease and the contacts service and emails every lease
holder through the communication service (Infobip template
`LeaseTerminationConfirmationTemplateId`).

Only `leaseId` is required. The other fields Tenfast already sends stay
accepted (all optional) so its integration keeps working unchanged:

| Field           | Use                                                 |
| --------------- | --------------------------------------------------- |
| `leaseId`       | Required. The lease to confirm.                     |
| `to`            | Ignored — recipients come from contacts.            |
| `firstName`     | Ignored — names come from contacts.                 |
| `contactCode`   | Added to the lease's holders as a recipient.        |
| `endDate`       | Fallback when the lease has no end date.            |
| `rentalType`    | Fallback when the lease is not a `P-Platskontrakt`. |
| `correlationId` | Stored in the communication log.                    |

```mermaid
sequenceDiagram
    participant T as Tenfast
    participant C as Core
    participant L as Leasing
    participant K as Contacts
    participant M as Communication

    T->>C: POST lease-termination-confirmation (Idempotency-Key)
    C->>C: claim Idempotency-Key
    alt key reused with other payload
        C-->>T: 409 idempotency-conflict
    else already sent / in flight
        C-->>T: 200 sent
    end
    C->>L: GET /leases/{leaseId}
    alt lease not found
        C-->>T: 404 lease-not-found
    else leasing fails
        C-->>T: 502 lease-lookup-failed
    end
    Note over C: endDate = lease.leaseEndDate ?? request endDate
    alt no end date
        C-->>T: 422 missing-end-date
    end
    Note over C: rentalType = Bilplats if P-Platskontrakt, else request rentalType
    alt no rental type
        C-->>T: 422 unsupported-rental-type
    end
    Note over C: holders = lease.tenantContactIds ∪ request contactCode
    C->>K: GET /contacts/batch (email + address)
    alt contacts fails or a holder is missing
        C-->>T: 502 contact-lookup-failed (fail closed, nothing sent)
    end
    alt no holder has an email address
        C-->>T: 422 no-recipient
    end
    loop each holder with an email (claim per-holder key)
        C->>M: POST /sendLeaseTerminationConfirmation
        M->>M: send via Infobip, write communication log
    end
    alt any send failed
        C-->>T: 502 send-failed (retry resends only to failed holders)
    else
        C-->>T: 200 sent
    end
```

## Template placeholders

Each holder gets their own email; every email lists all holders in lease order.

| Placeholder                | Value                                                          |
| -------------------------- | -------------------------------------------------------------- |
| `{{firstName}}`            | Recipient's first name (organisation: name)                    |
| `{{lastName}}`             | Recipient's last name                                          |
| `{{leaseId}}`              | Lease id                                                       |
| `{{endDate}}`              | Lease end date, `YYYY-MM-DD`                                   |
| `{{preferredMoveOutDate}}` | Preferred move-out date, empty if unset                        |
| `{{rentalObjectAddress}}`  | Address of the terminated rental object                        |
| `{{type}}`                 | Rental type (`Bilplats`)                                       |
| `{{tenantNName}}`          | Holder N full name                                             |
| `{{tenantNBirthDate}}`     | Holder N birth date `YYYY-MM-DD` (never the full personnummer) |
| `{{tenantNAddress}}`       | Holder N street (invoice address)                              |
| `{{tenantNPostalCode}}`    | Holder N postal code                                           |
| `{{tenantNCity}}`          | Holder N city                                                  |

`N` is 1, 2, …. Slots 1 and 2 are always present; an unused slot is empty.
