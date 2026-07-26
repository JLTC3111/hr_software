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

export const mergeReviewRatingsIntoSkills = (skills, review, employeeId) =>
  PERFORMANCE_SKILLS.map(definition => {
    const existingSkill = skills.find(skill => skill.skill_name === definition.skillName);
    const reviewRating = review?.[definition.reviewColumn];

    return {
      ...existingSkill,
      id: existingSkill?.id || `assessment-${definition.key}-${employeeId}`,
      employee_id: employeeId,
      skill_name: definition.skillName,
      skill_category: definition.category,
      rating: reviewRating == null ? Number(existingSkill?.rating || 0) : Number(reviewRating),
      proficiency_level: existingSkill?.proficiency_level || null
    };
  });

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
