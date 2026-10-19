import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import 'dotenv/config'
import matter from 'gray-matter'
import { parseHTML } from 'linkedom'

const directory = path.resolve( 'src/pages/pt-br' )
const apiKey = process.env.TMDB_API_KEY
const htmlDirectory = process.argv.includes( '--html-dir' ) ? process.argv[ process.argv.indexOf( '--html-dir' ) + 1 ] : undefined
const translationDirectory = process.argv.includes( '--translations-dir' )
    ? process.argv[ process.argv.indexOf( '--translations-dir' ) + 1 ]
    : undefined

type Entry = {
    filePath: string
    markdown: string
    id: number
    type: 'movie' | 'tv'
    originalLanguage: string
    englishOverview: string
    englishTitle: string
}

type LocalizedDetails = {
    overview: string
    title: string
}

function replaceFrontmatterValue ( markdown: string, key: string, value: string ) {
    const lines = markdown.split( '\n' )
    const closingIndex = lines.findIndex( ( line, index ) => index > 0 && line === '---' )
    const startIndex = lines.findIndex( ( line, index ) => index > 0 && index < closingIndex && line.startsWith( `${ key }:` ) )
    const replacement = `${ key }: ${ JSON.stringify( value ) }`

    if ( startIndex === -1 ) {
        lines.splice( closingIndex, 0, replacement )
    }
    else {
        let endIndex = startIndex + 1
        while ( endIndex < closingIndex && ( !lines[ endIndex ].trim() || /^\s/.test( lines[ endIndex ] ) ) ) {
            endIndex++
        }
        lines.splice( startIndex, endIndex - startIndex, replacement )
    }

    return lines.join( '\n' )
}

async function fetchLocalizedDetails ( entry: Entry ): Promise<LocalizedDetails> {
    if ( htmlDirectory ) {
        const html = await readFile( path.join( htmlDirectory, `${ entry.type }-${ entry.id }.html` ), 'utf8' )
        return withFallbackOverview( parseDetailsHtml( html, entry ), entry )
    }

    const url = new URL( apiKey
        ? `https://api.themoviedb.org/3/${ entry.type }/${ entry.id }`
        : `https://www.themoviedb.org/${ entry.type }/${ entry.id }` )
    url.searchParams.set( 'language', 'pt-BR' )
    if ( apiKey ) {
        url.searchParams.set( 'api_key', apiKey )
    }

    for ( let attempt = 0; attempt < 4; attempt++ ) {
        const response = await fetch( url, { signal: AbortSignal.timeout( 15000 ) } )
        if ( response.status === 429 || response.status >= 500 ) {
            await new Promise( resolve => setTimeout( resolve, 1000 * 2 ** attempt ) )
            continue
        }
        if ( response.status === 404 ) {
            return { overview: '', title: '' }
        }
        if ( !response.ok ) {
            throw new Error( `TMDB ${ response.status } para ${ entry.type }/${ entry.id }` )
        }

        const details = apiKey
            ? parseDetailsJson( await response.json(), entry )
            : parseDetailsHtml( await response.text(), entry )
        return withFallbackOverview( details, entry )
    }

    throw new Error( `TMDB indisponível para ${ entry.type }/${ entry.id }` )
}

function parseDetailsJson ( data: { overview?: string, title?: string, name?: string }, entry: Entry ): LocalizedDetails {
    return {
        overview: getLocalizedOverview( data.overview?.trim() || '', entry ),
        title: ( data.title || data.name || '' ).trim(),
    }
}

function parseDetailsHtml ( html: string, entry: Entry ): LocalizedDetails {
    const { document } = parseHTML( html )
    return {
        overview: getLocalizedOverview( document.querySelector( '.overview p' )?.textContent?.trim() || '', entry ),
        title: document.querySelector( 'meta[property="og:title"]' )?.getAttribute( 'content' )?.trim() || '',
    }
}

async function withFallbackOverview ( details: LocalizedDetails, entry: Entry ): Promise<LocalizedDetails> {
    return {
        ...details,
        overview: details.overview || await getFallbackOverview( entry ),
    }
}

