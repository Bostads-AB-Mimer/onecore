export interface MiscellaneousInvoiceArticle {
  id: string
  name: string
  standardPrice: number
}

export const MiscellaneousInvoiceArticles: MiscellaneousInvoiceArticle[] = [
  { id: '369400', name: 'Varmvatten, debitering', standardPrice: 0 },
  { id: '329007', name: 'Nycklar', standardPrice: 250 },
  { id: '324100', name: 'Besiktningskostnader', standardPrice: 0 },
  { id: '321100', name: 'Reparation lägenhet', standardPrice: 0 },
  { id: '321200', name: 'Målning lägenhet', standardPrice: 0 },
  { id: '321300', name: 'Golvslipning', standardPrice: 0 },
  { id: '322100', name: 'Städning', standardPrice: 1500 },
  { id: '322200', name: 'Storstädning', standardPrice: 3500 },
  { id: '323100', name: 'Fönsterputsning', standardPrice: 800 },
  { id: '325100', name: 'Låsbyte', standardPrice: 1200 },
  { id: '325200', name: 'Extranyckel', standardPrice: 150 },
  { id: '326100', name: 'Sophantering', standardPrice: 500 },
  { id: '327100', name: 'Vattenavstängning', standardPrice: 400 },
  { id: '328100', name: 'Elinstallation', standardPrice: 0 },
  { id: '329100', name: 'Administrativ avgift', standardPrice: 300 },
  { id: '329200', name: 'Förseningsavgift', standardPrice: 250 },
]

export const getArticleById = (
  id: string
): MiscellaneousInvoiceArticle | undefined => {
  return MiscellaneousInvoiceArticles.find((a) => a.id === id)
}
