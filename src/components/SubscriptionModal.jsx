import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  CreditCard,
  Sparkles,
  Phone,
  Video,
  MessageSquare,
  Award,
  X,
  Lock,
  UserCheck,
} from 'lucide-react';
import { startRazorpayMentorshipCheckout } from '../services/razorpay';
import {
  DEFAULT_VERIFIED_MENTORS,
  saveUserMentorshipSubscription,
  subscribeToUserMentorshipPass,
} from '../services/db';

export default function SubscriptionModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState('checkout'); // 'checkout' | 'allocate' | 'unlocked'
  const [subData, setSubData] = useState(null);
  const [selectedMentor, setSelectedMentor] = useState(
    DEFAULT_VERIFIED_MENTORS[0]
  );
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [targetExam, setTargetExam] = useState('JEE Main & Advanced');
  const [isProcessing, setIsProcessing] = useState(false);

  const getCurrentUid = () => {
    try {
      const u = window.state?.user || window.currentUser;
      return u?.uid || u?.email || 'student_default';
    } catch (_e) {
      return 'student_default';
    }
  };

  useEffect(() => {
    const uid = getCurrentUid();
    const unsub = subscribeToUserMentorshipPass(uid, (data) => {
      setSubData(data);
      window.activeMentorshipPass = data;
      if (data?.active && data?.permanentMentorId) {
        const found =
          DEFAULT_VERIFIED_MENTORS.find(
            (m) => m.id === data.permanentMentorId
          ) || DEFAULT_VERIFIED_MENTORS[0];
        setSelectedMentor(found);
      }
    });

    window.openSubscriptionModal = (options = {}) => {
      try {
        const u = window.state?.user || window.currentUser || {};
        if (u.name && !studentName) setStudentName(u.name);
      } catch (_e) {}

      if (options.preselectMentorName) {
        const match = DEFAULT_VERIFIED_MENTORS.find((m) =>
          m.name
            .toLowerCase()
            .includes(String(options.preselectMentorName).toLowerCase())
        );
        if (match) setSelectedMentor(match);
      }

      if (window.activeMentorshipPass?.active) {
        if (window.activeMentorshipPass?.permanentMentorId) {
          setStep('unlocked');
        } else {
          setStep('allocate');
        }
      } else {
        setStep('checkout');
      }
      setIsOpen(true);
    };

    window.closeSubscriptionModal = () => setIsOpen(false);

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  if (!isOpen) return null;

  const handlePay149 = async () => {
    setIsProcessing(true);
    const u = window.state?.user || window.currentUser || {};
    await startRazorpayMentorshipCheckout({
      studentName: studentName.trim() || u.name || 'Prepskm Aspirant',
      studentEmail: u.email || 'aspirant@prepskm.in',
      studentPhone: studentPhone.trim() || '9999999999',
      preselectedMentorName: selectedMentor?.name,
      onSuccess: async (paymentResponse) => {
        const uid = getCurrentUid();
        const saved = await saveUserMentorshipSubscription(uid, {
          active: true,
          planPrice: 149,
          currency: 'INR',
          paymentId: paymentResponse.razorpay_payment_id,
          studentName: studentName.trim() || u.name || 'Prepskm Aspirant',
          targetExam,
          subscribedAt: new Date().toISOString(),
        });
        setSubData(saved);
        setIsProcessing(false);
        setStep('allocate');
        if (typeof window.showToast === 'function') {
          window.showToast(
            '🎉 ₹149/month Mentorship Pass Activated! Select your Permanent Mentor below.'
          );
        }
      },
      onDismiss: () => {
        setIsProcessing(false);
      },
    });
  };

  const handleConfirmPermanentMentor = async () => {
    setIsProcessing(true);
    const uid = getCurrentUid();
    const saved = await saveUserMentorshipSubscription(uid, {
      ...(subData || {}),
      active: true,
      planPrice: 149,
      permanentMentorId: selectedMentor.id,
      permanentMentorName: selectedMentor.name,
      permanentMentorHandle: selectedMentor.handle,
      permanentMentorRole: selectedMentor.roleTitle,
      allocatedAt: new Date().toISOString(),
    });
    setSubData(saved);
    window.activeMentorshipPass = saved;
    setIsProcessing(false);
    setStep('unlocked');
    if (typeof window.showToast === 'function') {
      window.showToast(
        `✅ ${selectedMentor.name} allocated as your Permanent 1:1 Mentor!`
      );
    }
  };

  const launch1on1Action = (actionType) => {
    setIsOpen(false);
    const mentorTitle = `${selectedMentor.name} (${selectedMentor.handle})`;
    if (actionType === 'video' && typeof window.startCall === 'function') {
      window.startCall('video', mentorTitle);
    } else if (
      actionType === 'audio' &&
      typeof window.startCall === 'function'
    ) {
      window.startCall('audio', mentorTitle);
    } else if (
      actionType === 'chat' &&
      typeof window.navigateView === 'function'
    ) {
      window.navigateView('chat');
      if (typeof window.switchChatTab === 'function') {
        window.switchChatTab('owner');
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99995,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#ffffff',
          borderRadius: '28px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.65)',
          color: '#0f172a',
        }}
      >
        {/* Top Gradient Header */}
        <div
          style={{
            background:
              'linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #4f46e5 100%)',
            padding: '22px 24px',
            color: '#fff',
            position: 'relative',
          }}
        >
          <button
            onClick={() => setIsOpen(false)}
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: '#fff',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              color: '#6ee7b7',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 800,
              marginBottom: '10px',
            }}
          >
            <Sparkles size={13} /> PREPSKM OFFICIAL 1:1 MENTORSHIP PROGRAM
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: '21px',
              fontWeight: 900,
              letterSpacing: '-0.02em',
            }}
          >
            {step === 'checkout' &&
              'Unlock Personal 1:1 Mentorship — ₹149 / Month'}
            {step === 'allocate' && 'Select Your Permanent 1:1 Mentor'}
            {step === 'unlocked' && 'Your Permanent 1:1 Mentorship Dashboard'}
          </h2>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: '12.5px',
              color: '#c7d2fe',
              lineHeight: 1.5,
            }}
          >
            {step === 'checkout' &&
              'Get dedicated 1:1 audio/video strategy calls, daily doubt clearing, and personal rank tracking with Lead Mentor Sumit (@unfiltereddsumit) & verified IIT/AIIMS mentors.'}
            {step === 'allocate' &&
              'Choose ONE verified mentor as your Permanent Mentor for the entire month.'}
            {step === 'unlocked' &&
              'Your ₹149/month subscription is active. Connect with your Permanent Mentor anytime below.'}
          </p>
        </div>

        {/* Body Content */}
        <div style={{ padding: '22px 24px' }}>
          {step === 'checkout' && (
            <div>
              {/* Pricing Highlight Box */}
              <div
                style={{
                  background:
                    'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
                  border: '2px solid #6366f1',
                  borderRadius: '20px',
                  padding: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '18px',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: '#4f46e5',
                      background: '#e0e7ff',
                      padding: '3px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    STUDENT AFFORDABLE PASS
                  </span>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 900,
                      color: '#0f172a',
                      marginTop: '6px',
                    }}
                  >
                    1:1 Permanent Mentor Allocation
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569' }}>
                    Supports UPI, GPay, PhonePe, Paytm, Cards &amp; NetBanking
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: '28px',
                      fontWeight: 900,
                      color: '#4f46e5',
                      lineHeight: 1,
                    }}
                  >
                    ₹149
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#64748b',
                      }}
                    >
                      /month
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#10b981',
                      fontWeight: 800,
                      marginTop: '4px',
                    }}
                  >
                    ✓ Instant Activation
                  </div>
                </div>
              </div>

              {/* Benefits Checklist */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                  gap: '10px',
                  marginBottom: '18px',
                }}
              >
                {[
                  'Select 1 Permanent Mentor (Lead Mentor Sumit or Ranker)',
                  'Scheduled 1:1 HD Video & Audio Strategy Calls',
                  'Private Direct Doubt Chat & Voice Note Guidance',
                  'Weekly Mock Test Score & Weak-Chapter Review',
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: '#f8fafc',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#1e293b',
                    }}
                  >
                    <CheckCircle2
                      size={16}
                      style={{ color: '#10b981', flexShrink: 0 }}
                    />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Student Quick Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginBottom: '18px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Enter full name"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      fontWeight: 600,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Target Exam
                  </label>
                  <select
                    value={targetExam}
                    onChange={(e) => setTargetExam(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      background: '#fff',
                    }}
                  >
                    <option value="JEE Main & Advanced">
                      JEE Main &amp; Advanced
                    </option>
                    <option value="NEET UG">NEET UG</option>
                  </select>
                </div>
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePay149}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '16px',
                  border: 'none',
                  background:
                    'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 12px 25px -6px rgba(79, 70, 229, 0.55)',
                }}
              >
                <CreditCard size={18} />
                {isProcessing
                  ? 'Opening Razorpay Gateway...'
                  : 'Pay ₹149/month via Razorpay (UPI / GPay / Cards)'}
              </button>

              <div
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#64748b',
                  fontWeight: 600,
                }}
              >
                <Lock size={12} /> 256-Bit SSL Secured via Razorpay Checkout •
                Cancel Anytime
              </div>
            </div>
          )}

          {step === 'allocate' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginBottom: '18px',
                }}
              >
                {DEFAULT_VERIFIED_MENTORS.map((m) => {
                  const isSelected = selectedMentor?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMentor(m)}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '18px',
                        border: isSelected
                          ? '2px solid #4f46e5'
                          : '1px solid #e2e8f0',
                        background: isSelected ? '#eef2ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <img
                          src={m.avatar}
                          alt={m.name}
                          className={
                            m.id === 'mentor-sumit'
                              ? 'mentor-dynamic-avatar'
                              : ''
                          }
                          style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '14px',
                            objectFit: 'cover',
                            border: '2px solid #6366f1',
                          }}
                        />
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '14px',
                                fontWeight: 900,
                                color: '#0f172a',
                              }}
                            >
                              {m.name}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: '#dbeafe',
                                color: '#1d4ed8',
                              }}
                            >
                              {m.roleTitle}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '11.5px',
                              color: '#475569',
                              fontWeight: 600,
                              marginTop: '2px',
                            }}
                          >
                            {m.credentials}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#64748b',
                              marginTop: '3px',
                            }}
                          >
                            {m.bio}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: isSelected
                            ? '7px solid #4f46e5'
                            : '2px solid #cbd5e1',
                          flexShrink: 0,
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleConfirmPermanentMentor}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '16px',
                  border: 'none',
                  background: '#10b981',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <UserCheck size={18} />
                Confirm {selectedMentor?.name} as My Permanent Mentor
              </button>
            </div>
          )}

          {step === 'unlocked' && (
            <div>
              <div
                style={{
                  background:
                    'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
                  border: '1.5px solid #6ee7b7',
                  borderRadius: '20px',
                  padding: '18px',
                  marginBottom: '18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 900,
                      color: '#047857',
                      background: '#d1fae5',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <ShieldCheck size={14} /> ACTIVE PERMANENT MENTOR PASS
                  </span>
                  <button
                    onClick={() => setStep('allocate')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#4f46e5',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Change Mentor
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <img
                    src={selectedMentor?.avatar}
                    alt={selectedMentor?.name}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '16px',
                      objectFit: 'cover',
                      border: '2px solid #10b981',
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 900,
                        color: '#0f172a',
                      }}
                    >
                      {selectedMentor?.name}{' '}
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#059669',
                          fontWeight: 700,
                        }}
                      >
                        ({selectedMentor?.handle})
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#334155',
                        fontWeight: 600,
                      }}
                    >
                      {selectedMentor?.roleTitle} • {selectedMentor?.credentials}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                }}
              >
                <button
                  onClick={() => launch1on1Action('video')}
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    border: 'none',
                    background: '#4f46e5',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Video size={18} />
                  <span>1:1 Video Call</span>
                </button>
                <button
                  onClick={() => launch1on1Action('audio')}
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    border: 'none',
                    background: '#059669',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Phone size={18} />
                  <span>1:1 Audio Call</span>
                </button>
                <button
                  onClick={() => launch1on1Action('chat')}
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <MessageSquare size={18} />
                  <span>Private Doubt Chat</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
