import { expect, test, vi } from 'vitest'

import { handleWatchProvidersRequest, parseWatchProviders } from '~/src/helpers/node/watch-providers.js'

function makeProviderLink ( name: string, type: string, destination: string ) {
    const context = Buffer.from( JSON.stringify( {
        data: [ { data: { provider: name, monetizationType: type } } ],
    } ) ).toString( 'base64url' )
    const url = new URL( 'https://click.justwatch.com/a' )
    url.searchParams.set( 'cx', context )
    url.searchParams.set( 'r', destination )

    return `<a href="${ url.href }"><img src="https://media.themoviedb.org/t/p/original/logo123.png"></a>`
}

test( 'Watch options keep distinct providers and link to the streaming title', () => {
    const disneyAffiliateUrl = new URL( 'https://disneyplus.bn5x.net/c/123' )
    disneyAffiliateUrl.searchParams.set( 'u', 'https://www.disneyplus.com/pt-br/browse/entity-123' )
    const html = [
        makeProviderLink( 'Disney Plus', 'flatrate', disneyAffiliateUrl.href ),
        makeProviderLink( 'Disney Plus', 'flatrate', disneyAffiliateUrl.href ),
        makeProviderLink( 'Apple TV Store', 'rent', 'https://tv.apple.com/br/movie/example' ),
        makeProviderLink( 'Apple TV Store', 'buy', 'https://tv.apple.com/br/movie/example' ),
    ].join( '' )

    expect( parseWatchProviders( html ) ).toEqual( [
        {
            name: 'Disney Plus',
            type: 'flatrate',
            url: 'https://www.disneyplus.com/pt-br/browse/entity-123',
            logo: '/api/tmdb-image/logo123.webp?width=72&transparent=0',
        },
        {
            name: 'Apple TV Store',
            type: 'rent',
            url: 'https://tv.apple.com/br/movie/example',
            logo: '/api/tmdb-image/logo123.webp?width=72&transparent=0',
        },
        {
            name: 'Apple TV Store',
            type: 'buy',
            url: 'https://tv.apple.com/br/movie/example',
            logo: '/api/tmdb-image/logo123.webp?width=72&transparent=0',
        },
    ] )
} )

test( 'Watch endpoint requests Brazilian availability for a validated title', async () => {
    const fetchMock = vi.fn( async () => new Response( makeProviderLink( 'Disney Plus', 'flatrate', 'https://www.disneyplus.com/pt-br/browse/entity-123' ) ) )
    vi.stubGlobal( 'fetch', fetchMock )

    try {
        const response = await handleWatchProvidersRequest( new Request( 'https://cinearc.example/api/watch-providers?type=tv&id=241388' ) )
        const body = await response.json()

        expect( response.status ).toBe( 200 )
        expect( fetchMock.mock.calls[ 0 ][ 0 ] ).toBe( 'https://www.themoviedb.org/tv/241388/watch?locale=BR' )
        expect( body.options ).toHaveLength( 1 )
        expect( body.options[ 0 ].url ).toBe( 'https://www.disneyplus.com/pt-br/browse/entity-123' )
    }
    finally {
        vi.unstubAllGlobals()
    }
} )
