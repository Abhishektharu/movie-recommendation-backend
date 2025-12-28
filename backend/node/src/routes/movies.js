import express from 'express';
import axios from 'axios';
import { dbAsync } from '../db.js';
import authenticateToken from '../middleware/auth.js';
import mlService from '../services/ml.service.js';

const router = express.Router();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// --------------------
// Public routes
// --------------------

// Get trending movies
router.get('/trending', async (req, res) => {
  try {
    const response = await axios.get(
      `${TMDB_BASE_URL}/trending/movie/week`,
      { params: { api_key: TMDB_API_KEY } }
    );
    res.json(response.data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// Search movies (⚠️ must be before /:id)
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const response = await axios.get(
      `${TMDB_BASE_URL}/search/movie`,
      {
        params: {
          api_key: TMDB_API_KEY,
          query: encodeURIComponent(query)
        }
      }
    );
    res.json(response.data);
  } catch {
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

// Get movie details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(
      `${TMDB_BASE_URL}/movie/${id}`,
      {
        params: {
          api_key: TMDB_API_KEY,
          append_to_response: 'credits,videos'
        }
      }
    );
    res.json(response.data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch movie details' });
  }
});

// --------------------
// Protected routes
// --------------------

// Like a movie
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const movieId = req.params.id;

    await dbAsync.run(
      'INSERT OR IGNORE INTO likes (user_id, movie_id) VALUES (?, ?)',
      [userId, movieId]
    );

    // 🔥 Clear ML cache after preference change
    mlService.clearUserCache(userId);

    res.json({ message: 'Movie liked', liked: true });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// Unlike a movie
router.delete('/:id/like', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const movieId = req.params.id;

    await dbAsync.run(
      'DELETE FROM likes WHERE user_id = ? AND movie_id = ?',
      [userId, movieId]
    );

    mlService.clearUserCache(userId);

    res.json({ message: 'Movie unliked', liked: false });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// Rate a movie
router.post('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const movieId = req.params.id;
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ error: 'Rating must be between 1 and 5' });
    }

    await dbAsync.run(
      `
      INSERT INTO ratings (user_id, movie_id, rating, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, movie_id)
      DO UPDATE SET
        rating = excluded.rating,
        updated_at = CURRENT_TIMESTAMP
      `,
      [userId, movieId, rating]
    );

    // 🔥 Clear ML cache after rating change
    mlService.clearUserCache(userId);

    res.json({ message: 'Movie rated successfully', rating });
  } catch (error) {
    console.error('❌ SQLITE ERROR:', error);   // 👈 IMPORTANT
    res.status(500).json({ error: 'Database error' });
  }
});

// Get user's liked movies
router.get('/user/likes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const likes = await dbAsync.all(
      'SELECT movie_id FROM likes WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    res.json({ likes: likes.map(l => l.movie_id) });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get user's ratings
router.get('/user/ratings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const ratings = await dbAsync.all(
      `
      SELECT movie_id, rating, created_at
      FROM ratings
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );

    res.json({ ratings });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
