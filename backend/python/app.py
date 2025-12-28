# python-ml/app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
from dotenv import load_dotenv

# Import our ML models
from models.content_based import content_recommender
from models.collaborative import collaborative_recommender

load_dotenv()

app = FastAPI(
    title="Movie ML Recommendation Service",
    description="Machine Learning service for movie recommendations",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class RatingData(BaseModel):
    movie_id: int
    rating: float

class RecommendationRequest(BaseModel):
    user_id: int
    ratings: List[Dict] = []
    liked_movies: List[int] = []
    n_recommendations: int = 10
    method: str = "hybrid"  # content, collaborative, hybrid

class SimilarMoviesRequest(BaseModel):
    movie_id: int
    n_recommendations: int = 10

class CollaborativeRequest(BaseModel):
    user_id: int
    ratings: List[Dict]
    n_recommendations: int = 10

class RecommendationResponse(BaseModel):
    movie_ids: List[int]
    scores: List[float]
    method: str

@app.get("/")
async def root():
    return {
        "service": "Movie ML Recommendation Service",
        "status": "running",
        "version": "1.0.0",
        "endpoints": [
            "/health",
            "/api/ml/recommendations",
            "/api/ml/similar",
            "/api/ml/collaborative"
        ]
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "models_loaded": {
            "content_based": content_recommender.similarity_matrix is not None,
            "collaborative": True
        }
    }

@app.post("/api/ml/recommendations", response_model=RecommendationResponse)
async def get_recommendations(request: RecommendationRequest):
    """
    Get hybrid movie recommendations combining content and collaborative filtering
    """
    try:
        print(f"📊 Generating {request.method} recommendations for user {request.user_id}")
        
        if request.method == "content":
            # Content-based only
            if request.liked_movies:
                # Use first liked movie as seed
                movie_ids, scores = content_recommender.get_similar_movies(
                    request.liked_movies[0],
                    request.n_recommendations
                )
            else:
                # Use random popular movies
                movie_ids = [550, 278, 680, 155, 13, 423, 769, 24428, 329, 107]
                scores = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45]
            
            return RecommendationResponse(
                movie_ids=movie_ids[:request.n_recommendations],
                scores=scores[:request.n_recommendations],
                method="content_based"
            )
        
        elif request.method == "collaborative":
            # Collaborative filtering only
            if not request.ratings:
                raise HTTPException(status_code=400, detail="No ratings provided")
            
            movie_ids, scores = collaborative_recommender.get_recommendations(
                request.user_id,
                request.ratings,
                request.n_recommendations
            )
            
            if not movie_ids:
                # Fallback to popular movies
                movie_ids = [550, 278, 680, 155, 13]
                scores = [0.9, 0.85, 0.8, 0.75, 0.7]
            
            return RecommendationResponse(
                movie_ids=movie_ids[:request.n_recommendations],
                scores=scores[:request.n_recommendations],
                method="collaborative_filtering"
            )
        
        else:  # hybrid
            # Combine both approaches
            content_recs = []
            content_scores = []
            
            # Get content-based recommendations from liked movies
            if request.liked_movies:
                for movie_id in request.liked_movies[:3]:  # Use top 3 liked
                    try:
                        ids, scores = content_recommender.get_similar_movies(movie_id, 5)
                        content_recs.extend(ids)
                        content_scores.extend(scores)
                    except:
                        pass
            
            # Get collaborative recommendations
            collab_recs = []
            collab_scores = []
            
            if request.ratings and len(request.ratings) >= 3:
                try:
                    ids, scores = collaborative_recommender.get_recommendations(
                        request.user_id,
                        request.ratings,
                        request.n_recommendations
                    )
                    collab_recs = ids
                    collab_scores = scores
                except Exception as e:
                    print(f"Collaborative filtering error: {e}")
            
            # Combine recommendations
            combined = {}
            
            # Add content-based (weight: 0.4)
            for movie_id, score in zip(content_recs, content_scores):
                if movie_id not in combined:
                    combined[movie_id] = 0
                combined[movie_id] += score * 0.4
            
            # Add collaborative (weight: 0.6)
            for movie_id, score in zip(collab_recs, collab_scores):
                if movie_id not in combined:
                    combined[movie_id] = 0
                combined[movie_id] += score * 0.6
            
            # Sort by combined score
            if combined:
                sorted_recs = sorted(combined.items(), key=lambda x: x[1], reverse=True)
                movie_ids = [x[0] for x in sorted_recs[:request.n_recommendations]]
                scores = [x[1] for x in sorted_recs[:request.n_recommendations]]
            else:
                # Fallback to popular movies
                movie_ids = [550, 278, 680, 155, 13, 423, 769, 24428, 329, 107]
                scores = [0.95, 0.89, 0.87, 0.85, 0.82, 0.80, 0.78, 0.75, 0.73, 0.70]
            
            return RecommendationResponse(
                movie_ids=movie_ids[:request.n_recommendations],
                scores=scores[:request.n_recommendations],
                method="hybrid"
            )
        
    except Exception as e:
        print(f"❌ Error generating recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/similar", response_model=RecommendationResponse)
async def get_similar_movies(request: SimilarMoviesRequest):
    """
    Get similar movies using content-based filtering
    """
    try:
        print(f"🎬 Finding similar movies to {request.movie_id}")
        
        movie_ids, scores = content_recommender.get_similar_movies(
            request.movie_id,
            request.n_recommendations
        )
        
        if not movie_ids:
            # Return some default similar movies
            movie_ids = [278, 680, 155, 13]
            scores = [0.8, 0.75, 0.7, 0.65]
        
        return RecommendationResponse(
            movie_ids=movie_ids,
            scores=scores,
            method="content_based"
        )
        
    except Exception as e:
        print(f"❌ Error finding similar movies: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ml/collaborative", response_model=RecommendationResponse)
async def get_collaborative_recommendations(request: CollaborativeRequest):
    """
    Get recommendations using collaborative filtering
    """
    try:
        print(f"👥 Generating collaborative recommendations for user {request.user_id}")
        
        if not request.ratings:
            raise HTTPException(
                status_code=400,
                detail="No ratings provided. User needs to rate some movies first."
            )
        
        movie_ids, scores = collaborative_recommender.get_recommendations(
            request.user_id,
            request.ratings,
            request.n_recommendations
        )
        
        if not movie_ids:
            return RecommendationResponse(
                movie_ids=[],
                scores=[],
                method="collaborative_insufficient_data"
            )
        
        return RecommendationResponse(
            movie_ids=movie_ids,
            scores=scores,
            method="collaborative_filtering"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in collaborative filtering: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5000))
    print(f"""
╔═══════════════════════════════════════════╗
║  🤖 ML Recommendation Service Starting   ║
║  🚀 Server: http://localhost:{port}        ║
╚═══════════════════════════════════════════╝
    """)
    uvicorn.run(app, host="0.0.0.0", port=port)