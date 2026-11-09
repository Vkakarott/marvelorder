import { describe, expect, test } from 'vitest'

import type { ListingFileEntry } from '~/src/helpers/listing-identity.ts'
import {
    pickIdentitiesToCheck,
    recordChecks,
    type ExistenceCache,
} from '~/src/helpers/orphan-sweep.ts'

const options = { today: '2026-11-08', limit: 2, refreshDays: 30 }

function makeEntry ( id: number, frontmatter: Record<string, unknown> = {} ): ListingFileEntry {
    return { path: `${ id }.md`, frontmatter, tmdbSection: '', tmdb: { id, tags: [ 'tv' ] } }
}

describe( 'pickIdentitiesToCheck', () => {
    test( 'skips listed, drafted and explicitly kept files', () => {
        const entries = [
            makeEntry( 1 ),
            makeEntry( 2 ),
            makeEntry( 3, { draft: true } ),
            makeEntry( 4, { draft: false } ),
        ]

        expect( pickIdentitiesToCheck( entries, new Set( [ 'tv:1' ] ), {}, { ...options, limit: 10 } ) ).toEqual( [ 'tv:2' ] )
    } )

    test( 'limits the batch and probes never-checked files before old checks', () => {
        const cache: ExistenceCache = { 'tv:1': { checkedAt: '2026-08-01', gone: false } }
        const entries = [ makeEntry( 1 ), makeEntry( 2 ), makeEntry( 3 ) ]

        expect( pickIdentitiesToCheck( entries, new Set(), cache, options ) ).toEqual( [ 'tv:2', 'tv:3' ] )
        expect( pickIdentitiesToCheck( entries, new Set(), cache, { ...options, limit: 3 } ).at( -1 ) ).toBe( 'tv:1' )
    } )

    test( 'trusts a recent check until it is older than the refresh window', () => {
        const entries = [ makeEntry( 1 ) ]
        const recent: ExistenceCache = { 'tv:1': { checkedAt: '2026-10-20', gone: false } }
        const old: ExistenceCache = { 'tv:1': { checkedAt: '2026-09-01', gone: false } }

        expect( pickIdentitiesToCheck( entries, new Set(), recent, options ) ).toEqual( [] )
        expect( pickIdentitiesToCheck( entries, new Set(), old, options ) ).toEqual( [ 'tv:1' ] )
    } )

    test( 'covers a backlog over several runs', () => {
        const entries = Array.from( { length: 5 }, ( _, index ) => makeEntry( index + 1 ) )
        let cache: ExistenceCache = {}
        const seen = new Set<string>()

        for ( let run = 0; run < 3; run++ ) {
            const batch = pickIdentitiesToCheck( entries, new Set(), cache, options )

            batch.forEach( identity => seen.add( identity ) )
            cache = recordChecks( cache, new Map( batch.map( identity => [ identity, false ] ) ), options.today )
        }

        expect( seen.size ).toBe( 5 )
    } )
} )

describe( 'recordChecks', () => {
    test( 'stores the date and result without mutating the old cache', () => {
        const cache: ExistenceCache = {}
        const next = recordChecks( cache, new Map( [ [ 'tv:1', true ] ] ), '2026-11-08' )

        expect( next[ 'tv:1' ] ).toEqual( { checkedAt: '2026-11-08', gone: true } )
        expect( cache ).toEqual( {} )
    } )
} )
