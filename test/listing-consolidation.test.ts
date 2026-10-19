import matter from 'gray-matter'
import { describe, expect, test } from 'vitest'

import {
    consolidateListingFiles,
    getListingUrlFromPath,
    type ListingStoreIO,
} from '~/src/helpers/listing-consolidation.ts'
import {
    chooseCanonicalEntry,
    findReplacementCandidates,
    getListingIdentity,
    isCompatibleReplacement,
    mergeListingFrontmatter,
    type ListingFileEntry,
} from '~/src/helpers/listing-identity.ts'

const directory = 'src/pages/pt-br'

function makeMarkdown ( frontmatter: Record<string, unknown>, tmdb: Record<string, unknown> ) {
    const tmdbSection = [ '## TMDB Data', '```json', JSON.stringify( tmdb, null, 4 ), '```' ].join( '\n' )

    return matter.stringify( tmdbSection, frontmatter )
}

function makeMemoryStore ( files: Record<string, string> ) {
    const store = new Map( Object.entries( files ) )
    const io: ListingStoreIO = {
        listListingPaths: async () => [ ...store.keys() ],
        readText: async path => store.get( path ) || '',
        writeText: async ( path, content ) => {
            store.set( path, content )
        },
        remove: async ( path ) => {
            store.delete( path )
        },
    }

    return { store, io }
}

function makeEntry ( path: string, frontmatter: Record<string, unknown> ): ListingFileEntry {
    return { path, frontmatter, tmdb: { id: frontmatter.id }, tmdbSection: '' }
}

function consolidate ( io: ListingStoreIO, overrides: Partial<Parameters<typeof consolidateListingFiles>[0]> = {} ) {
    return consolidateListingFiles( {
        io,
        matter,
        directory,
        liveSlugs: new Map(),
        replacements: [],
        maxPlans: 10,
        retiredAt: '2026-10-19',
        ...overrides,
    } )
}

describe( 'listing identity', () => {
    test( 'namespaces ids by media type', () => {
        expect( getListingIdentity( { id: 1, tags: [ 'movie' ] } ) ).toBe( 'movie:1' )
        expect( getListingIdentity( { id: 1, type: 'tv' } ) ).toBe( 'tv:1' )
        expect( getListingIdentity( { title: 'No id' } ) ).toBeNull()
    } )

    test( 'prefers visible files, then the live TMDB slug', () => {
        const draft = makeEntry( 'a.md', { id: 1, slug: 'live', draft: true } )
        const old = makeEntry( 'b.md', { id: 1, slug: 'old' } )
        const live = makeEntry( 'c.md', { id: 1, slug: 'live' } )

        expect( chooseCanonicalEntry( [ draft, old, live ], 'live' ) ).toBe( live )
        expect( chooseCanonicalEntry( [ draft, old ], 'live' ) ).toBe( old )
    } )

    test( 'fills gaps without leaking identity, draft or another title', () => {
        const merged = mergeListingFrontmatter(
            { id: 1, title: 'New', slug: 'new', logo_on_black: '' },
            [ { id: 2, title: 'Old', slug: 'old', draft: true, logo_on_black: 'logo.webp', localized_title: 'Velho' } ],
        )

        expect( merged ).toEqual( { id: 1, title: 'New', slug: 'new', logo_on_black: 'logo.webp' } )
    } )

    test( 'keeps the localized title when both observations share a title', () => {
        const merged = mergeListingFrontmatter(
            { id: 1, title: 'Iron Man' },
            [ { id: 1, title: 'Iron Man', localized_title: 'Homem de Ferro' } ],
        )

        expect( merged.localized_title ).toBe( 'Homem de Ferro' )
    } )

    test( 'pairs replacement candidates only within the same media type', () => {
        const titles = new Map<string, unknown>( [
            [ 'movie:1', 'The Punisher: One Last Kill' ],
            [ 'movie:2', 'The Punisher - One Last Kill' ],
            [ 'tv:3', 'The Punisher: One Last Kill' ],
        ] )

        expect( findReplacementCandidates( titles, new Set( [ 'movie:1' ] ) ) ).toEqual( [ { gone: 'movie:1', live: 'movie:2' } ] )
    } )

    test( 'rejects same-titled remakes from another studio or era', () => {
        const mcuBlade = { tags: [ 'movie', 'company-420' ], release_date: '' }

        expect( isCompatibleReplacement( mcuBlade, { tags: [ 'movie', 'company-7505' ], release_date: '1998-08-21' } ) ).toBe( false )
        expect( isCompatibleReplacement( { tags: [ 'movie', 'company-420' ], release_date: '2015-01-01' }, { tags: [ 'movie', 'company-420' ], release_date: '2025-01-01' } ) ).toBe( false )
        expect( isCompatibleReplacement( { tags: [ 'tv', 'company-420' ], first_air_date: '2022-08-10' }, { tags: [ 'tv', 'company-420' ], first_air_date: '2023-09-06' } ) ).toBe( false )
        expect( isCompatibleReplacement( { tags: [ 'movie', 'company-420' ], release_date: '2026-05-12' }, mcuBlade ) ).toBe( true )
    } )
} )

