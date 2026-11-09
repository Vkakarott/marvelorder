// Decides which listings stay out of the public catalog (draft) without a
// person editing markdown. Pure functions: callers inject all file access.
//
// Precedence, strongest first:
//   1. an explicit `draft` in frontmatter (true or false) is never touched
//   2. the versioned suppression list (owner decisions, applied to any file)
//   3. conservative title/genre rules, applied only to titles new to the catalog

import { getListingIdentity, type ListingFrontmatter } from './listing-identity.ts'

export interface Suppression {
    identity: string
    title: string
    reason: string
}

export interface AutoDraft {
    draft: true
    autoDraft: string
}

interface DraftRule {
    reason: string
    matches: ( listing: ListingFrontmatter ) => boolean
}

function getTitle ( listing: ListingFrontmatter ): string {
    return String( listing.title || listing.name || '' )
}

// Evidence from the checked-in catalog (2026-11-08): 10 non-Marvel-Studios
// documentaries are kept visible by the owner, so genre 99 is not a safe
// signal and is deliberately not a rule. Known extras live in the
// suppression list instead.
const draftRules: DraftRule[] = [
    { reason: 'rule-podcast', matches: listing => /\bpodcast\b/i.test( getTitle( listing ) ) },
    { reason: 'rule-lego', matches: listing => /\blego\b/i.test( getTitle( listing ) ) },
    { reason: 'rule-short-or-featurette', matches: listing => /\bshorts\b|\bfeaturette\b|behind the scenes/i.test( getTitle( listing ) ) },
]

export function getRuleReason ( listing: ListingFrontmatter ): string | null {
    return draftRules.find( rule => rule.matches( listing ) )?.reason ?? null
}

export function getSuppressionReason ( listing: ListingFrontmatter, suppressions: Suppression[] ): string | null {
    const identity = getListingIdentity( listing )

    return suppressions.find( entry => entry.identity === identity )?.reason ?? null
}

interface DecideOptions {
    frontmatter: ListingFrontmatter
    listing: ListingFrontmatter
    suppressions: Suppression[]
    // Rules only judge titles the catalog has never seen before
    isNew: boolean
}

export function decideAutoDraft ( options: DecideOptions ): AutoDraft | null {
    const { frontmatter, listing, suppressions, isNew } = options

    // An explicit value, including draft: false, always wins
    if ( frontmatter.draft !== undefined ) {
        return null
    }

    const reason = getSuppressionReason( listing, suppressions ) ?? ( isNew ? getRuleReason( listing ) : null )

    return reason ? { draft: true, autoDraft: reason } : null
}

// Inserts the draft keys at the top of the frontmatter without reformatting
// the rest of the file, so data commits stay free of noise.
export function addDraftToMarkdown ( markdown: string, autoDraft: AutoDraft ): string {
    if ( !markdown.startsWith( '---\n' ) ) {
        throw new Error( 'Cannot add draft: markdown has no frontmatter' )
    }

    const keys = `draft: true\nautoDraft: ${ JSON.stringify( autoDraft.autoDraft ) }\n`

    return `---\n${ keys }${ markdown.slice( 4 ) }`
}
