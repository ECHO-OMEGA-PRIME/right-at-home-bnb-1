'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare, TrendingUp, TrendingDown, AlertTriangle,
  ThumbsUp, ThumbsDown, Minus, RefreshCw, ChevronRight,
  Star, Calendar, Home, ExternalLink
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface TopicStats {
  topic: string;
  mention_count: number;
  avg_sentiment: number;
  positive_mentions: number;
  negative_mentions: number;
}

interface ReviewItem {
  id: number;
  property_id: string;
  property_name: string | null;
  review_date: string;
  platform: string | null;
  star_rating: number | null;
  sentiment_score: number | null;
  sentiment_label: string | null;
  topics: string[] | null;
  issues: string[] | null;
  review_text: string | null;
  has_alert: boolean;
}

interface SentimentTrendItem {
  period: string;
  avg_sentiment: number;
  review_count: number;
  positive_count: number;
  neutral_count: number;
  negative_count: number;
}

interface PortfolioStats {
  total_reviews: number;
  avg_sentiment: number;
  positive_percentage: number;
  neutral_percentage: number;
  negative_percentage: number;
  reviews_this_month: number;
  sentiment_vs_last_month: number | null;
  top_topics: TopicStats[];
  common_issues: { issue: string; count: number }[];
  recent_negative_reviews: ReviewItem[];
}

