# Server

This folder contains the Node.js/Express + Socket.io server for the chat application.

Structure:

- `config/` - configuration files
- `controllers/` - socket event handlers and controllers
- `models/` - data models (in-memory or DB schemas)
- `socket/` - socket.io setup and helpers
- `utils/` - utility functions
- `server.js` - main server file (already present)

Environment
-----------

The server reads `MONGO_URI` from `server/.env` (or process environment). Add your MongoDB connection string to `server/.env` before starting the server. Example:

```
MONGO_URI=mongodb+srv://user:pass@cluster0.mongodb.net/socketio-chat
```

Smoke test
----------

There's an automated smoke test that runs two socket clients, sends a message, verifies persistence and read receipts.

Run it from the `server` folder:

```bash
npm run smoke
```

The script is `server/scripts/smoke-test.js` and uses `socket.io-client` to exercise the server.

Placeholders are included so you can move logic into modular files as the project grows.
