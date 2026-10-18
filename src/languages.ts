import { KNOWN_LANGUAGES } from './config'

export { KNOWN_LANGUAGES }
export const KNOWN_LANGUAGE_CODES = Object.values( KNOWN_LANGUAGES )
export const langPathRegex = /\/([a-z]{2}(?:-[a-z]{2})?)\//

export function getLanguageFromURL ( pathname: string ) {
    const langCodeMatch = pathname.match( langPathRegex )
    return langCodeMatch ? langCodeMatch[ 1 ] : 'pt-br'
}
