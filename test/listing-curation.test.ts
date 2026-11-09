import { readdirSync, readFileSync } from 'node:fs'

import matter from 'gray-matter'
import { describe, expect, test } from 'vitest'

import {
    applySuppressions,
    draftGoneListings,
} from '~/src/helpers/listing-curation-files.ts'
import {
    addDraftToMarkdown,
    decideAutoDraft,
    getRuleReason,
    type Suppression,
} from '~/src/helpers/listing-curation.ts'
import type { FrontmatterCodec, ListingStoreIO } from '~/src/helpers/listing-consolidation.ts'
import { getDataFromListingContents } from '~/src/helpers/markdown-page.ts'
import {
    checkRegressionBudget,
} from '~/src/helpers/regression-budget.ts'
import suppressionFile from '~/src/json/listing-suppressions.json'

const suppressions = suppressionFile.suppressions as Suppression[]
const listingDirectory = './src/pages/pt-br'
const codec = matter as unknown as FrontmatterCodec

function readCatalog () {
    return readdirSync( listingDirectory )
        .filter( file => file.endsWith( '.md' ) )
        .map( ( file ) => {
            const path = `${ listingDirectory }/${ file }`
            const markdown = readFileSync( path, 'utf8' )

            return { path, markdown, ...getDataFromListingContents( { markdown, matter } ) }
        } )
}

function makeMemoryIO ( files: Map<string, string> ): ListingStoreIO {
    return {
        listListingPaths: async () => [ ...files.keys() ],
        readText: async path => files.get( path ) as string,
        writeText: async ( path, content ) => { files.set( path, content ) },
        remove: async ( path ) => { files.delete( path ) },
    }
}

function makeListingFile ( frontmatter: string, id: number, tags: string[] ) {
    return `---\n${ frontmatter }---\n## TMDB Data\n\`\`\`json\n${ JSON.stringify( { id, tags } ) }\n\`\`\`\n`
}

describe( 'decideAutoDraft', () => {
    const catalog = readCatalog()

    test( 'never touches the 22 owner drafts, new or not', () => {
        // Drafts without autoDraft are the owner's own; tool-made ones carry a reason
        const drafts = catalog.filter( ( { frontmatter } ) => frontmatter.draft === true && !frontmatter.autoDraft )

        expect( drafts ).toHaveLength( 22 )

        for ( const { listing, frontmatter } of drafts ) {
            expect( decideAutoDraft( { frontmatter, listing, suppressions, isNew: true } ) ).toBeNull()
        }
    } )

    test( 'respects an explicit draft: false even for a suppressed id', () => {
        const listing = { id: 305165, tags: [ 'tv' ], title: 'LEGO Marvel Avengers: Strange Tails' }

        expect( decideAutoDraft( { frontmatter: { draft: false }, listing, suppressions, isNew: true } ) ).toBeNull()
    } )

    test( 'suppresses all 17 owner-listed ids on existing and new files', () => {
        expect( suppressions ).toHaveLength( 17 )

        for ( const { identity, reason } of suppressions ) {
            const [ type, id ] = identity.split( ':' )
            const listing = { id: Number( id ), tags: [ type ], title: 'x' }

            for ( const isNew of [ true, false ] ) {
                expect( decideAutoDraft( { frontmatter: {}, listing, suppressions, isNew } ) ).toEqual( { draft: true, autoDraft: reason } )
            }
        }
    } )

    test( 'rules judge only new titles', () => {
        const listing = { id: 1, tags: [ 'tv' ], title: 'Some Official Podcast' }
        const decide = ( isNew: boolean ) => decideAutoDraft( { frontmatter: {}, listing, suppressions, isNew } )

        expect( decide( true ) ).toEqual( { draft: true, autoDraft: 'rule-podcast' } )
        expect( decide( false ) ).toBeNull()
    } )

    test( 'rules catch the audited extras and spare Marvel Studios titles', () => {
        expect( getRuleReason( { title: 'LEGO Marvel Avengers: Code Red' } ) ).toBe( 'rule-lego' )
        expect( getRuleReason( { title: 'Avengers: Secret Wars (Shorts)' } ) ).toBe( 'rule-short-or-featurette' )
        expect( getRuleReason( { title: 'Daredevil: Born Again Official Podcast' } ) ).toBe( 'rule-podcast' )
        expect( getRuleReason( { title: 'Assembled: The Making of Thunderbolts*' } ) ).toBeNull()
        expect( getRuleReason( { title: 'Marvel One-Shot: Agent Carter' } ) ).toBeNull()
        expect( getRuleReason( { title: 'Iron Man' } ) ).toBeNull()
    } )
} )

