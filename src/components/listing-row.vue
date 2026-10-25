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
    <Teleport to="#listing-filter-controls">
        <div v-if="characterSelection.hasQuery" class="flex max-w-[min(90vw,40rem)] flex-wrap items-center gap-2 rounded-xl border border-white/25 bg-black/80 px-3 py-2 text-xs text-white backdrop-blur" aria-live="polite">
            <span v-if="indexStatus === 'loading'">Carregando filtro de personagens...</span>
            <span v-else-if="indexStatus === 'error'">Não foi possível carregar o filtro de personagens.</span>
            <span v-else-if="characterSelection.invalid">Filtro de personagem inválido.</span>
            <template v-else>
                <span>Personagens:</span>
                <button v-for="id in characterSelection.ids" :key="id" type="button" class="rounded-full border border-white/40 px-2 py-1 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" :aria-label="`Remover ${characterIndex.entries[id].name} do filtro`" @click="removeCharacter(id)">
                    {{ characterIndex.entries[id].name }} <span aria-hidden="true">×</span>
                </button>
                <span>{{ sortedListings.length }} {{ sortedListings.length === 1 ? 'título' : 'títulos' }}</span>
            </template>
            <button type="button" class="rounded-full bg-white px-2 py-1 font-semibold text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" @click="clearCharacters">Limpar filtro</button>
            <span v-if="indexStatus === 'ready' && !characterSelection.invalid && sortedListings.length === 0">Nenhum título nesta listagem.</span>
            <span class="w-full text-gray-300">Cobertura parcial: vínculos entre obras aparecem quando confirmados.</span>
        </div>
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
            @scroll.passive="scheduleStateSave"
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
                    @expand="expandListing(listing)"
                    @contract="contractListing"
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
import { filterListingsByCharacters, parseCharacterSelection, type CharacterSelection, type CharacterTimelineIndex } from '~/src/helpers/character-links'
import {
    parseTimelineState,
    timelineStateStorageKey,
    type TimelineCategory,
    type TimelineSortMode,
    type TimelineState,
} from '~/src/helpers/timeline-state'

