import React, { useEffect, useState } from 'react'
import Login from './components/Login'
import Chat from './components/Chat'
import { useSocket } from './socket/socket'

export default function App() {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') } catch (e) { return null }
  })()
  const [user, setUser] = useState(saved || { username: '', avatar: null })
  const { socket, connect } = useSocket()

  useEffect(() => {
    if (user && user.username) {
      connect(user.username, { avatar: user.avatar })
      if (user.remember) localStorage.setItem('user', JSON.stringify(user))
    }
  }, [user.username])

  if (!user.username) return <Login onSubmit={(payload) => setUser({ username: payload.username, avatar: payload.avatar, remember: payload.remember })} />

  return (
    <div className="app">
      <div className="header"><strong>Socket.io Chat</strong></div>
      <Chat username={user.username} socket={socket} onLogout={() => setUser({ username: '', avatar: null })} />
    </div>
  )
}
