// smoke-test.js - automated socket.io smoke test (runs two clients)
import { io } from 'socket.io-client'

const SERVER = process.env.SOCKET_URL || 'http://localhost:5000'

function waitForEvent(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`timeout waiting for event ${event}`))
    }, timeout)

    function handler(data) {
      clearTimeout(timer)
      socket.off(event, handler)
      resolve(data)
    }

    socket.on(event, handler)
  })
}

async function run() {
  console.log('Smoke test starting against', SERVER)

  const a = io(SERVER, { reconnection: false })
  const b = io(SERVER, { reconnection: false })

  await Promise.all([waitForEvent(a, 'connect'), waitForEvent(b, 'connect')])
  console.log('Both clients connected')

  a.emit('user_join', 'smoke_user_A')
  b.emit('user_join', 'smoke_user_B')

  // prepare to receive message on B before sending to avoid race
  const receiveByBPromise = waitForEvent(b, 'receive_message', 5000)

  // send a message from A and wait for ack
  const ack = await new Promise((resolve) => {
    a.emit('send_message', { message: 'hello from A (smoke)' }, (resp) => resolve(resp))
  })

  console.log('Send ack received:', ack)

  // wait for B to receive the message
  const receivedByB = await receiveByBPromise
  console.log('B received message:', receivedByB.id || receivedByB)

  // verify persistence via HTTP
  const res = await fetch(`${SERVER}/api/messages?page=1&limit=10`)
  const messages = await res.json()
  const found = messages.find((m) => Number(m.id) === Number(receivedByB.id))

  if (!found) {
    console.error('Message not found in /api/messages')
    process.exitCode = 2
  } else {
    console.log('Message persisted (found in /api/messages) with id=', found.id)
  }

  // B marks the message as read
  b.emit('message_read', { messageId: receivedByB.id })

  // A should receive a message_read event
  const readEvent = await waitForEvent(a, 'message_read')
  console.log('A received read receipt:', readEvent)

  // Clean up
  a.disconnect()
  b.disconnect()

  console.log('Smoke test completed')
}

run().catch((err) => {
  console.error('Smoke test failed:', err.message)
  process.exit(1)
})
