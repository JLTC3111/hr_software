import { createContext, useContext } from 'react';

export const PunchSessionContext = createContext(null);
export function usePunchSession() {
  const value = useContext(PunchSessionContext);
  if (!value) throw new Error('usePunchSession must be used within PunchSessionProvider');
  return value;
}
