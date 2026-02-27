import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '../lib/auth';
import type { AppUser, UserRole } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';

interface UserManagementProps {
  currentUserId: string;
}

const initialForm = {
  name: '',
  username: '',
  password: '',
  role: 'munshi' as UserRole,
};

export function UserManagement({ currentUserId }: UserManagementProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState(initialForm);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  const loadData = () => {
    setUsers(auth.listUsers());
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingUser(null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!form.name.trim() || !form.username.trim()) {
      toast.error('Name and username are required');
      return;
    }

    if (!editingUser && !form.password.trim()) {
      toast.error('Password is required for new users');
      return;
    }

    try {
      if (editingUser) {
        auth.updateUser(editingUser.id, {
          name: form.name.trim(),
          username: form.username.trim(),
          role: form.role,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        });
        toast.success('User updated successfully');
      } else {
        auth.createUser({
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password.trim(),
          role: form.role,
        });
        toast.success('User added successfully');
      }

      loadData();
      resetForm();
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save user');
    }
  };

  const startEdit = (user: AppUser) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      username: user.username,
      password: '',
      role: user.role,
    });
    setDialogOpen(true);
  };

  const handleDelete = (user: AppUser) => {
    if (user.id === currentUserId) {
      toast.error('You cannot delete your own account');
      return;
    }

    if (!confirm(`Delete user "${user.name}"?`)) return;

    try {
      auth.deleteUser(user.id);
      toast.success('User deleted successfully');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete user');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users & Roles</CardTitle>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, username: event.target.value }))
                    }
                    placeholder="Enter username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password {editingUser ? <span className="text-muted-foreground">(optional)</span> : ''}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, password: event.target.value }))
                    }
                    placeholder={editingUser ? 'Leave blank to keep existing' : 'Enter password'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(value: UserRole) => setForm((prev) => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="munshi">Munshi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  {editingUser ? 'Update User' : 'Create User'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      {user.name}
                    </TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => startEdit(user)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(user)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
