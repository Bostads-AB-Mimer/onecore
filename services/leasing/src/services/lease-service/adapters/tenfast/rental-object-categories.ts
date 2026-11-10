/**
 * Tenfast's allowed rental object categories (code → label), copied from
 * the hyresobjekt schema in the Tenfast API docs.
 */
export const TENFAST_RENTAL_OBJECT_CATEGORIES: ReadonlyMap<string, string> =
  new Map([
    ['ANPASSAD', 'Anpassad'],
    ['AVS', 'Anvisningsrätt Västerås Stad'],
    ['BLOCK', 'Blockavtal till Västerås Stad'],
    ['BOKOMP', 'Bostadskomplement, lokalyta'],
    ['CO-LIVING', 'Co-living'],
    ['DELABOSTAD', 'Dela Bostad'],
    ['EXTERN', 'Externa'],
    ['G-LOKAL', 'Gemensamhetslokal för bokning'],
    ['FÖRHAN', 'Hyran redan förhandlad'],
    ['KOMMERS', 'Kommersiell lokal'],
    ['KOMMERSM', 'Kommersiell lokal, moms'],
    ['KOOPHYRES', 'Kooperativ hyresrätt'],
    ['KORTTID', 'Korttidskontrakt'],
    ['55PLUS', 'Lätt att Leva'],
    ['NYPROD', 'Nyproduktion'],
    ['NATT', 'Övernattningslägenhet'],
    ['POÄNGFRITT', 'Poängfritt'],
    ['RENOVERAD', 'Renoverad'],
    ['SAMLOKAL', 'Samlingslokal'],
    ['SERV', 'Servicelägenhet'],
    ['SNABB', 'Snabb inflytt'],
    ['STD', 'Standard hyresobjektstyp'],
    ['STUD', 'Studentbostad'],
    ['TRYGG', 'Trygghetsboende'],
    ['UNGDOM', 'Ungdomslägenhet'],
  ])
