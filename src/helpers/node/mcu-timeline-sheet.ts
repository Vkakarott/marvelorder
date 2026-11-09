import { deepmerge } from 'deepmerge-ts'

import type { MCUTimelineSheetRecord } from '~/src/helpers/types'
import {
    makeSlug,
} from '~/src/helpers/node/listing.ts'
import {
    findBestTimelineListingMatch,
    getExpectedMediaTypeFromOrderedEntry,
    matchesTimelineListing,
} from '~/src/helpers/node/timeline-matcher.ts'

function parseOrderedTitle ( rawTitle: string ) {
    const [
        listingTitle,
        seasonParts = '',
    ] = rawTitle.split( ' Season ' )

    const [
        seasonNumber = '',
        episodeParts = '',
    ] = seasonParts.split( ' Episode ' )

    const [
        episodeNumber = '',
        episodeTitle = '',
    ] = episodeParts.split( ': ' )

    return {
        listingTitle,
        seasonNumber,
        episodeNumber,
        episodeTitle,
    }
}

export function matchListingToOrdered ( listing, orderedEntry ) {
    return matchesTimelineListing( listing, {
        title: orderedEntry.title,
        date: orderedEntry.premiereDate,
        expectedMediaType: getExpectedMediaTypeFromOrderedEntry( orderedEntry ),
    } )
}

export function matchOrderedEntryToSavedListing ( orderedEntry, savedListings ) {
    return findBestTimelineListingMatch( savedListings, {
        title: orderedEntry.title,
        date: orderedEntry.premiereDate,
        expectedMediaType: getExpectedMediaTypeFromOrderedEntry( orderedEntry ),
    } )
}

export function organizeOrderData ( rawOrderData: MCUTimelineSheetRecord[] ) {
    const organizedOrder = {}

    for ( const [ mcuTimelineOrder, entry ] of rawOrderData.entries() ) {
        const {
            TITLE,
            RELEASE_DATE,
            // NOTES
        } = entry

        const {
            listingTitle,
            seasonNumber,
            episodeNumber,
            episodeTitle,
        } = parseOrderedTitle( TITLE )

        const existingData = organizedOrder[ listingTitle ] || {}

        const entryData: any = {
            title: listingTitle,
        }

        // If we don't have a premiere date
        // set the first date as premiere date
        if ( !existingData?.premiereDate ) {
            entryData.mcuTimelineOrder = mcuTimelineOrder
            entryData.premiereDate = RELEASE_DATE
            entryData.timelineType = typeof entry.TYPE === 'string' ? makeSlug( entry.TYPE ) : makeSlug( JSON.stringify( entry.TYPE ) )
        }

        if ( seasonNumber.length > 0 ) {
            const existingEpisodeCount = existingData.seasons?.[ seasonNumber ]?.episodeCount || 0

            entryData.seasons = {
                [ seasonNumber ]: {
                    episodeCount: existingEpisodeCount + 1,
                    episodes: {
                        [ episodeNumber ]: {
                            title: episodeTitle,
                            premiereDate: RELEASE_DATE,
                            mcuTimelineOrder,
                        },
                    },
                },
            }

            // If this is episode 1, add it's date as the season's release date
            if ( episodeNumber === '1' ) {
                entryData.seasons[ seasonNumber ].mcuTimelineOrder = mcuTimelineOrder
                entryData.seasons[ seasonNumber ].premiereDate = RELEASE_DATE
            }
        }

        // Merge new data with existing data
        organizedOrder[ listingTitle ] = deepmerge( existingData, entryData )
    }

    return organizedOrder
}

// Notes only matter below the details rows at the top of the sheet
const DETAILS_ROWS_COUNT = 30

function cleanSheetRecord ( record: MCUTimelineSheetRecord, recordIndex: number ) {
    const cleanedEntries = Object.entries( record )
        .filter( ( [ key ] ) => key.length > 0 )
        .map( ( [ key, value ] ) => {
            const isNotes = key.toLowerCase() === 'notes'
            const isBelowDetailsRows = recordIndex > DETAILS_ROWS_COUNT

            return [ key, isNotes && !isBelowDetailsRows ? '' : value ]
        } )

    return Object.fromEntries( cleanedEntries ) as unknown as MCUTimelineSheetRecord
}

// Apps Script reports failures as an HTML page; surface its visible message.
export function summarizeTextBody ( body: string, maxLength = 160 ): string {
    const visibleText = body
        .replace( /<(script|style)[\s\S]*?<\/\1>/gi, ' ' )
        .replace( /<[^>]+>/g, ' ' )
        .replace( /\s+/g, ' ' )
        .trim()

    return visibleText.slice( 0, maxLength ) || 'empty body'
}

export type SheetRecordsResult =
    | { ok: true, records: MCUTimelineSheetRecord[] }
    | { ok: false, reason: string }

// An invalid upstream payload must never replace the last known good sheet
export function parseSheetRecords ( data: unknown ): SheetRecordsResult {
    if ( typeof data === 'string' ) {
        return { ok: false, reason: `response is text instead of JSON: "${ summarizeTextBody( data ) }"` }
    }

    if ( data === null || typeof data !== 'object' ) {
        return { ok: false, reason: `response body is ${ data === null ? 'null' : typeof data }, expected an object` }
    }

    const { records } = data as { records?: unknown }

    if ( !Array.isArray( records ) ) {
        return { ok: false, reason: `"records" is ${ records === undefined ? 'missing' : typeof records }, expected an array` }
    }

    const validRecords = records.filter( ( record ) => record !== null && typeof record === 'object' )

    if ( validRecords.length === 0 ) {
        return { ok: false, reason: '"records" has no usable rows' }
    }

    return { ok: true, records: validRecords.map( cleanSheetRecord ) }
}
