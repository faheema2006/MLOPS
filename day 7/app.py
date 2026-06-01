"""
SkillSync: Decision Tree Model UI for Role Classification & ATS Scoring
This Flask application provides an interactive interface to classify candidates 
and calculate ATS scores using the trained Decision Tree model.
"""

from flask import Flask, render_template, request, jsonify
import pickle
import numpy as np
import pandas as pd
import os
import json
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# ==================== MODEL LOADING ====================
def load_model():
    """Load the trained Decision Tree model and metadata"""
    try:
        model_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                                 'SkillSync', 'Models')
        
        model_path = os.path.join(model_dir, 'decision_tree_model.pkl')
        metadata_path = os.path.join(model_dir, 'model_metadata.pkl')
        
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        
        with open(metadata_path, 'rb') as f:
            metadata = pickle.load(f)
        
        return model, metadata
    except Exception as e:
        print(f"Error loading model: {e}")
        return None, None

# Load model at startup
dt_model, model_metadata = load_model()

# ==================== UTILITY FUNCTIONS ====================
def calculate_ats_score(resume_score, skill_gap, communication_score, technical_score):
    """
    Calculate ATS (Applicant Tracking System) score for a candidate
    
    Parameters:
    - resume_score: Quality of resume (0-100)
    - skill_gap: Skill gap percentage (0-100, lower is better)
    - communication_score: Communication skills (0-100)
    - technical_score: Technical skills (0-100)
    
    Returns:
    - ATS score (0-100)
    """
    # Normalize inputs
    resume_score = max(0, min(100, resume_score))
    skill_gap = max(0, min(100, 100 - skill_gap))  # Convert gap to score
    communication_score = max(0, min(100, communication_score))
    technical_score = max(0, min(100, technical_score))
    
    # Weighted calculation
    weights = {
        'resume': 0.25,
        'skill_gap': 0.20,
        'communication': 0.25,
        'technical': 0.30
    }
    
    ats_score = (
        resume_score * weights['resume'] +
        skill_gap * weights['skill_gap'] +
        communication_score * weights['communication'] +
        technical_score * weights['technical']
    )
    
    return round(ats_score, 2)

def get_fitness_level(prediction, ats_score):
    """Determine fitness level based on prediction and ATS score"""
    if prediction == 1:
        if ats_score >= 80:
            return "Highly Recommended", "excellent"
        elif ats_score >= 70:
            return "Recommended", "good"
        else:
            return "Recommended", "fair"
    else:
        return "Not Recommended", "poor"

def get_insights(ats_score, skill_gap, communication_score, technical_score):
    """Generate insights based on scores"""
    insights = []
    
    if ats_score >= 80:
        insights.append("✓ Excellent ATS score - Candidate is well-qualified")
    elif ats_score >= 70:
        insights.append("⚠ Good ATS score - Candidate has potential")
    else:
        insights.append("⚠ Lower ATS score - Candidate needs improvement")
    
    if skill_gap <= 20:
        insights.append("✓ Skills closely match job requirements")
    elif skill_gap <= 40:
        insights.append("⚠ Minor skill gaps - Quick training can help")
    else:
        insights.append("⚠ Significant skill gaps - Training required")
    
    if communication_score >= 75:
        insights.append("✓ Strong communication skills")
    else:
        insights.append("⚠ Communication skills need improvement")
    
    if technical_score >= 75:
        insights.append("✓ Strong technical skills")
    else:
        insights.append("⚠ Technical skills need improvement")
    
    return insights

# ==================== ROUTES ====================
@app.route('/')
def index():
    """Render the main application page"""
    return render_template('index.html', model_status="Loaded" if dt_model else "Not Loaded")

