import { getListingIdentity } from './listing-identity.ts'
import type { CharacterSnapshot } from './characters.ts'
import type { Listing } from './types.ts'

export interface CharacterRegistry {
    version: 1
    redirects?: Record<string, string>
    characters: Record<string, {
        name: string
        scopeTitle: string | null
        evidenceUrl: string | null
    }>
    versions: Record<string, {
        characterId: string
        scopeTitle: string | null
        continuity: string | null
    }>
    participations: Array<{
        id: string
        titleId: string
        rawName: string
        characterId: string
        versionId: string
        sourceKind: 'legacy_character_snapshot'
        sourceUrl: string
        verificationUrl?: string
    }>
}

export interface CharacterTimelineIndex {
    entries: Record<string, {
        name: string
        scopeTitle: string | null
        titleIds: string[]
    }>
}

export interface CharacterSelection {
    hasQuery: boolean
    ids: string[]
    invalid: boolean
}

export function extendCharacterRegistry (
    registry: CharacterRegistry,
    snapshot: CharacterSnapshot,
    titleIds: string[],
    createId: () => string,
): CharacterRegistry {
    validateCharacterRegistry( registry, snapshot )

    const next: CharacterRegistry = {
        version: 1,
        ...( registry.redirects ? { redirects: { ...registry.redirects } } : {} ),
        characters: { ...registry.characters },
        versions: { ...registry.versions },
        participations: [ ...registry.participations ],
    }
    const existingRoles = new Set( next.participations.map( item => `${ item.titleId }\0${ item.rawName }` ) )

    for ( const titleId of new Set( titleIds ) ) {
        for ( const rawName of snapshot.titles[ titleId ]?.characters.slice( 0, 10 ) || [] ) {
            const roleKey = `${ titleId }\0${ rawName }`

            if ( existingRoles.has( roleKey ) ) {
                continue
            }

            const characterId = `ch_${ createId() }`
            const versionId = `ver_${ createId() }`
            const participationId = `part_${ createId() }`

            next.characters[ characterId ] = { name: rawName, scopeTitle: titleId, evidenceUrl: null }
            next.versions[ versionId ] = { characterId, scopeTitle: titleId, continuity: null }
            next.participations.push( {
                id: participationId,
                titleId,
                rawName,
                characterId,
                versionId,
                sourceKind: 'legacy_character_snapshot',
                sourceUrl: `https://www.themoviedb.org/${ titleId.replace( ':', '/' ) }/cast`,
            } )
            existingRoles.add( roleKey )
        }
    }

    return next
}

export function validateCharacterRegistry ( registry: CharacterRegistry, snapshot: CharacterSnapshot ) {
    if ( registry.version !== 1 ) {
        throw new Error( 'Unsupported character registry version' )
    }

    const participationIds = new Set<string>()
    const titleRoles = new Set<string>()

    for ( const participation of registry.participations ) {
        const character = registry.characters[ participation.characterId ]
        const version = registry.versions[ participation.versionId ]
        const titleRole = `${ participation.titleId }\0${ participation.rawName }`

        if ( !/^part_[0-9a-f-]{36}$/.test( participation.id ) || participationIds.has( participation.id ) ) {
            throw new Error( `Invalid or duplicate participation ID: ${ participation.id }` )
        }
        if ( titleRoles.has( titleRole ) ) {
            throw new Error( `Duplicate title role: ${ titleRole }` )
        }
        if ( !character || !version || version.characterId !== participation.characterId ) {
            throw new Error( `Broken character reference: ${ participation.id }` )
        }
        if ( ( character.scopeTitle && character.scopeTitle !== participation.titleId )
            || ( version.scopeTitle && version.scopeTitle !== participation.titleId ) ) {
            throw new Error( `Title-scoped identity used elsewhere: ${ participation.id }` )
        }
        if ( !snapshot.titles[ participation.titleId ]?.characters.includes( participation.rawName ) ) {
            throw new Error( `Role absent from character snapshot: ${ participation.id }` )
        }
        if ( participation.sourceKind !== 'legacy_character_snapshot'
            || participation.sourceUrl !== `https://www.themoviedb.org/${ participation.titleId.replace( ':', '/' ) }/cast` ) {
            throw new Error( `Invalid participation source: ${ participation.id }` )
        }
        if ( participation.verificationUrl && !participation.verificationUrl.startsWith( 'https://www.marvel.com/' ) ) {
            throw new Error( `Invalid verification source: ${ participation.id }` )
        }

        participationIds.add( participation.id )
        titleRoles.add( titleRole )
    }

    for ( const [ previousId, canonicalId ] of Object.entries( registry.redirects || {} ) ) {
        if ( !/^(ch|ver)_[0-9a-f-]{36}$/.test( previousId )
            || !( registry.characters[ canonicalId ] || registry.versions[ canonicalId ] )
            || registry.characters[ previousId ]
            || registry.versions[ previousId ]
            || previousId === canonicalId ) {
            throw new Error( `Invalid character redirect: ${ previousId }` )
        }
    }
}

