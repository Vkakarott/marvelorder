import { readFile, rename, writeFile } from 'node:fs/promises'

import { extractCharacters, mergeCharacters, type CharacterSnapshot } from '../src/helpers/characters.ts'
import { getListingIdentity, getListingMediaType } from '../src/helpers/listing-identity.ts'
import { parseCharacterCreditsPage } from '../src/helpers/node/character-credits-page.ts'
import { getAllListings } from '../src/helpers/node/listing-files.ts'

const snapshotPath = 'src/json/characters.json'
const today = new Date().toISOString().slice( 0, 10 )
const refreshIntervalMs = 30 * 24 * 60 * 60 * 1_000
const requestIntervalMs = 500

let lastRequestAt = 0

function sleep ( duration: number ) {
    return new Promise( resolve => setTimeout( resolve, duration ) )
}

async function fetchCredits ( identity: string ) {
    const [ mediaType, id ] = identity.split( ':' )
    const url = `https://www.themoviedb.org/${ mediaType }/${ id }/cast`

    for ( let attempt = 0; attempt < 4; attempt += 1 ) {
        await sleep( Math.max( 0, requestIntervalMs - ( Date.now() - lastRequestAt ) ) )
        lastRequestAt = Date.now()

        let response: Response

        try {
            response = await fetch( url, {
                headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
                signal: AbortSignal.timeout( 15_000 ),
            } )
        }
        catch ( error ) {
            if ( attempt === 3 ) {
                throw new Error( `Failed to fetch credits for ${ identity }`, { cause: error } )
            }
            await sleep( 2_000 * 2 ** attempt )
            continue
        }

        if ( response.status === 404 ) {
            return null
        }

        if ( response.ok ) {
            return parseCharacterCreditsPage( await response.text(), mediaType as 'movie' | 'tv' )
        }

        if ( response.status !== 429 && response.status < 500 ) {
            throw new Error( `TMDB returned ${ response.status } for ${ identity }` )
        }

        if ( attempt === 3 ) {
            throw new Error( `TMDB credits remained unavailable for ${ identity }: ${ response.status }` )
        }

        const retryAfter = Number( response.headers.get( 'retry-after' ) )
        await sleep( Math.max( 2_000 * 2 ** attempt, Number.isFinite( retryAfter ) ? retryAfter * 1_000 : 0 ) )
    }

    return null
}

async function readSnapshot (): Promise<CharacterSnapshot> {
    try {
        const snapshot = JSON.parse( await readFile( snapshotPath, 'utf8' ) ) as CharacterSnapshot

        if ( snapshot.version !== 1 || !snapshot.titles || typeof snapshot.titles !== 'object' ) {
            throw new Error( 'Unsupported character snapshot format' )
        }

        return snapshot
    }
    catch ( error ) {
        if ( ( error as NodeJS.ErrnoException ).code === 'ENOENT' ) {
            return { version: 1, titles: {} }
        }

        throw error
    }
}

function shouldRefresh ( fetchedAt?: string ) {
    const fetchedTime = Date.parse( fetchedAt || '' )
    return !Number.isFinite( fetchedTime ) || Date.now() - fetchedTime >= refreshIntervalMs
}

async function main () {
    const snapshot = await readSnapshot()
    const listings = await getAllListings()
    const identities = new Set<string>()

    for ( const listing of listings ) {
        if ( listing.draft || listing.genre_ids?.includes( 99 ) ) {
            continue
        }

        const identityFields = {
            id: listing.id,
            type: listing.type,
            media_type: listing.media_type,
            tags: listing.tags,
        }
        const identity = getListingIdentity( identityFields )
        const mediaType = getListingMediaType( identityFields )

        if ( identity && ( mediaType === 'movie' || mediaType === 'tv' ) ) {
            identities.add( identity )
        }
    }

    const due = [ ...identities ]
        .sort()
        .filter( identity => shouldRefresh( snapshot.titles[ identity ]?.fetchedAt ) )

    console.log( `Updating character credits for ${ due.length } of ${ identities.size } titles.` )

    for ( const [ index, identity ] of due.entries() ) {
        const credits = await fetchCredits( identity )

        if ( !credits ) {
            continue
        }

        const mediaType = identity.startsWith( 'tv:' ) ? 'tv' : 'movie'
        const previous = snapshot.titles[ identity ]?.characters || []
        const observed = extractCharacters( credits, mediaType )

        snapshot.titles[ identity ] = {
            fetchedAt: today,
            characters: mergeCharacters( previous, observed ),
        }

        if ( ( index + 1 ) % 25 === 0 || index + 1 === due.length ) {
            console.log( `Processed ${ index + 1 }/${ due.length } credit records.` )
        }
    }

    const populatedCount = [ ...identities ].filter( identity => snapshot.titles[ identity ]?.characters.length ).length

    if ( identities.size >= 20 && populatedCount / identities.size < 0.1 ) {
        throw new Error( `Character coverage is unexpectedly low: ${ populatedCount }/${ identities.size }` )
    }

    snapshot.titles = Object.fromEntries(
        Object.entries( snapshot.titles ).sort( ( [ left ], [ right ] ) => left.localeCompare( right ) ),
    )

    const temporaryPath = `${ snapshotPath }.tmp`
    await writeFile( temporaryPath, `${ JSON.stringify( snapshot, null, 2 ) }\n` )
    await rename( temporaryPath, snapshotPath )
}

await main()
