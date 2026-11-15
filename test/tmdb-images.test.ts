import { expect, test } from 'vitest'

import {
    fillMissingImages,
    needsImageFallback,
    pickFallbackImages,
} from '~/src/helpers/tmdb-images.ts'

const posters = [
    { file_path: '/de.jpg', iso_639_1: 'de', vote_average: 9, vote_count: 9 },
    { file_path: '/en.jpg', iso_639_1: 'en', vote_average: 5, vote_count: 3 },
    { file_path: '/pt.jpg', iso_639_1: 'pt', vote_average: 1, vote_count: 1 },
    { file_path: '/none.jpg', iso_639_1: null, vote_average: 8, vote_count: 8 },
]

test( 'Posters prefer Portuguese, then English, then textless, then any language', () => {
    expect( pickFallbackImages( { posters } ).poster_path ).toBe( '/pt.jpg' )
    expect( pickFallbackImages( { posters: posters.slice( 0, 2 ).concat( posters[ 3 ] ) } ).poster_path ).toBe( '/en.jpg' )
    expect( pickFallbackImages( { posters: [ posters[ 0 ], posters[ 3 ] ] } ).poster_path ).toBe( '/none.jpg' )
    expect( pickFallbackImages( { posters: [ posters[ 0 ] ] } ).poster_path ).toBe( '/de.jpg' )
} )

test( 'Backdrops prefer textless images, and ties go to the best rated', () => {
    const backdrops = [
        { file_path: '/en-high.jpg', iso_639_1: 'en', vote_average: 9, vote_count: 9 },
        { file_path: '/none-low.jpg', iso_639_1: null, vote_average: 1, vote_count: 1 },
        { file_path: '/none-high.jpg', iso_639_1: null, vote_average: 6, vote_count: 2 },
    ]

    expect( pickFallbackImages( { backdrops } ).backdrop_path ).toBe( '/none-high.jpg' )
} )

test( 'Missing or empty image lists produce no paths', () => {
    expect( pickFallbackImages( {} ) ).toEqual( { poster_path: null, backdrop_path: null } )
    expect( pickFallbackImages( { posters: [], backdrops: [] } ) ).toEqual( { poster_path: null, backdrop_path: null } )
} )

test( 'Only listings with neither poster nor backdrop need the fallback', () => {
    expect( needsImageFallback( { poster_path: null, backdrop_path: null } ) ).toBe( true )
    expect( needsImageFallback( { poster_path: '', backdrop_path: undefined } ) ).toBe( true )
    expect( needsImageFallback( { poster_path: '/a.jpg', backdrop_path: null } ) ).toBe( false )
    expect( needsImageFallback( { poster_path: null, backdrop_path: '/b.jpg' } ) ).toBe( false )
} )

test( 'Fills missing images, never overwrites, skips gone ids and failures, and respects the limit', async () => {
    const listings = [
        { id: 1, tags: [ 'movie' ], poster_path: null, backdrop_path: null },
        { id: 2, tags: [ 'movie' ], poster_path: '/keep.jpg', backdrop_path: null },
        { id: 3, tags: [ 'movie' ], poster_path: null, backdrop_path: null },
        { id: 4, tags: [ 'movie' ], poster_path: null, backdrop_path: null },
        { id: 5, tags: [ 'movie' ], poster_path: null, backdrop_path: null },
    ]
    const requested: string[] = []

    const filled = await fillMissingImages( listings, {
        limit: 3,
        isGone: ( identity ) => identity === 'movie:3',
        fetchImages: async ( identity ) => {
            requested.push( identity )

            if ( identity === 'movie:4' ) {
                throw new Error( 'TMDB outage' )
            }

            return { posters: [ { file_path: `/${ identity }.jpg`, iso_639_1: 'pt' } ] }
        },
    } )

    expect( requested ).toEqual( [ 'movie:1', 'movie:4', 'movie:5' ] )
    expect( filled ).toBe( 2 )
    expect( listings[ 0 ].poster_path ).toBe( '/movie:1.jpg' )
    expect( listings[ 1 ].poster_path ).toBe( '/keep.jpg' )
    expect( listings[ 2 ].poster_path ).toBeNull()
    expect( listings[ 3 ].poster_path ).toBeNull()
    expect( listings[ 4 ].poster_path ).toBe( '/movie:5.jpg' )
} )
