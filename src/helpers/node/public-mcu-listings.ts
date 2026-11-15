import type { Listing } from '~/src/helpers/types.ts'

import {
    FilteredListings,
    isMCU,
    isMcuSheetOrdered,
} from '~/src/helpers/listing-filters.ts'
import { getAllListings } from '~/src/helpers/node/listing-files.ts'
import { curateReleaseListings } from '~/src/helpers/node/release-curation.ts'
import { inheritFirstSeasonLogos } from '~/src/helpers/node/series-logos.ts'
import {
    canonicalizeTimelineListings,
    isFanEditListing,
} from '~/src/helpers/node/timeline-matcher.ts'
import { readGoneListingChecker } from '~/src/helpers/node/tmdb-existence.ts'

function getRawListings ( filteredListings: FilteredListings ): Listing[] {
    return filteredListings.list
        .map( listing => listing.sourceListing )
        .filter( listing => !isFanEditListing( listing ) )
}

export async function getPublicMcuReleaseListings () {
    const allListings = await getAllListings()

    const filteredListings = new FilteredListings( {
        listings: allListings,
        initialFilters: new Map( [
            [ isMCU, true ],
        ] ),
        listingsSort: 'default',
    } )

    const curatedListings = curateReleaseListings( getRawListings( filteredListings ), {
        isGone: await readGoneListingChecker(),
        today: new Date(),
    } )

    return inheritFirstSeasonLogos( canonicalizeTimelineListings( curatedListings, {
        collapseUndatedTitles: true,
        sortByReleaseDate: true,
    } ) )
}

export async function getPublicMcuTimelineListings () {
    const allListings = await getAllListings()

    const filteredListings = new FilteredListings( {
        listings: allListings,
        initialFilters: new Map( [
            [ isMcuSheetOrdered, true ],
        ] ),
        listingsSort: 'none',
    } )

    return inheritFirstSeasonLogos( canonicalizeTimelineListings( getRawListings( filteredListings ) ) )
}
