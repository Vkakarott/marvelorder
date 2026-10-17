<template>
    <img
        v-once
        :src="smallestImage"
        :srcset="srcSet"
        :sizes="displaySizes"
        decoding="async"
        :alt="alt"
    >
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import {
    formatUrlLikeInput,
} from '~/src/helpers/image-paths'
import {
    makeTmdbImageUrl,
} from '~/src/helpers/listing'

function makeSizedImageUrl ( imageUrl: string, size: number ) {
    const sizeUrl = new URL( imageUrl, 'https://example.com' )

    sizeUrl.searchParams.set( 'width', size )

    return formatUrlLikeInput( sizeUrl, imageUrl )
}

export default defineComponent( {
    props: {
        src: {
            type: String,
            required: true,
        },
        alt: {
            type: String,
            required: true,
        },
        sizes: {
            type: Array as PropType<number[]>,
            default: () => [ 75, 100, 275, 550, 850, 1440 ],
        },
        displaySizes: {
            type: String,
            default: '(max-width: 540px) 100vw, 540px',
        },
    },
    computed: {
        imageUrl (): string {
            return makeTmdbImageUrl( this.src )
        },
        srcSet (): string {
            const srcSet: string[] = []

            for ( const size of this.sizes ) {
                srcSet.push( `${ makeSizedImageUrl( this.imageUrl, size ) } ${ size }w` )
            }

            return srcSet.join( ', ' )
        },
        smallestImage (): string {
            return makeSizedImageUrl( this.imageUrl, this.sizes[ 0 ] )
        },
    },
} )
</script>
