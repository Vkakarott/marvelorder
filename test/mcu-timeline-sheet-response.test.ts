import { describe, expect, test } from 'vitest'

import { parseSheetRecords } from '~/src/helpers/node/mcu-timeline-sheet.ts'

describe( 'parseSheetRecords', () => {
    test( 'rejects a response without records', () => {
        const result = parseSheetRecords( { error: 'not found' } )

        expect( result ).toEqual( {
            ok: false,
            reason: '"records" is missing, expected an array',
        } )
    } )

    test( 'rejects non-object bodies', () => {
        expect( parseSheetRecords( '<html>login</html>' ).ok ).toBe( false )
        expect( parseSheetRecords( null ).ok ).toBe( false )
    } )

    test( 'rejects records that are not an array or are empty', () => {
        expect( parseSheetRecords( { records: {} } ).ok ).toBe( false )
        expect( parseSheetRecords( { records: [] } ).ok ).toBe( false )
        expect( parseSheetRecords( { records: [ null ] } ).ok ).toBe( false )
    } )

    test( 'cleans valid records and drops empty keys', () => {
        const result = parseSheetRecords( {
            records: [ { TITLE: 'Iron Man', TYPE: 'movie', '': 'x', NOTES: 'hidden' } ],
        } )

        expect( result ).toEqual( {
            ok: true,
            records: [ { TITLE: 'Iron Man', TYPE: 'movie', NOTES: '' } ],
        } )
    } )
} )
