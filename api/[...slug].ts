import { handler as handleFanartImage } from '../src/pages/api/fanart/[...slug]'
import { handler as handleTmdbImage } from '../src/pages/api/tmdb-image/[...slug]'

export default {
    async fetch ( request: Request ) {
        const url = new URL( request.url )
        const handler = url.pathname.startsWith( '/api/tmdb-image/' )
            ? handleTmdbImage
            : url.pathname.startsWith( '/api/fanart/' )
                ? handleFanartImage
                : null

        if ( request.method !== 'GET' || !handler ) {
            return new Response( 'Not Found', { status: 404 } )
        }

        try {
            const { statusCode, headers, body } = await handler( { url } )
            const responseBody = Buffer.isBuffer( body ) ? new Uint8Array( body ) : body
            return new Response( responseBody, { status: statusCode, headers } )
        }
        catch ( error ) {
            console.error( error )
            return new Response( 'Image unavailable', { status: 502 } )
        }
    },
}
