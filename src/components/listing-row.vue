<template>
    <Teleport to="#listing-filter-controls">
        <details ref="categoryMenu" class="relative text-sm text-white" @keydown.esc.prevent="closeCategoryMenu">
            <summary class="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/30 bg-black/70 px-4 py-2 backdrop-blur hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                Listagem
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
            </summary>
            <div class="absolute left-0 top-full mt-2 min-w-48 rounded-xl border border-white/20 bg-gray-950/95 p-1 shadow-xl backdrop-blur">
                <button
                    v-for="option in categoryOptions"
                    :key="option.value"
                    type="button"
                    class="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    :class="isGlobalList && selectedCategory === option.value ? 'bg-white/15 font-semibold' : ''"
                    :aria-current="isGlobalList && selectedCategory === option.value ? 'true' : undefined"
                    @click="selectCategory(option.value)"
                >
                    {{ option.label }}
                </button>
            </div>
        </details>
    </Teleport>
    <Teleport to="#footer-controls">
        <div class="flex items-center gap-2" role="group" aria-label="Ordem dos títulos">
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
    isMCU,
    isShow,
    isUpcoming,
} from '~/src/helpers/listing-filters'
import type { MappedListing } from '~/src/helpers/node/listing'
import type { Listing } from '~/src/helpers/types'

type ListingLike = Listing | MappedListing
type ActiveListingFilters = Array<[Function, boolean]>
type SortMode = 'timeline' | 'release'
type ListingCategory = 'total' | 'mcu' | 'movies' | 'series'
const sortStorageKey = 'cinearc:listing-order'
const categoryOptions: Array<{ value: ListingCategory, label: string }> = [
    { value: 'total', label: 'Total' },
    { value: 'mcu', label: 'MCU' },
    { value: 'movies', label: 'Apenas filmes' },
    { value: 'series', label: 'Apenas séries' },
]

function isMovie ( listing: MappedListing ): boolean {
    return listing.type === 'movie' || ( !listing.type && listing.hasTag( 'movie' ) )
}

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
        isGlobalList: {
            type: Boolean,
            default: false,
        },
    },
    data () {
        return {
            activeListingFilters: [] as ActiveListingFilters,
            expandedListingId: null as string | null,
            sortMode: 'release' as SortMode,
            selectedCategory: 'total' as ListingCategory,
            categoryOptions,
        }
    },
    mounted () {
        if ( this.isGlobalList ) {
            const requestedCategory = new URLSearchParams( window.location.search ).get( 'view' )

            if ( categoryOptions.some( option => option.value === requestedCategory ) ) {
                this.selectedCategory = requestedCategory as ListingCategory
                this.$nextTick( () => this.scrollToFocusedListing( 'auto' ) )
            }
        }

        try {
            if ( window.localStorage.getItem( sortStorageKey ) === 'timeline' ) {
                this.setSortMode( 'timeline', true )
            }
        }
        catch {
            // Browsers can disable local storage.
        }
    },
    computed: {
        filteredListings (): FilteredListings {
            const categoryFilters: ActiveListingFilters = []

            if ( this.isGlobalList ) {
                if ( this.selectedCategory === 'mcu' ) categoryFilters.push( [ isMCU, true ] )
                if ( this.selectedCategory === 'movies' ) categoryFilters.push( [ isMovie, true ] )
                if ( this.selectedCategory === 'series' ) categoryFilters.push( [ isShow, true ] )
            }

            return new FilteredListings( {
                listings: this.listings,
                initialFilters: [ ...this.activeListingFilters, ...categoryFilters ],
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
        closeCategoryMenu (): void {
            const menu = this.$refs.categoryMenu as HTMLDetailsElement | undefined
            if ( menu ) menu.open = false
        },

        selectCategory ( category: ListingCategory ): void {
            this.closeCategoryMenu()

            const url = new URL( window.location.href )

            if ( category === 'total' ) url.searchParams.delete( 'view' )
            else url.searchParams.set( 'view', category )

            if ( !this.isGlobalList ) {
                window.location.assign( `/${ url.search }` )
                return
            }

            window.history.replaceState( null, '', url )

            if ( this.selectedCategory === category ) return

            this.selectedCategory = category
            this.$nextTick( () => this.scrollToFocusedListing( 'smooth' ) )
        },

        scrollToFocusedListing ( behavior: ScrollBehavior ): void {
            const row = this.$refs.row as HTMLElement | undefined
            const focusedCard = row?.querySelector<HTMLElement>( '.listing-card-initial' )

            if ( row && focusedCard ) {
                row.scrollTo( {
                    left: focusedCard.offsetLeft - window.innerWidth + focusedCard.offsetWidth * 1.75,
                    behavior,
                } )
            }
        },

        setSortMode ( mode: SortMode, restoring = false ): void {
            if ( this.sortMode === mode ) {
                return
            }

            this.sortMode = mode

            if ( !restoring ) {
                try {
                    window.localStorage.setItem( sortStorageKey, mode )
                }
                catch {
                    // Keep the control usable when storage is unavailable.
                }
            }

            this.$nextTick( () => this.scrollToFocusedListing( restoring ? 'auto' : 'smooth' ) )
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