async function getFallbackOverview ( entry: Entry ) {
    if ( !translationDirectory || !entry.englishOverview ) {
        return ''
    }
    const filePath = path.join( translationDirectory, `${ entry.type }-${ entry.id }.json` )
    const segments = JSON.parse( await readFile( filePath, 'utf8' ) )?.[ 0 ]
    const overview = Array.isArray( segments )
        ? segments.map( segment => segment?.[ 0 ] || '' ).join( '' ).trim()
        : ''
    return getLocalizedOverview( overview, entry )
}

function getLocalizedOverview ( overview: string, entry: Entry ) {
    if ( overview === entry.englishOverview.trim() && entry.originalLanguage !== 'pt' ) {
        return ''
    }
    if ( overview.startsWith( 'Não temos uma sinopse' ) ) {
        return ''
    }
    return overview
}

const files = ( await readdir( directory ) ).filter( file => file.endsWith( '.md' ) )
const entries: Entry[] = await Promise.all( files.map( async file => {
    const filePath = path.join( directory, file )
    const markdown = await readFile( filePath, 'utf8' )
    const frontmatter = matter( markdown ).data
    const match = markdown.match( /```json\s*([\s\S]*?)\s*```/ )
    if ( !match ) {
        throw new Error( `Dados TMDB ausentes em ${ file }` )
    }
    const tmdb = JSON.parse( match[ 1 ] )
    const type = frontmatter.type || tmdb.media_type || tmdb.tags?.[ 0 ]
    if ( type !== 'movie' && type !== 'tv' ) {
        throw new Error( `Tipo desconhecido em ${ file }` )
    }
    return {
        filePath,
        markdown,
        id: tmdb.id,
        type,
        originalLanguage: tmdb.original_language || '',
        englishOverview: tmdb.overview || '',
        englishTitle: String( frontmatter.title || '' ),
    }
} ) )

const uniqueEntries = new Map( entries.map( entry => [ `${ entry.type }:${ entry.id }`, entry ] ) )
const localizedDetails = new Map<string, LocalizedDetails>()
const failures: string[] = []
const keys = [ ...uniqueEntries.keys() ]

for ( let start = 0; start < keys.length; start += 4 ) {
    const batch = keys.slice( start, start + 4 )
    await Promise.all( batch.map( async key => {
        const entry = uniqueEntries.get( key )!
        try {
            const details = await fetchLocalizedDetails( entry )
            localizedDetails.set( key, details )
            if ( !details.overview && entry.englishOverview ) {
                failures.push( key )
            }
        }
        catch ( error ) {
            failures.push( `${ key }: ${ error }` )
        }
    } ) )
    if ( start % 32 === 0 ) {
        console.log( `Consultados ${ Math.min( start + 4, keys.length ) } de ${ keys.length } títulos.` )
    }
}

function applyLocalizedDetails ( entry: Entry, details: LocalizedDetails ) {
    let markdown = entry.markdown
    if ( details.overview ) {
        markdown = replaceFrontmatterValue( markdown, 'description', details.overview )
        markdown = replaceFrontmatterValue( markdown, 'overview', details.overview )
    }
    if ( details.title && details.title !== entry.englishTitle ) {
        markdown = replaceFrontmatterValue( markdown, 'localized_title', details.title )
    }
    return markdown
}

let updated = 0
for ( const entry of entries ) {
    const details = localizedDetails.get( `${ entry.type }:${ entry.id }` )
    if ( !details ) {
        continue
    }
    const markdown = applyLocalizedDetails( entry, details )
    if ( markdown !== entry.markdown ) {
        await writeFile( entry.filePath, markdown )
        updated++
    }
}

console.log( `Sinopses e títulos pt-BR atualizados em ${ updated } de ${ entries.length } páginas.` )
if ( failures.length ) {
    console.error( `Sem tradução pt-BR no TMDB (${ failures.length }): ${ failures.join( ', ' ) }` )
    process.exitCode = 1
}
