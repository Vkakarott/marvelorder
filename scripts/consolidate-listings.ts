// Collapses listing files to one per media identity using live TMDB pages.
// Usage: npm run consolidate-listings [-- --dry-run] [-- --max-plans 50]
import { execFile } from 'node:child_process'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import matter from 'gray-matter'
import { parseHTML } from 'linkedom'

import {
    consolidateListingFiles,
    findReplacementCandidates,
    getListingUrlFromPath,
    getTitlesByIdentity,
    readListingEntries,
    type ListingStoreIO,
} from '../src/helpers/listing-consolidation.ts'
import {
    getEntryIdentity,
    isCompatibleReplacement,
    type ListingFileEntry,
    type ListingFrontmatter,
    type ReplacementCandidate,
} from '../src/helpers/listing-identity.ts'
import { persistListingRedirects, type ListingRedirect } from '../src/helpers/listing-redirects.ts'
import { makeSlug } from '../src/helpers/node/listing.ts'

const directory = 'src/pages/pt-br'
const isDryRun = process.argv.includes( '--dry-run' )
const maxPlans = process.argv.includes( '--max-plans' ) ? Number( process.argv[ process.argv.indexOf( '--max-plans' ) + 1 ] ) : 50
const retiredAt = new Date().toISOString().slice( 0, 10 )
const run = promisify( execFile )

interface TmdbPageStatus {
    exists: boolean
    title: string
}

const io: ListingStoreIO = {
    listListingPaths: async () => ( await readdir( directory ) ).filter( file => file.endsWith( '.md' ) ).map( file => `${ directory }/${ file }` ),
    readText: filePath => readFile( filePath, 'utf8' ),
    writeText: async ( filePath, content ) => {
        if ( !isDryRun ) {
            await writeFile( filePath, content )
        }
    },
    remove: async ( filePath ) => {
        if ( !isDryRun ) {
            await rm( filePath )
        }
    },
}

async function fetchTmdbPage ( identity: string ): Promise<TmdbPageStatus> {
    const [ type, id ] = identity.split( ':' )
    const url = `https://www.themoviedb.org/${ type }/${ id }?language=en-US`

    for ( let attempt = 0; attempt < 4; attempt++ ) {
        const response = await fetch( url, { signal: AbortSignal.timeout( 15_000 ) } )

        if ( response.status === 404 ) {
            return { exists: false, title: '' }
        }
        if ( response.ok ) {
            const title = parseHTML( await response.text() ).document.querySelector( 'meta[property="og:title"]' )?.getAttribute( 'content' )
            return { exists: true, title: title?.trim() || '' }
        }
        await new Promise( resolve => setTimeout( resolve, 1_000 * 2 ** attempt ) )
    }

    throw new Error( `TMDB indisponível para ${ identity }` )
}

async function fetchTmdbPages ( identities: string[] ): Promise<Map<string, TmdbPageStatus>> {
    const pages = new Map<string, TmdbPageStatus>()

    for ( let start = 0; start < identities.length; start += 4 ) {
        const batch = identities.slice( start, start + 4 )
        const statuses = await Promise.all( batch.map( fetchTmdbPage ) )
        batch.forEach( ( identity, index ) => pages.set( identity, statuses[ index ] ) )
    }

    return pages
}

function getLiveTitles ( pages: Map<string, TmdbPageStatus> ): Map<string, string> {
    const titles = new Map<string, string>()

    for ( const [ identity, page ] of pages ) {
        if ( page.exists && page.title ) {
            titles.set( identity, page.title )
        }
    }

    return titles
}

function findConfirmedReplacements ( entries: ListingFileEntry[], pages: Map<string, TmdbPageStatus> ): ReplacementCandidate[] {
    const goneIdentities = new Set( [ ...pages ].filter( ( [ , page ] ) => !page.exists ).map( ( [ identity ] ) => identity ) )
    const liveTitles = getLiveTitles( pages )
    const titles = getTitlesByIdentity( entries, liveTitles )
    const candidates = findReplacementCandidates( titles, goneIdentities )

    const listings = getListingsByIdentity( entries )
    const compatible = candidates.filter( ( { gone, live } ) => {
        return pages.get( live )?.exists === true && isCompatibleReplacement( listings.get( gone ) || {}, listings.get( live ) || {} )
    } )

    // A gone id must map to exactly one live id
    return compatible.filter( candidate => compatible.filter( other => other.gone === candidate.gone ).length === 1 )
}

