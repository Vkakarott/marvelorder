import sharp from 'sharp'

import { accessibleAccentFromHue, rgbToHsl } from '../poster-palette.ts'

interface HueBucket {
    weight: number
    sine: number
    cosine: number
    saturation: number
}

export async function extractPosterAccent ( image: Buffer ) {
    const { data, info } = await sharp( image )
        .rotate()
        .resize( 64, 96, { fit: 'inside', withoutEnlargement: true } )
        .removeAlpha()
        .raw()
        .toBuffer( { resolveWithObject: true } )
    const buckets: HueBucket[] = Array.from( { length: 24 }, () => ( { weight: 0, sine: 0, cosine: 0, saturation: 0 } ) )

    for ( let index = 0; index < data.length; index += info.channels ) {
        const color = rgbToHsl( [ data[ index ], data[ index + 1 ], data[ index + 2 ] ] )

        if ( color.saturation < 0.16 || color.lightness < 0.12 || color.lightness > 0.9 ) {
            continue
        }

        const angle = color.hue * Math.PI / 180
        const weight = color.saturation ** 1.3 * ( 1 - Math.abs( color.lightness - 0.52 ) * 0.8 )
        const bucket = buckets[ Math.floor( color.hue / 15 ) ]
        bucket.weight += weight
        bucket.sine += Math.sin( angle ) * weight
        bucket.cosine += Math.cos( angle ) * weight
        bucket.saturation += color.saturation * weight
    }

    const winner = buckets.reduce( ( best, bucket ) => bucket.weight > best.weight ? bucket : best )

    if ( winner.weight === 0 ) {
        return null
    }

    const hue = ( Math.atan2( winner.sine, winner.cosine ) * 180 / Math.PI + 360 ) % 360
    return accessibleAccentFromHue( hue, winner.saturation / winner.weight )
}
