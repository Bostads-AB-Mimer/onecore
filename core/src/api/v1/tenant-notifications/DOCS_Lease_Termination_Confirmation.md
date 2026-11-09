# Lease termination confirmation

Tenfast calls `POST /v1/tenant-notifications/lease-termination-confirmation`
after a parking space or garage lease termination is confirmed (both are
`Bilplats` in the email). OneCore enriches the
notification from the lease and the contacts service and emails every lease
holder through the communication service (Infobip template
`LeaseTerminationConfirmationTemplateId`).

Only `leaseId` (and the optional `correlationId`, stored in the communication
log) is used. Tenfast still sends `to`, `contactCode`, `firstName`, `endDate`
and `rentalType`; request parsing strips them, so they never override what the
lease and contacts say.

Contact codes are matched trimmed and case-insensitively (Xpand pads them and
compares ignoring case). Request and per-holder idempotency records use
separate, encoded key prefixes, so no `Idempotency-Key` can collide with a
holder record.

Lease dates are read as Swedish calendar dates (Europe/Stockholm), so a date
Tenfast stores at Swedish midnight is not shifted back a day.

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
    else already sent
        C-->>T: 200 sent (same summary as the first response)
    else another request with this key is still running
        C-->>T: 409 request-in-progress (retryable)
    end
    Note over C: from here on the key is released on any outcome but success, including an unexpected error
    C->>L: GET /leases/{leaseId}
    alt lease not found
        C-->>T: 404 lease-not-found
    else leasing fails
        C-->>T: 502 lease-lookup-failed
    end
    alt lease has no end date (set at preliminary termination, so unexpected; logged at error)
        C-->>T: 422 missing-end-date
    end
    alt lease is neither P-Platskontrakt nor Garagekontrakt (logged at error)
        C-->>T: 422 unsupported-rental-type
    end
    Note over C: holders = lease.tenantContactIds
    C->>K: GET /contacts/batch (email + address)
    alt contacts fails
        C-->>T: 502 contact-lookup-failed (fail closed, nothing sent)
    else a holder is missing in contacts
        C-->>T: 422 contact-not-found (fail closed, nothing sent)
    end
    Note over C: a holder's address is the first valid one, primary first; a missing or invalid address skips the holder
    alt no holder has a valid email address
        C-->>T: 422 no-recipient
    end
    loop each holder with an email, in parallel (claim per-holder key; a key held by another payload or in flight counts as failed)
        C->>M: POST /sendLeaseTerminationConfirmation
        M->>M: send via Infobip, write communication log
    end
    Note over C: waits for every send to settle before releasing the request key, even if one throws
    alt any send failed
        C-->>T: 502 send-failed (retry resends only to failed holders)
    else
        C-->>T: 200 { sent, sentCount, skippedContactCodes }
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

## Deploying

The communication payload requires `lastName` and `tenants`, which only the
new core sends. Deploy core before (or together with) the communication
service; the old communication service accepts the new core's payload.
