import { useCallback, useEffect, useState } from "react";

export default function useApiResource(loader) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await loader({});
        if (active) setData(result);
      } catch (loadError) {
        if (active && loadError.name !== "AbortError") setError(loadError);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();

    return () => {
      active = false;
    };
  }, [loader, reloadKey]);

  return { data, error, loading, reload };
}
