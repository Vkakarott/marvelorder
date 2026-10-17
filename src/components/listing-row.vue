<template>
    <div class="listing-row-container relative fill-height w-screen">
        <div
            ref="row"
            class="listing-row flex overflow-x-auto overflow-y-hidden whitespace-no-wrap px-32"
            style="scroll-snap-type: x mandatory;"
        >
            <div class="start-cap w-full flex-shrink-0 max-w-xs snap-start" />

            <template
                v-for="(listing, index) in sortedListings"
                :key="listing.elementId"
            >
                <ListingColumn
                    :listing="listing"
                    :index="index"
                    :image-loading="isFocusedListing(listing) ? 'eager' : 'lazy'"
                    :class="[
                        isFocusedListing(listing) ? 'listing-card-initial' : '',
                    ]"

                    :expanded="expandedListingId === listing.elementId"
                    @expand="expandedListingId = listing.elementId"
                    @contract="expandedListingId = null"
                />
            </template>

            <div class="end-cap w-full flex-shrink-0 max-w-xs snap-end" />
        </div>

        <CircleButton
            class="absolute left-12 transform -translate-y-1/2 -translate-x-1/2"
            style="top:50%;"
            aria-label="Ver títulos anteriores"

            @click="scroll(-0.8)"
        >
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5 text-gray-400" style="transform: scaleX(-1);">
                <path
                    fill-rule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clip-rule="evenodd"
                />
            </svg>
        </CircleButton>
        <CircleButton
            class="absolute right-12 transform -translate-y-1/2 translate-x-1/2"
            style="top:50%;"
            aria-label="Ver próximos títulos"

            @click="scroll(0.8)"
        >
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5 text-gray-400">
                <path
                    fill-rule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clip-rule="evenodd"
                />
            </svg>
        </CircleButton>
    </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'
import ListingColumn from './listing-column.vue'
import CircleButton from './circle-button.vue'
import {
    FilteredListings,
    isUpcoming,
} from '~/src/helpers/listing-filters'
import type { MappedListing } from '~/src/helpers/node/listing'
import type { Listing } from '~/src/helpers/types'

type ListingLike = Listing | MappedListing
type ActiveListingFilters = Array<[Function, boolean]>
export default defineComponent( {
    components: {
        ListingColumn,
        CircleButton,
    },
    props: {
        listings: {
            type: Array as PropType<ListingLike[]>,
            required: true,
        },
        initialSort: {
            type: String,
            default: 'default',
        },
    },
    data () {
        return {
            activeListingFilters: [] as ActiveListingFilters,
            expandedListingId: null as string | null,
        }
    },
    computed: {
        filteredListings (): FilteredListings {
            return new FilteredListings( {
                listings: this.listings,
                initialFilters: this.activeListingFilters,
                listingsSort: this.initialSort,
            } )
        },
        sortedListings (): MappedListing[] {
            return this.filteredListings.list
        },
        upcomingListings (): MappedListing[] {
            return this.filteredListings.withFilters( [
                [ isUpcoming, true ],
            ] )
        },
        nextUpcomingListing (): MappedListing | undefined {
            return this.upcomingListings[ 0 ]
        },
        lastListing (): MappedListing | undefined {
            return this.sortedListings[ this.sortedListings.length - 1 ]
        },
        focusedListing (): MappedListing | undefined {
            if ( !this.nextUpcomingListing ) {
                return this.lastListing
            }

            return this.nextUpcomingListing
        },
    },
    methods: {
        isFocusedListing ( listing: MappedListing ): boolean {
            return listing.elementId === this.focusedListing?.elementId
        },

        // Scrolls by window width time ratio
        scroll ( ratio: number ): void {
            const windowWidth = window.innerWidth
            const scrollDistance = windowWidth * ratio

            const row = this.$refs.row as HTMLElement | undefined

            row?.scrollBy( {
                // top: 100, // negative value acceptable
                left: scrollDistance,
                behavior: 'smooth',
            } )
        },
    },
} )
</script>