@app.route('/api/predict', methods=['POST'])
def predict():
    """
    API endpoint for making predictions
    Expected JSON format:
    {
        "resume_score": float (0-100),
        "skill_gap": float (0-100),
        "communication_score": float (0-100),
        "technical_score": float (0-100),
        "other_features": {} (optional, for additional features)
    }
    """
    try:
        if dt_model is None or model_metadata is None:
            return jsonify({
                'status': 'error',
                'message': 'Model not loaded. Please check model files.'
            }), 500
        
        data = request.get_json()
        
        # Extract input data
        resume_score = float(data.get('resume_score', 0))
        skill_gap = float(data.get('skill_gap', 0))
        communication_score = float(data.get('communication_score', 0))
        technical_score = float(data.get('technical_score', 0))
        
        # Prepare features for model prediction
        feature_columns = model_metadata.get('feature_columns', [])
        
        # Create feature array based on what the model expects
        # For simplicity, use the provided scores as features
        features_dict = {}
        
        # Map scores to feature columns if they exist
        score_mapping = {
            'Resume_Score': resume_score,
            'Skill_Gap': skill_gap,
            'Communication_Score': communication_score,
            'Technical_Score': technical_score
        }
        
        # Initialize all features with 0
        for col in feature_columns:
            features_dict[col] = 0
        
        # Set available features
        for col, val in score_mapping.items():
            if col in features_dict:
                features_dict[col] = val
        
        # Create feature array in the correct order
        feature_array = np.array([[features_dict.get(col, 0) for col in feature_columns]])
        
        # Make prediction
        prediction = dt_model.predict(feature_array)[0]
        prediction_proba = dt_model.predict_proba(feature_array)[0]
        
        # Calculate ATS score
        ats_score = calculate_ats_score(resume_score, skill_gap, communication_score, technical_score)
        
        # Determine fitness level
        fitness_level, fitness_category = get_fitness_level(prediction, ats_score)
        
        # Generate insights
        insights = get_insights(ats_score, skill_gap, communication_score, technical_score)
        
        # Prepare response
        response = {
            'status': 'success',
            'prediction': int(prediction),
            'prediction_label': 'Fit for Role' if prediction == 1 else 'Not Fit for Role',
            'prediction_confidence': float(max(prediction_proba) * 100),
            'ats_score': ats_score,
            'fitness_level': fitness_level,
            'fitness_category': fitness_category,
            'breakdown': {
                'resume_score': resume_score,
                'skill_gap': skill_gap,
                'communication_score': communication_score,
                'technical_score': technical_score
            },
            'insights': insights,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Prediction error: {str(e)}'
        }), 400

@app.route('/api/model_info', methods=['GET'])
def model_info():
    """Get information about the loaded model"""
    try:
        if dt_model is None or model_metadata is None:
            return jsonify({
                'status': 'error',
                'message': 'Model not loaded'
            }), 500
        
        info = {
            'status': 'success',
            'model_type': model_metadata.get('model_type', 'Unknown'),
            'target_column': model_metadata.get('target_column', 'Unknown'),
            'train_accuracy': model_metadata.get('train_accuracy', 0),
            'test_accuracy': model_metadata.get('test_accuracy', 0),
            'feature_count': len(model_metadata.get('feature_columns', [])),
            'feature_columns': model_metadata.get('feature_columns', [])[:10]  # Return first 10
        }
        
        return jsonify(info)
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error: {str(e)}'
        }), 400

@app.route('/api/batch_predict', methods=['POST'])
def batch_predict():
    """
    API endpoint for batch predictions
    Expected JSON format: List of prediction objects
    """
    try:
        data = request.get_json()
        
        if not isinstance(data, list):
            return jsonify({
                'status': 'error',
                'message': 'Expected list of prediction objects'
            }), 400
        
        results = []
        for item in data:
            try:
                resume_score = float(item.get('resume_score', 0))
                skill_gap = float(item.get('skill_gap', 0))
                communication_score = float(item.get('communication_score', 0))
                technical_score = float(item.get('technical_score', 0))
                
                ats_score = calculate_ats_score(resume_score, skill_gap, 
                                               communication_score, technical_score)
                
                fitness_level, fitness_category = get_fitness_level(0, ats_score)
                
                results.append({
                    'candidate_id': item.get('id', 'Unknown'),
                    'ats_score': ats_score,
                    'fitness_level': fitness_level,
                    'status': 'success'
                })
            except Exception as e:
                results.append({
                    'candidate_id': item.get('id', 'Unknown'),
                    'status': 'error',
                    'message': str(e)
                })
        
        return jsonify({
            'status': 'success',
            'total': len(results),
            'results': results
        })
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Batch prediction error: {str(e)}'
        }), 400

# ==================== ERROR HANDLERS ====================
@app.errorhandler(404)
def not_found(error):
    return jsonify({'status': 'error', 'message': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'status': 'error', 'message': 'Internal server error'}), 500

# ==================== MAIN ====================
if __name__ == '__main__':
    print("="*60)
    print("SkillSync: Decision Tree Model UI")
    print("="*60)
    
    if dt_model:
        print("✓ Model loaded successfully")
        print(f"  Model Type: {model_metadata.get('model_type')}")
        print(f"  Accuracy: {model_metadata.get('test_accuracy')*100:.2f}%")
    else:
        print("⚠ Warning: Model not loaded. Predictions may fail.")
    
    print("\n✓ Starting Flask application...")
    print("  Open your browser and navigate to: http://localhost:5000")
    print("="*60)
    
    app.run(debug=True, port=5000, host='0.0.0.0')
