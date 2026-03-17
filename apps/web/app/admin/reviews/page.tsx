'use client';

import { useState, useMemo } from 'react';
import {
  Star, MessageSquare, ThumbsUp, ThumbsDown, Send, Search,
  Clock, CheckCircle, AlertTriangle, TrendingUp, Eye, Sparkles,
  ExternalLink, X, Filter
} from 'lucide-react';

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

type Platform = 'airbnb' | 'vrbo' | 'google';
type ReviewStatus = 'needs_response' | 'responded' | 'flagged';
type Sentiment = 'positive' | 'neutral' | 'negative';

interface Review {
  id: string;
  guestName: string;
  property: string;
  platform: Platform;
  rating: number;
  title: string;
  content: string;
  date: string;
  status: ReviewStatus;
  response?: string;
  respondedAt?: string;
  stayDates: string;
  sentiment: Sentiment;
  nightlyRate: number;
}

const platformStyles: Record<Platform, { bg: string; text: string; label: string }> = {
  airbnb: { bg: 'bg-pink-100', text: 'text-pink-700', label: 'Airbnb' },
  vrbo: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'VRBO' },
  google: { bg: 'bg-green-100', text: 'text-green-700', label: 'Google' },
};

const sentimentConfig: Record<Sentiment, { bg: string; text: string; label: string }> = {
  positive: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Positive' },
  neutral: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Neutral' },
  negative: { bg: 'bg-red-50', text: 'text-red-700', label: 'Negative' },
};

