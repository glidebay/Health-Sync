export interface Slot {
  slot_time: string;       // "09:30 AM"
  timestamp: string;       // "2026-10-27T09:30:00+05:30"
  status: "Available" | "Booked" | "Passed" | "Quota Full";
  is_available: boolean;
  is_booked: boolean;
  is_past: boolean;
}

export interface LiveQueuePatient {
  queue_token_no: number;
  appointment_id: string;
  patient_name: string;
  phone_number: string;
  age: number | null;
  gender: string | null;
  priority: "Normal" | "Urgent";
  visit_type: "Walk-in" | "WhatsApp Link" | "WhatsApp Bot";
  status: "In Progress" | "Waiting" | "Completed" | "Cancelled";
  scheduled_slot: string;     // "10:15 AM"
  estimated_call_time: string; // "Now in Cabin" | "Next (Immediate)" | "10:30 AM"
  wait_time_mins: number;
  is_in_cabin: boolean;
  is_next: boolean;
}
