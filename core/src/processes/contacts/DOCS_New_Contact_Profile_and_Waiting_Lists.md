# Boendeprofil och köer för en ny kontakt

`setUpNewContactProfileAndWaitingLists` i [`new-contact-profile-and-waiting-lists.ts`](./new-contact-profile-and-waiting-lists.ts) körs direkt efter att en kontakt har skapats i Xpand. Den sparar hushållsuppgifterna (boendeprofilen) och ställer kontakten i de köer som valts. Anropas av `POST /v1/contacts` (property-tree) och av registreringen på Mina sidor ([`DOCS_Register_Applicant.md`](./DOCS_Register_Applicant.md)). Registreringen använder utfallen men inte de svenska varningstexterna, som är skrivna för handläggare; den gör om dem till varningskoder.

Kontakten går inte att ta bort när den väl finns, så processen misslyckas aldrig som helhet. Varje steg rapporterar sitt eget utfall, och varje misslyckat steg ger en varning på svenska till handläggaren. Routen svarar alltid 201.

Bara för en helt ny kontakt: profilen skrivs som ny med referensen i `PENDING`. Körs den för en kontakt vars boendereferens redan har granskats skrivs granskningen över. Ett misslyckat steg kompletteras i efterhand via endpoints för boendeprofil och kö, inte genom att köra processen igen.

## Flödesdiagram

Boendeprofilen och köerna körs samtidigt. Köerna körs en i taget, i den ordning de begärdes.

```mermaid
flowchart TD
A[Contact created in Xpand] --> P{Application profile<br/>supplied?}
A --> Q{More waiting lists?}

P --> |No| Ps[Profile: skipped]
P --> |Yes| Pw(Save profile, review PENDING)
Pw --> Po{Saved?}
Po --> |Yes| Pc[Profile: created]
Po --> |No| Pf[Profile: failed<br/>+ warning]

Q --> |No| W
Q --> |Yes| Qa(Add to waiting list)
Qa --> Qo{Leasing answer}
Qo --> |201| Qc[Queue: created]
Qo --> |Any other status| Qr[Queue: failed, error = status<br/>+ warning]
Qo --> |No answer| Qu[Queue: failed, error = unknown<br/>+ warning]
Qc --> Q
Qr --> Q
Qu --> Q

Ps --> W
Pc --> W
Pf --> W
W[Collect warnings:<br/>profile first, then queues in order] --> R[201 with outcomes and warnings]
```

## Sekvensdiagram

Vilka Xpand-köer en kötyp omfattar avgörs av leasing: Bostad ger Bostad, Nyproduktion, Kooperativ och Ungdom. Bilplats och Förråd ger intern och extern. En kö kontakten redan står i räknas som lyckad.

```mermaid
sequenceDiagram
    participant Route as POST /v1/contacts
    participant Process as Core process
    participant Leasing as Leasing
    participant DB as ONECore DB
    participant Xpand as Xpand SOAP

    Route ->> Process: contactCode, profile, waiting lists

    par Application profile
        opt Profile supplied
            Process ->> Leasing: Create or update application profile
            Leasing ->> DB: Save profile
            Leasing -->> Process: ok / bad-params / unknown
        end
    and Waiting lists, one at a time
        loop Each requested type
            Process ->> Leasing: Add applicant to waiting list
            loop Each Xpand queue for the type, stopping at the first error
                Leasing ->> Xpand: Add to queue
                Xpand -->> Leasing: ok / already in queue / error
            end
            alt All queues ok or already held
                Leasing -->> Process: 201
            else Type not implemented
                Leasing -->> Process: 404
            else Queue missing in Xpand, or other error
                Leasing -->> Process: 500
            end
        end
    end

    Process -->> Route: outcomes + warnings
    Route -->> Route: 201, warnings only if any step failed
```
