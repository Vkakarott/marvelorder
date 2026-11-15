import { getListingIdentity } from './listing-identity.ts'
import { hasKnownMediaType } from './orphan-sweep.ts'

export interface TmdbImage {
    file_path: string
    iso_639_1?: string | null
    vote_average?: number
    vote_count?: number
}

export interface TmdbImagesResponse {
    posters?: TmdbImage[]
    backdrops?: TmdbImage[]
}

export interface FallbackImages {
    poster_path: string | null
    backdrop_path: string | null
}

type ImageLanguage = string | null

// Posters carry text, so the viewer's language wins. Backdrops read best without it.
const posterLanguages: ImageLanguage[] = [ 'pt', 'en', null ]
const backdropLanguages: ImageLanguage[] = [ null, 'pt', 'en' ]

export const imageLanguageParam = 'pt,en,null'

function compareByRating ( imageA: TmdbImage, imageB: TmdbImage ): number {
    return ( imageB.vote_average ?? 0 ) - ( imageA.vote_average ?? 0 )
        || ( imageB.vote_count ?? 0 ) - ( imageA.vote_count ?? 0 )
}

function pickBestImagePath ( images: TmdbImage[] = [], languages: ImageLanguage[] ): string | null {
    for ( const language of languages ) {
        const [ best ] = images
            .filter( ( image ) => ( image.iso_639_1 ?? null ) === language )
            .sort( compareByRating )

        if ( best ) {
            return best.file_path
        }
    }

    return [ ...images ].sort( compareByRating )[ 0 ]?.file_path ?? null
}

export function pickFallbackImages ( response: TmdbImagesResponse ): FallbackImages {
    return {
        poster_path: pickBestImagePath( response.posters, posterLanguages ),
        backdrop_path: pickBestImagePath( response.backdrops, backdropLanguages ),
    }
}

export function needsImageFallback ( listing: { poster_path?: string | null, backdrop_path?: string | null } ): boolean {
    return !listing.poster_path && !listing.backdrop_path
}

interface FillMissingImagesOptions {
    limit: number
    isGone: ( identity: string ) => boolean
    fetchImages: ( identity: string ) => Promise<TmdbImagesResponse>
}

function getLookupIdentities ( listings: any[], isGone: ( identity: string ) => boolean ): Map<string, any> {
    const lookups = new Map<string, any>()

    for ( const listing of listings.filter( needsImageFallback ) ) {
        const identity = getListingIdentity( listing )

        if ( identity && hasKnownMediaType( identity ) && !isGone( identity ) ) {
            lookups.set( identity, listing )
        }
    }

    return lookups
}

// Fills listings TMDB's list endpoints returned without any image. Failures
// leave the listing untouched, so an outage never changes checked-in data.
export async function fillMissingImages ( listings: any[], options: FillMissingImagesOptions ): Promise<number> {
    const lookups = [ ...getLookupIdentities( listings, options.isGone ) ].slice( 0, options.limit )
    let filled = 0

    for ( const [ identity, listing ] of lookups ) {
        try {
            const { poster_path, backdrop_path } = pickFallbackImages( await options.fetchImages( identity ) )

            listing.poster_path = poster_path ?? listing.poster_path
            listing.backdrop_path = backdrop_path ?? listing.backdrop_path
            filled += Number( Boolean( poster_path || backdrop_path ) )
        }
        catch {
            continue
        }
    }

    return filled
}
