// Mappning från stewardRefNr till KVV-områdesnummer
// Dessa nummer är 5-siffriga och representerar kvartersvärdsområden inom ett kostnadsställe

export const STEWARD_TO_KVV_AREA: Record<string, string> = {
  // Kostnadställe 61110 - Mimer Mitt
  "YY2111": "61111",  // Joel Berghök (placeholder - inte i nuvarande data)
  "YY2112": "61112",  // Martin Lundbäck (placeholder - inte i nuvarande data)
  "YY2473": "61113",  // Thomas Sweijer
  "YY1473": "61114",  // Maria Sevedsson
  "YY6841": "61115",  // Rodas Tesfalidet
  "YY2523": "61116",  // Madelen Ling
  "YY2489": "61117",  // Ulrica Hallgren
  "YY2522": "61118",  // Christopher Dahlback
  "YY2531": "61119",  // Emil Strok
  "YY2518": "61120",  // Madelene Eddebring (OBS: samma som kostnadställe 61120, kan behöva justeras)
  
  // Kostnadställe 61120 - Mimer Norr
  "YY2442": "61211",  // Katja Jokinen
  "YY2517": "61212",  // Anton Andreasson
  "YY6845": "61213",  // Camilla Danielsson
  "YY2486": "61214",  // Niklas Nilsson
  "YY2484": "61215",  // Robin Åkerlund
  "YY2450": "61216",  // Owe Hammar
  "YY2507": "61217",  // Mario Bermudez
  
  // Kostnadställe 61130 - Mimer Öst
  "YY2532": "61311",  // Caroline Malmström
  "YY2521": "61312",  // Mikael Kraft
  "YY2474": "61313",  // Renée Erberth
  "YY2528": "61314",  // Ulf Carrass
  "YY2491": "61315",  // Mikael Fröjdfeldt
  "YY2476": "61316",  // Sandra Eriksson
  "YY2527": "61317",  // Mattias Närhi
  "YY2490": "61318",  // Scott Howarth
  "YY2511": "61319",  // Rudy Wallman
  "YY2338": "61320",  // Nina Klingberg Ehnlund
  
  // Kostnadställe 61140 - Mimer Väst
  "YY2480": "61411",  // Rodrigo Garcia
  "YY2228": "61412",  // Sverker Söderström
  "YY2510": "61413",  // Marcus Urby
  "YY2520": "61414",  // Erik Hahr
  
  // Kostnadställe 61150 - Mimer Student (om tillämpligt)
  // Lägg till vid behov
};

/**
 * Hämtar KVV-områdesnummer baserat på kvartersvärdens referensnummer
 */
export function getKvvArea(stewardRefNr: string): string | undefined {
  return STEWARD_TO_KVV_AREA[stewardRefNr];
}

/**
 * Hämtar alla unika KVV-områdesnummer
 */
export function getUniqueKvvAreas(): string[] {
  return [...new Set(Object.values(STEWARD_TO_KVV_AREA))].sort();
}
