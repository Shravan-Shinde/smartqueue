const mongoose = require('mongoose');

/**
 * Reusable MongoDB / Mongoose connection handler.
 * Real MongoDB connection is MANDATORY for Sprint 1 Authentication.
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoURI) {
    console.error('================================================================');
    console.error('FATAL DATABASE CONFIGURATION ERROR:');
    console.error('MONGO_URI environment variable is missing.');
    console.error('Real MongoDB persistence is REQUIRED for SmartQueue Authentication.');
    console.error('Please configure MONGO_URI in your .env file or environment.');
    console.error('================================================================');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoURI, {});

    console.log(`[DB SUCCESS] MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`[DB FATAL ERROR] MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
