import type { Listing, MCUTimelineSheetRecord } from '~/src/helpers/types.ts'

import { matchOrderedEntryToSavedListing, organizeOrderData } from '~/src/helpers/node/mcu-timeline-sheet.ts'

export interface TimelineOrderUpdate {
    listing: Listing
    order: number
}

export interface TimelineOrderMatch {
    listing: Listing
    // The organized sheet entry, with its index and timeline type
    entry: any
}

export interface TimelineOrderPlan {
    // Every sheet entry that found a listing, in sheet order
    matches: TimelineOrderMatch[]
    updates: TimelineOrderUpdate[]
    // Listings still carrying an index from an older sheet that no row matches now
    clears: Listing[]
    unchanged: number
}

export const matchableOrderedTypes = new Set( [
    'movie',
    'disney-plus',
    'disney-plus-netflix',
    'abc',
    'freeform',
    'hulu',
    'web-series',
    'sony',
] )

const minClearsAllowed = 5
const maxClearRatio = 0.15

const hasOrder = ( listing: Listing ) => typeof listing.mcuTimelineOrder === 'number'

function matchEntries ( records: MCUTimelineSheetRecord[], listings: Listing[] ): Map<Listing, any> {
    const matches = new Map<Listing, any>()

    for ( const entry of Object.values<any>( organizeOrderData( records ) ) ) {
        if ( !matchableOrderedTypes.has( entry.timelineType ) ) {
            continue
        }

        const listing = matchOrderedEntryToSavedListing( entry, listings.filter( candidate => !matches.has( candidate ) ) )

        if ( listing ) {
            matches.set( listing, entry )
        }
    }

    return matches
}

// Every ordered listing ends up numbered by this sheet or not numbered at all,
// so old and new indexes can never share one timeline.
export function planTimelineOrderSync ( records: MCUTimelineSheetRecord[], listings: Listing[] ): TimelineOrderPlan {
    const matches = matchEntries( records, listings )
    const updates = [ ...matches ]
        .filter( ( [ listing, entry ] ) => listing.mcuTimelineOrder !== entry.mcuTimelineOrder )
        .map( ( [ listing, entry ] ) => ( { listing, order: entry.mcuTimelineOrder as number } ) )

    return {
        matches: [ ...matches ].map( ( [ listing, entry ] ) => ( { listing, entry } ) ),
        updates,
        clears: listings.filter( listing => hasOrder( listing ) && !matches.has( listing ) ),
        unchanged: matches.size - updates.length,
    }
}

// A sheet that stops matching most of the timeline is more likely a matcher or
// sheet fault than a real change, so nothing is written (ADR-001).
export function checkPlanBudget ( plan: TimelineOrderPlan, listings: Listing[] ): { ok: true } | { ok: false, reason: string } {
    const maxClears = Math.max( minClearsAllowed, Math.floor( listings.filter( hasOrder ).length * maxClearRatio ) )

    if ( plan.clears.length <= maxClears ) {
        return { ok: true }
    }

    return { ok: false, reason: `${ plan.clears.length } ordered listings would lose their index, more than the ${ maxClears } allowed` }
}

const orderLinePattern = /^mcuTimelineOrder:.*\n/m

function getNextFrontmatter ( frontmatter: string, orderLine: string ): string {
    if ( orderLine.length === 0 ) {
        return frontmatter.replace( orderLinePattern, '' )
    }

    return orderLinePattern.test( frontmatter ) ? frontmatter.replace( orderLinePattern, orderLine ) : `${ frontmatter }${ orderLine }`
}

// Edits only the frontmatter block, leaving the rest of the file byte for byte.
export function setFrontmatterTimelineOrder ( markdown: string, order: number | null ): string {
    const closingIndex = markdown.indexOf( '\n---', 4 )

    if ( !markdown.startsWith( '---\n' ) || closingIndex === -1 ) {
        return markdown
    }

    const frontmatter = `${ markdown.slice( 4, closingIndex ) }\n`
    const orderLine = `mcuTimelineOrder: ${ order }\n`
    const nextFrontmatter = getNextFrontmatter( frontmatter, order === null ? '' : orderLine )

    return `---\n${ nextFrontmatter.slice( 0, -1 ) }${ markdown.slice( closingIndex ) }`
}
