# Uppsägning av Avtal — Processöversikt

De processer i den här mappen beskriver hur ett hyreskontrakt avslutas — antingen för att hyresgästen själv säger upp sin bilplats via Mina Sidor, eller för att en handläggare slutför en uppsägning eller makulering direkt i Xpand, vilket sedan synkas till Tenfast. Hyresgäster kan även säga upp bostad/förråd via Mina Sidor, men det flödet går aldrig via onecore — se tabellen och "Utanför denna dokumentation" nedan. Det här dokumentet visar hur systemen hänger ihop — se respektive dokuments egna diagram för detaljer.

## Processer

| Process                                                                                      | Vad den gör                                                                                                                                                                                                                                | Triggas av                                                           |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| [Hyresgäst Begär Uppsägning av Bilplats (Preliminär)](./DOCS_Preliminary_Terminate_Lease.md) | Hyresgäst begär uppsägning av sin bilplats; en signeringsbegäran skickas i Tenfast (BankID)                                                                                                                                                | Hyresgäst (Mina Sidor)                                               |
| Uppsägning av Bostad/Förråd — **ej dokumenterat här**                                        | Hyresgäst säger upp bostad/förråd via Mina Sidor. Går direkt från mimer.nu API till Xpands SOAP-tjänst — **når aldrig onecore.** Se "Utanför denna dokumentation" nedan för varför.                                                        | Hyresgäst (Mina Sidor)                                               |
| [Synka Uppsägning från Xpand](./DOCS_Terminate_Lease_via_Xpand_Sync.md)                      | En slutgiltig uppsägning som registrerats i Xpand ("Uppsagt datum" satt) synkas till Tenfast                                                                                                                                               | Schemalagt script `sync-leases` (Core), pollar Xpands `cmlog`-tabell |
| [Synka Makulering från Xpand](./DOCS_Void_Lease_via_Xpand_Sync.md)                           | Ett kontrakt som annullerats i Xpand ("Makulerat datum" satt) synkas som makulerat till Tenfast                                                                                                                                            | Schemalagt script `sync-leases` (Core), pollar Xpands `cmlog`-tabell |
| Tenfast Bekräftar Uppsägning av Bilplats — **ej eget dokument**                              | Tenfast anropar Core när en bilplats-uppsägning slutförts internt (efter BankID-signering); Core skickar ett bekräftelsemejl till hyresgästen. Se noten i [Hyresgäst Begär Uppsägning av Bilplats](./DOCS_Preliminary_Terminate_Lease.md). | Tenfast (webhook-liknande anrop till Core)                           |

## Hur uppsägning modelleras

Tenfast håller ett `stage`-fält på avtalet som onecore mappar till sin egen `LeaseStatus`. De statusar som rör den här dokumentationen:

| Tenfast `stage`         | onecore `LeaseStatus` | Betydelse                                                             |
| ----------------------- | --------------------- | --------------------------------------------------------------------- |
| `preTermination`        | PreliminaryTerminated | Hyresgästen har begärt uppsägning via simplesign, väntar på signering |
| `terminationScheduled`  | AboutToEnd            | Uppsägningen är bekräftad, avtalet löper på uppsägningstiden ut       |
| `terminated`/`archived` | Ended                 | Avtalet har upphört                                                   |

Tenfast har även ett `cancellation`-objekt på avtalet (`cancelled`, `requested`, `cancelledByType`, `preferredMoveOutDate` m.fl.) som fungerar som revisionsspår. Fältet `cancelledByType` är det som skiljer ett hyresgäst-initierat uppsägningsförsök (`'hyresgast'`, hårdkodat av onecore i den preliminära uppsägningen) från ett system-/Xpand-drivet.

## Utanför denna dokumentation

- **Routningsregeln i mimer.nu API:** samma handler (`PreliminaryTerminationCommandHandler`) hanterar alla objektstyper och avgör rent på objektstyp vart uppsägningen ska: `parkering` → onecore/Tenfast (dokumenterat här), `bostad`/`förråd` → Xpands SOAP-tjänst (`IPreliminaryTermination`) direkt, `lokaler` och okända typer avvisas med felmeddelande om att avtalet måste sägas upp direkt i Tenfast.
- **Notera:** trots att bostad/förråd-uppsägning går förbi onecore hämtar mimer.nu API ändå kontraktslistan (status, uppsägningstid) från onecore — så onecore är fortfarande sanningskälla för vad som _visas_ för hyresgästen, även när själva uppsägningsanropet går någon annanstans.

## Att känna till

- **Bilplatser filtreras tyst bort ur Xpand-synken — avsiktligt.** `cmlog`-adaptern klassificerar `Garagekontrakt`-rader precis som `Bostadskontrakt`/`Lokalkontrakt`, men det schemalagda scriptet `core/src/scripts/sync-leases` (funktionen `isResidenceOrStorage`) synkar bara hyresobjekt av typen lägenhet eller lokal+förråd. En bilplats som sägs upp eller makuleras direkt i Xpand loggas som "rental object type not in scope, skipping" och **synkas aldrig till Tenfast** via det här flödet. Det är korrekt beteende, inte en lucka: bilplatser är Tenfast-native och avslutas antingen via hyresgästens självservice ([Hyresgäst Begär Uppsägning av Bilplats](./DOCS_Preliminary_Terminate_Lease.md), som Tenfast själv bekräftar med ett anrop tillbaka till Core — se noten där) eller direkt i Tenfast — aldrig via Xpands `cmlog`.
- **`terminate` är idempotent, `void` är det inte.** Se respektive dokuments "Att känna till" för detaljer — det påverkar hur en redan behandlad rad beter sig om synken körs om.
