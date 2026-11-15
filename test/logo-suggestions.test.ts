import { expect, test } from 'vitest'

import {
    applyLogoSuggestions,
    isLegibleOnDark,
    pickFanartLogoPath,
    pickTmdbLogoPath,
    selectLogoLookups,
} from '~/src/helpers/logo-suggestions.ts'
import type { Listing } from '~/src/helpers/types.ts'

function makeListing ( overrides: Partial<Listing> ): Listing {
    return { id: 1, title: 'Example', type: 'movie', tags: [ 'movie' ], poster_path: '/p.jpg', ...overrides } as Listing
}

test( 'TMDB logo pick prefers English, then textless, then Portuguese, and skips SVG', () => {
    const logos = [
        { file_path: '/pt.png', iso_639_1: 'pt', vote_average: 9 },
        { file_path: '/none.png', iso_639_1: null, vote_average: 9 },
        { file_path: '/en-low.png', iso_639_1: 'en', vote_average: 1 },
        { file_path: '/en-best.png', iso_639_1: 'en', vote_average: 5 },
        { file_path: '/en.svg', iso_639_1: 'en', vote_average: 10 },
    ]

    expect( pickTmdbLogoPath( { logos } ) ).toBe( '/en-best.png' )
    expect( pickTmdbLogoPath( { logos: logos.slice( 0, 2 ) } ) ).toBe( '/none.png' )
    expect( pickTmdbLogoPath( { logos: [] } ) ).toBeNull()
    expect( pickTmdbLogoPath( {} ) ).toBeNull()
} )

test( 'Fanart logo pick takes the most liked English or neutral logo and keeps the file name', () => {
    const response = {
        hdmovielogo: [
            { url: 'https://assets.fanart.tv/fanart/movies/1/hdmovielogo/de-1.png', lang: 'de', likes: '50' },
            { url: 'https://assets.fanart.tv/fanart/movies/1/hdmovielogo/en-2.png', lang: 'en', likes: '3' },
            { url: 'https://assets.fanart.tv/fanart/movies/1/hdmovielogo/en-3.png', lang: 'en', likes: '7' },
        ],
    }

    expect( pickFanartLogoPath( response ) ).toBe( 'en-3.png' )
    expect( pickFanartLogoPath( { hdmovielogo: [ response.hdmovielogo[ 0 ] ] } ) ).toBeNull()
    expect( pickFanartLogoPath( {} ) ).toBeNull()
} )

test( 'A logo is legible on dark when its visible pixels are light', () => {
    const light = Uint8Array.from( [ 250, 250, 250, 255, 240, 240, 240, 255 ] )
    const dark = Uint8Array.from( [ 10, 10, 10, 255, 20, 20, 20, 255 ] )
    const darkButInvisible = Uint8Array.from( [ 250, 250, 250, 255, 0, 0, 0, 0 ] )
    const empty = Uint8Array.from( [ 0, 0, 0, 0 ] )

    expect( isLegibleOnDark( light ) ).toBe( true )
    expect( isLegibleOnDark( dark ) ).toBe( false )
    expect( isLegibleOnDark( darkButInvisible ) ).toBe( true )
    expect( isLegibleOnDark( empty ) ).toBe( false )
} )

test( 'Lookups skip listings that have a logo, are gone, lack a media type or were checked recently', () => {
    const listings = [
        makeListing( { id: 1 } ),
        makeListing( { id: 2, logo_on_black: 'x.webp' } ),
        makeListing( { id: 3 } ),
        makeListing( { id: 4, type: undefined, tags: [] } ),
        makeListing( { id: 5 } ),
        makeListing( { id: 6 } ),
    ]
    const picked = selectLogoLookups( listings, {
        isGone: ( identity ) => identity === 'movie:3',
        suggestions: {
            'movie:5': { checkedAt: '2026-11-10', logo: null },
            'movie:6': { checkedAt: '2026-06-01', logo: null },
        },
        today: '2026-11-15',
        refreshDays: 30,
        limit: 10,
    } )

    expect( picked.map( ( { identity } ) => identity ) ).toEqual( [ 'movie:1', 'movie:6' ] )
} )

test( 'Lookups respect the per-run limit', () => {
    const listings = [ 1, 2, 3 ].map( id => makeListing( { id } ) )
    const picked = selectLogoLookups( listings, { isGone: () => false, suggestions: {}, today: '2026-11-15', refreshDays: 30, limit: 2 } )

    expect( picked ).toHaveLength( 2 )
} )

test( 'Suggested logos fill only listings without a curated logo', () => {
    const listings = [
        makeListing( { id: 1 } ),
        makeListing( { id: 2, logo_on_black: 'curated.webp' } ),
        makeListing( { id: 3 } ),
    ]
    const [ filled, curated, untouched ] = applyLogoSuggestions( listings, {
        'movie:1': { checkedAt: '2026-11-15', logo: '{tmdb-path}/a.webp', source: 'tmdb' },
        'movie:2': { checkedAt: '2026-11-15', logo: '{tmdb-path}/b.webp', source: 'tmdb' },
        'movie:3': { checkedAt: '2026-11-15', logo: null },
    } )

    expect( filled.logo_on_black ).toBe( '{tmdb-path}/a.webp' )
    expect( curated.logo_on_black ).toBe( 'curated.webp' )
    expect( untouched.logo_on_black ).toBeUndefined()
    expect( listings[ 0 ].logo_on_black ).toBeUndefined()
} )
