# Thor character link audit

Reviewed on 2026-10-25 against the existing TMDB cast pages and Marvel's film pages.

## Cause and correction

The registry originally assigned a different `characterId` and `versionId` to each title's raw `Thor` credit. The title page linked to that local ID, while the timeline index grouped titles by ID. Every click therefore found only its source title.

The nine verified MCU appearances below now point to the stable ID `ch_6bf315ee-4182-4a45-bfd0-9ed75fa76ddd` and version `ver_cbe95856-c135-40c9-bf9d-898c85ca51b2` (`mcu-main`). The eight original participation IDs remain stable. Former character and version IDs redirect to this group so previously shared filter URLs still work. The new Doctor Strange participation has its own participation ID and the same canonical character/version IDs.

| TMDB title ID | Film | Evidence |
| --- | --- | --- |
| `movie:10195` | Thor (2011) | [TMDB cast](https://www.themoviedb.org/movie/10195/cast), [Marvel](https://www.marvel.com/movies/thor) |
| `movie:24428` | The Avengers | [TMDB cast](https://www.themoviedb.org/movie/24428/cast), [Marvel MCU guidebook](https://www.marvel.com/comics/collection/59511/marvel_cinematic_universe_guidebook_the_avengers_initiative_hc_hardcover) |
| `movie:76338` | Thor: The Dark World | [TMDB cast](https://www.themoviedb.org/movie/76338/cast), [Marvel MCU guidebook](https://www.marvel.com/comics/collection/59511/marvel_cinematic_universe_guidebook_the_avengers_initiative_hc_hardcover) |
| `movie:99861` | Avengers: Age of Ultron | [TMDB cast](https://www.themoviedb.org/movie/99861/cast), [Marvel](https://www.marvel.com/Ultron/) |
| `movie:284052` | Doctor Strange (post-credit appearance) | [TMDB cast](https://www.themoviedb.org/movie/284052/cast), [Marvel](https://www.marvel.com/movies/doctor-strange) |
| `movie:284053` | Thor: Ragnarok | [TMDB cast](https://www.themoviedb.org/movie/284053/cast), [Marvel](https://www.marvel.com/movies/thor-ragnarok) |
| `movie:299536` | Avengers: Infinity War | [TMDB cast](https://www.themoviedb.org/movie/299536/cast), [Marvel](https://www.marvel.com/movies/avengers-infinity-war) |
| `movie:299534` | Avengers: Endgame | [TMDB cast](https://www.themoviedb.org/movie/299534/cast), [Marvel](https://www.marvel.com/movies/avengers-endgame) |
| `movie:616037` | Thor: Love and Thunder | [TMDB cast](https://www.themoviedb.org/movie/616037/cast), [Marvel](https://www.marvel.com/movies/thor-love-and-thunder) |

The TMDB cast pages list the role as `Thor` in the eight original titles and `Thor (uncredited)` in Doctor Strange. The local snapshot already lists `Thor` for Doctor Strange. The shared actor credit corroborates these matches; it is not used as the identity key. The MCU continuity and distinct Jane Foster identity are supported by Marvel's film pages.

## Explicit boundaries

- `Jane Foster / The Mighty Thor` in Love and Thunder is a different character.
- `Actor Thor` in Ragnarok is the in-story performer, not Thor Odinson.
- `Thor` in The Incredible Hulk Returns (`movie:26881`) is a separate continuity.
- Animated/alternate-universe Thor credits, including What If...? (`tv:91363`), remain separate.
- Team Thor shorts, archive footage in Deadpool & Wolverine, future releases, and other credits are not merged from a name or actor match alone. They need a continuity and participation review.

The current snapshot and registry still have partial cross-title coverage for other characters. For example, Tony Stark lacks verified MCU appearances already present in the catalog, and Spider-Man: No Way Home contains three distinct Peter Parker credits that the current title/raw-name registry key cannot represent separately. Those cases require explicit version-aware curation; broad name normalization would introduce false positives.
