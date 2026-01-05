/**
 * Task Management Component
 */

import { useState, useEffect } from 'react';
import { 
  CheckSquare, Plus, Edit2, Trash2, Clock, AlertTriangle, 
  X, Check, User, Calendar, Flag
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';
import type { Task, TaskCreate, TaskUpdate, TaskStatus, TaskPriority, User as UserType } from '../types/auth';

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

export default function TaskManagement() {
  const { token, user, hasPermission } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'all' | 'mine' | 'created'>('mine');
  
  const [formData, setFormData] = useState<TaskCreate & TaskUpdate>({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    assignee_id: undefined,
  });

  const canCreateTasks = hasPermission('can_create_tasks');
  const canAssignTasks = hasPermission('can_assign_tasks');

  // Fetch tasks
  const fetchTasks = async () => {
    if (!token) return;
    
    try {
      let url = `${config.apiUrl}/api/tasks/`;
      if (viewMode === 'mine') {
        url = `${config.apiUrl}/api/tasks/mine`;
      } else if (viewMode === 'created') {
        url = `${config.apiUrl}/api/tasks/created`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch users for assignment
  const fetchUsers = async () => {
    if (!token || !canAssignTasks) return;
    
    try {
      const response = await fetch(`${config.apiUrl}/api/auth/users`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, [token, viewMode]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingTask) {
        const response = await fetch(`${config.apiUrl}/api/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          fetchTasks();
          resetForm();
        }
      } else {
        const response = await fetch(`${config.apiUrl}/api/tasks/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          fetchTasks();
          resetForm();
        }
      }
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (taskId: number, status: TaskStatus) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/tasks/${taskId}/status/${status}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Handle task deletion
  const handleDelete = async (taskId: number) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        fetchTasks();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      due_date: '',
      assignee_id: undefined,
    });
    setEditingTask(null);
    setShowForm(false);
  };

  // Open edit form
  const openEditForm = (task: Task) => {
    setFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      assignee_id: task.assignee?.id,
      status: task.status,
    });
    setEditingTask(task);
    setShowForm(true);
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    return statusFilter === 'all' || task.status === statusFilter;
  });

  // Check if task is overdue
  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }
    return new Date(task.due_date) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Tasks</h2>
          <p className="text-white/70">Track and manage team assignments</p>
        </div>
        
        {canCreateTasks && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg"
          >
            <Plus className="h-5 w-5" />
            New Task
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('mine')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'mine' 
                ? 'bg-red-500 text-white' 
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            My Tasks
          </button>
          {canCreateTasks && (
            <button
              onClick={() => setViewMode('created')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'created' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              Created by Me
            </button>
          )}
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'all' 
                ? 'bg-red-500 text-white' 
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            All Tasks
          </button>
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {filteredTasks.map((task) => (
          <div
            key={task.id}
            className={`bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-4 ${
              isOverdue(task) ? 'border-l-4 border-l-red-500' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-white truncate">{task.title}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                  <span title={PRIORITY_LABELS[task.priority]}>
                    <Flag className={`h-4 w-4 ${PRIORITY_COLORS[task.priority]}`} />
                  </span>
                </div>
                
                {task.description && (
                  <p className="text-sm text-white/70 mb-3">{task.description}</p>
                )}
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
                  {task.assignee && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {task.assignee.first_name} {task.assignee.last_name}
                    </div>
                  )}
                  {task.due_date && (
                    <div className={`flex items-center gap-1 ${isOverdue(task) ? 'text-red-400' : ''}`}>
                      <Calendar className="h-4 w-4" />
                      {new Date(task.due_date).toLocaleDateString()}
                      {isOverdue(task) && <AlertTriangle className="h-4 w-4" />}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Created {new Date(task.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Quick status updates */}
                {task.status !== 'completed' && task.status !== 'cancelled' && (
                  (task.assignee?.id === user?.id || canAssignTasks) && (
                    <>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleStatusUpdate(task.id, 'in_progress')}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                          title="Start Task"
                        >
                          <Clock className="h-4 w-4" />
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusUpdate(task.id, 'completed')}
                          className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                          title="Complete Task"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )
                )}
                
                {canCreateTasks && (
                  <>
                    <button
                      onClick={() => openEditForm(task)}
                      className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    
                    {deleteConfirm === task.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(task.id)}
                        className="p-2 text-white/60 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {filteredTasks.length === 0 && (
          <div className="text-center py-12 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20">
            <CheckSquare className="h-12 w-12 mx-auto text-white/30 mb-4" />
            <p className="text-white/60">No tasks found</p>
          </div>
        )}
      </div>

      {/* Add/Edit Task Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={resetForm}></div>
            <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 w-full max-w-md border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingTask ? 'Edit Task' : 'New Task'}
                </h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.due_date || ''}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                {canAssignTasks && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Assign To
                    </label>
                    <select
                      value={formData.assignee_id || ''}
                      onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editingTask && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status || editingTask.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    {editingTask ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
