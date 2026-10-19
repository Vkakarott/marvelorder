// Media identity rules shared by the Deno pull script and Node tooling.
// Keep this module free of Node or Deno specific imports.

export type ListingFrontmatter = Record<string, unknown>

export interface ListingFileEntry {
    path: string
    frontmatter: ListingFrontmatter
    // Raw "## TMDB Data" section, kept verbatim so merges never reformat it
    tmdbSection: string
    tmdb: Record<string, unknown>
}

export interface IdentityMergePlan {
    identity: string
    keep: ListingFileEntry
    remove: ListingFileEntry[]
    path: string
    frontmatter: ListingFrontmatter
    tmdbSection: string
}

// Fields derived from the title must never leak from an older observation
const titleBoundFields = new Set( [ 'title', 'slug', 'localized_title', 'original_title', 'name' ] )

export function getListingMediaType ( listing: ListingFrontmatter ): string {
    const tags = Array.isArray( listing.tags ) ? listing.tags : []
    const declaredType = listing.type || listing.media_type

    if ( declaredType === 'movie' || declaredType === 'tv' ) {
        return declaredType
    }

    if ( tags.includes( 'movie' ) ) {
        return 'movie'
    }

    return tags.includes( 'tv' ) ? 'tv' : 'unknown'
}

export function getListingIdentity ( listing: ListingFrontmatter ): string | null {
    if ( typeof listing.id !== 'number' ) {
        return null
    }

    return `${ getListingMediaType( listing ) }:${ listing.id }`
}

export function getEntryIdentity ( entry: ListingFileEntry ): string | null {
    return getListingIdentity( { ...entry.tmdb, ...entry.frontmatter } )
}

export function normalizeTitleForIdentity ( title: unknown ): string {
    return String( title || '' )
        .normalize( 'NFKD' )
        .replace( /[̀-ͯ]/g, '' )
        .toLowerCase()
        .replace( /[^a-z0-9]+/g, '-' )
        .replace( /^-|-$/g, '' )
}

export function makeListingFilePath ( directory: string, slug: unknown, id: unknown ): string {
    return `${ directory }/${ String( slug ) }-${ String( id ) }.md`
}

function isEmptyValue ( value: unknown ): boolean {
    return value === undefined || value === null || value === ''
}

function isDraft ( entry: ListingFileEntry ): boolean {
    return entry.frontmatter.draft === true
}

function rankEntry ( entry: ListingFileEntry, liveSlug?: string ): number {
    const visibleScore = isDraft( entry ) ? 0 : 2
    const liveScore = liveSlug && entry.frontmatter.slug === liveSlug ? 1 : 0

    return visibleScore + liveScore
}

// Picks the observation that should own the canonical file.
// Visible files win over drafts, then the slug TMDB currently reports,
// then the order the caller passed (newest observation first).
export function chooseCanonicalEntry ( entries: ListingFileEntry[], liveSlug?: string ): ListingFileEntry {
    if ( entries.length === 0 ) {
        throw new Error( 'chooseCanonicalEntry() requires at least one entry' )
    }

    return entries.reduce( ( best, entry ) => {
        return rankEntry( entry, liveSlug ) > rankEntry( best, liveSlug ) ? entry : best
    } )
}

function canInheritField ( key: string, primary: ListingFrontmatter, other: ListingFrontmatter ): boolean {
    if ( key === 'draft' || key === 'id' || key === 'title' || key === 'slug' ) {
        return false
    }

    if ( !titleBoundFields.has( key ) ) {
        return true
    }

    return normalizeTitleForIdentity( primary.title ) === normalizeTitleForIdentity( other.title )
}

// Fills gaps in the primary frontmatter with values from older observations.
// Identity, draft state and title-bound fields of a different title never leak.
export function mergeListingFrontmatter ( primary: ListingFrontmatter, others: ListingFrontmatter[] ): ListingFrontmatter {
    const merged: ListingFrontmatter = { ...primary }

    for ( const other of others ) {
        for ( const [ key, value ] of Object.entries( other ) ) {
            if ( !canInheritField( key, primary, other ) ) {
                continue
            }

            if ( isEmptyValue( merged[ key ] ) && !isEmptyValue( value ) ) {
                merged[ key ] = value
            }
        }
    }

    return merged
}

