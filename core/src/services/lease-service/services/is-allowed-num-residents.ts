const maxResidents: Record<string, number> = {
  '1R': 3,
  '1RKV': 2,
  '1RK': 3,
  '1RKSO': 3,
  '1RKM': 3,
  '2RKV': 4,
  '2RK': 4,
  '2RKM': 4,
  '2RKKA': 4,
  '2RKAL': 4,
  '3RK': 5,
  '3RKM': 5,
  '3RKKA': 5,
  '3RKAL': 5,
  '4RK': 7,
  '4RKM': 7,
  '4RKKA': 7,
  '4RKAL': 7,
  '5RK': 8,
  '5RKM': 8,
  '6RK': 10,
  '6RKM': 10,
  '1RKOK': 2,
  '6RKE': 10,
  '5RKE': 8,
  '4RKE': 7,
  '3RKE': 5,
  '2RKE': 4,
  '1RKS': 3,
  '1RKVS': 3,
  '2RKS': 4,
  '2RKVS': 4,
  '2RKVMS': 4,
  '3RKV': 5,
  '3RKS': 5,

  //property types that exists in Xpand but not in Mimer
  ATELJE: 8,
  SAMLGH: 1,
  STUD: 1,
  '1,5 R': 2,
  '1RKDEL': 2,
  '2,5 ROK': 4,
  '3,5ROK': 5,
  '8RK': 8,
}

export function isAllowedNumResidents(
  residenceType: string,
  numResidents: number
) {
  const maxNumResidents = maxResidents[residenceType]

  if (!maxNumResidents) {
    return true
  }

  return numResidents <= maxNumResidents
}
