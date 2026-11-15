import fs from 'fs-extra'
import os from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'

import { getUpcomingListings } from '~/src/helpers/node/listing-files.ts'
import { ensureMappedListings } from '~/src/helpers/node/listing.ts'
import {
    makeUpcomingListingsMarkdown,
    updateMarkdownContent,
    updateReadmeListContent,
} from '~/src/helpers/node/readme.ts'

const testMarkdown = `
<!-- start-upcoming-list -->

- 05-2021 - [Old Listing](https://marvelorder.com/) - 🎬 Marvel Studios - [Edit](https://github.com/ThatGuySam/marvelorder/blob/main/src/pages/en/doctor-strange-in-the-multiverse-of-madness-453395.md)
- 06-2021 - [Another Old Listing](https://marvelorder.com/) - 🏰 Disney+ - [Edit](https://github.com/ThatGuySam/marvelorder/blob/main/src/pages/en/ms-marvel-92782.md)

<!-- end-upcoming-list -->
`

test( 'Can generate upcoming Listing Markdown', async () => {
    const upcomingListings = await getUpcomingListings()

    const [ nextUpcomingListing ] = upcomingListings

    // Expect first mark to have a date of this current month or in the future
    expect( Number( nextUpcomingListing.date ) ).toBeGreaterThan( Date.now() )

    // Generate markdown
    const newUpcomingMarkdown = makeUpcomingListingsMarkdown( upcomingListings )

    const newReadmeListContent = updateMarkdownContent( {
        sourceMarkdown: testMarkdown,
        newMarkdown: newUpcomingMarkdown,
        markerString: 'upcoming-list',
    } )

    // Expect markdown to have list markers
    expect( newReadmeListContent ).toContain( '<!-- start-upcoming-list -->' )

    // console.log( 'upcomingMarkdown', upcomingMarkdown )

    // Expect upcomingMarkdown to not contain 'Old Listing'
    expect( newReadmeListContent ).not.toContain( 'Old Listing' )
} )

test( 'Can preserve year-only release precision in upcoming Markdown', () => {
    const [ listing ] = ensureMappedListings( [
        {
            id: 1738010,
            slug: 'ghost-rider',
            title: 'Ghost Rider',
            release_date: '2028',
            tags: [ 'movie' ],
        } as any,
    ] )

    const markdown = makeUpcomingListingsMarkdown( [ listing ] )

    expect( markdown ).toContain( '- 2028 - [Ghost Rider]' )
} )

test( 'Can catch missing start marker', async () => {
    const emptyMarkdown = ''

    expect( () => {
        updateMarkdownContent( {
            sourceMarkdown: emptyMarkdown,
            newMarkdown: 'Test',
            markerString: 'upcoming-list',
        } )
    } ).toThrowError( 'upcoming-list' )
} )

test( 'Skips README lists whose markers were removed', async () => {
    const directory = await fs.mkdtemp( join( os.tmpdir(), 'readme-' ) )
    const readmePath = join( directory, 'README.md' )
    const rebrandedReadme = '# CineArc\n\nNo generated lists here.\n'

    await fs.writeFile( readmePath, rebrandedReadme )

    expect( await updateReadmeListContent( 'Test', 'viewing-order-list', readmePath ) ).toBe( false )
    expect( await fs.readFile( readmePath, 'utf8' ) ).toBe( rebrandedReadme )

    await fs.remove( directory )
} )

test( 'Updates README lists that still have their markers', async () => {
    const directory = await fs.mkdtemp( join( os.tmpdir(), 'readme-' ) )
    const readmePath = join( directory, 'README.md' )

    await fs.writeFile( readmePath, testMarkdown )

    expect( await updateReadmeListContent( 'Fresh', 'upcoming-list', readmePath ) ).toBe( true )
    expect( await fs.readFile( readmePath, 'utf8' ) ).toContain( '<!-- start-upcoming-list -->Fresh<!-- end-upcoming-list -->' )

    await fs.remove( directory )
} )
