import { X, Send } from 'lucide-react';
import { useState } from 'react';
import { Calendar, Clock, Users, Video, MapPin, CheckCircle2 } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isMine: boolean;
}

interface Conversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  type: 'direct' | 'group';
  online: boolean;
  members?: number;
  messages: Message[];
}

interface ChatModalsProps {
  showChatModal: boolean;
  setShowChatModal: (show: boolean) => void;
  showNewMessageModal: boolean;
  setShowNewMessageModal: (show: boolean) => void;
  selectedConversation: string | null;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  messageInput: string;
  setMessageInput: (input: string) => void;
  newChatType: 'direct' | 'group';
  setNewChatType: (type: 'direct' | 'group') => void;
  newChatName: string;
  setNewChatName: (name: string) => void;
  setSelectedConversation: (id: string | null) => void;
}

export default function ChatModals({
  showChatModal,
  setShowChatModal,
  showNewMessageModal,
  setShowNewMessageModal,
  selectedConversation,
  conversations,
  setConversations,
  messageInput,
  setMessageInput,
  newChatType,
  setNewChatType,
  newChatName,
  setNewChatName,
  setSelectedConversation,
}: ChatModalsProps) {
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingDuration, setMeetingDuration] = useState('30');
  const [meetingType, setMeetingType] = useState<'in-person' | 'virtual'>('virtual');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [viewingSchedule, setViewingSchedule] = useState(false);
  
  // Mock team members with their schedules
  const teamMembers = [
    { 
      name: 'Director Smith', 
      avatar: 'DS',
      schedule: {
        '2026-01-06': ['9 AM', '10 AM', '11 AM', '2 PM', '3 PM'],
        '2026-01-07': ['9 AM', '10 AM', '1 PM', '2 PM', '3 PM'],
        '2026-01-08': ['9 AM', '11 AM', '1 PM', '2 PM', '3 PM'],
      }
    },
    { 
      name: 'Sarah Coach', 
      avatar: 'SC',
      schedule: {
        '2026-01-06': ['9 AM', '10 AM', '11 AM', '1 PM', '2 PM', '3 PM'],
        '2026-01-07': ['10 AM', '11 AM', '1 PM', '2 PM', '3 PM'],
        '2026-01-08': ['9 AM', '10 AM', '11 AM', '2 PM', '3 PM'],
      }
    },
    { 
      name: 'Mike Volunteer', 
      avatar: 'MV',
      schedule: {
        '2026-01-06': ['1 PM', '2 PM', '3 PM'],
        '2026-01-07': ['9 AM', '10 AM', '11 AM', '2 PM', '3 PM'],
        '2026-01-08': ['1 PM', '2 PM', '3 PM'],
      }
    },
    { 
      name: 'Anna Director', 
      avatar: 'AD',
      schedule: {
        '2026-01-06': ['9 AM', '10 AM', '2 PM', '3 PM'],
        '2026-01-07': ['9 AM', '11 AM', '1 PM', '2 PM', '3 PM'],
        '2026-01-08': ['9 AM', '10 AM', '11 AM', '1 PM'],
      }
    },
    { 
      name: 'Tom Coordinator', 
      avatar: 'TC',
      schedule: {
        '2026-01-06': ['10 AM', '11 AM', '1 PM', '2 PM', '3 PM'],
        '2026-01-07': ['9 AM', '10 AM', '1 PM', '3 PM'],
        '2026-01-08': ['9 AM', '10 AM', '11 AM', '2 PM', '3 PM'],
      }
    },
  ];

  // Find common available times
  const findCommonAvailability = (date: string) => {
    if (selectedParticipants.length === 0) return [];
    
    const allTimeSlots = ['9 AM', '10 AM', '11 AM', '1 PM', '2 PM', '3 PM'];
    const participantSchedules = selectedParticipants
      .map(name => teamMembers.find(m => m.name === name))
      .filter((m): m is typeof teamMembers[number] => m !== undefined && m.schedule[date as keyof typeof m.schedule] !== undefined)
      .map(m => m.schedule[date as keyof typeof m.schedule]);
    
    if (participantSchedules.length === 0) return allTimeSlots;
    
    return allTimeSlots.filter(time => 
      participantSchedules.every(schedule => schedule.includes(time))
    );
  };

  const handleSendMessage = () => {
    if (messageInput.trim() && selectedConversation) {
      const newMessage = {
        id: `m${Date.now()}`,
        sender: 'You',
        text: messageInput,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        isMine: true
      };
      
      setConversations(prev => prev.map(c => 
        c.id === selectedConversation 
          ? { ...c, messages: [...c.messages, newMessage], lastMessage: messageInput, timestamp: 'Just now', unread: 0 }
          : c
      ));
      setMessageInput('');
    }
  };

  const handleCreateChat = () => {
    if (newChatName.trim()) {
      const newId = `${Date.now()}`;
      const newConv: Conversation = {
        id: newId,
        name: newChatName,
        avatar: newChatName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        lastMessage: 'Start a conversation...',
        timestamp: 'Now',
        unread: 0,
        type: newChatType,
        ...(newChatType === 'group' ? { members: 1 } : {}),
        online: false,
        messages: [],
      };
      setConversations(prev => [newConv, ...prev]);
      setSelectedConversation(newId);
      setShowNewMessageModal(false);
      setShowChatModal(true);
      setNewChatName('');
    }
  };

  const currentConversation = conversations.find(c => c.id === selectedConversation);

  return (
    <>
      {/* Full Chat Modal */}
      {showChatModal && selectedConversation && currentConversation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowChatModal(false)}></div>
            <div className="relative transform overflow-hidden rounded-xl bg-white dark:bg-gray-900 border border-white/20 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <span className="text-sm font-bold text-white">{currentConversation.avatar}</span>
                    </div>
                    {currentConversation.online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-900"></span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{currentConversation.name}</h3>
                    {currentConversation.type === 'group' && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{currentConversation.members} members</p>
                    )}
                    {currentConversation.type === 'direct' && currentConversation.online && (
                      <p className="text-xs text-green-500">Online</p>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setShowChatModal(false)}
                  className="rounded-md text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Messages */}
              <div className="px-6 py-4 h-96 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
                {currentConversation.messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400 dark:text-gray-500 text-sm">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentConversation.messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${msg.isMine ? 'order-2' : 'order-1'}`}>
                          {!msg.isMine && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">{msg.sender}</p>
                          )}
                          <div className={`rounded-2xl px-4 py-2 ${
                            msg.isMine 
                              ? 'bg-red-500 text-white rounded-br-sm' 
                              : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-sm shadow-sm'
                          }`}>
                            <p className="text-sm">{msg.text}</p>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-1">{msg.timestamp}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                {/* Toolbar */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setShowScheduleMeeting(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    <Calendar className="h-4 w-4" />
                    Schedule Meeting
                  </button>
                  <button
                    onClick={() => setViewingSchedule(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    <Clock className="h-4 w-4" />
                    View Schedules
                  </button>
                </div>
                
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-3 text-sm bg-gray-100 dark:bg-gray-800 border-0 rounded-full text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    className="p-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-full transition-colors"
                  >
                    <Send className="h-5 w-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowNewMessageModal(false)}></div>
            <div className="relative transform overflow-hidden rounded-xl bg-white dark:bg-gray-900 border border-white/20 px-4 pb-4 pt-5 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-md sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button 
                  onClick={() => {
                    setShowNewMessageModal(false);
                    setNewChatName('');
                  }}
                  className="rounded-md text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  New Message
                </h3>
                
                {/* Chat Type Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewChatType('direct')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newChatType === 'direct'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      Direct Message
                    </button>
                    <button
                      onClick={() => setNewChatType('group')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newChatType === 'group'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      Group Chat
                    </button>
                  </div>
                </div>

                {/* Name/Recipient Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {newChatType === 'direct' ? 'Recipient' : 'Group Name'}
                  </label>
                  <input
                    type="text"
                    value={newChatName}
                    onChange={(e) => setNewChatName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateChat();
                      }
                    }}
                    placeholder={newChatType === 'direct' ? 'Search for a person...' : 'Enter group name...'}
                    className="block w-full rounded-lg border-0 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-red-400 sm:text-sm"
                  />
                </div>

                {/* Quick Contacts (for direct messages) */}
                {newChatType === 'direct' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Quick Select
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {['John Manager', 'Sarah Coach', 'Mike Volunteer', 'Anna Director', 'Tom Coordinator'].map((name) => (
                        <button
                          key={name}
                          onClick={() => setNewChatName(name)}
                          className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">{name.split(' ').map(n => n[0]).join('')}</span>
                          </div>
                          <div className="text-left">
                            <span className="text-sm text-gray-900 dark:text-white block">{name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{name.split(' ')[1]}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowNewMessageModal(false);
                      setNewChatName('');
                    }}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateChat}
                    disabled={!newChatName.trim()}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
                  >
                    Start Chat
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      {showScheduleMeeting && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowScheduleMeeting(false)}></div>
            <div className="relative transform overflow-hidden rounded-xl bg-white dark:bg-gray-900 border border-white/20 px-4 pb-4 pt-5 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button 
                  onClick={() => setShowScheduleMeeting(false)}
                  className="rounded-md text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Schedule Meeting
                  </h3>
                </div>
                
                {/* Meeting Title */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Meeting Title
                  </label>
                  <input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="Enter meeting title..."
                    className="block w-full rounded-lg border-0 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-blue-400 sm:text-sm"
                  />
                </div>

                {/* Meeting Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Meeting Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMeetingType('virtual')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        meetingType === 'virtual'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Video className="h-4 w-4" />
                      Virtual
                    </button>
                    <button
                      onClick={() => setMeetingType('in-person')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        meetingType === 'in-person'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      <MapPin className="h-4 w-4" />
                      In-Person
                    </button>
                  </div>
                </div>

                {/* Location (for in-person) */}
                {meetingType === 'in-person' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={meetingLocation}
                      onChange={(e) => setMeetingLocation(e.target.value)}
                      placeholder="Enter meeting location..."
                      className="block w-full rounded-lg border-0 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-blue-400 sm:text-sm"
                    />
                  </div>
                )}

                {/* Participants */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Users className="h-4 w-4 inline mr-1" />
                    Participants
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    {teamMembers.map((member) => (
                      <label key={member.name} className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedParticipants.includes(member.name)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedParticipants(prev => [...prev, member.name]);
                            } else {
                              setSelectedParticipants(prev => prev.filter(p => p !== member.name));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">{member.avatar}</span>
                        </div>
                        <span className="text-sm text-gray-900 dark:text-white">{member.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      min="2026-01-06"
                      className="block w-full rounded-lg border-0 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-blue-400 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Duration
                    </label>
                    <select
                      value={meetingDuration}
                      onChange={(e) => setMeetingDuration(e.target.value)}
                      className="block w-full rounded-lg border-0 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-blue-400 sm:text-sm"
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="60">1 hour</option>
                      <option value="90">1.5 hours</option>
                      <option value="120">2 hours</option>
                    </select>
                  </div>
                </div>

                {/* Available Time Slots */}
                {meetingDate && selectedParticipants.length > 0 && (() => {
                  const allTimeSlots = ['9 AM', '10 AM', '11 AM', '1 PM', '2 PM', '3 PM'];
                  const availableSlots = findCommonAvailability(meetingDate);
                  
                  return (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Time Slots (9 AM - 3 PM)
                      </label>
                      <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        {allTimeSlots.map((time) => {
                          const isAvailable = availableSlots.includes(time);
                          return (
                            <button
                              key={time}
                              onClick={() => isAvailable && setMeetingTime(time)}
                              disabled={!isAvailable}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                meetingTime === time && isAvailable
                                  ? 'bg-green-500 text-white shadow-md'
                                  : isAvailable
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 border border-green-300 dark:border-green-800'
                                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1">
                                {isAvailable ? (
                                  <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                                <span>{time}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        <CheckCircle2 className="h-3 w-3 inline text-green-500 mr-1" />
                        Green = All participants available
                        <X className="h-3 w-3 inline text-gray-400 ml-3 mr-1" />
                        Gray = Conflicts exist
                      </p>
                    </div>
                  );
                })()}

                {/* Buttons */}
                <div className="mt-6 flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setShowScheduleMeeting(false);
                      setMeetingTitle('');
                      setMeetingDate('');
                      setMeetingTime('');
                      setSelectedParticipants([]);
                    }}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (meetingTitle && meetingDate && meetingTime && selectedParticipants.length > 0 && selectedConversation) {
                        const meetingMessage = {
                          id: `m${Date.now()}`,
                          sender: 'You',
                          text: `📅 Meeting scheduled: "${meetingTitle}" on ${meetingDate} at ${meetingTime} (${meetingDuration} min) with ${selectedParticipants.join(', ')}`,
                          timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                          isMine: true
                        };
                        
                        setConversations(prev => prev.map(c => 
                          c.id === selectedConversation 
                            ? { ...c, messages: [...c.messages, meetingMessage], lastMessage: meetingMessage.text, timestamp: 'Just now' }
                            : c
                        ));
                        
                        setShowScheduleMeeting(false);
                        setMeetingTitle('');
                        setMeetingDate('');
                        setMeetingTime('');
                        setSelectedParticipants([]);
                      }
                    }}
                    disabled={!meetingTitle || !meetingDate || !meetingTime || selectedParticipants.length === 0}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
                  >
                    Schedule Meeting
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Schedules Modal */}
      {viewingSchedule && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setViewingSchedule(false)}></div>
            <div className="relative transform overflow-hidden rounded-xl bg-white dark:bg-gray-900 border border-white/20 px-4 pb-4 pt-5 text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button 
                  onClick={() => setViewingSchedule(false)}
                  className="rounded-md text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-full bg-purple-500 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Team Schedules & Availability
                  </h3>
                </div>

                {/* Calendar Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                          Team Member
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                          Mon, Jan 6
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                          Tue, Jan 7
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                          Wed, Jan 8
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member, idx) => (
                        <tr key={member.name} className={idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}>
                          <td className="px-4 py-3 border-r border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-white">{member.avatar}</span>
                              </div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 border-r border-gray-200 dark:border-gray-700">
                            <div className="flex flex-wrap gap-1 justify-center">
                              {member.schedule['2026-01-06']?.map(time => (
                                <span key={time} className="inline-block px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">
                                  {time}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 border-r border-gray-200 dark:border-gray-700">
                            <div className="flex flex-wrap gap-1 justify-center">
                              {member.schedule['2026-01-07']?.map(time => (
                                <span key={time} className="inline-block px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">
                                  {time}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1 justify-center">
                              {member.schedule['2026-01-08']?.map(time => (
                                <span key={time} className="inline-block px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">
                                  {time}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-200 mb-2 font-medium">
                    <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                    Green time slots = Available for meetings
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Use the "Schedule Meeting" button to find common availability and book a time that works for everyone.
                  </p>
                </div>

                {/* Close Button */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setViewingSchedule(false)}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}