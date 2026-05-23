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

  useEffect(() => {
    if (user) {
      const newSocket = io(SOCKET_URL, {
        auth: { token: localStorage.getItem('token') },
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => console.log('Socket connected'));

      newSocket.on('notification', (notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
      });

      newSocket.on('newJob', (data) => {
        setNotifications(prev => [{
          _id: Date.now(),
          type: 'job',
          title: 'New Job Posted',
          message: `${data.companyName} - ${data.title}`,
          link: `/jobs/${data.jobId}`
        }, ...prev]);
        setUnreadCount(prev => prev + 1);
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
    <SocketContext.Provider value={{ socket, notifications, unreadCount, markAsRead, fetchNotifications }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
