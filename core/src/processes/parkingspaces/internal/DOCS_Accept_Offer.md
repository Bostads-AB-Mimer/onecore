# Accept Offer for Scored Parking Space

## Flowchart

```mermaid
flowchart LR
A[Start] -->B(Later: Check that the Applicant is Still Eligable for Contract)
B --> C(Later:Perform Credit Check)
C --> D{Later:Is the Applicant Eligable for Contract?}
D --> |Later:No| P(Later:Set Applicant Status to Rejected)
P --> Q(Later:Update Offer Status to Closed)
Q --> R(Later:Notify Applicant)
R --> S(Later:Initiate Create Offer Process)
S --> O
D --> |Yes| E(Create Contract)
E --> F(Reset Waiting Parking Space Waiting List)
F --> G{Does the Applicant Have Other Offers?}
G --> |Yes| I(Initiate Process to Decline All Other Active Offers)
G --> |No| J{Should Contract Be Replaced?}
I --> J
J --> |Yes| K(Later:End Contract To Be Replaced)
J --> |No| L(Close Offer Round)
K --> L
L --> M(Notify all Losing or Not Eligible Applicants by email)
M --> O(End)

```

## Sequence Diagram

In progress

```mermaid
sequenceDiagram
    participant System as System
    actor User as User
    participant Core as Core
    participant Leasing as Leasing
    participant Property Mgmt as Property Management
    participant Communication as Communication
    participant OneCore DB as OneCore Database
    participant XPand DB as XPand SOAP Database
    participant XPand SOAP as XPand SOAP Service

    User ->> Core: Accept Offer
    Core ->>Leasing: Get Offer
        Leasing ->>OneCore DB: Get Offer
        OneCore DB --> Leasing: Offer
        Leasing -->> Core: Offer

    Core ->>Leasing: Get Listing
        Leasing ->>OneCore DB: Get Listing
        OneCore DB --> Leasing: Listing
        Leasing -->> Core: Listing

```
