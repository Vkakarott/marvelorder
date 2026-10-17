const callbacks = new WeakMap<Element, () => void>()
let observer: IntersectionObserver | undefined

export function observeNearViewport ( element: Element, callback: () => void ): () => void {
    if ( typeof IntersectionObserver === 'undefined' ) {
        callback()
        return () => {}
    }

    observer ??= new IntersectionObserver( ( entries ) => {
        for ( const entry of entries ) {
            if ( !entry.isIntersecting ) {
                continue
            }

            observer?.unobserve( entry.target )
            const notify = callbacks.get( entry.target )
            callbacks.delete( entry.target )
            notify?.()
        }
    }, { rootMargin: '300px' } )

    callbacks.set( element, callback )
    observer.observe( element )

    return () => {
        observer?.unobserve( element )
        callbacks.delete( element )
    }
}
