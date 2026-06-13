import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users, ArrowLeft, Download, CheckCircle, XCircle, Filter, Briefcase, Target, Clock, UserPlus, Copy, Check, Eye, EyeOff, Trash2, AlertTriangle } from 'lucide-react';
import { STREAM_OPTIONS, SECTION_OPTIONS, YEAR_OPTIONS } from '../../lib/profileOptions';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// One source of truth for the table columns. Edit here to add/remove/reorder.
// `wrap: true` lets long text wrap to multiple lines instead of forcing the
// cell wide — keeps the whole table on screen without horizontal scroll.
// Numeric/badge columns stay nowrap so they line up.
const COLUMNS = [
  { key: 'rollNumber',            label: 'Roll No',     className: 'text-gray-700 font-mono text-sm' },
  { key: 'name',                  label: 'Name',        className: 'font-medium text-gray-900' },
  { key: 'collegeId',             label: 'College ID',  className: 'text-gray-700 font-mono text-sm' },
  { key: 'dateOfBirth',           label: 'DOB',         className: 'text-gray-700' },
  { key: 'gender',                label: 'Gender',      className: 'text-gray-700', align: 'center' },
  { key: 'phone',                 label: 'Phone',       className: 'text-gray-700 font-mono text-sm' },
  { key: 'email',                 label: 'Email',       className: 'text-gray-600', wrap: true },
  { key: 'graduationPassingYear', label: 'Grad. Year',  className: 'text-gray-700', align: 'right' },
  { key: 'stream',                label: 'Stream',      className: 'text-gray-700', wrap: true, align: 'center' },
  { key: 'section',               label: 'Section',     className: 'text-gray-700', align: 'center' },
  { key: 'cgpa',                  label: 'CGPA',        className: 'text-gray-700', align: 'right' },
  { key: 'tenthPercentage',       label: '10th %',      className: 'text-gray-700', align: 'right' },
  { key: 'twelfthPercentage',     label: '12th %',      className: 'text-gray-700', align: 'right' },
  { key: 'verified',              label: 'Verified' },
  { key: 'placementStatus',       label: 'Status' },
  { key: 'actions',               label: '',            className: 'text-gray-700', align: 'center' },
];

// Read nested studentProfile fields safely
const profile = (s) => s.studentProfile || {};

const VerifiedBadge = ({ value }) =>
  value ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
      <CheckCircle className="w-3 h-3" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <XCircle className="w-3 h-3" /> No
    </span>
  );

// Placement status badge.
// Three states, computed server-side on the `/students/all` endpoint and
// surfaced here. Colors chosen to mirror the Verified badge style — small
// pill, subtle background, colored icon for quick scanning down a long list.
const PlacementBadge = ({ status, total }) => {
  if (status === 'placed') {
    return (
      <span
        title={`Placed — ${total} application${total === 1 ? '' : 's'} on file`}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"
      >
        <Briefcase className="w-3 h-3" /> Placed
      </span>
    );
  }
  if (status === 'trying') {
    return (
      <span
        title="Actively in the placement pipeline (pending or shortlisted)"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"
      >
        <Target className="w-3 h-3" /> Trying
      </span>
    );
  }
  return (
    <span
      title="No active applications"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
    >
      <Clock className="w-3 h-3" /> Not Trying
    </span>
  );
};

