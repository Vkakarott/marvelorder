import type { APIRoute } from 'astro'
import { handleWatchProvidersRequest } from '~/src/helpers/node/watch-providers.js'

export const prerender = false

export const GET: APIRoute = async ( { request } ) => handleWatchProvidersRequest( request )
