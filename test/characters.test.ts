import { expect, test } from 'vitest'

import {
    extractCharacters,
    getCharactersForListing,
    mergeCharacters,
    type CharacterSnapshot,
} from '~/src/helpers/characters.ts'

test( 'movie credits show named characters without actors or unnamed roles', () => {
    const characters = extractCharacters( {
        cast: [
            { name: 'Robert Downey Jr.', character: 'Tony Stark / Iron Man', order: 0 },
            { name: 'Gwyneth Paltrow', character: 'Pepper Potts', order: 1 },
            { name: 'Jeff Bridges', character: 'Obadiah Stane', order: 2 },
            { name: 'Voice Actor', character: 'Iron Man (voice)', order: 3 },
            { name: 'Extra', character: 'Security Guard #1', order: 4 },
            { name: 'Robert Downey Jr.', character: 'Robert Downey Jr.', order: 5 },
            { name: 'Presenter', character: 'Self', order: 6 },
            { name: 'Extra', character: 'Award Ceremony Narrator', order: 7 },
            { name: 'Voice Actor', character: 'The Mandarin / Additional Voices', order: 8 },
            { name: 'Hero', character: 'Bucky Barnes / Winter Soldier', order: 9 },
            { name: 'Heroine', character: 'Sue Storm / Invisible Woman', order: 10 },
        ],
    }, 'movie' )

    expect( characters ).toEqual( [
        'Tony Stark / Iron Man',
        'Pepper Potts',
        'Obadiah Stane',
        'The Mandarin',
        'Bucky Barnes / Winter Soldier',
        'Sue Storm / Invisible Woman',
    ] )
} )

test( 'series credits include recurring heroes and villains across all seasons', () => {
    const characters = extractCharacters( {
        cast: [
            {
                name: 'Charlie Cox',
                order: 0,
                roles: [
                    { character: 'Matt Murdock', episode_count: 15 },
                    { character: 'Matt Murdock / Daredevil', episode_count: 18 },
                ],
            },
            { name: 'Vincent D\'Onofrio', order: 1, roles: [ { character: 'Wilson Fisk / Kingpin', episode_count: 12 } ] },
            { name: 'Extra', order: 2, roles: [ { character: 'Police Officer', episode_count: 1 } ] },
        ],
    }, 'tv' )

    expect( characters ).toEqual( [ 'Matt Murdock / Daredevil', 'Wilson Fisk / Kingpin' ] )
} )

test( 'character snapshots use media identity and preserve previous observations', () => {
    const snapshot: CharacterSnapshot = {
        version: 1,
        titles: {
            'movie:1726': {
                fetchedAt: '2026-10-24',
                characters: [ 'Tony Stark / Iron Man', 'Obadiah Stane' ],
            },
            'tv:1726': {
                fetchedAt: '2026-10-24',
                characters: [ 'Different Character' ],
            },
        },
    }

    expect( getCharactersForListing( { id: 1726, type: 'movie', title: 'Iron Man', original_language: 'en' }, snapshot ) )
        .toEqual( [ 'Tony Stark / Iron Man', 'Obadiah Stane' ] )
    expect( mergeCharacters( [ 'Tony Stark' ], [ 'Tony Stark / Iron Man', 'Pepper Potts' ] ) )
        .toEqual( [ 'Tony Stark / Iron Man', 'Pepper Potts' ] )
} )
