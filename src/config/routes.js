/**
 * Shared routing constants.
 *
 * Its own module so the login screen and the route guards can agree on where an
 * authenticated user belongs without importing each other — App renders Login,
 * so the reverse import would close a cycle.
 */

/** Where an authenticated user goes when nothing better is known. */
export const DEFAULT_AUTHENTICATED_ROUTE = '/dashboard';

/**
 * Resolve where to send someone who has just authenticated.
 *
 * @param {string|undefined} from  the path recorded when they were bounced to
 *                                 /login, if any
 * @returns {string} the path to navigate to
 */
export const resolvePostLoginRoute = (from) =>
  from && from !== '/login' ? from : DEFAULT_AUTHENTICATED_ROUTE;
