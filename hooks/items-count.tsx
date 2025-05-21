import { useState, useEffect, useCallback } from "react";
import {items} from "@/util/api";

const useItemCount = (initialMongodbQuery) => {
  const [query, setQuery] = useState(initialMongodbQuery);
  const [data, setData] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // todo
      /* const response = await items.count({
        query: query,
      });
      const result = await response.json(); */
      setData(10);
    } catch (error: any) {
      setError(error);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = (newMongodbQuery) => {
    setQuery(newMongodbQuery);
  };

  return { data, loading, error, refetch };
};

export default useItemCount;
