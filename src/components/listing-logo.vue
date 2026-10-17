<template>
    <img
        :src="srcImage"
        :srcset="srcSet"
        :loading="loading"
        :fetchpriority="loading === 'eager' ? 'high' : undefined"
        decoding="async"
        :alt="alt"
    >
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import { formatUrlLikeInput } from '~/src/helpers/image-paths'

import type { Listing } from '~/src/helpers/types'

type ListingLogoSource = string | Pick<Listing, 'logo_on_black'>

function makeSizedImageUrl ( imageUrl: string, size: number ) {
    const sizeUrl = new URL( imageUrl, 'https://example.com' )

    sizeUrl.searchParams.set( 'width', size )
    sizeUrl.searchParams.set( 'v', '2' )

    return formatUrlLikeInput( sizeUrl, imageUrl )
}

export default defineComponent( {
    props: {
        src: {
            type: [ String, Object ] as PropType<ListingLogoSource>,
            required: true,
        },
        alt: {
            type: String,
            required: true,
        },
        baseSize: {
            type: Number,
            default: 275,
        },
        loading: {
            type: String as PropType<'eager' | 'lazy'>,
            default: 'lazy',
        },
        sizes: {
            type: Array as PropType<number[]>,
            default: () => [ 1, 2, 3 ],
        },
    },
    computed: {
        logoUrl (): string {
            if ( typeof this.src === 'object' && this.src?.logo_on_black ) {
                return this.src.logo_on_black
            }

            return this.src
        },
        srcSet (): string {
            const srcSet: string[] = []

            for ( const size of this.sizes ) {
                const pixelWidth = Math.round( this.baseSize * size )

                srcSet.push( `${ makeSizedImageUrl( this.logoUrl, pixelWidth ) } ${ size }x` )
            }

            return srcSet.join( ', ' )
        },
        srcImage (): string {
            return makeSizedImageUrl( this.logoUrl, Math.round( this.baseSize * this.sizes[ 0 ] ) )
        },
    },
} )
</script>
