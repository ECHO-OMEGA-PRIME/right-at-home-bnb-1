'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  ExternalLink,
  Home,
  KeyRound,
  MapPin,
  Newspaper,
  RefreshCw,
  ShieldCheck,
  Send,
  ShoppingBag,
  Sparkles,
  Utensils,
  Music,
  MoonStar,
  Wrench,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { dashboardForRole, type DashboardRole } from '@/lib/operations-policy';

type JsonRecord = Record<string, any>;

function money(cents: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function dateTime(value: string | Date | null | undefined) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}`);
  return body;
}

function MetricCard({ label, value, icon: Icon, warning = false }: any) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-black/60">{label}</span>
        <Icon className={`h-5 w-5 ${warning ? 'text-red-600' : 'text-[#500000]'}`} />
      </div>
      <div className={`mt-3 text-3xl font-semibold ${warning ? 'text-red-700' : 'text-[#2D2D2D]'}`}>{value}</div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-black/20 bg-white/60 p-6 text-sm text-black/60">{children}</div>;
}

function ProviderNotice({ providers }: { providers: any[] }) {
  const unavailable = providers?.filter((provider) => !provider.available) || [];
  if (!unavailable.length) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      Some live sources are unavailable: {unavailable.map((provider) => provider.provider).join(', ')}.
    </div>
  );
}

function AreaIntelligencePanel({ data }: { data: JsonRecord | null }) {
  const [category, setCategory] = useState<'food' | 'shopping' | 'music' | 'nightlife'>('food');
  if (!data) return <EmptyState>Midland area intelligence is loading.</EmptyState>;

  const categoryMeta = {
    food: { label: 'Food', icon: Utensils },
    shopping: { label: 'Shopping', icon: ShoppingBag },
    music: { label: 'Music', icon: Music },
    nightlife: { label: 'Nightlife', icon: MoonStar },
  } as const;
  const places = data.places?.[category] || [];
  const SelectedIcon = categoryMeta[category].icon;

  return (
    <section className="space-y-5 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#500000]">Midland Area Intelligence</h2>
          <p className="text-sm text-black/55">Live weather, maps, events, recommendations and headlines.</p>
        </div>
        <a
          href={data.map?.searchUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#500000] px-4 py-2 text-sm font-medium text-white"
        >
          <MapPin className="h-4 w-4" /> Open map
        </a>
      </div>

      <ProviderNotice providers={data.providers || []} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-xl bg-[#F5F5F0] p-4">
          <div className="text-sm font-medium text-black/50">Current weather</div>
          {data.weather?.current ? (
            <>
              <div className="mt-2 text-4xl font-semibold text-[#2D2D2D]">{data.weather.current.temperature}°F</div>
              <div className="mt-1 text-sm text-black/70">{data.weather.current.conditions?.[0]?.description}</div>
              <div className="mt-3 text-xs text-black/50">
                Wind {data.weather.current.windSpeed} mph {data.weather.current.windDirection} · Humidity {data.weather.current.humidity}%
              </div>
            </>
          ) : (
            <div className="mt-3 text-sm text-black/60">Weather is currently unavailable.</div>
          )}
          {(data.weatherWarnings || []).map((warning: string) => (
            <div key={warning} className="mt-3 rounded-lg bg-amber-100 p-2 text-xs text-amber-900">{warning}</div>
          ))}
        </div>
        <iframe
          title="Midland map"
          src="https://www.google.com/maps?q=Midland%2C%20Texas&output=embed"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-64 w-full rounded-xl border-0"
        />
      </div>

      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          {(Object.keys(categoryMeta) as Array<keyof typeof categoryMeta>).map((key) => {
            const Icon = categoryMeta[key].icon;
            return (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${category === key ? 'bg-[#500000] text-white' : 'bg-[#F5F5F0] text-black/70'}`}
              >
                <Icon className="h-4 w-4" /> {categoryMeta[key].label}
              </button>
            );
          })}
        </div>
        {places.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {places.slice(0, 9).map((place: any) => (
              <a
                key={place.id}
                href={place.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-black/10 p-4 transition hover:border-[#500000]/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-[#2D2D2D]">{place.name}</div>
                    <div className="mt-1 text-xs text-black/50">{place.address || 'Midland area'}</div>
                  </div>
                  <SelectedIcon className="h-4 w-4 shrink-0 text-[#500000]" />
                </div>
                <div className="mt-3 text-xs text-black/60">
                  {place.rating ? `${place.rating} ★` : 'No rating'}
                  {place.openNow === true ? ' · Open now' : place.openNow === false ? ' · Closed' : ''}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <EmptyState>No live {categoryMeta[category].label.toLowerCase()} results are currently available.</EmptyState>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-[#2D2D2D]"><CalendarDays className="h-4 w-4" /> Area events</h3>
          <div className="space-y-2">
            {(data.events || []).slice(0, 6).map((event: any) => (
              <a key={event.id} href={event.ticketUrl || event.mapsUrl || '#'} target="_blank" rel="noreferrer" className="block rounded-lg bg-[#F5F5F0] p-3">
                <div className="font-medium">{event.name}</div>
                <div className="mt-1 text-xs text-black/55">{event.startDate || 'Date pending'} · {event.venueName || 'Midland area'}</div>
              </a>
            ))}
            {!data.events?.length && <EmptyState>No live event results are currently available.</EmptyState>}
          </div>
        </div>
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-[#2D2D2D]"><Newspaper className="h-4 w-4" /> Local and national news</h3>
          <div className="space-y-2">
            {[...(data.news?.local || []).slice(0, 3), ...(data.news?.national || []).slice(0, 3)].map((article: any, index: number) => (
              <a key={`${article.url}-${index}`} href={article.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-lg border border-black/10 p-3">
                <div>
                  <div className="text-sm font-medium">{article.title}</div>
                  <div className="mt-1 text-xs text-black/50">{article.source}</div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-black/40" />
              </a>
            ))}
            {!data.news?.local?.length && !data.news?.national?.length && <EmptyState>Live headlines are currently unavailable.</EmptyState>}
          </div>
        </div>
      </div>
    </section>
  );
}

function PortfolioAvailabilityPanel({ portfolio }: { portfolio: JsonRecord | null }) {
  if (!portfolio) return <EmptyState>Live booking availability is loading.</EmptyState>;
  const summary = portfolio.summary || {};
  const properties = [...(portfolio.properties || [])].sort((left: any, right: any) => {
    const risk = (row: any) => (row.conflictCount ? 3 : row.sourceState !== 'fresh' ? 2 : row.availability === 'occupied' ? 1 : 0);
    return risk(right) - risk(left) || left.name.localeCompare(right.name);
  });
  const availabilityClass: Record<string, string> = {
    occupied: 'bg-blue-100 text-blue-800',
    blocked: 'bg-amber-100 text-amber-800',
    available: 'bg-emerald-100 text-emerald-800',
  };

  return (
    <section id="live-occupancy" className="scroll-mt-6 space-y-5 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#500000]" />
            <h2 className="text-xl font-semibold text-[#500000]">Live Booking &amp; Occupancy</h2>
          </div>
          <p className="mt-1 text-sm text-black/55">Database-backed VRBO mirror · refreshes automatically every minute</p>
        </div>
        <div className="text-right text-xs text-black/50">
          <div>Updated {dateTime(portfolio.generatedAt)}</div>
          <div>{summary.staleSources || 0} stale or missing source{summary.staleSources === 1 ? '' : 's'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Homes', summary.total || 0],
          ['Occupied', summary.occupied || 0],
          ['Available', summary.available || 0],
          ['Blocked', summary.blocked || 0],
          ['Conflicts', summary.conflicts || 0],
          ['Source issues', summary.staleSources || 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl bg-[#F5F5F0] p-3">
            <div className="text-xs font-medium text-black/50">{label}</div>
            <div className={`mt-1 text-2xl font-semibold ${label === 'Conflicts' && Number(value) > 0 ? 'text-red-700' : 'text-[#2D2D2D]'}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {properties.map((property: any) => (
          <article key={property.propertyId} className={`rounded-xl border p-4 ${property.conflictCount ? 'border-red-300 bg-red-50/50' : 'border-black/10'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 shrink-0 text-[#500000]" />
                  <h3 className="truncate font-semibold text-[#2D2D2D]">{property.name}</h3>
                </div>
                <p className="mt-1 truncate text-xs text-black/50">{property.address}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${availabilityClass[property.availability] || 'bg-black/5 text-black/60'}`}>
                {property.availability}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-lg bg-white/80 p-3">
                <div className="font-medium text-black/50">Current</div>
                <div className="mt-1 font-semibold text-black/80">
                  {property.currentStay
                    ? `${property.currentStay.platform} · until ${dateTime(property.currentStay.checkOut)}`
                    : 'Open now'}
                </div>
              </div>
              <div className="rounded-lg bg-white/80 p-3">
                <div className="font-medium text-black/50">Next</div>
                <div className="mt-1 font-semibold text-black/80">
                  {property.nextStay
                    ? `${property.nextStay.platform} · ${dateTime(property.nextStay.checkIn)}`
                    : 'No upcoming stay'}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className={`inline-flex items-center gap-1.5 ${property.sourceState === 'fresh' ? 'text-emerald-700' : 'text-amber-800'}`}>
                {property.sourceState === 'fresh' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                VRBO source {property.sourceState}
                {property.sourceAgeSeconds !== null ? ` · ${Math.max(0, Math.floor(property.sourceAgeSeconds / 60))}m ago` : ''}
              </div>
              {property.conflictCount > 0 && (
                <Link href="/bookings" className="font-semibold text-red-700">
                  {property.conflictCount} conflict{property.conflictCount === 1 ? '' : 's'} · resolve
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
      {!properties.length && <EmptyState>No active properties are configured.</EmptyState>}
    </section>
  );
}

function OwnerDashboard({ data, area }: { data: JsonRecord; area: JsonRecord | null }) {
  const metrics = data.metrics || {};
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Active properties" value={metrics.activeProperties || 0} icon={Sparkles} />
        <MetricCard label="Upcoming check-ins" value={metrics.upcomingCheckIns || 0} icon={KeyRound} />
        <MetricCard label="Open work orders" value={metrics.openWorkOrders || 0} icon={Briefcase} />
        <MetricCard label="Unassigned" value={metrics.unassignedWorkOrders || 0} icon={AlertTriangle} warning={metrics.unassignedWorkOrders > 0} />
        <MetricCard label="Worker pay owed" value={money(metrics.unpaidWorkerCents)} icon={DollarSign} />
      </div>

      <PortfolioAvailabilityPanel portfolio={data.portfolio || null} />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['/admin/dispatch', 'Dispatch board'],
          ['/admin/planner', 'Portfolio planner'],
          ['/admin/payroll', 'Friday payroll'],
          ['/admin/smart-home', 'Locks and access'],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-xl bg-[#500000] px-4 py-4 text-center font-medium text-white">{label}</Link>
        ))}
      </div>

      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#500000]">Recent operations</h2>
            <p className="text-sm text-black/55">Assignments, check-ins, reports and follow-up work.</p>
          </div>
          <div className="text-sm text-black/50">{metrics.openAlerts || 0} open alerts · {metrics.activeGuestRequests || 0} guest requests</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-black/10 text-black/50">
              <tr><th className="p-3">Property</th><th className="p-3">Work</th><th className="p-3">Worker</th><th className="p-3">Status</th><th className="p-3">Scheduled</th><th className="p-3">Pay</th></tr>
            </thead>
            <tbody>
              {(data.recentWorkOrders || []).map((job: any) => (
                <tr key={job.id} className="border-b border-black/5">
                  <td className="p-3 font-medium">{job.property?.name}</td>
                  <td className="p-3">{job.title}</td>
                  <td className="p-3">{job.assignedWorker?.user?.name || 'Unassigned'}</td>
                  <td className="p-3">{job.status}</td>
                  <td className="p-3">{dateTime(job.scheduledStart)}</td>
                  <td className="p-3">{money(job.payAmountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <AreaIntelligencePanel data={area} />
    </div>
  );
}

function WorkerJob({ job, refresh }: { job: any; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(job.status === 'IN_PROGRESS');
  const [report, setReport] = useState('');
  const [flags, setFlags] = useState({ damageReported: false, theftReported: false, maintenanceNeeded: false, yardNeeded: false, poolNeeded: false });
  const [error, setError] = useState('');

  const geolocation = () => new Promise<{ latitude: number | null; longitude: number | null }>((resolve) => {
    if (!navigator.geolocation) return resolve({ latitude: null, longitude: null });
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve({ latitude: null, longitude: null }),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });

  const checkIn = async () => {
    setBusy(true); setError('');
    try {
      const coords = await geolocation();
      await jsonFetch(`/api/operations/work-orders/${job.id}/check-in`, { method: 'POST', body: JSON.stringify(coords) });
      setExpanded(true);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Check-in failed'); }
    finally { setBusy(false); }
  };

  const toggleItem = async (item: any) => {
    setBusy(true); setError('');
    try {
      const evidencePhotoUrl = item.requiresPhoto && !item.evidencePhotoUrl
        ? window.prompt('Paste the uploaded photo URL for this required task:')
        : item.evidencePhotoUrl;
      if (item.requiresPhoto && !evidencePhotoUrl) throw new Error('Photo evidence is required');
      await jsonFetch(`/api/operations/work-orders/${job.id}/checklist`, {
        method: 'PATCH',
        body: JSON.stringify({ itemId: item.id, completed: !item.completed, evidencePhotoUrl }),
      });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Checklist update failed'); }
    finally { setBusy(false); }
  };

  const complete = async () => {
    if (!report.trim()) { setError('Enter the final report before completing the job.'); return; }
    setBusy(true); setError('');
    try {
      const coords = await geolocation();
      await jsonFetch(`/api/operations/work-orders/${job.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ reportSummary: report, ...flags, ...coords }),
      });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Completion failed'); }
    finally { setBusy(false); }
  };

  return (
    <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[#500000]">{job.serviceType}</div>
          <h3 className="mt-1 text-lg font-semibold">{job.title}</h3>
          <p className="mt-1 text-sm text-black/55">{job.property.name} · {job.property.address}</p>
          <p className="mt-1 text-xs text-black/45">{dateTime(job.scheduledStart)} · Pay {money(job.payAmountCents)}</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-[#F5F5F0] px-3 py-1 text-xs font-medium">{job.status}</span>
          <button onClick={() => setExpanded(!expanded)} className="rounded-lg border border-black/10 px-3 py-1 text-xs">{expanded ? 'Hide' : 'Open'}</button>
        </div>
      </div>

      {error && <div className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      {expanded && (
        <div className="mt-5 space-y-4 border-t border-black/10 pt-4">
          {['ASSIGNED', 'ACCEPTED'].includes(job.status) && (
            <button disabled={busy} onClick={checkIn} className="inline-flex items-center gap-2 rounded-lg bg-[#500000] px-4 py-2 font-medium text-white disabled:opacity-50">
              <Clock3 className="h-4 w-4" /> Check in and start timer
            </button>
          )}
          {job.status === 'IN_PROGRESS' && (
            <>
              <div className="space-y-2">
                {(job.checklistItems || []).map((item: any) => (
                  <button key={item.id} disabled={busy} onClick={() => toggleItem(item)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${item.completed ? 'border-green-300 bg-green-50' : 'border-black/10'}`}>
                    <CheckCircle2 className={`h-5 w-5 ${item.completed ? 'text-green-600' : 'text-black/25'}`} />
                    <span className="flex-1 text-sm">{item.label}{item.requiresPhoto ? ' · photo required' : ''}</span>
                  </button>
                ))}
              </div>
              <textarea value={report} onChange={(event) => setReport(event.target.value)} placeholder="Final report: clean, missing/damaged items, maintenance, yard or pool needs…" className="min-h-28 w-full rounded-lg border border-black/15 p-3 text-sm" />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {Object.keys(flags).map((key) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg bg-[#F5F5F0] p-2 text-xs">
                    <input type="checkbox" checked={(flags as any)[key]} onChange={(event) => setFlags({ ...flags, [key]: event.target.checked })} />
                    {key.replace(/([A-Z])/g, ' $1')}
                  </label>
                ))}
              </div>
              <button disabled={busy} onClick={complete} className="rounded-lg bg-green-700 px-4 py-2 font-medium text-white disabled:opacity-50">Submit report and complete</button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function WorkerDashboard({ data, refresh }: { data: JsonRecord; refresh: () => Promise<void> }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Assigned jobs" value={data.metrics?.assignedJobs || 0} icon={Briefcase} />
        <MetricCard label="Unpaid jobs" value={data.metrics?.unpaidJobCount || 0} icon={CheckCircle2} />
        <MetricCard label="Pay earned" value={money(data.metrics?.unpaidCents)} icon={DollarSign} />
        <MetricCard label="Recurring visits" value={data.metrics?.recurringSchedules || 0} icon={CalendarDays} />
      </div>
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-[#500000]">My assigned work</h2>
          <p className="text-sm text-black/55">Check in at the property, complete every task, attach required photos and submit the final report.</p>
        </div>
        <div className="space-y-4">
          {(data.jobs || []).map((job: any) => <WorkerJob key={job.id} job={job} refresh={refresh} />)}
          {!data.jobs?.length && <EmptyState>No active assignments.</EmptyState>}
        </div>
      </section>
    </div>
  );
}

function GuestDashboard({ data, area, refresh }: { data: JsonRecord; area: JsonRecord | null; refresh: () => Promise<void> }) {
  const booking = data.activeBooking || data.upcomingBookings?.[0] || null;
  const [category, setCategory] = useState('TOWELS');
  const [urgency, setUrgency] = useState('NORMAL');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!booking) return;
    setBusy(true); setStatus('');
    try {
      const result = await jsonFetch('/api/operations/guest-requests', {
        method: 'POST',
        body: JSON.stringify({ bookingId: booking.id, category, urgency, description }),
      });
      setDescription('');
      setStatus(result.workOrder?.assignedWorkerId ? 'A worker has been dispatched.' : 'Your request was sent to the operations team.');
      await refresh();
    } catch (e) { setStatus(e instanceof Error ? e.message : 'Request failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      {booking ? (
        <section className="rounded-2xl bg-gradient-to-br from-[#500000] to-[#722F37] p-6 text-white shadow-sm">
          <div className="text-sm text-white/70">{booking.status === 'CHECKED_IN' ? 'Current stay' : 'Upcoming stay'}</div>
          <h2 className="mt-2 text-2xl font-semibold">{booking.property.name}</h2>
          <p className="mt-1 text-white/75">{booking.property.address}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div><div className="text-xs text-white/60">Check-in</div><div className="mt-1 font-medium">{dateTime(booking.checkIn)}</div></div>
            <div><div className="text-xs text-white/60">Check-out</div><div className="mt-1 font-medium">{dateTime(booking.checkOut)}</div></div>
            <div><div className="text-xs text-white/60">Door access</div><div className="mt-1 font-medium">{booking.accessGrants?.[0]?.deliveredAt ? `Sent by ${booking.accessGrants[0].deliveryChannel}` : 'Sent shortly before check-in'}</div></div>
          </div>
        </section>
      ) : (
        <EmptyState>No active or upcoming booking is linked to this account.</EmptyState>
      )}

      {booking && (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-[#500000]">Request help</h2>
            <p className="mt-1 text-sm text-black/55">Towels, supplies, cleaning, maintenance, yard or pool assistance.</p>
            <form onSubmit={submitRequest} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-black/15 p-3 text-sm">
                  {['TOWELS', 'LINENS', 'TOILETRIES', 'CLEANING', 'MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'HVAC', 'POOL', 'YARD'].map((value) => <option key={value}>{value}</option>)}
                </select>
                <select value={urgency} onChange={(event) => setUrgency(event.target.value)} className="rounded-lg border border-black/15 p-3 text-sm">
                  <option value="NORMAL">Normal</option><option value="HIGH">Urgent</option><option value="EMERGENCY">Emergency</option>
                </select>
              </div>
              <textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what you need and where it is needed." className="min-h-28 w-full rounded-lg border border-black/15 p-3 text-sm" />
              <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-[#500000] px-4 py-2 font-medium text-white disabled:opacity-50"><Send className="h-4 w-4" /> Send request</button>
              {status && <p className="text-sm text-black/65">{status}</p>}
            </form>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-[#500000]">Request status</h2>
            <div className="mt-4 space-y-3">
              {(data.requests || []).slice(0, 6).map((request: any) => (
                <div key={request.id} className="rounded-lg bg-[#F5F5F0] p-3">
                  <div className="flex justify-between gap-3"><span className="font-medium">{request.category}</span><span className="text-xs">{request.status}</span></div>
                  <p className="mt-1 text-sm text-black/60">{request.description}</p>
                  {request.assignedWorkOrder?.assignedWorker?.user?.name && <p className="mt-2 text-xs text-[#500000]">Assigned to {request.assignedWorkOrder.assignedWorker.user.name}</p>}
                </div>
              ))}
              {!data.requests?.length && <EmptyState>No service requests yet.</EmptyState>}
            </div>
          </div>
        </section>
      )}
      <AreaIntelligencePanel data={area} />
    </div>
  );
}

export default function RoleDashboard({ expectedRole }: { expectedRole: DashboardRole }) {
  const router = useRouter();
  const { appUser, loading: authLoading } = useAuth();
  const [dashboard, setDashboard] = useState<JsonRecord | null>(null);
  const [area, setArea] = useState<JsonRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const actualRole = useMemo(() => dashboardForRole(appUser?.role || 'guest'), [appUser?.role]);

  useEffect(() => {
    if (authLoading || !appUser) return;
    if (actualRole !== expectedRole) {
      router.replace(actualRole === 'owner' ? '/owner' : actualRole === 'worker' ? '/worker' : '/guest/dashboard');
    }
  }, [actualRole, appUser, authLoading, expectedRole, router]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [dashboardData, areaData] = await Promise.all([
        jsonFetch('/api/operations/dashboard'),
        expectedRole === 'worker' ? Promise.resolve(null) : jsonFetch('/api/area-intelligence').catch(() => null),
      ]);
      setDashboard(dashboardData);
      setArea(areaData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dashboard failed to load');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [expectedRole]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
    if (expectedRole !== 'owner') return;
    const interval = window.setInterval(() => void refresh(true), 60_000);
    return () => window.clearInterval(interval);
  }, [authLoading, expectedRole, refresh]);

  if (authLoading || loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><RefreshCw className="h-7 w-7 animate-spin text-[#500000]" /></div>;
  }
  if (error || !dashboard) {
    return <div className="m-6 rounded-xl bg-red-50 p-5 text-red-700">{error || 'Dashboard data is unavailable.'}</div>;
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] p-4 sm:p-6 lg:p-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.18em] text-[#C4A777]">Right at Home BnB</div>
          <h1 className="mt-1 text-3xl font-semibold text-[#500000]">
            {expectedRole === 'owner' ? 'Owner Operations' : expectedRole === 'worker' ? 'Worker Operations' : 'My Stay'}
          </h1>
        </div>
        <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-2 text-sm"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </header>
      {expectedRole === 'owner' && <OwnerDashboard data={dashboard} area={area} />}
      {expectedRole === 'worker' && <WorkerDashboard data={dashboard} refresh={refresh} />}
      {expectedRole === 'guest' && <GuestDashboard data={dashboard} area={area} refresh={refresh} />}
    </div>
  );
}
