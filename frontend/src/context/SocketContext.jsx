import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Bumps every time a new (user-targeted) notification arrives via socket.
  // Components can watch this to play a one-shot "ping" animation. Resets to its
  // current value after the animation finishes (the animation handler just
  // re-derives the trigger from the number itself, so we don't need to reset).
  const [newNotifFlag, setNewNotifFlag] = useState(0);

  useEffect(() => {
    if (user) {
      const newSocket = io(SOCKET_URL, {
        auth: { token: localStorage.getItem('token') },
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        // Sync the bell badge with the server's view of unread notifications
        // as soon as the socket is live. This is what makes the count show
        // immediately on login (previously it stayed at 0 until the user
        // visited the Notifications page).
        fetchNotifications();
      });

      newSocket.on('notification', (notification) => {
        if (!notification || !notification._id) return;
        setNotifications(prev => {
          // Dedupe: if this _id is already in the list, don't add it again
          if (prev.some(n => n._id === notification._id)) return prev;
          // Tag it as "just arrived" so the UI can play a one-shot entrance
          // animation. The Notifications page calls clearNewFlag(id) after
          // the animation finishes so the tag is dropped and the card
          // doesn't re-animate on subsequent re-renders.
          return [{ ...notification, __isNew: true }, ...prev];
        });
        // Only bump the count for actually-unread notifications
        if (!notification.read) {
          setUnreadCount(prev => prev + 1);
          setNewNotifFlag(prev => prev + 1);
        }
      });

      newSocket.on('newJob', (data) => {
        // "New job posted" is a broadcast — it does NOT represent unread
        // messages for the current user, so we add it to the list (so it
        // shows in the Notifications page) but do NOT increment the bell
        // badge or trigger the ping animation.
        setNotifications(prev => [{
          _id: `job-${data.jobId}-${Date.now()}`,
          type: 'job',
          title: 'New Job Posted',
          message: `${data.companyName} - ${data.title}`,
          link: `/jobs/${data.jobId}`,
          read: true,
          createdAt: new Date().toISOString()
        }, ...prev]);
      });

      setSocket(newSocket);
    }
    return () => { if (socket) socket.disconnect(); };
  }, [user]);

  const markAsRead = async (id) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) { console.error('Failed to mark as read'); }
  };

  // Drop the "__isNew" tag from a notification once its entrance animation
  // has finished. Without this, every re-render of the list (e.g. after
  // marking one as read) would re-trigger the animation for tagged items.
  const clearNewFlag = (id) => {
    setNotifications(prev => prev.map(n =>
      n._id === id ? { ...n, __isNew: false } : n
    ));
  };

  const markAllAsRead = async () => {
    // Snapshot unread _ids first so we can decrement the badge by the exact
    // number of items that were unread (avoiding going negative if the list
    // has items added between count and update).
    const unreadIds = notifications.filter(n => !n.read).map(n => n._id);
    if (unreadIds.length === 0) return;
    // Optimistic update: flip them locally and clear the badge immediately,
    // so the user gets instant feedback even on slow networks.
    setNotifications(prev => prev.map(n => n._id && unreadIds.includes(n._id) ? { ...n, read: true } : n));
    setUnreadCount(0);
    try {
      await fetch(`${API_URL}/api/notifications/mark-all-read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
    } catch (error) { console.error('Failed to mark all as read'); }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.notifications.filter(n => !n.read).length);
      }
    } catch (error) { console.error('Failed to fetch notifications'); }
  };

  return (
    <SocketContext.Provider value={{ socket, notifications, unreadCount, newNotifFlag, markAsRead, markAllAsRead, clearNewFlag, fetchNotifications }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