export function groupEntriesByIdentity ( entries: ListingFileEntry[] ): Map<string, ListingFileEntry[]> {
    const groups = new Map<string, ListingFileEntry[]>()

    for ( const entry of entries ) {
        const identity = getEntryIdentity( entry )

        if ( !identity ) {
            continue
        }

        groups.set( identity, [ ...( groups.get( identity ) || [] ), entry ] )
    }

    return groups
}

interface MergePlanOptions {
    identity: string
    // Entries ordered newest observation first
    entries: ListingFileEntry[]
    // Entry whose TMDB record and id survive; defaults to the canonical entry
    survivor?: ListingFileEntry
    liveSlug?: string
    directory: string
}

export function planIdentityMerge ( options: MergePlanOptions ): IdentityMergePlan {
    const { identity, entries, liveSlug, directory } = options
    const canonical = chooseCanonicalEntry( entries, liveSlug )
    const survivor = options.survivor || canonical
    const others = entries.filter( entry => entry !== canonical )
    const frontmatter = mergeListingFrontmatter( canonical.frontmatter, others.map( entry => entry.frontmatter ) )

    frontmatter.id = survivor.tmdb.id ?? survivor.frontmatter.id
    if ( typeof frontmatter.id !== 'number' ) {
        throw new TypeError( `Missing numeric id for ${ identity }` )
    }

    const path = makeListingFilePath( directory, frontmatter.slug, frontmatter.id )

    return {
        identity,
        keep: canonical,
        remove: entries.filter( entry => entry.path !== path ),
        path,
        frontmatter,
        tmdbSection: survivor.tmdbSection,
    }
}

export interface ReplacementCandidate {
    gone: string
    live: string
}

// Pairs identities of the same media type that carry the same title.
// Callers must still confirm that the "gone" identity no longer exists upstream.
export function findReplacementCandidates ( titlesByIdentity: Map<string, unknown>, suspects: Set<string> ): ReplacementCandidate[] {
    const candidates: ReplacementCandidate[] = []

    for ( const gone of suspects ) {
        const goneTitle = normalizeTitleForIdentity( titlesByIdentity.get( gone ) )
        const goneType = gone.split( ':' )[ 0 ]

        for ( const [ live, title ] of titlesByIdentity ) {
            const isSameType = live.split( ':' )[ 0 ] === goneType
            if ( live !== gone && isSameType && goneTitle && normalizeTitleForIdentity( title ) === goneTitle ) {
                candidates.push( { gone, live } )
            }
        }
    }

    return candidates
}

function getCompanyTags ( listing: ListingFrontmatter ): string[] {
    const tags = Array.isArray( listing.tags ) ? listing.tags : []

    return tags.filter( ( tag ): tag is string => typeof tag === 'string' && tag.startsWith( 'company-' ) )
}

function getReleaseYear ( listing: ListingFrontmatter ): number | null {
    const date = String( listing.release_date || listing.first_air_date || '' )
    const year = Number( date.slice( 0, 4 ) )

    return date && Number.isFinite( year ) ? year : null
}

// Same-titled remakes and per-season records are common, so a replacement
// must also come from the same studio and, when both are dated, the same year.
export function isCompatibleReplacement ( gone: ListingFrontmatter, live: ListingFrontmatter ): boolean {
    const liveCompanies = new Set( getCompanyTags( live ) )
    const sharesCompany = getCompanyTags( gone ).some( tag => liveCompanies.has( tag ) )
    const goneYear = getReleaseYear( gone )
    const liveYear = getReleaseYear( live )

    if ( !sharesCompany ) {
        return false
    }

    return goneYear === null || liveYear === null || goneYear === liveYear
}
