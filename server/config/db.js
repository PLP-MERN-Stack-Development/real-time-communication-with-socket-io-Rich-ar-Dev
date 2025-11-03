// config/db.js - clean version
import dotenv from 'dotenv'
import path from 'path'
import mongoose from 'mongoose'

const envPath = path.join(process.cwd(), '.env')
console.log('Loading .env from:', envPath)

dotenv.config({ path: envPath })

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/socketio_chat'

export async function connectDB() {
  try {
    console.log('Mongo config: MONGO_URI present=', !!process.env.MONGO_URI)
    
    // Mask password in logs for security
    const maskedURI = MONGO_URI.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://$1:****@')
    console.log('MONGO_URI value:', maskedURI)
    
    // Remove deprecated options - use modern mongoose connection
    await mongoose.connect(MONGO_URI)
    console.log('✅ Connected to MongoDB successfully')
    
    // Connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err)
    })

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected')
    })

    return mongoose
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message)
    
    // Specific error guidance
    if (err.name === 'MongoServerSelectionError') {
      console.log('\n🔧 MongoDB Atlas Connection Failed:')
      console.log('1. Check if your IP is whitelisted in MongoDB Atlas')
      console.log('2. Verify your MongoDB Atlas cluster is running')
    } else if (err.message.includes('Database names cannot contain')) {
      console.log('\n🔧 Database Name Error:')
      console.log('Change your database name to remove dots (.)')
      console.log('Invalid: socket.io_communication')
      console.log('Valid: socketio_communication or socket_io_communication')
    }
    
    throw err
  }
}

export default mongoose;