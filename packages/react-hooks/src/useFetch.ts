// useFetch hook implementation will go here
import { useState, useEffect } from 'react';

type FetchResult<T> = {
    data: T | undefined;
    error: Error | undefined;
    isLoading: boolean;
    isError: boolean;
    isSuccess: boolean;
}

export const useFetch = <T>(url: string | URL | Request): FetchResult<T> => {
    const [data, setData] = useState();
    const [error, setError] = useState();
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    setIsLoading(true);
    
    useEffect(() => {
        fetch(url).then((res) => res.json()).then((d) => {setData(d); setIsSuccess(true); setIsError(false)}).catch((err) => {setError(err), setIsSuccess(false); setIsError(true);}).finally(() => setIsLoading(false));
    }, []);

    return {
        data,
        error,
        isLoading,
        isError,
        isSuccess,
    }
}
