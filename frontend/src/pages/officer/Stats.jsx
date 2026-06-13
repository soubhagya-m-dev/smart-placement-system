import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Download, Users, Briefcase, TrendingUp, Target, Award, BarChart3,
  PieChart as PieIcon, Activity, Building2, Filter, X, Loader2, RefreshCw
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { STREAM_OPTIONS, SECTION_OPTIONS, YEAR_OPTIONS } from '../../lib/profileOptions';

// Color palette — distinct per branch series, with a green→amber→red gradient
// for placement percentage contexts. Matches existing badge palette.
const COLORS = {
  primary: '#6366f1',    // indigo
  accent:  '#10b981',    // emerald
  warning: '#f59e0b',    // amber
  danger:  '#ef4444',    // red
  muted:   '#6b7280',    // gray
  series:  ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'],
  donut:   ['#10b981', '#f59e0b', '#9ca3af'] // placed / trying / not trying
};

// Tween a number from 0 → value over `ms` (one shot). Used for KPI counters.
function useCountUp(target, ms = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target == null) return;
    const start = performance.now();
    const from = 0;
    const isFloat = !Number.isInteger(target);
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      setV(isFloat ? +next.toFixed(target < 10 ? 2 : 1) : Math.round(next));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

// A KPI card — big number, label, optional subtext. Fades in + slides up.
function KpiCard({ icon: Icon, label, value, suffix = '', sub, tone = 'default', delay = 0 }) {
  const animated = useCountUp(value);
  const toneClasses = {
    default: 'border-gray-200',
    success: 'border-emerald-200',
    warning: 'border-amber-200',
    primary: 'border-indigo-200'
  };
  return (
    <div
      className={`bg-white rounded-xl border ${toneClasses[tone]} shadow-sm p-4 transition hover:shadow-md`}
      style={{ animation: 'fadeUp 500ms ease-out both', animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`p-2 rounded-lg ${tone === 'success' ? 'bg-emerald-50' : tone === 'warning' ? 'bg-amber-50' : tone === 'primary' ? 'bg-indigo-50' : 'bg-gray-50'}`}>
          <Icon size={18} className={tone === 'success' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : tone === 'primary' ? 'text-indigo-600' : 'text-gray-600'} />
        </div>
      </div>
      <div className="text-2xl font-semibold text-gray-900 tabular-nums">
        {animated}{suffix}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// Section panel with a title and right-aligned action slot.
function Panel({ title, subtitle, icon: Icon, children, action, delay = 0 }) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm"
      style={{ animation: 'fadeUp 500ms ease-out both', animationDelay: `${delay}ms` }}
    >
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-gray-500" />}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// Recharts tooltip styled to match the dashboard surface.
function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      {label != null && <div className="font-medium text-gray-700 mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-gray-600">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span>{p.name}:</span>
          <span className="font-semibold text-gray-900">{typeof p.value === 'number' ? p.value.toFixed(p.value % 1 === 0 ? 0 : 1) : p.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

export default function Stats() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Filter state is read from / synced to the URL so deep-links and refreshes work.
  const filters = {
    year:    searchParams.get('year')    || 'all',
    branch:  searchParams.get('branch')  || 'all',
    section: searchParams.get('section') || 'all',
    gender:  searchParams.get('gender')  || 'all'
  };
  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete(key); else next.set(key, value);
    setSearchParams(next);
  };
  const clearAll = () => setSearchParams(new URLSearchParams());

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Re-fetch whenever any filter changes. Build a query string from current filters.
  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== 'all') q.set(k, v); });
    const url = `/api/stats/analytics${q.toString() ? `?${q}` : ''}`;
    setLoading(true);
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.success) { setData(json.data); setError(null); }
        else setError(json.message || 'Failed to load');
      })
      .catch(e => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [searchParams]);

  // Trend chart series toggle — which branches show on the line chart
  const [hiddenSeries, setHiddenSeries] = useState(new Set());
  const toggleSeries = (branch) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      next.has(branch) ? next.delete(branch) : next.add(branch);
      return next;
    });
  };

  // Merge the canonical option lists (kept in lib/profileOptions.js) with whatever
  // distinct values actually exist in the DB. The static list is the source of
  // truth for what the student registration form offers, so the analytics filters
  // always show every registrable option — even branches/sections no student has
  // picked yet. Any custom values that have slipped into the DB get unioned in
  // (Set dedupes) so we never lose a real value.
  const yearOptions   = useMemo(() => {
    const fromData = data?.filterOptions?.years || [];
    return [...new Set([...YEAR_OPTIONS, ...fromData])].sort((a, b) => a - b);
  }, [data]);
  const branchOptions = useMemo(() => {
    const fromData = data?.filterOptions?.branches || [];
    return [...new Set([...STREAM_OPTIONS, ...fromData])].sort();
  }, [data]);
  const sectionOptions = useMemo(() => {
    const fromData = data?.filterOptions?.sections || [];
    return [...new Set([...SECTION_OPTIONS, ...fromData])].sort();
  }, [data]);
  // Gender has no static list (Male/Female only) — derive from data.
  const genderOptions = useMemo(() => data?.filterOptions?.genders || [], [data]);

  const kpis = data?.kpis;
  const hasFilter = Object.values(filters).some(v => v !== 'all');

  // CSV export — flatten every dataset into a single CSV.
  const exportCsv = () => {
    if (!data) return;
    const rows = [];
    rows.push(['KPI', 'Value']);
    Object.entries(data.kpis).forEach(([k, v]) => rows.push([k, v]));
    rows.push([]);
    rows.push(['Branch', 'Total', 'Placed', 'Placement %']);
    data.byBranch.forEach(b => rows.push([b.branch, b.total, b.placed, b.placementPct.toFixed(1)]));
    rows.push([]);
    rows.push(['Year', 'Total', 'Placed', 'Placement %']);
    data.byYear.forEach(y => rows.push([y.year, y.total, y.placed, y.placementPct.toFixed(1)]));
    rows.push([]);
    rows.push(['Recruiter', 'Offers', 'Avg CTC (LPA)']);
    data.topRecruiters.forEach(r => rows.push([r.company, r.offers, r.avgCtc ?? '-']));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `placement-stats-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading analytics…
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <div className="font-semibold mb-1">Couldn't load analytics</div>
        <div className="text-sm">{error}</div>
        <button onClick={() => setSearchParams(new URLSearchParams(searchParams))} className="mt-3 px-3 py-1.5 bg-white border border-red-200 rounded-md text-sm flex items-center gap-1">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Inject the keyframe once for the fade-up entrance animation */}
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Placement Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Branch-wise, batch-wise, and recruiter insights</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/officer')} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">← Dashboard</button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-gray-400 ml-1" />
        {[
          { key: 'year',    label: 'Batch',  options: yearOptions },
          { key: 'branch',  label: 'Branch', options: branchOptions },
          { key: 'section', label: 'Section',options: sectionOptions },
          { key: 'gender',  label: 'Gender', options: genderOptions }
        ].map(({ key, label, options }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">{label}:</span>
            <select
              value={filters[key]}
              onChange={e => setFilter(key, e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="all">All</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        {hasFilter && (
          <button onClick={clearAll} className="ml-auto inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900">
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {/* KPI strip — 4 cards (no Verified per spec) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users}      label="Total Students"   value={kpis.totalStudents}                   tone="primary" delay={0} />
        <KpiCard icon={Briefcase}  label="Active Jobs"      value={kpis.activeJobs}                      tone="default" delay={60} />
        <KpiCard icon={Target}     label="Placement %"      value={kpis.placementPct} suffix="%"         tone="success" delay={120} sub={`${kpis.placedStudents} of ${kpis.totalStudents} placed`} />
        <KpiCard icon={Award}      label="Avg Package"      value={kpis.avgPackageLpa} suffix=" LPA"    tone="warning" delay={180} sub={kpis.offerCount ? `Across ${kpis.offerCount} offer${kpis.offerCount !== 1 ? 's' : ''}` : 'No CTC sent yet'} />
      </div>

      {/* Row 2: Branch bars + Status donut */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <Panel
            title="Placement % by Branch"
            subtitle="Click a bar to filter"
            icon={BarChart3}
            delay={240}
            action={filters.branch !== 'all' && (
              <button onClick={() => setFilter('branch', 'all')} className="text-xs text-indigo-600 hover:underline">
                Clear: {filters.branch}
              </button>
            )}
          >
            {data.byBranch.length === 0 ? (
              <EmptyState message="No branch data yet — student profiles need a stream" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.byBranch} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} onClick={(e) => e?.activePayload?.[0] && setFilter('branch', e.activePayload[0].payload.branch)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="branch" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="placementPct" name="Placement %" radius={[6, 6, 0, 0]} cursor="pointer">
                    {data.byBranch.map((b, i) => (
                      <Cell
                        key={i}
                        fill={b.placementPct >= 70 ? COLORS.accent : b.placementPct >= 30 ? COLORS.warning : COLORS.danger}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>
        <div className="lg:col-span-2">
          <Panel title="Status Breakdown" icon={PieIcon} delay={300}>
            {data.statusBreakdown.placed + data.statusBreakdown.trying + data.statusBreakdown.notTrying === 0 ? (
              <EmptyState message="No students in scope" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Placed',     value: data.statusBreakdown.placed },
                      { name: 'Trying',     value: data.statusBreakdown.trying },
                      { name: 'Not Trying', value: data.statusBreakdown.notTrying }
                    ]}
                    cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value"
                  >
                    {COLORS.donut.map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(v, e) => `${v}: ${e.payload.value}`}
                  />
                  {/* Center label showing the overall placement % */}
                  <text x="50%" y="48%" textAnchor="middle" className="fill-gray-900" style={{ fontSize: 24, fontWeight: 600 }}>{kpis.placementPct}%</text>
                  <text x="50%" y="62%" textAnchor="middle" className="fill-gray-500" style={{ fontSize: 11 }}>placed</text>
                </PieChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>
      </div>

      {/* Row 3: Batch trend line + Top recruiters */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <Panel
            title="Batch-wise Placement Trend"
            subtitle="Placement % by graduation year, per branch"
            icon={Activity}
            delay={360}
          >
            {data.trend.data.length === 0 ? (
              <EmptyState message="Add graduation year to student profiles to see trends" />
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {data.trend.branches.map((b, i) => {
                    const hidden = hiddenSeries.has(b);
                    return (
                      <button
                        key={b}
                        onClick={() => toggleSeries(b)}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition ${hidden ? 'border-gray-200 text-gray-400 line-through' : 'border-transparent text-gray-700'}`}
                        style={{ background: hidden ? 'transparent' : COLORS.series[i % COLORS.series.length] + '1A' }}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.trend.data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<ChartTooltip suffix="%" />} />
                    {data.trend.branches.filter(b => !hiddenSeries.has(b)).map((b, i) => (
                      <Line
                        key={b}
                        type="monotone"
                        dataKey={b}
                        name={b}
                        stroke={COLORS.series[i % COLORS.series.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </Panel>
        </div>
        <div className="lg:col-span-2">
          <Panel title="Top Recruiters" subtitle="By accepted offers" icon={Building2} delay={420}>
            {data.topRecruiters.length === 0 ? (
              <EmptyState message="No accepted offers yet" />
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.topRecruiters.map((r, i) => (
                  <li key={r.company} className="flex items-center gap-3 py-2.5">
                    <div className="w-7 h-7 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-semibold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{r.company}</div>
                      <div className="text-xs text-gray-500">{r.offers} offer{r.offers !== 1 ? 's' : ''}{r.avgCtc ? ` · ~${r.avgCtc} LPA` : ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* Row 4: Branch × Year grid */}
      <Panel
        title="Branch × Year Breakdown"
        subtitle="Cell shows placed / total (placement %)"
        icon={TrendingUp}
        delay={480}
      >
        {data.branchYearGrid.length === 0 ? (
          <EmptyState message="No branch × year data" />
        ) : (
          <BranchYearGrid data={data.branchYearGrid} />
        )}
      </Panel>
    </div>
  );
}

function BranchYearGrid({ data }) {
  // Pivot: rows = branch, columns = year
  const branches = [...new Set(data.map(d => d.branch))].sort();
  const years = [...new Set(data.map(d => d.year))].filter(Boolean).sort((a, b) => a - b);
  const lookup = Object.fromEntries(data.map(d => [`${d.branch}|${d.year}`, d]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-200">
            <th className="text-left py-2 pr-4 font-medium">Branch</th>
            {years.map(y => <th key={y} className="text-center py-2 px-2 font-medium">{y}</th>)}
          </tr>
        </thead>
        <tbody>
          {branches.map(b => (
            <tr key={b} className="border-b border-gray-100 last:border-0">
              <td className="py-2.5 pr-4 font-medium text-gray-800">{b}</td>
              {years.map(y => {
                const cell = lookup[`${b}|${y}`];
                if (!cell) return <td key={y} className="text-center py-2 px-2 text-gray-300">—</td>;
                const pct = cell.placementPct;
                const tone = pct >= 70 ? 'bg-emerald-50 text-emerald-700' : pct >= 30 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
                return (
                  <td key={y} className="text-center py-2 px-2">
                    <div className={`inline-block min-w-[64px] px-2 py-1 rounded-md text-xs font-medium ${tone}`}>
                      {cell.placed}/{cell.total} · {pct.toFixed(0)}%
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="py-10 text-center text-sm text-gray-400">
      <PieIcon size={28} className="mx-auto mb-2 text-gray-300" />
      {message}
    </div>
  );
}
