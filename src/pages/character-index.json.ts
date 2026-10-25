import { buildCharacterTimelineIndex, type CharacterRegistry } from '../helpers/character-links.ts'
import type { CharacterSnapshot } from '../helpers/characters.ts'
import { getHomepageListings } from '../helpers/node/homepage-listings.ts'
import characterRegistry from '../json/character-links.json'
import characterSnapshot from '../json/characters.json'

export const prerender = true

export async function GET () {
    const listings = await getHomepageListings()
    const index = buildCharacterTimelineIndex( characterRegistry as CharacterRegistry, characterSnapshot as CharacterSnapshot, listings )

    return new Response( JSON.stringify( index ), {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    } )
}
