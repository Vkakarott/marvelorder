import { expect, test, vi } from 'vitest'
import fetch from 'node-fetch'
import sharp from 'sharp'

import { handler } from '~/src/pages/api/tmdb-image/[...slug].ts'

vi.mock( 'node-fetch', () => ( { default: vi.fn() } ) )

test( 'trims a logo before sizing it for the requested display width', async () => {
    const logo = await sharp( {
        create: { width: 800, height: 100, channels: 3, background: 'white' },
    } ).png().toBuffer()
    const source = await sharp( {
        create: { width: 1000, height: 250, channels: 3, background: 'black' },
    } ).composite( [ { input: logo, left: 100, top: 75 } ] ).png().toBuffer()

    vi.mocked( fetch ).mockResolvedValue( {
        status: 200,
        ok: true,
        buffer: async () => source,
    } as Awaited<ReturnType<typeof fetch>> )

    const response = await handler( {
        url: new URL( 'http://localhost:4321/api/tmdb-image/example.webp?width=175' ),
    } )

    expect( response.statusCode ).toBe( 200 )
    const output = Buffer.from( response.body as Buffer )
    expect( ( await sharp( output ).metadata() ).width ).toBe( 175 )
    expect( output.toString( 'ascii', 12, 16 ) ).toBe( 'VP8L' )
} )
