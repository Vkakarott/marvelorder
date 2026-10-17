<template>
    <Teleport to="#footer-controls">
        <div class="flex items-center gap-2" role="group" aria-label="Ordem dos títulos">
            <span class="hidden text-xs text-gray-300 sm:inline">Ordem</span>
            <div class="inline-flex rounded-full border border-white/30 bg-black/70 p-1 backdrop-blur">
                <button
                    type="button"
                    class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    :class="sortMode === 'timeline' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'"
                    :aria-pressed="sortMode === 'timeline'"
                    @click="setSortMode('timeline')"
                >
                    Cronológica
                </button>
                <button
                    type="button"
                    class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    :class="sortMode === 'release' ? 'bg-white text-black' : 'text-gray-300 hover:text-white'"
                    :aria-pressed="sortMode === 'release'"
                    @click="setSortMode('release')"
                >
                    Lançamento
                </button>
            </div>
        </div>
    </Teleport>
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
type SortMode = 'timeline' | 'release'
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
            sortMode: ( this.initialSort === 'timeline' ? 'timeline' : 'release' ) as SortMode,
        }
    },
    computed: {
        filteredListings (): FilteredListings {
            return new FilteredListings( {
                listings: this.listings,
                initialFilters: this.activeListingFilters,
                listingsSort: this.sortMode === 'timeline' ? 'timeline' : 'premiere-reversed',
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
        setSortMode ( mode: SortMode ): void {
            if ( this.sortMode === mode ) {
                return
            }

            this.sortMode = mode
            this.$nextTick( () => {
                const row = this.$refs.row as HTMLElement | undefined
                const focusedCard = row?.querySelector<HTMLElement>( '.listing-card-initial' )

                if ( row && focusedCard ) {
                    row.scrollTo( {
                        left: focusedCard.offsetLeft - window.innerWidth + focusedCard.offsetWidth * 1.75,
                        behavior: 'smooth',
                    } )
                }
            } )
        },

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
