import type { Listing } from '~/src/helpers/types.ts'

import {
    FilteredListings,
    isMCU,
    isMcuSheetOrdered,
} from '~/src/helpers/listing-filters.ts'
import { getAllListings } from '~/src/helpers/node/listing-files.ts'
import { applyLogoSuggestions } from '~/src/helpers/logo-suggestions.ts'
import { readLogoSuggestions } from '~/src/helpers/node/logo-suggestions-store.ts'
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

// Suggested logos fill the gaps first, then every series shares its first season logo.
async function withLogos ( listings: Listing[] ): Promise<Listing[]> {
    return inheritFirstSeasonLogos( applyLogoSuggestions( listings, await readLogoSuggestions() ) )
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

    return withLogos( canonicalizeTimelineListings( curatedListings, {
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

    return withLogos( canonicalizeTimelineListings( getRawListings( filteredListings ) ) )
}
