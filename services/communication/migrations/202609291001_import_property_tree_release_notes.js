// One-off import of the release notes that used to live as JSON files in
// apps/property-tree. Generated from those files; do not edit by hand.
const NOTES = [
  {
    date: '2026-01-29',
    title: 'Ny sida för kontraktsökning',
    description:
      'Det finns nu en dedikerad vy där man kan söka fram hyreskontrakt med olika parametrar.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-01-29',
    title: 'Ny sida för uthyrningsspärrar',
    description:
      'Uthyrningsspärrar kan nu visas, filtreras och exporteras för samtliga objekt. En ny funktion gör det möjligt att söka och filtrera uthyrningsspärrar samt exportera resultatet till Excel.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-01-29',
    title: 'Dokumentflik för fastighetsobjekt',
    description:
      'Alla fastigheter, byggnader och lägenheter har nu en dokumentflik för enklare hantering av filer. Det går nu att ladda upp dokument kopplade till dessa objekt.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-01-29',
    title: 'Komponenthantering i ONECore',
    description:
      'Ett nytt adminläge gör det möjligt att lägga till, ta bort och organisera komponenter enligt komponenthierarki. Stöd finns nu även för att installera och avinstallera komponenter i lägenheters utrymmen.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-01-29',
    title: 'Stöd för kundnoteringar',
    description:
      'Det går nu att lägga in noteringar på kund direkt i ONECore. Noteringen sparas i Xpand och visas både i Xpand och ONECore. Detta är första gången ONECore skriver data tillbaka till Xpand-databasen.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-01-29',
    title: 'API-stöd för SPAR-integration',
    description:
      'ONECore har nu de API-funktioner som Consid behöver för att komma vidare med SPAR-integration och hantering av skyddade personuppgifter.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-01-29',
    title: 'Makulerade kontrakt visas inte längre',
    description:
      'En bugg har åtgärdats där makulerade kontrakt tidigare kunde synas i kontraktslistor för hyresobjekt.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-01-30',
    title: 'Sidofältet fixat',
    description:
      'Åtgärdat ett problem där sidofältet inte gick att fälla ihop korrekt.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-01-30',
    title: 'Filter på kvartersvärdar',
    description: 'Det går nu att filtrera hyreskontrakt på kvartersvärdar.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-01-30',
    title: 'Öppna länkar i nya flikar',
    description: 'Du kan nu öppna länkar i nya flikar.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-01-30',
    title: 'Hyresobjekt med X borttagna',
    description:
      'Åtgärdat en bugg där hyresobjekt som slutar med X visades felaktigt.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-01-30',
    title: 'Dynamiska sidnamn',
    description: 'Sidnamn uppdateras nu dynamiskt baserat på innehållet.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-01-30',
    title: 'Sidofältet fixat',
    description:
      'Åtgärdat ett problem där sidofältet inte gick att fälla ihop korrekt.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-01-30',
    title: 'Filter på kvartersvärdar',
    description: 'Det går nu att filtrera hyreskontrakt på kvartersvärdar.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-01-30',
    title: 'Öppna länkar i nya flikar',
    description: 'Du kan nu öppna länkar i nya flikar.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-01-30',
    title: 'Hyresobjekt med X borttagna',
    description:
      'Åtgärdat en bugg där hyresobjekt som slutar med X visades felaktigt.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-01-30',
    title: 'Dynamiska sidnamn',
    description: 'Sidnamn uppdateras nu dynamiskt baserat på innehållet.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-02-02',
    title: 'Bekräftelsemail för bilplatserbjudanden',
    description:
      'Bekräftelsemail skickas nu till kontakter som accepterar erbjudanden på bilplatser.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-02-02',
    title: 'Korrigerad vy för historiska annonser',
    description:
      'Justerat vyn för historiska annonser så att korrekt datum visas.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-02-03',
    title: 'Undvik automatisk översättning i webbläsaren',
    description:
      'Vissa användare har upplevt problem med belopp och summor som ändras felaktigt. Detta beror på webbläsarens automatiska översättning. Stäng av "Översätt sidan" i din webbläsare för att undvika detta.',
    category: 'warning',
    pinned: false,
  },
  {
    date: '2026-02-03',
    title: 'Korrigerat utflyttningsdatum i kontraktsvyn',
    description:
      'Visar nu rätt utflyttningsdatum i kontraktsvyn för lägenhetskortet. Tidigare visades önskat avflyttningsdatum felaktigt.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-02-04',
    title: 'Nyheter på förstasidan',
    description:
      'Vi visar nu ett flöde för nyheter och uppdateringar på ONECores startsida',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-02-05',
    title: 'Stöd för fler noteringar',
    description:
      'Det går nu att se och lägga till både standardnoteringar och sökandenoteringar på kund',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-02-05',
    title: 'Skatteverkets lägenhetsnummer',
    description:
      'Nu visas rätt siffror för skatteverkets lägenhetsnummer på lägenhetskortet.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-02-05',
    title: 'Fastighetsnummer och byggnadsnummer på lägenhetskort',
    description:
      'Nu går det även att se vilken fastighet och byggnad en lägenhet tillhör direkt på lägenhetskortet ',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-02-05',
    title: 'Uppdaterad styling',
    description: 'Uppdaterad styling på spärrlistan ',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-02-05',
    title: 'Buggfix i toppsöket',
    description:
      'Fixar ett problem där vissa adresser inte gav några resultat alls när de söktes på',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-02-11',
    title: 'Odoo: Loggknapp för externa ärenden',
    description:
      "Loggknappen syns nu även för ärenden med 'dold i mimer.nu', vilket åtgärdar problemet för externa leverantörer.",
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-02-11',
    title: 'Odoo: Planerad aktivitet',
    description:
      "Åtgärdat bugg där en planerad aktivitet felaktigt skapades när man angav 'planerat utförandedatum'.",
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-02-11',
    title: 'Odoo: Skicka meddelande i mobilläge',
    description:
      "Fixad bugg för 'Skicka meddelande'-funktionen där knapparna inte syntes i mobilläget och tvingade horisontell skroll.",
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-02-11',
    title: 'Odoo: Komponenter i lägenhetsrum',
    description:
      'Det går nu att lägga till komponenter i lägenheters rum direkt från Odoo. OBS: Komponentkategorin och undertyp behöver finnas i ONECore för att komponenten ska kunna läggas till.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-02-11',
    title: 'Odoo: AI-tolkning av bilder till komponenter',
    description:
      'Stöd för AI-tolkning av bilder till komponenter från Odoo. Kategori och undertyp behöver finnas i ONECore.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-02-12',
    title: 'Befarade kundförluster på fakturor',
    description:
      'Stöd för bokföringskod och befarade kundförluster på fakturor. Transaktioner på konto 1529 exkluderas och motsvarande fakturor markeras som befarade kundförluster. Befarade kundförluster visas i fakturatabellen.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-02-12',
    title: 'Förbättringar av noteringar på kunder',
    description:
      "Manuellt skrivna signaturer utan tid tolkas nu korrekt, osignerade noteringar visas med texten 'Osignerad notering', datum utan tid visas i rätt format, och noteringar utan datum sorteras sist.",
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-02-13',
    title: 'Buggfix i kommentar bilplatser',
    description:
      'Fixar ett problem där det inte gick att spara kommentarer på bilplatsannonser',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-02-19',
    title: 'Klickbara telefonnummer',
    description:
      'Telefonnummer på kundkortet har nu en telefonikon som öppnar uppringning direkt.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-02-19',
    title: 'Buggfix i sökning på hyreskontrakt',
    description:
      'Fixar ett problem där sökning på kontraktsnummer (t.ex. 406-022-05-0201) inte gav några träffar.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-02-20',
    title: 'Sökfält på startsidan',
    description:
      'Global sökning finns nu direkt på startsidan för snabbare åtkomst till fastigheter, lägenheter och kunder.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-02-20',
    title: 'Förbättrad mobilsökning',
    description:
      'Sökfunktionen fungerar nu bättre på mobila enheter med kortare platshållartext och direktåtkomst till sökmodalen.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-02-24',
    title: 'Ny sida: Nyckelportalen',
    description:
      'En ny sida för administration av låssystem, nycklar och nyckellån har lanserats. Nyckelportalen nås via nyckelportalen.mimer.nu. Vi går över till att använda den här sidan från och med den 18e mars.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-02-25',
    title: 'Meny för desktop',
    description: 'Menyn på uthyrning finns nu också anpassad för desktop.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-02-25',
    title: 'Karta visas på erbjudande-mail för parkeringsplatser',
    description:
      'Erbjudande-mail för parkeringsplatser innehåller nu en karta som visar var parkeringsplatsen är belägen, vilket gör det enklare för mottagaren att förstå vilken bilplats erbjudandet gäller.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-03-03',
    title: 'Förbättring i erbjudande-processen för bilplatser',
    description:
      'Skapa erbjudande och acceptera erbjudande kontrollerar nu att sökandes kontrakt inte förändrats på ett sådant sätt att de inte längre har rätt att söka bilplatsen i fråga. Detta minskar risken för att sökande får erbjudanden som de inte längre är berättigade till, vilket förbättrar användarupplevelsen och effektiviteten i erbjudande-processen.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-03-04',
    title: 'Massutskick av SMS och e-post',
    description:
      'Det går nu att skicka SMS och e-post till flera hyresgäster samtidigt direkt från hyreskontraktssidan. Man kan välja enskilda mottagare eller flera. Det går även att skicka SMS/Mejl från kundkortet.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-03-04',
    title: 'Exportera hyresavtal till Excel',
    description:
      'Excel-export som tidigare bara fanns för spärrar finns nu även för hyresavtal.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-03-04',
    title: 'Ändrat metod för SMS- och e-postutskick',
    description:
      'Ändrat metod för att göra sms och epost-utskick i syfte att komma åt bugg med att meddelanden inte levererats.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-03-04',
    title: 'Stöd för länkar i annonsinnehåll',
    description:
      'Annonsinnehåll stöder nu länkar, vilket gör det möjligt att inkludera klickbara URL:er i annonstexter.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-03-04',
    title:
      'Byta bilplats för sökande med bostad i område eller fastighet med utökade regler',
    description:
      'På Mimer.nu går det nu går att välja att byta bilplats också för sökande med bostad i område eller fastighet med utökade regler. Tidigare har den typen av sökande behövt gå via kundtjänst för att byta bilplats.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-03-04',
    title: 'Klickbara nyheter med popup',
    description:
      "Det går nu att klicka på nyheter och uppdateringar på startsidan för att öppna en popup som visar alla nyheter. Klicka på rubriken, en enskild nyhet eller 'Visa alla nyheter' för att se hela listan.",
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-03-09',
    title: 'Förbättrade e-postmallar för poängfria bilplatser',
    description:
      'E-postmeddelanden för godkända och nekade ansökningar om poängfria bilplatser använder nu Infobip-mallar istället för hårdkodade texter. Detta ger ett enhetligt utseende och gör det enklare att uppdatera innehållet.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-03-18',
    title: 'Nyckelhantering i ONECore',
    description:
      'All nyckelhantering sker nu i ONECore istället för i Xpand. Knappen "Nycklar" finns direkt på startsidan och det är därifrån all nyckelhantering görs. Vid sökning på en kund finns fliken "Nycklar" som visar alla nycklar utlånade till kunden. Det går inte längre att hantera nycklar i Xpand.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-03-25',
    title: 'Uppdaterad sortering i fastighetsträdet',
    description:
      'Sorteringen i fastighetsträdet och söksidan har uppdaterats för att visa objekt i korrekt ordning.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-03-25',
    title: 'Ströfakturaunderlag',
    description: 'Det går nu att skapa ströfakturor direkt i ONECore.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-03-25',
    title: 'Feedback',
    description:
      'Det går nu att skicka in feedback och utvecklingsförslag direkt i ONECore. Du hittar en feedbackknapp i menyn.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-03-25',
    title: 'Ströfakturor på Mina sidor',
    description: "Kunder kan nu visa ströfakturor på 'Mina sidor'.",
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-03-30',
    title: 'Uppgångar som egna noder i fastighetsträdet',
    description:
      'Uppgångar visas nu som expanderbara noder i sidomenyn mellan byggnader och lägenheter. Varje uppgång har en egen detaljsida med grundläggande information och lista över tillhörande lägenheter.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-03-30',
    title: 'Uppdaterade ikoner i fastighetsträdet',
    description:
      'Ikonerna i navigeringsträdet har uppdaterats för att tydligare skilja mellan företag, fastigheter, byggnader, uppgångar och lägenheter.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-03-31',
    title: 'Kopieringsknappar och Google Maps för hyresgästinformation',
    description:
      'Kopieringsknappar har återställts för hyresgästinformation (namn, personnummer, adress, kundnummer). Adressen har även en knapp för att öppna i Google Maps.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-03-31',
    title: 'Kontaktuppgifter vid adressbyte',
    description:
      'Åtgärdat bugg där kontaktuppgifter inte kunde hämtas samma dag som hyresgästen byter adress.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-03-31',
    title: 'Parkeringar syns inte på mimer.nu',
    description:
      'Åtgärdat bugg där fel uppstod vid visning av nya parkeringar för parkeringshyresgäster som saknar lägenhetskontrakt.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-04-01',
    title: 'Annan fakturamottagare visas inte längre som kontraktsinnehavare',
    description:
      'Annan fakturamottagare visas inte längre felaktigt som kontraktsinnehavare.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-04-01',
    title: 'Sök kund på telefonnummer',
    description:
      'Det går nu att söka efter kunder via telefonnummer i ONECore.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-04-01',
    title: 'Sortering efter kolumner på hyreskontrakt',
    description: 'Det går nu att sortera hyreskontrakt efter kolumner.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-04-01',
    title: 'Uppsagda kontrakt visas nu under Hyresgäst-fliken',
    description:
      "Kontrakt med status 'Uppsagt' visas nu korrekt som nuvarande kontraktsinnehavare i Hyresgäst-fliken tills kontraktet har upphört.",
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-04-01',
    title: 'Mellanslag trimmas i global sökning',
    description:
      'Ledande och avslutande mellanslag tas nu bort automatiskt vid sökning, vilket ger mer träffsäkra sökresultat.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-04-09',
    title: 'SMS- och mejldialog återställd på kundkort och bostadssida',
    description:
      'SMS- och mejlknapparna på kundkortet och hyresgästfliken på bostadssidan öppnar nu åter dialogerna för att skicka meddelanden via ONECore istället för enhetens standardappar.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-04-17',
    title: 'Skapa ärende från lokal och bilplats skickar nu rätt typ till Odoo',
    description:
      'Tidigare skickades lokal- och bilplatsärenden som lägenhet till Odoo, vilket gav fel utrymme i ärendet. Nu skickas rätt typ (Lokal respektive Bilplats).',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-04-17',
    title: 'Skapa ärende från uppgång',
    description:
      'Det går nu att skapa ärenden direkt från uppgångsvyn. Ärendet öppnas i Odoo med byggnadskod och utrymme Uppgång förifyllt.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-04-17',
    title: 'Skapa ärende från underhållsenhet i byggnadsvyn',
    description:
      "Knappen 'Skapa ärende' på underhållsenheter i byggnadsvyn är nu aktiverad. Ärendet öppnas i Odoo med fastighetsnamn, typ och enhetskod förifyllt.",
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-04-17',
    title: 'Ärendehistorik visas nu för lokaler och bilplatser',
    description:
      'Fliken Ärenden på lokal- och bilplatssidor hämtar och visar nu ärendehistorik korrekt.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-04-17',
    title: 'Mobilanpassad uppgångssida',
    description:
      'Uppgångssidan visar nu ett mobilanpassat accordion-gränssnitt på små skärmar, i linje med övriga detaljsidor.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-05-20',
    title: 'Inomhustemperatur på lägenhetskortet',
    description:
      'Under Grundläggande information på lägenhetssidan visas nu den senaste inomhustemperaturen, hämtad från EcoGuard Curves. Värdet är medelvärdet av lägenhetens givare vid senaste timmen och visar tidpunkt för senaste mätning samt en länk till noden i EcoGuard Curves.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-05-26',
    title: 'Lägenhetsbesiktning',
    description:
      'Det går nu att skapa och genomföra interna lägenhetsbesiktningar i ONECore. Besiktningsmän kan registrera skick och anmärkningar per komponent, lägga till rum och komponenter, ta foton, ange kostnadsansvar och generera PDF-protokoll. Funktionen är tillgänglig för användare med rollen besiktning.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-05-26',
    title: 'Snabbare laddning av nyckel- och lånelistor',
    description:
      'Listorna för nycklar, nyckelknippor och nyckellån i nyckelportalen laddar nu betydligt snabbare.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-05-26',
    title: 'Typ av fakturahändelse visas och krediter inkluderas',
    description:
      'Fakturahändelser har nu en Typ-kolumn (Faktura, Kredit, Inbetalning, Påminnelse) och krediterade fakturor visas åter i listan.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-05-26',
    title: 'Sammanfattningsruta för betalda fakturor borttagen',
    description:
      'Den gröna rutan med betaldatum, källa och inbetalat belopp som visades ovanför fakturahändelser har tagits bort efter återkoppling från ekonomi och kundcenter.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-05-29',
    title: 'Exportera nycklar per fastighet',
    description:
      'På en fastighet finns nu knappen Exportera nycklar som laddar ner en Excel-fil med samtliga hyreskontrakt och tillhörande nycklar. Exporten kan begränsas till en specifik byggnad.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-05-29',
    title: 'Markera hela rum som Utan anmärkningar',
    description:
      'Ny knapp i rummets rubrik som markerar alla komponenter i rummet som God i ett klick. Komponenter du redan har bedömt lämnas orörda.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-05-29',
    title: 'Enklare registrering av kostnad och kostnadsansvar',
    description:
      'Kostnadsansvar visas nu bara för komponenter med skick Skadad, och kostnadsfältet döljs när hyresvärden bär kostnaden. Mindre att fylla i, mindre att missa.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-05-29',
    title: 'Snabbare navigering mellan rum',
    description:
      'Högst upp i besiktningen visas alltid en lista över rummen. Klick på ett rum öppnar det och hoppar dit. På mobil scrollar listan automatiskt så det aktiva rummet hålls i bild.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-05-29',
    title: 'Historiska besiktningar visar även Besiktningsresultat skickat',
    description:
      'Besiktningar med status Besiktningsresultat skickat visas nu tillsammans med Genomförda besiktningar i historiken — tidigare filtrerades de bort.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-06-05',
    title: 'Förvaltningsområden',
    description:
      'Ny vy som visar varje kostnadsställe/distrikt med sina KVV-områden, ansvarig kvartersvärd och totaler för fastigheter, uppgångar, bostäder och bilplatser. Behöriga användare kan dra och släppa fastigheter mellan KVV-områden och byta ansvarig kvartersvärd. Hyreskontrakt kan nu också filtreras på kvartersvärd utifrån områdena.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-06-05',
    title: 'Rätt kund på nyckelkvittensen',
    description:
      'Nyckelkvittensen genereras nu utifrån den kund du sökt på, så att rätt kund alltid hamnar på kvittensen.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-06-05',
    title: 'Mindre nyckelkvittenser',
    description:
      'Nyckelkvittenser komprimeras nu när de genereras, vilket kraftigt minskar filstorleken och lagringsutrymmet.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-06-05',
    title: 'SMS skickas nu via Tele2',
    description:
      'Alla SMS som skickas från ONECore går nu via Tele2 i stället för Infobip, kopplat till kommunens avtal. Meddelandena ser likadana ut för mottagaren och avsändaren "Mimer" är oförändrad. E-post skickas fortsatt via egen instans av Infobip.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-06-16',
    title: 'Skateboard för kommunikationslogg är ute!',
    description:
      'Nu sparar vi alla meddelanden som skickas från kontraktslistan och kundkortet i en kommunikationslogg på varje kund. Logging av SMS från Odoo, mejl med bilplatserbjudande samt leveransstatus innefattas inte ännu, men är på gång härnäst!',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-06-16',
    title: 'Kvartersvärdar från Keycloak',
    description:
      'En API-bugg gjorde att kvartersvärdar från subgrupper i Keycloak inte dök upp i API-svaret. Felet är nu åtgärdat och kvartersvärdar dyker upp i gränssnittet igen.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-07-01',
    title: 'Redigera Anläggnings ID Mälarenergi',
    description:
      'Nu går det att uppdatera eller lägga till "Anläggnings ID Mälarenergi" direkt på lägenheten i ONECore. Klicka på pennan bredvid fältet för att redigera värdet – ändringen sparas direkt mot Xpand.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-07-02',
    title: 'Klickbara länkar till hyresobjekt',
    description:
      'Nu kan du klicka dig direkt vidare till ett hyresobjekt från fler ställen i systemet, på en hyresgästs kontraktsflik och i listan över hyreskontrakt.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-07-02',
    title: 'Intern kreditkontroll för hyresgäster med kommande kontrakt',
    description:
      'Vid ansökan om en bilplats görs den automatiska kreditkontrollen nu internt (utifrån betalningshistorik hos oss) för sökande som har ett kommande kontrakt som ännu inte har börjat gälla. Tidigare skickades blivande hyresgäster med påskrivet men ej påbörjat kontrakt till extern kreditupplysning.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-07-02',
    title: 'Sök ärenden direkt från toppsöket',
    description:
      'Skriv ett ärendenummer som "od-12345" i toppsöket för att hoppa direkt till ärendet i Odoo – det öppnas i en ny flik. Övriga sökningar påverkas inte.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-07-02',
    title: 'Sökbar referens på ströfaktura',
    description:
      'Referens-fältet på ströfakturan är nu ett sökbart fält där du kan skriva för att filtrera på namn, istället för en vanlig rullgardinslista.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-07-02',
    title: 'Sökträffar i nummerordning',
    description:
      'Sökresultat sorteras nu i stigande objektnummerordning, vilket gör det enklare att hitta rätt objekt.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-07-02',
    title: 'Förfallna fakturor markeras automatiskt',
    description:
      'En faktura får nu status "Förfallen" automatiskt när förfallodatumet har passerat.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-07-02',
    title: 'Mindre förbättringar och rättningar',
    description:
      'Diverse mindre justeringar: felanmälningar taggas inte längre felaktigt mot tvättstugan, P-nummer visas på hyresgästkortet, förvaltarfiltret sorteras i bokstavsordning och en förtydligande hjälptext har lagts till på ströfakturasidan.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-07-08',
    title: 'Skapa ströfaktura direkt från kundkortet',
    description:
      'Nu kan du starta en ny ströfaktura direkt från en hyresgäst. På fakturafliken på kundkortet finns knappen "Skapa ströfaktura" som tar dig till ströfakturaformuläret med kunden redan ifylld.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-07-08',
    title: 'Avtalsmallar visas inte längre i kontraktssökningen',
    description:
      "Avtalsmallar från Xpand kunde tidigare felaktigt dyka upp som gällande kontrakt i sökresultaten på hyreskontrakts-sidan, vilket gav 'tomma' kontrakt i resultaten.",
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-07-08',
    title: 'Sök på fastighetsnummer',
    description:
      'Du kan nu söka på fastighetsnummer i fastighetssökningen. Numret visas även i sökträffarna i toppsöket.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-07-08',
    title: 'Fler meddelanden hamnar i kommunikationsloggen',
    description:
      'Nu loggas även automatiska utskick på kundens kommunikationslogg – bilplatserbjudanden samt SMS och e-post om ärenden som skickas via Odoo. Tidigare syntes bara meddelanden som skickades manuellt från ONECore.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-07-08',
    title: 'Leveransstatus i kommunikationsloggen',
    description:
      'Varje meddelande i kommunikationsloggen visar nu sin leveransstatus – till exempel levererat, skickat, misslyckades eller studsade – så att du snabbt ser om ett SMS eller mejl kom fram till mottagaren. Meddelanden från innan denna funktion infördes visas för tillfället med status väntar',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-08-06',
    title: 'Nytt flöde för lägenhetsbesiktningar',
    description:
      'Besiktningsflödet är omgjort med ny design och fungerar nu lika bra i mobilen som på datorn. Du guidas rum för rum och bedömer skicket (God/Ok/Skadad) på ytor och komponenter, lägger till detaljer, anteckningar och foton, och avslutar med kontrollfrågor och en sammanställning innan besiktningen slutförs.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-08-06',
    title: 'Skapa ärenden i Odoo från en besiktning',
    description:
      'Skadade komponenter kan tilldelas resursgrupper i besiktningens sammanställning. När besiktningen slutförs skapas ett ärende per resursgrupp i Odoo, med rum, åtgärder och kostnader i beskrivningen.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-08-06',
    title: 'Flera filer på ströfaktura',
    description:
      'Du kan nu bifoga flera filer när du skapar en ströfaktura. Filerna slås automatiskt ihop till en enda PDF.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-08-06',
    title: 'Återlämna nyckellån från nyckellistan',
    description:
      'I nyckelportalen kan du nu återlämna lånade nycklar direkt från nyckellistan, utan att först gå in på det enskilda lånet.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-08-06',
    title: 'Sök fakturor från toppsöket',
    description:
      'Skriv ett fakturanummer i toppsöket för att gå direkt till fakturan. Fakturasökningen har också gjorts stabilare med bättre hantering av ogiltiga fakturanummer och tomma svar från Xledger.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-08-06',
    title: 'Redigera egna kommentarer på annonser',
    description:
      'Du kan nu redigera kommentarer som du själv har skrivit på en annons.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-08-06',
    title: 'Rätt sida efter inloggning',
    description:
      'Länkar med filter och parametrar behålls nu genom inloggningen, så att du hamnar på rätt sida med rätt innehåll istället för på startsidan.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-08-06',
    title: 'Mobilvyn fastnade i skrivbordsläge',
    description:
      'Ett fel gjorde att appen ibland visade skrivbordsvyn på mobilen tills sidan laddades om. Nu visas rätt vy direkt.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-08-06',
    title: 'Fastighetsuppgifter kunde inte hämtas',
    description:
      'Ett fel gjorde att uppgifter för vissa fastigheter inte kunde hämtas. Detta är nu åtgärdat.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-08-27',
    title: 'Inaktivering av låssystem kasserar systemets nycklar',
    description:
      'När ett låssystem inaktiveras i nyckelportalen visas en varning, och vid bekräftelse kasseras alla nycklar i systemet – även utlånade. Allt loggas i aktivitetsloggen så att åtgärden kan spåras och vid behov återställas.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-08-27',
    title: 'Nya nyckeltyper: Miljöbod och Tvättstuga',
    description:
      'Nycklar kan nu ha typerna Miljöbod (MB) och Tvättstuga (TV). Befintliga övrigt-nycklar märkta "(MB)" eller "(TV)" i namnet har automatiskt fått rätt typ, och märkningen har tagits bort från namnet.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-08-27',
    title: 'Odoo: Distrikt och kvartersvärdsområde på ärenden',
    description:
      'Ärenden visar nu vilket distrikt och kvartersvärdsområde objektet tillhör, tillsammans med nuvarande kvartersvärd och distriktschef. Du kan även söka och gruppera ärendelistan på distrikt och kvartersvärdsområde. Uppgifterna hämtas från Förvaltningsområden i ONECore och fylls i på befintliga ärenden efter hand.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-08-27',
    title: 'Odoo: Ny status "Återsänd" på ärenden',
    description:
      'Ärenden kan nu återsändas. Ärendet får ett återsändningsdatum och lämnas tillbaka till resursgruppen, så att det syns tydligt att det väntar på ny hantering i stället för att ligga kvar på en resurs.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-08-27',
    title: 'Odoo: Pinna noteringar i ärenden',
    description:
      'Viktiga noteringar kan pinnas i ärendets logg så att de ligger kvar högst upp och inte försvinner i flödet. Pinnade noteringar kan lossas igen när de inte längre är aktuella.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-08-27',
    title: 'Odoo: Varning när planerat utförandedatum passerar förfallodatum',
    description:
      'Om du sätter ett planerat utförandedatum som ligger efter ärendets förfallodatum får du en fråga om du vill fortsätta. Ärendet märks också med en varningsikon i ärendelistan och en varningstext i formuläret så länge datumen krockar.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-08-27',
    title: 'Odoo: Statusar och resursgrupper kan inte längre ändras av misstag',
    description:
      'Det går inte längre att lägga till, byta namn på eller ta bort statuskolumner i ärendevyn, och Radera är borttaget på resursgrupper. Resursgrupper som inte används kan fortfarande arkiveras.',
    category: 'improvement',
    pinned: false,
  },
  {
    date: '2026-08-27',
    title: 'Diverse buggfixar och förbättringar',
    description:
      'Parkeringsplatser utan platsnummer eller adress kunde inte visas. Sökning på en kund som inte är hyresgäst gav ett tekniskt fel i stället för ett tydligt svar. Ströfakturor ger nu begripliga felmeddelanden när något går fel mot Xledger, och underliggande tjänster har städats upp.',
    category: 'fix',
    pinned: false,
  },
  {
    date: '2026-09-03',
    title: 'Sök hyresobjekt via fastighetsträdet',
    description:
      'Fastigheter-sidan har en ny flik: Hyresobjekt. Kryssa i distrikt, kvartersvärdsområden, fastigheter, byggnader, trapphus eller parkeringsområden i ett träd, så listas alla hyresobjekt i urvalet direkt. Listan kan filtreras på objekttyp (bostad, bilplats, lokal, övrigt) och undertyp, till exempel lägenhetstyp, och det går att lägga till kolumner som grundhyra, BRA och anläggnings-ID. Varje objekt länkar till sin sida.',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-09-04',
    title: 'Annonshantering i onecore',
    description:
      'Nu hanteras alla annonstexter som syns på hemsidan för lediga hyresobjekt i ONECore',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-09-10',
    title: 'Ikon och länkar till annonstexter',
    description:
      'Snabblänkar till att redigera annonstexter i portalen för bilplatser',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-09-10',
    title: 'Mallar för annonstexter',
    description: 'Det finns nu mallar med rubriker för annonstexter',
    category: 'feature',
    pinned: false,
  },
  {
    date: '2026-09-18',
    title: 'Markera flera hyreskontrakt med shift',
    description:
      'I listan över hyreskontrakt går det nu att hålla in shift och klicka i en kryssruta för att markera alla kontrakt mellan det senast klickade och det valda. Det gör det snabbare att välja många mottagare för SMS eller e-post.',
    category: 'improvement',
    pinned: false,
  },
]

const CREATED_BY = 'migration:property-tree-json'

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.transaction(async (trx) => {
    // 7 columns per row; chunks of 100 stay under the 2100 parameter cap.
    await trx.batchInsert(
      'release_note',
      NOTES.map((note) => ({
        app: 'property-tree',
        title: note.title,
        description: note.description,
        category: note.category,
        pinned: note.pinned,
        publishedAt: new Date(`${note.date}T00:00:00.000Z`),
        createdBy: CREATED_BY,
      })),
      100
    )
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex('release_note').where('createdBy', CREATED_BY).delete()
}
