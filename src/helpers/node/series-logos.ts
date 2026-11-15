import type { Listing } from '~/src/helpers/types.ts'

import { getDateString } from '~/src/helpers/listing.ts'
import { normalizeTitleForTimelineMatch } from '~/src/helpers/node/timeline-matcher.ts'

export function isSeries ( listing: Listing ): boolean {
    return listing.type === 'tv' || listing.media_type === 'tv' || Boolean( listing.tags?.includes( 'tv' ) )
}

function compareByDateUndatedLast ( listingA: Listing, listingB: Listing ): number {
    const dateA = getDateString( listingA )
    const dateB = getDateString( listingB )

    if ( dateA.length === 0 || dateB.length === 0 ) {
        return Number( dateA.length === 0 ) - Number( dateB.length === 0 )
    }

    return dateA.localeCompare( dateB )
}

function mapFirstSeasonsByTitle ( listings: Listing[] ): Map<string, Listing> {
    const firstSeasons = new Map<string, Listing>()

    for ( const listing of listings.filter( isSeries ).sort( compareByDateUndatedLast ) ) {
        const titleKey = normalizeTitleForTimelineMatch( listing.title || '' )

        if ( titleKey.length > 0 && !firstSeasons.has( titleKey ) ) {
            firstSeasons.set( titleKey, listing )
        }
    }

    return firstSeasons
}

// A series keeps one logo across seasons: the earliest season's logo wins.
export function inheritFirstSeasonLogos ( listings: Listing[] ): Listing[] {
    const firstSeasons = mapFirstSeasonsByTitle( listings )

    return listings.map( ( listing ) => {
        const firstSeasonLogo = firstSeasons.get( normalizeTitleForTimelineMatch( listing.title || '' ) )?.logo_on_black

        if ( !isSeries( listing ) || !firstSeasonLogo || firstSeasonLogo === listing.logo_on_black ) {
            return listing
        }

        return { ...listing, logo_on_black: firstSeasonLogo }
    } )
}
