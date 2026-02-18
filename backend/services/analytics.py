"""Analytics service for computing dashboard statistics."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List
import json


def calculate_generation_score(difficulty: int, audio_score: int) -> float:
    """
    Calculate weighted generation score based on difficulty and audio quality.
    
    Formula: ((difficulty * 0.3) + (audio_score * 0.7)) * 10
    
    Where:
    - difficulty ranges from 1-10 (normalized to 0-1 by dividing by 10)
    - audio_score is the audio_quality_score (1-10), normalized to 0-1
    - Difficult prompts contribute more weight to the final score
    - Multiplied by 10 to get a 0-100 scale
    
    Examples:
    - difficulty=1, audio=10: (0.1*0.3 + 1.0*0.7) * 10 = 73
    - difficulty=10, audio=5: (1.0*0.3 + 0.5*0.7) * 10 = 65
    - difficulty=10, audio=10: (1.0*0.3 + 1.0*0.7) * 10 = 100
    """
    normalized_difficulty = difficulty / 10.0
    normalized_audio = audio_score / 10.0
    
    weighted = (normalized_difficulty * 0.3) + (normalized_audio * 0.7)
    return weighted * 100


async def compute_dashboard_analytics(session: AsyncSession) -> Dict[str, Any]:
    """Compute analytics for the dashboard."""
    
    # Overall averages
    avg_query = select(
        func.avg(TestResult.audio_quality_score).label('avg_audio'),
        func.avg(TestResult.llm_accuracy_score).label('avg_llm'),
        func.count(TestResult.id).label('total_tests'),
        func.count(func.distinct(TestResult.prompt_id)).label('unique_prompts')
    )
    result = await session.execute(avg_query)
    row = result.first()
    
    analytics = {
        'avg_audio_quality': float(row.avg_audio) if row.avg_audio else 0,
        'avg_llm_accuracy': float(row.avg_llm) if row.avg_llm else 0,
        'total_tests': row.total_tests or 0,
        'unique_prompts': row.unique_prompts or 0,
    }
    
    # Performance by drum type (extracted from generated JSON)
    by_drum_type = {}
    all_results = await session.execute(
        select(TestResult).where(TestResult.generated_json.isnot(None))
    )
    for test_result in all_results.scalars():
        try:
            json_data = test_result.generated_json if isinstance(test_result.generated_json, dict) else json.loads(test_result.generated_json)
            drum_kind = json_data.get('Kind', 'Unknown')
            if drum_kind not in by_drum_type:
                by_drum_type[drum_kind] = {'count': 0, 'audio_sum': 0, 'llm_sum': 0}
            by_drum_type[drum_kind]['count'] += 1
            by_drum_type[drum_kind]['audio_sum'] += test_result.audio_quality_score
            by_drum_type[drum_kind]['llm_sum'] += test_result.llm_accuracy_score
        except:
            continue
    
    # Compute averages for each drum type
    for drum_type, stats in by_drum_type.items():
        if stats['count'] > 0:
            stats['avg_audio'] = stats['audio_sum'] / stats['count']
            stats['avg_llm'] = stats['llm_sum'] / stats['count']
    
    analytics['by_drum_type'] = by_drum_type
    
    # Performance by difficulty level
    by_difficulty = {}
    difficulty_query = select(
        Prompt.difficulty,
        func.avg(TestResult.audio_quality_score).label('avg_audio'),
        func.avg(TestResult.llm_accuracy_score).label('avg_llm'),
        func.count(TestResult.id).label('count')
    ).join(TestResult, Prompt.id == TestResult.prompt_id).group_by(Prompt.difficulty)
    
    diff_results = await session.execute(difficulty_query)
    for row in diff_results:
        by_difficulty[row.difficulty] = {
            'count': row.count,
            'avg_audio': float(row.avg_audio) if row.avg_audio else 0,
            'avg_llm': float(row.avg_llm) if row.avg_llm else 0,
            'avg_combined': (float(row.avg_audio) + float(row.avg_llm)) / 2 if row.avg_audio and row.avg_llm else 0
        }
    
    analytics['by_difficulty'] = by_difficulty
    
    # Recent tests
    recent_query = select(TestResult, Prompt.text).join(
        Prompt, TestResult.prompt_id == Prompt.id, isouter=True
    ).order_by(TestResult.tested_at.desc()).limit(10)
    
    recent_results = await session.execute(recent_query)
    recent_tests = []
    for test_result, prompt_text in recent_results:
        recent_tests.append({
            'tested_at': test_result.tested_at.isoformat() if test_result.tested_at else None,
            'prompt_text': prompt_text or 'Free text prompt',
            'audio_quality_score': test_result.audio_quality_score,
            'llm_accuracy_score': test_result.llm_accuracy_score
        })
    
    analytics['recent_tests'] = recent_tests
    
    return analytics

