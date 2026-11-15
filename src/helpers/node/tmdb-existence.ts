import fs from 'fs-extra'

import { storePath } from '~/src/config.ts'
import { getListingIdentity } from '~/src/helpers/listing-identity.ts'
import type { ExistenceCache } from '~/src/helpers/orphan-sweep.ts'
import type { Listing } from '~/src/helpers/types.ts'

export type IsGoneListing = ( listing: Listing ) => boolean

// Reads the checked-in 404 sweep results. A missing cache means nothing is known gone.
export async function readGoneListingChecker (): Promise<IsGoneListing> {
    const cachePath = `${ storePath }/tmdb-existence.json`
    const cache: ExistenceCache = ( await fs.pathExists( cachePath ) ) ? await fs.readJson( cachePath ) : {}

    return ( listing ) => {
        const identity = getListingIdentity( listing )

        return identity !== null && cache[ identity ]?.gone === true
    }
}