interface SentimentAlert {
  id: number;
  property_id: string;
  property_name: string | null;
  severity: string;
  title: string;
  description: string;
  trigger_data: any;
  is_active: boolean;
  is_acknowledged: boolean;
  created_at: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getSentimentColor = (score: number | null): string => {
  if (score === null) return 'text-charcoal-400';
  if (score >= 0.6) return 'text-green-600';
  if (score >= 0.2) return 'text-green-500';
  if (score >= -0.2) return 'text-charcoal-500';
  if (score >= -0.6) return 'text-red-500';
  return 'text-red-600';
};

const getSentimentBgColor = (score: number | null): string => {
  if (score === null) return 'bg-charcoal-100';
  if (score >= 0.6) return 'bg-green-100';
  if (score >= 0.2) return 'bg-green-50';
  if (score >= -0.2) return 'bg-charcoal-50';
  if (score >= -0.6) return 'bg-red-50';
  return 'bg-red-100';
};

const getSentimentIcon = (score: number | null) => {
  if (score === null) return <Minus className="w-4 h-4" />;
  if (score >= 0.2) return <ThumbsUp className="w-4 h-4" />;
  if (score <= -0.2) return <ThumbsDown className="w-4 h-4" />;
  return <Minus className="w-4 h-4" />;
};

const formatSentimentScore = (score: number | null): string => {
  if (score === null) return 'N/A';
  return score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
};

const getPlatformColor = (platform: string | null): string => {
  switch (platform?.toLowerCase()) {
    case 'airbnb': return 'bg-pink-100 text-pink-800';
    case 'vrbo': return 'bg-blue-100 text-blue-800';
    case 'direct': return 'bg-maroon-100 text-maroon-800';
    case 'google': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-charcoal-100 text-charcoal-600';
  }
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatTopicName = (topic: string): string => {
  return topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

const SentimentGauge = ({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) => {
  const radius = size === 'lg' ? 80 : size === 'md' ? 60 : 40;
  const strokeWidth = size === 'lg' ? 12 : size === 'md' ? 10 : 8;
  const center = radius + strokeWidth;
  const circumference = Math.PI * radius;

  // Convert -1 to 1 score to 0-180 degrees
  const normalizedScore = (score + 1) / 2; // 0 to 1
  const angle = normalizedScore * 180;
  const progress = (angle / 180) * circumference;

  // Color based on score
  const getStrokeColor = () => {
    if (score >= 0.6) return '#16a34a'; // green-600
    if (score >= 0.2) return '#22c55e'; // green-500
    if (score >= -0.2) return '#6b7280'; // gray-500
    if (score >= -0.6) return '#ef4444'; // red-500
    return '#dc2626'; // red-600
  };

  return (
    <div className="relative" style={{ width: (center * 2), height: center + 10 }}>
      <svg
        width={center * 2}
        height={center + 10}
        className="transform -rotate-180"
      >
        {/* Background arc */}
        <path
          d={`M ${strokeWidth} ${center} A ${radius} ${radius} 0 0 1 ${center * 2 - strokeWidth} ${center}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M ${strokeWidth} ${center} A ${radius} ${radius} 0 0 1 ${center * 2 - strokeWidth} ${center}`}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-end justify-center pb-2">
        <span className={`font-display font-bold ${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-xl' : 'text-lg'} ${getSentimentColor(score)}`}>
          {formatSentimentScore(score)}
        </span>
      </div>
    </div>
  );
};

const TopicBar = ({ topic }: { topic: TopicStats }) => {
  const positiveWidth = (topic.positive_mentions / Math.max(1, topic.mention_count)) * 100;
  const negativeWidth = (topic.negative_mentions / Math.max(1, topic.mention_count)) * 100;

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-sm text-charcoal-600 w-28 truncate" title={formatTopicName(topic.topic)}>
        {formatTopicName(topic.topic)}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${positiveWidth}%` }}
          />
          <div
            className="h-full bg-red-500 transition-all"
            style={{ width: `${negativeWidth}%` }}
          />
        </div>
        <span className="text-xs text-charcoal-400 w-8 text-right">
          {topic.mention_count}
        </span>
      </div>
    </div>
  );
};

const TrendChart = ({ data }: { data: SentimentTrendItem[] }) => {
  if (!data.length) return null;

  const maxValue = Math.max(...data.map(d => Math.abs(d.avg_sentiment)));
  const chartHeight = 120;
  const chartWidth = data.length * 40;

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-2 h-32 min-w-fit">
        {data.map((item, i) => {
          const height = (Math.abs(item.avg_sentiment) / Math.max(0.5, maxValue)) * chartHeight;
          const isPositive = item.avg_sentiment >= 0;

          return (
            <div key={i} className="flex flex-col items-center gap-1 w-10">
              <div className="relative h-28 w-6 flex flex-col justify-end">
                <div
                  className={`w-full rounded-t transition-all ${isPositive ? 'bg-green-400' : 'bg-red-400'}`}
                  style={{ height: `${Math.max(4, height)}px` }}
                  title={`${item.period}: ${formatSentimentScore(item.avg_sentiment)} (${item.review_count} reviews)`}
                />
              </div>
              <span className="text-xs text-charcoal-400">
                {item.period.split('-').slice(1).join('/')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AlertCard = ({ alert, onAcknowledge, onResolve }: {
  alert: SentimentAlert;
  onAcknowledge: () => void;
  onResolve: () => void;
}) => {
  const severityStyles = {
    critical: 'border-red-300 bg-red-50',
    warning: 'border-yellow-300 bg-yellow-50',
    info: 'border-blue-300 bg-blue-50'
  };

  return (
    <div className={`border rounded-lg p-3 ${severityStyles[alert.severity as keyof typeof severityStyles] || severityStyles.info}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className={`w-4 h-4 mt-0.5 ${
            alert.severity === 'critical' ? 'text-red-600' :
            alert.severity === 'warning' ? 'text-yellow-600' : 'text-blue-600'
          }`} />
          <div>
            <p className="text-sm font-medium text-charcoal-800">{alert.title}</p>
            <p className="text-xs text-charcoal-500 mt-0.5">
              {alert.property_name || alert.property_id} - {formatDate(alert.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {!alert.is_acknowledged && (
            <button
              onClick={onAcknowledge}
              className="text-xs px-2 py-1 rounded bg-white border hover:bg-cream-50"
            >
              Ack
            </button>
          )}
          <button
            onClick={onResolve}
            className="text-xs px-2 py-1 rounded bg-charcoal-700 text-white hover:bg-charcoal-800"
          >
            Resolve
          </button>
        </div>
      </div>
    </div>
  );
};

const NegativeReviewCard = ({ review }: { review: ReviewItem }) => (
  <div className="border border-cream-200 rounded-lg p-3 hover:border-maroon-200 transition-colors">
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="flex items-center gap-2">
        <Home className="w-4 h-4 text-charcoal-400" />
        <span className="text-sm font-medium text-charcoal-700 truncate max-w-32">
          {review.property_name || review.property_id}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {review.platform && (
          <span className={`text-xs px-2 py-0.5 rounded ${getPlatformColor(review.platform)}`}>
            {review.platform}
          </span>
        )}
        {review.star_rating && (
          <div className="flex items-center gap-0.5">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-xs text-charcoal-600">{review.star_rating}</span>
          </div>
        )}
      </div>
    </div>
    <p className="text-sm text-charcoal-600 line-clamp-2 mb-2">
      {review.review_text || 'No review text'}
    </p>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <span className={`text-sm font-semibold ${getSentimentColor(review.sentiment_score)}`}>
          {formatSentimentScore(review.sentiment_score)}
        </span>
        {review.has_alert && (
          <AlertTriangle className="w-3 h-3 text-red-500" />
        )}
      </div>
      <span className="text-xs text-charcoal-400">
        {formatDate(review.review_date)}
      </span>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface SentimentWidgetProps {
  propertyId?: string;
  className?: string;
}

export default function SentimentWidget({ propertyId, className = '' }: SentimentWidgetProps) {
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [trend, setTrend] = useState<SentimentTrendItem[]>([]);
  const [alerts, setAlerts] = useState<SentimentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch portfolio stats
      const statsUrl = propertyId
        ? `${API_BASE}/api/reviews/admin/reviews/property/${propertyId}`
        : `${API_BASE}/api/reviews/admin/reviews/portfolio/stats?days=30`;

      const statsRes = await fetch(statsUrl);
      if (!statsRes.ok) throw new Error('Failed to fetch stats');
      const statsData = await statsRes.json();

      if (propertyId) {
        // Transform property response to portfolio stats format
        setStats({
          total_reviews: statsData.statistics.total_reviews,
          avg_sentiment: statsData.statistics.avg_sentiment,
          positive_percentage: statsData.statistics.positive_percentage,
          neutral_percentage: 100 - statsData.statistics.positive_percentage - statsData.statistics.negative_percentage,
          negative_percentage: statsData.statistics.negative_percentage,
          reviews_this_month: statsData.statistics.total_reviews,
          sentiment_vs_last_month: null,
          top_topics: Object.entries(statsData.topic_breakdown || {}).map(([topic, data]: [string, any]) => ({
            topic,
            mention_count: data.mention_count,
            avg_sentiment: data.avg_sentiment,
            positive_mentions: data.positive_mentions,
            negative_mentions: data.negative_mentions
          })),
          common_issues: [],
          recent_negative_reviews: statsData.reviews.filter((r: ReviewItem) => (r.sentiment_score || 0) < -0.2)
        });
        setTrend(statsData.trend || []);
      } else {
        setStats(statsData);
      }

      // Fetch trend data if not from property endpoint
      if (!propertyId) {
        const trendRes = await fetch(`${API_BASE}/api/reviews/admin/reviews/sentiment/trend?days=90&group_by=week`);
        if (trendRes.ok) {
          const trendData = await trendRes.json();
          setTrend(trendData.data || []);
        }
      }

      // Fetch alerts
      const alertsRes = await fetch(`${API_BASE}/api/reviews/admin/reviews/alerts?limit=5${propertyId ? `&property_id=${propertyId}` : ''}`);
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error('SentimentWidget error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await fetch(`${API_BASE}/api/reviews/admin/reviews/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, is_acknowledged: true } : a
      ));
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleResolveAlert = async (alertId: number) => {
    try {
      await fetch(`${API_BASE}/api/reviews/admin/reviews/alerts/${alertId}/resolve`, {
        method: 'POST'
      });
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-cream-200 rounded w-48 mb-4" />
          <div className="h-32 bg-cream-200 rounded mb-4" />
          <div className="h-24 bg-cream-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`card ${className}`}>
        <div className="text-center py-8">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-charcoal-600">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 btn-secondary text-sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-maroon-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-maroon-800" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-charcoal-800">
              Review Sentiment
            </h3>
            <p className="text-sm text-charcoal-500">
              {stats.total_reviews} reviews analyzed
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="p-2 hover:bg-cream-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-charcoal-500" />
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sentiment Gauge */}
        <div className="card flex flex-col items-center py-6">
          <span className="text-sm text-charcoal-500 mb-2">Overall Sentiment</span>
          <SentimentGauge score={stats.avg_sentiment} size="lg" />
          {stats.sentiment_vs_last_month !== null && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              stats.sentiment_vs_last_month > 0 ? 'text-green-600' : stats.sentiment_vs_last_month < 0 ? 'text-red-600' : 'text-charcoal-500'
            }`}>
              {stats.sentiment_vs_last_month > 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : stats.sentiment_vs_last_month < 0 ? (
                <TrendingDown className="w-4 h-4" />
              ) : null}
              <span>{formatSentimentScore(stats.sentiment_vs_last_month)} vs last month</span>
            </div>
          )}
        </div>

        {/* Distribution */}
        <div className="card">
          <h4 className="text-sm font-medium text-charcoal-600 mb-4">Sentiment Distribution</h4>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-20 flex items-center gap-1 text-green-600">
                <ThumbsUp className="w-4 h-4" />
                <span className="text-sm">Positive</span>
              </div>
              <div className="flex-1 bg-cream-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${stats.positive_percentage}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-charcoal-700 w-12 text-right">
                {stats.positive_percentage.toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-20 flex items-center gap-1 text-charcoal-500">
                <Minus className="w-4 h-4" />
                <span className="text-sm">Neutral</span>
              </div>
              <div className="flex-1 bg-cream-200 rounded-full h-3">
                <div
                  className="bg-charcoal-400 h-3 rounded-full transition-all"
                  style={{ width: `${stats.neutral_percentage}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-charcoal-700 w-12 text-right">
                {stats.neutral_percentage.toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-20 flex items-center gap-1 text-red-600">
                <ThumbsDown className="w-4 h-4" />
                <span className="text-sm">Negative</span>
              </div>
              <div className="flex-1 bg-cream-200 rounded-full h-3">
                <div
                  className="bg-red-500 h-3 rounded-full transition-all"
                  style={{ width: `${stats.negative_percentage}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-charcoal-700 w-12 text-right">
                {stats.negative_percentage.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-charcoal-600">Active Alerts</h4>
            {alerts.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {alerts.length}
              </span>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="text-center py-6 text-charcoal-400">
              <ThumbsUp className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">No active alerts</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {alerts.slice(0, 3).map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={() => handleAcknowledgeAlert(alert.id)}
                  onResolve={() => handleResolveAlert(alert.id)}
                />
              ))}
              {alerts.length > 3 && (
                <button className="text-sm text-maroon-700 hover:text-maroon-800 w-full text-center py-2">
                  View all {alerts.length} alerts
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Trend Chart */}
      {trend.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-charcoal-600">Sentiment Trend (3 months)</h4>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-400 rounded" />
                <span className="text-charcoal-500">Positive</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-400 rounded" />
                <span className="text-charcoal-500">Negative</span>
              </div>
            </div>
          </div>
          <TrendChart data={trend} />
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Topic Breakdown */}
        {stats.top_topics.length > 0 && (
          <div className="card">
            <h4 className="text-sm font-medium text-charcoal-600 mb-4">Topic Breakdown</h4>
            <div className="space-y-1">
              {stats.top_topics.slice(0, 8).map(topic => (
                <TopicBar key={topic.topic} topic={topic} />
              ))}
            </div>
            {stats.top_topics.length > 8 && (
              <button className="text-sm text-maroon-700 hover:text-maroon-800 mt-4">
                View all topics
              </button>
            )}
          </div>
        )}

        {/* Recent Negative Reviews */}
        {stats.recent_negative_reviews.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-charcoal-600">Recent Negative Reviews</h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {stats.recent_negative_reviews.length}
              </span>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {stats.recent_negative_reviews.slice(0, 5).map(review => (
                <NegativeReviewCard key={review.id} review={review} />
              ))}
            </div>
            {stats.recent_negative_reviews.length > 5 && (
              <button className="text-sm text-maroon-700 hover:text-maroon-800 mt-4 w-full text-center">
                View all negative reviews
              </button>
            )}
          </div>
        )}
      </div>

      {/* Common Issues */}
      {stats.common_issues.length > 0 && (
        <div className="card bg-red-50 border-red-100">
          <h4 className="text-sm font-medium text-red-800 mb-3">Common Issues Mentioned</h4>
          <div className="flex flex-wrap gap-2">
            {stats.common_issues.slice(0, 10).map(issue => (
              <span
                key={issue.issue}
                className="text-xs px-3 py-1.5 rounded-full bg-red-100 text-red-700"
              >
                {formatTopicName(issue.issue)} ({issue.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export additional components for standalone use
export { SentimentGauge, TopicBar, TrendChart, AlertCard, NegativeReviewCard };
