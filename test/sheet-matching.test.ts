import { expect, test } from 'vitest'

import { matchOrderedEntryToSavedListing, organizeOrderData } from '~/src/helpers/node/mcu-timeline-sheet.ts'
import type { Listing } from '~/src/helpers/types.ts'

function makeFilm ( overrides: Partial<Listing> ): Listing {
    return {
        id: 1,
        title: 'Iron Man 2',
        release_date: '2010-04-28',
        original_language: 'en',
        vote_average: 0,
        type: 'movie',
        tags: [ 'movie' ],
        ...overrides,
    } as Listing
}

function makeSeries ( overrides: Partial<Listing> ): Listing {
    return makeFilm( { id: 2, title: 'Iron Man 2', release_date: undefined, first_air_date: '2010-04-28', type: 'tv', tags: [ 'tv' ], ...overrides } )
}

const usEntry = { title: 'Iron Man 2', premiereDate: '2010-05-07T04:00:00.000Z', timelineType: 'movie' }

function matchedId ( entry: object, listings: Listing[] ) {
    return matchOrderedEntryToSavedListing( entry, listings )?.id ?? null
}

test( 'A film matches the sheet when TMDB lists an earlier international date', () => {
    expect( matchedId( usEntry, [ makeFilm( {} ) ] ) ).toBe( 1 )
} )

test( 'The tolerance reaches 16 days and stops there', () => {
    const entry = { ...usEntry, premiereDate: '2014-05-02T04:00:00.000Z', title: 'The Amazing Spider-Man 2' }
    const film = ( releaseDate: string ) => makeFilm( { title: 'The Amazing Spider-Man 2', release_date: releaseDate } )

    expect( matchedId( entry, [ film( '2014-04-16' ) ] ) ).toBe( 1 )
    expect( matchedId( entry, [ film( '2014-04-15' ) ] ) ).toBeNull()
    expect( matchedId( entry, [ film( '2014-05-19' ) ] ) ).toBeNull()
} )

test( 'A close date never rescues a different title', () => {
    expect( matchedId( usEntry, [ makeFilm( { title: 'Iron Man 3' } ) ] ) ).toBeNull()
    expect( matchedId( { ...usEntry, title: 'Thor' }, [ makeFilm( { title: 'Thor: The Dark World' } ) ] ) ).toBeNull()
} )

test( 'A leading article does not block a close-date match', () => {
    const entry = { title: 'Avengers', premiereDate: '2012-05-04T04:00:00.000Z', timelineType: 'movie' }

    expect( matchedId( entry, [ makeFilm( { title: 'The Avengers', release_date: '2012-04-25' } ) ] ) ).toBe( 1 )
} )

test( 'A close date never crosses media types', () => {
    expect( matchedId( usEntry, [ makeSeries( {} ) ] ) ).toBeNull()

    const seriesEntry = { ...usEntry, timelineType: 'hulu' }

    expect( matchedId( seriesEntry, [ makeFilm( {} ) ] ) ).toBeNull()
    expect( matchedId( seriesEntry, [ makeSeries( {} ) ] ) ).toBe( 2 )
} )

test( 'Several films with the same title keep the one closest to the sheet date', () => {
    const entry = { title: 'Spider-Man', premiereDate: '2002-05-03T04:00:00.000Z', timelineType: 'sony' }
    const reboot = makeFilm( { id: 10, title: 'Spider-Man', release_date: '2002-05-01' } )
    const unrelated = makeFilm( { id: 11, title: 'Spider-Man', release_date: '2017-07-05' } )

    expect( matchedId( entry, [ unrelated, reboot ] ) ).toBe( 10 )
} )

function sheetRow ( TITLE: string, TYPE: string, RELEASE_DATE: string ) {
    return { TITLE, TYPE, RELEASE_DATE } as any
}

test( 'Episode rows of a web series collapse into one entry at the first episode', () => {
    const organized = organizeOrderData( [
        sheetRow( 'Another Film', 'MOVIE', '2016-01-01' ),
        sheetRow( 'Agents Slingshot Episode 1: Vendetta', 'WEB SERIES', '2016-12-13' ),
        sheetRow( 'Agents Slingshot Episode 2: Hancock', 'WEB SERIES', '2016-12-13' ),
    ] )

    expect( Object.keys( organized ) ).toEqual( [ 'Another Film', 'Agents Slingshot' ] )
    expect( organized[ 'Agents Slingshot' ].mcuTimelineOrder ).toBe( 1 )
} )

test( 'Re-release rows fold into the original film', () => {
    const organized = organizeOrderData( [
        sheetRow( 'Big Film', 'MOVIE', '2019-04-26' ),
        sheetRow( 'Big Film | Re-Release', 'MOVIE', '2019-06-28' ),
    ] )

    expect( Object.keys( organized ) ).toEqual( [ 'Big Film' ] )
    expect( organized[ 'Big Film' ].mcuTimelineOrder ).toBe( 0 )
    expect( organized[ 'Big Film' ].premiereDate ).toBe( '2019-04-26' )
} )

test( 'Season episodes keep their own entry shape', () => {
    const organized = organizeOrderData( [
        sheetRow( 'Some Show Season 1 Episode 1: Pilot', 'DISNEY+', '2021-01-01' ),
        sheetRow( 'Some Show Season 1 Episode 2: Next', 'DISNEY+', '2021-01-08' ),
    ] )

    expect( organized[ 'Some Show' ].seasons[ '1' ].episodeCount ).toBe( 2 )
    expect( organized[ 'Some Show' ].mcuTimelineOrder ).toBe( 0 )
} )
