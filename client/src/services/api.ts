// In production (Vercel), use relative paths. In development, use localhost
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
  synced?: number;
}

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('Making request to:', url); // Debug log
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async getItems() {
    return this.request('/items', { method: 'GET' });
  }

  async getItemsForSync(lastSync?: string) {
    const query = lastSync ? `?lastSync=${lastSync}` : '';
    return this.request(`/items/sync${query}`, { method: 'GET' });
  }

  async createItem(item: any) {
    return this.request('/items', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async syncItems(items: any[]) {
    return this.request('/items/sync', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async updateItem(id: string, updates: any) {
    return this.request(`/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteItem(id: string) {
    return this.request(`/items/${id}`, {
      method: 'DELETE',
    });
  }

  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const api = new ApiService();