describe( 'addDraftToMarkdown', () => {
    test( 'adds draft keys at the top and leaves the rest untouched', () => {
        const markdown = makeListingFile( 'title: Night Man\n', 13084, [ 'tv' ] )
        const updated = addDraftToMarkdown( markdown, { draft: true, autoDraft: 'tmdb-404' } )

        expect( matter( updated ).data ).toMatchObject( { draft: true, autoDraft: 'tmdb-404', title: 'Night Man' } )
        expect( updated.replace( 'draft: true\nautoDraft: "tmdb-404"\n', '' ) ).toBe( markdown )
    } )
} )

describe( 'applySuppressions and draftGoneListings', () => {
    test( 'drafts every suppressed id in the real catalog and stays idempotent', async () => {
        const files = new Map( readCatalog().map( ( { path, markdown } ) => [ path, markdown ] ) )
        files.set( 'synthetic.md', makeListingFile( 'title: "LEGO Marvel Avengers: Strange Tails"\n', 305165, [ 'tv' ] ) )
        const io = makeMemoryIO( files )

        const first = await applySuppressions( { io, matter: codec, suppressions } )
        const second = await applySuppressions( { io, matter: codec, suppressions } )
        const suppressedIdentities = new Set( suppressions.map( entry => entry.identity ) )

        expect( first ).toContain( 'synthetic.md' )
        expect( second ).toEqual( [] )

        for ( const [ path, markdown ] of files ) {
            const { listing, frontmatter } = path === 'synthetic.md'
                ? { listing: { id: 305165, tags: [ 'tv' ] }, frontmatter: matter( markdown ).data }
                : getDataFromListingContents( { markdown, matter } )
            const identity = `${ listing.tags?.includes( 'tv' ) ? 'tv' : 'movie' }:${ listing.id }`

            if ( suppressedIdentities.has( identity ) ) {
                expect( frontmatter.draft, path ).toBe( true )
            }
        }
    } )

    test( 'marks gone ids as draft, keeps the file and skips explicit choices', async () => {
        const files = new Map( [
            [ 'a.md', makeListingFile( 'title: Gone\n', 1, [ 'tv' ] ) ],
            [ 'b.md', makeListingFile( 'title: Kept\ndraft: false\n', 2, [ 'tv' ] ) ],
            [ 'c.md', makeListingFile( 'title: Alive\n', 3, [ 'tv' ] ) ],
        ] )
        const io = makeMemoryIO( files )

        const changed = await draftGoneListings( { io, matter: codec, goneIdentities: new Set( [ 'tv:1', 'tv:2' ] ) } )

        expect( changed ).toEqual( [ 'a.md' ] )
        expect( files.size ).toBe( 3 )
        expect( matter( files.get( 'a.md' ) as string ).data ).toMatchObject( { draft: true, autoDraft: 'tmdb-404' } )
        expect( matter( files.get( 'b.md' ) as string ).data.draft ).toBe( false )
    } )
} )

describe( 'checkRegressionBudget', () => {
    test( 'allows the audited run of 3 missing ids out of 252', () => {
        expect( checkRegressionBudget( { previousListings: 252, missingIds: 3 } ).ok ).toBe( true )
    } )

    test( 'blocks a run that loses a large share of the catalog', () => {
        const result = checkRegressionBudget( { previousListings: 252, missingIds: 120 } )

        expect( result.ok ).toBe( false )
    } )

    test( 'never blocks small catalogs below the minimum', () => {
        expect( checkRegressionBudget( { previousListings: 10, missingIds: 9 } ).ok ).toBe( true )
    } )
} )
