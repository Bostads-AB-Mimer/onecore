// Shared, category-agnostic instructions for component image analysis.
// Used by every prompt: the resolver composes <domain block> + BASE_INSTRUCTIONS
// + OUTPUT_FORMAT. Category files (e.g. ./vitvaror) only add domain framing and
// a focus list on top of this base — keep anything generic (image handling,
// conservative defaults) here so it is not duplicated per category.
export const BASE_INSTRUCTIONS = `Analysera bilden/bilderna och extrahera relevant information.

Du kan få EN eller TVÅ bilder:

Om EN bild (typskylt):
- Extrahera all teknisk data (modell, serienummer, specifikationer, dimensioner, garanti)
- Sätt componentType till null om du inte kan identifiera produkttypen från texten

Om EN bild (produktbild):
- Identifiera componentCategory, componentType och componentSubtype visuellt
- Bedöm skick (condition) och uppskatta ålder (estimatedAge)
- Extrahera synlig data om tillgänglig

Om TVÅ bilder:
- Kombinera information från båda bilderna
- Använd produktbilden för att identifiera componentType och bedöma skick
- Använd typskylten för exakta tekniska data (modell, serienummer, specifikationer)

Identifiera komponentens kategori, typ och eventuell undertyp så specifikt som bilden tillåter. Var konservativ när underlaget är osäkert och använd null för fält du inte kan fastställa.`
