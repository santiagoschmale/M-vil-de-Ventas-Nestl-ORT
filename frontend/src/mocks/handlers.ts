import profileMock from './profile/profile.mock';
import usersMock from './users/users.mock';
import tokensMock from './tokens/tokens.mock'

export const handlers = [
  ...profileMock,
  ...usersMock,
  ...tokensMock
];