const reviews: Review[] = [
  { id: 'R01', guestName: 'Sarah Jenkins', property: 'Sunset Villa', platform: 'airbnb', rating: 5, title: 'Perfect for our pipeline crew!', content: 'We had 6 guys staying for a pipeline project and this place was perfect. Clean, spacious, great kitchen, fast WiFi for video calls. The keyless entry was super convenient for our different schedules. Bobby was responsive and helpful. Will book again for our next Permian Basin project.', date: '2026-03-14', status: 'needs_response', stayDates: 'Mar 1-10, 2026', sentiment: 'positive', nightlyRate: 17500 },
  { id: 'R02', guestName: 'Mark Torres', property: 'Permian Loft', platform: 'vrbo', rating: 4, title: 'Great location, minor issue', content: 'Great place overall. Location is perfect — close to the Basin and restaurants on Big Spring. Only issue was the water pressure in the master bath was low. Everything else was top notch. Beds were comfortable, kitchen was well-stocked.', date: '2026-03-12', status: 'needs_response', stayDates: 'Mar 3-8, 2026', sentiment: 'neutral', nightlyRate: 14500 },
  { id: 'R03', guestName: 'Jennifer Liu', property: 'Basin View', platform: 'airbnb', rating: 5, title: 'Home away from home', content: 'This is our third stay with Right at Home and they keep getting better. The new linens are luxurious, the pool was sparkling clean, and the smart home features make everything easy. Already booked for next month.', date: '2026-03-10', status: 'responded', response: 'Thank you Jennifer! We love having you as a repeat guest. The new linens were a great investment and we are glad you noticed. See you next month!', respondedAt: '2026-03-10', stayDates: 'Feb 28-Mar 7, 2026', sentiment: 'positive', nightlyRate: 16000 },
  { id: 'R04', guestName: 'David Wheeler', property: 'Wildcatter Suite', platform: 'google', rating: 3, title: 'Decent but needs work', content: 'The location and price are good for Midland. However, the carpet in the living room is stained, the TV remote did not work, and the check-in instructions were confusing. The bed was comfortable and the place was clean otherwise.', date: '2026-03-08', status: 'responded', response: 'David, thank you for the honest feedback. We have replaced the carpet and TV remote, and we have rewritten our check-in instructions to be clearer. We hope you will give us another chance to exceed your expectations.', respondedAt: '2026-03-09', stayDates: 'Mar 1-5, 2026', sentiment: 'negative', nightlyRate: 12000 },
  { id: 'R05', guestName: 'Amanda Richardson', property: 'Oilfield Oasis', platform: 'airbnb', rating: 5, title: 'Best STR in Midland!', content: 'I travel to Midland monthly for work and I have tried them all. Right at Home is by far the best operation in town. Professional, clean, responsive, and the properties are well-maintained. The loyalty discount for returning guests is a nice touch too.', date: '2026-03-06', status: 'responded', response: 'Amanda, that means the world to us! We work hard to provide a consistently excellent experience. Your loyalty discount is well-earned. See you next month!', respondedAt: '2026-03-06', stayDates: 'Feb 24-Mar 2, 2026', sentiment: 'positive', nightlyRate: 15500 },
  { id: 'R06', guestName: 'Carlos Mendoza', property: 'Mesquite Manor', platform: 'vrbo', rating: 4, title: 'Clean and convenient', content: 'Good place for my work trip. Clean, had everything I needed. The neighborhood is quiet. Would have liked a washer/dryer but I understand not all units have them. The welcome snack basket was a nice surprise.', date: '2026-03-04', status: 'responded', response: 'Carlos, glad you had a good stay! Mesquite Manor is getting washer/dryer units installed next month. We will make sure to let you know when they are ready. Thanks for the feedback!', respondedAt: '2026-03-05', stayDates: 'Feb 26-Mar 3, 2026', sentiment: 'positive', nightlyRate: 11500 },
  { id: 'R07', guestName: 'Lisa Kowalski', property: 'Derrick Den', platform: 'vrbo', rating: 2, title: 'Noisy neighbors, slow response', content: 'The property itself was fine but the neighbors were incredibly loud until 2am two nights in a row. When I messaged the host it took 6 hours to get a response. For the price, I expected better service. Will not rebook.', date: '2026-03-02', status: 'flagged', stayDates: 'Feb 23-28, 2026', sentiment: 'negative', nightlyRate: 13000 },
  { id: 'R08', guestName: 'Robert Patterson', property: 'Prairie House', platform: 'airbnb', rating: 5, title: 'Exactly what we needed', content: 'Booked for our drilling crew — 4 bedrooms, 3 baths, big kitchen, great outdoor area with grill. Everything was clean and well-maintained. The check-in was smooth and the house manual was thorough. Price was very fair for the Midland area.', date: '2026-02-28', status: 'responded', response: 'Robert, thank you! Prairie House is one of our favorites for crew stays. We are glad the space worked well for your team. Book again anytime!', respondedAt: '2026-02-28', stayDates: 'Feb 17-27, 2026', sentiment: 'positive', nightlyRate: 19500 },
  { id: 'R09', guestName: 'Emily Sandoval', property: 'Sunset Villa', platform: 'google', rating: 5, title: 'Outstanding property!', content: 'We hosted a small family reunion here and it was absolutely perfect. Gorgeous pool area, beautiful interior, and enough space for 10 adults comfortably. The kitchen had everything we needed for a big Thanksgiving-level cook. Bobby went above and beyond.', date: '2026-02-25', status: 'responded', response: 'Emily, a family reunion is the best use of Sunset Villa! So glad everything was perfect for your gathering. We would love to host your family again anytime.', respondedAt: '2026-02-26', stayDates: 'Feb 20-24, 2026', sentiment: 'positive', nightlyRate: 17500 },
  { id: 'R10', guestName: 'Tom Henderson', property: 'Permian Loft', platform: 'airbnb', rating: 4, title: 'Good for business travel', content: 'Solid option for extended business stay in Midland. Good desk setup, reliable WiFi, comfortable bed. Kitchen was adequate. Only gripe is the parking situation — had to park on the street one night when a neighbor had guests over.', date: '2026-02-22', status: 'responded', response: 'Tom, glad the loft worked well for your business stay! We have talked with the neighbor about parking and designated an additional spot. Thank you for the heads up!', respondedAt: '2026-02-23', stayDates: 'Feb 10-20, 2026', sentiment: 'positive', nightlyRate: 14500 },
];

