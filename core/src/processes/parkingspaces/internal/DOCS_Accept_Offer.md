# Accept Offer for Scored Parking Space

## Flowchart

```mermaid
flowchart LR
A[Start] -->B(Check that the Applicant is Still Eligable for Contract)
B --> C(Later:Perform Credit Check)
C --> D{Is the Applicant Eligable for Contract?}
D --> |No| P(Set Applicant Status to Rejected)
P --> Q(Update Offer Status to Closed)
Q --> R(Notify Applicant)
R --> S(Initiate Create Offer Process)
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

TODO
