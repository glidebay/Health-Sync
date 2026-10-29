'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClinicProvider, useClinic } from '@/context/ClinicContext';
import { SlotBookingView } from '@/components/views/SlotBookingView';
import { Patient, ConfirmedToken } from '@/types';
import { DbDoctor } from '@/types/database';
import {
  getDoctors,
  fetchQueueFromDb,
  bookAppointmentSlotDb,
} from '@/lib/supabaseService';
import { validateMobileNumber } from '@/lib/phoneValidation';

function BookSlotInnerClient() {
  const router = useRouter();
  const { config } = useClinic();

  const [queue, setQueue] = useState<Patient[]>([]);
  const [availableDoctors, setAvailableDoctors] = useState<DbDoctor[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<{ name: string; title: string }>({
    name: 'Dr. Sunny',
    title: 'General Medicine & Family Care',
  });

  const [bookName, setBookName] = useState('');
  const [bookPhone, setBookPhone] = useState('');
  const [bookAge, setBookAge] = useState('');
  const [bookGender, setBookGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [bookPriority, setBookPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookDate, setBookDate] = useState('');
  const [bookSlotTime, setBookSlotTime] = useState('');
  const [bookReason, setBookReason] = useState('General Consultation');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState(false);
  const [confirmedToken, setConfirmedToken] = useState<ConfirmedToken | null>(null);

  // Initialize booking date to today
  useEffect(() => {
    const today = new Date();
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setBookDate(ymd);
  }, []);

  useEffect(() => {
    // Load active doctors
    getDoctors().then((docs: DbDoctor[]) => {
      if (docs && docs.length > 0) {
        setAvailableDoctors(docs);
        setBookDoctorId((prev) => prev || docs[0].id);
        const active = docs[0];
        if (active) {
          setDoctorProfile({
            name: active.full_name || 'Dr. Sunny',
            title: active.specialization || 'General Medicine',
          });
        }
      }
    });

    // Load active queue
    fetchQueueFromDb().then((q: Patient[]) => {
      if (q) setQueue(q);
    });
  }, []);

  const handleBookSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBookingSubmitting) return;

    const phoneValidation = validateMobileNumber(bookPhone);
    if (!phoneValidation.isValid) {
      alert(phoneValidation.errorMessage || 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsBookingSubmitting(true);
    try {
      const selectedDoc =
        availableDoctors.find((d) => d.id === bookDoctorId) || availableDoctors[0];
      const docId = selectedDoc?.id || bookDoctorId;
      const docName = selectedDoc?.full_name || doctorProfile.name || 'Dr. Sunny';

      const finalBookingDate =
        bookDate ||
        (() => {
          const today = new Date();
          return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        })();

      const bookingRes = await bookAppointmentSlotDb({
        name: bookName.trim(),
        phone: bookPhone.trim(),
        age: parseInt(bookAge, 10) || 28,
        gender: bookGender,
        priority: bookPriority,
        doctorId: docId,
        date: finalBookingDate,
        slotTime: bookSlotTime,
        reason: bookReason,
      });

      if (!bookingRes.success) {
        const msg = bookingRes.message || 'The selected slot could not be booked. Please choose another slot.';
        alert(msg);
        setIsBookingSubmitting(false);
        return;
      }

      const newTokNum = String(
        bookingRes.displayId ||
        bookingRes.tokenNumber ||
        `P${String(queue.length + 1).padStart(3, '0')}`
      );

      setConfirmedToken({
        tokenNumber: newTokNum,
        name: bookName.trim(),
        time: bookSlotTime,
        date: finalBookingDate,
        phone: bookPhone.trim(),
        doctorName: docName,
        priority: bookPriority,
        channel: 'Online',
      });

      setBookName('');
      setBookPhone('');
      setBookAge('');
      setBookPriority('Normal');
    } catch (err) {
      console.error('Error booking slot:', err);
      alert('An unexpected error occurred while booking. Please try again.');
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  return (
    <SlotBookingView
      queue={queue}
      availableDoctors={availableDoctors}
      doctorProfile={doctorProfile}
      bookName={bookName}
      setBookName={setBookName}
      bookPhone={bookPhone}
      setBookPhone={setBookPhone}
      bookAge={bookAge}
      setBookAge={setBookAge}
      bookGender={bookGender}
      setBookGender={setBookGender}
      bookPriority={bookPriority}
      setBookPriority={setBookPriority}
      bookDoctorId={bookDoctorId}
      setBookDoctorId={setBookDoctorId}
      bookDate={bookDate}
      setBookDate={setBookDate}
      bookSlotTime={bookSlotTime}
      setBookSlotTime={setBookSlotTime}
      bookReason={bookReason}
      setBookReason={setBookReason}
      isBookingSubmitting={isBookingSubmitting}
      confirmedToken={confirmedToken}
      setConfirmedToken={setConfirmedToken}
      handleBookSlotSubmit={handleBookSlotSubmit}
      onBackToGateway={() => router.push('/')}
      isStandalone={true}
    />
  );
}

export default function BookSlotPageClient() {
  return (
    <ClinicProvider>
      <BookSlotInnerClient />
    </ClinicProvider>
  );
}
