import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { extendCharacterRegistry, type CharacterRegistry } from '../src/helpers/character-links.ts'
import { getListingIdentity } from '../src/helpers/listing-identity.ts'
import { getHomepageListings } from '../src/helpers/node/homepage-listings.ts'
import type { CharacterSnapshot } from '../src/helpers/characters.ts'

const registryPath = 'src/json/character-links.json'
const snapshotPath = 'src/json/characters.json'
const registry = JSON.parse( await readFile( registryPath, 'utf8' ) ) as CharacterRegistry
const snapshot = JSON.parse( await readFile( snapshotPath, 'utf8' ) ) as CharacterSnapshot
const listings = await getHomepageListings()
const titleIds = listings.map( listing => getListingIdentity( { ...listing } ) ).filter( ( value ): value is string => Boolean( value ) )
const next = extendCharacterRegistry( registry, snapshot, titleIds, randomUUID )

if ( next.participations.length !== registry.participations.length ) {
    await writeFile( registryPath, `${ JSON.stringify( next, null, 2 ) }\n` )
}

console.log( `Character links: ${ next.participations.length } participations (${ next.participations.length - registry.participations.length } new).` )
