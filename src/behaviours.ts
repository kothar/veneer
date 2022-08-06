export type Behaviour = {
    latencyMs: number
}

export const behaviours: Record<string, Behaviour> = {
    'google.com': {
        latencyMs: 100
    }
}