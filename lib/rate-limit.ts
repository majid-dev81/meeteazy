// lib/rate-limit.ts
type Options = {
  interval: number
  uniqueTokenPerInterval: number
}

export default function rateLimit(options: Options) {
  const tokenMap = new Map<string, { count: number; lastRequest: number }>()

  return {
    check: (limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const now = Date.now()
        const entry = tokenMap.get(token)

        if (!entry) {
          tokenMap.set(token, { count: 1, lastRequest: now })
          return resolve()
        }

        const timePassed = now - entry.lastRequest

        if (timePassed > options.interval) {
          tokenMap.set(token, { count: 1, lastRequest: now })
          return resolve()
        }

        if (entry.count >= limit) {
          return reject(new Error('Rate limit exceeded'))
        }

        entry.count += 1
        tokenMap.set(token, entry)
        return resolve()
      }),
  }
}