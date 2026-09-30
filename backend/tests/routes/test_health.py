from fastapi.testclient import TestClient
import unittest
from src.routes.health import router
from fastapi import FastAPI

class TestHealthRoute(unittest.TestCase):
    def setUp(self):
        """Set up test application with the health router"""
        self.app = FastAPI()
        self.app.include_router(router)
        self.client = TestClient(self.app)
        
    def test_health_endpoint(self):
        """Test that the health endpoint returns the expected message"""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.text, '"OK"')

if __name__ == "__main__":
    unittest.main()