import fs from 'node:fs'

import { expect, test } from 'vitest'

import {
    addListingRedirects,
    syncNetlifyRedirectTargets,
    syncVercelRedirects,
    toVercelRedirects,
    type ListingRedirect,
} from '~/src/helpers/listing-redirects.ts'
import listingRedirects from '~/src/json/listing-redirects.json'

function hasListingFile ( url: string ) {
    return fs.existsSync( `src/pages${ url }.md` )
}

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

test( 'Checked-in listing redirects point from retired files to live ones', () => {
    for ( const redirect of listingRedirects as ListingRedirect[] ) {
        expect( hasListingFile( redirect.from ), redirect.from ).toBe( false )
        expect( hasListingFile( redirect.to ), redirect.to ).toBe( true )
    }
} )

test( 'Vercel serves every checked-in listing redirect', () => {
    const vercelConfig = JSON.parse( fs.readFileSync( 'vercel.json', 'utf8' ) )

    for ( const redirect of toVercelRedirects( listingRedirects as ListingRedirect[] ) ) {
        expect( vercelConfig.redirects ).toContainEqual( redirect )
    }
} )

test( 'Hand-written redirects never target a retired listing', () => {
    const vercelConfig = JSON.parse( fs.readFileSync( 'vercel.json', 'utf8' ) )
    const netlifyTargets = [ ...fs.readFileSync( 'netlify.toml', 'utf8' ).matchAll( /^\s*to = "(\/pt-br\/[^"*:]+)"$/gm ) ].map( match => match[ 1 ] )
    const vercelTargets = vercelConfig.redirects
        .map( ( redirect: { destination: string } ) => redirect.destination.replace( /\/$/, '' ) )
        .filter( ( destination: string ) => destination.startsWith( '/pt-br/' ) && !destination.includes( ':' ) )

    for ( const target of [ ...netlifyTargets, ...vercelTargets ] ) {
        expect( hasListingFile( target ), target ).toBe( true )
    }
} )
