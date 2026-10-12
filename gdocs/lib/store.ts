import { create } from "zustand";

export interface DocumentItem {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  ownerId: string;
  folderId: string | null;
  plainText: string | null;
  owner: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  collaborators?: Array<{
    id: string;
    userId: string;
    role: "VIEWER" | "COMMENTER" | "EDITOR" | "OWNER";
    user: {
      id: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
    };
  }>;
  folder?: {
    id: string;
    name: string;
  } | null;
}

export interface FolderItem {
  id: string;
  name: string;
  _count?: {
    documents: number;
  };
}

export interface InvitationItem {
  id: string;
  token: string;
  email: string;
  role: "VIEWER" | "COMMENTER" | "EDITOR";
  createdAt: string;
  document: {
    id: string;
    title: string;
    updatedAt: string;
  };
  inviter: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

interface AppState {
  documents: DocumentItem[];
  folders: FolderItem[];
  invitations: InvitationItem[];
  selectedFolderId: string | null;
  activeFilter: "all" | "owned" | "shared";
  searchQuery: string;
  sortBy: "updatedAt" | "title" | "createdAt";
  sortOrder: "asc" | "desc";
  isLoading: boolean;
  setDocuments: (docs: DocumentItem[]) => void;
  setFolders: (folders: FolderItem[]) => void;
  setInvitations: (invites: InvitationItem[]) => void;
  setSelectedFolderId: (folderId: string | null) => void;
  setActiveFilter: (filter: "all" | "owned" | "shared") => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: "updatedAt" | "title" | "createdAt") => void;
  setSortOrder: (order: "asc" | "desc") => void;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  documents: [],
  folders: [],
  invitations: [],
  selectedFolderId: null,
  activeFilter: "all",
  searchQuery: "",
  sortBy: "updatedAt",
  sortOrder: "desc",
  isLoading: false,
  setDocuments: (documents) => set({ documents }),
  setFolders: (folders) => set({ folders }),
  setInvitations: (invitations) => set({ invitations }),
  setSelectedFolderId: (selectedFolderId) => set({ selectedFolderId }),
  setActiveFilter: (activeFilter) => set({ activeFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setIsLoading: (isLoading) => set({ isLoading }),
}));
