import { expect, test } from 'vitest'

import { getLanguageFromURL } from '~/src/languages.ts'

test( 'Portuguese pages and the homepage use the same language', () => {
    expect( getLanguageFromURL( '/pt-br/eyes-of-wakanda-241388/' ) ).toBe( 'pt-br' )
    expect( getLanguageFromURL( '/' ) ).toBe( 'pt-br' )
} )
