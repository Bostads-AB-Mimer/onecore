import { Writable } from 'stream'

export const written: string[] = []

export const captureStream = () =>
  new Writable({
    write(chunk, _enc, cb) {
      written.push(chunk.toString())
      cb()
    },
  })

export const discardStream = () =>
  new Writable({
    write(_chunk, _enc, cb) {
      cb()
    },
  })

export const elasticOptions: { index?: unknown }[] = []

export const lastLine = (): Record<string, any> =>
  JSON.parse(written[written.length - 1])
