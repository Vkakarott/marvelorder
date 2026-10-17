import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

const repoRoot = path.resolve( import.meta.dirname, '..' )
const packageJsonPath = path.join( repoRoot, 'package.json' )
const npmLockPath = path.join( repoRoot, 'package-lock.json' )
const packageJson = JSON.parse( readFileSync( packageJsonPath, 'utf8' ) ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    engines?: Record<string, string>
}
const npmLock = readFileSync( npmLockPath, 'utf8' )

describe( 'Netlify install guard', () => {
    test( 'keeps npm detection compatible with Netlify builds', () => {
        expect( packageJson.engines?.node ).toBeTruthy()
        expect( packageJson.engines?.bun ).toBeUndefined()
        expect( existsSync( npmLockPath ) ).toBe( true )
    } )

    test( 'does not commit conflicting lockfiles for other package managers', () => {
        expect( existsSync( path.join( repoRoot, 'bun.lock' ) ) ).toBe( false )
        expect( existsSync( path.join( repoRoot, 'bun.lockb' ) ) ).toBe( false )
        expect( existsSync( path.join( repoRoot, 'pnpm-lock.yaml' ) ) ).toBe( false )
        expect( existsSync( path.join( repoRoot, 'yarn.lock' ) ) ).toBe( false )
    } )

    test( 'includes node-gyp when the lockfile needs better-sqlite3', () => {
        if ( !npmLock.includes( '"better-sqlite3"' ) ) {
            return
        }

        expect(
            packageJson.dependencies?.['node-gyp']
            || packageJson.devDependencies?.['node-gyp'],
        ).toBeTruthy()
    } )
} )
