import { expect, test } from 'vitest'

import { parseTimelineState } from '~/src/helpers/timeline-state.ts'

test( 'timeline state restores scroll, category, sort and expanded card', () => {
    expect( parseTimelineState( JSON.stringify( {
        scrollLeft: 1842,
        sortMode: 'timeline',
        selectedCategory: 'series',
        expandedListingId: 'loki-84958',
    } ) ) ).toEqual( {
        scrollLeft: 1842,
        sortMode: 'timeline',
        selectedCategory: 'series',
        expandedListingId: 'loki-84958',
    } )
} )

test( 'invalid timeline state is ignored', () => {
    expect( parseTimelineState( '{bad json' ) ).toBeNull()
    expect( parseTimelineState( JSON.stringify( {
        scrollLeft: -10,
        sortMode: 'release',
        selectedCategory: 'total',
        expandedListingId: null,
    } ) ) ).toBeNull()
} )