export function buildCharacterTimelineIndex (
    registry: CharacterRegistry,
    snapshot: CharacterSnapshot,
    listings: Listing[],
): CharacterTimelineIndex {
    validateCharacterRegistry( registry, snapshot )

    const availableTitles = new Set( listings.map( listing => getListingIdentity( { ...listing } ) ).filter( Boolean ) )
    const titlesByCharacter = new Map<string, Set<string>>()
    const titlesByVersion = new Map<string, Set<string>>()

    for ( const participation of registry.participations ) {
        if ( !availableTitles.has( participation.titleId ) ) {
            continue
        }

        for ( const [ id, map ] of [ [ participation.characterId, titlesByCharacter ], [ participation.versionId, titlesByVersion ] ] as const ) {
            const titles = map.get( id ) || new Set<string>()
            titles.add( participation.titleId )
            map.set( id, titles )
        }
    }

    const entries: CharacterTimelineIndex['entries'] = {}

    for ( const [ id, titles ] of titlesByCharacter ) {
        const character = registry.characters[ id ]
        entries[ id ] = { name: character.name, scopeTitle: character.scopeTitle, titleIds: [ ...titles ].sort() }
    }
    for ( const [ id, titles ] of titlesByVersion ) {
        const version = registry.versions[ id ]
        const character = registry.characters[ version.characterId ]
        entries[ id ] = { name: character.name, scopeTitle: version.scopeTitle, titleIds: [ ...titles ].sort() }
    }

    for ( const [ previousId, canonicalId ] of Object.entries( registry.redirects || {} ) ) {
        if ( entries[ canonicalId ] ) {
            entries[ previousId ] = entries[ canonicalId ]
        }
    }

    return { entries }
}

export function getCharacterLink (
    titleId: string | null,
    rawName: string,
    registry: CharacterRegistry,
) {
    if ( !titleId ) {
        return null
    }

    const participation = registry.participations.find( item => item.titleId === titleId && item.rawName === rawName )
    return participation ? `/?personagem=${ encodeURIComponent( participation.characterId ) }` : null
}

export function parseCharacterSelection ( search: string, index: CharacterTimelineIndex ): CharacterSelection {
    const params = new URLSearchParams( search )
    const rawIds = params.getAll( 'personagem' )
    const hasQuery = params.has( 'personagem' )
    const ids = [ ...new Set( rawIds ) ]
    const invalid = hasQuery && ( ids.length === 0 || ids.length > 5 || ids.some( id => !index.entries[ id ] ) )

    return { hasQuery, ids: invalid ? [] : ids, invalid }
}

export function filterListingsByCharacters<T extends Listing> (
    listings: T[],
    selection: CharacterSelection,
    index: CharacterTimelineIndex,
) {
    if ( !selection.hasQuery ) {
        return listings
    }
    if ( selection.invalid ) {
        return []
    }

    const matchingTitles = new Set( selection.ids.flatMap( id => index.entries[ id ].titleIds ) )
    const seen = new Set<string>()

    return listings.filter( listing => {
        const titleId = getListingIdentity( { ...( listing.sourceListing || listing ) } )

        if ( !titleId || !matchingTitles.has( titleId ) || seen.has( titleId ) ) {
            return false
        }

        seen.add( titleId )
        return true
    } )
}
