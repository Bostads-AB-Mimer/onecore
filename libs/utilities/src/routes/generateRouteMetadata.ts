import { Context as KoaContext } from 'koa'

interface RouteMetadata {
  _links: {
    self: {
      href: string
    }
    link: {
      href: string
      templated: boolean
    }
  }
}

// Utility function to generate metadata with HATEOAS links
export const generateRouteMetadata = (
  ctx: KoaContext,
  queryParams?: string[]
): RouteMetadata => {
  const baseUrl = `${ctx.protocol}://${ctx.host}`
  const pathWithParamsKeys = Object.keys(ctx.params).reduce(
    (path, key) => path.replace(ctx.params[key], `{${key}}`),
    ctx.path
  )
  const templated = Object.keys(ctx.params).length > 0 || !!ctx.query

  const queryPlaceholders = queryParams && queryParams.length > 0
    ? '?' + queryParams.map(param => `${param}={${param}}`).join('&')
    : ''

  return {
    _links: {
      self: {
        href: ctx.href,
      },
      link: {
        href: `${baseUrl}${pathWithParamsKeys}${queryPlaceholders}`,
        templated: templated,
      },
    },
  }
}
