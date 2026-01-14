export const authConfig = {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-key-change-this-in-production',
    expiresIn: '30d', // Token expires in 30 days
  },
  bcrypt: {
    saltRounds: 10,
  },
  cors: {
    // Update this with your actual domain in production
    allowedOrigins: process.env.NODE_ENV === 'production'
      ? ['https://your-domain.com']
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:6767'],
  },
};