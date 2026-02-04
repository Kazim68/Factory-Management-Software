// LocalStorage wrapper for data persistence
// This will be replaced with Supabase later

const STORAGE_KEYS = {
  PARTIES: 'factory_parties',
  ARTICLES: 'factory_articles',
  LABOR_CATEGORIES: 'factory_labor_categories',
  LABORS: 'factory_labors',
  LABOR_WORK: 'factory_labor_work',
  LABOR_KHARCHA: 'factory_labor_kharcha',
  CHEMICALS: 'factory_chemicals',
  REXINE: 'factory_rexine',
  MATERIALS: 'factory_materials',
  BILLS: 'factory_bills',
  PARTY_LEDGER: 'factory_party_ledger',
  ROZNAMCHA: 'factory_roznamcha',
  EXPENSE_CATEGORIES: 'factory_expense_categories',
  PAYMENTS: 'factory_payments',
};

export const storage = {
  get<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return [];
    }
  },

  set<T>(key: string, value: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },

  add<T extends { id: string }>(key: string, item: T): void {
    const items = this.get<T>(key);
    items.push(item);
    this.set(key, items);
  },

  update<T extends { id: string }>(key: string, id: string, updatedItem: T): void {
    const items = this.get<T>(key);
    const index = items.findIndex((item) => item.id === id);
    if (index !== -1) {
      items[index] = updatedItem;
      this.set(key, items);
    }
  },

  delete<T extends { id: string }>(key: string, id: string): void {
    const items = this.get<T>(key);
    const filtered = items.filter((item) => item.id !== id);
    this.set(key, filtered);
  },
};

export { STORAGE_KEYS };
