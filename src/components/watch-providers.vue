<template>
    <div ref="root" class="watch-providers">
        <p v-if="!requested || loading" class="watch-status" role="status">Buscando opções para assistir no Brasil...</p>
        <p v-else-if="failed" class="watch-status" role="status">Não foi possível carregar as opções agora.</p>
        <p v-else-if="options.length === 0" class="watch-status">Nenhuma opção encontrada no Brasil no momento.</p>

        <div v-if="groupedOptions.length" class="watch-list">
            <section v-for="group in groupedOptions" :key="group.type" class="watch-group">
                <div class="watch-group-heading">
                    <h3>{{ group.label }}</h3>
                    <span>{{ group.options.length }} {{ group.options.length === 1 ? 'opção' : 'opções' }}</span>
                </div>
                <a
                    v-for="option in group.options"
                    :key="`${option.type}-${option.name}`"
                    class="watch-row"
                    :href="option.url"
                    :aria-label="`Abrir ${displayName(option.name)} para assistir`"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <span class="watch-logo">
                        <img v-if="option.logo" :src="option.logo" alt="" width="38" height="38" loading="lazy" />
                        <span v-else aria-hidden="true">{{ option.name.charAt(0) }}</span>
                    </span>
                    <span class="watch-name">{{ displayName(option.name) }}</span>
                    <span class="watch-action" aria-hidden="true">Abrir <span>↗</span></span>
                </a>
            </section>
        </div>

        <div class="watch-footer">
            <p class="watch-source">
                Disponibilidade no Brasil via <a href="https://www.justwatch.com/br" target="_blank" rel="noopener noreferrer">JustWatch</a> e <a :href="tmdbWatchUrl" target="_blank" rel="noopener noreferrer">TMDB</a>. As opções podem mudar.
            </p>
            <a class="watch-fallback" :href="tmdbWatchUrl" target="_blank" rel="noopener noreferrer">Conferir no TMDB ↗</a>
        </div>
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

const categories: Array<{ type: ProviderType, label: string }> = [
    { type: 'flatrate', label: 'Assinatura' },
    { type: 'free', label: 'Grátis' },
    { type: 'ads', label: 'Grátis com anúncios' },
    { type: 'rent', label: 'Aluguel' },
    { type: 'buy', label: 'Compra' },
]

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
        groupedOptions () {
            return categories
                .map( category => ( {
                    ...category,
                    options: this.options.filter( option => option.type === category.type ),
                } ) )
                .filter( group => group.options.length > 0 )
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
.watch-list {
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 1rem;
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.065), rgba(255, 255, 255, 0.025));
}
.watch-group + .watch-group {
    border-top: 1px solid rgba(255, 255, 255, 0.14);
}
.watch-group-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 1rem 0.5rem;
}
.watch-group-heading h3 {
    margin: 0;
    color: #fda4af;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}
.watch-group-heading > span {
    color: #8d96a5;
    font-size: 0.72rem;
}
.watch-row {
    display: grid;
    grid-template-columns: 2.4rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.8rem;
    min-width: 0;
    min-height: 3.65rem;
    padding: 0.38rem 1rem;
    color: #f9fafb;
    text-decoration: none;
    transition: background 160ms ease;
}
.watch-row + .watch-row {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.watch-row:hover,
.watch-row:focus-visible {
    background: rgba(251, 113, 133, 0.1);
    color: #fff;
}
.watch-row:focus-visible {
    outline: 2px solid #fda4af;
    outline-offset: -2px;
}
.watch-logo,
.watch-logo img {
    display: block;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 0.5rem;
}
.watch-logo {
    overflow: hidden;
    background: #202431;
}
.watch-logo img {
    object-fit: contain;
}
.watch-logo > span {
    display: grid;
    place-items: center;
    height: 100%;
    font-size: 1.1rem;
    font-weight: 900;
}
.watch-name {
    min-width: 0;
    font-size: 0.88rem;
    font-weight: 700;
    line-height: 1.25;
}
.watch-action {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    color: #fda4af;
    font-size: 0.75rem;
    font-weight: 700;
}
.watch-action span {
    font-size: 1rem;
}
.watch-footer {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
    margin-top: 1rem;
}
.watch-source {
    margin: 0;
    color: #9ca3af;
    font-size: 0.72rem;
    line-height: 1.5;
}
.watch-source a,
.watch-fallback {
    color: #cbd5e1;
    text-decoration: underline;
    text-underline-offset: 0.2em;
}
.watch-fallback {
    white-space: nowrap;
    font-size: 0.72rem;
    font-weight: 700;
}
@media (max-width: 480px) {
    .watch-group-heading { padding-inline: 0.8rem; }
    .watch-row { gap: 0.65rem; padding-inline: 0.8rem; }
    .watch-action { font-size: 0; gap: 0; }
    .watch-action span { font-size: 1.1rem; }
}
@media (prefers-reduced-motion: reduce) {
    .watch-row { transition: none; }
}
</style>
