import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useSession } from "../../core/session-provider";
import { ApiError } from "../../core/api-client";
import { parseDevices, type Device } from "./device-data";
export function useDevices() {
  const { session } = useSession();
  const home = session.identity?.households[0];
  const [items, setItems] = useState<Device[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const load = useCallback(
    async (next?: string) => {
      const request = ++generation.current;
      setLoading(true);
      setError("");
      if (!home) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        const result = parseDevices(
          await session.get(
            `/households/${home.id}/devices${next ? `?cursor=${next}` : ""}`,
          ),
        );
        if (request !== generation.current) return;
        setItems((old) => (next ? [...old, ...result.items] : result.items));
        setCursor(result.nextCursor);
      } catch (e: unknown) {
        if (
          request === generation.current &&
          e instanceof ApiError &&
          e.status === 403
        ) {
          setItems([]);
          setCursor(null);
        }
        if (request === generation.current)
          setError(e instanceof Error ? e.message : "Unable to load devices.");
      } finally {
        if (request === generation.current) setLoading(false);
      }
    },
    [home, session],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        ++generation.current;
      };
    }, [load]),
  );
  return {
    home,
    items,
    loading,
    error,
    refresh: () => void load(),
    more: cursor ? () => void load(cursor) : null,
  };
}
