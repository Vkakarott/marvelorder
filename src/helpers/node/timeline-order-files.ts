import fs from 'fs-extra'

import { markdownStorePath } from '~/src/config.ts'
import { makeListingEndpoint } from '~/src/helpers/listing.ts'
import { setFrontmatterTimelineOrder, type TimelineOrderPlan } from '~/src/helpers/node/timeline-order-sync.ts'
import type { Listing } from '~/src/helpers/types.ts'

async function rewriteOrder ( listing: Listing, order: number | null ): Promise<void> {
    const filePath = `${ markdownStorePath }/${ makeListingEndpoint( listing ) }.md`
    const markdown = await fs.readFile( filePath, 'utf8' )

    await fs.writeFile( filePath, setFrontmatterTimelineOrder( markdown, order ) )
}

export async function applyTimelineOrderPlan ( plan: TimelineOrderPlan ): Promise<void> {
    for ( const { listing, order } of plan.updates ) {
        await rewriteOrder( listing, order )
    }

    for ( const listing of plan.clears ) {
        await rewriteOrder( listing, null )
    }
}
