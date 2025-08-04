# Deny Offer for Scored Parking Space

## Flowchart

```mermaid
flowchart LR
A[Start] -->B(Update Offer Status to Closed)
B --> C(Update Applicant Status to WithdrawnByUser)
C --> D(Initiate Create Offer Process)
D --> O(End)

```

## Sequence Diagram

TODO
