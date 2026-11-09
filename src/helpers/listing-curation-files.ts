// Applies curation decisions to existing listing files. File access is
// injected, matching listing-consolidation.ts, so scripts and tests share it.

import {
    addDraftToMarkdown,
    decideAutoDraft,
    type AutoDraft,
    type Suppression,
} from './listing-curation.ts'
import {
    getEntryIdentity,
    type ListingFileEntry,
} from './listing-identity.ts'
import {
    readListingEntries,
    type FrontmatterCodec,
    type ListingStoreIO,
} from './listing-consolidation.ts'

interface CurationOptions {
    io: ListingStoreIO
    matter: FrontmatterCodec
}

async function draftMatchingEntries (
    { io, matter }: CurationOptions,
    decide: ( entry: ListingFileEntry ) => AutoDraft | null,
): Promise<string[]> {
    const changedPaths: string[] = []

    for ( const entry of await readListingEntries( io, matter ) ) {
        const decision = decide( entry )

        if ( !decision ) {
            continue
        }

        await io.writeText( entry.path, addDraftToMarkdown( await io.readText( entry.path ), decision ) )
        changedPaths.push( entry.path )
    }

    return changedPaths
}

// Owner decisions apply to any file that has no explicit draft yet.
export function applySuppressions ( options: CurationOptions & { suppressions: Suppression[] } ) {
    return draftMatchingEntries( options, entry => decideAutoDraft( {
        frontmatter: entry.frontmatter,
        listing: { ...entry.tmdb, ...entry.frontmatter },
        suppressions: options.suppressions,
        isNew: false,
    } ) )
}

// A confirmed 404 hides the listing but never deletes its file, so a
// temporary TMDB glitch can be undone by the owner with `draft: false`.
export function draftGoneListings ( options: CurationOptions & { goneIdentities: Set<string> } ) {
    return draftMatchingEntries( options, ( entry ) => {
        const identity = getEntryIdentity( entry )
        const isGone = identity !== null && options.goneIdentities.has( identity )

        return isGone && entry.frontmatter.draft === undefined
            ? { draft: true, autoDraft: 'tmdb-404' }
            : null
    } )
}
