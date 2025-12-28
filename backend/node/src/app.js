import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Local imports
import { db } from './db.js';
import authRoutes from './routes/auth.js';
import movieRoutes from './routes/movies.js';
import recommendationRoutes from './routes/recommendations.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🎬 Movie Recommendation API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      movies: '/api/movies',
      recommendations: '/api/recommendations'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/recommendations', recommendationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║  🎬 Movie Recommendation API Started  ║
║  🚀 Server: http://localhost:${PORT}    ║
║  📚 Docs: http://localhost:${PORT}/     ║
╚═══════════════════════════════════════╝
  `);
});
