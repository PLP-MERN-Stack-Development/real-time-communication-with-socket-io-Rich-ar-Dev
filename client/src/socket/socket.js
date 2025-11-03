// socket.js - Socket.io client setup

import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

// Socket.io connection URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Create socket instance
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Custom hook for using socket.io
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  // Connect to socket server
  // Connect to socket server
  // options: { avatar }
  const connect = (username, options = {}) => {
    socket.connect();
    if (username) {
      socket.emit('user_join', username);
      if (options.avatar) {
        // immediately send profile update
        socket.emit('update_profile', { avatar: options.avatar, username });
      }
    }
  };

  // Disconnect from socket server
  const disconnect = () => {
    socket.disconnect();
  };

  // Send a message
  // Send a message. Supports optional attachment (base64) and acknowledgement callback
  const sendMessage = (message, options = {}, cb) => {
    // message: string or object
    // options: { attachment?: string, to?: socketId (for private), tempId?: string }
    const tempId = options.tempId || `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const payload = {
      tempId,
      message: typeof message === 'string' ? message : message.text || message,
      attachment: options.attachment || null,
      to: options.to || null,
      isPrivate: !!options.to,
    };

    // Optimistic UI: append a local message with tempId so user sees immediate feedback
    const optimistic = {
      tempId: payload.tempId,
      sender: 'You',
      message: payload.message,
      attachment: payload.attachment,
      timestamp: new Date().toISOString(),
      delivered: false,
      readBy: [],
    }
    setMessages((prev) => [...prev, optimistic]);

    socket.emit('send_message', payload, (ack) => {
      // ack: { status, id, timestamp }
      if (ack && ack.id) {
        // Update messages state to mark as acknowledged/delivered and replace tempId
        setMessages((prev) =>
          prev.map((m) =>
            m.tempId && m.tempId === payload.tempId
              ? { ...m, id: ack.id, delivered: true, deliveredAt: ack.timestamp }
              : m
          )
        );
      }
      if (typeof cb === 'function') cb(ack);
    });
  };

  // Load message history (pagination)
  const loadMessages = async ({ page = 1, limit = 50 } = {}) => {
    try {
      const res = await fetch(`${SOCKET_URL}/api/messages?page=${page}&limit=${limit}`);
      let data = []
      try { data = await res.json() } catch (e) { data = [] }
      if (Array.isArray(data)) {
        // Prepend older messages so newest are at the end
        setMessages((prev) => [...data, ...prev])
      }
      return data
    } catch (err) {
      console.warn('Failed to load messages', err.message)
      return []
    }
  }

  // Send a private message
  const sendPrivateMessage = (to, message) => {
    socket.emit('private_message', { to, message });
  };

  // Set typing status
  const setTyping = (isTyping) => {
    socket.emit('typing', isTyping);
  };

  // Socket event listeners
  useEffect(() => {
    // Connection events
    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    // Message events
    const onReceiveMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => {
        // If this message corresponds to an optimistic message (tempId), replace it
        if (message && message.tempId) {
          const found = prev.some((m) => m.tempId === message.tempId)
          if (found) return prev.map((m) => (m.tempId === message.tempId ? message : m))
        }
        return [...prev, message]
      })
    };

    const onPrivateMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => {
        if (message && message.tempId) {
          const found = prev.some((m) => m.tempId === message.tempId)
          if (found) return prev.map((m) => (m.tempId === message.tempId ? message : m))
        }
        return [...prev, message]
      })
    };

    // Delivery acknowledgement from server (for immediate delivered status)
    const onMessageDelivered = ({ id, deliveredAt }) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, delivered: true, deliveredAt } : m)));
    };

    // Read receipts
    const onMessageRead = ({ messageId, readerId, reader }) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === messageId) {
              const readBy = Array.isArray(m.readBy) ? [...m.readBy] : [];
              // store objects with readerId and reader name to display names in UI
              const already = readBy.some((r) => r && (r.readerId === readerId || r === readerId));
              if (!already) readBy.push({ readerId, reader, readAt: new Date().toISOString() });
              return { ...m, readBy };
            }
            return m;
          })
        );
    };

    // User events
    const onUserList = (userList) => {
      setUsers(userList);
    };

    const onUserJoined = (user) => {
      // You could add a system message here
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onUserLeft = (user) => {
      // You could add a system message here
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    // Typing events
    const onTypingUsers = (users) => {
      setTypingUsers(users);
    };

    // Register event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receive_message', onReceiveMessage);
    socket.on('private_message', onPrivateMessage);
    socket.on('user_list', onUserList);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('typing_users', onTypingUsers);
  socket.on('message_delivered', onMessageDelivered);
  socket.on('message_read', onMessageRead);

    // Clean up event listeners
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.off('private_message', onPrivateMessage);
      socket.off('user_list', onUserList);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('typing_users', onTypingUsers);
      socket.off('message_delivered', onMessageDelivered);
      socket.off('message_read', onMessageRead);
    };
  }, []);

  return {
    socket,
    isConnected,
    lastMessage,
    messages,
    users,
    typingUsers,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
  };
};

export default socket; 