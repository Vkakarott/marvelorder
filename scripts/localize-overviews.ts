import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import 'dotenv/config'
import matter from 'gray-matter'

const directory = path.resolve( 'src/pages/en' )
const apiKey = process.env.TMDB_API_KEY

if ( !apiKey ) {
    throw new Error( 'Configure TMDB_API_KEY para buscar as sinopses em pt-BR.' )
}

type Entry = {
    filePath: string
    markdown: string
    id: number
    type: 'movie' | 'tv'
    originalLanguage: string
    englishOverview: string
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

async function fetchOverview ( entry: Entry ) {
    const url = new URL( `https://api.themoviedb.org/3/${ entry.type }/${ entry.id }` )
    url.searchParams.set( 'language', 'pt-BR' )
    url.searchParams.set( 'api_key', apiKey! )

    for ( let attempt = 0; attempt < 4; attempt++ ) {
        const response = await fetch( url, { signal: AbortSignal.timeout( 15000 ) } )
        if ( response.status === 429 || response.status >= 500 ) {
            await new Promise( resolve => setTimeout( resolve, 1000 * 2 ** attempt ) )
            continue
        }
        if ( !response.ok ) {
            throw new Error( `TMDB ${ response.status } para ${ entry.type }/${ entry.id }` )
        }

        const data = await response.json() as { overview?: string }
        const overview = data.overview?.trim() || ''
        if ( overview === entry.englishOverview.trim() && entry.originalLanguage !== 'pt' ) {
            return ''
        }
        return overview
    }

    throw new Error( `TMDB indisponível para ${ entry.type }/${ entry.id }` )
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
    const type = frontmatter.type || tmdb.tags?.[ 0 ]
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
    }
} ) )

const uniqueEntries = new Map( entries.map( entry => [ `${ entry.type }:${ entry.id }`, entry ] ) )
const overviews = new Map<string, string>()
const failures: string[] = []
const keys = [ ...uniqueEntries.keys() ]

for ( let start = 0; start < keys.length; start += 8 ) {
    const batch = keys.slice( start, start + 8 )
    await Promise.all( batch.map( async key => {
        const entry = uniqueEntries.get( key )!
        try {
            const overview = await fetchOverview( entry )
            if ( overview ) {
                overviews.set( key, overview )
            }
            else if ( entry.englishOverview ) {
                failures.push( key )
            }
        }
        catch ( error ) {
            failures.push( `${ key }: ${ error }` )
        }
    } ) )
}

let updated = 0
for ( const entry of entries ) {
    const overview = overviews.get( `${ entry.type }:${ entry.id }` )
    if ( !overview ) {
        continue
    }
    let markdown = replaceFrontmatterValue( entry.markdown, 'description', overview )
    markdown = replaceFrontmatterValue( markdown, 'overview', overview )
    if ( markdown !== entry.markdown ) {
        await writeFile( entry.filePath, markdown )
        updated++
    }
}

console.log( `Sinopses pt-BR atualizadas em ${ updated } de ${ entries.length } páginas.` )
if ( failures.length ) {
    console.error( `Sem tradução pt-BR no TMDB (${ failures.length }): ${ failures.join( ', ' ) }` )
    process.exitCode = 1
}