function getListingsByIdentity ( entries: ListingFileEntry[] ): Map<string, ListingFrontmatter> {
    const listings = new Map<string, ListingFrontmatter>()

    for ( const entry of entries ) {
        const listing = { ...entry.tmdb, ...entry.frontmatter }
        const identity = getEntryIdentity( entry )
        if ( identity && ( !listings.has( identity ) || getReleaseDate( listing ) ) ) {
            listings.set( identity, listing )
        }
    }

    return listings
}

function getReleaseDate ( listing: ListingFrontmatter ): string {
    return String( listing.release_date || listing.first_air_date || '' )
}

async function getCreatedAt ( filePath: string ): Promise<number> {
    const { stdout } = await run( 'git', [ 'log', '--follow', '--diff-filter=A', '--format=%at', '--', filePath ] )
    const timestamps = stdout.trim().split( '\n' ).filter( Boolean ).map( Number )

    return timestamps.length > 0 ? Math.min( ...timestamps ) : Date.now() / 1_000
}

// Newest observation first, so ties go to the most recent rename
async function makeEntryOrder ( entries: ListingFileEntry[] ) {
    const createdAt = new Map( await Promise.all( entries.map( async entry => [ entry.path, await getCreatedAt( entry.path ) ] as const ) ) )

    return ( toOrder: ListingFileEntry[] ) => [ ...toOrder ].sort( ( entryA, entryB ) => ( createdAt.get( entryB.path ) || 0 ) - ( createdAt.get( entryA.path ) || 0 ) )
}

function getDuplicateEntries ( entries: ListingFileEntry[] ): ListingFileEntry[] {
    const counts = new Map<string, number>()
    entries.forEach( entry => counts.set( getEntryIdentity( entry ) || '', ( counts.get( getEntryIdentity( entry ) || '' ) || 0 ) + 1 ) )

    return entries.filter( entry => ( counts.get( getEntryIdentity( entry ) || '' ) || 0 ) > 1 )
}

async function findOrphanedTargetRedirects ( livePaths: Set<string> ): Promise<ListingRedirect[]> {
    const configs = await Promise.all( [ readFile( 'netlify.toml', 'utf8' ), readFile( 'vercel.json', 'utf8' ) ] )
    const targets = new Set( configs.join( '\n' ).match( /\/pt-br\/[a-z0-9-]+-\d+/g ) || [] )

    return [ ...targets ].filter( target => !livePaths.has( target ) ).flatMap( ( target ) => {
        const id = target.split( '-' ).pop()
        const matches = [ ...livePaths ].filter( livePath => livePath.endsWith( `-${ id }` ) )
        return matches.length === 1 ? [ { from: target, to: matches[ 0 ], reason: 'duplicate-file' as const, retiredAt } ] : []
    } )
}

function logPlans ( result: Awaited<ReturnType<typeof consolidateListingFiles>> ) {
    for ( const plan of result.plans ) {
        console.log( `${ plan.identity } -> ${ path.basename( plan.path ) } (remove ${ plan.remove.map( entry => path.basename( entry.path ) ).join( ', ' ) })` )
    }
}

async function main () {
    const entries = await readListingEntries( io, matter )
    const identities = [ ...new Set( entries.map( getEntryIdentity ).filter( ( identity ): identity is string => Boolean( identity ) ) ) ]
    console.log( `Consultando ${ identities.length } títulos no TMDB...` )
    const pages = await fetchTmdbPages( identities )
    const liveSlugs = new Map( [ ...getLiveTitles( pages ) ].map( ( [ identity, title ] ) => [ identity, makeSlug( title ) ] ) )
    const replacements = findConfirmedReplacements( entries, pages )
    const orderEntries = await makeEntryOrder( [ ...getDuplicateEntries( entries ), ...entries.filter( entry => replacements.some( pair => getEntryIdentity( entry ) === pair.gone || getEntryIdentity( entry ) === pair.live ) ) ] )

    const result = await consolidateListingFiles( { io, matter, directory, liveSlugs, replacements, maxPlans, retiredAt, orderEntries } )
    logPlans( result )
    if ( result.skipped ) {
        throw new Error( `${ result.plans.length } consolidações excedem o limite de ${ maxPlans }.` )
    }

    const livePaths = new Set( ( await io.listListingPaths() ).map( getListingUrlFromPath ) )
    const repairs = isDryRun ? [] : await findOrphanedTargetRedirects( livePaths )
    if ( !isDryRun ) {
        await persistListingRedirects( { readText: filePath => readFile( filePath, 'utf8' ), writeText: writeFile }, [ ...result.redirects, ...repairs ], livePaths )
    }
    console.log( `${ result.plans.length } títulos consolidados, ${ result.redirects.length + repairs.length } redirecionamentos.` )
}

await main()
