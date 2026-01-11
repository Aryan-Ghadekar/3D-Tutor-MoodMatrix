from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import os
from pathlib import Path

app = FastAPI()

class TestResult(BaseModel):
    testId: str
    timestamp: str
    lectureId: Optional[str] = None
    sessionId: Optional[str] = None
    topic: str
    sourceType: str
    totalQuestions: int
    score: int
    correctAnswers: int
    knowledgeAnalysis: Dict[str, Any]
    detailedResults: List[Dict[str, Any]]
    summary: Dict[str, Any]

class TestResultsResponse(BaseModel):
    success: bool
    message: str
    testId: str

# Create results directory if it doesn't exist
RESULTS_DIR = Path("test_results")
RESULTS_DIR.mkdir(exist_ok=True)

@app.post("/api/save-test-results")
async def save_test_results(test_result: TestResult):
    """Save detailed test results to file system"""
    try:
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"test_{test_result.testId}_{timestamp}.json"
        filepath = RESULTS_DIR / filename
        
        # Save to file
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(test_result.dict(), f, indent=2, ensure_ascii=False)
        
        # Also save to a cumulative results file
        cumulative_file = RESULTS_DIR / "all_test_results.json"
        
        # Load existing results or create new list
        if cumulative_file.exists():
            with open(cumulative_file, 'r', encoding='utf-8') as f:
                all_results = json.load(f)
        else:
            all_results = []
        
        # Add new result
        all_results.append(test_result.dict())
        
        # Save back to cumulative file
        with open(cumulative_file, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, indent=2, ensure_ascii=False)
        
        return TestResultsResponse(
            success=True,
            message=f"Test results saved successfully to {filename}",
            testId=test_result.testId
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save test results: {str(e)}")

@app.get("/api/test-results")
async def get_test_results():
    """Get all test results"""
    try:
        cumulative_file = RESULTS_DIR / "all_test_results.json"
        
        if not cumulative_file.exists():
            return {"results": [], "total": 0}
        
        with open(cumulative_file, 'r', encoding='utf-8') as f:
            all_results = json.load(f)
        
        return {
            "results": all_results,
            "total": len(all_results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve test results: {str(e)}")

@app.get("/api/test-results/{test_id}")
async def get_test_result(test_id: str):
    """Get specific test result by ID"""
    try:
        cumulative_file = RESULTS_DIR / "all_test_results.json"
        
        if not cumulative_file.exists():
            raise HTTPException(status_code=404, detail="No test results found")
        
        with open(cumulative_file, 'r', encoding='utf-8') as f:
            all_results = json.load(f)
        
        # Find the specific test result
        for result in all_results:
            if result.get("metadata", {}).get("testId") == test_id:
                return result
        
        raise HTTPException(status_code=404, detail=f"Test result with ID {test_id} not found")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve test result: {str(e)}")

@app.get("/api/student-analysis/{lecture_id}")
async def get_student_analysis(lecture_id: str):
    """Get analysis for all tests related to a specific lecture"""
    try:
        cumulative_file = RESULTS_DIR / "all_test_results.json"
        
        if not cumulative_file.exists():
            return {"analysis": None, "message": "No test results found"}
        
        with open(cumulative_file, 'r', encoding='utf-8') as f:
            all_results = json.load(f)
        
        # Filter results for this lecture
        lecture_results = [
            result for result in all_results 
            if result.get("metadata", {}).get("lectureId") == lecture_id
        ]
        
        if not lecture_results:
            return {"analysis": None, "message": "No test results found for this lecture"}
        
        # Aggregate analysis
        analysis = {
            "lectureId": lecture_id,
            "totalTests": len(lecture_results),
            "averageScore": sum(r["metadata"]["score"] for r in lecture_results) / len(lecture_results),
            "skillPerformance": {},
            "commonWeaknesses": {},
            "commonMisconceptions": [],
            "improvementTrend": [],
            "detailedResults": lecture_results
        }
        
        # Aggregate skill performance
        all_skills = set()
        for result in lecture_results:
            for skill_perf in result.get("summary", {}).get("skillPerformance", []):
                all_skills.add(skill_perf["skill"])
        
        for skill in all_skills:
            skill_scores = []
            for result in lecture_results:
                for skill_perf in result.get("summary", {}).get("skillPerformance", []):
                    if skill_perf["skill"] == skill:
                        skill_scores.append(skill_perf["accuracy"])
                        break
            
            if skill_scores:
                analysis["skillPerformance"][skill] = {
                    "average": sum(skill_scores) / len(skill_scores),
                    "highest": max(skill_scores),
                    "lowest": min(skill_scores),
                    "trend": "improving" if len(skill_scores) > 1 and skill_scores[-1] > skill_scores[0] else "stable"
                }
        
        # Aggregate common weaknesses
        weakness_counts = {}
        for result in lecture_results:
            for weakness in result.get("summary", {}).get("weaknesses", []):
                weakness_counts[weakness] = weakness_counts.get(weakness, 0) + 1
        
        analysis["commonWeaknesses"] = sorted(
            weakness_counts.items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:5]  # Top 5 weaknesses
        
        # Aggregate misconceptions
        all_misconceptions = []
        for result in lecture_results:
            all_misconceptions.extend(result.get("knowledgeAnalysis", {}).get("misconceptions", []))
        
        analysis["commonMisconceptions"] = all_misconceptions
        
        return {"analysis": analysis, "message": f"Analysis generated from {len(lecture_results)} test results"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate analysis: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
