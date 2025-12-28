import axios from 'axios';
import { dbAsync } from '../db.js';

const PYTHON_ML_URL = process.env.PYTHON_ML_URL || 'http://localhost:5000';

// Simple in-memory cache (no Redis)
const cache = {
  data: {},

  set(key, value, ttlSeconds = 3600) {
    this.data[key] = {
      value,
      expiry: Date.now() + ttlSeconds * 1000
    };
  },

  get(key) {
    const item = this.data[key];
    if (!item) return null;
    if (Date.now() > item.expiry) {
      delete this.data[key];
      return null;
    }
    return item.value;
  },

  clear() {
    this.data = {};
  }
};

class MLService {
  // Personalized recommendations (hybrid)
  async getPersonalizedRecommendations(userId, limit = 10) {
    try {
      const cacheKey = `rec:user:${userId}:${limit}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('✅ Returning cached recommendations');
        return cached;
      }

      const ratings = await dbAsync.all(
        'SELECT movie_id, rating FROM ratings WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );

      const likes = await dbAsync.all(
        'SELECT movie_id FROM likes WHERE user_id = ?',
        [userId]
      );

      console.log('🤖 Calling ML service for recommendations...');
      const response = await axios.post(
        `${PYTHON_ML_URL}/api/ml/recommendations`,
        {
          user_id: userId,
          ratings,
          liked_movies: likes.map(l => l.movie_id),
          n_recommendations: limit,
          method: 'hybrid'
        },
        { timeout: 10000 }
      );

      const result = response.data;
      cache.set(cacheKey, result, 3600);
      return result;
    } catch (error) {
      console.error('❌ ML Service Error:', error.message);

      return {
        movie_ids: [550, 278, 680, 155, 13, 423, 769, 24428, 329, 107].slice(0, limit),
        scores: Array.from({ length: limit }, (_, i) => 0.9 - i * 0.05),
        method: 'fallback'
      };
    }
  }

  // Similar movies (content-based)
  async getSimilarMovies(movieId, limit = 10) {
    try {
      const cacheKey = `similar:${movieId}:${limit}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const response = await axios.post(
        `${PYTHON_ML_URL}/api/ml/similar`,
        { movie_id: movieId, n_recommendations: limit },
        { timeout: 5000 }
      );

      const result = response.data;
      cache.set(cacheKey, result, 7200);
      return result;
    } catch (error) {
      console.error('❌ Similar Movies Error:', error.message);
      return { movie_ids: [], scores: [], method: 'fallback' };
    }
  }

  // Collaborative filtering
  async getCollaborativeRecommendations(userId, limit = 10) {
    try {
      const ratings = await dbAsync.all(
        'SELECT movie_id, rating FROM ratings WHERE user_id = ?',
        [userId]
      );

      if (ratings.length === 0) {
        return { movie_ids: [], scores: [], method: 'no_data' };
      }

      const response = await axios.post(
        `${PYTHON_ML_URL}/api/ml/collaborative`,
        {
          user_id: userId,
          ratings,
          n_recommendations: limit
        },
        { timeout: 10000 }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Collaborative Error:', error.message);
      return { movie_ids: [], scores: [], method: 'fallback' };
    }
  }

  // Clear cached recommendations for a user
  clearUserCache(userId) {
    Object.keys(cache.data).forEach(key => {
      if (key.includes(`user:${userId}`)) {
        delete cache.data[key];
      }
    });
  }

  // ML service health check
  async checkHealth() {
    try {
      const response = await axios.get(`${PYTHON_ML_URL}/health`, {
        timeout: 3000
      });
      return response.data;
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}

const mlService = new MLService();
export default mlService;
export { MLService };
