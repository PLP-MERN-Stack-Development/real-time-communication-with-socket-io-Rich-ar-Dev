import React, { useState } from 'react'

export default function Login({ onSubmit }) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(null)
  const [remember, setRemember] = useState(true)

  const submit = (e) => {
    e.preventDefault()
    const username = name.trim() || generateGuestName()
    onSubmit({ username, avatar, remember })
  }

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setAvatar(reader.result)
    reader.readAsDataURL(f)
  }

  const generateGuestName = () => {
    return `guest_${Math.random().toString(36).slice(2,8)}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Welcome</h2>
        <form onSubmit={submit} className="space-y-4">
          <input
            className="w-full border border-gray-200 dark:border-gray-700 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Enter a username (or leave blank for guest)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={onFile} className="hidden" />
              <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                {avatar ? <img src={avatar} alt="me" className="w-full h-full object-cover" /> : <span className="text-sm text-gray-600 dark:text-gray-300">Upload</span>}
              </div>
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-indigo-500" />
              Remember me
            </label>

            <button type="button" className="ml-auto bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-1 rounded" onClick={() => setName(generateGuestName())}>Random guest</button>
          </div>

          <div className="pt-2">
            <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded" type="submit">Join Chat</button>
          </div>
        </form>
      </div>
    </div>
  )
}
