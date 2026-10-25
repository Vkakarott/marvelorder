import sharp from 'sharp'
import { expect, test } from 'vitest'

import { extractPosterAccent } from '~/src/helpers/node/poster-palette.ts'
import { accessibleAccentFromHue, contrastRatio, getPosterPalette, rgbToHsl } from '~/src/helpers/poster-palette.ts'

function hueOf ( hex: string ) {
    const channels = [ 1, 3, 5 ].map( index => Number.parseInt( hex.slice( index, index + 2 ), 16 ) ) as [ number, number, number ]
    return rgbToHsl( channels ).hue
}

test( 'poster extraction favors a chromatic area over a larger gray background', async () => {
    const width = 64
    const height = 96
    const pixels = Buffer.alloc( width * height * 3 )

    for ( let y = 0; y < height; y += 1 ) {
        for ( let x = 0; x < width; x += 1 ) {
            const index = ( y * width + x ) * 3
            const color = x < width / 4 ? [ 30, 90, 220 ] : [ 100, 100, 100 ]
            pixels.set( color, index )
        }
    }

    const poster = await sharp( pixels, { raw: { width, height, channels: 3 } } ).png().toBuffer()
    const accent = await extractPosterAccent( poster )

    expect( accent ).not.toBeNull()
    expect( hueOf( accent || '' ) ).toBeGreaterThan( 205 )
    expect( hueOf( accent || '' ) ).toBeLessThan( 240 )
} )

test( 'gray posters and missing paths use a stable accessible fallback', async () => {
    const poster = await sharp( { create: { width: 32, height: 48, channels: 3, background: '#777777' } } ).png().toBuffer()

    expect( await extractPosterAccent( poster ) ).toBeNull()
    expect( getPosterPalette( undefined, { version: 1, posters: {} } ) )
        .toEqual( getPosterPalette( '/missing.jpg', { version: 1, posters: {} } ) )
} )

test( 'generated accents contrast with the dark surface and button labels in normal and hover states', () => {
    for ( let hue = 0; hue < 360; hue += 15 ) {
        const accent = accessibleAccentFromHue( hue, 0.75 )
        const palette = getPosterPalette( '/poster.jpg', { version: 1, posters: { '/poster.jpg': accent } } )

        expect( contrastRatio( palette.accent, '#161923' ) ).toBeGreaterThanOrEqual( 4.5 )
        expect( contrastRatio( palette.accent, palette.buttonText ) ).toBeGreaterThanOrEqual( 4.5 )
        expect( contrastRatio( palette.hover, palette.buttonText ) ).toBeGreaterThanOrEqual( 4.5 )
    }
} )
