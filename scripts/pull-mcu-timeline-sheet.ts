import fs from 'fs-extra'
import 'dotenv/config'
import axios from 'axios'

import type { MCUTimelineSheetRecord } from '~/src/helpers/types'

import { storePath } from '~/src/config.ts'

import {
    matchOrderedEntryToSavedListing,
    organizeOrderData,
    parseSheetRecords,
    type SheetRecordsResult,
} from '~/src/helpers/node/mcu-timeline-sheet.ts'
import {
    makeInUniverseMarkdown,
    makeUpcomingListingsMarkdown,
    updateReadmeListContent,
} from '~/src/helpers/node/readme.ts'

import { upsertListingMarkdown } from '~/src/helpers/markdown-page.ts'

import {
    getListingDetailsFromPaths,
    getListingFiles,
    getListingFromFile,
    getUpcomingListings,
    writeMarkdownFileNode,
} from '~/src/helpers/node/listing-files.ts'
import {
    FilteredListings,
} from '~/src/helpers/listing-filters'

import {
    ensureFiltersHaveStories,
} from '~/src/helpers/node/markdown-files.ts'

import { saveMoviesFandomTimeline } from '~/src/helpers/node/movies-fandom-timeline.ts'

const macroUrl = 'https://script.google.com/macros/s/AKfycbzGvKKUIaqsMuCj7-A2YRhR-f7GZjl4kSxSN1YyLkS01_CfiyE/exec'
const mcuTimelineSheetId = '1Xfe--9Wshbb3ru0JplA2PnEwN7mVawazKmhWJjr_wKs'

async function readMarkdownFileNode ( filePath: string ) {
    // const markdownContent = await fs.readFile( filePath, 'utf8' )

    return await getListingFromFile( filePath )
}

const typesReadmeMap = {
    'movie': '🎬 Marvel Studios',
    'abc': '⚫️ ABC',
    'freeform': '🔵 Freeform',
    'sony': '🕷 Sony',
    'disney-plus-netflix': '🟥 Netflix',
    'disney-plus': '🏰 Disney+',
    'hulu': '🟩 Hulu',
}

function buildReadmeList ( matchesMap: Map<number, any> ) {
    const matches = Array.from( matchesMap.values() )

    const readmeListLines = matches.map( ( match: any, index ) => {
        const { listing, timelineType } = match
        const parts = [
            '',
            `<kbd>${ index + 1 }</kbd>`,
            `[${ listing.title }](https://marvelorder.com${ listing.endpoint })`,
            typesReadmeMap[ timelineType ],
            `[Edit](${ listing.githubEditUrl })`,
        ]

        return parts.join( ' - ' ).trim()
    } )

    return `\n\n${ readmeListLines.join( '\n' ) }\n\n`
}

async function fetchSheetRecords (): Promise<SheetRecordsResult> {
    try {
        const response = await axios( macroUrl, {
            params: {
                id: mcuTimelineSheetId,
                sheet: 'Chronological Order',
                header: 1,
                startRow: 4,
            },
        } )

        return parseSheetRecords( response.data )
    }
    catch ( error ) {
        return { ok: false, reason: `request failed: ${ ( error as Error ).message }` }
    }
}

