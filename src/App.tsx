/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  Car,
  ChevronRight,
  ClipboardList,
  HardHat,
  Home,
  LogIn,
  LogOut,
  Megaphone,
  Navigation,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AgentWorkspaceView } from './components/AgentWorkspaceView';
import { AuthModal } from './components/AuthModal';
import { ClientReservationsView } from './components/ClientReservationsView';
import { ManagerOrdersView } from './components/ManagerOrdersView';
import { LiveNotificationToast, NotificationBell } from './components/NotificationCenter';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ServiceConfiguratorModal } from './components/ServiceConfiguratorModal';
import { VehicleMobilityModal } from './components/VehicleMobilityModal';
import {
  ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_BOOTSTRAP_EMAILS,
  ADMIN_DISPLAY_NAME,
  ADMIN_FIRST_NAME,
  ADMIN_LAST_NAME,
  ADMIN_WHATSAPP_PHONE,
  APP_OFFICIAL_NAME,
  BRAND_LOGO_URL,
  PROTOTYPE_BOOKING_IDS,
  PROTOTYPE_EMAILS,
  PROTOTYPE_PROMO_IDS,
  SERVICES,
} from './data/mockData';
import {
  auth,
  authPersistenceReady,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  AccountStatus,
  ActiveTabId,
  AppNotification,
  Booking,
  NotificationType,
  Promotion,
  Role,
  ServiceItem,
  UserProfile,
} from './types';
import {
  clearCachedProfileForUid,
  getCachedProfileForUid,
  getPushPermissionState,
  getReadNotificationIds,
  PushPermissionState,
  requestPushPermission,
  saveReadNotificationIds,
  setCachedProfileForUid,
  showBrowserPushNotification,
} from './utils/notifications';

type ActiveTab = ActiveTabId;

function getDashboardTabForRole(role: Role): ActiveTab {
  switch (role) {
    case 'admin':
      return 'admin';
    case 'manager':
      return 'suivi_commande';
    case 'agent':
      return 'agent_space';
    case 'client':
    default:
      return 'mes_reservations';
  }
}

const STORAGE_KEYS = {
  services: 'sxs_alp_services_prod_v1',
};

const LEGACY_PROTOTYPE_KEYS = [
  'sxs_alp_services_v2',
  'sxs_alp_services_v3',
  'sxs_alp_bookings_v2',
  'sxs_alp_promotions_v2',
  'sxs_alp_users_v2',
];

