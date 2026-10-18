<template>
    <div ref="root" class="watch-providers">
        <p v-if="!requested || loading" class="watch-status" role="status">Buscando opções para assistir no Brasil...</p>
        <p v-else-if="failed" class="watch-status" role="status">Não foi possível carregar as opções agora.</p>
        <p v-else-if="options.length === 0" class="watch-status">Nenhuma opção encontrada no Brasil no momento.</p>

        <div v-for="group in groupedOptions" :key="group.type" class="watch-group">
            <h3>{{ group.label }}</h3>
            <div class="watch-grid">
                <a
                    v-for="option in group.options"
                    :key="`${option.type}-${option.name}`"
                    class="watch-card"
                    :href="option.url"
                    :aria-label="`Abrir ${option.name} para assistir`"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <img v-if="option.logo" :src="option.logo" alt="" width="48" height="48" loading="lazy" />
                    <span v-else class="watch-card-initial" aria-hidden="true">{{ option.name.charAt(0) }}</span>
                    <span class="watch-card-name">{{ option.name }}</span>
                    <span class="watch-card-arrow" aria-hidden="true">↗</span>
                </a>
            </div>
        </div>

        <p class="watch-source">
            Disponibilidade no Brasil via <a href="https://www.justwatch.com/br" target="_blank" rel="noopener noreferrer">JustWatch</a> e <a :href="tmdbWatchUrl" target="_blank" rel="noopener noreferrer">TMDB</a>. As opções podem mudar.
        </p>
        <a class="watch-fallback" :href="tmdbWatchUrl" target="_blank" rel="noopener noreferrer">Ver todas as opções no TMDB ↗</a>
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
    min-height: 9rem;
}
.watch-status {
    color: #cbd5e1;
    line-height: 1.6;
}
.watch-group + .watch-group {
    margin-top: 2rem;
}
.watch-group h3 {
    margin: 0 0 0.85rem;
    color: #e5e7eb;
    font-size: 0.9rem;
    font-weight: 800;
}
.watch-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: 0.7rem;
}
.watch-card {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-width: 0;
    min-height: 4.25rem;
    padding: 0.65rem;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 0.8rem;
    background: rgba(255, 255, 255, 0.05);
    color: #f9fafb;
    text-decoration: none;
    transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}
.watch-card:hover,
.watch-card:focus-visible {
    border-color: rgba(251, 113, 133, 0.75);
    background: rgba(251, 113, 133, 0.12);
    color: #fff;
    transform: translateY(-2px);
}
.watch-card img,
.watch-card-initial {
    flex: none;
    width: 3rem;
    height: 3rem;
    border-radius: 0.55rem;
    object-fit: contain;
}
.watch-card-initial {
    display: grid;
    place-items: center;
    background: #334155;
    font-size: 1.3rem;
    font-weight: 900;
}
.watch-card-name {
    min-width: 0;
    font-size: 0.85rem;
    font-weight: 700;
    line-height: 1.3;
}
.watch-card-arrow {
    margin-left: auto;
    color: #fda4af;
}
.watch-source {
    margin-top: 1.8rem;
    color: #9ca3af;
    font-size: 0.78rem;
    line-height: 1.6;
}
.watch-source a,
.watch-fallback {
    color: #e2e8f0;
    text-decoration: underline;
    text-underline-offset: 0.2em;
}
.watch-fallback {
    display: inline-block;
    margin-top: 0.7rem;
    font-size: 0.85rem;
    font-weight: 700;
}
@media (prefers-reduced-motion: reduce) {
    .watch-card { transition: none; }
}
</style>
