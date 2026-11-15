import type { Listing } from '~/src/helpers/types.ts'

import { getDateString } from '~/src/helpers/listing.ts'
import { isHomepageVariantEditionObservation } from '~/src/helpers/node/homepage-listings.ts'
import { isSeries } from '~/src/helpers/node/series-logos.ts'
import {
    mergeCanonicalListingGroup,
    normalizeTitleForTimelineMatch,
} from '~/src/helpers/node/timeline-matcher.ts'
import type { IsGoneListing } from '~/src/helpers/node/tmdb-existence.ts'

export interface CurationOptions {
    isGone: IsGoneListing
    today: Date
}

function getSynopsis ( listing: Listing ): string {
    return String( listing.description || listing.overview || '' ).trim()
}

function isReleased ( listing: Listing, today: Date ): boolean {
    const releaseTime = Date.parse( getDateString( listing ) )

    return Number.isFinite( releaseTime ) && releaseTime <= today.getTime()
}

// TMDB deleted it, it already came out and nothing curated remains to show.
function isEmptyReleasedStub ( listing: Listing, { isGone, today }: CurationOptions ): boolean {
    return isGone( listing )
        && isReleased( listing, today )
        && getSynopsis( listing ).length === 0
        && !listing.logo_on_black
}

function compareBySynopsisLength ( listingA: Listing, listingB: Listing ): number {
    return getSynopsis( listingB ).length - getSynopsis( listingA ).length
}

// Two movies released the same day that share one curated logo are the same item.
function dropSameLogoDuplicates ( listings: Listing[] ): Listing[] {
    const groups = new Map<string, Listing[]>()

    for ( const listing of listings ) {
        const date = getDateString( listing )
        const key = listing.logo_on_black && date && !isSeries( listing )
            ? `${ date }|${ listing.logo_on_black }`
            : `listing:${ listing.id }`

        groups.set( key, [ ...( groups.get( key ) || [] ), listing ] )
    }

    return Array.from( groups.values(), group => [ ...group ].sort( compareBySynopsisLength )[ 0 ] )
}

function getMovieTitleKey ( listing: Listing ): string {
    return isSeries( listing ) ? '' : normalizeTitleForTimelineMatch( listing.title || '' )
}

// An undated movie with the same title as a dated one is the same announcement.
function mergeUndatedIntoDatedTitles ( listings: Listing[] ): Listing[] {
    const datedKeys = new Set( listings.filter( listing => getDateString( listing ) ).map( getMovieTitleKey ) )
    const groups = new Map<string, Listing[]>()

    for ( const listing of listings ) {
        const titleKey = getMovieTitleKey( listing )
        const isMergeable = titleKey.length > 0 && datedKeys.has( titleKey )
        const key = isMergeable ? `title:${ titleKey }` : `listing:${ listing.id }`

        groups.set( key, [ ...( groups.get( key ) || [] ), listing ] )
    }

    return Array.from( groups.values(), group => mergeCanonicalListingGroup( group, { preferLatestDate: true } ) )
}

// Variants, empty leftovers and duplicates stay out of the release list.
export function curateReleaseListings ( listings: Listing[], options: CurationOptions ): Listing[] {
    const kept = listings.filter( listing => !isHomepageVariantEditionObservation( listing )
        && !isEmptyReleasedStub( listing, options ) )

    return mergeUndatedIntoDatedTitles( dropSameLogoDuplicates( kept ) )
}