const AI_TEMPLATES: Record<Sentiment, string> = {
  positive: 'Thank you so much for the wonderful review, GUEST! We are thrilled you enjoyed your stay at PROPERTY. Your kind words motivate our team to keep delivering exceptional experiences. We look forward to hosting you again!',
  neutral: 'Thank you for staying with us at PROPERTY, GUEST! We appreciate your honest feedback and are glad you enjoyed most of your stay. We are addressing the points you mentioned to ensure an even better experience next time.',
  negative: 'GUEST, thank you for bringing this to our attention. We sincerely apologize for the issues you experienced at PROPERTY. We have taken immediate steps to address your concerns. We would love the chance to make it right — please reach out to us directly.',
};

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < count ? 'text-yellow-500 fill-yellow-500' : 'text-gray-200'}`}
        />
      ))}
    </div>
  );
}

export default function ReviewManagement() {
  const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | 'all'>('all');
  const [filterRating, setFilterRating] = useState<number | 0>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [draftResponse, setDraftResponse] = useState('');
  const [showResponseModal, setShowResponseModal] = useState(false);

  const filtered = useMemo(() => {
    return reviews
      .filter((r) => filterPlatform === 'all' || r.platform === filterPlatform)
      .filter((r) => filterStatus === 'all' || r.status === filterStatus)
      .filter((r) => filterRating === 0 || r.rating === filterRating)
      .filter((r) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          r.guestName.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          r.property.toLowerCase().includes(q)
        );
      });
  }, [filterPlatform, filterStatus, filterRating, searchQuery]);

  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const needsResponse = reviews.filter((r) => r.status === 'needs_response').length;
  const flagged = reviews.filter((r) => r.status === 'flagged').length;
  const fiveStars = reviews.filter((r) => r.rating === 5).length;

  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({
    stars: star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: (reviews.filter((r) => r.rating === star).length / reviews.length) * 100,
  }));

  const openResponseModal = (review: Review) => {
    setSelectedReview(review);
    setDraftResponse(review.response || '');
    setShowResponseModal(true);
  };

  const generateAIResponse = () => {
    if (!selectedReview) return;
    const template = AI_TEMPLATES[selectedReview.sentiment];
    setDraftResponse(
      template.replace('GUEST', selectedReview.guestName).replace('PROPERTY', selectedReview.property)
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor, respond, and analyze guest reviews across all platforms
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          Last synced: Today at 8:45 AM
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-yellow-50 p-2.5 rounded-lg">
              <Star className="w-5 h-5 text-yellow-500" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Average Rating</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-gray-900">{avgRating.toFixed(1)}</p>
            <StarRating count={Math.round(avgRating)} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{reviews.length} total reviews</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-orange-50 p-2.5 rounded-lg">
              <MessageSquare className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Needs Response</p>
          <p className="text-2xl font-bold text-gray-900">{needsResponse}</p>
          <p className="text-xs text-gray-400 mt-1">
            {flagged > 0 ? `${flagged} flagged for attention` : 'None flagged'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-emerald-50 p-2.5 rounded-lg">
              <ThumbsUp className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">5-Star Reviews</p>
          <p className="text-2xl font-bold text-gray-900">
            {fiveStars}/{reviews.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {((fiveStars / reviews.length) * 100).toFixed(0)}% five-star rate
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-3">Rating Distribution</p>
          <div className="space-y-1.5">
            {ratingDist.map((r) => (
              <div key={r.stars} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-gray-500 text-right">{r.stars}</span>
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full transition-all"
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
                <span className="w-4 text-gray-500 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reviews..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
          />
        </div>
        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value as Platform | 'all')}
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
        >
          <option value="all">All Platforms</option>
          <option value="airbnb">Airbnb</option>
          <option value="vrbo">VRBO</option>
          <option value="google">Google</option>
        </select>
        <select
          value={filterRating}
          onChange={(e) => setFilterRating(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
        >
          <option value={0}>All Ratings</option>
          <option value={5}>5 Stars</option>
          <option value={4}>4 Stars</option>
          <option value={3}>3 Stars</option>
          <option value={2}>2 Stars</option>
          <option value={1}>1 Star</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ReviewStatus | 'all')}
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000]"
        >
          <option value="all">All Status</option>
          <option value="needs_response">Needs Response</option>
          <option value="responded">Responded</option>
          <option value="flagged">Flagged</option>
        </select>
        <span className="text-sm text-gray-500">{filtered.length} reviews</span>
      </div>

      {/* Review Cards */}
      <div className="space-y-4">
        {filtered.map((review) => (
          <div
            key={review.id}
            className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${
              review.status === 'flagged' ? 'border-l-4 border-l-red-500 border-gray-200' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#500000]/10 flex items-center justify-center text-[#500000] font-bold text-sm">
                  {review.guestName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{review.guestName}</p>
                  <p className="text-xs text-gray-500">
                    {review.property} &middot; {review.stayDates} &middot;{' '}
                    {formatMoney(review.nightlyRate)}/night
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${sentimentConfig[review.sentiment].bg} ${sentimentConfig[review.sentiment].text}`}
                >
                  {sentimentConfig[review.sentiment].label}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${platformStyles[review.platform].bg} ${platformStyles[review.platform].text}`}
                >
                  {platformStyles[review.platform].label}
                </span>
                {review.status === 'needs_response' && (
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-orange-100 text-orange-700">
                    Reply Needed
                  </span>
                )}
                {review.status === 'flagged' && (
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-red-100 text-red-700">
                    Flagged
                  </span>
                )}
                {review.status === 'responded' && (
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-green-100 text-green-700 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Responded
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <StarRating count={review.rating} />
              <span className="text-sm font-medium text-gray-800">{review.title}</span>
            </div>
            <p className="text-sm text-gray-600 mb-3">{review.content}</p>

            {review.response && (
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-600" /> Response sent{' '}
                  {review.respondedAt}
                </p>
                <p className="text-sm text-gray-700">{review.response}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{review.date}</p>
              {review.status !== 'responded' && (
                <button
                  onClick={() => openResponseModal(review)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#500000] text-white rounded-lg text-sm font-medium hover:bg-[#3C1518] transition-colors"
                >
                  <Send className="w-3.5 h-3.5" /> Write Response
                </button>
              )}
              {review.status === 'responded' && (
                <button
                  onClick={() => openResponseModal(review)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> View Response
                </button>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">No reviews match your current filters.</p>
          </div>
        )}
      </div>

      {/* Write Response Modal */}
      {showResponseModal && selectedReview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {selectedReview.status === 'responded' ? 'Response Sent' : 'Write Response'}
              </h3>
              <button
                onClick={() => setShowResponseModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <StarRating count={selectedReview.rating} />
                  <span className="text-sm font-medium text-gray-800">
                    {selectedReview.guestName}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${platformStyles[selectedReview.platform].bg} ${platformStyles[selectedReview.platform].text}`}
                  >
                    {platformStyles[selectedReview.platform].label}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{selectedReview.content}</p>
              </div>

              {selectedReview.status !== 'responded' && (
                <button
                  onClick={generateAIResponse}
                  className="flex items-center gap-2 text-sm text-[#500000] hover:underline mb-3"
                >
                  <Sparkles className="w-4 h-4" /> Generate AI Response
                </button>
              )}

              <textarea
                value={draftResponse}
                onChange={(e) => setDraftResponse(e.target.value)}
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#500000]/20 focus:border-[#500000] mb-4"
                placeholder="Type your response..."
                readOnly={selectedReview.status === 'responded'}
              />

              {selectedReview.respondedAt && (
                <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  Responded on {selectedReview.respondedAt}
                </p>
              )}

              {selectedReview.status !== 'responded' && (
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowResponseModal(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button className="flex items-center gap-2 bg-[#500000] hover:bg-[#3C1518] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    <Send className="w-4 h-4" /> Send Response
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
