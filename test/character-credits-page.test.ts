import { expect, test } from 'vitest'

import { extractCharacters } from '~/src/helpers/characters.ts'
import { parseCharacterCreditsPage } from '~/src/helpers/node/character-credits-page.ts'

test( 'movie cast pages provide character names without displaying performers', () => {
    const html = `
        <ol class="people credits">
            <li data-order="0"><div class="info">
                <p><a href="/person/1">Robert Downey Jr.</a></p>
                <p class="character">Tony Stark</p>
            </div></li>
            <li data-order="1"><div class="info">
                <p><a href="/person/2">Jeff Bridges</a></p>
                <p class="character">Obadiah Stane</p>
            </div></li>
            <li data-order="2"><div class="info">
                <p><a href="/person/3">Extra</a></p>
                <p class="character">Security Guard #1</p>
            </div></li>
        </ol>
    `

    expect( extractCharacters( parseCharacterCreditsPage( html, 'movie' ), 'movie' ) )
        .toEqual( [ 'Tony Stark', 'Obadiah Stane' ] )
} )

test( 'series cast pages separate roles and remove episode counts', () => {
    const html = `
        <ol class="people credits">
            <li data-order="0"><div class="info">
                <p><a href="/person/1">Tom Hiddleston</a></p>
                <p class="character"><a href="/tv/1/episodes?credit_id=1">Loki Laufeyson</a> <span>(12 episódios)</span></p>
            </div></li>
            <li data-order="1"><div class="info">
                <p><a href="/person/2">Jonathan Majors</a></p>
                <p class="character">
                    <a href="/tv/1/episodes?credit_id=2">He Who Remains</a> <span>(1 episódio)</span>,
                    <a href="/tv/1/episodes?credit_id=3">Victor Timely / He Who Remains</a> <span>(3 episódios)</span>
                </p>
            </div></li>
        </ol>
    `

    expect( extractCharacters( parseCharacterCreditsPage( html, 'tv' ), 'tv' ) )
        .toEqual( [ 'Loki Laufeyson', 'Victor Timely / He Who Remains' ] )
} )
