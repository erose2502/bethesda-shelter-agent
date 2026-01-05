/**
 * Type definitions for the role-based authentication system
 */

export type UserRole = 'director' | 'life_coach' | 'supervisor';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
  expires_in: number;
}

export interface PermissionSet {
  // Bed management
  can_view_beds: boolean;
  can_assign_beds: boolean;
  can_unassign_beds: boolean;
  
  // Reservation management
  can_view_reservations: boolean;
  can_create_reservations: boolean;
  can_accept_reservations: boolean;
  can_check_in_reservations: boolean;
  can_cancel_reservations: boolean;
  
  // Guest management
  can_view_guests: boolean;
  can_create_guests: boolean;
  can_edit_guest_basic: boolean;
  can_edit_guest_case: boolean;
  can_delete_guests: boolean;
  
  // Volunteer management
  can_view_volunteers: boolean;
  can_manage_volunteers: boolean;
  
  // Chapel management
  can_view_chapel: boolean;
  can_manage_chapel: boolean;
  
  // Task management
  can_view_tasks: boolean;
  can_create_tasks: boolean;
  can_assign_tasks: boolean;
  can_update_own_tasks: boolean;
  
  // User management
  can_view_users: boolean;
  can_manage_users: boolean;
  
  // Chat
  can_use_chat: boolean;
}

// Task types
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  creator: User;
  assignee?: User;
}

export interface TaskCreate {
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  assignee_id?: number;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: number;
  due_date?: string;
}

// Chat types
export interface ChatMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar?: string;
  recipient_id?: number;
  content: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export interface ChatConversation {
  user: {
    id: number;
    name: string;
    avatar?: string;
    role: UserRole;
  };
  last_message?: {
    content: string;
    created_at: string;
    is_mine: boolean;
  };
  unread_count: number;
}

export interface TypingIndicator {
  user_id: number;
  user_name: string;
  is_typing: boolean;
  recipient_id?: number;
}

// WebSocket message types
export type WSMessageType = 
  | 'new_message'
  | 'typing'
  | 'user_online'
  | 'user_offline'
  | 'ping'
  | 'pong';

export interface WSMessage {
  type: WSMessageType;
  [key: string]: any;
}
