// Retired listing URLs and where they now live.
// Shared by the Deno pull script, Node tooling and the Astro config.

export type ListingRedirectReason = 'duplicate-file' | 'tmdb-id-replaced'

export interface ListingRedirect {
    from: string
    to: string
    reason: ListingRedirectReason
    // ISO date of the run that retired the URL
    retiredAt: string
}

export interface VercelRedirect {
    source: string
    destination: string
    statusCode: number
}

export const listingRedirectPrefix = '/pt-br/' as const

// Adds redirects while keeping the map flat: no chains and no redirect away
// from a URL that is a live page again.
export function addListingRedirects (
    existing: ListingRedirect[],
    additions: ListingRedirect[],
    livePaths: Set<string>,
): ListingRedirect[] {
    const byFrom = new Map( existing.map( redirect => [ redirect.from, redirect ] ) )

    for ( const addition of additions ) {
        byFrom.set( addition.from, addition )
    }

    const resolved = [ ...byFrom.values() ]
        .filter( redirect => !livePaths.has( redirect.from ) )
        .map( redirect => ( { ...redirect, to: resolveListingPath( redirect.to, byFrom ) } ) )
        .filter( redirect => redirect.from !== redirect.to )

    return resolved.sort( ( redirectA, redirectB ) => redirectA.from.localeCompare( redirectB.from ) )
}

export function resolveListingPath ( path: string, byFrom: Map<string, Pick<ListingRedirect, 'to'>> ): string {
    const seen = new Set<string>()
    let current = path

    while ( byFrom.has( current ) && !seen.has( current ) ) {
        seen.add( current )
        current = byFrom.get( current )!.to
    }

    return current
}

export function toAstroRedirects ( redirects: ListingRedirect[] ): Record<string, string> {
    return Object.fromEntries( redirects.map( redirect => [ redirect.from, redirect.to ] ) )
}

// Vercel matches the slash variants separately, so emit both.
export function toVercelRedirects ( redirects: ListingRedirect[] ): VercelRedirect[] {
    return redirects.flatMap( redirect => [
        { source: redirect.from, destination: redirect.to, statusCode: 301 },
        { source: `${ redirect.from }/`, destination: `${ redirect.to }/`, statusCode: 301 },
    ] )
}

function isGeneratedVercelRedirect ( redirect: VercelRedirect ): boolean {
    return redirect.source.startsWith( listingRedirectPrefix )
}

// Replaces the generated listing redirects and repoints hand-written ones
// whose destination was retired.
export function syncVercelRedirects ( current: VercelRedirect[], redirects: ListingRedirect[] ): VercelRedirect[] {
    const byFrom = new Map( redirects.map( redirect => [ redirect.from, redirect ] ) )
    const handWritten = current
        .filter( redirect => !isGeneratedVercelRedirect( redirect ) )
        .map( redirect => ( { ...redirect, destination: resolveListingPath( redirect.destination, byFrom ) } ) )

    return [
        ...toVercelRedirects( redirects ),
        ...handWritten,
    ]
}

// Repoints `to = "..."` lines of hand-written Netlify redirects.
export function syncNetlifyRedirectTargets ( netlifyToml: string, redirects: ListingRedirect[] ): string {
    const byFrom = new Map( redirects.map( redirect => [ redirect.from, redirect ] ) )

    return netlifyToml.replace( /^(\s*to = ")([^"]+)(")$/gm, ( _match, start: string, target: string, end: string ) => {
        return `${ start }${ resolveListingPath( target, byFrom ) }${ end }`
    } )
}

export const listingRedirectsPath = 'src/json/listing-redirects.json' as const

export interface RedirectStoreIO {
    readText: ( path: string ) => Promise<string>
    writeText: ( path: string, content: string ) => Promise<void>
}

// Records retired URLs and keeps both hosts' configs pointing at live pages.
export async function persistListingRedirects ( io: RedirectStoreIO, additions: ListingRedirect[], livePaths: Set<string> ): Promise<ListingRedirect[]> {
    const existing = JSON.parse( await io.readText( listingRedirectsPath ) ) as ListingRedirect[]
    const redirects = addListingRedirects( existing, additions, livePaths )
    const vercelConfig = JSON.parse( await io.readText( 'vercel.json' ) )

    vercelConfig.redirects = syncVercelRedirects( vercelConfig.redirects || [], redirects )

    await io.writeText( listingRedirectsPath, `${ JSON.stringify( redirects, null, 4 ) }\n` )
    await io.writeText( 'vercel.json', `${ JSON.stringify( vercelConfig, null, 4 ) }\n` )
    await io.writeText( 'netlify.toml', syncNetlifyRedirectTargets( await io.readText( 'netlify.toml' ), redirects ) )

    return redirects
}
