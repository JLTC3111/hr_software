import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPerformanceAssessment,
  mergeReviewRatingsIntoSkills
} from '../src/utils/performanceAssessment.js';

test('self ratings are kept, and the period review only fills skills never self-rated', () => {
  const skills = [
    { id: 1, skill_name: 'Technical Skills', rating: 5 },
    { id: 2, skill_name: 'Communication', rating: 4 }
  ];
  const review = {
    technical_skills_rating: 3.5,
    communication_rating: 0,
    leadership_rating: 4,
    teamwork_rating: 4.5,
    problem_solving_rating: 3
  };

  const merged = mergeReviewRatingsIntoSkills(skills, review, 'employee-1');

  // Technical/Communication keep the self-rating; the three unrated skills fall
  // back to the reviewer's number rather than showing as zero.
  assert.deepEqual(merged.map(skill => skill.rating), [5, 4, 4, 4.5, 3]);
  // The reviewer's number stays addressable on every skill, including where it
  // lost to a self-rating and where the reviewer entered a literal 0.
  assert.deepEqual(merged.map(skill => skill.managerRating), [3.5, 0, 4, 4.5, 3]);
  assert.equal(merged[0].id, 1);
  assert.equal(merged[2].employee_id, 'employee-1');
});

test('managerRating is null, not zero, when the period has no review row', () => {
  const merged = mergeReviewRatingsIntoSkills(
    [{ skill_name: 'Teamwork', rating: 4 }],
    null,
    'employee-3'
  );

  assert.deepEqual(merged.map(skill => skill.managerRating), [null, null, null, null, null]);
  assert.deepEqual(merged.map(skill => skill.rating), [0, 0, 0, 4, 0]);
});

test('a new period falls back to existing assessments and fills missing skills', () => {
  const merged = mergeReviewRatingsIntoSkills(
    [{ skill_name: 'Communication', rating: '4.5' }],
    null,
    'employee-2'
  );

  assert.deepEqual(merged.map(skill => skill.rating), [0, 4.5, 0, 0, 0]);
  assert.equal(merged.length, 5);
});

test('overall performance averages assessed ratings and ignores unrated zero values', () => {
  const assessment = buildPerformanceAssessment([
    { skill_name: 'Technical Skills', rating: 4 },
    { skill_name: 'Communication', rating: 5 },
    { skill_name: 'Leadership', rating: 0 },
    { skill_name: 'Teamwork', rating: 3.5 },
    { skill_name: 'Problem Solving', rating: 0 }
  ]);

  assert.equal(assessment.overallRating, 4.2);
  assert.deepEqual(assessment.ratings, {
    technicalSkillsRating: 4,
    communicationRating: 5,
    leadershipRating: 0,
    teamworkRating: 3.5,
    problemSolvingRating: 0
  });
});
