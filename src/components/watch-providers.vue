<template>
    <div ref="root" class="watch-providers">
        <p v-if="!requested || loading" class="watch-status" role="status">Buscando opções para assistir no Brasil...</p>
        <p v-else-if="failed" class="watch-status" role="status">Não foi possível carregar as opções agora.</p>
        <p v-else-if="options.length === 0" class="watch-status">Nenhuma opção encontrada no Brasil no momento.</p>

        <ul v-if="providerGroups.length" class="provider-list">
            <li v-for="provider in providerGroups" :key="provider.name" class="provider-row">
                <span class="provider-logo">
                    <img v-if="provider.logo" :src="provider.logo" alt="" width="32" height="32" loading="lazy" />
                    <span v-else aria-hidden="true">{{ provider.name.charAt(0) }}</span>
                </span>
                <span class="provider-name">{{ displayName(provider.name) }}</span>
                <span class="provider-offers">
                    <a
                        v-for="offer in provider.offers"
                        :key="`${offer.type}-${offer.url}`"
                        class="offer-link"
                        :href="offer.url"
                        :aria-label="`${offerLabel(offer.type)} em ${displayName(provider.name)}`"
                        target="_blank"
                        rel="noopener noreferrer"
                    >{{ offerLabel(offer.type) }} <span aria-hidden="true">↗</span></a>
                </span>
            </li>
        </ul>

        <p class="watch-source">
            Disponibilidade no Brasil via <a href="https://www.justwatch.com/br" target="_blank" rel="noopener noreferrer">JustWatch</a> e TMDB. As opções podem mudar. <a :href="tmdbWatchUrl" target="_blank" rel="noopener noreferrer">Conferir no TMDB ↗</a>
        </p>
    </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue'

type ProviderType = 'flatrate' | 'free' | 'ads' | 'rent' | 'buy'

interface WatchOption {
    name: string
    type: ProviderType
    url: string
    logo: string | null
}

interface ProviderGroup {
    name: string
    logo: string | null
    offers: WatchOption[]
}

const offerLabels: Record<ProviderType, string> = {
    flatrate: 'Assinatura',
    free: 'Grátis',
    ads: 'Com anúncios',
    rent: 'Alugar',
    buy: 'Comprar',
}

export default defineComponent( {
    props: {
        tmdbId: { type: Number, required: true },
        mediaType: { type: String as PropType<'movie' | 'tv'>, required: true },
    },
    data () {
        return {
            options: [] as WatchOption[],
            requested: false,
            loading: false,
            failed: false,
            abortController: null as AbortController | null,
            observer: null as IntersectionObserver | null,
        }
    },
    computed: {
        tmdbWatchUrl (): string {
            return `https://www.themoviedb.org/${ this.mediaType }/${ this.tmdbId }/watch?locale=BR`
        },
        providerGroups (): ProviderGroup[] {
            const groups = new Map<string, ProviderGroup>()
            for ( const option of this.options ) {
                const existing = groups.get( option.name )
                if ( existing ) {
                    existing.offers.push( option )
                }
                else {
                    groups.set( option.name, { name: option.name, logo: option.logo, offers: [ option ] } )
                }
            }
            return Array.from( groups.values() )
        },
    },
    mounted () {
        if ( !('IntersectionObserver' in window) ) {
            this.loadOptions()
            return
        }

        this.observer = new IntersectionObserver( entries => {
            if ( entries.some( entry => entry.isIntersecting ) ) {
                this.observer?.disconnect()
                this.loadOptions()
            }
        }, { rootMargin: '300px' } )
        this.observer.observe( this.$refs.root as Element )
    },
    beforeUnmount () {
        this.observer?.disconnect()
        this.abortController?.abort()
    },
    methods: {
        displayName ( name: string ) {
            return name.replace( / with Ads$/i, ' com anúncios' )
        },
        offerLabel ( type: ProviderType ) {
            return offerLabels[ type ]
        },
        async loadOptions () {
            if ( this.requested ) {
                return
            }
            this.requested = true
            this.loading = true
            this.abortController = new AbortController()

            try {
                const query = new URLSearchParams( { type: this.mediaType, id: String( this.tmdbId ) } )
                const response = await fetch( `/api/watch-providers?${ query }`, { signal: this.abortController.signal } )
                if ( !response.ok ) {
                    throw new Error( 'Watch providers unavailable' )
                }
                const result = await response.json() as { options?: WatchOption[] }
                this.options = Array.isArray( result.options ) ? result.options : []
            }
            catch {
                if ( !this.abortController.signal.aborted ) {
                    this.failed = true
                }
            }
            finally {
                this.loading = false
            }
        },
    },
} )
</script>

<style scoped>
.watch-providers {
    width: 100%;
}
.watch-status {
    color: #cbd5e1;
    line-height: 1.6;
}
.provider-list {
    margin: 0;
    padding: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.13);
    list-style: none;
}
.provider-row {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.7rem;
    min-width: 0;
    min-height: 3.35rem;
    padding: 0.48rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.provider-logo,
.provider-logo img {
    display: block;
    width: 2rem;
    height: 2rem;
    border-radius: 0.42rem;
}
.provider-logo {
    overflow: hidden;
    background: #202431;
}
.provider-logo img {
    object-fit: contain;
}
.provider-logo > span {
    display: grid;
    place-items: center;
    height: 100%;
    font-size: 1rem;
    font-weight: 900;
}
.provider-name {
    min-width: 0;
    color: #f4f4f5;
    font-size: 0.84rem;
    font-weight: 650;
    line-height: 1.3;
}
.provider-offers {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.35rem;
}
.offer-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.55rem;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 999px;
    color: #e4e4e7;
    font-size: 0.7rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    transition: border-color 160ms ease, background 160ms ease, color 160ms ease;
}
.offer-link span {
    color: #fda4af;
}
.offer-link:hover,
.offer-link:focus-visible {
    border-color: #fb7185;
    background: rgba(251, 113, 133, 0.12);
    color: #fff;
}
.watch-source {
    margin: 0.9rem 0 0;
    color: #9ca3af;
    font-size: 0.72rem;
    line-height: 1.5;
}
.watch-source a {
    color: #cbd5e1;
    text-decoration: underline;
    text-underline-offset: 0.2em;
}
@media (max-width: 360px) {
    .provider-row { grid-template-columns: 2rem minmax(0, 1fr); }
    .provider-offers { grid-column: 2; justify-content: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
    .offer-link { transition: none; }
}
</style>
