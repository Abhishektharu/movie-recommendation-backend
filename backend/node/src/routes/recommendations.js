import express from 'express';
import authenticateToken from '../middleware/auth.js';
import mlService from '../services/ml.service.js';
import axios from 'axios';

const router = express.Router();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Get personalized recommendations (JWT protected)
router.get('/personalized', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit, 10) || 10;

    console.log(`📊 Getting recommendations for user ${userId}`);

    const mlResult = await mlService.getPersonalizedRecommendations(userId, limit);

    const movieDetails = await Promise.all(
      mlResult.movie_ids.map(async (movieId, index) => {
        try {
          const response = await axios.get(
            `${TMDB_BASE_URL}/movie/${movieId}`,
            { params: { api_key: TMDB_API_KEY } }
          );

          return {
            ...response.data,
            recommendation_score: mlResult.scores[index]
          };
        } catch {
          return null;
        }
      })
    );

    const validMovies = movieDetails.filter(Boolean);

    res.json({
      recommendations: validMovies,
      method: mlResult.method,
      count: validMovies.length
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Get similar movies (content-based)
router.get('/similar/:movieId', async (req, res) => {
  try {
    const movieId = Number(req.params.movieId);
    const limit = parseInt(req.query.limit, 10) || 10;

    const mlResult = await mlService.getSimilarMovies(movieId, limit);

    const movieDetails = await Promise.all(
      mlResult.movie_ids.map(async (id, index) => {
        try {
          const response = await axios.get(
            `${TMDB_BASE_URL}/movie/${id}`,
            { params: { api_key: TMDB_API_KEY } }
          );

          return {
            ...response.data,
            similarity_score: mlResult.scores[index]
          };
        } catch {
          return null;
        }
      })
    );

    const validMovies = movieDetails.filter(Boolean);

    res.json({
      similar_movies: validMovies,
      count: validMovies.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get similar movies' });
  }
});

// Get collaborative recommendations (JWT protected)
router.get('/collaborative', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit, 10) || 10;

    const mlResult = await mlService.getCollaborativeRecommendations(userId, limit);

    if (mlResult.movie_ids.length === 0) {
      return res.json({
        message: 'Not enough data. Please rate more movies!',
        recommendations: []
      });
    }

    const movieDetails = await Promise.all(
      mlResult.movie_ids.map(async (id, index) => {
        try {
          const response = await axios.get(
            `${TMDB_BASE_URL}/movie/${id}`,
            { params: { api_key: TMDB_API_KEY } }
          );

          return {
            ...response.data,
            predicted_rating: mlResult.scores[index]
          };
        } catch {
          return null;
        }
      })
    );

    const validMovies = movieDetails.filter(Boolean);

    res.json({
      recommendations: validMovies,
      method: 'collaborative_filtering',
      count: validMovies.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get collaborative recommendations' });
  }
});

// ML service health check
router.get('/ml-health', async (req, res) => {
  const health = await mlService.checkHealth();
  res.json(health);
});

export default router;