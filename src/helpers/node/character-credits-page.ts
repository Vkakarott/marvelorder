import { parseHTML } from 'linkedom'

interface CastRole {
    character: string
    episode_count?: number
}

interface CastCredit {
    name: string
    order: number
    character?: string
    roles?: CastRole[]
}

export function parseCharacterCreditsPage ( html: string, mediaType: 'movie' | 'tv' ) {
    const { document } = parseHTML( html )
    const cast: CastCredit[] = []

    for ( const item of document.querySelectorAll( 'ol.people.credits > li' ) ) {
        const characterElement = item.querySelector( 'p.character' )

        if ( !characterElement ) {
            continue
        }

        const name = item.querySelector( '.info a[href^="/person/"]' )?.textContent?.trim() || ''
        const orderAttribute = item.getAttribute( 'data-order' )
        const order = orderAttribute === null ? cast.length : Number( orderAttribute )

        if ( mediaType === 'movie' ) {
            cast.push( {
                name,
                order: Number.isFinite( order ) ? order : cast.length,
                character: characterElement.textContent.trim(),
            } )
            continue
        }

        const linkedRoles = [ ...characterElement.querySelectorAll( 'a' ) ]
        const roles = linkedRoles.length > 0
            ? linkedRoles.map( link => ( {
                character: link.textContent.trim(),
                episode_count: Number( link.nextElementSibling?.textContent?.match( /\d+/ )?.[ 0 ] || 0 ),
            } ) )
            : [ {
                character: characterElement.textContent.replace( /\s*\(\d+ epis[oó]dios?\)/gi, '' ).trim(),
                episode_count: 0,
            } ]

        cast.push( {
            name,
            order: Number.isFinite( order ) ? order : cast.length,
            roles,
        } )
    }

    return { cast }
}
