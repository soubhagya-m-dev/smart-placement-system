import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, X, User, Mail, Phone, Hash, Book, Calendar, Code, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VerifyStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchStudents(); }, []);

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/officer/pending-verifications', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      if (data.success) setStudents(data.data.students);
    } catch (error) { console.error('Failed'); }
    finally { setLoading(false); }
  };

  const viewDetails = (student) => {
    setSelectedStudent(student);
    setShowModal(true);
  };

  const verify = async (id) => {
    try {
      const res = await fetch(`/api/students/${id}/verify`, { method: 'PATCH', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      if (data.success) {
        toast.success('Student verified!');
        fetchStudents();
      } else {
        toast.error(data.message || 'Failed to verify');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  const reject = async (id) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      const res = await fetch(`/api/students/${id}/reject`, { method: 'PATCH', headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
      const data = await res.json();
      if (data.success) {
        toast.success('Student rejected');
        fetchStudents();
      } else {
        toast.error(data.message || 'Failed to reject');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Verify Students</h1>
        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse"></div>)}</div>
        ) : students.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold">All verified!</h3>
            <p className="text-gray-500 text-sm mt-2">No pending students to verify</p>
          </div>
        ) : (
          <div className="space-y-4">{students.map(s => (
            <div key={s._id} className="card flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{s.name}</h3>
                <p className="text-gray-500 text-sm">{s.email}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => viewDetails(s)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2">
                  <Eye className="w-4 h-4" /> View Details
                </button>
                <button onClick={() => verify(s._id)} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Verify
                </button>
                <button onClick={() => reject(s._id)} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </div>
            </div>
          ))}</div>
        )}
      </div>

      {/* Student Details Modal */}
      {showModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-6 h-6" />
                <h2 className="text-xl font-bold">Student Details</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="hover:bg-white/20 p-2 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Basic Info Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" /> Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Full Name</p>
                      <p className="font-medium">{selectedStudent.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium">{selectedStudent.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Phone className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="font-medium">{selectedStudent.phone || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Account Status</p>
                      <p className="font-medium capitalize">{selectedStudent.status || 'pending'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Info Section */}
              {selectedStudent.studentProfile && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Book className="w-5 h-5 text-green-500" /> Academic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Hash className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Roll Number</p>
                        <p className="font-medium">{selectedStudent.studentProfile.rollNumber || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Hash className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Registration Number</p>
                        <p className="font-medium">{selectedStudent.studentProfile.registrationNumber || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Book className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Department</p>
                        <p className="font-medium">{selectedStudent.studentProfile.department || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Year</p>
                        <p className="font-medium">{selectedStudent.studentProfile.year || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">CGPA</p>
                        <p className="font-medium">{selectedStudent.studentProfile.cgpa || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Book className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">10th %</p>
                        <p className="font-medium">{selectedStudent.studentProfile.percentage10th || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Book className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">12th %</p>
                        <p className="font-medium">{selectedStudent.studentProfile.percentage12th || 'Not provided'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Profile Completion</p>
                        <p className="font-medium">{selectedStudent.studentProfile.isProfileComplete ? (
                          <span className="text-green-600">Complete</span>
                        ) : (
                          <span className="text-yellow-600">Incomplete</span>
                        )}</p>
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  {selectedStudent.studentProfile.skills && selectedStudent.studentProfile.skills.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Code className="w-4 h-4" /> Skills
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedStudent.studentProfile.skills.map((skill, idx) => (
                          <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bio */}
                  {selectedStudent.studentProfile.bio && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Bio
                      </h4>
                      <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedStudent.studentProfile.bio}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                  Close
                </button>
                <button onClick={() => { reject(selectedStudent._id); setShowModal(false); }} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
                <button onClick={() => { verify(selectedStudent._id); setShowModal(false); }} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Verify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}