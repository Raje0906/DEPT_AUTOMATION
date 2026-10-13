/**
 * Exact, authoritative questions extracted from the official TE Mid-Sem Feedback form.
 *
 * CRITICAL DATA SEPARATION RULE:
 * This file contains ONLY static question text, numbering, rating labels, and feedback structure.
 * It contains NO subject names, faculty names, or allocations.
 * Those are dynamically resolved from the HOD Course Allocation Matrix (faculty_subject_map).
 */

const THEORY_QUESTIONS = [
  {
    id: 1,
    number: 1,
    text: '1. Lectures were conducted on time and in time uniformly during the term ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
  {
    id: 2,
    number: 2,
    text: '2. Presentation, speed and confidence in delivery of lectures ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
  {
    id: 3,
    number: 3,
    text: '3.Lectures started with review of last and ended with summary of present ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
  {
    id: 4,
    number: 4,
    text: '4. Clarity in technical concepts, ideas and relevant examples during lectures ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
  {
    id: 5,
    number: 5,
    text: '5. Percentage of university syllabus was covered in the class and in other forms (e.g 80% syllabus - Grade 8) ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
  {
    id: 6,
    number: 6,
    text: '6. Faculty was available to solve difficulties, motivated to learn the engineering concepts ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
  {
    id: 7,
    number: 7,
    text: '7. Do you understand the lectures delivered by the teacher ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
];

const PRACTICAL_QUESTIONS = [
  {
    id: 1,
    number: 1,
    text: '1. Display of list of experiments ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
  {
    id: 2,
    number: 2,
    text: '2. Equipment and support facilities ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
  {
    id: 3,
    number: 3,
    text: '3. Assessment of the experiments performed & journals checked on time ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
  {
    id: 4,
    number: 4,
    text: '4. Support during the lab session ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
  {
    id: 5,
    number: 5,
    text: '5. Additional technical content beyond syllabus covered during the practical session ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
  {
    id: 6,
    number: 6,
    text: '6. Were lab manuals self-explanatory ?',
    minRating: 1,
    maxRating: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
  },
];

module.exports = {
  THEORY_QUESTIONS,
  PRACTICAL_QUESTIONS,
};
