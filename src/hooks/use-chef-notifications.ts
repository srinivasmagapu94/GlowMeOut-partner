import { useEffect, useRef, useState } from 'react';

import { loadPartnerProfileId } from '@/src/api';
import { useAuth } from '@/src/auth-context';

const NOTIFICATIONS_URL =
  process.env.EXPO_PUBLIC_NOTIFICATIONS_WS_URL
  || 'wss://swoosh-reawake-marsupial.ngrok-free.dev/ws/chef-notifications';
const RECONNECT_DELAY_MS = 5000;

export function useChefNotifications(partnerUUID?: string | null) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestAlert, setLatestAlert] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!partnerUUID) return undefined;

    let disposed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      if (disposed) return;

      const url = `${NOTIFICATIONS_URL}?partnerUUID=${encodeURIComponent(partnerUUID)}`;
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to chef notifications WebSocket');
      };

      ws.onmessage = (event) => {
        setUnreadCount((count) => count + 1);
        setLatestAlert(String(event.data));
      };

      ws.onerror = (error) => {
        console.error('Chef notifications WebSocket error:', error);
      };

      ws.onclose = () => {
        if (disposed) return;

        socketRef.current = null;
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [partnerUUID]);

  return { unreadCount, latestAlert, setUnreadCount };
}

export function ChefNotificationsListener() {
  const { isAuthenticated } = useAuth();
  const [partnerUUID, setPartnerUUID] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setPartnerUUID(null);
      return () => {
        cancelled = true;
      };
    }

    loadPartnerProfileId().then((uuid) => {
      if (!cancelled) setPartnerUUID(uuid);
    }).catch((error) => {
      console.error('Unable to load partner ID for notifications:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useChefNotifications(partnerUUID);
  return null;
}