// Flatten a student record into a row for the table
const flatten = (s) => {
  const p = profile(s);
  return {
    id: s._id,
    rollNumber: p.universityRollNumber || '—',
    name: s.name || '—',
    collegeId: p.collegeId || '—',
    // dateOfBirth is stored as a string (e.g. "2004-08-15"). Format to a
    // human-friendly "DD MMM YYYY" if it parses; otherwise show the raw value
    // (or "—"). Avoids displaying raw ISO strings like "2004-08-15T00:00:00.000Z".
    dateOfBirth: (() => {
      const raw = p.dateOfBirth;
      if (!raw) return '—';
      const d = new Date(raw);
      return Number.isFinite(d.getTime())
        ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : raw;
    })(),
    gender: p.gender || '—',
    phone: p.contactNumber || s.phone || '—',
    email: s.email || '—',
    graduationPassingYear: p.graduationPassingYear ?? '—',
    stream: p.stream || '—',
    section: p.section || '—',
    cgpa: p.currentCGPA != null ? p.currentCGPA.toFixed(2) : '—',
    tenthPercentage: p.tenthPercentage != null ? `${p.tenthPercentage}%` : '—',
    twelfthPercentage: p.twelfthPercentage != null ? `${p.twelfthPercentage}%` : '—',
    verified: !!(p.verified),
    // Server returns `placement: { status, total, accepted, inProgress, rejected }`.
    // Fall back to "not_trying" if the field is missing (older backends, partial data).
    placementStatus: s.placement?.status || 'not_trying',
    placementTotal: s.placement?.total ?? 0,
  };
};

