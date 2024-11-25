import { Context } from 'koa'
import port from '../config/port'

// this will be moved to utilities later when we have decided on the final HATEOS structure
export const generateMetaLinks = (
  ctx: Context,
  path: string,
  params?: Record<string, string>,
) => {
  const baseUrl = `http://localhost:${port}`

  if (params) {
    return {
      self: {
        href: `${path}/${params.id}`,
      },
      ...Object.entries(params).reduce(
        (acc, [key, value]) => {
          if (key !== 'id') {
            acc[key] = {
              href: `${baseUrl}/${key}/${value}`,
            }
          }
          return acc
        },
        {} as Record<string, { href: string }>,
      ),
    }
  }

  return {
    self: {
      href: `${baseUrl}${path}`,
    },
    link: {
      href: `${baseUrl}${path}`,
      templated: false,
    },
  }
}
