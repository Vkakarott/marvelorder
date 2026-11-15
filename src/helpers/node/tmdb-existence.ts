import fs from 'fs-extra'

import { storePath } from '~/src/config.ts'
import { getListingIdentity } from '~/src/helpers/listing-identity.ts'
import type { ExistenceCache } from '~/src/helpers/orphan-sweep.ts'
import type { Listing } from '~/src/helpers/types.ts'

export type IsGoneListing = ( listing: Listing ) => boolean
export type IsGoneIdentity = ( identity: string ) => boolean

// Reads the checked-in 404 sweep results. A missing cache means nothing is known gone.
export async function readGoneIdentityChecker (): Promise<IsGoneIdentity> {
    const cachePath = `${ storePath }/tmdb-existence.json`
    const cache: ExistenceCache = ( await fs.pathExists( cachePath ) ) ? await fs.readJson( cachePath ) : {}

    return ( identity ) => cache[ identity ]?.gone === true
}

export async function readGoneListingChecker (): Promise<IsGoneListing> {
    const isGone = await readGoneIdentityChecker()

    return ( listing ) => {
        const identity = getListingIdentity( listing )

        return identity !== null && isGone( identity )
    }
}
