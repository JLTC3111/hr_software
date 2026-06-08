export const TIME_CLOCK_REVIEW_PENDING_PATH = '/time-clock?review=pending';

/** Normalize legacy Review Now links to the pending-approval deep link */
export const resolveNotificationActionUrl = (notification) => {
  const url = notification?.action_url;
  const isPendingReview =
    notification?.action_label === 'Review Now' ||
    notification?.title === 'Pending Approvals';

  if (isPendingReview || url === '/time-clock') {
    return TIME_CLOCK_REVIEW_PENDING_PATH;
  }

  return url;
};
