import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTokens } from './useToken';
import { api } from '../../infra/http';

// Mock the HTTP client
vi.mock('../../infra/http', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('useTokens Store', () => {
  // Mock data for testing
  const mockTokens = [
    { 
      id: '1', 
      key: 'token-key-1', 
      secret: 'secret-1',
      roles: ['admin'],
      createdAt: '2023-01-01',
      custom: { catalogs: ['catalog1'] }
    },
    { 
      id: '2', 
      key: 'token-key-2', 
      secret: 'secret-2',
      roles: ['user'],
      createdAt: '2023-01-02',
      custom: { catalogs: ['catalog2'] }
    }
  ];
  
  const mockToken = mockTokens[0];
  
  // Reset the store and mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
    useTokens.setState({ token: undefined, tokens: [] });
  });
  
  describe('fetchTokens', () => {
    it('fetches all tokens and updates state', async () => {
      // Mock the API response
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockTokens });
      
      // Call the function
      await useTokens.getState().fetchTokens();
      
      // Verify API was called correctly
      expect(api.get).toHaveBeenCalledWith('/tokens');
      
      // Verify state was updated
      expect(useTokens.getState().tokens).toEqual(mockTokens);
    });
  });
  
  describe('fetchToken', () => {
    it('fetches a single token by ID and updates state', async () => {
      // Mock the API response
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockToken });
      
      // Call the function
      await useTokens.getState().fetchToken('1');
      
      // Verify API was called correctly
      expect(api.get).toHaveBeenCalledWith('/tokens/1');
      
      // Verify state was updated
      expect(useTokens.getState().token).toEqual(mockToken);
    });
  });
  
  describe('resetToken', () => {
    it('resets the token state to undefined', async () => {
      // Set initial state
      useTokens.setState({ token: mockToken });
      expect(useTokens.getState().token).toEqual(mockToken);
      
      // Call the function
      useTokens.getState().resetToken();
      
      // Verify state was reset
      expect(useTokens.getState().token).toBeUndefined();
    });
  });
  
  describe('newToken', () => {
    it('creates a new token and adds it to the tokens array', async () => {
      // Set initial state
      useTokens.setState({ tokens: [mockTokens[1]] });
      
      // Mock API response
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockToken });
      
      // Create token request
      const tokenRequest = {
        roles: ['admin'],
        custom: { catalogs: ['catalog1'] }
      };
      
      // Call the function
      await useTokens.getState().newToken(tokenRequest);
      
      // Verify API was called correctly
      expect(api.post).toHaveBeenCalledWith('/tokens', tokenRequest);
      
      // Verify state was updated - new token should be at the beginning
      expect(useTokens.getState().tokens).toEqual([mockToken, mockTokens[1]]);
    });
  });
  
  describe('updateToken', () => {
    it('updates a token and refreshes the tokens list', async () => {
      // Set up spies
      const fetchTokensSpy = vi.fn();
      useTokens.setState({ fetchTokens: fetchTokensSpy });
      
      // Mock API response
      vi.mocked(api.put).mockResolvedValueOnce({ data: mockToken });
      
      // Token update request
      const updateRequest = {
        roles: ['admin', 'editor'],
        custom: { catalogs: ['catalog1', 'catalog3'] }
      };
      
      // Call the function
      await useTokens.getState().updateToken('1', updateRequest);
      
      // Verify API was called correctly
      expect(api.put).toHaveBeenCalledWith('/tokens/1', updateRequest);
      
      // Verify fetchTokens was called to refresh the list
      expect(fetchTokensSpy).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('updateSecret', () => {
    it('updates a token secret and updates the token in the state', async () => {
      // Set initial state
      useTokens.setState({ tokens: mockTokens });
      
      // Mock API response - token with new secret
      const updatedToken = { ...mockToken, secret: 'new-secret' };
      vi.mocked(api.put).mockResolvedValueOnce({ data: updatedToken });
      
      // Call the function
      await useTokens.getState().updateSecret('1');
      
      // Verify API was called correctly
      expect(api.put).toHaveBeenCalledWith('/tokens/1/new-secret', undefined);
      
      // Verify state was updated - token with id 1 should have new secret
      const updatedTokens = useTokens.getState().tokens;
      expect(updatedTokens.find(t => t.id === '1')?.secret).toBe('new-secret');
      expect(updatedTokens.find(t => t.id === '2')?.secret).toBe('secret-2'); // Other token unchanged
    });
  });
  
  describe('deleteToken', () => {
    it('deletes a token and refreshes the tokens list', async () => {
      // Set up spies
      const fetchTokensSpy = vi.fn();
      useTokens.setState({ fetchTokens: fetchTokensSpy });
      
      // Mock API response
      vi.mocked(api.delete).mockResolvedValueOnce({});
      
      // Call the function
      await useTokens.getState().deleteToken('1');
      
      // Verify API was called correctly
      expect(api.delete).toHaveBeenCalledWith('/tokens/1');
      
      // Verify fetchTokens was called to refresh the list
      expect(fetchTokensSpy).toHaveBeenCalledTimes(1);
    });
  });
});