type ListingLike = Listing | MappedListing
type ActiveListingFilters = Array<[Function, boolean]>
type SortMode = TimelineSortMode
type ListingCategory = TimelineCategory
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
            stateSaveFrame: 0,
            characterSelection: { hasQuery: false, ids: [], invalid: false } as CharacterSelection,
            characterIndex: { entries: {} } as CharacterTimelineIndex,
            indexStatus: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
        }
    },
    mounted () {
        const hasCharacterQuery = new URLSearchParams( window.location.search ).has( 'personagem' )
        this.characterSelection = hasCharacterQuery
            ? { hasQuery: true, ids: [], invalid: false }
            : parseCharacterSelection( window.location.search, this.characterIndex )
        let savedState: TimelineState | null = null

        if ( this.isGlobalList ) {
            try {
                savedState = parseTimelineState( window.localStorage.getItem( timelineStateStorageKey ) )
            }
            catch {
                savedState = null
            }
        }

        const requestedCategory = new URLSearchParams( window.location.search ).get( 'view' )
        const hasRequestedCategory = categoryOptions.some( option => option.value === requestedCategory )

        if ( this.isGlobalList ) {
            if ( hasRequestedCategory ) {
                this.selectedCategory = requestedCategory as ListingCategory
            }
            else if ( savedState && !this.characterSelection.hasQuery ) {
                this.selectedCategory = savedState.selectedCategory

                if ( this.selectedCategory !== 'total' ) {
                    const url = new URL( window.location.href )
                    url.searchParams.set( 'view', this.selectedCategory )
                    window.history.replaceState( window.history.state, '', url )
                }
            }
        }

        try {
            this.sortMode = savedState?.sortMode
                || ( window.localStorage.getItem( sortStorageKey ) === 'timeline' ? 'timeline' : 'release' )
        }
        catch {
            this.sortMode = savedState?.sortMode || 'release'
        }

        this.expandedListingId = this.characterSelection.hasQuery ? null : savedState?.expandedListingId || null
        window.addEventListener( 'pagehide', this.saveState )
        window.addEventListener( 'popstate', this.syncCharacterSelectionFromUrl )
        if ( hasCharacterQuery ) {
            void this.syncCharacterSelectionFromUrl()
        }

        this.$nextTick( () => {
            const row = this.$refs.row as HTMLElement | undefined

            if ( savedState && !this.characterSelection.hasQuery && ( !hasRequestedCategory || savedState.selectedCategory === this.selectedCategory ) && row ) {
                row.scrollLeft = savedState.scrollLeft
            }
            else {
                this.scrollToFocusedListing( 'auto' )
            }
        } )
    },
    beforeUnmount () {
        window.removeEventListener( 'pagehide', this.saveState )
        window.removeEventListener( 'popstate', this.syncCharacterSelectionFromUrl )
        window.cancelAnimationFrame( this.stateSaveFrame )
    },
    computed: {
        filteredListings (): FilteredListings {
            const categoryFilters: ActiveListingFilters = []

            if ( this.isGlobalList ) {
                if ( this.selectedCategory === 'mcu' ) {
                    categoryFilters.push( [ isMCU, true ] )
                }
                if ( this.selectedCategory === 'movies' ) {
                    categoryFilters.push( [ isMovie, true ] )
                }
                if ( this.selectedCategory === 'series' ) {
                    categoryFilters.push( [ isShow, true ] )
                }
            }

            return new FilteredListings( {
                listings: this.listings,
                initialFilters: [ ...this.activeListingFilters, ...categoryFilters ],
                listingsSort: this.sortMode === 'timeline' ? 'timeline' : 'premiere-reversed',
            } )
        },
        sortedListings (): MappedListing[] {
            return filterListingsByCharacters( this.filteredListings.list, this.characterSelection, this.characterIndex )
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
            if ( this.characterSelection.hasQuery ) {
                return this.sortedListings[ 0 ]
            }
            if ( !this.nextUpcomingListing ) {
                return this.lastListing
            }

            return this.nextUpcomingListing
        },
    },
    methods: {
        async syncCharacterSelectionFromUrl (): Promise<void> {
            const params = new URLSearchParams( window.location.search )
            if ( params.has( 'personagem' ) && this.indexStatus !== 'ready' ) {
                this.characterSelection = { hasQuery: true, ids: [], invalid: false }
                this.indexStatus = 'loading'
                try {
                    const response = await fetch( '/character-index.json' )
                    if ( !response.ok ) {
                        throw new Error( `Character index HTTP ${ response.status }` )
                    }
                    this.characterIndex = await response.json() as CharacterTimelineIndex
                    this.indexStatus = 'ready'
                }
                catch {
                    this.indexStatus = 'error'
                    this.characterSelection = { hasQuery: true, ids: [], invalid: true }
                    this.revealListingRow()
                    return
                }
            }
            this.characterSelection = parseCharacterSelection( window.location.search, this.characterIndex )
            const requestedCategory = params.get( 'view' )
            this.selectedCategory = categoryOptions.some( option => option.value === requestedCategory )
                ? requestedCategory as ListingCategory : 'total'
            this.expandedListingId = null
            this.$nextTick( () => {
                this.revealListingRow()
                this.scrollToFocusedListing( 'auto' )
            } )
        },
        revealListingRow (): void {
            document.documentElement.classList.remove( 'character-filter-pending' )
        },
        removeCharacter ( id: string ): void {
            const url = new URL( window.location.href )
            url.searchParams.delete( 'personagem' )
            for ( const remaining of this.characterSelection.ids.filter( value => value !== id ) ) {
                url.searchParams.append( 'personagem', remaining )
            }
            window.history.pushState( null, '', url )
            this.syncCharacterSelectionFromUrl()
        },
        clearCharacters (): void {
            const url = new URL( window.location.href )
            url.searchParams.delete( 'personagem' )
            window.history.pushState( null, '', url )
            this.syncCharacterSelectionFromUrl()
        },
        closeCategoryMenu (): void {
            const menu = this.$refs.categoryMenu as HTMLDetailsElement | undefined
            if ( menu ) {
                menu.open = false
            }
        },

        selectCategory ( category: ListingCategory ): void {
            this.closeCategoryMenu()

            const url = new URL( window.location.href )

            if ( category === 'total' ) {
                url.searchParams.delete( 'view' )
            }
            else {
                url.searchParams.set( 'view', category )
            }

            if ( !this.isGlobalList ) {
                window.location.assign( `/${ url.search }` )
                return
            }

            window.history.replaceState( null, '', url )

            if ( this.selectedCategory === category ) {
                return
            }

            this.selectedCategory = category
            this.expandedListingId = null
            this.$nextTick( () => {
                this.scrollToFocusedListing( 'smooth' )
                this.saveState()
            } )
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

        setSortMode ( mode: SortMode ): void {
            if ( this.sortMode === mode ) {
                return
            }

            this.sortMode = mode

            try {
                window.localStorage.setItem( sortStorageKey, mode )
            }
            catch {
                // Keep the control usable when storage is unavailable.
            }

            this.$nextTick( () => {
                this.scrollToFocusedListing( 'smooth' )
                this.saveState()
            } )
        },

        expandListing ( listing: MappedListing ): void {
            this.expandedListingId = listing.elementId
            this.saveState()
        },

        contractListing (): void {
            this.expandedListingId = null
            this.saveState()
        },

        scheduleStateSave (): void {
            if ( !this.isGlobalList || this.stateSaveFrame ) {
                return
            }

            this.stateSaveFrame = window.requestAnimationFrame( () => {
                this.stateSaveFrame = 0
                this.saveState()
            } )
        },

        saveState (): void {
            if ( !this.isGlobalList || this.characterSelection.hasQuery ) {
                return
            }

            const row = this.$refs.row as HTMLElement | undefined

            if ( !row ) {
                return
            }

            try {
                window.localStorage.setItem( timelineStateStorageKey, JSON.stringify( {
                    scrollLeft: row.scrollLeft,
                    sortMode: this.sortMode,
                    selectedCategory: this.selectedCategory,
                    expandedListingId: this.expandedListingId,
                } satisfies TimelineState ) )
            }
            catch {
                // Keep navigation usable when storage is unavailable.
            }
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
