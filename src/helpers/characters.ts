import { getListingIdentity } from './listing-identity.ts'
import type { Listing } from './types.ts'

export interface CharacterSnapshot {
    version: 1
    titles: Record<string, {
        fetchedAt: string
        characters: string[]
    }>
}

interface CastRole {
    character?: unknown
    episode_count?: unknown
}

interface CastCredit {
    name?: unknown
    character?: unknown
    order?: unknown
    roles?: unknown
}

interface CreditsResponse {
    cast?: unknown
}

interface CharacterCandidate {
    name: string
    order: number
    episodes: number
}

function normalizedName ( value: string ) {
    return value
        .normalize( 'NFKD' )
        .replace( /[\u0300-\u036f]/g, '' )
        .toLowerCase()
        .replace( /[^a-z0-9]+/g, ' ' )
        .trim()
}

function cleanCharacterName ( value: unknown ) {
    if ( typeof value !== 'string' ) {
        return ''
    }

    const cleaned = value
        .replace( /\s*\((?:voice|uncredited|archive footage|motion capture)\)/gi, '' )
        .replace( /\s+/g, ' ' )
        .trim()

    return cleaned
        .split( /\s*\/\s*/ )
        .filter( alias => !isGenericRole( alias ) )
        .join( ' / ' )
}

function isGenericRole ( name: string ) {
    const normalized = normalizedName( name )

    return /^(?:self|himself|herself|themselves|unknown|uncredited|additional voices?|various(?: voices?| characters?)?)$/.test( normalized )
        || /\b(?:on set|additional voices?|stand in|reader|narrator|attendant|analyst|engineer|dealer|clerk|bodyguard|guard|officer|reporter|driver|villager|extra)\b/.test( normalized )
        || /^(?:man|woman|boy|girl|kid|child|mom|dad)(?:\s|$)/.test( normalized )
        || /\b(?:man|woman|boy|girl|kid|child|mom|dad)\s+(?:in|at|with|on|from)\b/.test( normalized )
        || /^(?:agent|soldier|scientist|doctor|nurse|cop|henchman|thug|prisoner|tourist|customer|worker|technician|dancer|student)(?:\s+\d+)?$/.test( normalized )
        || /\b(?:hydra|shield|security|police|wakandan|asgardian|mutant|kree|air force|military|army|lab)\s+(?:agent|soldier|scientist|doctor|nurse)\b/.test( normalized )
        || /#\s*\d+\s*$/.test( name )
}

function isNamedCharacter ( name: string, actorName: unknown ) {
    if ( !name || name.length > 100 ) {
        return false
    }

    const normalized = normalizedName( name )

    if ( !normalized || normalized === normalizedName( String( actorName || '' ) ) ) {
        return false
    }

    return !isGenericRole( name )
}

function aliases ( name: string ) {
    return name.split( /\s*\/\s*/ ).map( normalizedName ).filter( Boolean )
}

function isSameCharacter ( left: string, right: string ) {
    const rightAliases = new Set( aliases( right ) )
    return aliases( left ).some( alias => rightAliases.has( alias ) )
}

function characterCandidates ( credits: CreditsResponse, mediaType: 'movie' | 'tv' ) {
    if ( !Array.isArray( credits.cast ) ) {
        return []
    }

    const candidates: CharacterCandidate[] = []

    for ( const [ index, rawCredit ] of credits.cast.entries() ) {
        if ( !rawCredit || typeof rawCredit !== 'object' ) {
            continue
        }

        const credit = rawCredit as CastCredit
        const order = typeof credit.order === 'number' ? credit.order : index
        const roles: CastRole[] = mediaType === 'tv' && Array.isArray( credit.roles )
            ? credit.roles
            : [ { character: credit.character } ]

        for ( const role of roles ) {
            const name = cleanCharacterName( role?.character )

            if ( !isNamedCharacter( name, credit.name ) ) {
                continue
            }

            candidates.push( {
                name,
                order,
                episodes: typeof role.episode_count === 'number' ? role.episode_count : 0,
            } )
        }
    }

    return candidates.sort( ( left, right ) => (
        mediaType === 'tv' ? right.episodes - left.episodes || left.order - right.order : left.order - right.order
    ) )
}

export function extractCharacters ( credits: CreditsResponse, mediaType: 'movie' | 'tv' ) {
    const characters: string[] = []

    for ( const candidate of characterCandidates( credits, mediaType ) ) {
        const duplicateIndex = characters.findIndex( character => isSameCharacter( character, candidate.name ) )

        if ( duplicateIndex === -1 ) {
            characters.push( candidate.name )
        }
        else if ( aliases( candidate.name ).length > aliases( characters[ duplicateIndex ] ).length ) {
            characters[ duplicateIndex ] = candidate.name
        }
    }

    return characters
}

export function mergeCharacters ( previous: string[], current: string[] ) {
    const characters = [ ...previous ]

    for ( const name of current ) {
        const duplicateIndex = characters.findIndex( character => isSameCharacter( character, name ) )

        if ( duplicateIndex === -1 ) {
            characters.push( name )
        }
        else if ( aliases( name ).length > aliases( characters[ duplicateIndex ] ).length ) {
            characters[ duplicateIndex ] = name
        }
    }

    return characters
}

export function getCharactersForListing (
    listing: Listing,
    snapshot: CharacterSnapshot,
) {
    const identity = getListingIdentity( {
        id: listing.id,
        type: listing.type,
        media_type: listing.media_type,
        tags: listing.tags,
    } )
    return identity ? snapshot.titles[ identity ]?.characters || [] : []
}
