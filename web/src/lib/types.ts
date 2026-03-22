export interface User {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  role: 'admin' | 'agent';
  isActive: boolean;
  createdAt: string;
}
