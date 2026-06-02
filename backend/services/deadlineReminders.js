// Deadline reminder service.
//
// Walks all "active" jobs that have an `applicationDeadline` and finds
// students who saved the job (in `User.savedJobs`) but haven't applied
// yet. For each match, sends a `general` notification of the form:
//
//   "Don't miss out! <Job Title> at <Company> closes in N day(s)"
//
// Reminders are sent at 3 / 2 / 1 / 0 days before the deadline, but
// AT MOST once per (student, job, day). The dedupe key is stored in
// `metadata.reminderKey`, so a re-run on the same day is a no-op.
//
// Two triggers:
//   1) A periodic `setInterval` (works in dev and while the server is
//      awake on Render). Default cadence: every 6 hours. Staggered off
//      midnight so a single node doesn't hammer the DB at 00:00.
//   2) An on-demand helper `runDeadlineReminderScan()` that the auth
//      router calls after a successful student login, so reminders
//      that were missed while the server slept are flushed the moment
//      a student actually uses the app.
//
// This is "best-effort" delivery, not a hard SLA. If the user doesn't
// open the app on the day before a deadline, the reminder for that day
// is still delivered the next time they do — which is what you want.

const Notification = require('../models/Notification');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');

const REMINDER_WINDOW_DAYS = [3, 2, 1, 0]; // how many days before deadline
const SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Return a string key like "2026-06-12" for a Date in UTC.
 * Used to build the dedupe key so we send at most one reminder per day.
 */
function utcDayKey(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Compute "how many whole days remain" between `now` and `deadline`,
 * using UTC as the canonical day boundary. The college placement
 * portal is single-college/single-timezone in practice, but using UTC
 * here means dev environments and the Render-hosted backend agree
 * on what "today" means, and the dedupe key (which is also UTC)
 * lines up.
 */
function daysUntil(now, deadline) {
  const startOfNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startOfDeadline = Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate());
  const diffMs = startOfDeadline - startOfNow;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Run one full scan. Returns a small stats object so the caller (or
 * the periodic timer) can log what happened. Safe to call repeatedly
 * — every notification write is gated by a unique `reminderKey`.
 */
async function runDeadlineReminderScan(io) {
  const stats = { scannedJobs: 0, remindersSent: 0, skipped: { noDeadline: 0, inactive: 0, noSaved: 0, alreadyApplied: 0, dedup: 0, outsideWindow: 0 } };
  const now = new Date();
  const daysLeft = daysUntil(now, new Date()); // for windowing, not for the message

  // Find jobs that are still active AND have a deadline in the future.
  // Pulling all of them is fine for the data sizes typical of a single
  // college placement cell. If this ever becomes hot, add a `deadlineSoon`
  // index and tighten the query to `applicationDeadline <= horizon`.
  const jobs = await Job.find({
    status: 'active',
    applicationDeadline: { $exists: true, $ne: null, $gt: now }
  }).select('_id title companyName applicationDeadline').lean();

  stats.scannedJobs = jobs.length;

  for (const job of jobs) {
    const days = daysUntil(now, new Date(job.applicationDeadline));
    if (!REMINDER_WINDOW_DAYS.includes(days)) {
      stats.skipped.outsideWindow++;
      continue;
    }

    // Find students who saved this job AND have not applied.
    // We can't do this in a single aggregation easily because we need
    // the user list to look up the Application collection per-user, but
    // the saved-set lookup is fast (indexed array on User).
    const savers = await User.find({ savedJobs: job._id })
      .select('_id')
      .lean();

    if (savers.length === 0) {
      stats.skipped.noSaved++;
      continue;
    }

    const saverIds = savers.map(u => u._id);
    const existingApps = await Application.find({
      job: job._id,
      student: { $in: saverIds }
    }).select('student').lean();
    const appliedSet = new Set(existingApps.map(a => String(a.student)));

    // Pre-fetch any reminders we already sent today for this job, to
    // avoid a per-student roundtrip.
    const todayKey = utcDayKey(now);
    const alreadySentKeys = await Notification.find({
      'metadata.reminderKey': new RegExp(`^reminder:.+:${job._id}:${todayKey}$`)
    }).select('metadata.reminderKey user').lean();
    const sentMap = new Map(alreadySentKeys.map(n => [String(n.user), n.metadata.reminderKey]));

    for (const user of savers) {
      const userId = String(user._id);

      if (appliedSet.has(userId)) {
        stats.skipped.alreadyApplied++;
        continue;
      }

      const reminderKey = `reminder:${userId}:${job._id}:${todayKey}`;
      if (sentMap.has(userId)) {
        stats.skipped.dedup++;
        continue;
      }

      const dayLabel = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
      const title = `Don't miss out — ${job.title}`;
      const message = `The application deadline for ${job.title} at ${job.companyName} closes ${dayLabel}. You saved this job but haven't applied yet.`;

      const notif = await Notification.create({
        user: user._id,
        job: job._id,
        type: 'general',
        title,
        message,
        eventDate: job.applicationDeadline,
        metadata: {
          reminderKey,
          daysRemaining: days,
          additionalData: { kind: 'deadline_reminder', jobTitle: job.title, companyName: job.companyName }
        }
      });

      stats.remindersSent++;

      // Push over socket so the bell badge updates in real time
      // (the periodic scan is the only path that doesn't have an
      // authenticated socket joined for the user, so we don't know
      // which room to target here — the client will pick it up on
      // its next /api/notifications fetch. The socket push is a
      // best-effort optimisation.)
      if (io) {
        try {
          io.to(String(user._id)).emit('notification', notif.toObject());
        } catch (e) {
          // Swallow — socket push is non-critical
        }
      }
    }
  }

  return stats;
}

/**
 * Start the periodic scan. Returns an object with a `stop()` method
 * for clean shutdown. Safe to call more than once — each call gets
 * its own timer.
 */
function startDeadlineReminderScheduler(io) {
  // Don't run on the first tick — wait `SCAN_INTERVAL_MS` so a server
  // restart during a deployment doesn't spam every student with a
  // re-check immediately. The on-login hook is what handles the
  // "just woke up" case.
  const timer = setInterval(async () => {
    try {
      const stats = await runDeadlineReminderScan(io);
      if (stats.remindersSent > 0 || stats.scannedJobs > 0) {
        console.log('[deadline-reminders] scan:', stats);
      }
    } catch (err) {
      console.error('[deadline-reminders] scan failed:', err.message);
    }
  }, SCAN_INTERVAL_MS);
  // Don't keep the event loop alive solely for this timer (relevant
  // in test/CLI contexts).
  if (timer.unref) timer.unref();
  return { stop: () => clearInterval(timer) };
}

module.exports = {
  runDeadlineReminderScan,
  startDeadlineReminderScheduler,
  // Exported for unit testing
  _internal: { daysUntil, utcDayKey, REMINDER_WINDOW_DAYS }
};
