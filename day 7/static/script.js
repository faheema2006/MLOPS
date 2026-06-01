// ==================== UTILITY FUNCTIONS ====================
function updateSlider(elementId, value) {
    document.getElementById(elementId).value = value;
    const valueId = elementId.replace('Score', 'Value').replace('Gap', 'Value');
    document.getElementById(valueId).textContent = value;
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// ==================== FORM HANDLING ====================
async function handlePrediction(event) {
    event.preventDefault();
    
    // Show loading state
    showLoadingState();
    
    try {
        // Collect form data
        const formData = {
            resume_score: parseFloat(document.getElementById('resumeScore').value),
            skill_gap: parseFloat(document.getElementById('skillGap').value),
            communication_score: parseFloat(document.getElementById('communicationScore').value),
            technical_score: parseFloat(document.getElementById('technicalScore').value)
        };
        
        // Make API call
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            displayResults(result);
        } else {
            showError(result.message || 'Prediction failed');
        }
    } catch (error) {
        console.error('Prediction error:', error);
        showError('An error occurred during prediction. Please try again.');
    }
}

// ==================== RESULT DISPLAY ====================
function displayResults(result) {
    // Hide welcome card
    document.getElementById('welcomeCard').classList.add('hidden');
    
    // Show result card
    const resultCard = document.getElementById('resultCard');
    resultCard.classList.remove('hidden');
    document.getElementById('loadingCard').classList.add('hidden');
    document.getElementById('errorCard').classList.add('hidden');
    
    // Update timestamp
    document.getElementById('resultTime').textContent = 'Time: ' + result.timestamp;
    
    // Update ATS Score
    const atsScore = result.ats_score;
    document.getElementById('atsScore').textContent = atsScore;
    document.getElementById('atsProgress').style.width = (atsScore) + '%';
    
    // Update Role Fit
    document.getElementById('roleFit').textContent = result.prediction_label;
    document.getElementById('fitnessLabel').textContent = result.fitness_level;
    
    // Update confidence
    const confidence = result.prediction_confidence;
    document.getElementById('confidence').textContent = confidence.toFixed(1) + '%';
    document.getElementById('confProgress').style.width = confidence + '%';
    
    // Update breakdown
    updateBreakdown(result.breakdown);
    
    // Update insights
    displayInsights(result.insights);
    
    // Update recommendations
    displayRecommendations(result);
    
    // Scroll to results
    setTimeout(() => {
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

function updateBreakdown(breakdown) {
    const items = [
        { id: 'resume', key: 'resume_score', label: 'resumeBreakdown', value: 'resumeBreakValue' },
        { id: 'skill', key: 'skill_gap', label: 'skillBreakdown', value: 'skillBreakValue' },
        { id: 'comm', key: 'communication_score', label: 'commBreakdown', value: 'commBreakValue' },
        { id: 'tech', key: 'technical_score', label: 'techBreakdown', value: 'techBreakValue' }
    ];
    
    items.forEach(item => {
        let scoreValue = breakdown[item.key];
        
        // Convert skill gap to score (100 - gap = score)
        if (item.key === 'skill_gap') {
            scoreValue = 100 - scoreValue;
        }
        
        document.getElementById(item.label).style.width = scoreValue + '%';
        document.getElementById(item.value).textContent = scoreValue.toFixed(1) + '%';
    });
}

function displayInsights(insights) {
    const insightsList = document.getElementById('insightsList');
    insightsList.innerHTML = '';
    
    insights.forEach((insight, index) => {
        const li = document.createElement('li');
        li.textContent = insight;
        li.style.animationDelay = (index * 0.1) + 's';
        insightsList.appendChild(li);
    });
}

function displayRecommendations(result) {
    const atsScore = result.ats_score;
    const skillGap = result.breakdown.skill_gap;
    const communicationScore = result.breakdown.communication_score;
    const technicalScore = result.breakdown.technical_score;
    
    const recommendations = [];
    
    // ATS Score recommendations
    if (atsScore >= 80) {
        recommendations.push('✅ Excellent profile - Proceed with interview scheduling');
    } else if (atsScore >= 70) {
        recommendations.push('📋 Good candidate - Consider for interview with focus areas');
    } else {
        recommendations.push('⚠️ Consider additional training before moving forward');
    }
    
    // Skill gap recommendations
    if (skillGap <= 20) {
        recommendations.push('✅ Skills are well-aligned with job requirements');
    } else if (skillGap <= 40) {
        recommendations.push('📚 Recommend brief training on missing skills (2-4 weeks)');
    } else {
        recommendations.push('📚 Recommend comprehensive training program (1-3 months)');
    }
    
    // Communication recommendations
    if (communicationScore < 60) {
        recommendations.push('🎤 Focus on communication skills development');
    } else if (communicationScore < 75) {
        recommendations.push('🎤 Communication is adequate - minor improvement recommended');
    }
    
    // Technical recommendations
    if (technicalScore < 60) {
        recommendations.push('💻 Priority: Advanced technical training needed');
    } else if (technicalScore < 75) {
        recommendations.push('💻 Technical skills are good - specialized training optional');
    }
    
    // Overall recommendation
    if (result.prediction_label === 'Fit for Role') {
        recommendations.push('🎯 Overall: Fast-track this candidate for the next round');
    } else {
        recommendations.push('🎯 Overall: Schedule follow-up evaluation after addressing gaps');
    }
    
    // Display recommendations
    const recList = document.getElementById('recommendationsList');
    recList.innerHTML = '';
    recommendations.forEach((rec, index) => {
        const li = document.createElement('li');
        li.textContent = rec;
        li.style.animationDelay = (index * 0.1) + 's';
        recList.appendChild(li);
    });
}

// ==================== STATE MANAGEMENT ====================
function showLoadingState() {
    document.getElementById('resultCard').classList.add('hidden');
    document.getElementById('welcomeCard').classList.add('hidden');
    document.getElementById('errorCard').classList.add('hidden');
    document.getElementById('loadingCard').classList.remove('hidden');
}

function showError(message) {
    document.getElementById('resultCard').classList.add('hidden');
    document.getElementById('welcomeCard').classList.add('hidden');
    document.getElementById('loadingCard').classList.add('hidden');
    
    const errorCard = document.getElementById('errorCard');
    document.getElementById('errorMessage').textContent = message;
    errorCard.classList.remove('hidden');
}

function resetResults() {
    document.getElementById('resultCard').classList.add('hidden');
    document.getElementById('loadingCard').classList.add('hidden');
    document.getElementById('errorCard').classList.add('hidden');
    document.getElementById('welcomeCard').classList.remove('hidden');
}

// ==================== EXPORT FUNCTIONALITY ====================
function exportResults() {
    const atsScore = document.getElementById('atsScore').textContent;
    const roleFit = document.getElementById('roleFit').textContent;
    const confidence = document.getElementById('confidence').textContent;
    const resumeScore = document.getElementById('resumeScore').value;
    const skillGap = document.getElementById('skillGap').value;
    const communicationScore = document.getElementById('communicationScore').value;
    const technicalScore = document.getElementById('technicalScore').value;
    
    const reportText = `
SKILLSYNC - CANDIDATE ASSESSMENT REPORT
========================================
Generated: ${new Date().toLocaleString()}

MAIN METRICS:
- ATS Score: ${atsScore}/100
- Role Fit: ${roleFit}
- Confidence: ${confidence}

SCORE BREAKDOWN:
- Resume Quality: ${resumeScore}/100
- Skill Gap: ${skillGap}%
- Communication Skills: ${communicationScore}/100
- Technical Skills: ${technicalScore}/100

INSIGHTS:
${Array.from(document.getElementById('insightsList').querySelectorAll('li'))
    .map(li => '• ' + li.textContent)
    .join('\n')}

RECOMMENDATIONS:
${Array.from(document.getElementById('recommendationsList').querySelectorAll('li'))
    .map(li => '• ' + li.textContent)
    .join('\n')}

========================================
Report generated by SkillSync
    `.trim();
    
    // Create and download file
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(reportText));
    element.setAttribute('download', `SkillSync_Report_${new Date().getTime()}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    // Show notification
    showNotification('Report exported successfully!');
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// ==================== MODEL INFO ====================
async function loadModelInfo() {
    try {
        const response = await fetch('/api/model_info');
        const data = await response.json();
        
        if (data.status === 'success') {
            const infoContent = document.getElementById('infoContent');
            
            const html = `
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Model Type</div>
                        <div class="info-value">${data.model_type}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Test Accuracy</div>
                        <div class="info-value">${(data.test_accuracy * 100).toFixed(2)}%</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Features</div>
                        <div class="info-value">${data.feature_count}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Target Column</div>
                        <div class="info-value">${data.target_column}</div>
                    </div>
                </div>
            `;
            
            infoContent.innerHTML = html;
            
            // Update header status
            const modelStatus = document.getElementById('modelStatus');
            modelStatus.textContent = '✅ Model Status: Ready';
            modelStatus.style.color = '#10b981';
        }
    } catch (error) {
        console.error('Error loading model info:', error);
        document.getElementById('infoContent').innerHTML = 
            '<p style="color: #ef4444;">Unable to load model information</p>';
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    loadModelInfo();
    
    // Link input fields and sliders
    document.getElementById('resumeScore').addEventListener('change', function() {
        document.getElementById('resumeSlider').value = this.value;
    });
    document.getElementById('resumeSlider').addEventListener('input', function() {
        updateSlider('resumeScore', this.value);
    });
    
    document.getElementById('skillGap').addEventListener('change', function() {
        document.getElementById('skillSlider').value = this.value;
    });
    document.getElementById('skillSlider').addEventListener('input', function() {
        updateSlider('skillGap', this.value);
    });
    
    document.getElementById('communicationScore').addEventListener('change', function() {
        document.getElementById('commSlider').value = this.value;
    });
    document.getElementById('commSlider').addEventListener('input', function() {
        updateSlider('communicationScore', this.value);
    });
    
    document.getElementById('technicalScore').addEventListener('change', function() {
        document.getElementById('techSlider').value = this.value;
    });
    document.getElementById('techSlider').addEventListener('input', function() {
        updateSlider('technicalScore', this.value);
    });
    
    console.log('✓ SkillSync UI initialized successfully');
});

// ==================== ANIMATIONS ====================
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
