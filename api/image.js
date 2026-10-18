import sharp from 'sharp'

const sources = {
    tmdb: 'https://image.tmdb.org/t/p/original',
    fanart: 'https://assets.fanart.tv/fanart/movies/0/hdmovielogo',
}

const extensions = {
    tmdb: [ 'jpg', 'png', 'webp' ],
    fanart: [ 'png', 'jpg', 'webp' ],
}

async function getSourceImage ( kind, fileName ) {
    const requestedExtension = fileName.split( '.' ).pop()
    const candidates = [ ...new Set( [ ...extensions[ kind ], requestedExtension ] ) ]
    for ( const extension of candidates ) {
        const sourceUrl = `${ sources[ kind ] }/${ fileName.replace( /\.[^.]+$/, `.${ extension }` ) }`
        const response = await fetch( sourceUrl, { signal: AbortSignal.timeout( 15000 ) } )
        if ( response.ok ) {
            return { buffer: Buffer.from( await response.arrayBuffer() ), sourceUrl }
        }
        if ( response.status !== 404 ) {
            throw new Error( `Image source returned ${ response.status }` )
        }
    }
    return null
}

export default {
    async fetch ( request ) {
        const url = new URL( request.url )
        const kind = url.searchParams.get( 'kind' )
        const fileName = url.searchParams.get( 'path' )
        const width = Number( url.searchParams.get( 'width' ) || 750 )
        const cropTop = Number( url.searchParams.get( 'crop.top' ) || 0 )
        const cropBottom = Number( url.searchParams.get( 'crop.bottom' ) || 0 )
        const transparent = url.searchParams.get( 'transparent' ) !== '0'

        if ( request.method !== 'GET' && request.method !== 'HEAD' ) {
            return new Response( 'Method Not Allowed', { status: 405 } )
        }
        if ( !sources[ kind ] || !/^[a-zA-Z0-9_-]+\.(?:jpg|png|webp|svg|gif)$/.test( fileName || '' )
            || !Number.isInteger( width ) || width < 1 || width > 3000
            || !Number.isFinite( cropTop ) || !Number.isFinite( cropBottom )
            || cropTop < 0 || cropBottom < 0 || cropTop + cropBottom >= 1 ) {
            return new Response( 'Invalid image options', { status: 400 } )
        }

        try {
            const source = await getSourceImage( kind, fileName )
            if ( !source ) {
                return new Response( 'Image not found', { status: 404 } )
            }

            let image = sharp( source.buffer )
            const metadata = await image.metadata()
            if ( metadata.format === 'svg' || metadata.format === 'gif' ) {
                return Response.redirect( source.sourceUrl, 302 )
            }
            if ( !metadata.width || !metadata.height ) {
                return new Response( 'Invalid image', { status: 400 } )
            }
            if ( cropTop || cropBottom ) {
                const top = Math.round( cropTop * metadata.height )
                const height = Math.max( 1, Math.round( ( 1 - cropBottom ) * metadata.height ) - top )
                image = image.extract( { left: 0, top, width: metadata.width, height } )
            }

            let buffer = await image.toBuffer()
            if ( kind === 'fanart' || transparent ) {
                buffer = await sharp( buffer ).trim().toBuffer()
            }
            buffer = await sharp( buffer ).resize( width, null, { withoutEnlargement: true } ).rotate().toBuffer()

            let output = sharp( buffer )
            if ( kind === 'tmdb' && transparent ) {
                const contrast = 1.1
                const mask = await sharp( buffer )
                    .extractChannel( 'red' )
                    .linear( contrast, -( 128 * contrast ) + 128 )
                    .modulate( { brightness: 6.5 } )
                    .toBuffer()
                output = output.ensureAlpha().joinChannel( mask )
            }
            const body = await output.webp( kind === 'fanart' || transparent
                ? { lossless: true }
                : { quality: 95 } ).toBuffer()
            if ( body.length > 6 * 1024 * 1024 ) {
                return new Response( 'Image too large', { status: 413 } )
            }

            return new Response( request.method === 'HEAD' ? null : new Uint8Array( body ), {
                headers: {
                    'Content-Type': 'image/webp',
                    'Cache-Control': 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=604800',
                },
            } )
        }
        catch ( error ) {
            console.error( error )
            return new Response( 'Image unavailable', { status: 502 } )
        }
    },
}
