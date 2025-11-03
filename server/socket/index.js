// socket/index.js - Socket.io connection handlers moved out of server.js
import { addMessage, findMessageById, addReadReceipt } from '../models/messages.js';
import { addUser, removeUser, getUsers, getUser } from '../models/users.js';

export function initSocket(io) {
  const typingUsers = {};

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle user joining
    socket.on('user_join', (username) => {
      addUser(socket.id, username);
      io.emit('user_list', getUsers());
      io.emit('user_joined', { username, id: socket.id });
      console.log(`${username} joined the chat`);
    });

    // Update profile (avatar, display name updates)
    socket.on('update_profile', ({ avatar, username }) => {
      const u = getUser(socket.id);
      if (u) {
        u.avatar = avatar || u.avatar
        if (username) u.username = username
        // broadcast updated users list
        io.emit('user_list', getUsers())
      }
    })

    // Handle chat messages with optional acknowledgement callback and attachments
    socket.on('send_message', async (messageData, callback) => {
      const message = {
        ...messageData,
        id: Date.now(),
        sender: getUser(socket.id)?.username || 'Anonymous',
        senderId: socket.id,
        timestamp: new Date().toISOString(),
        deliveredTo: [],
        readBy: [],
      };

      try {
        await addMessage(message);
      } catch (err) {
        console.error('Failed to persist message', err.message)
      }

      io.emit('receive_message', message);

      if (typeof callback === 'function') {
        callback({ status: 'ok', id: message.id, timestamp: message.timestamp });
      }

      socket.emit('message_delivered', { id: message.id, deliveredAt: new Date().toISOString() });
    });

    // Handle typing indicator
    socket.on('typing', (isTyping) => {
      if (getUser(socket.id)) {
        const username = getUser(socket.id).username;

        if (isTyping) {
          typingUsers[socket.id] = username;
        } else {
          delete typingUsers[socket.id];
        }

        io.emit('typing_users', Object.values(typingUsers));
      }
    });

    // Private messaging with acknowledgement
    socket.on('private_message', ({ to, message }, callback) => {
      const messageData = {
        id: Date.now(),
        sender: getUser(socket.id)?.username || 'Anonymous',
        senderId: socket.id,
        message,
        timestamp: new Date().toISOString(),
        isPrivate: true,
        deliveredTo: [],
        readBy: [],
      };

      socket.to(to).emit('private_message', messageData);
      socket.emit('private_message', messageData);

      if (typeof callback === 'function') {
        callback({ status: 'ok', id: messageData.id });
      }
    });

    // Message read receipts
    socket.on('message_read', async ({ messageId }) => {
      try {
        const msg = await findMessageById(messageId);
        if (msg) {
          // update in-memory doc structure for immediate response
          if (!msg.readBy) msg.readBy = [];
          if (!msg.readBy.includes(socket.id)) {
            msg.readBy.push(socket.id);
          }

          // persist read receipt
          try {
            await addReadReceipt({ messageId, readerId: socket.id, reader: getUser(socket.id)?.username });
          } catch (err) {
            console.warn('Failed to persist read receipt', err.message);
          }

          io.emit('message_read', { messageId, readerId: socket.id, reader: getUser(socket.id)?.username });
        }
      } catch (err) {
        console.error('Error handling message_read:', err.message);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const removed = removeUser(socket.id);
      if (removed) {
        io.emit('user_left', { username: removed.username, id: socket.id });
        console.log(`${removed.username} left the chat`);
      }

      delete typingUsers[socket.id];

      io.emit('user_list', getUsers());
      io.emit('typing_users', Object.values(typingUsers));
    });

    // Handle explicit logout from client: remove user and broadcast, then disconnect socket
    // Accept an optional acknowledgement callback and call it after cleanup
    socket.on('logout', (data, callback) => {
      try {
        const removed = removeUser(socket.id)
        if (removed) {
          io.emit('user_left', { username: removed.username, id: socket.id })
          io.emit('user_list', getUsers())
          console.log(`${removed.username} logged out`)
        }

        // acknowledge to client before disconnecting
        if (typeof callback === 'function') {
          try { callback({ ok: true }) } catch (e) { /* ignore */ }
        }
      } catch (e) {
        console.warn('Error during logout handler', e.message)
        if (typeof callback === 'function') {
          try { callback({ ok: false, error: e.message }) } catch (er) { /* ignore */ }
        }
      } finally {
        // force socket disconnect (this will trigger the disconnect handler too, but removeUser above prevents duplicate emits)
        try { socket.disconnect(true) } catch (e) { /* ignore */ }
      }
    })
  });
}
