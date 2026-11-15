import { getListingIdentity } from './listing-identity.ts'
import { hasKnownMediaType } from './orphan-sweep.ts'
import type { Listing } from './types.ts'

export interface TmdbLogo {
    file_path: string
    iso_639_1?: string | null
    vote_average?: number
    vote_count?: number
}

export interface FanartLogo {
    url: string
    lang?: string
    likes?: string
}

export interface LogoSuggestion {
    checkedAt: string
    logo: string | null
    source?: 'tmdb' | 'fanart'
}

export type LogoSuggestions = Record<string, LogoSuggestion>

export const logoImageLanguageParam = 'en,null,pt'

// Logos are the title itself, so English leads (the repo's curated logos are
// English), then textless marks, then Portuguese.
const logoLanguages: Array<string | null> = [ 'en', null, 'pt' ]
const rasterLogoPattern = /\.(png|webp|jpe?g)$/i
const minLegibleLuminance = 0.4
const opaqueAlpha = 128

function compareByRating ( logoA: TmdbLogo, logoB: TmdbLogo ): number {
    return ( logoB.vote_average ?? 0 ) - ( logoA.vote_average ?? 0 )
        || ( logoB.vote_count ?? 0 ) - ( logoA.vote_count ?? 0 )
}

export function pickTmdbLogoPath ( response: { logos?: TmdbLogo[] } ): string | null {
    const rasterLogos = ( response.logos ?? [] ).filter( ( logo ) => rasterLogoPattern.test( logo.file_path ) )

    for ( const language of logoLanguages ) {
        const [ best ] = rasterLogos
            .filter( ( logo ) => ( logo.iso_639_1 ?? null ) === language )
            .sort( compareByRating )

        if ( best ) {
            return best.file_path
        }
    }

    return null
}

// Fanart serves HD movie logos by file name, which is what the /fanart/ route expects.
export function pickFanartLogoPath ( response: { hdmovielogo?: FanartLogo[] } ): string | null {
    const [ best ] = ( response.hdmovielogo ?? [] )
        .filter( ( logo ) => [ 'en', '00', '' ].includes( logo.lang ?? '' ) )
        .sort( ( logoA, logoB ) => Number( logoB.likes ?? 0 ) - Number( logoA.likes ?? 0 ) )

    return best ? best.url.split( '/' ).pop() ?? null : null
}

// Rec. 709 luma of the visible pixels of an RGBA buffer, on a dark background.
export function isLegibleOnDark ( rgba: Uint8Array ): boolean {
    let luminanceSum = 0
    let visiblePixels = 0

    for ( let offset = 0; offset + 3 < rgba.length; offset += 4 ) {
        if ( rgba[ offset + 3 ] < opaqueAlpha ) {
            continue
        }

        luminanceSum += ( 0.2126 * rgba[ offset ] + 0.7152 * rgba[ offset + 1 ] + 0.0722 * rgba[ offset + 2 ] ) / 255
        visiblePixels += 1
    }

    return visiblePixels > 0 && luminanceSum / visiblePixels >= minLegibleLuminance
}

export function toTmdbLogoValue ( filePath: string ): string {
    return `{tmdb-path}${ filePath.replace( /\.\w+$/, '.webp' ) }`
}

export function toFanartLogoValue ( fileName: string ): string {
    return `{fanart-path}/${ fileName.replace( /\.\w+$/, '.webp' ) }`
}

interface LookupOptions {
    isGone: ( identity: string ) => boolean
    suggestions: LogoSuggestions
    today: string
    refreshDays: number
    limit: number
}

export interface LogoLookup {
    identity: string
    listing: Listing
}

const dayMs = 24 * 60 * 60 * 1_000

function wasCheckedRecently ( suggestion: LogoSuggestion | undefined, { today, refreshDays }: LookupOptions ): boolean {
    if ( !suggestion ) {
        return false
    }

    const ageMs = Date.parse( today ) - Date.parse( suggestion.checkedAt )

    return Number.isFinite( ageMs ) && ageMs < refreshDays * dayMs
}

// Listings that still show a poster or backdrop for lack of a logo. Misses are
// remembered for a while so the same bare listings are not queried every run.
export function selectLogoLookups ( listings: Listing[], options: LookupOptions ): LogoLookup[] {
    const lookups: LogoLookup[] = []

    for ( const listing of listings ) {
        const identity = getListingIdentity( listing )

        if ( !identity || listing.logo_on_black || !hasKnownMediaType( identity ) || options.isGone( identity ) ) {
            continue
        }

        if ( !wasCheckedRecently( options.suggestions[ identity ], options ) ) {
            lookups.push( { identity, listing } )
        }
    }

    return lookups.slice( 0, options.limit )
}

// A curated logo always wins over a suggested one.
export function applyLogoSuggestions ( listings: Listing[], suggestions: LogoSuggestions ): Listing[] {
    return listings.map( ( listing ) => {
        const identity = getListingIdentity( listing )
        const suggestedLogo = identity ? suggestions[ identity ]?.logo : null

        return listing.logo_on_black || !suggestedLogo ? listing : { ...listing, logo_on_black: suggestedLogo }
    } )
}
