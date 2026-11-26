import { matchPath } from 'react-router-dom'

// Checked in order, so a fixed path must come before a parameterised path
// that would also match it (/bilplatser/publicera before /bilplatser/:id).
// Each pattern also matches its sub-paths, e.g. /annonsinnehall/ny.
const pageTitles: ReadonlyArray<[pattern: string, title: string]> = [
  ['/sok-bilplats', 'Sök bilplats'],
  ['/bilplatser/publicera', 'Publicera bilplatser'],
  ['/bilplatser/:id', 'Bilplats'],
  ['/bilplatser', 'Bilplatser'],
  ['/materialval', 'Materialval'],
  ['/sokandeprofil', 'Sökandeprofil'],
  ['/annonsinnehall', 'Annonsinnehåll'],
  ['/omradestexter', 'Områdestexter'],
]

/**
 * Returns the browser tab title for a path, as `<page> | ONECore` like the
 * other ONECore apps. The start page shows the parking spaces list.
 */
export function getPageTitle(pathname: string): string {
  const title =
    pathname === '/'
      ? 'Bilplatser'
      : pageTitles.find(([pattern]) =>
          matchPath({ path: pattern, end: false }, pathname)
        )?.[1]

  return title ? `${title} | ONECore` : 'ONECore'
}
