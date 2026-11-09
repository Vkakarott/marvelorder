// Blast-radius gate for the TMDB pull. A normal run loses a handful of ids;
// losing a large share at once points to a partial or failed upstream response.

export interface RegressionCounts {
    previousListings: number
    missingIds: number
}

export interface RegressionBudget {
    maxMissingRatio: number
    // Below this many missing ids the run is never blocked
    minMissing: number
}

export const defaultRegressionBudget: RegressionBudget = {
    maxMissingRatio: 0.25,
    minMissing: 10,
}

export function checkRegressionBudget ( counts: RegressionCounts, budget: RegressionBudget = defaultRegressionBudget ) {
    const { previousListings, missingIds } = counts

    if ( missingIds < budget.minMissing || previousListings === 0 ) {
        return { ok: true as const }
    }

    const ratio = missingIds / previousListings

    if ( ratio <= budget.maxMissingRatio ) {
        return { ok: true as const }
    }

    return {
        ok: false as const,
        reason: `${ missingIds } of ${ previousListings } listings vanished from TMDB (${ Math.round( ratio * 100 ) }%), above the ${ Math.round( budget.maxMissingRatio * 100 ) }% budget`,
    }
}
