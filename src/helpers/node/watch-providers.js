import { parseHTML } from 'linkedom'

const providerTypes = new Set( [ 'flatrate', 'free', 'ads', 'rent', 'buy' ] )

function getHttpsUrl ( value ) {
    try {
        const url = new URL( value )
        return url.protocol === 'https:' ? url : null
    }
    catch {
        return null
    }
}

function getProviderUrl ( clickUrl ) {
    const click = getHttpsUrl( clickUrl )
    if ( !click ) {
        return null
    }

    let destination = getHttpsUrl( click.searchParams.get( 'r' ) )
    if ( !destination ) {
        return null
    }

    for ( let depth = 0; depth < 3; depth++ ) {
        const nested = [ 'u', 'url', 'murl', 'redirect' ]
            .map( key => getHttpsUrl( destination.searchParams.get( key ) ) )
            .find( Boolean )

        if ( !nested ) {
            break
        }
        destination = nested
    }

    return destination.href
}

function getProviderDetails ( clickUrl ) {
    try {
        const encodedContext = new URL( clickUrl ).searchParams.get( 'cx' )
        if ( !encodedContext ) {
            return null
        }

        const context = JSON.parse( Buffer.from( encodedContext, 'base64url' ).toString( 'utf8' ) )
        const details = context.data
            ?.map( entry => entry.data )
            .find( entry => typeof entry?.provider === 'string' && providerTypes.has( entry.monetizationType ) )

        return details || null
    }
    catch {
        return null
    }
}

function getLogoUrl ( imageUrl ) {
    const image = getHttpsUrl( imageUrl )
    const filename = image?.pathname.split( '/' ).pop() || ''
    if ( !/^[a-zA-Z0-9_-]+\.(?:png|jpg|webp)$/.test( filename ) ) {
        return null
    }

    return `/api/tmdb-image/${ filename.replace( /\.[^.]+$/, '.webp' ) }?width=72&transparent=0`
}

export function parseWatchProviders ( html ) {
    const { document } = parseHTML( html )
    const options = new Map()

    for ( const anchor of document.querySelectorAll( 'a[href^="https://click.justwatch.com/a?"]' ) ) {
        const details = getProviderDetails( anchor.getAttribute( 'href' ) )
        const url = getProviderUrl( anchor.getAttribute( 'href' ) )
        if ( !details || !url ) {
            continue
        }

        const key = `${ details.provider }|${ details.monetizationType }`
        if ( options.has( key ) ) {
            continue
        }

        options.set( key, {
            name: details.provider,
            type: details.monetizationType,
            url,
            logo: getLogoUrl( anchor.querySelector( 'img' )?.getAttribute( 'src' ) ),
        } )
    }

    return Array.from( options.values() )
}

export async function handleWatchProvidersRequest ( request ) {
    const url = new URL( request.url )
    const type = url.searchParams.get( 'type' )
    const id = url.searchParams.get( 'id' )

    if ( request.method !== 'GET' || ![ 'movie', 'tv' ].includes( type ) || !/^[1-9]\d*$/.test( id || '' ) ) {
        return Response.json( { error: 'Invalid watch provider request' }, { status: 400 } )
    }

    const sourceUrl = `https://www.themoviedb.org/${ type }/${ id }/watch?locale=BR`

    try {
        const response = await fetch( sourceUrl, {
            headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
            signal: AbortSignal.timeout( 10000 ),
        } )
        if ( !response.ok ) {
            throw new Error( `Watch provider source returned ${ response.status }` )
        }

        const options = parseWatchProviders( await response.text() )
        return Response.json( { options, sourceUrl }, {
            headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
        } )
    }
    catch ( error ) {
        console.error( 'Watch providers unavailable', error )
        return Response.json( { error: 'Watch providers unavailable', sourceUrl }, { status: 502 } )
    }
}
