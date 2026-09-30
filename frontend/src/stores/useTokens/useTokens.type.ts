export type TToken = {
  id: string
  key: string
  roles: string[]
  secret: string
  custom?: any
  createdAt?: Date
};

export type TUseTokens = {
  token: TToken | undefined
  tokens: TToken[]
  fetchToken: (id: string) => Promise<void>
  fetchTokens: () => Promise<void>
  resetToken: () => void
  newToken: (r: { roles: string[], custom: {} }) => Promise<void>
  updateToken: (id: string, r: { roles: string[], custom: {} }) => Promise<void>
  updateSecret: (id: string) => Promise<void>
  deleteToken: (id: string) => Promise<void>
};
