// Single source of truth for the values offered in the student profile
// form's Stream / Section / Graduation Passing Year dropdowns.
//
// Imported by:
//   - pages/student/Profile.jsx        (the form where students pick these)
//   - pages/officer/AllStudents.jsx    (the officer's filter dropdowns)
//
// Add / remove / rename a value here and BOTH places stay in sync.

export const STREAM_OPTIONS = [
  'CSE',
  'CSE (AI & ML)',
  'AUE',
  'Civil',
  'ECE',
  'EE',
  'ME',
  'Robotics',
];

export const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E'];

// Graduation passing year — fixed 2020..2040 range to match Profile.jsx.
export const YEAR_OPTIONS = Array.from({ length: 2040 - 2020 + 1 }, (_, i) => 2020 + i);
