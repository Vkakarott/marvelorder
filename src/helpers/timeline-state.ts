export const timelineStateStorageKey = 'cinearc:timeline-state:v1'

export type TimelineSortMode = 'timeline' | 'release'
export type TimelineCategory = 'total' | 'mcu' | 'movies' | 'series'

export interface TimelineState {
    scrollLeft: number
    sortMode: TimelineSortMode
    selectedCategory: TimelineCategory
    expandedListingId: string | null
}

export function parseTimelineState ( raw: string | null ): TimelineState | null {
    if ( !raw ) {
        return null
    }

    try {
        const value = JSON.parse( raw )

        if (
            !Number.isFinite( value.scrollLeft )
            || value.scrollLeft < 0
            || ![ 'timeline', 'release' ].includes( value.sortMode )
            || ![ 'total', 'mcu', 'movies', 'series' ].includes( value.selectedCategory )
            || ( value.expandedListingId !== null && typeof value.expandedListingId !== 'string' )
        ) {
            return null
        }

        return value as TimelineState
    }
    catch {
        return null
    }
}