const REMOVED_SERVICE_IDS = new Set(['srv-9']);

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [previewRole, setPreviewRole] = useState<Role>('client');
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'vehicles' | 'btp' | 'home'>('all');

  const [services, setServices] = useState<ServiceItem[]>(() =>
    loadLocal(STORAGE_KEYS.services, SERVICES).filter((s) => !REMOVED_SERVICE_IDS.has(s.id))
  );
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [liveToast, setLiveToast] = useState<AppNotification | null>(null);
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(() =>
    getPushPermissionState()
  );

  const hasAutoRoutedRef = useRef(false);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const notifSnapshotReadyRef = useRef(false);

  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const [showVehicleMobilityModal, setShowVehicleMobilityModal] = useState(false);
  const [commissionRate, setCommissionRate] = useState<number>(10);

  // Determine effective role (authenticated profile takes precedence; Admin can also switch views)
  const currentRole: Role = userProfile
    ? userProfile.role === 'admin'
      ? previewRole
      : userProfile.role
    : previewRole;

  const isActualAdmin = userProfile?.role === 'admin';
  const isManagerOrAdmin = currentRole === 'manager' || currentRole === 'admin';
  const isAccountPending = userProfile?.accountStatus === 'pending';
  const isAccountBanned = userProfile?.accountStatus === 'banned';
  const isAccountRejected = userProfile?.accountStatus === 'rejected';

  // Purge legacy prototype localStorage caches once on startup
  useEffect(() => {
    try {
      LEGACY_PROTOTYPE_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore storage errors
    }
  }, []);

  // Persist public service catalog cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.services, JSON.stringify(services));
    } catch {
      // ignore storage quota errors
    }
  }, [services]);

  const publishNotification = async (params: {
    type: NotificationType;
    title: string;
    body: string;
    targetRoles: Role[];
    targetAgentNames?: string[];
    relatedId: string;
    relatedTab: ActiveTab;
    actorUid?: string;
  }) => {
    const uid = params.actorUid || auth.currentUser?.uid;
    if (!uid) return;
    const notifId = `notif-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const notif: AppNotification = {
      id: notifId,
      type: params.type,
      title: params.title.slice(0, 140),
      body: params.body.slice(0, 400),
      targetRoles: params.targetRoles,
      ...(params.targetAgentNames && params.targetAgentNames.length > 0
        ? { targetAgentNames: params.targetAgentNames.slice(0, 10) }
        : {}),
      relatedId: params.relatedId,
      relatedTab: params.relatedTab,
      actorUid: uid,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'notifications', notifId), notif);
    } catch (err) {
      console.warn('Notification publish skipped:', err);
    }
  };

  const applyResolvedProfile = (resolved: UserProfile) => {
    setUserProfile(resolved);
    setCachedProfileForUid(resolved);
    setPreviewRole(resolved.role);
    setShowAuthModal(false);
    setReadNotificationIds(getReadNotificationIds(resolved.uid));

    if (!hasAutoRoutedRef.current) {
      hasAutoRoutedRef.current = true;
      setActiveTab(getDashboardTabForRole(resolved.role));
    }
  };

  const syncSignedInUserProfile = async (fbUser: FirebaseUser) => {
    const userRef = doc(db, 'users', fbUser.uid);
    const isMasterAdmin = Boolean(
      fbUser.email && ADMIN_BOOTSTRAP_EMAILS.has(fbUser.email.toLowerCase())
    );

    let snap;
    try {
      snap = await getDoc(userRef);
    } catch (err) {
      const cached = getCachedProfileForUid(fbUser.uid);
      if (cached) {
        applyResolvedProfile(cached);
        return;
      }
      throw err;
    }

    if (snap.exists()) {
      const existingProfile = snap.data() as UserProfile;
      if (
        isMasterAdmin &&
        (existingProfile.role !== 'admin' || existingProfile.accountStatus !== 'active')
      ) {
        const now = new Date().toISOString();
        const upgraded: UserProfile = {
          ...existingProfile,
          displayName: existingProfile.displayName || ADMIN_DISPLAY_NAME,
          firstName: existingProfile.firstName || ADMIN_FIRST_NAME,
          lastName: existingProfile.lastName || ADMIN_LAST_NAME,
          role: 'admin',
          accountStatus: 'active',
          phone: existingProfile.phone || ADMIN_WHATSAPP_PHONE,
          updatedAt: now,
        };
        await setDoc(userRef, upgraded);
        applyResolvedProfile(upgraded);
      } else {
        applyResolvedProfile(existingProfile);
      }
    } else if (isMasterAdmin) {
      const now = new Date().toISOString();
      const adminProfile: UserProfile = {
        uid: fbUser.uid,
        email: fbUser.email || ADMIN_BOOTSTRAP_EMAIL,
        displayName: ADMIN_DISPLAY_NAME,
        firstName: ADMIN_FIRST_NAME,
        lastName: ADMIN_LAST_NAME,
        role: 'admin',
        accountStatus: 'active',
        phone: ADMIN_WHATSAPP_PHONE,
        commune: 'Libreville Centre',
        acceptedTerms: true,
        acceptedTermsAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(userRef, adminProfile);
      applyResolvedProfile(adminProfile);
    }
  };

  // Listen to Firebase Auth persistent session & transparently restore user dashboard
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    authPersistenceReady.finally(() => {
      if (cancelled) return;
      unsub = onAuthStateChanged(auth, async (fbUser) => {
        setFirebaseUser(fbUser);
        setBookings([]);
        setUsers([]);
        setNotifications([]);
        seenNotifIdsRef.current = new Set();
        notifSnapshotReadyRef.current = false;

        if (!fbUser) {
          hasAutoRoutedRef.current = false;
          setUserProfile(null);
          setReadNotificationIds([]);
          setPreviewRole('client');
          setAuthReady(true);
          return;
        }

        try {
          await syncSignedInUserProfile(fbUser);
        } catch (err) {
          console.error('Auth profile check error:', err);
        } finally {
          setAuthReady(true);
        }
      });
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Real-time Firestore listener for /services (prices updated by manager reflect immediately)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'services'),
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteServices = snapshot.docs
            .map((d) => d.data() as ServiceItem)
            .filter((s) => !REMOVED_SERVICE_IDS.has(s.id));
          setServices((prev) => {
            const map = new Map(
              prev.filter((s) => !REMOVED_SERVICE_IDS.has(s.id)).map((s) => [s.id, s])
            );
            remoteServices.forEach((rs) => map.set(rs.id, rs));
            return Array.from(map.values());
          });

          if (isActualAdmin) {
            snapshot.docs.forEach((d) => {
              if (REMOVED_SERVICE_IDS.has(d.id)) {
                deleteDoc(doc(db, 'services', d.id)).catch(() => {});
              }
            });
          }
        }
      },
      (error) => {
        console.warn('Services snapshot fallback to local:', error.message);
      }
    );
    return () => unsub();
  }, [isActualAdmin]);

  // Real-time Firestore listener for approved promotions (and all promotions for Admin)
  useEffect(() => {
    const promoRef = collection(db, 'promotions');
    const q =
      userProfile?.role === 'admin'
        ? promoRef
        : query(promoRef, where('status', '==', 'approved'));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const remotePromos = snapshot.docs.map((d) => d.data() as Promotion);
        setPromotions(remotePromos);
      },
      (error) => {
        console.warn('Promotions snapshot fallback:', error.message);
      }
    );
    return () => unsub();
  }, [userProfile]);

  // Real-time Firestore listener for /bookings with strict client isolation
  useEffect(() => {
    if (!authReady || !firebaseUser || !userProfile) {
      setBookings([]);
      return;
    }

    const bookingsRef = collection(db, 'bookings');
    const q =
      userProfile.role === 'client'
        ? query(bookingsRef, where('ownerUid', '==', firebaseUser.uid))
        : bookingsRef;

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const remoteBookings = snapshot.docs.map((d) => d.data() as Booking);
        if (userProfile.role === 'client') {
          setBookings(remoteBookings.filter((b) => b.ownerUid === firebaseUser.uid));
        } else {
          setBookings(remoteBookings);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      }
    );

    return () => unsub();
  }, [authReady, firebaseUser, userProfile]);

  // Real-time Firestore listener for /users when signed in as Admin
  useEffect(() => {
    if (!authReady || !firebaseUser || userProfile?.role !== 'admin') {
      setUsers([]);
      return;
    }

    const unsub = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const remoteUsers = snapshot.docs.map((d) => d.data() as UserProfile);
        setUsers(remoteUsers);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    return () => unsub();
  }, [authReady, firebaseUser, userProfile]);

  // Real-time Firestore listener for targeted push notifications (/notifications)
  useEffect(() => {
    if (!authReady || !firebaseUser || !userProfile) {
      setNotifications([]);
      return;
    }

    const notifRef = collection(db, 'notifications');
    const q =
      userProfile.role === 'admin'
        ? notifRef
        : query(notifRef, where('targetRoles', 'array-contains', userProfile.role));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const allItems = snapshot.docs
          .map((d) => d.data() as AppNotification)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        const matchesUser = (n: AppNotification) => {
          if (userProfile.role === 'agent' && n.targetAgentNames && n.targetAgentNames.length > 0) {
            return n.targetAgentNames.includes(userProfile.displayName);
          }
          return true;
        };

        const relevant = allItems.filter(matchesUser);
        setNotifications(relevant);

        if (!notifSnapshotReadyRef.current) {
          relevant.forEach((n) => seenNotifIdsRef.current.add(n.id));
          notifSnapshotReadyRef.current = true;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const added = change.doc.data() as AppNotification;
            if (!seenNotifIdsRef.current.has(added.id) && matchesUser(added)) {
              seenNotifIdsRef.current.add(added.id);
              if (
                added.actorUid !== firebaseUser.uid ||
                added.type === 'promo_approved'
              ) {
                setLiveToast(added);
                showBrowserPushNotification(added);
              }
            }
          }
        });
      },
      (error) => {
        console.warn('Notifications listener notice:', error.message);
      }
    );

    return () => unsub();
  }, [authReady, firebaseUser, userProfile]);

  useEffect(() => {
    if (!liveToast) return;
    const timer = setTimeout(() => setLiveToast(null), 6500);
    return () => clearTimeout(timer);
  }, [liveToast]);

  const handleRoleSwitch = (nextRole: Role) => {
    setPreviewRole(nextRole);
    if (activeTab === 'suivi_commande' && nextRole !== 'manager' && nextRole !== 'admin') {
      setActiveTab('home');
    } else if (activeTab === 'agent_space' && nextRole !== 'agent') {
      setActiveTab('home');
    } else if (activeTab === 'admin' && nextRole !== 'admin') {
      setActiveTab('home');
    }
  };

  const handleEnablePushNotifications = async () => {
    const result = await requestPushPermission();
    setPushPermission(result);
  };

  const handleMarkNotificationRead = (notifId: string) => {
    if (!userProfile) return;
    setReadNotificationIds((prev) => {
      if (prev.includes(notifId)) return prev;
      const next = [...prev, notifId];
      saveReadNotificationIds(userProfile.uid, next);
      return next;
    });
  };

  const handleMarkAllNotificationsRead = () => {
    if (!userProfile) return;
    const allIds = Array.from(
      new Set([...readNotificationIds, ...notifications.map((n) => n.id)])
    );
    setReadNotificationIds(allIds);
    saveReadNotificationIds(userProfile.uid, allIds);
  };

  // Simulated GPS movement for active in-transit agents
  useEffect(() => {
    const interval = setInterval(() => {
      setBookings((prev) =>
        prev.map((b) => {
          if (b.gpsActive && b.status === 'in_transit' && b.agentGps) {
            const newLat = b.agentGps.lat + (b.clientCoords.lat - b.agentGps.lat) * 0.08;
            const newLng = b.agentGps.lng + (b.clientCoords.lng - b.agentGps.lng) * 0.08;
            return {
              ...b,
              agentGps: { lat: newLat, lng: newLng },
            };
          }
          return b;
        })
      );
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Complete registration & Firestore persistence after classic Auth
  const handleCompleteOnboarding = async (profile: UserProfile) => {
    hasAutoRoutedRef.current = true;
    setUserProfile(profile);
    setCachedProfileForUid(profile);
    setPreviewRole(profile.role);
    setShowAuthModal(false);
    setReadNotificationIds(getReadNotificationIds(profile.uid));

    const activeAuthUser = firebaseUser || auth.currentUser;
    if (activeAuthUser) {
      try {
        await setDoc(doc(db, 'users', profile.uid), profile);

        const roleLabel =
          profile.role === 'manager'
            ? 'Entreprise / Gérant'
            : profile.role === 'agent'
            ? 'Agent technicien'
            : profile.role === 'admin'
            ? 'Administrateur'
            : 'Client';

        if (profile.role !== 'admin') {
          await publishNotification({
            type: 'new_registration',
            title:
              profile.role === 'manager'
                ? 'Nouvelle inscription Entreprise à valider'
                : `Nouvelle inscription (${roleLabel})`,
            body: profile.companyName
              ? `${profile.companyName} (${profile.displayName}) à ${profile.commune || 'Libreville'} attend validation.`
              : `${profile.displayName} (${roleLabel}) vient de s'inscrire à ${profile.commune || 'Libreville'}.`,
            targetRoles: ['manager', 'admin'],
            relatedId: profile.uid,
            relatedTab: 'admin',
            actorUid: profile.uid,
          });
        }

        if (pendingBooking) {
          const scopedBooking: Booking = {
            ...pendingBooking,
            ownerUid: profile.uid,
            clientName: pendingBooking.clientName || profile.displayName,
            clientPhone: pendingBooking.clientPhone || profile.phone,
          };
          setPendingBooking(null);
          setBookings((prev) => [scopedBooking, ...prev]);
          setActiveTab('mes_reservations');
          await setDoc(doc(db, 'bookings', scopedBooking.id), scopedBooking);
          await publishNotification({
            type: 'new_booking',
            title: `Nouvelle commande #${scopedBooking.id}`,
            body: `${scopedBooking.clientName} · ${scopedBooking.serviceName} à ${scopedBooking.commune} (${scopedBooking.clientOfferPrice.toLocaleString()} XAF)`,
            targetRoles:
              scopedBooking.assignedAgents.length > 0
                ? ['manager', 'admin', 'agent']
                : ['manager', 'admin'],
            ...(scopedBooking.assignedAgents.length > 0
              ? { targetAgentNames: scopedBooking.assignedAgents }
              : {}),
            relatedId: scopedBooking.id,
            relatedTab: 'suivi_commande',
            actorUid: profile.uid,
          });
        } else {
          setActiveTab(getDashboardTabForRole(profile.role));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${profile.uid}`);
      }
    }
  };

  const handleSignOut = async () => {
    if (firebaseUser) {
      clearCachedProfileForUid(firebaseUser.uid);
    }
    hasAutoRoutedRef.current = false;
    await signOut(auth);
    setUserProfile(null);
    setBookings([]);
    setUsers([]);
    setNotifications([]);
    setPreviewRole('client');
    setActiveTab('home');
  };

  // Client Actions
  const handleCreateBooking = async (newBooking: Booking) => {
    if (!firebaseUser || !userProfile) {
      setPendingBooking(newBooking);
      setSelectedService(null);
      setShowAuthModal(true);
      return;
    }

    if (isAccountBanned) return;

    const scopedBooking: Booking = {
      ...newBooking,
      ownerUid: firebaseUser.uid,
    };

    setBookings((prev) => [scopedBooking, ...prev]);
    setSelectedService(null);
    setActiveTab('mes_reservations');

    try {
      await setDoc(doc(db, 'bookings', scopedBooking.id), scopedBooking);
      await publishNotification({
        type: 'new_booking',
        title: `Nouvelle commande #${scopedBooking.id}`,
        body: `${scopedBooking.clientName} · ${scopedBooking.serviceName} à ${scopedBooking.commune} (${scopedBooking.clientOfferPrice.toLocaleString()} XAF)`,
        targetRoles:
          scopedBooking.assignedAgents.length > 0
            ? ['manager', 'admin', 'agent']
            : ['manager', 'admin'],
        ...(scopedBooking.assignedAgents.length > 0
          ? { targetAgentNames: scopedBooking.assignedAgents }
          : {}),
        relatedId: scopedBooking.id,
        relatedTab: 'suivi_commande',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `bookings/${scopedBooking.id}`);
    }
  };

  const persistBookingPatch = async (bookingId: string, patch: Partial<Booking>) => {
    const updatedAt = new Date().toISOString();
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, ...patch, updatedAt } : b))
    );

    if (firebaseUser && !isAccountBanned) {
      try {
        const ref = doc(db, 'bookings', bookingId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await updateDoc(ref, { ...patch, updatedAt });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
      }
    }
  };

  const handleAcceptCounterOffer = (bookingId: string) => {
    persistBookingPatch(bookingId, { status: 'confirmed' });
  };

  const handleSubmitReview = (bookingId: string, rating: number, comment: string) => {
    const nowLabel = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    persistBookingPatch(bookingId, {
      rating,
      review: comment,
      reviewSubmittedAt: `Aujourd'hui à ${nowLabel}`,
    });
  };

  const handleToggleClientGps = (
    bookingId: string,
    coords?: { lat: number; lng: number }
  ) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;
    const nextState = !target.clientGpsActive;
    persistBookingPatch(bookingId, {
      clientGpsActive: nextState,
      ...(coords ? { clientCoords: coords } : {}),
    });
  };

  // Manager / Admin Actions
  const handleValidateOrder = (bookingId: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    const busyAgentNames = new Set(
      bookings
        .filter((b) => b.id !== bookingId && (b.status === 'in_transit' || b.status === 'in_progress'))
        .flatMap((b) => b.assignedAgents)
    );
    const firstAvailableAgent = users.find(
      (u) => u.role === 'agent' && u.accountStatus === 'active' && !busyAgentNames.has(u.displayName)
    )?.displayName;
    const assigned =
      target && target.assignedAgents.length > 0
        ? target.assignedAgents
        : firstAvailableAgent
        ? [firstAvailableAgent]
        : [];

    persistBookingPatch(bookingId, {
      status: 'confirmed',
      assignedAgents: assigned,
    });

    if (assigned.length > 0 && target) {
      publishNotification({
        type: 'agent_assigned',
        title: `Mission confirmée #${bookingId}`,
        body: `Agent(s) affecté(s) : ${assigned.join(', ')} — ${target.serviceName} (${target.commune}).`,
        targetRoles: ['agent', 'manager', 'admin'],
        targetAgentNames: assigned,
        relatedId: bookingId,
        relatedTab: 'agent_space',
      });
    }
  };

  const handleRefuseOrder = (bookingId: string, reason: string) => {
    persistBookingPatch(bookingId, {
      status: 'cancelled',
      gpsActive: false,
      rejectionReason: reason,
    });
  };

  const handleUpdatePrice = (bookingId: string, newPrice: number, note: string) => {
    persistBookingPatch(bookingId, {
      managerCounterPrice: newPrice,
      finalPrice: newPrice,
      priceAdjustmentNote: note,
      status: 'counter_offered',
    });
  };

  const handleAssignAgents = (bookingId: string, agents: string[]) => {
    const target = bookings.find((b) => b.id === bookingId);
    persistBookingPatch(bookingId, {
      assignedAgents: agents,
      agentGps: target?.agentGps || { lat: 0.391, lng: 9.452 },
    });

    if (agents.length > 0 && target) {
      publishNotification({
        type: 'agent_assigned',
        title: `Nouvelle affectation #${bookingId}`,
        body: `${agents.join(', ')} affecté(s) sur ${target.serviceName} à ${target.commune}.`,
        targetRoles: ['agent', 'manager', 'admin'],
        targetAgentNames: agents,
        relatedId: bookingId,
        relatedTab: 'agent_space',
      });
    }
  };

  const handleUpdateServiceBasePrice = async (serviceId: string, newBasePrice: number) => {
    const updatedAt = new Date().toISOString();
    const updatedBy = userProfile?.displayName || 'Gérant Alp Group';
    let updatedService: ServiceItem | undefined;

    setServices((prev) =>
      prev.map((s) => {
        if (s.id === serviceId) {
          updatedService = { ...s, basePrice: newBasePrice, updatedBy, updatedAt };
          return updatedService;
        }
        return s;
      })
    );

    if (firebaseUser && updatedService) {
      try {
        await setDoc(doc(db, 'services', serviceId), updatedService);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `services/${serviceId}`);
      }
    }
  };

  const handleCreatePromotion = async (
    promoInput: Omit<Promotion, 'id' | 'status' | 'createdAt' | 'createdByUid'>
  ) => {
    const newPromo: Promotion = {
      ...promoInput,
      id: `promo-${Date.now()}`,
      status: isActualAdmin ? 'approved' : 'pending',
      createdByUid: firebaseUser?.uid || '',
      createdAt: new Date().toISOString(),
    };
    setPromotions((prev) => [newPromo, ...prev]);

    if (firebaseUser) {
      try {
        await setDoc(doc(db, 'promotions', newPromo.id), newPromo);
        if (newPromo.status === 'approved') {
          await publishNotification({
            type: 'promo_approved',
            title: `Nouvelle promotion : ${newPromo.discountLabel}`,
            body: `${newPromo.title} (${newPromo.companyName}) — Disponible dès maintenant à Libreville.`,
            targetRoles: ['client', 'agent', 'manager', 'admin'],
            relatedId: newPromo.id,
            relatedTab: 'home',
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `promotions/${newPromo.id}`);
      }
    }
  };

  // Admin Governance Actions
  const handleUpdateUserStatus = async (
    uid: string,
    status: AccountStatus,
    reason?: string
  ) => {
    const updatedAt = new Date().toISOString();
    setUsers((prev) =>
      prev.map((u) =>
        u.uid === uid
          ? {
              ...u,
              accountStatus: status,
              ...(reason ? { banReason: reason } : {}),
              updatedAt,
            }
          : u
      )
    );

    if (firebaseUser && isActualAdmin) {
      try {
        const ref = doc(db, 'users', uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await updateDoc(ref, {
            accountStatus: status,
            ...(reason ? { banReason: reason } : {}),
            updatedAt,
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    }
  };

  const handleDeleteUser = async (uid: string) => {
    setUsers((prev) => prev.filter((u) => u.uid !== uid));
    if (firebaseUser && isActualAdmin) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
      }
    }
  };

  const handlePurgePrototypeData = async (): Promise<{
    users: number;
    bookings: number;
    promos: number;
  }> => {
    let purgedUsers = 0;
    let purgedBookings = 0;
    let purgedPromos = 0;

    try {
      LEGACY_PROTOTYPE_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }

    if (!firebaseUser || !isActualAdmin) {
      return { users: 0, bookings: 0, promos: 0 };
    }

    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const d of usersSnap.docs) {
        const u = d.data() as UserProfile;
        const emailLower = (u.email || '').toLowerCase();
        const isTestUser =
          d.id !== firebaseUser.uid &&
          emailLower !== ADMIN_BOOTSTRAP_EMAIL.toLowerCase() &&
          (d.id.startsWith('usr-') || PROTOTYPE_EMAILS.has(emailLower));
        if (isTestUser) {
          await deleteDoc(doc(db, 'users', d.id));
          purgedUsers += 1;
        }
      }

      const bookingsSnap = await getDocs(collection(db, 'bookings'));
      for (const d of bookingsSnap.docs) {
        const b = d.data() as Booking;
        const isTestBooking =
          PROTOTYPE_BOOKING_IDS.has(d.id) || b.ownerUid.startsWith('usr-');
        if (isTestBooking) {
          await deleteDoc(doc(db, 'bookings', d.id));
          purgedBookings += 1;
        }
      }

      const promosSnap = await getDocs(collection(db, 'promotions'));
      for (const d of promosSnap.docs) {
        const p = d.data() as Promotion;
        const isTestPromo =
          PROTOTYPE_PROMO_IDS.has(d.id) || p.createdByUid.startsWith('usr-');
        if (isTestPromo) {
          await deleteDoc(doc(db, 'promotions', d.id));
          purgedPromos += 1;
        }
      }

      for (const removedId of REMOVED_SERVICE_IDS) {
        await deleteDoc(doc(db, 'services', removedId)).catch(() => {});
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'prototype-purge');
    }

    return { users: purgedUsers, bookings: purgedBookings, promos: purgedPromos };
  };

  const handleUpdatePromotionStatus = async (
    promoId: string,
    status: 'approved' | 'rejected'
  ) => {
    const targetPromo = promotions.find((p) => p.id === promoId);
    setPromotions((prev) =>
      prev.map((p) => (p.id === promoId ? { ...p, status } : p))
    );

    if (firebaseUser && isActualAdmin) {
      try {
        const ref = doc(db, 'promotions', promoId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await updateDoc(ref, { status });
          if (status === 'approved' && targetPromo) {
            await publishNotification({
              type: 'promo_approved',
              title: `Promotion validée : ${targetPromo.discountLabel}`,
              body: `${targetPromo.title} (${targetPromo.companyName}) — Offre ouverte à tout l'écosystème à Libreville.`,
              targetRoles: ['client', 'agent', 'manager', 'admin'],
              relatedId: promoId,
              relatedTab: 'home',
            });
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `promotions/${promoId}`);
      }
    }
  };

  // Agent Actions
  const handleToggleGps = (bookingId: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;
    const nextGps = !target.gpsActive;
    persistBookingPatch(bookingId, {
      gpsActive: nextGps,
      status: nextGps && target.status === 'confirmed' ? 'in_transit' : target.status,
      agentGps: target.agentGps || { lat: 0.389, lng: 9.451 },
    });
  };

  const handleStartPlacement = (bookingId: string, beforePhotoUrl?: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    const nowLabel = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    persistBookingPatch(bookingId, {
      status: 'in_progress',
      startedAt: `Aujourd'hui à ${nowLabel}`,
      beforePhotos: beforePhotoUrl
        ? [...(target?.beforePhotos || []), beforePhotoUrl]
        : target?.beforePhotos || [],
    });
  };

  const handleFinishPlacement = (bookingId: string, afterPhotoUrl?: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    const nowLabel = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    persistBookingPatch(bookingId, {
      status: 'completed',
      gpsActive: false,
      completedAt: `Aujourd'hui à ${nowLabel}`,
      afterPhotos: afterPhotoUrl
        ? [...(target?.afterPhotos || []), afterPhotoUrl]
        : target?.afterPhotos || [],
    });
  };

  // Unified catalog grouping: combine the 3 vehicle sub-services into one unified card
  const vehicleServices = services.filter((s) => s.category === 'Véhicules');
  const minVehiclePrice = Math.min(...vehicleServices.map((s) => s.basePrice));
  const nonVehicleServices = services.filter((s) => s.category !== 'Véhicules');

  const visibleNonVehicleServices = nonVehicleServices.filter((srv) => {
    if (serviceFilter === 'vehicles') return false;
    if (serviceFilter === 'btp') return srv.category === 'BTP';
    if (serviceFilter === 'home') return srv.category !== 'BTP';
    return true;
  });

  const showUnifiedVehicleCard = serviceFilter === 'all' || serviceFilter === 'vehicles';
  const approvedPromotions = promotions.filter((p) => p.status === 'approved');

  const visibleNotifications = isActualAdmin
    ? notifications.filter((n) => n.targetRoles.includes(currentRole))
    : notifications;

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex flex-col items-center justify-center p-6 gap-4">
        <img
          src={BRAND_LOGO_URL}
          alt={APP_OFFICIAL_NAME}
          className="w-16 h-16 rounded-2xl object-contain bg-white p-1 border border-slate-200 shadow-sm"
          referrerPolicy="no-referrer"
        />
        <div className="text-center space-y-1">
          <div className="text-sm font-bold text-slate-900">{APP_OFFICIAL_NAME}</div>
          <div className="text-xs text-slate-500">Restauration de votre session sécurisée...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-900 pb-10">
      {/* STICKY TOP HEADER + UNIFIED NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        {/* Main Brand & Account Row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3 sm:gap-6">
          {/* Zone 1: Permanent Logo + Official Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none min-w-0"
          >
            <img
              src={BRAND_LOGO_URL}
              alt={APP_OFFICIAL_NAME}
              className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 border border-slate-200 shrink-0"
              referrerPolicy="no-referrer"
            />
            <span className="text-sm sm:text-base font-extrabold tracking-tight text-emerald-950 truncate">
              {APP_OFFICIAL_NAME}
            </span>
          </button>

          {/* Zone 2: Desktop Single-line Navigation Links */}
          <nav
            aria-label="Navigation principale"
            className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                activeTab === 'home'
                  ? 'text-emerald-800 font-semibold border-b-2 border-emerald-700'
                  : 'hover:text-slate-900'
              }`}
            >
              Accueil
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('services')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                activeTab === 'services'
                  ? 'text-emerald-800 font-semibold border-b-2 border-emerald-700'
                  : 'hover:text-slate-900'
              }`}
            >
              Services & BTP
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('mes_reservations')}
              className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                activeTab === 'mes_reservations'
                  ? 'text-emerald-800 font-semibold border-b-2 border-emerald-700'
                  : 'hover:text-slate-900'
              }`}
            >
              Mes Réservations
            </button>

            {isManagerOrAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('suivi_commande')}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                  activeTab === 'suivi_commande'
                    ? 'text-emerald-800 font-semibold border-b-2 border-emerald-700'
                    : 'hover:text-slate-900'
                }`}
              >
                Suivi et Commande
              </button>
            )}

            {currentRole === 'agent' && (
              <button
                type="button"
                onClick={() => setActiveTab('agent_space')}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                  activeTab === 'agent_space'
                    ? 'text-emerald-800 font-semibold border-b-2 border-emerald-700'
                    : 'hover:text-slate-900'
                }`}
              >
                Espace Agent
              </button>
            )}

            {(currentRole === 'admin' || isActualAdmin) && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
                  activeTab === 'admin'
                    ? 'text-emerald-800 font-semibold border-b-2 border-emerald-700'
                    : 'hover:text-slate-900'
                }`}
              >
                Bureau Admin
              </button>
            )}
          </nav>

          {/* Zone 3: PWA Install / Notification Bell / Auth / Role Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />

            {firebaseUser && userProfile && (
              <NotificationBell
                notifications={visibleNotifications}
                readIds={readNotificationIds}
                pushPermission={pushPermission}
                onEnablePush={handleEnablePushNotifications}
                onMarkAsRead={handleMarkNotificationRead}
                onMarkAllAsRead={handleMarkAllNotificationsRead}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {isActualAdmin && (
              <select
                aria-label="Changer de vue rôle"
                value={currentRole}
                onChange={(e) => handleRoleSwitch(e.target.value as Role)}
                className="bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-2.5 py-2 min-h-[40px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <option value="client">Vue : Client</option>
                <option value="agent">Vue : Agent</option>
                <option value="manager">Vue : Gérant</option>
                <option value="admin">Vue : Admin</option>
              </select>
            )}

            {firebaseUser && userProfile ? (
              <button
                type="button"
                onClick={handleSignOut}
                title="Se déconnecter"
                className="px-3 py-2 min-h-[40px] bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{userProfile.displayName.split(' ')[0]}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="px-3.5 py-2 min-h-[40px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Connexion</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile & Tablet Top Sub-Navigation Bar (moved from bottom to top, sticky under header) */}
        <nav
          aria-label="Navigation mobile supérieure"
          className="lg:hidden border-t border-slate-100 bg-slate-50/90 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto"
        >
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'home'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Accueil</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'services'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Services</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mes_reservations')}
            className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'mes_reservations'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Réservations</span>
          </button>

          {isManagerOrAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('suivi_commande')}
              className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'suivi_commande'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Suivi &amp; Cmd</span>
            </button>
          )}

          {currentRole === 'agent' && (
            <button
              type="button"
              onClick={() => setActiveTab('agent_space')}
              className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'agent_space'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Agent</span>
            </button>
          )}

          {(currentRole === 'admin' || isActualAdmin) && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'admin'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}
        </nav>
      </header>

      {/* ACCOUNT STATUS ALERTS */}
      {isAccountPending && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-950 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Votre inscription entreprise ({userProfile?.companyName}) est en attente de validation par l'administrateur central.
          </span>
        </div>
      )}

      {(isAccountBanned || isAccountRejected) && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-xs text-rose-900 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>
            {isAccountBanned
              ? `Compte suspendu par l'administrateur : ${userProfile?.banReason || 'Non-respect des règles'}`
              : "Votre demande d'inscription a été refusée par l'administrateur."}
          </span>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        {/* ==================== ACCUEIL ==================== */}
        {activeTab === 'home' && (
          <div className="space-y-10">
            {/* Hero Section */}
            <section className="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-xl">
              <div className="absolute inset-0">
                <img
                  src="/src/assets/images/cleaning_hero_librevile_1794914545784.jpg"
                  alt="Équipe professionnelle Shine-x-Sanitize Alp Group à Libreville"
                  className="w-full h-full object-cover opacity-40"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/30" />
              </div>

              <div className="relative z-10 px-6 sm:px-10 py-12 sm:py-16 max-w-2xl space-y-5">
                <div className="flex items-center gap-3">
                  <img
                    src={BRAND_LOGO_URL}
                    alt={APP_OFFICIAL_NAME}
                    className="w-11 h-11 rounded-xl object-contain bg-white p-0.5 border border-white/25 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-xs font-medium text-emerald-300">
                    {APP_OFFICIAL_NAME} · Libreville, Akanda & Owendo
                  </div>
                </div>

                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight [text-wrap:balance]">
                  Propreté Professionnelle, BTP & Mobilité à Domicile
                </h1>

                <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-xl">
                  Mobilier, nettoyage après travaux BTP, voitures 4 roues, motos et vélos. Tarifs ajustés au marché gabonais, suivi GPS client/agent en temps réel et paiement Airtel ou Moov Money.
                </p>

                {/* Home Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('mes_reservations')}
                    className="px-5 py-3 min-h-[48px] bg-emerald-700 hover:bg-emerald-600 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <CalendarCheck className="w-4 h-4" />
                    <span>Mes Réservations</span>
                  </button>

                  {isManagerOrAdmin && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('suivi_commande')}
                      className="px-5 py-3 min-h-[48px] bg-white hover:bg-slate-100 text-emerald-950 text-xs sm:text-sm font-bold rounded-xl shadow-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <ClipboardList className="w-4 h-4 text-emerald-700" />
                      <span>Suivi et Commande</span>
                    </button>
                  )}

                  {currentRole === 'agent' && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('agent_space')}
                      className="px-5 py-3 min-h-[48px] bg-white hover:bg-slate-100 text-emerald-950 text-xs sm:text-sm font-bold rounded-xl shadow-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <Wrench className="w-4 h-4 text-emerald-700" />
                      <span>Espace Agent (GPS & Photos)</span>
                    </button>
                  )}

                  {(currentRole === 'admin' || isActualAdmin) && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('admin')}
                      className="px-5 py-3 min-h-[48px] bg-emerald-950 hover:bg-emerald-900 text-emerald-100 text-xs sm:text-sm font-bold rounded-xl border border-emerald-700 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Bureau Administrateur</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowVehicleMobilityModal(true)}
                    className="px-5 py-3 min-h-[48px] bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-xs sm:text-sm font-semibold rounded-xl border border-white/25 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Car className="w-4 h-4" />
                    <span>Véhicules & Mobilité</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Quick-Access Role Cards */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('mes_reservations')}
                className="text-left bg-white hover:border-emerald-700 border border-slate-200 rounded-2xl p-5 shadow-sm transition-colors flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-emerald-700" />
                    <span>Mes Réservations & GPS</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Partagez votre GPS client, suivez vos agents en direct, écrivez au gérant sur WhatsApp ou publiez un avis.
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
              </button>

              {isManagerOrAdmin ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('suivi_commande')}
                  className="text-left bg-emerald-900 hover:bg-emerald-800 text-white rounded-2xl p-5 shadow-sm transition-colors flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="text-sm font-bold flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-emerald-300" />
                      <span>Suivi et Commande</span>
                    </div>
                    <p className="text-xs text-emerald-100 leading-relaxed">
                      Validez/refusez les commandes, modifiez vos tarifs d'accueil en direct et suivez les GPS clients & agents.
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-300 shrink-0 mt-1" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowVehicleMobilityModal(true)}
                  className="text-left bg-white hover:border-emerald-700 border border-slate-200 rounded-2xl p-5 shadow-sm transition-colors flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Car className="w-4 h-4 text-emerald-700" />
                      <span>Véhicules & Mobilité</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Choisissez entre un vélo, une moto ou un véhicule à 4 roues (avec marque et nombre de places).
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const btpSrv = services.find((s) => s.category === 'BTP');
                  if (btpSrv) setSelectedService(btpSrv);
                }}
                className="text-left bg-white hover:border-emerald-700 border border-slate-200 rounded-2xl p-5 shadow-sm transition-colors flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-emerald-700" />
                    <span>Nettoyage après travaux BTP</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Remise en état de chantiers, villas et bureaux neufs : poussière de ciment, vitres et sols.
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
              </button>
            </section>

            {/* DEDICATED PROMOTIONS SECTION (Admin-Validated Announcements) */}
            {approvedPromotions.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-emerald-700" />
                      <span>Promotions & Offres Validées</span>
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Annonces vérifiées et approuvées par l'administration {APP_OFFICIAL_NAME}.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {approvedPromotions.map((promo) => (
                    <div
                      key={promo.id}
                      className="bg-emerald-900 text-white rounded-2xl p-6 shadow-md flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-emerald-200">
                          <span className="font-bold text-amber-300">{promo.discountLabel}</span>
                          <span>
                            {promo.companyName} · Jusqu'au {promo.validUntil}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white">{promo.title}</h3>
                        <p className="text-xs text-emerald-100 leading-relaxed">
                          {promo.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (promo.serviceCategory === 'Véhicules') {
                            setShowVehicleMobilityModal(true);
                          } else {
                            const match = services.find(
                              (s) => s.category === promo.serviceCategory
                            );
                            if (match) setSelectedService(match);
                            else setActiveTab('services');
                          }
                        }}
                        className="self-start px-4 py-2 min-h-[40px] bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                      >
                        <span>Profiter de l'offre</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* UNIFIED SERVICES CATALOG ON HOME */}
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Catalogue & Tarifs du Marché (Libreville)
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Tarifs de base actualisés en temps réel par le gérant de l'entreprise.
                  </p>
                </div>

                <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start">
                  <button
                    type="button"
                    onClick={() => setServiceFilter('all')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      serviceFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilter('vehicles')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      serviceFilter === 'vehicles'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    Véhicules & Mobilité
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilter('btp')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      serviceFilter === 'btp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Travaux BTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilter('home')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      serviceFilter === 'home' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Maison & Bureaux
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Unified Véhicules & Mobilité Card */}
                {showUnifiedVehicleCard && (
                  <div className="bg-white rounded-2xl border-2 border-emerald-700/25 overflow-hidden shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="h-48 overflow-hidden bg-slate-100">
                        <img
                          src="/src/assets/images/car_cleaning_librevile_1794917339478.jpg"
                          alt="Véhicules et Mobilité Shine-x-Sanitize Alp Group"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="p-5 space-y-2">
                        <div className="text-xs font-semibold text-emerald-800 flex items-center gap-2">
                          <span>Véhicules & Mobilité</span>
                          <span aria-hidden="true">·</span>
                          <span>Vélo · Moto · 4 Roues</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold tabular-nums">
                            Dès {minVehiclePrice.toLocaleString()} XAF
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">
                          Nettoyage Véhicules & Mobilité
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Cliquez pour sélectionner précisément votre véhicule : vélo, moto/scooter ou véhicule à 4 roues (avec marque et nombre de places).
                        </p>
                      </div>
                    </div>

                    <div className="p-5 pt-0">
                      <button
                        type="button"
                        onClick={() => setShowVehicleMobilityModal(true)}
                        className="w-full py-2.5 min-h-[44px] px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Car className="w-4 h-4" />
                        <span>Choisir Vélo, Moto ou 4 Roues</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Other Services including Nettoyage après travaux BTP */}
                {visibleNonVehicleServices.map((service) => (
                  <div
                    key={service.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="h-48 overflow-hidden bg-slate-100">
                        <img
                          src={service.image}
                          alt={service.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="p-5 space-y-2">
                        <div className="text-xs font-medium text-emerald-800 flex items-center gap-2">
                          <span>{service.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{service.duration}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold tabular-nums">
                            {service.basePrice.toLocaleString()} XAF
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">{service.name}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {service.description}
                        </p>
                      </div>
                    </div>

                    <div className="p-5 pt-0">
                      <button
                        type="button"
                        onClick={() => setSelectedService(service)}
                        className="w-full py-2.5 min-h-[44px] px-4 bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Configurer & Réserver</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ==================== SERVICES CATALOG ==================== */}
        {activeTab === 'services' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Services, BTP & Véhicules — {APP_OFFICIAL_NAME}
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Choisissez la catégorie souhaitée et négociez directement votre devis selon les tarifs du marché.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Unified Vehicle Card */}
              <div className="bg-white rounded-2xl border-2 border-emerald-700/25 overflow-hidden shadow-sm flex flex-col justify-between">
                <div>
                  <div className="h-44 overflow-hidden bg-slate-100">
                    <img
                      src="/src/assets/images/car_cleaning_librevile_1794917339478.jpg"
                      alt="Véhicules et Mobilité"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-5 space-y-2">
                    <div className="text-xs font-semibold text-emerald-800 flex items-center gap-2">
                      <span>Véhicules & Mobilité</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold tabular-nums">
                        Dès {minVehiclePrice.toLocaleString()} XAF
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      Nettoyage Véhicules & Mobilité
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sous-menu dédié : Vélo, Moto ou Véhicule à 4 roues (Voiture / SUV / 4x4 avec marque et nombre de places).
                    </p>
                  </div>
                </div>
                <div className="p-5 pt-0">
                  <button
                    type="button"
                    onClick={() => setShowVehicleMobilityModal(true)}
                    className="w-full py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    Ouvrir le sous-menu Véhicules
                  </button>
                </div>
              </div>

              {nonVehicleServices.map((service) => (
                <div
                  key={service.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="h-44 overflow-hidden bg-slate-100">
                      <img
                        src={service.image}
                        alt={service.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-5 space-y-2">
                      <div className="text-xs font-medium text-emerald-800 flex items-center gap-2">
                        <span>{service.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{service.duration}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold tabular-nums">
                          {service.basePrice.toLocaleString()} XAF
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{service.name}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{service.description}</p>
                    </div>
                  </div>
                  <div className="p-5 pt-0">
                    <button
                      type="button"
                      onClick={() => setSelectedService(service)}
                      className="w-full py-2.5 min-h-[44px] bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      Lancer le Configurateur
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== MES RÉSERVATIONS (ISOLATION STRICTE PAR CLIENT) ==================== */}
        {activeTab === 'mes_reservations' && (
          <ClientReservationsView
            bookings={
              firebaseUser && userProfile
                ? bookings.filter((b) => b.ownerUid === firebaseUser.uid)
                : []
            }
            isAuthenticated={Boolean(firebaseUser && userProfile)}
            onOpenAuth={() => setShowAuthModal(true)}
            onAcceptCounterOffer={handleAcceptCounterOffer}
            onSubmitReview={handleSubmitReview}
            onToggleClientGps={handleToggleClientGps}
            onOpenCatalog={() => setActiveTab('services')}
          />
        )}

        {/* ==================== SUIVI ET COMMANDE (GÉRANT & ADMIN) ==================== */}
        {activeTab === 'suivi_commande' && isManagerOrAdmin && (
          <ManagerOrdersView
            bookings={bookings}
            services={services}
            promotions={promotions}
            registeredAgents={users.filter(
              (u) => u.role === 'agent' && u.accountStatus === 'active'
            )}
            companyDisplayName={userProfile?.companyName || APP_OFFICIAL_NAME}
            onValidateOrder={handleValidateOrder}
            onRefuseOrder={handleRefuseOrder}
            onUpdatePrice={handleUpdatePrice}
            onAssignAgents={handleAssignAgents}
            onUpdateServiceBasePrice={handleUpdateServiceBasePrice}
            onCreatePromotion={handleCreatePromotion}
          />
        )}

        {/* ==================== ESPACE AGENT ==================== */}
        {activeTab === 'agent_space' && currentRole === 'agent' && (
          <AgentWorkspaceView
            bookings={bookings}
            agentName={userProfile?.displayName || 'Agent'}
            onToggleGps={handleToggleGps}
            onStartPlacement={handleStartPlacement}
            onFinishPlacement={handleFinishPlacement}
          />
        )}

        {/* ==================== BUREAU ADMINISTRATEUR ==================== */}
        {activeTab === 'admin' && (currentRole === 'admin' || isActualAdmin) && (
          <AdminDashboardView
            users={users}
            bookings={bookings}
            promotions={promotions}
            commissionRate={commissionRate}
            onChangeCommissionRate={setCommissionRate}
            onUpdateUserStatus={handleUpdateUserStatus}
            onDeleteUser={handleDeleteUser}
            onPurgePrototypeData={handlePurgePrototypeData}
            onUpdatePromotionStatus={handleUpdatePromotionStatus}
            onOpenSuiviCommande={() => setActiveTab('suivi_commande')}
          />
        )}
      </main>

      {/* CLEAN FOOTER */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2.5">
          <img
            src={BRAND_LOGO_URL}
            alt={APP_OFFICIAL_NAME}
            className="w-7 h-7 rounded object-contain bg-white p-0.5 border border-slate-200 shrink-0"
            referrerPolicy="no-referrer"
          />
          <span className="font-semibold text-slate-800">{APP_OFFICIAL_NAME}</span>
          <span aria-hidden="true">·</span>
          <span>Libreville, Akanda & Owendo (Gabon)</span>
        </div>
        <div>Airtel Money · Moov Money · Espèces · Carte bancaire</div>
      </footer>

      {/* UNIFIED VEHICLE & MOBILITY SUB-MENU MODAL */}
      {showVehicleMobilityModal && (
        <VehicleMobilityModal
          vehicleServices={vehicleServices}
          onSelectVehicleService={(srv) => {
            setShowVehicleMobilityModal(false);
            setSelectedService(srv);
          }}
          onClose={() => setShowVehicleMobilityModal(false)}
        />
      )}

      {/* SMART SERVICE CONFIGURATOR MODAL */}
      {selectedService && (
        <ServiceConfiguratorModal
          service={selectedService}
          ownerUid={firebaseUser?.uid || ''}
          defaultClientName={userProfile?.displayName || ''}
          defaultClientPhone={userProfile?.phone || '+241 '}
          onClose={() => setSelectedService(null)}
          onSubmitBooking={handleCreateBooking}
        />
      )}

      {/* AUTHENTICATION & REGISTRATION MODAL */}
      {showAuthModal && (
        <AuthModal
          onAuthComplete={handleCompleteOnboarding}
          onLoginSuccess={() => {
            if (auth.currentUser) {
              syncSignedInUserProfile(auth.currentUser).catch(() => {});
            }
          }}
          onClose={() => {
            setShowAuthModal(false);
          }}
        />
      )}

      <LiveNotificationToast
        notification={liveToast}
        onDismiss={() => setLiveToast(null)}
        onOpenTarget={(notif) => {
          handleMarkNotificationRead(notif.id);
          if (notif.relatedTab) setActiveTab(notif.relatedTab);
          setLiveToast(null);
        }}
      />

      <OfflineIndicator />
    </div>
  );
}
