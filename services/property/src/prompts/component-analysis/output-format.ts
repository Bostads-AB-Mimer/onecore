// Shared JSON output contract for component image analysis.
// This is the SINGLE source of the response format and must stay in sync with
// AIComponentAnalysisSchema in @onecore/types (libs/types/src/property/schema.ts). Category-specific
// prompts only describe domain guidance; the resolver appends this block so the
// 14-field contract is never duplicated (and never drifts) across prompt files.
export const OUTPUT_FORMAT = `Svara ENDAST med JSON i följande format (inget annat text):
{
  "componentCategory": "övergripande kategori (t.ex. 'Vitvaror', 'VVS', 'Ventilation', 'Ytskikt')",
  "componentType": "typ av komponent (t.ex. 'Kylskåp', 'Radiator', 'Golv')",
  "componentSubtype": "specifik variant om det går att avgöra (annars null)",
  "manufacturer": "tillverkare/märke (om synligt, annars null)",
  "model": "modellnamn/nummer (om synligt, annars null)",
  "serialNumber": "serienummer (om synligt på bild, annars null)",
  "estimatedAge": "uppskattad ålder som text (t.ex. '5-10 år', 'Ny', 'Okänd')",
  "condition": "visuellt skick som text (t.ex. 'Utmärkt', 'Gott', 'Normalt', 'Slitet')",
  "specifications": "tekniska specifikationer om synliga (annars null)",
  "dimensions": "fysiska mått om synliga på etikett (t.ex. 'BxDxH: 60x60x85 cm', annars null)",
  "warrantyMonths": "garantitid i månader om synlig (t.ex. från garantietikett, annars null)",
  "ncsCode": "NCS-färgkod om synlig (format XXX eller XXX.XXX, annars null)",
  "additionalInformation": "övrig relevant information synlig på produkten (annars null)",
  "confidence": 0.85
}

VIKTIGT: Fyll ENDAST i fält där information är synlig eller kan extraheras från bilden. Använd null för fält där du inte är säker. Var konservativ med confidence-värdet (0.0-1.0).`
