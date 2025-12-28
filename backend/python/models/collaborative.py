# python-ml/models/collaborative.py
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Tuple

class CollaborativeFilteringRecommender:
    def __init__(self):
        self.user_item_matrix = None
        self.user_similarity = None
        
    def create_user_item_matrix(self, all_ratings: List[Dict]) -> pd.DataFrame:
        """Create user-item rating matrix from all ratings"""
        # Convert to DataFrame
        df = pd.DataFrame(all_ratings)
        
        if df.empty:
            return pd.DataFrame()
        
        # Create pivot table: users as rows, movies as columns
        user_item_matrix = df.pivot_table(
            index='user_id',
            columns='movie_id',
            values='rating',
            fill_value=0
        )
        
        return user_item_matrix
    
    def fit(self, all_ratings: List[Dict]):
        """Train the collaborative filtering model"""
        self.user_item_matrix = self.create_user_item_matrix(all_ratings)
        
        if self.user_item_matrix.empty:
            print("⚠️ No ratings data available")
            return
        
        # Calculate user-user similarity
        self.user_similarity = cosine_similarity(self.user_item_matrix)
        
        print(f"✅ Collaborative model trained with {len(self.user_item_matrix)} users")
    
    def get_recommendations(self, user_id: int, user_ratings: List[Dict], n: int = 10) -> Tuple[List[int], List[float]]:
        """Get recommendations for a user based on similar users"""
        
        # Create temporary matrix with current user
        temp_ratings = user_ratings.copy()
        temp_df = pd.DataFrame(temp_ratings)
        
        if temp_df.empty:
            return [], []
        
        # Create user-item matrix
        user_item = temp_df.pivot_table(
            index='user_id',
            columns='movie_id',
            values='rating',
            fill_value=0
        )
        
        if user_id not in user_item.index:
            return [], []
        
        # Get this user's ratings
        user_ratings_vector = user_item.loc[user_id]
        
        # Calculate similarity with all users
        similarities = cosine_similarity([user_ratings_vector], user_item)[0]
        
        # Get most similar users (excluding self)
        similar_users_idx = np.argsort(similarities)[::-1][1:11]  # Top 10 similar users
        
        # Predict ratings for unwatched movies
        predictions = {}
        
        for idx in similar_users_idx:
            if similarities[idx] <= 0:
                continue
                
            similar_user_id = user_item.index[idx]
            similar_user_ratings = user_item.loc[similar_user_id]
            
            # Find movies the similar user rated highly but current user hasn't seen
            for movie_id in similar_user_ratings.index:
                if user_ratings_vector[movie_id] == 0 and similar_user_ratings[movie_id] >= 3.5:
                    if movie_id not in predictions:
                        predictions[movie_id] = 0
                    # Weighted by similarity
                    predictions[movie_id] += similar_user_ratings[movie_id] * similarities[idx]
        
        # Sort by predicted rating
        if not predictions:
            return [], []
        
        sorted_predictions = sorted(predictions.items(), key=lambda x: x[1], reverse=True)[:n]
        
        movie_ids = [int(x[0]) for x in sorted_predictions]
        scores = [float(x[1]) for x in sorted_predictions]
        
        # Normalize scores to 0-1 range
        if scores:
            max_score = max(scores)
            if max_score > 0:
                scores = [s / max_score for s in scores]
        
        return movie_ids, scores

# Global instance
collaborative_recommender = CollaborativeFilteringRecommender()