export interface PosterPaletteSnapshot {
    version: 1
    posters: Record<string, string>
}

export interface PosterPalette {
    accent: string
    hover: string
    buttonText: string
    rgb: string
}

const fallbackAccent = '#71d4c7'
const darkSurface = '#161923'
const darkText = '#090d14'
const lightText = '#ffffff'

type Rgb = [ number, number, number ]

function hexToRgb ( hex: string ): Rgb {
    return [ 1, 3, 5 ].map( index => Number.parseInt( hex.slice( index, index + 2 ), 16 ) ) as Rgb
}

function rgbToHex ( [ red, green, blue ]: Rgb ) {
    return `#${ [ red, green, blue ].map( value => Math.round( value ).toString( 16 ).padStart( 2, '0' ) ).join( '' ) }`
}

export function rgbToHsl ( [ red, green, blue ]: Rgb ) {
    const channels = [ red, green, blue ].map( value => value / 255 )
    const [ min, max ] = [ Math.min( ...channels ), Math.max( ...channels ) ]
    const delta = max - min
    const lightness = ( max + min ) / 2

    if ( delta === 0 ) {
        return { hue: 0, saturation: 0, lightness }
    }

    const saturation = delta / ( 1 - Math.abs( 2 * lightness - 1 ) )
    const [ r, g, b ] = channels
    let hue = max === r ? ( g - b ) / delta % 6 : max === g ? ( b - r ) / delta + 2 : ( r - g ) / delta + 4
    hue = ( hue * 60 + 360 ) % 360

    return { hue, saturation, lightness }
}

function hslToRgb ( hue: number, saturation: number, lightness: number ): Rgb {
    const chroma = ( 1 - Math.abs( 2 * lightness - 1 ) ) * saturation
    const segment = hue / 60
    const secondary = chroma * ( 1 - Math.abs( segment % 2 - 1 ) )
    const offset = lightness - chroma / 2
    const pairs: Rgb[] = [
        [ chroma, secondary, 0 ], [ secondary, chroma, 0 ],
        [ 0, chroma, secondary ], [ 0, secondary, chroma ],
        [ secondary, 0, chroma ], [ chroma, 0, secondary ],
    ]

    return pairs[ Math.floor( segment ) % 6 ].map( value => ( value + offset ) * 255 ) as Rgb
}

function luminance ( rgb: Rgb ) {
    const [ red, green, blue ] = rgb.map( value => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ( ( channel + 0.055 ) / 1.055 ) ** 2.4
    } )

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function contrastRatio ( left: string, right: string ) {
    const [ brighter, darker ] = [ luminance( hexToRgb( left ) ), luminance( hexToRgb( right ) ) ].sort( ( a, b ) => b - a )
    return ( brighter + 0.05 ) / ( darker + 0.05 )
}

export function accessibleAccentFromHue ( hue: number, sourceSaturation: number ) {
    const saturation = Math.max( 0.58, Math.min( 0.86, sourceSaturation ) )

    for ( let lightness = 0.64; lightness <= 0.84; lightness += 0.01 ) {
        const accent = rgbToHex( hslToRgb( hue, saturation, lightness ) )

        if ( contrastRatio( accent, darkSurface ) >= 4.5 ) {
            return accent
        }
    }

    return rgbToHex( hslToRgb( hue, saturation, 0.84 ) )
}

export function makePosterPalette ( accent = fallbackAccent ): PosterPalette {
    const safeAccent = /^#[0-9a-f]{6}$/i.test( accent ) ? accent.toLowerCase() : fallbackAccent
    const { hue, saturation } = rgbToHsl( hexToRgb( safeAccent ) )
    const adjustedAccent = contrastRatio( safeAccent, darkSurface ) >= 4.5
        ? safeAccent
        : accessibleAccentFromHue( hue, saturation )
    const adjustedColor = rgbToHsl( hexToRgb( adjustedAccent ) )
    const hover = rgbToHex( hslToRgb( adjustedColor.hue, adjustedColor.saturation, Math.min( 0.88, adjustedColor.lightness + 0.07 ) ) )
    const buttonText = [ adjustedAccent, hover ].every( color => contrastRatio( color, darkText ) >= 4.5 )
        ? darkText
        : lightText

    return {
        accent: adjustedAccent,
        hover,
        buttonText,
        rgb: hexToRgb( adjustedAccent ).join( ', ' ),
    }
}

export function getPosterPalette ( posterPath: string | undefined, snapshot: PosterPaletteSnapshot ) {
    return makePosterPalette( posterPath ? snapshot.posters[ posterPath ] : undefined )
}
