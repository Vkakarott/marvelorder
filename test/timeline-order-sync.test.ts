import { expect, test } from 'vitest'

import {
    checkPlanBudget,
    planTimelineOrderSync,
    setFrontmatterTimelineOrder,
} from '~/src/helpers/node/timeline-order-sync.ts'
import type { Listing } from '~/src/helpers/types.ts'

function makeFilm ( id: number, title: string, releaseDate: string, overrides: Partial<Listing> = {} ): Listing {
    return {
        id,
        title,
        release_date: releaseDate,
        original_language: 'en',
        vote_average: 0,
        type: 'movie',
        tags: [ 'movie' ],
        ...overrides,
    } as Listing
}

function row ( TITLE: string, RELEASE_DATE: string, TYPE = 'MOVIE' ) {
    return { TITLE, TYPE, RELEASE_DATE } as any
}

const records = [
    row( 'Alpha', '2010-05-07' ),
    row( 'Beta', '2012-05-04' ),
    row( 'Gamma', '2014-05-02' ),
]

test( 'Matched listings get the sheet index and stale ones lose their legacy index', () => {
    const plan = planTimelineOrderSync( records, [
        makeFilm( 1, 'Alpha', '2010-04-28', { mcuTimelineOrder: 40 } ),
        makeFilm( 2, 'Beta', '2012-05-04', { mcuTimelineOrder: 1 } ),
        makeFilm( 3, 'Gamma', '2014-05-02' ),
        makeFilm( 4, 'Gone From Sheet', '2013-01-01', { mcuTimelineOrder: 7 } ),
        makeFilm( 5, 'Never Ordered', '2013-01-01' ),
    ] )

    expect( plan.updates.map( ( { listing, order } ) => [ listing.id, order ] ) ).toEqual( [ [ 1, 0 ], [ 3, 2 ] ] )
    expect( plan.clears.map( listing => listing.id ) ).toEqual( [ 4 ] )
    expect( plan.unchanged ).toBe( 1 )
} )

test( 'After a plan every listing order comes from the same sheet generation', () => {
    const listings = [
        makeFilm( 1, 'Alpha', '2010-04-28', { mcuTimelineOrder: 40 } ),
        makeFilm( 2, 'Beta', '2012-05-04', { mcuTimelineOrder: 1 } ),
        makeFilm( 4, 'Legacy', '2013-01-01', { mcuTimelineOrder: 2 } ),
    ]
    const plan = planTimelineOrderSync( records, listings )
    const orders = new Map( listings.map( listing => [ listing.id, listing.mcuTimelineOrder ] ) )

    plan.updates.forEach( ( { listing, order } ) => orders.set( listing.id, order ) )
    plan.clears.forEach( listing => orders.delete( listing.id ) )

    expect( [ ...orders.values() ].sort() ).toEqual( [ 0, 1 ] )
    expect( orders.get( 1 ) ).toBeLessThan( orders.get( 2 ) as number )
} )

test( 'A plan that would clear too much of the timeline is refused', () => {
    const listings = Array.from( { length: 20 }, ( _, id ) => makeFilm( id + 100, `Legacy ${ id }`, '2013-01-01', { mcuTimelineOrder: id } ) )
    const result = checkPlanBudget( planTimelineOrderSync( records, listings ), listings )

    expect( result.ok ).toBe( false )
} )

test( 'A plan that clears a few listings is allowed', () => {
    const listings = [
        makeFilm( 1, 'Alpha', '2010-05-07', { mcuTimelineOrder: 3 } ),
        makeFilm( 2, 'Beta', '2012-05-04', { mcuTimelineOrder: 4 } ),
        makeFilm( 3, 'Gamma', '2014-05-02', { mcuTimelineOrder: 5 } ),
        makeFilm( 4, 'Legacy', '2013-01-01', { mcuTimelineOrder: 6 } ),
    ]

    expect( checkPlanBudget( planTimelineOrderSync( records, listings ), listings ).ok ).toBe( true )
} )

const markdown = [ '---', 'title: Example', 'mcuTimelineOrder: 12', 'overview: "x"', '---', 'body mcuTimelineOrder: 5' ].join( '\n' )

