export function isInitRoute(pathname: string) {
  return pathname === "/init"
}

export function isLoginRoute(pathname: string) {
  return pathname === "/login"
}

export function isTaskRoute(pathname: string) {
  return pathname === "/" || pathname === "/tasks"
}

export function isPublicRoute(pathname: string) {
  return isInitRoute(pathname) || isLoginRoute(pathname)
}

export function getFallbackRoute(
  configured: boolean | null,
  authConfigured: boolean | null,
  authenticated: boolean | null
) {
  if (!configured) {
    return "/init"
  }

  if (authConfigured && !authenticated) {
    return "/login"
  }

  return "/tasks"
}

export function getGuardRedirect(
  pathname: string,
  configured: boolean | null,
  authConfigured: boolean | null,
  authenticated: boolean | null
) {
  if (configured === null || authConfigured === null || authenticated === null) {
    return null
  }

  if (!configured && !isInitRoute(pathname)) {
    return "/init"
  }

  if (!configured) {
    return null
  }

  if (authConfigured && !authenticated && !isLoginRoute(pathname)) {
    return "/login"
  }

  if (authConfigured && !authenticated) {
    return null
  }

  if (isInitRoute(pathname) || isLoginRoute(pathname)) {
    return "/tasks"
  }

  return null
}
