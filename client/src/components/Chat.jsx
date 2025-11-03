import React, { useEffect, useRef, useState } from 'react'
import { useSocket } from '../socket/socket'
import Toast from './Toast'

export default function Chat({ username }) {
  const { socket, messages, users, typingUsers, sendMessage, sendPrivateMessage, setTyping, loadMessages } = useSocket()
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [page, setPage] = useState(1)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState({})
  const [avatar, setAvatar] = useState(null)
  const [dark, setDark] = useState(() => (localStorage.getItem('dark') === '1'))
  const [loggingOut, setLoggingOut] = useState(false)
  const [toast, setToast] = useState(null)
  const messagesRef = useRef()

  // Auto-hide toast after a short duration
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])
  const seenMessages = useRef(new Set())

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages])

  // Infinite scroll: load older when scrolled to top
  useEffect(() => {
    const el = messagesRef.current
    if (!el) return

    let ticking = false
    const onScroll = async () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(async () => {
        try {
          if (el.scrollTop < 80 && !loadingOlder) {
            setLoadingOlder(true)
            const prevScrollHeight = el.scrollHeight
            const nextPage = page + 1
            await loadMessages({ page: nextPage, limit: 25 })
            setPage(nextPage)
            // small delay to allow DOM to update, then preserve scroll position
            setTimeout(() => {
              const newScrollHeight = el.scrollHeight
              el.scrollTop = newScrollHeight - prevScrollHeight + el.scrollTop
              setLoadingOlder(false)
            }, 60)
          }
        } finally {
          ticking = false
        }
      })
    }

    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [page, loadingOlder, loadMessages])

  // Mark messages read when they enter view (IntersectionObserver)
  useEffect(() => {
    if (!messagesRef.current || !socket) return
    const container = messagesRef.current
    const readSent = new Set()

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const el = entry.target
        const messageId = el.getAttribute('data-id')
        if (!messageId) return
        // find message object
        const msg = messages.find((mm) => String(mm.id) === String(messageId))
        if (!msg) return
        // only mark other users' messages as read
        if (msg.sender === username) return
        if (readSent.has(messageId)) return
        // emit read receipt
        try {
          socket.emit('message_read', { messageId: msg.id })
          readSent.add(messageId)
        } catch (e) {
          console.warn('Failed to emit message_read', e.message)
        }
      })
    }, { root: container, threshold: 0.6 })

    // observe each message element
    const nodes = container.querySelectorAll('.message')
    nodes.forEach((n) => observer.observe(n))

    // re-observe on messages change: cleanup and reattach
    return () => observer.disconnect()
  }, [messages, socket, username])

  // Track unread counts (avoid double-counting using seenMessages)
  useEffect(() => {
    messages.forEach((m) => {
      if (!m) return
      const mid = m.id || m.tempId
      if (!mid) return
      if (seenMessages.current.has(mid)) return
      // mark as seen locally
      seenMessages.current.add(mid)
      // skip own messages
      if (m.sender === username) return
      // if sender is not the currently selected user, increment unread
      const sid = m.senderId || m.sender
      if (!selectedUser || selectedUser.id !== sid) {
        setUnreadCounts((prev) => ({ ...(prev || {}), [sid]: (prev?.[sid] || 0) + 1 }))
      }
    })
  }, [messages, selectedUser, username])

  // Load initial message history
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const data = await loadMessages({ page: 1, limit: 50 })
      if (mounted && Array.isArray(data) && data.length > 0) {
        // we already set messages inside loadMessages, ensure scroll to bottom after small delay
        setTimeout(() => {
          if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
        }, 50)
      }
    })()
    return () => { mounted = false }
  }, [])

  // apply dark mode class
  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('dark', dark ? '1' : '0')
  }, [dark])

  const submit = async (e) => {
    e && e.preventDefault()
    if (!text.trim() && !attachment) return
    const tempId = `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const payload = { text }
    if (attachment) payload.attachment = attachment

    // Optimistic UI: append a temp message locally
    const optimistic = {
      tempId,
      sender: username,
      message: payload.text || payload,
      attachment: payload.attachment || null,
      timestamp: new Date().toISOString(),
      delivered: false,
      readBy: [],
    }
    // send message (sendMessage will reconcile when ack/receive comes back)
    sendMessage(payload, { attachment: payload.attachment || null, tempId }, (ack) => {})

    setText('')
    setAttachment(null)
  }

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setAttachment(reader.result)
    reader.readAsDataURL(f)
  }

  const onAvatarFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const data = reader.result
      setAvatar(data)
      try { socket.emit('update_profile', { avatar: data }) } catch (e) { console.warn(e.message) }
    }
    reader.readAsDataURL(f)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="main flex bg-white rounded-lg shadow overflow-hidden dark:bg-gray-900">
        <div className="sidebar w-60 border-r border-gray-200 p-4 bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold">Users</h4>
            <button
              className="text-sm text-indigo-600 hover:underline disabled:opacity-50"
              onClick={async () => {
                try {
                  setLoggingOut(true)
                  let acked = false
                  const timeout = setTimeout(() => {
                    if (!acked) {
                      setLoggingOut(false)
                      if (onLogout) onLogout()
                    }
                  }, 5000)

                  if (socket && socket.emit) {
                    socket.emit('logout', null, (ack) => {
                      acked = true
                      clearTimeout(timeout)
                      setLoggingOut(false)
                      setToast({ message: 'Logged out', type: 'success' })
                      // server acknowledged logout; now clear client state
                      if (onLogout) onLogout()
                    })
                  } else {
                    clearTimeout(timeout)
                    setLoggingOut(false)
                    setToast({ message: 'Logged out (local)', type: 'info' })
                    if (onLogout) onLogout()
                  }
                } catch (e) {
                  console.warn('logout emit failed', e.message)
                  setLoggingOut(false)
                  setToast({ message: 'Logout failed locally', type: 'error' })
                  if (onLogout) onLogout()
                }
              }}
              disabled={loggingOut}
            >
              {loggingOut ? 'Logging out…' : 'Switch / Login'}
            </button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={onAvatarFile} className="hidden" />
              <div className="avatar w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-800 font-bold">{avatar ? <img src={avatar} alt="me" className="w-9 h-9 rounded-full object-cover" /> : (username || 'U').slice(0,1).toUpperCase()}</div>
            </label>
            <button className="btn bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded" onClick={() => setDark(d => !d)}>{dark ? 'Light' : 'Dark'}</button>
          </div>
          <ul className="users">
            {users.map((u) => (
              <li key={u.id} className={`user flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedUser?.id === u.id ? 'bg-indigo-50 dark:bg-indigo-900' : ''}`} onClick={() => { setSelectedUser(u); setUnreadCounts((prev)=>({ ...prev, [u.id]: 0 })) }}>
                <div className="avatar w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden">
                  {u.avatar ? <img src={u.avatar} alt={u.username} className="w-full h-full object-cover" /> : <span className="text-indigo-800 font-bold">{(u.username || 'U').slice(0,1).toUpperCase()}</span>}
                </div>
                <div className="flex-1">
                  <div className="username text-sm font-medium text-gray-900 dark:text-gray-100">{u.username}</div>
                </div>
                <div className="ml-auto">{(unreadCounts[u.id] > 0) ? <span className="reads inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold">{unreadCounts[u.id]}</span> : null}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="content flex-1 flex flex-col">
          <div className="messages flex-1 p-4 overflow-auto bg-gray-50 dark:bg-gray-800" ref={messagesRef}>
            <div className="text-center my-2">
              <button className="btn bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded" onClick={async () => {
                setLoadingOlder(true)
                const nextPage = page + 1
                await loadMessages({ page: nextPage, limit: 25 })
                setPage(nextPage)
                setLoadingOlder(false)
              }}>{loadingOlder ? 'Loading...' : 'Load older messages'}</button>
            </div>
            {(() => {
              let lastDate = null
              return messages.map((m) => {
                const msgDate = m.timestamp ? new Date(m.timestamp).toDateString() : ''
                const showDate = msgDate !== lastDate
                lastDate = msgDate

                const key = m.id || m.tempId || Math.random()

                if (m.system) {
                  return (
                    <React.Fragment key={key}>
                      {showDate ? <div className="date-sep text-sm text-gray-500 my-2">{msgDate}</div> : null}
                      <div className="message system text-center text-sm text-gray-600 dark:text-gray-300">{m.message}</div>
                    </React.Fragment>
                  )
                }

                const isMe = m.sender === username
                return (
                  <React.Fragment key={key}>
                    {showDate ? <div className="date-sep text-sm text-gray-500 my-2">{msgDate}</div> : null}
                    <div data-id={m.id || ''} className={`message ${isMe ? 'me' : 'them'} my-2`}> 
                      <div className="flex items-start gap-3">
                        {!isMe && <div className="avatar w-9 h-9 rounded-full overflow-hidden bg-indigo-100 flex items-center justify-center">{(m.sender || 'U').slice(0,1).toUpperCase()}</div>}
                        <div className={`flex-1 ${isMe ? 'text-right' : 'text-left'}`}>
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{isMe ? 'You' : m.sender}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(m.timestamp).toLocaleTimeString()}</div>
                          </div>
                          <div className={`${isMe ? 'inline-block ml-auto bg-gradient-to-b from-indigo-600 to-indigo-700 text-white' : 'inline-block bg-white dark:bg-gray-700 text-gray-900'} rounded-xl px-4 py-2 mt-1 shadow`}> 
                            <div className="text-sm">{m.message || m.text}</div>
                            {m.attachment ? <img src={m.attachment} alt="att" className="mt-2 max-w-xs rounded"/> : null}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex justify-end gap-2">
                            {m.delivered ? <span className="text-green-400 font-semibold">✓</span> : <span className="text-yellow-400">●</span>}
                            {Array.isArray(m.readBy) && m.readBy.length > 0 ? (
                              <span className="reads"> Read by: {m.readBy.map(r => r && (r.reader || r.readerName || r)).join(', ')}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                )
        })
      })()}
              <Toast toast={toast} />
          </div>

          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="mb-2">
              {typingUsers.length > 0 ? <small className="text-sm text-gray-500">{typingUsers.join(', ')} is typing...</small> : null}
            </div>
            <form className="composer flex items-center gap-2" onSubmit={submit}>
              <input
                className="input flex-1 border rounded-full px-4 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                placeholder={selectedUser ? `Message ${selectedUser.username}` : 'Type a message'}
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setTyping(!!e.target.value)
                }}
              />
              <input type="file" onChange={onFile} className="text-sm" />
              <button className="btn bg-indigo-600 text-white px-4 py-2 rounded-full" type="submit">Send</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
