export type TUser = {
  id: string;
  username: string;
  roles: string[];
  custom?: any;
  lastLogin?: Date;
  createdAt?: Date;
};

export type NewUserRequest = {
  username: string;
  roles: string[];
  custom: any;
}

export type UpdateUserRequest = {
  roles: string[];
  status: string;
  custom: any;
};

export type TUseUsers = {
  user: TUser | undefined
  users: TUser[] | undefined
  resetUser: () => void
  deleteUser: (id: string) => Promise<void>
  saveUser: (user: NewUserRequest) => Promise<void>
  editUser: (id: string, user: UpdateUserRequest) => Promise<void>
  fetchUser: (id: string) => Promise<void>
  fetchUsers: () => Promise<void>
};
