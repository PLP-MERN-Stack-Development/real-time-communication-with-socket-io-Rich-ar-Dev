// messages.js - MongoDB (Mongoose) backed message helpers
import mongoose from '../config/db.js'

const { Schema } = mongoose

const messageSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  sender: String,
  senderId: String,
  message: String,
  attachment: String,
  timestamp: String,
  isPrivate: { type: Boolean, default: false },
  readBy: [
    {
      readerId: String,
      reader: String,
      readAt: String,
    },
  ],
})

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema)

export async function addMessage(message) {
  const doc = new Message({
    id: message.id,
    sender: message.sender,
    senderId: message.senderId,
    message: message.message || message.text || null,
    attachment: message.attachment || null,
    timestamp: message.timestamp,
    isPrivate: !!message.isPrivate,
    readBy: [],
  })
  await doc.save()
  return message
}

export async function getMessages({ page = 1, limit = 50 } = {}) {
  const skip = Math.max(0, (page - 1) * limit)
  const docs = await Message.find().sort({ id: 1 }).skip(skip).limit(limit).lean()
  return docs
}

export async function findMessageById(id) {
  const doc = await Message.findOne({ id }).lean()
  if (!doc) return null
  return doc
}

export async function addReadReceipt({ messageId, readerId, reader }) {
  await Message.updateOne({ id: messageId }, { $push: { readBy: { readerId, reader, readAt: new Date().toISOString() } } })
}

export default {
  addMessage,
  getMessages,
  findMessageById,
  addReadReceipt,
}
