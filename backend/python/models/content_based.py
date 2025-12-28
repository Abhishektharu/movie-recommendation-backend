# python-ml/models/content_based.py
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict
import json
import os

class ContentBasedRecommender:
    def __init__(self):
        self.movies = []
        self.movie_features = None
        self.similarity_matrix = None
        self.movie_id_to_index = {}
        self.index_to_movie_id = {}
        
    def load_movies(self, movies_data: List[Dict]):
        """Load movie data and create features"""
        self.movies = movies_data
        
        # Create movie ID mappings
        for idx, movie in enumerate(self.movies):
            movie_id = movie['movie_id']
            self.movie_id_to_index[movie_id] = idx
            self.index_to_movie_id[idx] = movie_id
        
        # Create combined features from genres, overview, and cast
        features = []
        for movie in self.movies:
            # Combine all text features
            genres = ' '.join(movie.get('genres', []))
            overview = movie.get('overview', '')
            cast = ' '.join(movie.get('cast', [])[:3])  # Top 3 cast members
            
            combined = f"{genres} {genres} {overview} {cast}"  # Weight genres more
            features.append(combined)
        
        # Create TF-IDF matrix
        tfidf = TfidfVectorizer(stop_words='english', max_features=1000)
        self.movie_features = tfidf.fit_transform(features)
        
        # Calculate similarity matrix
        self.similarity_matrix = cosine_similarity(self.movie_features)
        
        print(f"✅ Content-based model loaded with {len(self.movies)} movies")
    
    def get_similar_movies(self, movie_id: int, n: int = 10) -> tuple:
        """Get similar movies based on content"""
        if movie_id not in self.movie_id_to_index:
            print(f"⚠️ Movie {movie_id} not found in database")
            return [], []
        
        idx = self.movie_id_to_index[movie_id]
        
        # Get similarity scores
        sim_scores = list(enumerate(self.similarity_matrix[idx]))
        
        # Sort by similarity (excluding the movie itself)
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)[1:n+1]
        
        # Get movie IDs and scores
        movie_indices = [i[0] for i in sim_scores]
        scores = [float(i[1]) for i in sim_scores]
        
        similar_movie_ids = [self.index_to_movie_id[i] for i in movie_indices]
        
        return similar_movie_ids, scores
    
    def get_recommendations_by_genres(self, genres: List[str], n: int = 10) -> tuple:
        """Get recommendations based on preferred genres"""
        # Create a fake movie with these genres
        fake_movie_text = ' '.join(genres * 3)  # Repeat for emphasis
        
        tfidf = TfidfVectorizer(stop_words='english', max_features=1000)
        all_features = [fake_movie_text] + [
            f"{' '.join(m.get('genres', []))} {m.get('overview', '')}"
            for m in self.movies
        ]
        
        feature_matrix = tfidf.fit_transform(all_features)
        similarities = cosine_similarity(feature_matrix[0:1], feature_matrix[1:])[0]
        
        # Get top N
        top_indices = np.argsort(similarities)[::-1][:n]
        scores = similarities[top_indices]
        
        movie_ids = [self.movies[i]['movie_id'] for i in top_indices]
        
        return movie_ids, scores.tolist()

# Global instance
content_recommender = ContentBasedRecommender()

# Load sample data
data_path = os.path.join(os.path.dirname(__file__), '../data/sample_movies.json')
if os.path.exists(data_path):
    with open(data_path, 'r') as f:
        sample_movies = json.load(f)
        content_recommender.load_movies(sample_movies)