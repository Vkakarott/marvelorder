import { readFile, rename, writeFile } from 'node:fs/promises'

import { getListingIdentity } from '../src/helpers/listing-identity.ts'
import { getAllListings } from '../src/helpers/node/listing-files.ts'
import { extractPosterAccent } from '../src/helpers/node/poster-palette.ts'
import type { PosterPaletteSnapshot } from '../src/helpers/poster-palette.ts'

const snapshotPath = 'src/json/poster-palettes.json'
const batchSize = 6
const posterPathPattern = /^\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/

async function readSnapshot (): Promise<PosterPaletteSnapshot> {
    try {
        const snapshot = JSON.parse( await readFile( snapshotPath, 'utf8' ) ) as PosterPaletteSnapshot

        if ( snapshot.version !== 1 || !snapshot.posters || typeof snapshot.posters !== 'object' ) {
            throw new Error( 'Unsupported poster palette snapshot format' )
        }

        return snapshot
    }
    catch ( error ) {
        if ( ( error as NodeJS.ErrnoException ).code === 'ENOENT' ) {
            return { version: 1, posters: {} }
        }

        throw error
    }
}

async function fetchPoster ( posterPath: string ) {
    const url = `https://image.tmdb.org/t/p/w185${ posterPath }`

    for ( let attempt = 0; attempt < 3; attempt += 1 ) {
        try {
            const response = await fetch( url, { signal: AbortSignal.timeout( 15_000 ) } )

            if ( response.ok ) {
                if ( Number( response.headers.get( 'content-length' ) ) > 1_000_000 ) {
                    throw new Error( 'Poster exceeds size limit' )
                }

                const image = Buffer.from( await response.arrayBuffer() )

                if ( image.byteLength > 1_000_000 ) {
                    throw new Error( 'Poster exceeds size limit' )
                }

                return extractPosterAccent( image )
            }

            if ( response.status !== 429 && response.status < 500 ) {
                return null
            }
        }
        catch ( error ) {
            if ( attempt === 2 ) {
                console.warn( `Poster palette unavailable for ${ posterPath }: ${ error }` )
            }
        }

        await new Promise( resolve => setTimeout( resolve, 1_000 * 2 ** attempt ) )
    }

    return null
}

async function main () {
    const snapshot = await readSnapshot()
    const listings = await getAllListings()
    const posterPaths = [ ...new Set( listings
        .filter( listing => !listing.draft && getListingIdentity( listing ) && listing.poster_path && posterPathPattern.test( listing.poster_path ) )
        .map( listing => listing.poster_path as string ) ) ].sort()
    const due = posterPaths.filter( path => !snapshot.posters[ path ] )
    let updated = 0

    console.log( `Updating poster palettes for ${ due.length } of ${ posterPaths.length } posters.` )

    for ( let start = 0; start < due.length; start += batchSize ) {
        const batch = due.slice( start, start + batchSize )
        const colors = await Promise.all( batch.map( fetchPoster ) )

        for ( const [ index, accent ] of colors.entries() ) {
            if ( accent ) {
                snapshot.posters[ batch[ index ] ] = accent
                updated += 1
            }
        }

        if ( ( start + batch.length ) % 30 === 0 || start + batch.length === due.length ) {
            console.log( `Processed ${ start + batch.length }/${ due.length } posters.` )
        }

        await new Promise( resolve => setTimeout( resolve, 500 ) )
    }

    if ( due.length >= 20 && updated / due.length < 0.25 ) {
        throw new Error( `Poster palette coverage is unexpectedly low: ${ updated }/${ due.length }` )
    }

    snapshot.posters = Object.fromEntries( Object.entries( snapshot.posters ).sort( ( [ left ], [ right ] ) => left.localeCompare( right ) ) )
    const temporaryPath = `${ snapshotPath }.tmp`
    await writeFile( temporaryPath, `${ JSON.stringify( snapshot, null, 2 ) }\n` )
    await rename( temporaryPath, snapshotPath )
    console.log( `Stored ${ updated } new poster palettes.` )
}

await main()
