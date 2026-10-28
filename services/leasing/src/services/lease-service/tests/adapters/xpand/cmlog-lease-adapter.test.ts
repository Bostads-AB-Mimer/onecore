import { parseLeaseChanges } from '../../../adapters/xpand/cmlog-lease-adapter'

describe('parseLeaseChanges', () => {
  it('extracts leaseId, contactCode and rentalObjectId from logmemo', () => {
    const rows = [
      {
        logmemo:
          "Hyreskontrakt 306-010-01-0501/09, PETTERSBERGSGATAN 26, P145543, Bostadskontrakt (Kommande)\nVärdet i fältet 'Undertecknat' ändrat från '1' till '0'.\n\nKopplad kontakt P145543\nVärdet i fältet 'Undertecknat' ändrat från '' till '2026-04-14'.",
        logtime: new Date('2026-04-28T10:00:00Z'),
      },
    ]

    const result = parseLeaseChanges(rows)

    expect(result).toEqual([
      {
        leaseId: '306-010-01-0501/09',
        contactCode: 'P145543',
        rentalObjectId: '306-010-01-0501',
        action: 'create',
        timestamp: new Date('2026-04-28T10:00:00Z'),
      },
    ])
  })

  it('filters out rows that do not contain relevant contract types', () => {
    const rows = [
      {
        logmemo:
          'Hyreskontrakt 520-001-04-0202/04, ORRVÄGEN 8 A, P150996, Parkeringskontrakt (Kommande)',
        logtime: new Date('2026-04-28T10:00:00Z'),
      },
    ]

    const result = parseLeaseChanges(rows)

    expect(result).toEqual([])
  })

  it('emits one entry per matching row, including repeats for the same leaseId', () => {
    const rows = [
      {
        logmemo:
          "Hyreskontrakt 504-022-02-0301/06, SKALLBERGSGATAN 27, P045185, Bostadskontrakt (Uppsagt)\nVärdet i fältet 'Uppsagt datum' ändrat från '' till '2026-04-29'.",
        logtime: new Date('2026-04-29T10:00:00Z'),
      },
      {
        logmemo:
          "Hyreskontrakt 504-022-02-0301/06, SKALLBERGSGATAN 27, P045185, Bostadskontrakt (Uppsagt)\nVärdet i fältet 'Uppsagt datum' ändrat från '' till '2026-04-28'.",
        logtime: new Date('2026-04-28T10:00:00Z'),
      },
    ]

    const result = parseLeaseChanges(rows)

    expect(result).toHaveLength(2)
  })

  it('handles Lokalkontrakt and Garagekontrakt', () => {
    const rows = [
      {
        logmemo:
          "Hyreskontrakt 504-024-11-0001/09, SKALLBERGSGATAN 12 B, P142281, Lokalkontrakt (Uppsagt)\nVärdet i fältet 'Uppsagt datum' ändrat från '' till '2026-04-10'.",
        logtime: new Date('2026-04-10T10:00:00Z'),
      },
      {
        logmemo:
          "Hyreskontrakt 209-901-00-0009/09M, TORNSVALEGATAN 1, P208394, Garagekontrakt (Makulerat)\nVärdet i fältet 'Makulerat datum' ändrat från '' till '2026-04-14'.\nVärdet i fältet 'Kontraktsnummer' ändrat från '209-901-00-0009/09' till '209-901-00-0009/09M'.",
        logtime: new Date('2026-04-14T10:00:00Z'),
      },
    ]

    const result = parseLeaseChanges(rows)

    expect(result).toHaveLength(2)
  })

  it('returns action "create" when logmemo contains Undertecknat changed from empty to date', () => {
    const rows = [
      {
        logmemo:
          "Hyreskontrakt 306-010-01-0501/09, PETTERSBERGSGATAN 26, P145543, Bostadskontrakt (Kommande)\nVärdet i fältet 'Undertecknat' ändrat från '1' till '0'.\n\nKopplad kontakt P145543\nVärdet i fältet 'Undertecknat' ändrat från '' till '2026-04-14'.",
        logtime: new Date('2026-04-28T10:00:00Z'),
      },
    ]

    const result = parseLeaseChanges(rows)

    expect(result).toEqual([
      {
        leaseId: '306-010-01-0501/09',
        contactCode: 'P145543',
        rentalObjectId: '306-010-01-0501',
        action: 'create',
        timestamp: new Date('2026-04-28T10:00:00Z'),
      },
    ])
  })

  describe('ignore cases', () => {
    it('ignores Koppling document attachment', () => {
      const rows = [
        {
          logmemo:
            'Hyreskontrakt 306-002-04-0401/07, PETTERSBERGSGATAN 29 B, P078554, Bostadskontrakt (Gällande)\nKoppling till 306-002-04-0401/0711 Kvittens passagedroppar P081792 är tillagd.',
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('ignores Kopplad blankett form template', () => {
      const rows = [
        {
          logmemo:
            'Hyreskontrakt 520-001-04-0202/04, ORRVÄGEN 8 A, P150996, Bostadskontrakt (Registreras)\nKopplad blankett BOSTAD-02:M-MANUELL Hyreskontrakt för manuell signering, Bilaga M\nBOSTAD-02:M-MANUELL Hyreskontrakt för manuell signering, Bilaga M avförd',
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('ignores Hyresrad rent row changes', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 406-068-03-0101/08, SPÅRHUNDSVÄGEN 95, P081880, Bostadskontrakt (Kommande)\n\nHyresrad HEMFÖR 2026-05-01 - 2026-05-01\nVärdet i fältet 'Årshyra' ändrat från '1 368,00' till '0,00'.",
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('ignores Godkänt datum/signatur approval step', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 520-001-04-0202/04, ORRVÄGEN 8 A, P150996, Bostadskontrakt (Väntar på underskrift)\nVärdet i fältet 'Godkänt datum' ändrat från '' till '2026-04-16'.\nVärdet i fältet 'Godkänt signatur' ändrat från '' till 'JOHSVE'.",
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('ignores Preliminärt uppsagt fields', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 807-033-03-0602/01, STYRBORDSGATAN 11, P195163, Bostadskontrakt (Preliminärt uppsagt)\nVärdet i fältet 'Prel. önskad avflyttning' ändrat från '' till '2026-07-31'.\nVärdet i fältet 'Prel. sista debiteringsdatum' ändrat från '' till '2026-07-31'.\nVärdet i fältet 'Preliminärt uppsagt' ändrat från '' till '2026-04-16'.\nVärdet i fältet 'Preliminärt uppsagt, signatur' ändrat från '' till 'WEB'.",
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('ignores Önskad avflyttning date change on already-terminated contract', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 510-702-00-0035/04, VIKHUSGATAN 5-7, P082085, Bostadskontrakt (Uppsagt)\nVärdet i fältet 'Önskad avflyttning' ändrat från '2026-06-01' till '2026-05-31'.\nVärdet i fältet 'Sista debiteringsdatum' ändrat från '2026-06-30' till '2026-05-31'.",
          logtime: new Date('2026-04-14T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('ignores Uppsagt datum reversed from date back to empty', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 705-723-00-0039/12, STENTORPSGATAN 7, P224817, Bostadskontrakt (Gällande)\nVärdet i fältet 'Uppsagt datum' ändrat från '2026-04-02' till ''.\nVärdet i fältet 'Uppsagt signatur' ändrat från 'MALROS' till ''.\nVärdet i fältet 'Uppsagt av' ändrat från 'G' till ''.\nVärdet i fältet 'Önskad avflyttning' ändrat från '2026-05-31' till ''.\nVärdet i fältet 'Sista debiteringsdatum' ändrat från '2026-05-31' till ''.",
          logtime: new Date('2026-04-14T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('ignores Undertecknat changed from 1 to 0 (not from empty)', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 520-001-04-0202/04, ORRVÄGEN 8 A, P150996, Bostadskontrakt (Kommande)\nVärdet i fältet 'Undertecknat' ändrat från '1' till '0'.",
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('ignores Uppsägning av bostad attachment on Preliminärt uppsagt', () => {
      const rows = [
        {
          logmemo:
            'Hyreskontrakt 807-033-03-0602/01, STYRBORDSGATAN 11, P195163, Bostadskontrakt (Preliminärt uppsagt)\nKoppling till 807-033-03-0602/012 Uppsägning av bostad är tillagd.',
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('ignores Nyckelkvittens attachment', () => {
      const rows = [
        {
          logmemo:
            'Hyreskontrakt 104-068-04-0203/16, SÖDRA ALLÉGATAN 23, P161700, Bostadskontrakt (Kommande)\nKoppling till 104-068-04-0203/167 104-068-04-0203 Nyckelkvittens är tillagd.',
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('ignores Hyresrad T.o.m. date change', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 508-006-03-0202/12, BELLMANSGATAN 3 A, P139145, Bostadskontrakt (Uppsagt)\n\nHyresrad TTM60 2026-01-01 - 2026-05-31\nVärdet i fältet 'T.o.m.' ändrat från '' till '2026-05-31'.",
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('ignores Kontraktstid and Hyresrad Fr.o.m. changes', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 702-711-00-0039/13, GEIJERSGATAN 10, P109363, Bostadskontrakt (Registreras)\nVärdet i fältet 'Kontraktstid fr.o.m.' ändrat från '2026-07-01' till '2026-07-22'.\n\nHyresrad HYRAP 2026-07-22 - \nVärdet i fältet 'Fr.o.m.' ändrat från '2026-07-01' till '2026-07-22'.",
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })
  })

  describe('terminate and void cases', () => {
    it('returns action "terminate" when Uppsagt datum is set from empty to date', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 504-022-02-0301/06, SKALLBERGSGATAN 27, P045185, Bostadskontrakt (Uppsagt)\nVärdet i fältet 'Uppsagt datum' ändrat från '' till '2026-04-29'.\nVärdet i fältet 'Uppsagt av' ändrat från '' till 'G'.\nVärdet i fältet 'Uppsagt signatur' ändrat från '' till 'ADAMAR'.\nVärdet i fältet 'Önskad avflyttning' ändrat från '' till '2026-07-31'.\nVärdet i fältet 'Sista debiteringsdatum' ändrat från '' till '2026-07-31'.",
          logtime: new Date('2026-04-29T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([
        {
          leaseId: '504-022-02-0301/06',
          contactCode: 'P045185',
          rentalObjectId: '504-022-02-0301',
          action: 'terminate',
          timestamp: new Date('2026-04-29T10:00:00Z'),
        },
      ])
    })

    it('returns action "terminate" for Upphört contract with Uppsagt datum set', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 209-028-02-0301/05, LÖVSÅNGARGATAN 46, P063806, Bostadskontrakt (Upphört)\nVärdet i fältet 'Uppsagt datum' ändrat från '' till '2026-04-13'.\nVärdet i fältet 'Uppsagt av' ändrat från '' till 'G'.\nVärdet i fältet 'Uppsagt signatur' ändrat från '' till 'FILULF'.\nVärdet i fältet 'Önskad avflyttning' ändrat från '' till '2026-04-09'.\nVärdet i fältet 'Sista debiteringsdatum' ändrat från '' till '2026-04-09'.",
          logtime: new Date('2026-04-13T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([
        {
          leaseId: '209-028-02-0301/05',
          contactCode: 'P063806',
          rentalObjectId: '209-028-02-0301',
          action: 'terminate',
          timestamp: new Date('2026-04-13T10:00:00Z'),
        },
      ])
    })

    it('returns action "void" when Makulerat datum is set (Bostadskontrakt)', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 104-013-01-0106/10M, BRAHEGATAN 4 A, P226616, Bostadskontrakt (Makulerat)\nVärdet i fältet 'Makulerat datum' ändrat från '' till '2026-04-13'.\nVärdet i fältet 'Kontraktsnummer' ändrat från '104-013-01-0106/10' till '104-013-01-0106/10M'.",
          logtime: new Date('2026-04-13T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([
        {
          leaseId: '104-013-01-0106/10',
          contactCode: 'P226616',
          rentalObjectId: '104-013-01-0106',
          action: 'void',
          timestamp: new Date('2026-04-13T10:00:00Z'),
        },
      ])
    })

    it('returns action "void" when Makulerat datum is set (Garagekontrakt)', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 209-901-00-0009/09M, TORNSVALEGATAN 1, P208394, Garagekontrakt (Makulerat)\nVärdet i fältet 'Makulerat datum' ändrat från '' till '2026-04-14'.\nVärdet i fältet 'Kontraktsnummer' ändrat från '209-901-00-0009/09' till '209-901-00-0009/09M'.",
          logtime: new Date('2026-04-14T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([
        {
          leaseId: '209-901-00-0009/09',
          contactCode: 'P208394',
          rentalObjectId: '209-901-00-0009',
          action: 'void',
          timestamp: new Date('2026-04-14T10:00:00Z'),
        },
      ])
    })
  })

  describe('edge cases', () => {
    it('only returns matching rows from a mixed input', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 504-022-02-0301/06, SKALLBERGSGATAN 27, P045185, Bostadskontrakt (Uppsagt)\nVärdet i fältet 'Uppsagt datum' ändrat från '' till '2026-04-29'.\nVärdet i fältet 'Uppsagt av' ändrat från '' till 'G'.\nVärdet i fältet 'Uppsagt signatur' ändrat från '' till 'ADAMAR'.\nVärdet i fältet 'Önskad avflyttning' ändrat från '' till '2026-07-31'.\nVärdet i fältet 'Sista debiteringsdatum' ändrat från '' till '2026-07-31'.",
          logtime: new Date('2026-04-29T10:00:00Z'),
        },
        {
          logmemo:
            'Hyreskontrakt 306-002-04-0401/07, PETTERSBERGSGATAN 29 B, P078554, Bostadskontrakt (Gällande)\nKoppling till 306-002-04-0401/0711 Kvittens passagedroppar P081792 är tillagd.',
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
        {
          logmemo:
            "Hyreskontrakt 209-901-00-0009/09M, TORNSVALEGATAN 1, P208394, Garagekontrakt (Makulerat)\nVärdet i fältet 'Makulerat datum' ändrat från '' till '2026-04-14'.\nVärdet i fältet 'Kontraktsnummer' ändrat från '209-901-00-0009/09' till '209-901-00-0009/09M'.",
          logtime: new Date('2026-04-14T10:00:00Z'),
        },
        {
          logmemo:
            "Hyreskontrakt 520-001-04-0202/04, ORRVÄGEN 8 A, P150996, Bostadskontrakt (Väntar på underskrift)\nVärdet i fältet 'Godkänt datum' ändrat från '' till '2026-04-16'.\nVärdet i fältet 'Godkänt signatur' ändrat från '' till 'JOHSVE'.",
          logtime: new Date('2026-04-16T10:00:00Z'),
        },
      ]

      const result = parseLeaseChanges(rows)

      expect(result).toEqual([
        {
          leaseId: '504-022-02-0301/06',
          contactCode: 'P045185',
          rentalObjectId: '504-022-02-0301',
          action: 'terminate',
          timestamp: new Date('2026-04-29T10:00:00Z'),
        },
        {
          leaseId: '209-901-00-0009/09',
          contactCode: 'P208394',
          rentalObjectId: '209-901-00-0009',
          action: 'void',
          timestamp: new Date('2026-04-14T10:00:00Z'),
        },
      ])
    })

    it('extracts pre-M leaseId from Kontraktsnummer rename line on Makulerat', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 508-007-10-0201/09M2, KARLFELDTSGATAN 38 A, P140676, Bostadskontrakt (Makulerat)\nVärdet i fältet 'Makulerat datum' ändrat från '' till '2026-04-10'.\nVärdet i fältet 'Kontraktsnummer' ändrat från '508-007-10-0201/09' till '508-007-10-0201/09M2'.",
          logtime: new Date('2026-04-10T10:00:00Z'),
        },
      ]

      const result = parseLeaseChanges(rows)

      expect(result).toEqual([
        {
          leaseId: '508-007-10-0201/09',
          contactCode: 'P140676',
          rentalObjectId: '508-007-10-0201',
          action: 'void',
          timestamp: new Date('2026-04-10T10:00:00Z'),
        },
      ])
    })

    it('skips Makulerat rows that lack a Kontraktsnummer rename line', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 104-013-01-0106/10M, BRAHEGATAN 4 A, P226616, Bostadskontrakt (Makulerat)\nVärdet i fältet 'Makulerat datum' ändrat från '' till '2026-04-13'.",
          logtime: new Date('2026-04-13T10:00:00Z'),
        },
      ]

      expect(parseLeaseChanges(rows)).toEqual([])
    })

    it('does not let ignored rows block later matching rows for same leaseId', () => {
      const rows = [
        {
          logmemo:
            'Hyreskontrakt 504-022-02-0301/06, SKALLBERGSGATAN 27, P045185, Bostadskontrakt (Gällande)\nKoppling till 504-022-02-0301/063 Fullmakt nycklar är tillagd.',
          logtime: new Date('2026-04-30T10:00:00Z'),
        },
        {
          logmemo:
            "Hyreskontrakt 504-022-02-0301/06, SKALLBERGSGATAN 27, P045185, Bostadskontrakt (Uppsagt)\nVärdet i fältet 'Uppsagt datum' ändrat från '' till '2026-04-29'.\nVärdet i fältet 'Uppsagt av' ändrat från '' till 'G'.",
          logtime: new Date('2026-04-29T10:00:00Z'),
        },
      ]

      const result = parseLeaseChanges(rows)

      expect(result).toEqual([
        {
          leaseId: '504-022-02-0301/06',
          contactCode: 'P045185',
          rentalObjectId: '504-022-02-0301',
          action: 'terminate',
          timestamp: new Date('2026-04-29T10:00:00Z'),
        },
      ])
    })

    it('emits multiple events for the same leaseId in chronological order', () => {
      const rows = [
        {
          logmemo:
            "Hyreskontrakt 504-022-02-0301/06, SKALLBERGSGATAN 27, P045185, Bostadskontrakt (Kommande)\nVärdet i fältet 'Undertecknat' ändrat från '' till '2026-04-28'.",
          logtime: new Date('2026-04-28T10:00:00Z'),
        },
        {
          logmemo:
            "Hyreskontrakt 504-022-02-0301/06, SKALLBERGSGATAN 27, P045185, Bostadskontrakt (Uppsagt)\nVärdet i fältet 'Uppsagt datum' ändrat från '' till '2026-04-29'.",
          logtime: new Date('2026-04-29T10:00:00Z'),
        },
      ]

      const result = parseLeaseChanges(rows)

      expect(result).toHaveLength(2)
      expect(result[0].action).toBe('create')
      expect(result[0].timestamp).toEqual(new Date('2026-04-28T10:00:00Z'))
      expect(result[1].action).toBe('terminate')
      expect(result[1].timestamp).toEqual(new Date('2026-04-29T10:00:00Z'))
    })
  })
})
