import { expect, test } from 'vitest'

import { curateReleaseListings } from '~/src/helpers/node/release-curation.ts'
import { getPublicMcuReleaseListings } from '~/src/helpers/node/public-mcu-listings.ts'
import type { Listing } from '~/src/helpers/types.ts'

const today = new Date( '2026-11-15' )

function makeMovie ( overrides: Partial<Listing> ): Listing {
    return {
        id: 1,
        title: 'Example Movie',
        release_date: '2020-01-01',
        overview: 'Uma sinopse.',
        original_language: 'en',
        vote_average: 0,
        type: 'movie',
        tags: [ 'movie' ],
        ...overrides,
    } as Listing
}

const neverGone = () => false

function curate ( listings: Listing[], isGone = neverGone ) {
    return curateReleaseListings( listings, { isGone, today } ).map( listing => listing.id )
}

test( 'Hides cuts, alternate versions and colorized variants', () => {
    const ids = curate( [
        makeMovie( { id: 1, title: 'Example Movie' } ),
        makeMovie( { id: 2, title: 'Example Movie: Edward Norton Cut' } ),
        makeMovie( { id: 3, title: 'Example Show In Color', overview: '' } ),
        makeMovie( { id: 4, title: 'Example Movie: The More Fun Stuff Version' } ),
        makeMovie( { id: 5, title: 'Example Diary', overview: 'A versão estendida do vlog.' } ),
    ] )

    expect( ids ).toEqual( [ 1 ] )
} )

test( 'Hides released listings that TMDB no longer has and that carry no description or logo', () => {
    const ids = curate( [
        makeMovie( { id: 1, title: 'Stub', overview: '' } ),
        makeMovie( { id: 2, title: 'Stub With Logo', overview: '', logo_on_black: 'logo.webp' } ),
        makeMovie( { id: 3, title: 'Stub Still On TMDB', overview: '' } ),
        makeMovie( { id: 4, title: 'Unreleased Stub', overview: '', release_date: '2027-01-01' } ),
        makeMovie( { id: 5, title: 'Undated Stub', overview: '', release_date: '' } ),
    ], listing => [ 1, 2, 4, 5 ].includes( listing.id as number ) )

    expect( ids ).toEqual( [ 2, 3, 4, 5 ] )
} )

test( 'Keeps one of two movies released on the same day with the same curated logo', () => {
    const ids = curate( [
        makeMovie( { id: 1, title: 'Reaction A', logo_on_black: 'same.webp', overview: '' } ),
        makeMovie( { id: 2, title: 'Reaction B', logo_on_black: 'same.webp', overview: 'Descrição melhor.' } ),
        makeMovie( { id: 3, title: 'Other Day', logo_on_black: 'same.webp', release_date: '2020-02-02' } ),
    ] )

    expect( ids ).toEqual( [ 2, 3 ] )
} )

test( 'Merges an undated movie into a dated one with the same title', () => {
    const [ merged, ...rest ] = curateReleaseListings( [
        makeMovie( { id: 1, title: 'Doctor Strange 3', release_date: '2027-02-12', poster_path: null } ),
        makeMovie( { id: 2, title: 'Doctor Strange 3', release_date: '', poster_path: '/p.jpg' } ),
    ], { isGone: neverGone, today } )

    expect( rest ).toHaveLength( 0 )
    expect( merged.release_date ).toBe( '2027-02-12' )
    expect( merged.poster_path ).toBe( '/p.jpg' )
} )

test( 'Leaves series seasons with the same title and logo alone', () => {
    const season = ( id: number ) => makeMovie( { id, title: 'Series', type: 'tv', tags: [ 'tv' ], logo_on_black: 'same.webp' } )

    expect( curate( [ season( 1 ), season( 2 ) ] ) ).toEqual( [ 1, 2 ] )
} )

test( 'The public release list drops the known variants and duplicates', async () => {
    const ids = ( await getPublicMcuReleaseListings() ).map( listing => listing.id )

    for ( const hidden of [ 1309972, 1388876, 1247243, 991958, 1199231, 1197625, 1002488 ] ) {
        expect( ids ).not.toContain( hidden )
    }

    expect( ids ).toContain( 1205441 )
    expect( ids.filter( id => id === 1072946 || id === 1273599 ) ).toHaveLength( 1 )
} )
