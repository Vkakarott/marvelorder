import axios from 'axios'
import fs from 'fs-extra'
import sharp from 'sharp'
import 'dotenv/config'

import {
    isLegibleOnDark,
    logoImageLanguageParam,
    pickFanartLogoPath,
    pickTmdbLogoPath,
    selectLogoLookups,
    toFanartLogoValue,
    toTmdbLogoValue,
    type LogoSuggestion,
    type LogoSuggestions,
} from '~/src/helpers/logo-suggestions.ts'
import { logoSuggestionsPath, readLogoSuggestions } from '~/src/helpers/node/logo-suggestions-store.ts'
import { getPublicMcuReleaseListings, getPublicMcuTimelineListings } from '~/src/helpers/node/public-mcu-listings.ts'
import { readGoneIdentityChecker } from '~/src/helpers/node/tmdb-existence.ts'
import { getListingMediaType } from '~/src/helpers/listing-identity.ts'
import type { Listing } from '~/src/helpers/types.ts'

// Finds logos for MCU listings that still fall back to a poster. Needs
// TMDB_API_KEY; FANART_API_KEY is optional and only covers movies.
const tmdbApiKey = process.env.TMDB_API_KEY
const fanartApiKey = process.env.FANART_API_KEY
const maxLookups = Number( process.env.MAX_LOGO_LOOKUPS || 25 )
const refreshDays = Number( process.env.LOGO_REFRESH_DAYS || 30 )
const minIntervalMs = Number( process.env.TMDB_MIN_INTERVAL_MS || 1_000 )
const tmdbImageHost = 'https://image.tmdb.org/t/p/w300'
const fanartImageHost = 'https://assets.fanart.tv/fanart/movies/0/hdmovielogo'

const sleep = ( ms: number ) => new Promise( resolve => setTimeout( resolve, ms ) )

async function downloadPixels ( url: string ): Promise<Uint8Array> {
    const { data } = await axios.get( url, { responseType: 'arraybuffer' } )

    return await sharp( data ).ensureAlpha().raw().toBuffer()
}

async function findTmdbLogo ( listing: Listing ): Promise<string | null> {
    const { data } = await axios.get( `https://api.themoviedb.org/3/${ getListingMediaType( listing ) }/${ listing.id }/images`, {
        params: { api_key: tmdbApiKey, include_image_language: logoImageLanguageParam },
    } )
    const filePath = pickTmdbLogoPath( data )

    return filePath && isLegibleOnDark( await downloadPixels( `${ tmdbImageHost }${ filePath }` ) ) ? toTmdbLogoValue( filePath ) : null
}

async function findFanartLogo ( listing: Listing ): Promise<string | null> {
    if ( !fanartApiKey || getListingMediaType( listing ) !== 'movie' ) {
        return null
    }

    const { data } = await axios.get( `https://webservice.fanart.tv/v3/movies/${ listing.id }`, { params: { api_key: fanartApiKey } } )
    const fileName = pickFanartLogoPath( data )

    return fileName && isLegibleOnDark( await downloadPixels( `${ fanartImageHost }/${ fileName }` ) ) ? toFanartLogoValue( fileName ) : null
}

async function findSuggestion ( listing: Listing, today: string ): Promise<LogoSuggestion> {
    const tmdbLogo = await findTmdbLogo( listing )

    if ( tmdbLogo ) {
        return { checkedAt: today, logo: tmdbLogo, source: 'tmdb' }
    }

    const fanartLogo = await findFanartLogo( listing )

    return fanartLogo ? { checkedAt: today, logo: fanartLogo, source: 'fanart' } : { checkedAt: today, logo: null }
}

async function loadLookups ( suggestions: LogoSuggestions, today: string ) {
    const [ releaseListings, timelineListings ] = await Promise.all( [ getPublicMcuReleaseListings(), getPublicMcuTimelineListings() ] )

    return selectLogoLookups( [ ...releaseListings, ...timelineListings ], {
        isGone: await readGoneIdentityChecker(),
        suggestions,
        today,
        refreshDays,
        limit: maxLookups,
    } )
}

async function collectSuggestions ( suggestions: LogoSuggestions, today: string ): Promise<number> {
    let found = 0

    for ( const { identity, listing } of await loadLookups( suggestions, today ) ) {
        try {
            suggestions[ identity ] = await findSuggestion( listing, today )
            found += Number( Boolean( suggestions[ identity ].logo ) )
        }
        catch {
            continue
        }

        await sleep( minIntervalMs )
    }

    return found
}

( async () => {
    if ( !tmdbApiKey ) {
        console.warn( 'TMDB_API_KEY is not set, skipping the logo lookup.' )

        return
    }

    const suggestions = await readLogoSuggestions()
    const found = await collectSuggestions( suggestions, new Date().toISOString().slice( 0, 10 ) )

    await fs.writeFile( logoSuggestionsPath, `${ JSON.stringify( suggestions, null, 2 ) }\n` )
    console.log( `Logo lookup found ${ found } new logos.` )
} )()
