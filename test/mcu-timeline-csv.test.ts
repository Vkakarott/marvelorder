import { describe, expect, test } from 'vitest'

import {
    parseCsvRows,
    parseSheetCsv,
    parseSheetDate,
} from '~/src/helpers/node/mcu-timeline-csv.ts'

const header = '"This spreadsheet has been archived. TYPE CHRONOLOGICAL ORDER ","TITLE ","RELEASE DATE "'

describe( 'parseCsvRows', () => {
    test( 'handles quotes, commas, doubled quotes and CRLF', () => {
        const rows = parseCsvRows( 'a,"b, c","say ""hi"""\r\n"",x,y\n' )

        expect( rows ).toEqual( [ [ 'a', 'b, c', 'say "hi"' ], [ '', 'x', 'y' ] ] )
    } )

    test( 'keeps newlines inside quoted cells', () => {
        expect( parseCsvRows( '"a\nb",c' ) ).toEqual( [ [ 'a\nb', 'c' ] ] )
    } )
} )

describe( 'parseSheetDate', () => {
    test( 'matches the Apps Script output in both daylight saving seasons', () => {
        expect( parseSheetDate( 'May 6, 2011' ) ).toBe( '2011-05-06T04:00:00.000Z' )
        expect( parseSheetDate( 'January 6, 2015' ) ).toBe( '2015-01-06T05:00:00.000Z' )
    } )

    test( 'rejects values that are not dates', () => {
        expect( parseSheetDate( '' ) ).toBeNull()
        expect( parseSheetDate( 'TBA' ) ).toBeNull()
    } )
} )

describe( 'parseSheetCsv', () => {
    test( 'maps rows to records with an empty type so the old type is kept', () => {
        const csv = [
            header,
            '"","Thor","May 6, 2011"',
            '"","Agent Carter Season 1 Episode 1: Now is Not the End","January 6, 2015"',
        ].join( '\n' )

        expect( parseSheetCsv( csv ) ).toEqual( {
            ok: true,
            records: [
                { TYPE: {}, TITLE: 'Thor', RELEASE_DATE: '2011-05-06T04:00:00.000Z' },
                { TYPE: {}, TITLE: 'Agent Carter Season 1 Episode 1: Now is Not the End', RELEASE_DATE: '2015-01-06T05:00:00.000Z' },
            ],
        } )
    } )

    test( 'skips rows without a title or a valid date', () => {
        const csv = [ header, '"","","May 6, 2011"', '"","Thor","soon"', '"","Iron Man","May 2, 2008"' ].join( '\n' )
        const result = parseSheetCsv( csv )

        expect( result.ok && result.records.map( record => record.TITLE ) ).toEqual( [ 'Iron Man' ] )
    } )

    test( 'rejects a payload that is not the timeline CSV', () => {
        expect( parseSheetCsv( '<html>login</html>' ).ok ).toBe( false )
        expect( parseSheetCsv( `${ header }\n` ).ok ).toBe( false )
    } )
} )
