export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function createEditLog(user: string, field: string, oldValue: any, newValue: any) {
  return {
    timestamp: new Date().toISOString(),
    user,
    field,
    oldValue,
    newValue,
  };
}
