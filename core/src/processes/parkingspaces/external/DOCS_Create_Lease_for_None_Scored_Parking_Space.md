# Create Lease for Non Scored Parking Space

## Flowchart

```mermaid
flowchart LR
A[Start] -->B(Get Listing)
B --> C{Is the Listing Non Scored?}
C --> |No| O[End]
C --> |Yes| D[Get Applicant with Leases]
D --> Q{Does Applicant have an Address?}
Q --> |Yes| F{Is the Applicant<br/>a Tenant?}
Q --> |No| O
F --> |No| L[Perform Credit Check]
L --> I
F --> |Yes| H[Perform Internal Credit Check]
H --> I{Is Applicant Eligable for Lease?}
I --> |Yes| J[Create Lease]
J --> R[Update Listing Status]
R --> M
I --> |No| M[Send Notification to Applicant]
M --> N[Send Notification to Customer Support]
N --> O
```

## Sequence Diagram

```mermaid
sequenceDiagram
    #participant System as System
    actor Customer Support as Customer Support
    actor User as User
    participant Core as Core
    participant Leasing as Leasing
    participant Property Mgmt as Property Management
    participant Communication as Communication
    participant OneCore DB as OneCore Database
    participant XPand SOAP as XPand SOAP Service
    participant XPand DB as XPand Database

    User ->> Core: Create Lease

    Core ->> Leasing: Get Active Listing
    Leasing ->> OneCore DB: Get Listing
    OneCore DB -->> Leasing: Listing
    Leasing -->> Core: Active Listing

    break when Listing is not None Scored
        Core-->User: show error message
    end

    Core ->> Leasing: Get Applicant
    Leasing ->> XPand DB: Get Applicant
    XPand DB -->> Leasing:Applicant
    Leasing -->> Core: Applicant

    break when Applicant is not found or address is missing
        Core-->User: show error message
    end

    alt Is Applicant a Tenant
        Core ->> Leasing: Perform Internal Credit Check
        Leasing ->> XPand DB: Get Invoices
        XPand DB -->> Leasing: Invoices
        Leasing -->> Core: Credit Check Result
    else
        Core ->> Leasing: Perform External Credit Check
        Leasing -->> Core: Credit Check Result
    end

    alt Is Applicant Eligible for Lease
        Core ->> Leasing: Create Lease
        Leasing ->> XPand SOAP: Create Lease
        XPand SOAP -->> Leasing: Create Lease Result
        Leasing -->> Core: Create Lease Result
        Core ->> Leasing: Update Listing Status
        Leasing ->> OneCore DB: Update Listing Status
        Core ->> Communication: Notify Applicant of Success
        Communication -->> User: Success Notification
        Core ->> Communication: Notify Customer Support of Success
        Communication -->> Customer Support: Success Notification
        Core -->> User: Lease Created
    else
        Core ->> Communication: Notify Applicant of Failure
        Communication -->> User: Faiure Notification
        Core ->> Communication: Notify Customer Support of Failure
        Communication -->> Customer Support: Failure Notification
        break when Lease has not been created
            Core --> User: No Lease Created
        end
    end

```
