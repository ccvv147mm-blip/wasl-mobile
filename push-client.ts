import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

const appId = import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID'] as string | undefined;
const vapidKey = import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY'] as string | undefined;

const firebaseConfig = {
  apiKey: import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY'] as string | undefined,
  projectId: import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID'] as string | undefined,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

function ready() {
  return Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId && appId && vapidKey && firebaseConfig.messagingSenderId,
  );
}

export const pushConfigured = ready;

async function getMessagingInstance() {
  const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig as Record<string, string>);
  return getMessaging(app);
}

/** يجب أن تُنادى من داخل حدث نقر من المستخدم */
export async function enablePush(): Promise<PushResult> {
  if (!ready()) return { status: "not-configured" };
  if (typeof window === "undefined" || !("Notification" in window)) return { status: "unsupported" };
  if (!(await isSupported())) return { status: "unsupported" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const query = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
  const serviceWorkerRegistration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${query}`,
  );
  const messaging = await getMessagingInstance();
  const token = await getToken(messaging, { vapidKey: vapidKey!, serviceWorkerRegistration });
  return token ? { status: "registered", token } : { status: "denied" };
}

/** إشعارات داخل التطبيق أثناء فتحه */
export async function listenForegroundPush(handler: (title: string, body?: string) => void) {
  if (!ready() || typeof window === "undefined") return () => {};
  if (!(await isSupported())) return () => {};
  const messaging = await getMessagingInstance();
  return onMessage(messaging, (payload) => {
    const n = payload.notification;
    if (n?.title) handler(n.title, n.body ?? undefined);
  });
}
