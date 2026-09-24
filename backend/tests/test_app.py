import unittest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app import app, lifespan


class TestApp(unittest.TestCase):
    def setUp(self):
        """Set up test client for the app"""
        self.client = TestClient(app)
    
    def test_app_configuration(self):
        """Test that the app is configured correctly"""
        # Check if lifespan is configured (not direct comparison)
        self.assertIsNotNone(app.router.lifespan_context)
        
        # Check if middleware is registered
        self.assertTrue(len(app.user_middleware) > 0)
        
        # Check if health router is included
        routes = [route.path for route in app.routes]
        self.assertIn("/health", routes)
    
    @patch('app.set_local_variables')
    def test_lifespan(self, mock_set_local_variables):
        """Test lifespan functionality"""
        # Configure AsyncMock properly
        mock_awaitable = AsyncMock()
        mock_set_local_variables.return_value = mock_awaitable
        
        # The lifespan is tested indirectly by TestClient which calls it during startup
        with TestClient(app) as client:
            # Ensure set_local_variables was called during app startup
            mock_set_local_variables.assert_called_once()
    
    def test_health_endpoint(self):
        """Test that the health endpoint returns the expected response"""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), "OK")


if __name__ == "__main__":
    unittest.main()