import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { Session } from "./session";
import { requestJson } from "./api-client";
let webToken: string | null = null;
const key = "smart-home-refresh";
const session = new Session(
  {
    get: () =>
      Platform.OS === "web"
        ? Promise.resolve(webToken)
        : SecureStore.getItemAsync(key),
    set: async (token) => {
      if (Platform.OS === "web") webToken = token;
      else await SecureStore.setItemAsync(key, token);
    },
    remove: async () => {
      if (Platform.OS === "web") webToken = null;
      else await SecureStore.deleteItemAsync(key);
    },
  },
  requestJson,
);
const Context = createContext({
  session,
  loading: true,
  error: "",
  retry: () => {},
});
export function SessionProvider({ children }: PropsWithChildren) {
  const [, render] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    session.onChange = () => {
      if (active) render((n) => n + 1);
    };
    setLoading(true);
    setError("");
    session
      .restore()
      .catch((e) => {
        if (active && e?.status !== 401)
          setError("Unable to restore your session. Check your connection.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      session.onChange = () => {};
    };
  }, [attempt]);
  return (
    <Context.Provider
      value={{ session, loading, error, retry: () => setAttempt((n) => n + 1) }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
