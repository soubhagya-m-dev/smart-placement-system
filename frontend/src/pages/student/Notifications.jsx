import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { Bell, CheckCircle, XCircle, Clock, ExternalLink, ChevronLeft, CheckCheck, AlertCircle } from 'lucide-react';

export default function Notifications() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNewFlag, fetchNotifications } = useSocket();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    setLoading(false);
  }, []);

  // Visual styling helpers. The notification document we get from the
  // backend can carry two different `type` values:
  //   - "kind" payload on the notification record (interview, exam, etc.)
  //   - the kind marker we stash under metadata.additionalData.kind
  //     (e.g. "deadline_reminder" — set by services/deadlineReminders.js)
  // The reminder path takes priority over the kind, since it needs a
  // distinct yellow/amber "act now" look instead of the default blue bell.
  const isReminder = (notif) => notif?.metadata?.additionalData?.kind === 'deadline_reminder';

  const getIcon = (notif) => {
    if (isReminder(notif)) return <AlertCircle className="w-5 h-5 text-amber-500" />;
    const t = notif?.type;
    switch (t) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />;
      case 'warning': return <Clock className="w-5 h-5 text-yellow-500" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = (notif) => {
    if (isReminder(notif)) return 'bg-amber-50 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700';
    const t = notif?.type;
    switch (t) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'error': return 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {/* "Mark all as read" — only shown when there's at least one unread item.
              Disabled during the in-flight request to prevent double-fires. */}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-lg transition-colors"
              title="Mark all notifications as read"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card h-24 animate-pulse bg-gray-100 dark:bg-gray-700" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">No notifications yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">You'll see updates about your applications here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notif => (
              <div
                key={notif._id}
                onClick={() => !notif.read && markAsRead(notif._id)}
                onAnimationEnd={(e) => {
                  // Clear the "just arrived" flag as soon as the slide-in
                  // animation finishes so subsequent re-renders (e.g. when
                  // the user marks one as read) don't replay the animation.
                  // We listen on the slide-in animation specifically and
                  // ignore the highlight animation's end to avoid double
                  // work.
                  if (notif.__isNew && e.animationName === 'notifSlideIn') {
                    clearNewFlag(notif._id);
                  }
                }}
                className={`card border cursor-pointer transition-all hover:shadow-md ${
                  getBgColor(notif)
                } ${!notif.read ? 'ring-2 ring-blue-200' : 'opacity-75'} ${
                  notif.__isNew ? 'animate-notifSlideIn animate-notifHighlight' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getIcon(notif)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">{notif.title}</h4>
                      {!notif.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 dark:bg-blue-400" />
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">{notif.message}</p>
                    {notif.link && (
                      <a
                        href={notif.link}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm mt-2 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(notif.link);
                        }}
                      >
                        <ExternalLink className="w-3 h-3" /> View details
                      </a>
                    )}
                    {/* "View job" button — shown on notifications that reference
                        a specific job (e.g. interview scheduled, shortlist,
                        offer letter). Sends the user to the Applications page
                        filtered to that job so they can see the full application
                        context at the "All" tab. */}
                    {notif.job && (notif.job._id || notif.job) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const jobId = notif.job._id || notif.job;
                          navigate(`/applications?job=${jobId}`);
                        }}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm mt-2 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View job
                      </button>
                    )}
                    {/* "View Details" button — shown only on deadline reminders
                        (notifications with metadata.additionalData.kind ===
                        'deadline_reminder'). Sends the user to the **job details
                        page** so they can actually apply, since the reminder
                        fires for jobs they saved but haven't applied to yet.
                        The "View job" button above targets the Applications
                        page, which is the wrong destination for a not-yet-
                        applied reminder. */}
                    {isReminder(notif) && (notif.job?._id || notif.job) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!notif.read) markAsRead(notif._id);
                          const jobId = notif.job._id || notif.job;
                          navigate(`/jobs/${jobId}`);
                        }}
                        className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 text-sm mt-2 hover:text-amber-900 dark:hover:text-amber-300 hover:underline font-semibold"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Details
                      </button>
                    )}
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                      {new Date(notif.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}