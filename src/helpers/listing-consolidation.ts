// Enforces one listing file per media identity.
// File access and frontmatter parsing are injected so Deno and Node share it.

import {
    findReplacementCandidates,
    groupEntriesByIdentity,
    planIdentityMerge,
    type IdentityMergePlan,
    type ListingFileEntry,
    type ListingFrontmatter,
    type ReplacementCandidate,
} from './listing-identity.ts'
import type { ListingRedirect, ListingRedirectReason } from './listing-redirects.ts'
import {
    getPartsFromMarkdown,
    parseTMDbMarkdown,
    tmdbHeading,
} from './markdown-page.ts'

export interface ListingStoreIO {
    listListingPaths: () => Promise<string[]>
    readText: ( path: string ) => Promise<string>
    writeText: ( path: string, content: string ) => Promise<void>
    remove: ( path: string ) => Promise<void>
}

export interface FrontmatterCodec {
    ( markdown: string ): { data: ListingFrontmatter }
    stringify: ( content: string, data: ListingFrontmatter ) => string
}

export interface ConsolidationOptions {
    io: ListingStoreIO
    matter: FrontmatterCodec
    directory: string
    // Slug TMDB currently reports for each identity
    liveSlugs: Map<string, string>
    // Confirmed pairs where TMDB deleted one id in favour of another
    replacements: ReplacementCandidate[]
    // Refuse the whole consolidation above this many merges
    maxPlans: number
    retiredAt: string
    // Orders entries newest observation first; defaults to path order
    orderEntries?: ( entries: ListingFileEntry[] ) => ListingFileEntry[]
}

export interface ConsolidationResult {
    skipped: boolean
    plans: IdentityMergePlan[]
    redirects: ListingRedirect[]
}

export async function readListingEntries ( io: ListingStoreIO, matter: FrontmatterCodec ): Promise<ListingFileEntry[]> {
    const paths = ( await io.listListingPaths() ).sort()

    return Promise.all( paths.map( async ( path ) => {
        const markdown = await io.readText( path )
        const { tmdbContent } = getPartsFromMarkdown( markdown )

        return {
            path,
            frontmatter: structuredClone( matter( markdown ).data ),
            tmdbSection: `${ tmdbHeading }${ tmdbContent }`.trim(),
            tmdb: parseTMDbMarkdown( tmdbContent ) as unknown as Record<string, unknown>,
        }
    } ) )
}

export function getListingUrlFromPath ( path: string ): string {
    const fileName = path.split( '/' ).pop() || ''

    return `/pt-br/${ fileName.replace( /\.md$/, '' ) }`
}

function combineReplacementGroups ( groups: Map<string, ListingFileEntry[]>, replacements: ReplacementCandidate[] ) {
    const survivors = new Map<string, ListingFileEntry[]>()

    for ( const { gone, live } of replacements ) {
        const goneEntries = groups.get( gone ) || []
        const liveEntries = groups.get( live ) || []

        if ( goneEntries.length === 0 || liveEntries.length === 0 ) {
            continue
        }

        survivors.set( live, liveEntries )
        groups.set( live, [ ...liveEntries, ...goneEntries ] )
        groups.delete( gone )
    }

    return survivors
}

export function planConsolidation ( entries: ListingFileEntry[], options: Pick<ConsolidationOptions, 'directory' | 'liveSlugs' | 'replacements'> ): IdentityMergePlan[] {
    const groups = groupEntriesByIdentity( entries )
    const survivors = combineReplacementGroups( groups, options.replacements )
    const plans: IdentityMergePlan[] = []

    for ( const [ identity, group ] of groups ) {
        if ( group.length < 2 ) {
            continue
        }

        const liveSlug = options.liveSlugs.get( identity )
        const survivorGroup = survivors.get( identity )
        const survivor = survivorGroup ? planIdentityMerge( { identity, entries: survivorGroup, liveSlug, directory: options.directory } ).keep : undefined

        plans.push( planIdentityMerge( { identity, entries: group, survivor, liveSlug, directory: options.directory } ) )
    }

    return plans
}

function getRedirectReason ( plan: IdentityMergePlan, entry: ListingFileEntry ): ListingRedirectReason {
    return entry.tmdb.id === plan.frontmatter.id ? 'duplicate-file' : 'tmdb-id-replaced'
}

function makePlanRedirects ( plan: IdentityMergePlan, retiredAt: string ): ListingRedirect[] {
    return plan.remove.map( entry => ( {
        from: getListingUrlFromPath( entry.path ),
        to: getListingUrlFromPath( plan.path ),
        reason: getRedirectReason( plan, entry ),
        retiredAt,
    } ) )
}

function isUnchanged ( plan: IdentityMergePlan ): boolean {
    return plan.keep.path === plan.path
        && JSON.stringify( plan.keep.frontmatter ) === JSON.stringify( plan.frontmatter )
}

async function applyPlan ( plan: IdentityMergePlan, options: ConsolidationOptions ) {
    if ( !isUnchanged( plan ) ) {
        await options.io.writeText( plan.path, options.matter.stringify( plan.tmdbSection, plan.frontmatter ) )
    }

    for ( const entry of plan.remove ) {
        await options.io.remove( entry.path )
    }
}

export async function consolidateListingFiles ( options: ConsolidationOptions ): Promise<ConsolidationResult> {
    const entries = await readListingEntries( options.io, options.matter )
    const orderedEntries = options.orderEntries ? options.orderEntries( entries ) : entries
    const plans = planConsolidation( orderedEntries, options )

    if ( plans.length > options.maxPlans ) {
        return { skipped: true, plans, redirects: [] }
    }

    for ( const plan of plans ) {
        await applyPlan( plan, options )
    }

    return {
        skipped: false,
        plans,
        redirects: plans.flatMap( plan => makePlanRedirects( plan, options.retiredAt ) ),
    }
}

export function getTitlesByIdentity ( entries: ListingFileEntry[], liveTitles: Map<string, unknown> ): Map<string, unknown> {
    const titles = new Map<string, unknown>()

    for ( const [ identity, group ] of groupEntriesByIdentity( entries ) ) {
        titles.set( identity, liveTitles.get( identity ) ?? group[ 0 ].frontmatter.title )
    }

    return titles
}

export { findReplacementCandidates }
