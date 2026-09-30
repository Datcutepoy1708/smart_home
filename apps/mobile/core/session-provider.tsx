import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import * as SecureStore from "expo-secure-store";
import { Alert, Platform } from "react-native";
import { Session, type Identity } from "./session";
import { requestJson } from "./api-client";
import {
  registerFcmToken,
  unregisterFcmToken,
  setupNotificationListeners,
} from "./fcm";
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
  identity: null as Identity | null,
  resetSession: async () => {},
});
export function SessionProvider({ children }: PropsWithChildren) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    session.onChange = () => {
      if (active) setIdentity(session.identity);
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
        if (active) {
          setIdentity(session.identity);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      session.onChange = () => {};
    };
  }, [attempt]);

  // Register FCM device token and listen for push notifications
  useEffect(() => {
    if (!identity) return;

    // Register token with backend
    registerFcmToken(session).catch(() => {
      /* best effort */
    });

    // Listen to foreground notifications
    const unsubscribe = setupNotificationListeners((remoteMessage) => {
      if (remoteMessage.notification) {
        Alert.alert(
          remoteMessage.notification.title ?? "Thông báo Smart Home",
          remoteMessage.notification.body ?? "",
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [identity]);

  const resetSession = async () => {
    try {
      await unregisterFcmToken(session).catch(() => {});
      await session.logout();
    } catch {
      /* ignore */
    }
    setError("");
  };

  return (
    <Context.Provider
      value={{
        session,
        loading,
        error,
        retry: () => setAttempt((n) => n + 1),
        identity,
        resetSession,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
