import fs from 'node:fs'

import { expect, test } from 'vitest'

test( 'The retired Punisher URL redirects to the renamed listing', () => {
    const netlifyConfig = fs.readFileSync( 'netlify.toml', 'utf8' )
    const vercelConfig = JSON.parse( fs.readFileSync( 'vercel.json', 'utf8' ) )

    expect( netlifyConfig ).toContain( `[[redirects]]
    from = "/en/untitled-the-punisher-special-1439930"
    to = "/pt-br/the-punisher-one-last-kill-1439930"
    status = 301
    force = true` )
    expect( vercelConfig.redirects ).toContainEqual( {
        source: '/en/untitled-the-punisher-special-1439930',
        destination: '/pt-br/the-punisher-one-last-kill-1439930',
        statusCode: 301,
    } )
} )

test( 'Legacy English URLs redirect to Portuguese routes on both hosts', () => {
    const netlifyConfig = fs.readFileSync( 'netlify.toml', 'utf8' )
    const vercelConfig = JSON.parse( fs.readFileSync( 'vercel.json', 'utf8' ) )

    expect( netlifyConfig ).toContain( `[[redirects]]
    from = "/en/*"
    to = "/pt-br/:splat"
    status = 301` )
    expect( vercelConfig.redirects ).toContainEqual( {
        source: '/en/:path*/',
        destination: '/pt-br/:path*/',
        statusCode: 301,
    } )
    expect( vercelConfig.redirects ).toContainEqual( {
        source: '/en/:path*',
        destination: '/pt-br/:path*',
        statusCode: 301,
    } )
} )
