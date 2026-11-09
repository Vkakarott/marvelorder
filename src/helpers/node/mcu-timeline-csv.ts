// Fallback reader for the public CSV export of the MCU timeline sheet, used
// when the Apps Script endpoint fails. The CSV carries no TYPE values (they
// are cell icons), so records get an empty type and the pull keeps the type of
// the matching record already checked in.

import { DateTime } from 'luxon'

import type { MCUTimelineSheetRecord } from '~/src/helpers/types'

const SHEET_ZONE = 'America/New_York'
const DATE_FORMAT = 'LLLL d, yyyy'

export function parseCsvRows ( text: string ): string[][] {
    const rows: string[][] = []
    let row: string[] = []
    let cell = ''
    let inQuotes = false

    for ( let index = 0; index < text.length; index++ ) {
        const char = text[ index ]

        if ( inQuotes ) {
            if ( char === '"' && text[ index + 1 ] === '"' ) {
                cell += '"'
                index++
            }
            else if ( char === '"' ) {
                inQuotes = false
            }
            else {
                cell += char
            }
        }
        else if ( char === '"' ) {
            inQuotes = true
        }
        else if ( char === ',' ) {
            row.push( cell )
            cell = ''
        }
        else if ( char === '\n' || char === '\r' ) {
            if ( char === '\r' && text[ index + 1 ] === '\n' ) {
                index++
            }
            row.push( cell )
            rows.push( row )
            row = []
            cell = ''
        }
        else {
            cell += char
        }
    }

    if ( cell.length > 0 || row.length > 0 ) {
        row.push( cell )
        rows.push( row )
    }

    return rows
}

// "August 27, 2025" -> "2025-08-27T04:00:00.000Z", matching the Apps Script output
export function parseSheetDate ( value: string ): string | null {
    const date = DateTime.fromFormat( value.trim(), DATE_FORMAT, { zone: SHEET_ZONE, locale: 'en-US' } )

    return date.isValid ? date.toUTC().toISO() : null
}

function findColumns ( header: string[] ) {
    const names = header.map( name => name.trim().toLowerCase() )
    const title = names.indexOf( 'title' )
    const releaseDate = names.indexOf( 'release date' )

    return title >= 0 && releaseDate >= 0 ? { title, releaseDate } : null
}

export type CsvRecordsResult =
    | { ok: true, records: MCUTimelineSheetRecord[] }
    | { ok: false, reason: string }

export function parseSheetCsv ( text: string ): CsvRecordsResult {
    const [ header = [], ...rows ] = parseCsvRows( text )
    const columns = findColumns( header )

    if ( !columns ) {
        return { ok: false, reason: 'CSV header has no TITLE and RELEASE DATE columns' }
    }

    const records = rows.flatMap( ( row ) => {
        const title = ( row[ columns.title ] ?? '' ).trim()
        const releaseDate = parseSheetDate( row[ columns.releaseDate ] ?? '' )

        return title && releaseDate
            ? [ { TYPE: {}, TITLE: title, RELEASE_DATE: releaseDate } as MCUTimelineSheetRecord ]
            : []
    } )

    return records.length > 0 ? { ok: true, records } : { ok: false, reason: 'CSV has no usable rows' }
}
