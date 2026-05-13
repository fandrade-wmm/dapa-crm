export interface User {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  role: 'admin' | 'agent';
  isActive: boolean;
  createdAt: string;
  workspaceId?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string | null;
  metaPhoneNumberId: string | null;
  metaWabaId: string | null;
  /** Access token is returned only for admins; never expose in client UI */
  metaAccessToken: string | null;
  createdAt: string;
  updatedAt: string;
}
