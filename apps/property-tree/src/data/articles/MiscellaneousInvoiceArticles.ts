export interface MiscellaneousInvoiceArticle {
  id: string
  name: string
  standardPrice: number
}

// TODO These should ideally be fetched from Xledger
export const MiscellaneousInvoiceArticles: MiscellaneousInvoiceArticle[] = [
  {
    id: '329000',
    name: 'Administrativ avgift',
    standardPrice: 595,
  },
  {
    id: '351300',
    name: 'Avhysning och smitning',
    standardPrice: 0,
  },
  {
    id: '324100',
    name: 'Besiktningskostnader',
    standardPrice: 0,
  },
  {
    id: '242700',
    name: 'Depositionsavgift',
    standardPrice: 0,
  },
  {
    id: '361000',
    name: 'Driftkostnader Asköviken',
    standardPrice: 0,
  },
  {
    id: '831300',
    name: 'Dröjsmålsränta enl fastställd dom',
    standardPrice: 0,
  },
  {
    id: '308100',
    name: 'Dygnshyra',
    standardPrice: 0,
  },
  {
    id: '329011',
    name: 'Dödsbo',
    standardPrice: 0,
  },
  {
    id: '179900',
    name: 'Ersättning från försäkringbolag vid skada',
    standardPrice: 0,
  },
  {
    id: '118100',
    name: 'Fakturering projekt nyproduktion',
    standardPrice: 0,
  },
  {
    id: '329002',
    name: 'Flexning',
    standardPrice: 0,
  },
  {
    id: '329008',
    name: 'Flyttstädning',
    standardPrice: 0,
  },
  {
    id: '329004',
    name: 'Förbrukning el, vatten, värme',
    standardPrice: 0,
  },
  {
    id: '329009',
    name: 'Handhavande vitvaror',
    standardPrice: 0,
  },
  {
    id: '329005',
    name: 'Handhavandefel',
    standardPrice: 0,
  },
  {
    id: '329014',
    name: 'Kostnader i samband med avflytt',
    standardPrice: 0,
  },
  {
    id: '351301',
    name: 'Kronofogdens särskilda avgift efter avhysning',
    standardPrice: 0,
  },
  {
    id: '329006',
    name: 'Magasinering enl. bif. underlag',
    standardPrice: 0,
  },
  {
    id: '329007',
    name: 'Nycklar',
    standardPrice: 0,
  },
  {
    id: '329013',
    name: 'Nycklar motorvärmare',
    standardPrice: 0,
  },
  {
    id: '329016',
    name: 'Skadestånd enl fastställd dom',
    standardPrice: 0,
  },
  {
    id: '329010',
    name: 'Tömning av lägenhet',
    standardPrice: 0,
  },
  {
    id: '329015',
    name: 'Utryckningskostnad',
    standardPrice: 0,
  },
  {
    id: '369400',
    name: 'Varmvatten, debitering',
    standardPrice: 0,
  },
  {
    id: '361001',
    name: 'Vidarefakturering med moms',
    standardPrice: 0,
  },
  {
    id: '369300',
    name: 'Värmeenergi, debitering',
    standardPrice: 0,
  },
  {
    id: '329012',
    name: 'Övernattningslägenhet',
    standardPrice: 0,
  },
  {
    id: '329003',
    name: 'Övrig ersättning från hyresgäst',
    standardPrice: 0,
  },
  {
    id: '369800',
    name: 'Övriga intäkter med moms konto 3698',
    standardPrice: 0,
  },
  {
    id: '369900',
    name: 'Övriga intäkter utan moms konto 3699',
    standardPrice: 0,
  },
]

export const getArticleById = (
  id: string
): MiscellaneousInvoiceArticle | undefined => {
  return MiscellaneousInvoiceArticles.find((a) => a.id === id)
}

export const SelectableInvoiceArticles = MiscellaneousInvoiceArticles.filter(
  (a) => a.id !== '329000' && a.id !== '329001'
)
