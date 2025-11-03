// users.js - in-memory user store and helpers
const users = {};

export function addUser(socketId, username) {
  users[socketId] = { id: socketId, username };
  return users[socketId];
}

export function removeUser(socketId) {
  const u = users[socketId];
  delete users[socketId];
  return u;
}

export function getUsers() {
  return Object.values(users);
}

export function getUser(socketId) {
  return users[socketId];
}

export default {
  addUser,
  removeUser,
  getUsers,
  getUser,
};
