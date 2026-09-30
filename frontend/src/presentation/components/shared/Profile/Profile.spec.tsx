import React from 'react';
import { render, screen } from '@testing-library/react';
import { Profile } from './Profile';

vi.mock('../../../../stores', () => ({
  useProfile: vi.fn().mockReturnValue({
    profile: {
      name: 'Test Name',
      roles: ['VENDOR'],
    },
    fetchProfile: vi.fn(),
  })
}));

describe('Profile Test', () => {
  it('Should render name and usename', () => {
    render(<Profile />);

    expect(screen.getByTestId(`profile_name`)).toBeInTheDocument();
    expect(screen.getByTestId(`profile_username`)).toBeInTheDocument();
  });
});
