# SkillSync: Decision Tree Model for Role Classification & ATS Scoring

## Overview
SkillSync is an AI-powered platform that uses a Decision Tree Classifier to determine if candidates are fit for specific job roles and calculates ATS (Applicant Tracking System) scores. The project includes a comprehensive Jupyter notebook for model training and a Flask web UI for interactive predictions.

## Project Structure
```
day 7/
├── decisiontree.ipynb              # Main notebook for model training and evaluation
├── app.py                          # Flask application for web UI
├── requirements.txt                # Python dependencies
├── README.md                       # This file
├── templates/
│   └── index.html                 # Main web interface
└── static/
    ├── style.css                  # Styling for the UI
    └── script.js                  # Client-side JavaScript
```

## Dataset
- **Path**: `C:\Users\FAHEEMA\OneDrive\MLOPS\SkillSync\clean_resume_dataset.csv`
- **Dataset**: Resume dataset with candidate information including resume quality, skills, experience, etc.

## Features

### 1. Decision Tree Model Training (Notebook)
- **Load and Preprocess**: Handles missing values and encodes categorical variables
- **Feature Engineering**: Creates relevant features for role classification
- **Model Training**: Trains Decision Tree Classifier with optimized parameters
- **Evaluation**: Provides accuracy, F1-score, confusion matrix, and classification reports
- **Feature Importance**: Visualizes which features are most important for predictions
- **Model Persistence**: Saves trained model using pickle for later use

### 2. ATS Score Calculation
- **Resume Score** (25% weight): Quality of resume matching job requirements
- **Skill Gap** (20% weight): Percentage of missing skills (inverted to score)
- **Communication Score** (25% weight): Communication capabilities
- **Technical Score** (30% weight): Technical proficiency

**Formula**: ATS_Score = (Resume_Score × 0.25) + (Skill_Match × 0.20) + (Communication × 0.25) + (Technical × 0.30)

### 3. Web UI (Flask Application)
- **Interactive Input Form**: Sliders and input fields for all metrics
- **Real-time Predictions**: Get immediate feedback on role fit
- **Comprehensive Results Dashboard**: 
  - ATS Score with visual progress bar
  - Role fitness classification (Fit/Not Fit)
  - Prediction confidence level
  - Score breakdown visualization
  - Key insights and recommendations
- **Export Functionality**: Download assessment reports as text files
- **Responsive Design**: Works on desktop and mobile devices

## Installation & Setup

### Step 1: Install Dependencies
```bash
cd d:\MLOPS\day 7
pip install -r requirements.txt
```

### Step 2: Run the Model Training Notebook
Open `decisiontree.ipynb` in Jupyter and run all cells:
```bash
jupyter notebook decisiontree.ipynb
```

**What happens**:
- ✓ Loads the resume dataset
- ✓ Preprocesses and encodes features
- ✓ Trains the Decision Tree Classifier
- ✓ Evaluates model performance
- ✓ Saves the model using pickle
- ✓ Generates visualizations

### Step 3: Start the Flask Application
```bash
python app.py
```

**Expected Output**:
```
============================================================
SkillSync: Decision Tree Model UI
============================================================
✓ Model loaded successfully
  Model Type: DecisionTreeClassifier
  Accuracy: 96.45%

✓ Starting Flask application...
  Open your browser and navigate to: http://localhost:5000
============================================================
```

### Step 4: Access the Web Interface
Open your browser and navigate to:
```
http://localhost:5000
```

## Usage Guide

### Using the Web UI

1. **Enter Candidate Metrics**:
   - **Resume Quality Score** (0-100): How well the resume matches job requirements
   - **Skill Gap** (0-100): Percentage of skills missing (lower is better)
   - **Communication Skills** (0-100): Communication proficiency
   - **Technical Skills** (0-100): Technical expertise

2. **Submit Assessment**:
   - Click "🔍 Evaluate Candidate" button
   - Wait for analysis to complete

3. **Review Results**:
   - **ATS Score**: Combined score from all metrics (0-100)
   - **Role Fit**: Prediction if candidate is fit for the role
   - **Confidence**: How confident the model is in its prediction
   - **Score Breakdown**: Detailed breakdown of each metric
   - **Key Insights**: AI-generated insights about the candidate
   - **Recommendations**: Actionable recommendations based on assessment

