import { create } from 'zustand';
import { api } from '../../infra/http';
import { TUseTokens, TToken } from './useTokens.type';

export const useTokens = create<TUseTokens>((set, get) => ({

  token: undefined,
  tokens: [],

  fetchTokens: async () => {
    const tokens = (await api.get<TToken[]>(`/tokens`)).data
    set({ tokens });
  },

  fetchToken: async (id) => {
    const token = (await api.get<TToken>(`/tokens/${id}`)).data
    set({ token });
  },

  resetToken: () => {
    set({
      token: undefined
    })
  },

  newToken: async (r: { roles: string[], custom: {} }) => {
    const token = (await api.post<{ roles: string[], custom: {} }, TToken>(`/tokens`, r)).data
    set((state) => ({ tokens: [token, ...state.tokens] }))
  },

  updateToken: async (id, r: { roles: string[], custom: {} }) => {
    const { fetchTokens } = get()
    await api.put<{ roles: string[], custom: {} }, TToken>(`/tokens/${id}`, r)
    fetchTokens()
  },

  updateSecret: async (id: string) => {
    const token = (await api.put<void, TToken>(`/tokens/${id}/new-secret`, undefined)).data
    const { tokens } = get()
    set({ tokens: tokens.map((t) => t.id === id ? { ...t, secret: token.secret } : t) })
  },

  deleteToken: async (id: string) => {
    const { fetchTokens } = get()
    await api.delete(`/tokens/${id}`)
    fetchTokens()
  }

}));


