import { create } from 'zustand';
import { api } from '../../infra/http';
import { Profile, TUseProfile } from './useProfile.type';

export const useProfile = create<TUseProfile>((set, get) => ({
  profile: undefined,

  fetchProfile: async () => {
    const profile = await api.get<Profile>(`/whoami`).then(response => response.data);
    set({ profile: profile });
  },

  isAdmin: () => {
    const { profile } = get()
    return profile?.roles.includes('sm-admin') || false
  },

  isContribuitor: () => {
    const { profile, isAdmin } = get()
    return isAdmin() || profile?.roles.includes('contributor') || false
  }

}));
