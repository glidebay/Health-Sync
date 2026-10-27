export interface EngineSlotItem {
  slot_time: string;
  timestamp: string;
  status: 'Passed' | 'Booked' | 'Available';
  is_past: boolean;
  is_booked: boolean;
  is_available: boolean;
}

export interface DynamicSlotTimetableResponse {
  date: string;
  total_slots: number;
  passed_count: number;
  booked_count: number;
  available_count: number;
  is_quota_full: boolean;
  daily_quota_from_settings: number;
  slots: EngineSlotItem[];
}

export interface ChatMessage {
  id: string;
  sender: 'patient' | 'doctor' | 'system';
  text: string;
  timestamp: string;
  isBookingReceipt?: boolean;
  tokenNumber?: string;
  slotTime?: string;
  date?: string;
  messageType?: 'text' | 'interactive' | 'action' | 'system' | 'audio';
  interactiveOption?: string;
  actionType?: string;
  audioUrl?: string;
  audioType?: string;
  isVoiceNote?: boolean;
  mediaId?: string;
}

export interface PatientChatThread {
  id: string;
  patientName: string;
  phoneNumber: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  priority?: 'Normal' | 'Urgent';
  status: 'received' | 'link_sent' | 'pending' | 'booked';
  requestedSlot?: string;
  requestedDate?: string;
  symptoms?: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: boolean;
  messages: ChatMessage[];
  tokenNumber?: string;
}
