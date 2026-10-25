import { describe, expect, it } from 'vitest'
import {
    buildCharacterTimelineIndex,
    filterListingsByCharacters,
    getCharacterLink,
    parseCharacterSelection,
    type CharacterRegistry,
} from '../src/helpers/character-links'
import type { CharacterSnapshot } from '../src/helpers/characters'
import type { Listing } from '../src/helpers/types'
import registryJson from '../src/json/character-links.json'
import snapshotJson from '../src/json/characters.json'

const registry = registryJson as CharacterRegistry
const snapshot = snapshotJson as CharacterSnapshot
const titles = [
    { id: 888, type: 'tv', title: 'Spider-Man', original_language: 'en' },
    { id: 1726, type: 'movie', title: 'Iron Man', original_language: 'en' },
    { id: 10138, type: 'movie', title: 'Iron Man 2', original_language: 'en' },
    { id: 68721, type: 'movie', title: 'Iron Man 3', original_language: 'en' },
    { id: 84958, type: 'tv', title: 'Loki', original_language: 'en' },
] satisfies Listing[]
const index = buildCharacterTimelineIndex( registry, snapshot, titles )

describe( 'character timeline links', () => {
    it( 'links only exact registered roles and keeps distinct universes separate', () => {
        const spider = registry.participations.find( item => item.titleId === 'tv:888' )!
        const link = getCharacterLink( spider.titleId, spider.rawName, registry )
        expect( link ).toBe( `/?personagem=${ spider.characterId }` )
        expect( getCharacterLink( 'movie:1726', spider.rawName, registry ) ).toBeNull()
        expect( getCharacterLink( 'tv:888', 'Unverified character', registry ) ).toBeNull()
        expect( index.entries[ spider.characterId ].titleIds ).toEqual( [ 'tv:888' ] )
    } )

    it( 'includes only explicitly confirmed cross-title participations', () => {
        const tony = registry.participations.find( item => item.titleId === 'movie:1726' && item.rawName.includes( 'Tony Stark' ) )!
        expect( index.entries[ tony.characterId ].titleIds ).toEqual( [ 'movie:10138', 'movie:1726', 'movie:68721' ] )
        const selected = parseCharacterSelection( `?personagem=${ tony.characterId }`, index )
        expect( filterListingsByCharacters( titles, selected, index ).map( title => title.id ) ).toEqual( [ 1726, 10138, 68721 ] )
    } )

    it( 'supports multiple characters, ignores duplicate query values and deduplicates season cards', () => {
        const spider = registry.participations.find( item => item.titleId === 'tv:888' )!
        const tony = registry.participations.find( item => item.titleId === 'movie:1726' && item.rawName.includes( 'Tony Stark' ) )!
        const selected = parseCharacterSelection( `?personagem=${ spider.characterId }&personagem=${ spider.characterId }&personagem=${ tony.characterId }`, index )
        expect( selected.ids ).toHaveLength( 2 )
        const repeated = [ titles[ 0 ], { ...titles[ 0 ], homepageSeasonKey: 'season-2' }, ...titles.slice( 1 ) ]
        expect( filterListingsByCharacters( repeated, selected, index ).map( title => title.id ) ).toEqual( [ 888, 1726, 10138, 68721 ] )
    } )

    it( 'shows no unrelated titles for invalid links and preserves the default timeline', () => {
        const invalid = parseCharacterSelection( '?personagem=unknown', index )
        expect( invalid.invalid ).toBe( true )
        expect( filterListingsByCharacters( titles, invalid, index ) ).toEqual( [] )
        expect( filterListingsByCharacters( titles, parseCharacterSelection( '', index ), index ) ).toBe( titles )
    } )
} )
