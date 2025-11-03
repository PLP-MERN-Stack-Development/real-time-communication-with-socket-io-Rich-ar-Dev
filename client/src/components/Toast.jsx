import React from 'react'

export default function Toast({ toast }) {
  if (!toast) return null

  const color = toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-green-500' : 'bg-gray-800'

  return (
    <div className="fixed right-4 bottom-6 z-50">
      <div className={`px-4 py-2 rounded-md text-white shadow ${color}`}>{toast.message}</div>
    </div>
  )
}
