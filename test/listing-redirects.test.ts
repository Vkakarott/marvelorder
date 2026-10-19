import { expect, test } from 'vitest'

import {
    addListingRedirects,
    syncNetlifyRedirectTargets,
    syncVercelRedirects,
    type ListingRedirect,
} from '~/src/helpers/listing-redirects.ts'

function makeRedirect ( from: string, to: string ): ListingRedirect {
    return { from, to, reason: 'duplicate-file', retiredAt: '2026-10-19' }
}

test( 'collapses redirect chains onto the newest URL', () => {
    const redirects = addListingRedirects(
        [ makeRedirect( '/pt-br/a-1', '/pt-br/b-1' ) ],
        [ makeRedirect( '/pt-br/b-1', '/pt-br/c-1' ) ],
        new Set( [ '/pt-br/c-1' ] ),
    )

    expect( redirects.map( redirect => [ redirect.from, redirect.to ] ) ).toEqual( [
        [ '/pt-br/a-1', '/pt-br/c-1' ],
        [ '/pt-br/b-1', '/pt-br/c-1' ],
    ] )
} )

test( 'drops redirects away from URLs that are live pages again', () => {
    const redirects = addListingRedirects(
        [ makeRedirect( '/pt-br/a-1', '/pt-br/b-1' ) ],
        [ makeRedirect( '/pt-br/b-1', '/pt-br/a-1' ) ],
        new Set( [ '/pt-br/a-1' ] ),
    )

    expect( redirects.map( redirect => [ redirect.from, redirect.to ] ) ).toEqual( [ [ '/pt-br/b-1', '/pt-br/a-1' ] ] )
} )

test( 'regenerates Vercel listing redirects and repoints hand-written ones', () => {
    const current = [
        { source: '/pt-br/stale-1', destination: '/pt-br/gone-1', statusCode: 301 },
        { source: '/en/legacy-1', destination: '/pt-br/a-1', statusCode: 301 },
    ]

    expect( syncVercelRedirects( current, [ makeRedirect( '/pt-br/a-1', '/pt-br/b-1' ) ] ) ).toEqual( [
        { source: '/pt-br/a-1', destination: '/pt-br/b-1', statusCode: 301 },
        { source: '/pt-br/a-1/', destination: '/pt-br/b-1/', statusCode: 301 },
        { source: '/en/legacy-1', destination: '/pt-br/b-1', statusCode: 301 },
    ] )
} )

test( 'repoints Netlify redirect targets that were retired', () => {
    const toml = [
        '[[redirects]]',
        '    from = "/en/legacy-1"',
        '    to = "/pt-br/a-1"',
        '    status = 301',
    ].join( '\n' )

    expect( syncNetlifyRedirectTargets( toml, [ makeRedirect( '/pt-br/a-1', '/pt-br/b-1' ) ] ) ).toContain( 'to = "/pt-br/b-1"' )
} )
