import { describe, expect, it } from 'vitest'
import {
    buildCharacterTimelineIndex,
    extendCharacterRegistry,
    filterListingsByCharacters,
    getCharacterLink,
    parseCharacterSelection,
    type CharacterRegistry,
} from '../src/helpers/character-links'
import type { CharacterSnapshot } from '../src/helpers/characters'
import type { Listing } from '../src/helpers/types'
import registryJson from '../src/json/character-links.json'
import snapshotJson from '../src/json/characters.json'
import { getHomepageListings } from '../src/helpers/node/homepage-listings'
import { getListingIdentity } from '../src/helpers/listing-identity'

const registry = registryJson as CharacterRegistry
const snapshot = snapshotJson as CharacterSnapshot
const titles = [
    { id: 888, type: 'tv', title: 'Spider-Man', original_language: 'en' },
    { id: 1726, type: 'movie', title: 'Iron Man', original_language: 'en' },
    { id: 10138, type: 'movie', title: 'Iron Man 2', original_language: 'en' },
    { id: 68721, type: 'movie', title: 'Iron Man 3', original_language: 'en' },
    { id: 84958, type: 'tv', title: 'Loki', original_language: 'en' },
    { id: 24428, type: 'movie', title: 'The Avengers', original_language: 'en' },
    { id: 99861, type: 'movie', title: 'Avengers: Age of Ultron', original_language: 'en' },
    { id: 299536, type: 'movie', title: 'Avengers: Infinity War', original_language: 'en' },
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
        expect( index.entries[ tony.characterId ].titleIds ).toEqual( [ 'movie:10138', 'movie:1726', 'movie:24428', 'movie:299536', 'movie:68721', 'movie:99861' ] )
        const selected = parseCharacterSelection( `?personagem=${ tony.characterId }`, index )
        expect( filterListingsByCharacters( titles, selected, index ).map( title => title.id ) ).toEqual( [ 1726, 10138, 68721, 24428, 99861, 299536 ] )
        expect( getCharacterLink( 'movie:24428', 'Tony Stark / Iron Man', registry ) ).toBe( `/?personagem=${ tony.characterId }` )
    } )

    it( 'shows the same verified MCU Thor titles from Thor and Ragnarok', async () => {
        const homepage = await getHomepageListings()
        const homepageIndex = buildCharacterTimelineIndex( registry, snapshot, homepage )
        const expected = [ 10195, 76338, 284053, 616037, 24428, 99861, 299536, 299534, 284052 ]
        const links = [ 'movie:10195', 'movie:284053', 'movie:616037' ].map( titleId => getCharacterLink( titleId, 'Thor', registry ) )

        expect( new Set( links ).size ).toBe( 1 )
        expect( links[ 0 ] ).toMatch( /^\/\?personagem=ch_/ )

        for ( const link of links ) {
            const selected = parseCharacterSelection( new URL( link!, 'https://example.com' ).search, homepageIndex )
            const actual = filterListingsByCharacters( homepage, selected, homepageIndex ).map( title => title.id )
            expect( actual.sort( ( a, b ) => a - b ) ).toEqual( [ ...expected ].sort( ( a, b ) => a - b ) )
        }

        const oldRagnarokId = 'ch_33c3d57e-19a9-422c-8a6d-3ece1934eb2b'
        expect( homepageIndex.entries[ oldRagnarokId ].titleIds ).toEqual( homepageIndex.entries[ new URL( links[ 0 ]!, 'https://example.com' ).searchParams.get( 'personagem' )! ].titleIds )
        expect( getCharacterLink( 'movie:616037', 'Jane Foster / The Mighty Thor', registry ) ).not.toBe( links[ 0 ] )
        expect( getCharacterLink( 'movie:284053', 'Actor Thor', registry ) ).not.toBe( links[ 0 ] )
        expect( getCharacterLink( 'movie:26881', 'Thor', registry ) ).not.toBe( links[ 0 ] )
        expect( getCharacterLink( 'tv:91363', 'Thor', registry ) ).not.toBe( links[ 0 ] )
    } )

    it( 'supports multiple characters, ignores duplicate query values and deduplicates season cards', () => {
        const spider = registry.participations.find( item => item.titleId === 'tv:888' )!
        const tony = registry.participations.find( item => item.titleId === 'movie:1726' && item.rawName.includes( 'Tony Stark' ) )!
        const selected = parseCharacterSelection( `?personagem=${ spider.characterId }&personagem=${ spider.characterId }&personagem=${ tony.characterId }`, index )
        expect( selected.ids ).toHaveLength( 2 )
        const repeated = [ titles[ 0 ], { ...titles[ 0 ], homepageSeasonKey: 'season-2' }, ...titles.slice( 1 ) ]
        expect( filterListingsByCharacters( repeated, selected, index ).map( title => title.id ) ).toEqual( [ 888, 1726, 10138, 68721, 24428, 99861, 299536 ] )
    } )

    it( 'covers every visible character on homepage titles without inventing cross-title identity', async () => {
        const homepage = await getHomepageListings()
        const titleIds = [ ...new Set( homepage.map( listing => getListingIdentity( { ...listing } ) ).filter( ( id ): id is string => Boolean( id ) ) ) ]
        const unchanged = extendCharacterRegistry( registry, snapshot, titleIds, () => { throw new Error( 'Generated ID for an existing role' ) } )
        expect( unchanged.participations ).toHaveLength( registry.participations.length )

        for ( const titleId of titleIds ) {
            for ( const rawName of snapshot.titles[ titleId ]?.characters.slice( 0, 10 ) || [] ) {
                expect( getCharacterLink( titleId, rawName, registry ) ).toMatch( /^\/\?personagem=ch_/ )
            }
        }

        const spider1994 = registry.participations.find( item => item.titleId === 'tv:888' && item.rawName === 'Peter Parker / Spider-Man' )!
        const spider2002 = registry.participations.find( item => item.titleId === 'movie:557' && item.rawName === 'Spider-Man / Peter Parker' )!
        expect( spider1994.characterId ).not.toBe( spider2002.characterId )
    } )

    it( 'shows no unrelated titles for invalid links and preserves the default timeline', () => {
        const invalid = parseCharacterSelection( '?personagem=unknown', index )
        expect( invalid.invalid ).toBe( true )
        expect( filterListingsByCharacters( titles, invalid, index ) ).toEqual( [] )
        expect( filterListingsByCharacters( titles, parseCharacterSelection( '', index ), index ) ).toBe( titles )
    } )
} )
