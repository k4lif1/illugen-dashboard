import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

export default function DashboardPage({ setOverlayLoading }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDrumType, setSelectedDrumType] = useState('all');
  const [selectedVersion, setSelectedVersion] = useState('all');
  const [availableDrumTypes, setAvailableDrumTypes] = useState([]);
  const [showScoreTooltip, setShowScoreTooltip] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [chartView, setChartView] = useState('bar'); // 'bar' or 'pie'
  const [hoveredPieSegment, setHoveredPieSegment] = useState(null);
  const prevPathname = useRef(location.pathname);
  const drumChartScrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // All possible versions from the generation website
  const ALL_VERSIONS = ['v11', 'v12', 'v13', 'v14', 'v15', 'v16', 'v17'];

  useEffect(() => {
    const run = async () => {
      setOverlayLoading?.(true);
      await Promise.all([loadDrumTypes(), loadAnalytics()]);
      setOverlayLoading?.(false);
    };
    run();
  }, []);

  // Refresh analytics when navigating to dashboard from another page
  // This ensures the dashboard shows current data when returning (e.g., after deleting a result)
  useEffect(() => {
    const wasOnDashboard = prevPathname.current === '/dashboard';
    const isNowOnDashboard = location.pathname === '/dashboard';
    
    // If we navigated TO dashboard FROM another page, refresh the data
    if (!wasOnDashboard && isNowOnDashboard) {
      loadAnalytics();
    }
    
    prevPathname.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    loadAnalytics();
  }, [selectedDrumType, selectedVersion]);

  const loadDrumTypes = async () => {
    try {
      const { data } = await api.get('/api/prompts/', { params: { limit: 5000 } });
      const types = [...new Set(data.map(p => p.drum_type).filter(Boolean))].sort();
      setAvailableDrumTypes(types);
    } catch (err) {
      console.error('Failed to load drum types:', err);
    }
  };

  const loadAnalytics = async () => {
    try {
      const params = {};
      if (selectedDrumType !== 'all') params.drum_type = selectedDrumType;
      if (selectedVersion !== 'all') params.model_version = selectedVersion;
      const { data } = await api.get('/api/results/dashboard', { params });
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const { data } = await api.get('/api/results/export-data');
      
      // Create a blob and download it
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `drumgen-test-data-${timestamp}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data:', err);
      alert('Failed to export data. Please try again.');
    }
  };


  // Determine if we have data to display
  const hasData = analytics && analytics.total_tests > 0;

  // Filter data by version if selected
  const filteredByVersion = hasData && selectedVersion === 'all' ? analytics : hasData ? {
    ...analytics,
    by_version: analytics?.by_version?.filter(v => v.version === selectedVersion) || []
  } : null;

  const currentVersionData = hasData && selectedVersion !== 'all'
    ? analytics?.by_version?.find(v => v.version === selectedVersion)
    : null;

  const displayScore = hasData 
    ? (selectedVersion === 'all' 
        ? analytics.overall_generation_score 
        : (currentVersionData?.generation_score || 0))
    : 0;

  // Calculate color for heat map (1=red, 10=green) - more vibrant
  const getScoreColor = (score) => {
    const colors = [
      '#ff1744', // 1 - bright red
      '#ff5722', // 2 - vibrant orange-red
      '#ff9100', // 3 - bright orange
      '#ffc400', // 4 - vibrant yellow-orange
      '#ffea00', // 5 - bright yellow
      '#c6ff00', // 6 - lime
      '#76ff03', // 7 - bright light green
      '#00e676', // 8 - vibrant green
      '#00c853', // 9 - bright emerald
      '#00b248', // 10 - rich green
    ];
    return colors[score - 1] || colors[4]; // default to yellow
  };

  // Convert 0-100 score to 1-10 scale (rounding up) for color mapping
  const scoreToColorScale = (score100) => {
    if (score100 <= 0) return 1;
    if (score100 >= 100) return 10;
    // Divide by 10 and round up: 43/10 = 4.3 -> 5, 57/10 = 5.7 -> 6
    return Math.ceil(score100 / 10);
  };

  // Get color for a 0-100 score
  const getScore100Color = (score100) => {
    const scaleScore = scoreToColorScale(score100);
    return getScoreColor(scaleScore);
  };

  // Green color for score 10 (used for "/100")
  const score10Green = '#16a34a';

  // Get color for difficulty (1=bright pink, 10=deep purple) - more vibrant
  const getDifficultyColor = (difficulty) => {
    const colors = [
      '#ff69b4', // 1 - hot pink
      '#ff1493', // 2 - deep pink
      '#ff00ff', // 3 - magenta
      '#da00ff', // 4 - bright purple-pink
      '#c000ff', // 5 - vivid purple
      '#a020f0', // 6 - vibrant purple
      '#8a2be2', // 7 - blue violet
      '#6a0dad', // 8 - purple
      '#4b0082', // 9 - indigo
      '#2d0054', // 10 - deep purple
    ];
    return colors[difficulty - 1] || colors[4];
  };

  // Calculate pie chart data for scores (lowest to highest, starting from right)
  const getScorePieData = () => {
    if (!analytics?.difficulty_distribution) return [];
    
    const scoreCounts = {};
    for (let i = 1; i <= 10; i++) {
      scoreCounts[i] = 0;
    }
    
    analytics.difficulty_distribution.forEach(diff => {
      Object.entries(diff.score_distribution).forEach(([score, count]) => {
        scoreCounts[score] = (scoreCounts[score] || 0) + count;
      });
    });
    
    const total = Object.values(scoreCounts).reduce((a, b) => a + b, 0);
    
    return Object.entries(scoreCounts)
      .map(([score, count]) => ({
        score: parseInt(score),
        count,
        percentage: total > 0 ? (count / total * 100).toFixed(1) : 0
      }))
      .filter(d => d.count > 0)
      .sort((a, b) => a.score - b.score); // Sort ascending for lowest to highest
  };

  // Calculate pie chart data for difficulty (lowest to highest, starting from right)
  const getDifficultyPieData = () => {
    if (!analytics?.difficulty_distribution) return [];
    
    const total = analytics.difficulty_distribution.reduce((sum, d) => sum + d.total_tests, 0);
    
    return analytics.difficulty_distribution
      .map(diff => ({
        difficulty: diff.difficulty,
        count: diff.total_tests,
        percentage: total > 0 ? (diff.total_tests / total * 100).toFixed(1) : 0
      }))
      .filter(d => d.count > 0)
      .sort((a, b) => a.difficulty - b.difficulty); // Sort ascending for lowest to highest
  };

  // Generate SVG path for pie slice
  const getPieSlicePath = (startAngle, endAngle, radius, innerRadius = 0) => {
    const start = polarToCartesian(0, 0, radius, endAngle);
    const end = polarToCartesian(0, 0, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    if (innerRadius === 0) {
      return [
        "M", 0, 0,
        "L", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        "Z"
      ].join(" ");
    } else {
      const innerStart = polarToCartesian(0, 0, innerRadius, endAngle);
      const innerEnd = polarToCartesian(0, 0, innerRadius, startAngle);
      return [
        "M", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        "L", innerEnd.x, innerEnd.y,
        "A", innerRadius, innerRadius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
        "Z"
      ].join(" ");
    }
  };

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };


  return (
    <div className="grid" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header with Filters */}
      <div className="flex items-center justify-between" style={{ gap: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700' }}>
          Analytics Dashboard
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={exportData}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderColor: '#667eea',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
            }}
            title="Export all test data as JSON for LLM analysis"
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Data
          </button>
          <div style={{ minWidth: '180px' }}>
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="input"
              style={{ cursor: 'pointer', width: '100%' }}
            >
              <option value="all">All Versions</option>
              {ALL_VERSIONS.map(v => (
                <option key={v} value={v}>{v.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: '200px' }}>
            <select
              value={selectedDrumType}
              onChange={(e) => setSelectedDrumType(e.target.value)}
              className="input"
              style={{ cursor: 'pointer', width: '100%' }}
            >
              <option value="all">All Drum Types</option>
              {availableDrumTypes.map(dt => (
                <option key={dt} value={dt}>{dt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="text-secondary">Loading analytics...</p>
        </div>
      )}

      {/* Empty State - No Data */}
      {!loading && !hasData && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📊</div>
          <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>No Test Data Available</p>
          <p className="text-secondary">Start testing to see analytics here!</p>
        </div>
      )}

      {/* Metrics Cards - Only show when we have data */}
      {!loading && hasData && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px' 
        }}>
          {/* Overall Generation Score - main emphasis */}
          <div className="card" style={{ zIndex: 1, position: 'relative', overflow: 'visible', textAlign: 'center' }}>
            <div 
              style={{ 
                position: 'absolute', 
                top: '10px', 
                right: '10px', 
                cursor: 'pointer', 
                zIndex: 1100 
              }}
              onMouseEnter={() => setShowScoreTooltip(true)}
              onMouseLeave={() => setShowScoreTooltip(false)}
            >
              <span style={{ 
                fontSize: '12px', 
                color: 'var(--primary-color)',
                border: '1px solid var(--primary-color)',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--primary-bg)'
              }}>?</span>
              {showScoreTooltip && (
                <div style={{
                  position: 'absolute',
                  top: '0',
                  right: '120%',
                  background: 'var(--secondary-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '14px',
                  width: '360px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  zIndex: 3000,
                  whiteSpace: 'normal'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--primary-color)' }}>
                    Generation Score Formula
                  </div>
                  <div style={{ fontFamily: 'monospace', background: 'var(--primary-bg)', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
                    ((difficulty × 0.3) + (audio × 0.7)) × 10
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Audio-only, weighted by difficulty. Easy prompts with high scores count less than difficult prompts with average scores. Range: 0-100.
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '86px' }}>
              <div>
                <div className="text-secondary" style={{ fontSize: '13px', marginBottom: '6px' }}>
                  Generation Score
                </div>
                <div style={{ fontSize: '36px', fontWeight: '800' }}>
                  <span style={{ color: getScore100Color(displayScore) }}>{displayScore}</span>
                  <span style={{ color: score10Green }}>/100</span>
                </div>
              </div>
            </div>
          </div>

          {/* LLM Accuracy - deemphasized */}
          <div className="card" style={{ zIndex: 1, opacity: 0.8, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70px' }}>
              <div>
                <div className="text-secondary" style={{ fontSize: '12px', marginBottom: '2px' }}>
                  LLM Accuracy
                </div>
                <div style={{ fontSize: '22px', fontWeight: '700' }}>
                  <span style={{ color: getScore100Color((analytics?.avg_llm_accuracy || 0) * 10) }}>
                    {analytics?.avg_llm_accuracy || 0}
                  </span>
                  <span style={{ color: score10Green, fontSize: '18px' }}>/10</span>
                </div>
              </div>
            </div>
          </div>

          {/* Total Tests - deemphasized */}
          <div className="card" style={{ zIndex: 1, opacity: 0.8, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70px' }}>
              <div>
                <div className="text-secondary" style={{ fontSize: '12px', marginBottom: '2px' }}>
                  Total Tests
                </div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--warning-color)' }}>
                  {analytics?.total_tests || 0}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Difficulty Distribution Heat Map - Only show when we have data */}
      {!loading && hasData && (
        <div className="card" style={{ zIndex: 1, overflow: chartView === 'drum' ? 'hidden' : 'visible' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="label" style={{ fontSize: '18px', margin: 0, zIndex: 1 }}>
              Difficulty vs Score Distribution
            </h3>
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              background: '#1a1a2e',
              padding: '4px',
              borderRadius: '8px',
              border: '1px solid rgba(100, 80, 150, 0.2)'
            }}>
              <button
                onClick={() => setChartView('bar')}
                style={{
                  padding: '6px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: 'none',
                  background: chartView === 'bar' ? '#3d2a5c' : 'transparent',
                  color: chartView === 'bar' ? '#d0c5e8' : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Bar Chart
              </button>
              <button
                onClick={() => setChartView('pie')}
                style={{
                  padding: '6px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: 'none',
                  background: chartView === 'pie' ? '#3d2a5c' : 'transparent',
                  color: chartView === 'pie' ? '#d0c5e8' : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Pie Charts
              </button>
              <button
                onClick={() => setChartView('drum')}
                style={{
                  padding: '6px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: 'none',
                  background: chartView === 'drum' ? '#3d2a5c' : 'transparent',
                  color: chartView === 'drum' ? '#d0c5e8' : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Drum Chart
              </button>
            </div>
          </div>
        {chartView === 'bar' && (
          <div style={{ overflowX: 'auto', overflowY: 'visible', zIndex: 1, position: 'relative' }}>
            <div style={{ minWidth: '820px', padding: '10px 10px 24px', overflow: 'visible', position: 'relative' }}>
              {/* Chart container */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', overflow: 'visible' }}>
              {/* Y-axis label */}
              <div style={{ 
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                paddingRight: '8px',
                whiteSpace: 'nowrap',
                alignSelf: 'center',
                marginBottom: '40px'
              }}>
                Number of Tests
              </div>

              {/* Bars */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(10, minmax(50px, 1fr))', 
                gap: '12px', 
                width: '100%',
                paddingBottom: '12px',
                alignItems: 'end',
                overflow: 'visible'
              }}>
                {(analytics?.difficulty_distribution || []).map((diff, idx) => {
                  const isRightSide = idx >= (analytics?.difficulty_distribution || []).length - 3; // last 3 bars
                  const maxTests = Math.max(...(analytics?.difficulty_distribution || []).map(d => d.total_tests), 1);
                  const barHeightPx = diff.total_tests > 0 ? Math.max((diff.total_tests / maxTests) * 260, 18) : 10;

                  // Build segment heights in pixels with a minimum size and rescale to fit
                  const segments = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
                    .map((score) => ({
                      score,
                      count: diff.score_distribution[score] || 0,
                    }))
                    .filter((s) => s.count > 0);

                  let segmentHeights = segments.map((s) => Math.max((s.count / diff.total_tests) * barHeightPx, 8));
                  const totalHeight = segmentHeights.reduce((a, b) => a + b, 0);
                  if (totalHeight > barHeightPx) {
                    const scale = barHeightPx / totalHeight;
                    segmentHeights = segmentHeights.map((h) => h * scale);
                  }

                  return (
                    <div 
                      key={diff.difficulty}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                    >
                      {/* Count above bar */}
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', minHeight: '16px' }}>
                        {diff.total_tests > 0 ? diff.total_tests : ''}
                      </div>

                      {/* Bar */}
                      <div style={{
                        width: '100%',
                        height: `${barHeightPx}px`,
                        background: diff.total_tests === 0 ? 'var(--border-color)' : 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        overflow: 'visible',
                        display: 'flex',
                        flexDirection: 'column-reverse',
                        position: 'relative'
                      }}>
                        {diff.total_tests > 0 && segments.map((segment, idx) => {
                          const isHovered = hoveredSegment?.difficulty === diff.difficulty && hoveredSegment?.score === segment.score;
                            return (
                            <div
                              key={segment.score}
                              style={{
                                height: `${segmentHeights[idx]}px`,
                                background: getScoreColor(segment.score),
                                borderTop: '1px solid rgba(0,0,0,0.15)',
                                position: 'relative',
                                cursor: 'pointer',
                                opacity: 1,
                                transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s',
                                transform: isHovered ? 'translateY(-2px) scale(1.02)' : 'none',
                                boxShadow: isHovered ? '0 6px 14px rgba(0,0,0,0.25)' : 'none',
                                zIndex: isHovered ? 3000 : 1
                              }}
                              onMouseEnter={() => setHoveredSegment({ difficulty: diff.difficulty, score: segment.score, count: segment.count })}
                              onMouseLeave={() => setHoveredSegment(null)}
                              onClick={() => {
                                navigate('/results', {
                                  state: {
                                    difficulty: diff.difficulty,
                                    audioScore: segment.score,
                                    drumType: selectedDrumType !== 'all' ? selectedDrumType : 'all',
                                    modelVersion: selectedVersion !== 'all' ? selectedVersion : 'all'
                                  }
                                });
                              }}
                            >
                              {isHovered && (
                                <div style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: isRightSide ? 'auto' : '110%',
                                  right: isRightSide ? '110%' : 'auto',
                                  transform: 'translateY(-50%)',
                                  background: 'var(--primary-bg)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  padding: '12px 14px',
                                  fontSize: '12px',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
                                  zIndex: 4000,
                                  marginBottom: '6px',
                                  minWidth: '140px'
                                }}>
                                  <div style={{ 
                                    fontSize: '20px', 
                                    fontWeight: '700', 
                                    color: 'var(--primary-color)',
                                    marginBottom: '8px',
                                    lineHeight: '1.2'
                                  }}>
                                    {segment.count} test{segment.count !== 1 ? 's' : ''}
                                  </div>
                                  <div style={{ 
                                    fontSize: '11px', 
                                    color: 'var(--text-secondary)',
                                    marginBottom: '6px',
                                    borderBottom: '1px solid var(--border-color)',
                                    paddingBottom: '6px'
                                  }}>
                                    <span>Score </span>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: getScoreColor(segment.score) }}>{segment.score}</span>
                                    <span>, Difficulty {diff.difficulty}</span>
                                  </div>
                                  <span style={{ fontSize: '10px', opacity: 0.7, fontStyle: 'italic', color: 'var(--text-secondary)' }}>Click to view results →</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Difficulty label */}
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                        {diff.difficulty}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

              {/* X-axis label */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                marginTop: '6px'
              }}>
                <div className="text-secondary" style={{ fontSize: '13px', fontWeight: '600' }}>
                  Difficulty Level
                </div>
              </div>
            </div>
          </div>
        )}

        {chartView === 'pie' && (
          <div style={{ padding: '20px 10px', minHeight: '400px' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '40px',
              maxWidth: '900px',
              margin: '0 auto'
            }}>
              {/* Difficulty Pie Chart */}
              <div>
                <h4 style={{ 
                  textAlign: 'center', 
                  fontSize: '16px', 
                  fontWeight: '600',
                  marginBottom: '20px',
                  color: 'var(--text-secondary)'
                }}>
                  Difficulty Distribution
                </h4>
                <div style={{ position: 'relative', width: '100%', maxWidth: '320px', margin: '0 auto' }}>
                  <svg viewBox="-160 -160 320 320" style={{ width: '100%', height: 'auto' }}>
                    {getDifficultyPieData().map((slice, idx, arr) => {
                      const totalSlices = arr.length || 1;
                      const percentageNum = parseFloat(slice.percentage) || 0;
                      // Start from 12 o'clock (0 degrees) and go clockwise
                      const startAngle = arr.slice(0, idx).reduce((sum, s) => sum + ((parseFloat(s.percentage) || 0) / 100 * 360), 0);
                      const sweep = totalSlices === 1 ? 359.999 : (percentageNum / 100 * 360);
                      const endAngle = startAngle + sweep;
                      const isHovered = hoveredPieSegment?.type === 'difficulty' && hoveredPieSegment?.value === slice.difficulty;
                      const outerRadius = isHovered ? 148 : 145;
                      const innerRadius = 85;
                      
                      return (
                        <g key={slice.difficulty}>
                          <path
                            d={getPieSlicePath(startAngle, endAngle, outerRadius, innerRadius)}
                            fill={getDifficultyColor(slice.difficulty)}
                            stroke="var(--primary-bg)"
                            strokeWidth="3"
                            style={{
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              filter: isHovered ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.4)) brightness(1.1)' : 'none'
                            }}
                            onMouseEnter={() => setHoveredPieSegment({ type: 'difficulty', value: slice.difficulty, count: slice.count, percentage: slice.percentage })}
                            onMouseLeave={() => setHoveredPieSegment(null)}
                            onClick={() => {
                              navigate('/results', {
                                state: {
                                  difficulty: slice.difficulty,
                                  drumType: selectedDrumType !== 'all' ? selectedDrumType : 'all',
                                  modelVersion: selectedVersion !== 'all' ? selectedVersion : 'all'
                                }
                              });
                            }}
                          />
                        </g>
                      );
                    })}
                  </svg>
                  
                  {/* Center tooltip for difficulty */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '170px',
                    height: '170px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    background: 'var(--primary-bg)'
                  }}>
                    {hoveredPieSegment?.type === 'difficulty' && (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ 
                          fontSize: '32px', 
                          fontWeight: '800', 
                          color: getDifficultyColor(hoveredPieSegment.value),
                          marginBottom: '6px',
                          lineHeight: '1'
                        }}>
                          {hoveredPieSegment.percentage}%
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: 'var(--text-secondary)',
                          marginBottom: '8px'
                        }}>
                          Difficulty {hoveredPieSegment.value}
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: '600',
                          color: 'var(--primary-color)'
                        }}>
                          {hoveredPieSegment.count} test{hoveredPieSegment.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Score Pie Chart */}
              <div>
                <h4 style={{ 
                  textAlign: 'center', 
                  fontSize: '16px', 
                  fontWeight: '600',
                  marginBottom: '20px',
                  color: 'var(--text-secondary)'
                }}>
                  Score Distribution
                </h4>
                <div style={{ position: 'relative', width: '100%', maxWidth: '320px', margin: '0 auto' }}>
                  <svg viewBox="-160 -160 320 320" style={{ width: '100%', height: 'auto' }}>
                    {getScorePieData().map((slice, idx, arr) => {
                      const totalSlices = arr.length || 1;
                      const percentageNum = parseFloat(slice.percentage) || 0;
                      // Start from 12 o'clock (0 degrees) and go clockwise
                      const startAngle = arr.slice(0, idx).reduce((sum, s) => sum + ((parseFloat(s.percentage) || 0) / 100 * 360), 0);
                      const sweep = totalSlices === 1 ? 359.999 : (percentageNum / 100 * 360);
                      const endAngle = startAngle + sweep;
                      const isHovered = hoveredPieSegment?.type === 'score' && hoveredPieSegment?.value === slice.score;
                      const outerRadius = isHovered ? 148 : 145;
                      const innerRadius = 85;
                      
                      return (
                        <g key={slice.score}>
                          <path
                            d={getPieSlicePath(startAngle, endAngle, outerRadius, innerRadius)}
                            fill={getScoreColor(slice.score)}
                            stroke="var(--primary-bg)"
                            strokeWidth="3"
                            style={{
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              filter: isHovered ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.4)) brightness(1.1)' : 'none'
                            }}
                            onMouseEnter={() => setHoveredPieSegment({ type: 'score', value: slice.score, count: slice.count, percentage: slice.percentage })}
                            onMouseLeave={() => setHoveredPieSegment(null)}
                            onClick={() => {
                              navigate('/results', {
                                state: {
                                  audioScore: slice.score,
                                  drumType: selectedDrumType !== 'all' ? selectedDrumType : 'all',
                                  modelVersion: selectedVersion !== 'all' ? selectedVersion : 'all'
                                }
                              });
                            }}
                          />
                        </g>
                      );
                    })}
                  </svg>
                  
                  {/* Center tooltip for score */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '170px',
                    height: '170px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    background: 'var(--primary-bg)'
                  }}>
                    {hoveredPieSegment?.type === 'score' && (
                      <div style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ 
                          fontSize: '32px', 
                          fontWeight: '800', 
                          color: getScoreColor(hoveredPieSegment.value),
                          marginBottom: '6px',
                          lineHeight: '1'
                        }}>
                          {hoveredPieSegment.percentage}%
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: 'var(--text-secondary)',
                          marginBottom: '8px'
                        }}>
                          Score {hoveredPieSegment.value}
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: '600',
                          color: 'var(--primary-color)'
                        }}>
                          {hoveredPieSegment.count} test{hoveredPieSegment.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {chartView === 'drum' && (
          <div 
            ref={drumChartScrollRef}
            style={{ 
              width: '100%',
              maxWidth: '100%',
              overflowX: 'auto', 
              overflowY: 'hidden', 
              zIndex: 1, 
              position: 'relative',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none'
            }}
            onMouseDown={(e) => {
              setIsDragging(true);
              setStartX(e.pageX - drumChartScrollRef.current.offsetLeft);
              setScrollLeft(drumChartScrollRef.current.scrollLeft);
            }}
            onMouseLeave={() => setIsDragging(false)}
            onMouseUp={() => setIsDragging(false)}
            onMouseMove={(e) => {
              if (!isDragging) return;
              e.preventDefault();
              const x = e.pageX - drumChartScrollRef.current.offsetLeft;
              const walk = (x - startX) * 2; // Scroll speed multiplier
              drumChartScrollRef.current.scrollLeft = scrollLeft - walk;
            }}
          >
            <div style={{ 
              width: 'max-content',
              minWidth: analytics?.drum_type_distribution?.length > 0 ? `${analytics.drum_type_distribution.length * 96}px` : '820px', 
              padding: '10px 10px 54px', 
              overflow: 'visible', 
              position: 'relative' 
            }}>
              {/* Chart container */}
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', overflow: 'visible' }}>
              {/* Y-axis label */}
              <div style={{ 
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                paddingRight: '8px',
                whiteSpace: 'nowrap',
                alignSelf: 'center',
                marginBottom: '40px'
              }}>
                Number of Tests
              </div>

              {/* Bars */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${analytics?.drum_type_distribution?.length || 1}, minmax(80px, 1fr))`, 
                gap: '16px', 
                width: '100%',
                paddingBottom: '12px',
                alignItems: 'end',
                overflow: 'visible'
              }}>
                {(analytics?.drum_type_distribution || [])
                  .sort((a, b) => a.generation_score - b.generation_score)
                  .map((drumData, idx, sortedArray) => {
                  const drumTypeKey = drumData.drum_type_key || drumData.drum_type;
                  const isRightSide = idx >= sortedArray.length - 3; // last 3 bars
                  const maxTests = Math.max(...sortedArray.map(d => d.total_tests), 1);
                  const barHeightPx = drumData.total_tests > 0 ? Math.max((drumData.total_tests / maxTests) * 260, 18) : 10;

                  // Build segment heights in pixels with a minimum size and rescale to fit
                  const segments = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
                    .map((score) => ({
                      score,
                      count: drumData.score_distribution[score] || 0,
                    }))
                    .filter((s) => s.count > 0);

                  let segmentHeights = segments.map((s) => Math.max((s.count / drumData.total_tests) * barHeightPx, 8));
                  const totalHeight = segmentHeights.reduce((a, b) => a + b, 0);
                  if (totalHeight > barHeightPx) {
                    const scale = barHeightPx / totalHeight;
                    segmentHeights = segmentHeights.map((h) => h * scale);
                  }

                  return (
                    <div 
                      key={drumTypeKey}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                    >
                      {/* Generation Score - PROMINENT */}
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: '700', 
                        minHeight: '22px',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '2px'
                      }}>
                        {drumData.total_tests > 0 && (
                          <>
                            <span style={{ color: getScore100Color(drumData.generation_score) }}>
                              {drumData.generation_score}
                            </span>
                            <span style={{ color: score10Green, fontSize: '12px', fontWeight: '500' }}>/100</span>
                          </>
                        )}
                      </div>

                      {/* Count above bar */}
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', minHeight: '16px' }}>
                        {drumData.total_tests > 0 ? drumData.total_tests : ''}
                      </div>

                      {/* Bar */}
                      <div style={{
                        width: '100%',
                        height: `${barHeightPx}px`,
                        background: drumData.total_tests === 0 ? 'var(--border-color)' : 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        overflow: 'visible',
                        display: 'flex',
                        flexDirection: 'column-reverse',
                        position: 'relative'
                      }}>
                        {drumData.total_tests > 0 && segments.map((segment, idx) => {
                          const isHovered = hoveredSegment?.drum_type === drumData.drum_type && hoveredSegment?.score === segment.score;
                            return (
                            <div
                              key={segment.score}
                              style={{
                                height: `${segmentHeights[idx]}px`,
                                background: getScoreColor(segment.score),
                                borderTop: '1px solid rgba(0,0,0,0.15)',
                                position: 'relative',
                                cursor: 'pointer',
                                opacity: 1,
                                transition: 'opacity 0.2s, transform 0.2s, box-shadow 0.2s',
                                transform: isHovered ? 'translateY(-2px) scale(1.02)' : 'none',
                                boxShadow: isHovered ? '0 6px 14px rgba(0,0,0,0.25)' : 'none',
                                zIndex: isHovered ? 3000 : 1
                              }}
                              onMouseEnter={() => setHoveredSegment({ drum_type: drumData.drum_type, score: segment.score, count: segment.count })}
                              onMouseLeave={() => setHoveredSegment(null)}
                              onClick={() => {
                                navigate('/results', {
                                  state: {
                                    drumType: drumData.drum_type,
                                    drumTypeKey,
                                    audioScore: segment.score,
                                    modelVersion: selectedVersion !== 'all' ? selectedVersion : 'all'
                                  }
                                });
                              }}
                            >
                              {isHovered && (
                                <div style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: isRightSide ? 'auto' : '110%',
                                  right: isRightSide ? '110%' : 'auto',
                                  transform: 'translateY(-50%)',
                                  background: 'var(--primary-bg)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  padding: '12px 14px',
                                  fontSize: '12px',
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
                                  zIndex: 4000,
                                  marginBottom: '6px',
                                  minWidth: '140px'
                                }}>
                                  <div style={{ 
                                    fontSize: '20px', 
                                    fontWeight: '700', 
                                    color: 'var(--primary-color)',
                                    marginBottom: '8px',
                                    lineHeight: '1.2'
                                  }}>
                                    {segment.count} test{segment.count !== 1 ? 's' : ''}
                                  </div>
                                  <div style={{ 
                                    fontSize: '11px', 
                                    color: 'var(--text-secondary)',
                                    marginBottom: '6px',
                                    borderBottom: '1px solid var(--border-color)',
                                    paddingBottom: '6px'
                                  }}>
                                    <span>{drumData.drum_type}, Score </span>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: getScoreColor(segment.score) }}>{segment.score}</span>
                                  </div>
                                  <span style={{ fontSize: '10px', opacity: 0.7, fontStyle: 'italic', color: 'var(--text-secondary)' }}>Click to view results →</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Drum Type label - clickable */}
                      <div 
                        style={{ 
                          fontSize: '13px', 
                          fontWeight: '700', 
                          color: 'var(--primary-color)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          minHeight: '32px',
                          maxWidth: '80px',
                          wordWrap: 'break-word',
                          lineHeight: '1.2',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'center',
                          transition: 'color 0.2s'
                        }}
                        onClick={() => {
                          navigate('/results', {
                            state: {
                              drumType: drumData.drum_type,
                              drumTypeKey,
                              modelVersion: selectedVersion !== 'all' ? selectedVersion : 'all'
                            }
                          });
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--warning-color)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--primary-color)'}
                      >
                        {drumData.drum_type}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

              {/* X-axis label */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                marginTop: '6px'
              }}>
                <div className="text-secondary" style={{ fontSize: '13px', fontWeight: '600' }}>
                  Drum Type (click to filter)
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      )}

    </div>
  );
}
