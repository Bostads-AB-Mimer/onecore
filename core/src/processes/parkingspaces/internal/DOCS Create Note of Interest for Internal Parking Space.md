# Create Note of Interest for Internal Parking Space

## Flowchart

```mermaid
flowchart LR
A[Start] -->B(Get Parking Space)
B --> C{Is the Parking<br/>Space Internal?}
C --> |No| O
C --> |Yes| D[Get Contact]
D --> F{Is Contact<br/>a Tenant?}
F --> |No| O[End]
F --> |Yes| H{Is Contact in Waiting<br/>List for Parking Space?}
H --> |No| I[Add Contact<br/>to Waiting List]
I --> J[Create Listing]
J --> K[Create Application]
H --> |Yes| J
K --> O
```

## Sequence Diagram
