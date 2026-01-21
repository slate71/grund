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
    const fetchData = async () => {
      setIsLoading(true)
      setData(undefined)
      setError(undefined)

      try {
        const result = await fetch(url)

        if (!result.ok) {
          throw new Error(`HTTP error! status: ${result.status} ${result.statusText}`)
        }

        const data = await result.json()
        setData(data)
        setIsSuccess(true)
        setIsError(false)
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)))
        setIsSuccess(false)
        setIsError(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [url])

  return {
    data,
    error,
    isLoading,
    isError,
    isSuccess,
  }
}
