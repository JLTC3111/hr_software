export const PERFORMANCE_SKILLS = [
  {
    key: 'technicalSkills',
    category: 'technical',
    skillName: 'Technical Skills',
    reviewColumn: 'technical_skills_rating',
    serviceField: 'technicalSkillsRating'
  },
  {
    key: 'communication',
    category: 'communication',
    skillName: 'Communication',
    reviewColumn: 'communication_rating',
    serviceField: 'communicationRating'
  },
  {
    key: 'leadership',
    category: 'leadership',
    skillName: 'Leadership',
    reviewColumn: 'leadership_rating',
    serviceField: 'leadershipRating'
  },
  {
    key: 'teamwork',
    category: 'teamwork',
    skillName: 'Teamwork',
    reviewColumn: 'teamwork_rating',
    serviceField: 'teamworkRating'
  },
  {
    key: 'problemSolving',
    category: 'problem_solving',
    skillName: 'Problem Solving',
    reviewColumn: 'problem_solving_rating',
    serviceField: 'problemSolvingRating'
  }
];

/**
 * One row per skill, carrying both sides of the assessment.
 *
 * The two ratings come from different tables and mean different things, so they
 * stay separate: `rating` is the employee's own from skills_assessments, and
 * `managerRating` is the reviewer's from the period's performance_reviews row.
 * Collapsing them would make a self-rating indistinguishable from a calibrated
 * one. An employee who has never self-rated starts from the manager's number
 * rather than from zero.
 */
export const mergeReviewRatingsIntoSkills = (skills, review, employeeId) =>
  PERFORMANCE_SKILLS.map(definition => {
    const existingSkill = skills.find(skill => skill.skill_name === definition.skillName);
    const reviewRating = review?.[definition.reviewColumn];
    const managerRating = reviewRating == null ? null : Number(reviewRating);
    const selfRating = Number(existingSkill?.rating || 0);

    return {
      ...existingSkill,
      id: existingSkill?.id || `assessment-${definition.key}-${employeeId}`,
      employee_id: employeeId,
      skill_name: definition.skillName,
      skill_category: definition.category,
      rating: selfRating || managerRating || 0,
      managerRating,
      proficiency_level: existingSkill?.proficiency_level || null
    };
  });

/** Middle value of a numeric list; null when there is nothing to rank. */
export const medianOf = (values = []) => {
  const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const buildPerformanceAssessment = (skills) => {
  const ratings = PERFORMANCE_SKILLS.reduce((result, definition) => {
    const skill = skills.find(item => item.skill_name === definition.skillName);
    result[definition.serviceField] = Number(skill?.rating || 0);
    return result;
  }, {});

  const assessedRatings = Object.values(ratings).filter(rating => rating > 0);
  const overallRating = assessedRatings.length
    ? Math.round((assessedRatings.reduce((sum, rating) => sum + rating, 0) / assessedRatings.length) * 10) / 10
    : 0;

  return { ratings, overallRating };
};
