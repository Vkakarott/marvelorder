import fs from 'fs-extra'

import { storePath } from '~/src/config.ts'
import type { LogoSuggestions } from '~/src/helpers/logo-suggestions.ts'

export const logoSuggestionsPath = `${ storePath }/logo-suggestions.json`

export async function readLogoSuggestions (): Promise<LogoSuggestions> {
    return ( await fs.pathExists( logoSuggestionsPath ) ) ? await fs.readJson( logoSuggestionsPath ) : {}
}
