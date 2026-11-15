import { expect, test } from 'vitest'

import { inheritFirstSeasonLogos } from '~/src/helpers/node/series-logos.ts'
import { getPublicMcuReleaseListings } from '~/src/helpers/node/public-mcu-listings.ts'
import type { Listing } from '~/src/helpers/types.ts'

function makeSeason ( overrides: Partial<Listing> ): Listing {
    return {
        id: 1,
        title: 'Example Series',
        first_air_date: '2022-01-01',
        original_language: 'en',
        vote_average: 0,
        media_type: 'tv',
        type: 'tv',
        tags: [ 'tv' ],
        ...overrides,
    } as Listing
}

test( 'Later seasons without a logo inherit the first season logo', () => {
    const [ , secondSeason ] = inheritFirstSeasonLogos( [
        makeSeason( { id: 1, logo_on_black: 'first.webp' } ),
        makeSeason( { id: 2, first_air_date: '2023-01-01' } ),
    ] )

    expect( secondSeason.logo_on_black ).toBe( 'first.webp' )
} )

test( 'The first season logo replaces a different logo on later seasons, whatever the input order', () => {
    const inherited = inheritFirstSeasonLogos( [
        makeSeason( { id: 2, first_air_date: '2023-01-01', logo_on_black: 'second.webp' } ),
        makeSeason( { id: 1, logo_on_black: 'first.webp' } ),
    ] )

    expect( inherited.map( ( listing ) => listing.logo_on_black ) ).toEqual( [ 'first.webp', 'first.webp' ] )
} )

test( 'Logos are not shared across movies or different series, and input is not mutated', () => {
    const movie = makeSeason( { id: 3, media_type: 'movie', type: undefined, tags: [ 'movie' ], first_air_date: undefined, release_date: '2023-01-01' } )
    const otherSeries = makeSeason( { id: 4, title: 'Another Series' } )
    const secondSeason = makeSeason( { id: 2, first_air_date: '2023-01-01' } )
    const listings = [
        makeSeason( { id: 1, logo_on_black: 'first.webp' } ),
        secondSeason,
        movie,
        otherSeries,
    ]
    const inherited = inheritFirstSeasonLogos( listings )

    expect( inherited[ 2 ].logo_on_black ).toBeUndefined()
    expect( inherited[ 3 ].logo_on_black ).toBeUndefined()
    expect( secondSeason.logo_on_black ).toBeUndefined()
} )

test( 'Public MCU release listings give every I Am Groot season the first season logo', async () => {
    const releaseListings = await getPublicMcuReleaseListings()
    const grootLogos = releaseListings
        .filter( ( listing ) => listing.title === 'I Am Groot' )
        .map( ( listing ) => listing.logo_on_black )

    expect( grootLogos ).toHaveLength( 2 )
    expect( new Set( grootLogos ).size ).toBe( 1 )
    expect( grootLogos[ 0 ] ).toBeTruthy()
} )
