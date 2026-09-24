import { create } from 'zustand';
import { api } from '../../infra/http';
import { NewUserRequest, TUser, TUseUsers, UpdateUserRequest } from './useUsers.type';

export const useUsers = create<TUseUsers>((set, get) => ({
  users: [],
  user: undefined,

  resetUser: () => {
    set({
      user: undefined
    })
  },

  saveUser: async (user: NewUserRequest) => {
    const { fetchUsers, resetUser } = get()
    await api.post(`/users`, user)
    resetUser()
    await fetchUsers()
  },

  editUser: async (id: string, user: UpdateUserRequest) => {
    const { fetchUsers, resetUser } = get()
    await api.put(`/users/${id}`, user)
    resetUser()
    await fetchUsers()
  },

  deleteUser: async (id: string) => {
    const { fetchUsers, resetUser } = get()
    await api.delete(`/users/${id}`)
    resetUser()
    await fetchUsers()
  },

  fetchUser: async id => {
    const user = (await api.get<TUser>(`/users/${id}`)).data
    set({ user: user });
  },

  fetchUsers: async () => {
    const users = (await api.get<TUser[]>(`/users`)).data;
    set({ users: users });
  },
}));
