
export type Profile = {
  name: string;
  username: string;
  roles: string[];
};

export type TUseProfile = {
  profile: Profile | undefined;
  fetchProfile: () => Promise<void>;
  isAdmin: () => boolean,
  isContribuitor: () => boolean,
};