( async () => {
    const listingFiles = await getListingFiles()

    // console.log( 'listingFiles', listingFiles )

    const listingsDetails = await getListingDetailsFromPaths( listingFiles )
    const listingDetailsMap = new Map( listingsDetails.map( ( details: any ) => [ details.listing.id, details ] ) )
    const allListings = listingsDetails.map( ( details: any ) => details.listing )

    const orderableListings = new FilteredListings( {
        listings: allListings,
        // initialFilters: new Map([
        //     [ isUpcoming, false ]
        // ])
        listingsSort: 'default',
    } )

    const fetchedSheet = await fetchSheetRecords()

    if ( !fetchedSheet.ok ) {
        // Keep the checked-in sheet and every mcuTimelineOrder untouched so
        // the workflow can continue to the TMDB pull (ADR-001)
        console.warn( `MCU timeline sheet skipped, keeping existing data: ${ fetchedSheet.reason }` )

        process.exit( 0 )
    }

    const sheetJsonPath = `${ storePath }/mcu-timeline-sheet.json`

    // Read existing data
    const existingSheet = await fs.readJson( sheetJsonPath )

    const recordsByTitle: Map<MCUTimelineSheetRecord['TITLE'], MCUTimelineSheetRecord> = new Map( existingSheet.records.map( ( record: MCUTimelineSheetRecord ) => [ record.TITLE, record ] ) )

    // We want to keep existing types if they are just '{}'
    const mergedRecords: MCUTimelineSheetRecord[] = fetchedSheet.records.map( ( newRecord: MCUTimelineSheetRecord ) => {
        // Check if the new record has '{}' as the type
        const hasEmptyType = typeof newRecord.TYPE !== 'string'

        const existingRecord = recordsByTitle.get( newRecord.TITLE )

        // If it does have an empty type, and there is an existing record, use the existing record's type
        if ( hasEmptyType && existingRecord ) {
            return {
                ...newRecord,
                TYPE: existingRecord.TYPE || JSON.stringify( existingRecord.TYPE ),
            }
        }

        return newRecord
    } )

    const mergedSheet = { records: mergedRecords }

    // Write data to JSON
    await fs.writeFile( `${ storePath }/mcu-timeline-sheet.json`, JSON.stringify( mergedSheet, null, 2 ) )

    const orderedDetails = organizeOrderData( mergedSheet.records )

    const matches = new Map()

    // console.log('orderedDetails', orderedDetails)

    const matchableOrderedTypes = new Set( [
        'movie',
        'disney-plus',
        'disney-plus-netflix',
        'abc',
        'freeform',
        'hulu',
        'web-series',
        'sony',

        // 'whih',
        // 'other'
    ] )

    for ( const entry of Object.entries( orderedDetails ) ) {
        const [
            ,
            orderedDetails = null as any,
        ] = entry

        // console.log('orderedDetails.timelineType', orderedDetails.timelineType)

        // Skip entries not from matchable types
        if ( !matchableOrderedTypes.has( orderedDetails.timelineType ) ) {
            continue
        }

        const unmatchedListings = orderableListings.list.filter( listing => !matches.has( listing.id ) )
        const matchingListing = matchOrderedEntryToSavedListing( orderedDetails, unmatchedListings )

        if ( !matchingListing ) {
            continue
        }

        const details: any = listingDetailsMap.get( matchingListing.id )

        matches.set( details.listing.id, {
            ...orderedDetails,
            listing: matchingListing,
        } )

        await upsertListingMarkdown( {
            listing: {
                id: details.listing.id,
                slug: matchingListing.slug,
                overview: matchingListing.sourceListing.overview,
                title: matchingListing.title,

                mcuTimelineOrder: orderedDetails.mcuTimelineOrder,
            },
            tmdb: {},
            readMarkdownFile: readMarkdownFileNode,
            writeMarkdownFile: writeMarkdownFileNode,
            exists: fs.exists,
        } )
    }

    console.log( 'Updating README viewing-order-list' )

    const updatedList = buildReadmeList( matches )

    // // console.log( 'updatedList', updatedList )

    await updateReadmeListContent( updatedList, 'viewing-order-list' )

    console.log( 'Done' )

    console.log( 'Updating README in-universe-list' )

    const inUniverseList = await makeInUniverseMarkdown()

    // console.log( 'updatedList', updatedList )

    await updateReadmeListContent( inUniverseList, 'in-universe-list' )

    console.log( 'Done' )

    console.log( 'Updating README upcoming-list' )

    const upcomingListings = await getUpcomingListings()

    // Generate markdown
    const newUpcomingMarkdown = makeUpcomingListingsMarkdown( upcomingListings )

    await updateReadmeListContent( newUpcomingMarkdown, 'upcoming-list' )

    console.log( 'Done' )

    console.log( 'Saving Marvel Movies Fandom Timeline' )

    try {
        await saveMoviesFandomTimeline()

        console.log( 'Done' )
    }
    catch ( error ) {
        console.log( 'Error', error )
    }

    console.log( 'Adding any new filters as stories' )

    await ensureFiltersHaveStories()

    console.log( 'Done' )

    console.log( 'Finished All README Updates' )

    process.exit()
} )()
