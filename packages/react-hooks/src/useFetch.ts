// ✅ Good aspects:

// - Clean TypeScript typing with generic support
// - Comprehensive return object with all necessary states
// - Proper error handling for both network and HTTP errors
// - State cleanup on new fetches

// ⚠️ Areas for improvement:

// 1. Memory leak risk: No cleanup for in-flight requests when component unmounts or URL changes
// 2. Race conditions: Multiple rapid URL changes could cause out-of-order state updates
// 3. Missing features commonly needed:
//   - No request cancellation with AbortController
//   - No refetch capability
//   - No manual trigger option (always fetches on mount)
//   - No caching mechanism
//   - No request options (headers, method, body)
// 4. State initialization: isSuccess and isError don't reset when URL changes (line 22-23 reset data/error but not status flags)

// 🔧 Suggested improvements:

// - Add AbortController for request cancellation
// - Reset all state flags when URL changes
// - Consider adding a refetch function
// - Add options parameter for fetch configuration
// - Implement proper cleanup in useEffect return

// Would you like me to implement any of these improvements?

// useFetch hook implementation will go here
import { useState, useEffect } from 'react'

type FetchResult<T> = {
  data: T | undefined
  error: Error | undefined
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
}

export const useFetch = <T>(url: string): FetchResult<T> => {
  const [data, setData] = useState<T | undefined>()
  const [error, setError] = useState<Error | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    const fetchData = async () => {
      setIsLoading(true)
      setIsError(false)
      setIsSuccess(false)
      setData(undefined)
      setError(undefined)

      try {
        const result = await fetch(url)

        if (!result.ok) {
          throw new Error(`HTTP error! status: ${result.status} ${result.statusText}`)
        }

        const json = await result.json()
        if (!cancelled) {
          setData(json)
          setIsSuccess(true)
          setIsError(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setIsSuccess(false)
          setIsError(true)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [url])

  return {
    data,
    error,
    isLoading,
    isError,
    isSuccess,
  }
}
