import { useEffect, useState } from 'react'

/**
 * Blob URL tied to the component's lifetime. Creating one per render leaks
 * memory, so it is created in an effect and revoked on cleanup.
 */
export function useObjectUrl(blob) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return undefined
    }

    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  return url
}
