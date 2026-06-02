/**
 * Key disposal (kassering) — relocated out of the old loanHandlers. Marks keys
 * disposed or restores them; the UI pairs these for an undo affordance.
 */
import { keyService } from './api/keyService'

export type DisposeResult = {
  success: boolean
  title: string
  message?: string
}

const count = (n: number) => `${n} ${n === 1 ? 'nyckel har' : 'nycklar har'}`

export async function disposeKeys(keyIds: string[]): Promise<DisposeResult> {
  if (keyIds.length === 0) {
    return { success: false, title: 'Fel', message: 'Inga nycklar valda' }
  }
  try {
    await Promise.all(
      keyIds.map((id) => keyService.updateKey(id, { disposed: true }))
    )
    return {
      success: true,
      title: 'Nycklar kasserade',
      message: `${count(keyIds.length)} kasserats.`,
    }
  } catch (err: any) {
    return {
      success: false,
      title: 'Fel',
      message: err?.message || 'Kunde inte kassera nycklar.',
    }
  }
}

export async function undoDisposeKeys(
  keyIds: string[]
): Promise<DisposeResult> {
  if (keyIds.length === 0) {
    return { success: false, title: 'Fel', message: 'Inga nycklar valda' }
  }
  try {
    await Promise.all(
      keyIds.map((id) => keyService.updateKey(id, { disposed: false }))
    )
    return {
      success: true,
      title: 'Ångrade kassering',
      message: `${count(keyIds.length)} återställts.`,
    }
  } catch (err: any) {
    return {
      success: false,
      title: 'Fel',
      message: err?.message || 'Kunde inte återställa nycklar.',
    }
  }
}