4. **Export Results**:
   - Click "📥 Export Results" to download a detailed report
   - Reports can be saved for records or sharing

### API Endpoints

#### 1. Single Prediction
**POST** `/api/predict`

**Request Body**:
```json
{
  "resume_score": 75,
  "skill_gap": 20,
  "communication_score": 80,
  "technical_score": 85
}
```

**Response**:
```json
{
  "status": "success",
  "prediction": 1,
  "prediction_label": "Fit for Role",
  "prediction_confidence": 95.3,
  "ats_score": 80.5,
  "fitness_level": "Recommended",
  "fitness_category": "good",
  "breakdown": {...},
  "insights": [...],
  "timestamp": "2024-06-01 10:30:45"
}
```

#### 2. Model Information
**GET** `/api/model_info`

**Response**:
```json
{
  "status": "success",
  "model_type": "DecisionTreeClassifier",
  "target_column": "Recommendation",
  "train_accuracy": 0.9645,
  "test_accuracy": 0.9612,
  "feature_count": 15
}
```

#### 3. Batch Predictions
**POST** `/api/batch_predict`

**Request Body**:
```json
[
  {"id": "C001", "resume_score": 75, "skill_gap": 20, "communication_score": 80, "technical_score": 85},
  {"id": "C002", "resume_score": 60, "skill_gap": 40, "communication_score": 70, "technical_score": 65}
]
```

## Model Performance

### Training Results
- **Training Accuracy**: ~96.46%
- **Testing Accuracy**: ~96.12%
- **Model Type**: Decision Tree Classifier
- **Target Column**: Role recommendation (Binary classification)

### Key Features Used
The model uses various features from the resume dataset to make predictions, with emphasis on:
1. Technical skills alignment
2. Experience level
3. Education qualifications
4. Communication abilities

## Output Files

### Generated Files (in Models directory)
- `decision_tree_model.pkl`: Trained decision tree classifier
- `label_encoders.pkl`: Label encoders for categorical features
- `model_metadata.pkl`: Model metadata and configuration

## Troubleshooting

### Issue: "Model not loaded"
**Solution**: Ensure the notebook has been run successfully to generate model files.

### Issue: Port 5000 already in use
**Solution**: Change port in `app.py`:
```python
app.run(debug=True, port=5001, host='0.0.0.0')  # Use 5001 instead
```

### Issue: Dataset not found
**Solution**: Verify the dataset path:
```
C:\Users\FAHEEMA\OneDrive\MLOPS\SkillSync\clean_resume_dataset.csv
```

### Issue: Low prediction confidence
**Cause**: Input values may be outside the training distribution
**Solution**: Ensure input values are realistic (0-100 range)

## Interpretation Guide

### ATS Score Ranges
- **80-100**: Excellent - Fast-track candidate
- **70-79**: Good - Consider for interview
- **60-69**: Fair - Additional training recommended
- **Below 60**: Poor - Significant gaps need attention

### Role Fit Classification
- **Fit for Role**: Candidate meets role requirements (ATS ≥ 70)
- **Not Fit for Role**: Candidate needs improvement (ATS < 70)

## Technologies Used
- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript
- **ML Framework**: Scikit-learn
- **Data Processing**: Pandas, NumPy
- **Visualization**: Matplotlib, Seaborn
- **Model Serialization**: Pickle

## Future Enhancements
1. ✨ Multiple ML models comparison
2. ✨ Resume parsing and automatic feature extraction
3. ✨ Interview question generation based on gaps
4. ✨ Candidate progress tracking
5. ✨ Database integration for candidate records
6. ✨ Advanced analytics dashboard
7. ✨ Email report distribution
8. ✨ Integration with ATS systems

## Notes
- The model is trained on the `clean_resume_dataset.csv` file
- Ensure all dependencies are installed before running
- For production deployment, consider using gunicorn or uwsgi instead of Flask's development server
- Model files are cached after first training run

## Contact & Support
For issues or questions, refer to the notebook documentation or check the model metadata in the saved pickle files.

---
**Last Updated**: June 2024
**Version**: 1.0
