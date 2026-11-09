// Incremental 404 sweep for listing files that TMDB discovery no longer
// returns. A bounded batch is probed per run, oldest check first, so the whole
// backlog is covered over several runs without a burst of API traffic.

import { getEntryIdentity, type ListingFileEntry } from './listing-identity.ts'

export interface ExistenceRecord {
    checkedAt: string
    gone: boolean
}

export type ExistenceCache = Record<string, ExistenceRecord>

export interface SweepOptions {
    // YYYY-MM-DD
    today: string
    // Probes allowed per run
    limit: number
    // A recorded check younger than this is trusted
    refreshDays: number
}

const DAY_MS = 24 * 60 * 60 * 1_000

function isStale ( record: ExistenceRecord | undefined, options: SweepOptions ): boolean {
    if ( !record ) {
        return true
    }

    const ageMs = Date.parse( options.today ) - Date.parse( record.checkedAt )

    return !Number.isFinite( ageMs ) || ageMs >= options.refreshDays * DAY_MS
}

// Files with any explicit draft are already hidden, so they are never probed.
function isCandidate ( entry: ListingFileEntry, listed: Set<string> ): boolean {
    const identity = getEntryIdentity( entry )

    return identity !== null && !listed.has( identity ) && entry.frontmatter.draft === undefined
}

export function pickIdentitiesToCheck (
    entries: ListingFileEntry[],
    listedIdentities: Set<string>,
    cache: ExistenceCache,
    options: SweepOptions,
): string[] {
    const identities = entries
        .filter( entry => isCandidate( entry, listedIdentities ) )
        .map( entry => getEntryIdentity( entry ) as string )
        .filter( identity => isStale( cache[ identity ], options ) )

    // Never-checked first, then the oldest check
    return [ ...new Set( identities ) ]
        .sort( ( a, b ) => ( cache[ a ]?.checkedAt ?? '' ).localeCompare( cache[ b ]?.checkedAt ?? '' ) )
        .slice( 0, options.limit )
}

export function recordChecks ( cache: ExistenceCache, results: Map<string, boolean>, today: string ): ExistenceCache {
    const next = { ...cache }

    for ( const [ identity, gone ] of results ) {
        next[ identity ] = { checkedAt: today, gone }
    }

    return next
}