test( 'The frontmatter order is replaced, added or removed without touching the rest', () => {
    expect( setFrontmatterTimelineOrder( markdown, 3 ) ).toContain( 'mcuTimelineOrder: 3\noverview' )
    expect( setFrontmatterTimelineOrder( markdown, null ) ).toBe( [ '---', 'title: Example', 'overview: "x"', '---', 'body mcuTimelineOrder: 5' ].join( '\n' ) )

    const withoutOrder = setFrontmatterTimelineOrder( markdown, null )

    expect( setFrontmatterTimelineOrder( withoutOrder, 9 ) ).toBe( [ '---', 'title: Example', 'overview: "x"', 'mcuTimelineOrder: 9', '---', 'body mcuTimelineOrder: 5' ].join( '\n' ) )
} )

async function planFromCheckedInData () {
    const { getAllListings } = await import( '~/src/helpers/node/listing-files.ts' )
    const { FilteredListings } = await import( '~/src/helpers/listing-filters.ts' )
    const sheet = ( await import( '~/src/json/mcu-timeline-sheet.json' ) ).default
    const listings = new FilteredListings( { listings: await getAllListings(), listingsSort: 'default' } ).list as unknown as Listing[]
    const plan = planTimelineOrderSync( sheet.records as any, listings )
    const finalOrders = new Map( listings.map( listing => [ listing.id, listing.mcuTimelineOrder ] ) )

    plan.updates.forEach( ( { listing, order } ) => finalOrders.set( listing.id, order ) )
    plan.clears.forEach( listing => finalOrders.delete( listing.id ) )

    return { plan, sheet, listings, finalOrders }
}

test( 'Every matchable sheet entry finds exactly one listing, bar one known date gap', async () => {
    const { plan, sheet } = await planFromCheckedInData()
    const { organizeOrderData } = await import( '~/src/helpers/node/mcu-timeline-sheet.ts' )
    const { matchableOrderedTypes } = await import( '~/src/helpers/node/timeline-order-sync.ts' )
    const matchable = Object.values<any>( organizeOrderData( sheet.records as any ) ).filter( entry => matchableOrderedTypes.has( entry.timelineType ) )
    const matchedOrders = new Set( plan.matches.map( match => match.entry.mcuTimelineOrder ) )
    const unmatched = matchable.filter( entry => !matchedOrders.has( entry.mcuTimelineOrder ) )

    // Item 47 is 27 days apart (home video release against TMDB), past the tolerance
    expect( unmatched.map( entry => entry.title ) ).toEqual( [ 'Item 47' ] )
    expect( new Set( plan.matches.map( match => match.listing.id ) ).size ).toBe( plan.matches.length )
} )

test( 'After the plan every ordered listing is numbered by the current sheet', async () => {
    const { plan, finalOrders } = await planFromCheckedInData()
    const sheetOrders = new Set( plan.matches.map( match => match.entry.mcuTimelineOrder ) )

    for ( const order of finalOrders.values() ) {
        if ( typeof order === 'number' ) {
            expect( sheetOrders.has( order ) ).toBe( true )
        }
    }
} )

test( 'The sheet fixes the relative order the legacy numbers got wrong', async () => {
    const { plan, finalOrders } = await planFromCheckedInData()
    const orderOf = ( title: string ) => finalOrders.get( plan.matches.find( match => match.listing.title === title )?.listing.id ) as number

    expect( orderOf( 'Doctor Strange' ) ).toBeGreaterThan( orderOf( 'Spider-Man: Homecoming' ) )
    expect( orderOf( 'Eternals' ) ).toBeGreaterThan( orderOf( 'Spider-Man: No Way Home' ) )
    expect( orderOf( 'Moon Knight' ) ).toBeLessThan( orderOf( 'She-Hulk: Attorney at Law' ) )
    expect( orderOf( 'Thor: The Dark World' ) ).toBeLessThan( orderOf( 'Iron Man 3' ) )
    expect( orderOf( 'Marvel\'s Cloak & Dagger' ) ).toBeGreaterThan( orderOf( 'Captain America: Civil War' ) )
} )

test( 'One-shot sheet rows are numbered like any other listing', async () => {
    const { plan } = await planFromCheckedInData()
    const matchedTitles = plan.matches.map( match => match.entry.title )

    for ( const title of [ 'A Funny Thing Happened On The Way To Thor’s Hammer', 'The Consultant', 'All Hail The King' ] ) {
        expect( matchedTitles ).toContain( title )
    }

    expect( plan.matches.find( match => match.entry.title === 'The Consultant' )?.listing.id ).toBe( 76122 )
} )