export default function AllStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showUnverified, setShowUnverified] = useState(false);
  const [yearFilter, setYearFilter] = useState('all');
  const [streamFilter, setStreamFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  // "Add Student" modal state. We keep the form state separate from the
  // success view so the officer can create multiple students in a row
  // without the form fields hanging around from the previous one.
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '' });
  const [addShowPw, setAddShowPw] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState(null);
  // Holds the {student, temporaryPassword, passwordWasGenerated} from the
  // most recent successful create. The password is shown EXACTLY once
  // here — the officer must copy it now or it's gone. Backend clears it
  // on the student's first /change-password.
  const [addSuccess, setAddSuccess] = useState(null);
  const [copied, setCopied] = useState(false);
  // Delete-student confirmation modal state. We store the whole row object
  // (not just the id) so the confirmation prompt can show the student's
  // name + roll + email — never ask an officer to confirm a deletion of
  // "an unnamed account" if the row somehow renders blank.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Search/select delete modal state. We split this from deleteTarget (the
  // per-row delete) so the two flows don't fight: header "Delete Student"
  // opens the picker, picks a row, *then* becomes the same delete flow.
  const [deletePickerOpen, setDeletePickerOpen] = useState(false);
  const [deletePickerQuery, setDeletePickerQuery] = useState('');

  useEffect(() => {
    // We only register the global keydown handler while the picker is open
    // — never globally, otherwise we'd hijack Esc/Enter on unrelated modals
    // (Add Student, etc.) and the officer would have to fight the handler.
    if (!deletePickerOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setDeletePickerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deletePickerOpen]);

  // Build a shortlist of students the officer can pick from. We filter the
  // already-fetched `students` array (so this is O(n) on the *visible* list,
  // which is fine — officers rarely have 10k+ students on one screen). We
  // intentionally also include students the officer has filtered OUT of
  // the table — that's the whole point of having a header-level delete:
  // you might have hidden a CSE student and want to delete an ECE one.
  // So we search the raw `students` array, not the `filtered` one.
  const deletePickerMatches = useMemo(() => {
    if (!deletePickerOpen) return [];
    const q = deletePickerQuery.trim().toLowerCase();
    const list = students;
    if (!q) return list.slice(0, 25);          // empty query → first 25
    return list.filter(s => {
      const hay = `${s.name || ''} ${s.rollNumber || ''} ${s.email || ''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 25);
  }, [deletePickerOpen, deletePickerQuery, students]);

  // Pick from the picker = set the deleteTarget, which transitions us into
  // the same confirmation modal the per-row trash icon uses. The picker
  // stays open underneath the confirm modal (same z-stack trick) but is
  // visually hidden by the backdrop; when the officer cancels the confirm
  // modal, we close BOTH so they don't end up back in the picker.
  const pickFromHeader = (student) => {
    setDeletePickerOpen(false);
    setDeletePickerQuery('');
    setDeleteTarget(student);
  };

  // Cancel from picker (the Cancel button or backdrop click) — drop back
  // to a clean state. Don't touch deleteTarget; if a per-row confirm modal
  // is also open, leave it alone (shouldn't be possible since clicking a
  // row closes the picker, but defensive).
  const closePicker = () => {
    setDeletePickerOpen(false);
    setDeletePickerQuery('');
  };

  // Fetch the full student list. The Verified-only toggle flips `showUnverified`
  // which re-runs this effect. We hit the verified-filtered endpoint by
  // default; "include unverified" mode drops the filter so the officer
  // can see *every* student, including those awaiting approval — useful
  // for spotting test accounts or duplicates to delete.
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const url = `${API_URL}/api/students/all${showUnverified ? '?verified=false' : ''}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed to load');
        setStudents(data.data.students);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [showUnverified]);

  // Flatten once, then sort by roll number ascending.
  // Roll numbers are stored as strings (e.g. "25500122065") — parse to a number
  // for natural numeric ordering. Missing roll numbers ("—") always sort to
  // the bottom of the list.
  const rows = useMemo(() => {
    const parseRoll = (r) => {
      const n = parseInt(r.rollNumber, 10);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    };
    return [...students.map(flatten)].sort((a, b) => parseRoll(a) - parseRoll(b));
  }, [students]);

  // Derive dropdown options from the actual data so the filters only ever
  // show values that exist. We then MERGE with the full set of profile
  // options (imported from lib/profileOptions) so students whose values
  // aren't in the current dataset still appear as filter choices — the
  // officer can pre-select e.g. "Section A" or "ECE" even when no verified
  // student has that value yet. Dedupe + sort.
  const yearOptions   = useMemo(() => {
    const fromData = rows.map(r => r.graduationPassingYear).filter(v => v !== '—');
    return [...new Set([...YEAR_OPTIONS.map(String), ...fromData.map(String)])]
      .map(Number).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  }, [rows]);
  const streamOptions = useMemo(() => {
    const fromData = rows.map(r => r.stream).filter(v => v !== '—');
    return [...new Set([...STREAM_OPTIONS, ...fromData])].sort();
  }, [rows]);
  const sectionOptions = useMemo(() => {
    const fromData = rows.map(r => r.section).filter(v => v !== '—');
    return [...new Set([...SECTION_OPTIONS, ...fromData])].sort();
  }, [rows]);

  // Filter by search + dropdown filters (Grad. Year, Stream, Section)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      // Dropdown filters
      if (yearFilter   !== 'all' && String(r.graduationPassingYear) !== String(yearFilter))   return false;
      if (streamFilter !== 'all' && r.stream   !== streamFilter) return false;
      if (sectionFilter !== 'all' && r.section !== sectionFilter) return false;
      if (statusFilter !== 'all' && r.placementStatus !== statusFilter) return false;
      // Search filter (free text)
      if (q) {
        const match =
          r.rollNumber.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.collegeId.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.stream.toLowerCase().includes(q) ||
          // "placed" / "trying" / "not trying" should all be findable by free text
          r.placementStatus.toLowerCase().replace('_', ' ').includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [rows, search, yearFilter, streamFilter, sectionFilter, statusFilter]);

  // Reset the Add Student modal back to a clean form state.
  // Called when the modal closes (X button, backdrop click, or after
  // the officer copies the temp password and dismisses the success card).
  const closeAddStudent = () => {
    setShowAddStudent(false);
    setAddForm({ name: '', email: '', password: '' });
    setAddShowPw(false);
    setAddError(null);
    setAddSuccess(null);
    setAddSubmitting(false);
    setCopied(false);
  };

  // Submit the Add Student form. We DON'T reset the form on success —
  // the success view takes over and shows the temp password, so the
  // officer can dismiss it and start a new entry with a clean slate.
  const submitAddStudent = async (e) => {
    e.preventDefault();
    setAddError(null);
    setAddSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/create-student`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: addForm.name.trim(),
          email: addForm.email.trim(),
          // Send the password only if the officer typed one (>=6 chars).
          // Empty string is sent as-is so the backend can fall through
          // to its temp-password generator.
          password: addForm.password || undefined
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create student');
      }
      // Show the success view with the temp password. Don't close the
      // modal — the officer needs to see/copy the password.
      setAddSuccess(data.data);
      // Refresh the table so the new student appears immediately.
      // We trigger a re-fetch by toggling showUnverified through a
      // microtask, but the simpler approach: re-use the same fetch
      // logic. Easiest is to call the load by setting a counter —
      // but since useEffect only depends on showUnverified, just
      // dispatch a one-off fetch and setStudents.
      const refresh = await fetch(
        `${API_URL}/api/students/all${showUnverified ? '?verified=false' : ''}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      const refreshData = await refresh.json();
      if (refreshData.success) setStudents(refreshData.data.students);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSubmitting(false);
    }
  };

  // Copy the temp password to clipboard. We use the modern Clipboard API
  // with a textarea fallback for older browsers / non-secure contexts.
  // The checkmark "Copied" feedback disappears after 2s.
  const copyPassword = async (pw) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pw);
      } else {
        const ta = document.createElement('textarea');
        ta.value = pw;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write can be blocked in iframes/non-secure contexts —
      // silent fail is fine, the officer can still read+type it.
    }
  };

  // Close the delete confirmation modal back to a clean state.
  // Called when the officer hits Cancel, the X, or the backdrop — but NOT
  // after a successful delete, because then we just dismiss the modal
  // entirely and the table refresh handles itself.
  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteError(null);
    setDeleteSubmitting(false);
  };

  // Actually delete the student. Backend cascades to their applications
  // and notifications, so this is a one-way trip — that's why we have the
  // confirmation modal in the first place. We re-fetch the list on success
  // (rather than splicing the local array) so the table re-decorates with
  // fresh placement data for everyone else too.
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/students/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete student');
      }
      // Re-fetch the full list. Same fetch logic as the load effect, just
      // inline so we don't have to refactor the effect into a callback.
      const refresh = await fetch(
        `${API_URL}/api/students/all${showUnverified ? '?verified=false' : ''}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      const refreshData = await refresh.json();
      if (refreshData.success) setStudents(refreshData.data.students);
      closeDelete();
    } catch (err) {
      setDeleteError(err.message);
      setDeleteSubmitting(false);
    }
  };

  // CSV export
  const exportCSV = () => {
    const headers = COLUMNS.map(c => c.label);
    const csv = [
      headers.join(','),
      ...filtered.map(r => COLUMNS.map(c => {
        const val = String(r[c.key] ?? '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-[1920px] mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition text-sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
                <Users className="w-6 h-6" /> All Students
              </h1>
              <p className="text-gray-500 text-sm">Verified student directory</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddStudent(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm"
            >
              <UserPlus className="w-4 h-4" /> Add Student
            </button>
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-4 py-6">
        {/* Toolbar — search (fills left space) | 3 filter dropdowns | clear | verified toggle | count */}
        <div className="card mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search bar — flex-1 to fill the available left space, min-w-0 so it
              can actually shrink if the right-side controls get wide. */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Right side: 3 filter dropdowns + clear-filters link (only when any
              filter is active) + verified toggle + count. ml-auto pushes the
              whole group to the right edge so the search bar fills the gap. */}
          <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
            {/* Filter dropdowns — each ~32-44ch wide, content-driven. Filter icon
                on the first one hints "these are filters". */}
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <select
                value={yearFilter}
                onChange={e => setYearFilter(e.target.value)}
                className="w-36 pl-7 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                aria-label="Filter by graduation year"
              >
                <option value="all">All Years</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <select
              value={streamFilter}
              onChange={e => setStreamFilter(e.target.value)}
              className="w-44 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
              aria-label="Filter by branch / stream"
            >
              <option value="all">All Branches</option>
              {streamOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={sectionFilter}
              onChange={e => setSectionFilter(e.target.value)}
              className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
              aria-label="Filter by section"
            >
              <option value="all">All Sections</option>
              {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="relative">
              <Briefcase className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-36 pl-7 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                aria-label="Filter by placement status"
              >
                <option value="all">All Statuses</option>
                <option value="placed">Placed</option>
                <option value="trying">Trying</option>
                <option value="not_trying">Not Trying</option>
              </select>
            </div>
            {(yearFilter !== 'all' || streamFilter !== 'all' || sectionFilter !== 'all' || statusFilter !== 'all' || search) && (
              <button
                type="button"
                onClick={() => { setYearFilter('all'); setStreamFilter('all'); setSectionFilter('all'); setStatusFilter('all'); setSearch(''); }}
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
              <span>Verified only</span>
              <button
                type="button"
                role="switch"
                aria-checked={!showUnverified}
                onClick={() => setShowUnverified(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${!showUnverified ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${!showUnverified ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </label>
            <div className="text-sm text-gray-500 whitespace-nowrap">
              Showing <span className="font-semibold text-gray-700">{filtered.length}</span> of <span className="font-semibold text-gray-700">{rows.length}</span>
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="card text-center py-16">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-500 mt-3 text-sm">Loading students...</p>
          </div>
        ) : error ? (
          <div className="card text-center py-12">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">Failed to load students</p>
            <p className="text-gray-500 text-sm mt-1">{error}</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                {/* 15 columns with relative widths summing to 100%.
                    Text columns (wrap:true) get more room for emails/streams,
                    numeric/badge columns stay tight. */}
                <col style={{ width: '8%'  }} /> {/* Roll No */}
                <col style={{ width: '11%' }} /> {/* Name */}
                <col style={{ width: '7%'  }} /> {/* College ID */}
                <col style={{ width: '7%'  }} /> {/* DOB */}
                <col style={{ width: '5%'  }} /> {/* Gender */}
                <col style={{ width: '8%'  }} /> {/* Phone */}
                <col style={{ width: '15%' }} /> {/* Email */}
                <col style={{ width: '6%'  }} /> {/* Grad. Year */}
                <col style={{ width: '6%'  }} /> {/* Stream */}
                <col style={{ width: '5%'  }} /> {/* Section */}
                <col style={{ width: '5%'  }} /> {/* CGPA */}
                <col style={{ width: '4%'  }} /> {/* 10th % */}
                <col style={{ width: '4%'  }} /> {/* 12th % */}
                <col style={{ width: '4%'  }} /> {/* Verified */}
                <col style={{ width: '5%' }} /> {/* Status */}
                <col style={{ width: '4%' }} /> {/* Actions (delete) */}
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="divide-x divide-gray-200">
                  {COLUMNS.map(c => (
                    <th
                      key={c.key}
                      className={`px-3 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-gray-500">
                      {search ? `No students match "${search}"` : 'No students found'}
                    </td>
                  </tr>
                ) : filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-blue-50/40 transition-colors divide-x divide-gray-200"
                  >
                    {COLUMNS.map(c => {
                      let content;
                      if (c.key === 'verified') content = <VerifiedBadge value={r.verified} />;
                      else if (c.key === 'placementStatus') content = <PlacementBadge status={r.placementStatus} total={r.placementTotal} />;
                      else if (c.key === 'actions') content = (
                        // Per-row delete button. The aria-label is the
                        // selector the header-level "Delete Student"
                        // button uses to focus the first row. We render
                        // just an icon (no text) to keep the column
                        // narrow; the tooltip explains the action.
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
                          aria-label={`Delete student ${r.name}`}
                          title={`Delete ${r.name}`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      );
                      else content = r[c.key];

                      // Wrap long text (emails, streams, names) but keep
                      // numbers and badges on one line so columns line up.
                      const wrapClass = c.wrap ? 'whitespace-normal break-words' : 'whitespace-nowrap';

                      return (
                        <td
                          key={c.key}
                          className={`px-3 py-3 align-top ${wrapClass} ${c.className || ''} ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}
                          title={typeof content === 'string' ? content : undefined}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============================================================ */}
        {/* Add Student modal — opens from the green button in the header. */}
        {/* Two views: form (default) and success (after API 201).       */}
        {/* Backdrop click + Escape key both close it.                   */}
        {/* ============================================================ */}
        {showAddStudent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-[fadeIn_150ms_ease-out]"
            onClick={closeAddStudent}
            onKeyDown={(e) => { if (e.key === 'Escape') closeAddStudent(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-student-title"
          >
            <div
              // Stop propagation so clicks inside the card don't close it.
              // max-w-md is plenty for 3 fields; the success view is also
              // narrow so the password gets the visual weight.
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-[slideUp_200ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              {!addSuccess ? (
                // ----- FORM VIEW -----
                <form onSubmit={submitAddStudent}>
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <h2 id="add-student-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-green-600" />
                      Add Student
                    </h2>
                    <button
                      type="button"
                      onClick={closeAddStudent}
                      className="text-gray-400 hover:text-gray-600 transition"
                      aria-label="Close"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    <p className="text-xs text-gray-500 -mt-1">
                      Create a student account without Firebase. The student will log in with the
                      password you set (or one we'll generate), then complete their own profile.
                    </p>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={addForm.name}
                        onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Souvagyo Mallick"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={addForm.email}
                        onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="student@college.edu"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password <span className="text-gray-400 text-xs font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <input
                          // type toggles between 'password' and 'text' via the
                          // eye icon — officer needs to confirm what they
                          // typed so they can communicate it to the student.
                          type={addShowPw ? 'text' : 'password'}
                          value={addForm.password}
                          onChange={(e) => setAddForm(f => ({ ...f, password: e.target.value }))}
                          placeholder="Leave blank to auto-generate"
                          className="w-full pl-3 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setAddShowPw(s => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          aria-label={addShowPw ? 'Hide password' : 'Show password'}
                        >
                          {addShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        If blank, an 8-character temp password is generated and shown to you once.
                      </p>
                    </div>

                    {addError && (
                      <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {addError}
                      </div>
                    )}
                  </div>

                  <div className="px-6 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeAddStudent}
                      disabled={addSubmitting}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addSubmitting || !addForm.name.trim() || !addForm.email.trim()}
                      className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {addSubmitting ? 'Creating…' : 'Create account'}
                    </button>
                  </div>
                </form>
              ) : (
                // ----- SUCCESS VIEW -----
                // Shown only after a 201. The temp password is displayed
                // EXACTLY ONCE here — the officer must copy it now or
                // send it to the student via their own channel. Backend
                // will clear the temp password on the student's first
                // /change-password call.
                <div>
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100">
                        <Check className="w-4 h-4 text-green-600" />
                      </span>
                      Student created
                    </h2>
                    <button
                      type="button"
                      onClick={closeAddStudent}
                      className="text-gray-400 hover:text-gray-600 transition"
                      aria-label="Close"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Name</div>
                      <div className="text-sm font-medium text-gray-900">{addSuccess.student.name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Email</div>
                      <div className="text-sm font-mono text-gray-900">{addSuccess.student.email}</div>
                    </div>

                    <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-amber-800">
                          Temporary password
                        </span>
                        <span className="text-xs text-amber-700">
                          {addSuccess.passwordWasGenerated
                            ? 'auto-generated'
                            : 'officer-supplied'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded font-mono text-sm text-gray-900 select-all break-all">
                          {addSuccess.temporaryPassword}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyPassword(addSuccess.temporaryPassword)}
                          className="flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition text-sm"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" /> Copy
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-amber-700 mt-2">
                        Share this with the student. They'll be required to set a new
                        password on first login. This password is shown only once.
                      </p>
                    </div>
                  </div>

                  <div className="px-6 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Reset to form view (success is cleared) so the
                        // officer can add another student. Don't close
                        // the modal — they may want to add several in
                        // a row without reopening.
                        setAddSuccess(null);
                        setAddForm({ name: '', email: '', password: '' });
                        setAddShowPw(false);
                        setCopied(false);
                      }}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    >
                      Add another
                    </button>
                    <button
                      type="button"
                      onClick={closeAddStudent}
                      className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* Delete Student — header-level picker.                          */}
        {/* This is the modal that opens when the officer clicks the red    */}
        {/* "Delete Student" button in the page header. It lets them find   */}
        {/* a student by name/roll/email (from the *raw* students array,    */}
        {/* not the filtered one) and pick them. Picking a student then     */}
        {/* transitions us to the same confirm modal the per-row trash     */}
        {/* icon uses — set deleteTarget + close this picker.               */}
        {/*                                                               */}
        {/* We do NOT do a second confirm here — the search-and-pick       */}
        {/* motion IS the friction we want, and an extra click to confirm  */}
        {/* the pick would just feel bureaucratic.                         */}
        {/* ============================================================ */}
        {deletePickerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-[fadeIn_150ms_ease-out]"
            onClick={closePicker}
            role="dialog"
            aria-modal="true"
            aria-label="Pick a student to delete"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Delete a student</h2>
                </div>
                <button
                  type="button"
                  onClick={closePicker}
                  className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  aria-label="Close"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 pt-4">
                <p className="text-sm text-gray-500">
                  Search by name, roll number, or email. Pick the student you want to delete —
                  you'll get one last chance to confirm.
                </p>
                <div className="mt-3 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    type="text"
                    value={deletePickerQuery}
                    onChange={(e) => setDeletePickerQuery(e.target.value)}
                    placeholder="Type a name, roll, or email…"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
                  />
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto px-3 py-2">
                {deletePickerMatches.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No students match your search.</p>
                ) : (
                  deletePickerMatches.map((s) => (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => pickFromHeader(s)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 transition flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{s.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {s.rollNumber || '—'} · {s.email}
                        </div>
                      </div>
                      <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                    </button>
                  ))
                )}
              </div>

              <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Showing {deletePickerMatches.length} of {students.length} students
                </span>
                <button
                  type="button"
                  onClick={closePicker}
                  className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* Delete Student confirmation modal.                            */}
        {/* Triggered from the per-row trash icon. We deliberately do     */}
        {/* NOT show a name-their-password "are you sure" prompt — the    */}
        {/* user already clicked a red trash button next to a specific    */}
        {/* student row, which is the primary consent signal. We just     */}
        {/* restate who they're about to delete (name + roll + email)    */}
        {/* and warn that the action is irreversible, then ask for a      */}
        {/* final click.                                                  */}
        {/* ============================================================ */}
        {deleteTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-[fadeIn_150ms_ease-out]"
            onClick={closeDelete}
            onKeyDown={(e) => { if (e.key === 'Escape') closeDelete(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-student-title"
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-[slideUp_200ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 id="delete-student-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </span>
                  Delete student?
                </h2>
                <button
                  type="button"
                  onClick={closeDelete}
                  className="text-gray-400 hover:text-gray-600 transition"
                  aria-label="Close"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <p className="text-sm text-gray-700">
                  You're about to permanently delete this student account and
                  all of their placement applications. This cannot be undone.
                </p>

                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Name</span>
                    <span className="font-medium text-gray-900">{deleteTarget.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Roll No</span>
                    <span className="font-mono text-gray-900">{deleteTarget.rollNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Email</span>
                    <span className="font-mono text-gray-900 truncate ml-2" title={deleteTarget.email}>
                      {deleteTarget.email}
                    </span>
                  </div>
                  {deleteTarget.placementTotal > 0 && (
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-200 mt-2">
                      <span className="text-gray-500">Applications on file</span>
                      <span className="font-medium text-red-600">
                        {deleteTarget.placementTotal} will be deleted
                      </span>
                    </div>
                  )}
                </div>

                {deleteError && (
                  <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {deleteError}
                  </div>
                )}
              </div>

              <div className="px-6 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDelete}
                  disabled={deleteSubmitting}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleteSubmitting}
                  className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleteSubmitting ? 'Deleting…' : 'Delete student'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
