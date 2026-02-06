export const getOrientationText = (orientation: number) => {
  switch (orientation) {
    case 1:
      return 'Norr'
    case 2:
      return 'Öster'
    case 3:
      return 'Söder'
    case 4:
      return 'Väster'
    default:
      return 'Okänd'
  }
}