describe( 'listing consolidation', () => {
    test( 'merges duplicate files of one identity into the live slug', async () => {
        const { store, io } = makeMemoryStore( {
            [ `${ directory }/avengers-5-1.md` ]: makeMarkdown( { id: 1, title: 'Avengers 5', slug: 'avengers-5', tags: [ 'movie' ], logo_on_black: 'logo.webp' }, { id: 1 } ),
            [ `${ directory }/avengers-doomsday-1.md` ]: makeMarkdown( { id: 1, title: 'Avengers: Doomsday', slug: 'avengers-doomsday', tags: [ 'movie' ] }, { id: 1 } ),
        } )

        const result = await consolidate( io, { liveSlugs: new Map( [ [ 'movie:1', 'avengers-doomsday' ] ] ) } )

        expect( [ ...store.keys() ] ).toEqual( [ `${ directory }/avengers-doomsday-1.md` ] )
        expect( matter( store.get( `${ directory }/avengers-doomsday-1.md` ) || '' ).data.logo_on_black ).toBe( 'logo.webp' )
        expect( result.redirects ).toEqual( [ {
            from: '/pt-br/avengers-5-1',
            to: '/pt-br/avengers-doomsday-1',
            reason: 'duplicate-file',
            retiredAt: '2026-10-19',
        } ] )
    } )

    test( 'moves a deleted TMDB id onto the surviving id', async () => {
        const { store, io } = makeMemoryStore( {
            [ `${ directory }/untitled-punisher-10.md` ]: makeMarkdown( { id: 10, title: 'Untitled Punisher', slug: 'untitled-punisher', tags: [ 'movie' ], draft: true }, { id: 10 } ),
            [ `${ directory }/one-last-kill-20.md` ]: makeMarkdown( { id: 20, title: 'One Last Kill', slug: 'one-last-kill', tags: [ 'movie' ] }, { id: 20 } ),
        } )

        const result = await consolidate( io, {
            liveSlugs: new Map( [ [ 'movie:10', 'one-last-kill' ] ] ),
            replacements: [ { gone: 'movie:20', live: 'movie:10' } ],
        } )
        const survivor = matter( store.get( `${ directory }/one-last-kill-10.md` ) || '' )

        expect( [ ...store.keys() ] ).toEqual( [ `${ directory }/one-last-kill-10.md` ] )
        expect( survivor.data ).toMatchObject( { id: 10, title: 'One Last Kill' } )
        expect( survivor.data.draft ).toBeUndefined()
        expect( survivor.content ).toContain( '"id": 10' )
        expect( result.redirects.map( redirect => [ redirect.from, redirect.reason ] ) ).toEqual( [
            [ '/pt-br/untitled-punisher-10', 'duplicate-file' ],
            [ '/pt-br/one-last-kill-20', 'tmdb-id-replaced' ],
        ] )
    } )

    test( 'leaves every file untouched when the merge budget is exceeded', async () => {
        const files = {
            [ `${ directory }/a-1.md` ]: makeMarkdown( { id: 1, slug: 'a', tags: [ 'movie' ] }, { id: 1 } ),
            [ `${ directory }/b-1.md` ]: makeMarkdown( { id: 1, slug: 'b', tags: [ 'movie' ] }, { id: 1 } ),
        }
        const { store, io } = makeMemoryStore( files )

        const result = await consolidate( io, { maxPlans: 0 } )

        expect( result.skipped ).toBe( true )
        expect( Object.fromEntries( store ) ).toEqual( files )
    } )

    test( 'builds listing URLs from file paths', () => {
        expect( getListingUrlFromPath( `${ directory }/iron-man-1726.md` ) ).toBe( '/pt-br/iron-man-1726' )
    } )
} )
