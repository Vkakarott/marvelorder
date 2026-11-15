import fs from 'fs-extra'
import type { MappedListing } from '~/src/helpers/node/listing.ts'

import type { Listing } from '~/src/helpers/types.ts'

import {
    getInUniverseTimelineAndListings,
} from '~/src/helpers/node/in-universe-timeline.ts'

export function updateMarkdownContent ( options: any = {} ) {
    const {
        sourceMarkdown,
        newMarkdown,
        markerString,
    } = options

    const startMarker = `<!-- start-${ markerString } -->`
    const endMarker = `<!-- end-${ markerString } -->`

    // Throw if start or end marker is not found
    if ( !sourceMarkdown.includes( startMarker ) || !sourceMarkdown.includes( endMarker ) ) {
        throw new Error( `Missing start or end marker for ${ markerString }` )
    }

    const startIndex = sourceMarkdown.indexOf( startMarker ) + startMarker.length
    const endIndex = sourceMarkdown.indexOf( endMarker )

    const newReadmeListContent = [
        sourceMarkdown.slice( 0, startIndex ),
        newMarkdown,
        sourceMarkdown.slice( endIndex ),
    ].join( '' )

    return newReadmeListContent
}

export function makeUpcomingListingsMarkdown ( upcomingListings: MappedListing[] ) {
    const markdownLines = upcomingListings.map( ( mappedListing ) => {
        // console.log( 'mappedListing.date', mappedListing.date )

        const dateString = mappedListing.dateString
        let displayDate = dateString

        if ( /^\d{4}-\d{2}-\d{2}$/.test( dateString ) ) {
            displayDate = mappedListing.date.toJSDate().toLocaleDateString( 'en-US', { month: 'long', day: 'numeric', year: 'numeric' } )
        }
        else if ( /^\d{4}-\d{2}$/.test( dateString ) ) {
            displayDate = mappedListing.date.toJSDate().toLocaleDateString( 'en-US', { month: 'long', year: 'numeric' } )
        }

        const lineParts = [
            '',
            displayDate,
            `[${ mappedListing.title }](https://marvelorder.com${ mappedListing.endpoint })`,
            // typesReadmeMap[ timelineType ],
            `[Edit](${ mappedListing.githubEditUrl })`,
        ]

        return lineParts.join( ' - ' ).trim()
    } )

    return `\n\n${ markdownLines.join( '\n' ) }\n\n`
}

function hasListMarkers ( sourceMarkdown: string, markerString: string ): boolean {
    return sourceMarkdown.includes( `<!-- start-${ markerString } -->` )
        && sourceMarkdown.includes( `<!-- end-${ markerString } -->` )
}

// Returns false, leaving the README untouched, when it no longer carries the
// list markers (e.g. a rebranded README), so syncing never fails on it.
export async function updateReadmeListContent (
    newListMarkdown: string,
    markerString: string,
    readmePath = './README.md',
): Promise<boolean> {
    const readmeContent = await fs.readFile( readmePath, 'utf8' )

    if ( !hasListMarkers( readmeContent, markerString ) ) {
        console.warn( `README has no ${ markerString } markers, skipping that list.` )

        return false
    }

    const newReadmeListContent = updateMarkdownContent( {
        sourceMarkdown: readmeContent,
        newMarkdown: newListMarkdown,
        markerString,
    } )

    await fs.writeFile( readmePath, newReadmeListContent )

    return true
}

const inUniverseTypeMap = {
    'series': '📺 Series',
    'movie': '🎬 Movie',
    'short-form': '▶️ Short',
}

export async function makeInUniverseMarkdown () {
    const timeline = await getInUniverseTimelineAndListings()

    // console.log( 'timeline', timeline[0] )

    const markdownLines = timeline.map( ( timelineEntry: any, index: number ) => {
        const {
            inUniverseEntry = null as any,
            mappedListing = null as Listing,
        } = timelineEntry

        // console.log( 'inUniverseEntry', inUniverseEntry )

        const lineParts = [
            '',
            `<kbd>${ index + 1 }</kbd>`,
            // mappedListing.date.toLocaleString({ month: 'long', day: 'numeric', year: 'numeric' }),
            `[${ mappedListing.title }](https://marvelorder.com${ mappedListing.endpoint })`,
            inUniverseTypeMap[ inUniverseEntry.type ] || '⁇',
            `[Edit](${ mappedListing.githubEditUrl })`,
        ]

        return lineParts.join( ' - ' ).trim()
    } )

    return `\n\n${ markdownLines.join( '\n' ) }\n\n`
}
