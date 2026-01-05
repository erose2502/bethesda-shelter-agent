/**
 * Real-time Chat Component with WebSocket support
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, Send, X, Users, Circle,
  Minimize2, Maximize2, Search, Check, CheckCheck
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';
import type { ChatMessage, ChatConversation, TypingIndicator, WSMessage } from '../types/auth';

interface ChatProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

export default function Chat({ isOpen, onClose, onUnreadChange }: ChatProps) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null); // null = broadcast
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<Map<number, string>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [isMinimized, setIsMinimized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${config.apiUrl}/api/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
        
        // Calculate total unread
        const total = (data.conversations || []).reduce(
          (sum: number, c: ChatConversation) => sum + c.unread_count, 
          0
        );
        setUnreadCount(total);
        onUnreadChange?.(total);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [token, onUnreadChange]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async () => {
    if (!token) return;

    try {
      const url = selectedConversation
        ? `${config.apiUrl}/api/chat/messages?recipient_id=${selectedConversation}`
        : `${config.apiUrl}/api/chat/broadcast`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [token, selectedConversation]);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (!token || !user || ws.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = config.apiUrl.replace('http', 'ws');
    ws.current = new WebSocket(`${wsUrl}/api/chat/ws?token=${token}`);

    ws.current.onopen = () => {
      console.log('Chat WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      const data: WSMessage = JSON.parse(event.data);
      
      switch (data.type) {
        case 'new_message':
          const newMsg = data.message as ChatMessage;
          setMessages(prev => [...prev, newMsg]);
          
          // Update unread if message is from selected conversation or broadcast
          if (newMsg.sender_id !== user?.id) {
            if (
              (selectedConversation === null && newMsg.recipient_id === null) ||
              (selectedConversation === newMsg.sender_id)
            ) {
              // Message is in current view, mark as read
              fetch(`${config.apiUrl}/api/chat/messages/${newMsg.id}/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });
            } else {
              // Message is in another conversation
              setUnreadCount(prev => prev + 1);
              onUnreadChange?.(unreadCount + 1);
            }
          }
          
          // Play notification sound
          if (newMsg.sender_id !== user?.id) {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUA0PVa3l7alVFAhGnt/zv20cBTC/0POugzcIHmy+7+Wcug0PU6zj7q1WFQlHn+Lyvmwc');
            audio.volume = 0.2;
            audio.play().catch(() => {});
          }
          break;
        
        case 'typing':
          const typing = data as unknown as TypingIndicator;
          if (typing.user_id !== user?.id) {
            setTypingUsers(prev => {
              const newMap = new Map(prev);
              if (typing.is_typing) {
                newMap.set(typing.user_id, typing.user_name);
              } else {
                newMap.delete(typing.user_id);
              }
              return newMap;
            });
          }
          break;
        
        case 'user_online':
          setOnlineUsers(prev => new Set(prev).add(data.user_id));
          break;
        
        case 'user_offline':
          setOnlineUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.user_id);
            return newSet;
          });
          // Clear typing indicator
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete(data.user_id);
            return newMap;
          });
          break;
      }
    };

    ws.current.onclose = () => {
      console.log('Chat WebSocket disconnected');
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 3000);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [token, user, selectedConversation, unreadCount, onUnreadChange]);

  // Initialize
  useEffect(() => {
    if (isOpen && token) {
      fetchConversations();
      fetchMessages();
      connectWebSocket();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isOpen, token, fetchConversations, fetchMessages, connectWebSocket]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      // Mark conversation as read
      if (selectedConversation) {
        fetch(`${config.apiUrl}/api/chat/conversations/${selectedConversation}/read`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }).then(() => fetchConversations());
      }
    }
  }, [selectedConversation, isOpen, token, fetchMessages, fetchConversations]);

  // Send typing indicator
  const sendTypingIndicator = (isTyping: boolean) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'typing',
        recipient_id: selectedConversation,
        is_typing: isTyping,
      }));
    }
  };

  // Handle message input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    sendTypingIndicator(true);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false);
    }, 2000);
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !token) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    sendTypingIndicator(false);

    try {
      // Send via WebSocket for real-time delivery
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'send',
          recipient_id: selectedConversation,
          content: messageContent,
        }));
      } else {
        // Fallback to REST API
        await fetch(`${config.apiUrl}/api/chat/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipient_id: selectedConversation,
            content: messageContent,
          }),
        });
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter(c =>
    c.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get typing users for current conversation
  const currentTypingUsers = Array.from(typingUsers.entries())
    .filter(([userId]) => {
      if (selectedConversation === null) return true; // Broadcast
      return userId === selectedConversation;
    })
    .map(([_, name]) => name);

  if (!isOpen) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${isMinimized ? 'w-80' : 'w-96 h-[600px]'} bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <span className="font-semibold">Team Chat</span>
          {unreadCount > 0 && (
            <span className="bg-white text-red-500 text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Conversation List / Messages View */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar - Conversations */}
            <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
              {/* Search */}
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg border-0 focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              
              {/* Broadcast Option */}
              <button
                onClick={() => setSelectedConversation(null)}
                className={`flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  selectedConversation === null ? 'bg-red-50 dark:bg-red-900/20 border-l-2 border-red-500' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    All Staff
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Broadcast
                  </p>
                </div>
              </button>

              {/* Conversation List */}
              <div className="flex-1 overflow-y-auto">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.user.id}
                    onClick={() => setSelectedConversation(conv.user.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                      selectedConversation === conv.user.id ? 'bg-red-50 dark:bg-red-900/20 border-l-2 border-red-500' : ''
                    }`}
                  >
                    <div className="relative">
                      {conv.user.avatar ? (
                        <img 
                          src={conv.user.avatar} 
                          alt={conv.user.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {conv.user.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                      )}
                      {onlineUsers.has(conv.user.id) && (
                        <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-green-500 fill-green-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {conv.user.name}
                      </p>
                      {conv.last_message && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {conv.last_message.is_mine && 'You: '}
                          {conv.last_message.content}
                        </p>
                      )}
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${msg.sender_id === user?.id ? 'order-2' : 'order-1'}`}>
                      {msg.sender_id !== user?.id && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">
                          {msg.sender_name}
                        </p>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl ${
                          msg.sender_id === user?.id
                            ? 'bg-red-500 text-white rounded-br-md'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      <div className={`flex items-center gap-1 mt-0.5 ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.sender_id === user?.id && (
                          msg.is_read ? (
                            <CheckCheck className="h-3 w-3 text-blue-500" />
                          ) : (
                            <Check className="h-3 w-3 text-gray-400" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Typing Indicator */}
              {currentTypingUsers.length > 0 && (
                <div className="px-3 py-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    {currentTypingUsers.join(', ')} {currentTypingUsers.length === 1 ? 'is' : 'are'} typing...
                  </p>
                </div>
              )}

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={handleInputChange}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full border-0 focus:ring-2 focus:ring-red-500 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
