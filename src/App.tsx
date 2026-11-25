/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  getRedirectResult,
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
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Home,
  Info,
  LogIn,
  LogOut,
  Megaphone,
  ShieldCheck,
  ShoppingCart,
  Sliders,
  Sparkles,
  Tag,
  Wrench,
  X,
} from 'lucide-react';
import { AdminDashboardView } from './components/AdminDashboardView';
import { AgentWorkspaceView } from './components/AgentWorkspaceView';
import { AuthModal } from './components/AuthModal';
import { CartView } from './components/CartView';
import { CompanyValidationGate } from './components/CompanyValidationGate';
import { ClientReservationsView } from './components/ClientReservationsView';
import { ManagerOrdersView } from './components/ManagerOrdersView';
import { NetworkRequiredGate } from './components/NetworkRequiredGate';
import {
  isNotificationFresh,
  LiveNotificationToast,
  NotificationBell,
} from './components/NotificationCenter';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ServiceConfiguratorModal } from './components/ServiceConfiguratorModal';
import { useNetworkStatus } from './hooks/useNetworkStatus';
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
  VEHICLE_4W_INTERIOR_NOTE,
} from './data/mockData';
import { DEFAULT_GPS_POSITION } from './data/quartiers';
import {
  auth,
  authPersistenceReady,
  db,
  formatClassicAuthError,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  AccountStatus,
  ActiveTabId,
  AppNotification,
  AssignedAgentInfo,
  Booking,
  CartItem,
  GpsPoint,
  NotificationType,
  Promotion,
  Role,
  ServiceItem,
  SupplementalServiceOption,
  UserProfile,
} from './types';
import { getBookingItems } from './utils/bookingItems';
import {
  clearCachedProfileForUid,
  getPushPermissionState,
  getReadNotificationIds,
  playAssignmentAlertChime,
  PushPermissionState,
  requestPushPermission,
  saveReadNotificationIds,
  setCachedProfileForUid,
  showBrowserPushNotification,
} from './utils/notifications';
import {
  COMPANY_REJECTION_REASON_MAX,
  getCompanyValidationStatus,
  isCompanyAccessBlocked,
} from './utils/companyValidation';
import { matchServiceForPromotion, parsePromotionDiscount } from './utils/promotions';

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
  services: 'sxs_alp_services_prod_v4',
  cart: 'sxs_alp_cart_v1',
  cartPromo: 'sxs_alp_cart_promo_v1',
  cartExtras: 'sxs_alp_cart_extras_v1',
};

const LEGACY_PROTOTYPE_KEYS = [
  'sxs_alp_services_v2',
  'sxs_alp_services_v3',
  'sxs_alp_services_prod_v1',
  'sxs_alp_services_prod_v2',
  'sxs_alp_services_prod_v3',
  'sxs_alp_bookings_v2',
  'sxs_alp_promotions_v2',
  'sxs_alp_users_v2',
];

const REMOVED_SERVICE_IDS = new Set(['srv-9', 'srv-btp', 'srv-2', 'srv-7', 'srv-6']);
const CANONICAL_SERVICE_BY_ID = new Map(SERVICES.map((s) => [s.id, s]));

function normalizeServiceImages(items: ServiceItem[]): ServiceItem[] {
  const byId = new Map<string, ServiceItem>();
  SERVICES.forEach((canon) => byId.set(canon.id, canon));

  items
    .filter((s) => !REMOVED_SERVICE_IDS.has(s.id))
    .forEach((s) => {
      const canon = CANONICAL_SERVICE_BY_ID.get(s.id);
      if (canon) {
        byId.set(s.id, {
          ...s,
          name: canon.name,
          category: canon.category,
          ...(canon.vehicleType ? { vehicleType: canon.vehicleType } : {}),
          description: canon.description,
          image: canon.image,
          materials: canon.materials,
          availableOptions: canon.availableOptions,
        });
      }
    });

  return Array.from(byId.values());
}

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
  const {
    status: networkStatus,
    isChecking: isCheckingNetwork,
    retry: retryNetworkCheck,
  } = useNetworkStatus();

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [verifiedRoleUid, setVerifiedRoleUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authRedirectError, setAuthRedirectError] = useState('');
  const [pendingGoogleUser, setPendingGoogleUser] = useState<FirebaseUser | null>(null);
  const [pendingPartialProfile, setPendingPartialProfile] = useState<Partial<UserProfile> | null>(
    null
  );
  const completingOnboardingUidRef = useRef<string | null>(null);

  const [previewRole, setPreviewRole] = useState<Role>('client');
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'vehicles' | 'home'>('all');

  const [services, setServices] = useState<ServiceItem[]>(() =>
    normalizeServiceImages(loadLocal(STORAGE_KEYS.services, SERVICES))
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
  const [configuratorIntent, setConfiguratorIntent] = useState<'order' | 'cart'>('order');
  const [activePromotion, setActivePromotion] = useState<Promotion | null>(null);
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);
  const pendingBookingFromCartRef = useRef(false);
  const [commissionRate, setCommissionRate] = useState<number>(10);

  const [cartItems, setCartItems] = useState<CartItem[]>(() =>
    loadLocal<CartItem[]>(STORAGE_KEYS.cart, [])
  );
  const [cartExtras, setCartExtras] = useState<SupplementalServiceOption[]>(() =>
    loadLocal<SupplementalServiceOption[]>(STORAGE_KEYS.cartExtras, [])
  );
  const [cartPromotion, setCartPromotion] = useState<Promotion | null>(() =>
    loadLocal<Promotion | null>(STORAGE_KEYS.cartPromo, null)
  );
  const [cartFeedback, setCartFeedback] = useState('');
  const [isSubmittingCartOrder, setIsSubmittingCartOrder] = useState(false);
  const [cartSubmitError, setCartSubmitError] = useState('');
  const cartTotalUnits = cartItems.reduce(
    (sum, item) => sum + Math.max(1, item.quantity || 1),
    0
  );

  // Determine effective role (authenticated profile takes precedence; Admin can also switch views)
  const currentRole: Role = userProfile
    ? userProfile.role === 'admin'
      ? previewRole
      : userProfile.role
    : previewRole;

  const isActualAdmin = userProfile?.role === 'admin';
  const isManagerOrAdmin = currentRole === 'manager' || currentRole === 'admin';
  const isAccountBanned = userProfile?.accountStatus === 'banned';
  // Entreprise / Gérant : tant que l'administrateur n'a pas validé (status !== 'approved'),
  // tout accès au tableau de bord et aux fonctionnalités est bloqué par un écran plein écran.
  const companyValidationStatus = getCompanyValidationStatus(userProfile);
  const isCompanyBlocked = isCompanyAccessBlocked(userProfile);

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

  // Persist client shopping cart & cart promotion
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cartItems));
    } catch {
      // ignore storage quota errors
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      if (cartPromotion) {
        localStorage.setItem(STORAGE_KEYS.cartPromo, JSON.stringify(cartPromotion));
      } else {
        localStorage.removeItem(STORAGE_KEYS.cartPromo);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [cartPromotion]);

  useEffect(() => {
    try {
      if (cartExtras.length > 0) {
        localStorage.setItem(STORAGE_KEYS.cartExtras, JSON.stringify(cartExtras));
      } else {
        localStorage.removeItem(STORAGE_KEYS.cartExtras);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [cartExtras]);

  useEffect(() => {
    if (!cartFeedback) return;
    const timer = setTimeout(() => setCartFeedback(''), 5000);
    return () => clearTimeout(timer);
  }, [cartFeedback]);

  const publishNotification = async (params: {
    type: NotificationType;
    title: string;
    body: string;
    message?: string;
    targetRoles: Role[];
    targetAgentNames?: string[];
    targetOwnerUid?: string;
    recipientId?: string;
    orderId?: string;
    relatedId: string;
    relatedTab: ActiveTab;
    actorUid?: string;
    read?: boolean;
    throwOnError?: boolean;
  }) => {
    const uid = params.actorUid || auth.currentUser?.uid;
    if (!uid) return;
    const notifId = `notif-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const notif: AppNotification = {
      id: notifId,
      type: params.type,
      title: params.title.slice(0, 140),
      body: params.body.slice(0, 400),
      ...(params.message ? { message: params.message.slice(0, 400) } : {}),
      targetRoles: params.targetRoles,
      ...(params.targetAgentNames && params.targetAgentNames.length > 0
        ? { targetAgentNames: params.targetAgentNames.slice(0, 10) }
        : {}),
      ...(params.targetOwnerUid ? { targetOwnerUid: params.targetOwnerUid } : {}),
      ...(params.recipientId ? { recipientId: params.recipientId } : {}),
      ...(params.orderId ? { orderId: params.orderId } : {}),
      relatedId: params.relatedId,
      relatedTab: params.relatedTab,
      actorUid: uid,
      ...(typeof params.read === 'boolean' ? { read: params.read } : {}),
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'notifications', notifId), notif);
    } catch (err) {
      console.warn('Notification publish skipped:', err);
      if (params.throwOnError) {
        throw err;
      }
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
    await fbUser.getIdToken();
    const userRef = doc(db, 'users', fbUser.uid);
    const isMasterAdmin = Boolean(
      fbUser.email && ADMIN_BOOTSTRAP_EMAILS.has(fbUser.email.toLowerCase())
    );
    const isGoogleProvider = fbUser.providerData.some((p) => p.providerId === 'google.com');

    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const existingProfile = snap.data() as Partial<UserProfile>;
      const hasDefinedRole = Boolean(
        existingProfile.role &&
          ['client', 'agent', 'manager', 'admin'].includes(existingProfile.role)
      );
      const hasDefinedStatus = Boolean(existingProfile.accountStatus || existingProfile.status);

      if (!hasDefinedRole || !hasDefinedStatus) {
        if (completingOnboardingUidRef.current !== fbUser.uid) {
          setPendingGoogleUser(fbUser);
          setPendingPartialProfile(existingProfile);
          setShowAuthModal(true);
        }
        setVerifiedRoleUid(null);
        return;
      }

      setPendingGoogleUser(null);
      setPendingPartialProfile(null);

      if (
        isMasterAdmin &&
        (existingProfile.role !== 'admin' || existingProfile.accountStatus !== 'active')
      ) {
        const now = new Date().toISOString();
        const upgraded: UserProfile = {
          ...(existingProfile as UserProfile),
          displayName: existingProfile.displayName || ADMIN_DISPLAY_NAME,
          firstName: existingProfile.firstName || ADMIN_FIRST_NAME,
          lastName: existingProfile.lastName || ADMIN_LAST_NAME,
          role: 'admin',
          status: 'approved',
          accountStatus: 'active',
          rejectionReason: '',
          phone: existingProfile.phone || ADMIN_WHATSAPP_PHONE,
          updatedAt: now,
        };
        await setDoc(userRef, upgraded);
        applyResolvedProfile(upgraded);
        setVerifiedRoleUid(fbUser.uid);
      } else {
        // Utilisateur existant avec rôle et statut déjà définis : connexion directe sans écrasement
        applyResolvedProfile(existingProfile as UserProfile);
        setVerifiedRoleUid(fbUser.uid);
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
        status: 'approved',
        accountStatus: 'active',
        rejectionReason: '',
        phone: ADMIN_WHATSAPP_PHONE,
        commune: 'Amissa Chantal, Akanda',
        acceptedTerms: true,
        acceptedTermsAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(userRef, adminProfile);
      setPendingGoogleUser(null);
      setPendingPartialProfile(null);
      applyResolvedProfile(adminProfile);
      setVerifiedRoleUid(fbUser.uid);
    } else {
      setVerifiedRoleUid(null);
      if (isGoogleProvider && completingOnboardingUidRef.current !== fbUser.uid) {
        setPendingGoogleUser(fbUser);
        setPendingPartialProfile(null);
        setShowAuthModal(true);
      }
    }
  };

  // Listen to Firebase Auth persistent session & transparently restore user dashboard
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    authPersistenceReady
      .then(() =>
        getRedirectResult(auth).catch((err) => {
          setAuthRedirectError(formatClassicAuthError(err, 'google'));
          setShowAuthModal(true);
          return null;
        })
      )
      .finally(() => {
        if (cancelled) return;
        unsub = onAuthStateChanged(auth, async (fbUser) => {
          setVerifiedRoleUid(null);
          setFirebaseUser(fbUser);
          setBookings([]);
          setUsers([]);
          setNotifications([]);
          seenNotifIdsRef.current = new Set();
          notifSnapshotReadyRef.current = false;

          if (!fbUser) {
            hasAutoRoutedRef.current = false;
            completingOnboardingUidRef.current = null;
            setPendingGoogleUser(null);
            setPendingPartialProfile(null);
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
            setVerifiedRoleUid(null);
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

  // Dès que la connexion Internet est rétablie, s'assure que le profil authentifié est synchronisé
  useEffect(() => {
    if (
      networkStatus === 'online' &&
      authReady &&
      firebaseUser &&
      (!userProfile || verifiedRoleUid !== firebaseUser.uid)
    ) {
      syncSignedInUserProfile(firebaseUser).catch(() => {});
    }
  }, [networkStatus, authReady, firebaseUser, userProfile, verifiedRoleUid]);

  // Live listener on the signed-in company's own /users document while it is awaiting
  // validation (or rejected), so an admin decision unlocks / updates the screen instantly.
  const ownProfileUid = userProfile?.uid;
  useEffect(() => {
    if (
      networkStatus !== 'online' ||
      !authReady ||
      !firebaseUser ||
      !ownProfileUid ||
      verifiedRoleUid !== firebaseUser.uid ||
      !isCompanyBlocked
    ) {
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (!snap.exists()) return;
        const fresh = snap.data() as UserProfile;
        setUserProfile(fresh);
        setCachedProfileForUid(fresh);
        if (getCompanyValidationStatus(fresh) === 'approved') {
          setActiveTab(getDashboardTabForRole(fresh.role));
        }
      },
      (error) => {
        console.warn('Company validation listener notice:', error.message);
      }
    );

    return () => unsub();
  }, [networkStatus, authReady, firebaseUser, ownProfileUid, verifiedRoleUid, isCompanyBlocked]);

  // Real-time Firestore listener for /services (prices updated by manager reflect immediately)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'services'),
      (snapshot) => {
        if (!snapshot.empty) {
          const remoteServices = normalizeServiceImages(
            snapshot.docs.map((d) => d.data() as ServiceItem)
          );
          setServices((prev) => {
            const map = new Map(normalizeServiceImages(prev).map((s) => [s.id, s]));
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

  // Real-time Firestore listener for active promotions (and all promotions for Admin)
  useEffect(() => {
    const promoRef = collection(db, 'promotions');
    const q =
      userProfile?.role === 'admin'
        ? promoRef
        : query(promoRef, where('status', 'in', ['active', 'approved']));

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

  // Real-time Firestore listener for /bookings with strict role & auth-verification guard
  useEffect(() => {
    if (
      networkStatus !== 'online' ||
      !authReady ||
      !firebaseUser ||
      !userProfile ||
      verifiedRoleUid !== firebaseUser.uid ||
      isCompanyAccessBlocked(userProfile)
    ) {
      setBookings([]);
      return;
    }

    const bookingsRef = collection(db, 'bookings');

    if (userProfile.role === 'client') {
      const byOwner = new Map<string, Booking>();
      const byUserId = new Map<string, Booking>();
      const byClientId = new Map<string, Booking>();
      const syncMergedClientBookings = () => {
        const merged = new Map<string, Booking>();
        byOwner.forEach((b, id) => merged.set(id, b));
        byUserId.forEach((b, id) => merged.set(id, b));
        byClientId.forEach((b, id) => merged.set(id, b));
        const list = Array.from(merged.values())
          .filter(
            (b) =>
              b.ownerUid === firebaseUser.uid ||
              b.userId === firebaseUser.uid ||
              b.clientId === firebaseUser.uid
          )
          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        setBookings(list);
      };

      const unsubOwner = onSnapshot(
        query(bookingsRef, where('ownerUid', '==', firebaseUser.uid)),
        (snapshot) => {
          byOwner.clear();
          snapshot.docs.forEach((d) => {
            const data = d.data() as Booking;
            byOwner.set(data.id || d.id, data);
          });
          syncMergedClientBookings();
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'bookings');
        }
      );

      const unsubUserId = onSnapshot(
        query(bookingsRef, where('userId', '==', firebaseUser.uid)),
        (snapshot) => {
          byUserId.clear();
          snapshot.docs.forEach((d) => {
            const data = d.data() as Booking;
            byUserId.set(data.id || d.id, data);
          });
          syncMergedClientBookings();
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'bookings');
        }
      );

      const unsubClientId = onSnapshot(
        query(bookingsRef, where('clientId', '==', firebaseUser.uid)),
        (snapshot) => {
          byClientId.clear();
          snapshot.docs.forEach((d) => {
            const data = d.data() as Booking;
            byClientId.set(data.id || d.id, data);
          });
          syncMergedClientBookings();
        },
        (error) => {
          console.warn('[bookings] Optional clientId listener skipped:', error);
        }
      );

      return () => {
        unsubOwner();
        unsubUserId();
        unsubClientId();
      };
    }

    if (userProfile.role === 'agent') {
      const VALIDATED_AGENT_STATUSES = new Set([
        'confirmed',
        'in_transit',
        'in_progress',
      ]);
      const unsubAgent = onSnapshot(
        query(bookingsRef, where('assignedAgentIds', 'array-contains', firebaseUser.uid)),
        (snapshot) => {
          const remoteBookings = snapshot.docs
            .map((d) => d.data() as Booking)
            .filter((b) => VALIDATED_AGENT_STATUSES.has(b.status))
            .sort((a, b) =>
              (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')
            );
          setBookings(remoteBookings);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'bookings');
        }
      );

      return () => unsubAgent();
    }

    const unsub = onSnapshot(
      bookingsRef,
      (snapshot) => {
        const remoteBookings = snapshot.docs
          .map((d) => d.data() as Booking)
          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        setBookings(remoteBookings);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      }
    );

    return () => unsub();
  }, [networkStatus, authReady, firebaseUser, userProfile, verifiedRoleUid]);

  // Real-time Firestore listener for /users (all users for Admin; active agents for approved Manager)
  useEffect(() => {
    if (
      networkStatus !== 'online' ||
      !authReady ||
      !firebaseUser ||
      !userProfile ||
      verifiedRoleUid !== firebaseUser.uid ||
      isCompanyAccessBlocked(userProfile)
    ) {
      setUsers([]);
      return;
    }

    if (userProfile.role === 'admin') {
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
    }

    if (userProfile.role === 'manager') {
      const unsubAgents = onSnapshot(
        query(
          collection(db, 'users'),
          where('role', '==', 'agent'),
          where('accountStatus', '==', 'active')
        ),
        (snapshot) => {
          const activeAgents = snapshot.docs.map((d) => d.data() as UserProfile);
          setUsers(activeAgents);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'users');
        }
      );

      return () => unsubAgents();
    }

    setUsers([]);
  }, [networkStatus, authReady, firebaseUser, userProfile, verifiedRoleUid]);

  // Real-time Firestore listener for targeted push notifications (/notifications)
  useEffect(() => {
    if (
      networkStatus !== 'online' ||
      !authReady ||
      !firebaseUser ||
      !userProfile ||
      verifiedRoleUid !== firebaseUser.uid ||
      isCompanyAccessBlocked(userProfile)
    ) {
      setNotifications([]);
      return;
    }

    const notifRef = collection(db, 'notifications');

    const matchesUser = (n: AppNotification) => {
      if (!isNotificationFresh(n.createdAt)) return false;
      if (userProfile.role !== 'admin') {
        if (n.recipientId && n.recipientId !== firebaseUser.uid) {
          return false;
        }
        if (n.targetOwnerUid && n.targetOwnerUid !== firebaseUser.uid) {
          return false;
        }
      }
      if (
        userProfile.role === 'agent' &&
        !n.recipientId &&
        n.targetAgentNames &&
        n.targetAgentNames.length > 0
      ) {
        return n.targetAgentNames.includes(userProfile.displayName);
      }
      return true;
    };

    const pruneInterval = setInterval(() => {
      setNotifications((prev) => prev.filter((n) => isNotificationFresh(n.createdAt)));
    }, 60000);

    if (userProfile.role === 'agent') {
      const byRecipient = new Map<string, AppNotification>();
      const byPromo = new Map<string, AppNotification>();
      let recipientReady = false;
      let promoReady = false;

      const syncAgentNotifications = () => {
        const merged = new Map<string, AppNotification>();
        byPromo.forEach((n, id) => merged.set(id, n));
        byRecipient.forEach((n, id) => merged.set(id, n));
        const relevant = Array.from(merged.values())
          .filter(matchesUser)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setNotifications(relevant);
      };

      const processAgentChanges = (
        snapshotDocs: AppNotification[],
        changes: Array<{ type: string; doc: { data: () => unknown } }>,
        isReady: boolean,
        markReady: () => void
      ) => {
        if (!isReady) {
          snapshotDocs.filter(matchesUser).forEach((n) => seenNotifIdsRef.current.add(n.id));
          markReady();
          return;
        }
        changes.forEach((change) => {
          if (change.type === 'added') {
            const added = change.doc.data() as AppNotification;
            if (!seenNotifIdsRef.current.has(added.id) && matchesUser(added)) {
              seenNotifIdsRef.current.add(added.id);
              if (
                added.read !== true &&
                (added.actorUid !== firebaseUser.uid || added.type === 'promo_approved')
              ) {
                setLiveToast(added);
                showBrowserPushNotification(added);
                if (added.type === 'agent_assigned' || added.type === 'agent_encouragement') {
                  playAssignmentAlertChime();
                }
              }
            }
          }
        });
      };

      const unsubRecipient = onSnapshot(
        query(notifRef, where('recipientId', '==', firebaseUser.uid)),
        (snapshot) => {
          byRecipient.clear();
          const docs = snapshot.docs.map((d) => d.data() as AppNotification);
          docs.forEach((n) => byRecipient.set(n.id, n));
          syncAgentNotifications();
          processAgentChanges(docs, snapshot.docChanges(), recipientReady, () => {
            recipientReady = true;
          });
        },
        (error) => {
          console.warn('Agent recipient notifications notice:', error.message);
        }
      );

      const unsubPromo = onSnapshot(
        query(notifRef, where('type', '==', 'promo_approved')),
        (snapshot) => {
          byPromo.clear();
          const docs = snapshot.docs.map((d) => d.data() as AppNotification);
          docs.forEach((n) => byPromo.set(n.id, n));
          syncAgentNotifications();
          processAgentChanges(docs, snapshot.docChanges(), promoReady, () => {
            promoReady = true;
          });
        },
        (error) => {
          console.warn('Agent promo notifications notice:', error.message);
        }
      );

      return () => {
        unsubRecipient();
        unsubPromo();
        clearInterval(pruneInterval);
      };
    }

    if (userProfile.role === 'client') {
      const byRecipient = new Map<string, AppNotification>();
      const byOwner = new Map<string, AppNotification>();
      const byPromo = new Map<string, AppNotification>();
      let recipientReady = false;
      let ownerReady = false;
      let promoReady = false;

      const syncClientNotifications = () => {
        const merged = new Map<string, AppNotification>();
        byPromo.forEach((n, id) => merged.set(id, n));
        byOwner.forEach((n, id) => merged.set(id, n));
        byRecipient.forEach((n, id) => merged.set(id, n));
        const relevant = Array.from(merged.values())
          .filter(matchesUser)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setNotifications(relevant);
      };

      const processClientChanges = (
        snapshotDocs: AppNotification[],
        changes: Array<{ type: string; doc: { data: () => unknown } }>,
        isReady: boolean,
        markReady: () => void
      ) => {
        if (!isReady) {
          snapshotDocs.filter(matchesUser).forEach((n) => seenNotifIdsRef.current.add(n.id));
          markReady();
          return;
        }
        changes.forEach((change) => {
          if (change.type === 'added') {
            const added = change.doc.data() as AppNotification;
            if (!seenNotifIdsRef.current.has(added.id) && matchesUser(added)) {
              seenNotifIdsRef.current.add(added.id);
              if (
                added.read !== true &&
                (added.actorUid !== firebaseUser.uid || added.type === 'promo_approved')
              ) {
                setLiveToast(added);
                showBrowserPushNotification(added);
              }
            }
          }
        });
      };

      const unsubRecipient = onSnapshot(
        query(notifRef, where('recipientId', '==', firebaseUser.uid)),
        (snapshot) => {
          byRecipient.clear();
          const docs = snapshot.docs.map((d) => d.data() as AppNotification);
          docs.forEach((n) => byRecipient.set(n.id, n));
          syncClientNotifications();
          processClientChanges(docs, snapshot.docChanges(), recipientReady, () => {
            recipientReady = true;
          });
        },
        (error) => {
          console.warn('Client recipient notifications notice:', error.message);
        }
      );

      const unsubOwner = onSnapshot(
        query(notifRef, where('targetOwnerUid', '==', firebaseUser.uid)),
        (snapshot) => {
          byOwner.clear();
          const docs = snapshot.docs.map((d) => d.data() as AppNotification);
          docs.forEach((n) => byOwner.set(n.id, n));
          syncClientNotifications();
          processClientChanges(docs, snapshot.docChanges(), ownerReady, () => {
            ownerReady = true;
          });
        },
        (error) => {
          console.warn('Client targetOwnerUid notifications notice:', error.message);
        }
      );

      const unsubPromo = onSnapshot(
        query(notifRef, where('type', '==', 'promo_approved')),
        (snapshot) => {
          byPromo.clear();
          const docs = snapshot.docs.map((d) => d.data() as AppNotification);
          docs.forEach((n) => byPromo.set(n.id, n));
          syncClientNotifications();
          processClientChanges(docs, snapshot.docChanges(), promoReady, () => {
            promoReady = true;
          });
        },
        (error) => {
          console.warn('Client promo notifications notice:', error.message);
        }
      );

      return () => {
        unsubRecipient();
        unsubOwner();
        unsubPromo();
        clearInterval(pruneInterval);
      };
    }

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

        // Nettoyage automatique en base des alertes expirées (> 24h ou avant minuit) par l'Admin ou le Gérant
        if (userProfile.role === 'admin' || userProfile.role === 'manager') {
          allItems.forEach((n) => {
            if (!isNotificationFresh(n.createdAt)) {
              deleteDoc(doc(db, 'notifications', n.id)).catch(() => {});
            }
          });
        }

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

    return () => {
      unsub();
      clearInterval(pruneInterval);
    };
  }, [networkStatus, authReady, firebaseUser, userProfile, verifiedRoleUid]);

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
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );

    const target = notifications.find((n) => n.id === notifId);
    if (
      firebaseUser &&
      target &&
      target.read !== true &&
      (target.recipientId === firebaseUser.uid || target.targetOwnerUid === firebaseUser.uid)
    ) {
      updateDoc(doc(db, 'notifications', notifId), { read: true }).catch(() => {});
    }
  };

  const handleMarkAllNotificationsRead = () => {
    if (!userProfile) return;
    const allIds = Array.from(
      new Set([...readNotificationIds, ...notifications.map((n) => n.id)])
    );
    setReadNotificationIds(allIds);
    saveReadNotificationIds(userProfile.uid, allIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    if (firebaseUser) {
      notifications.forEach((n) => {
        if (
          n.read !== true &&
          (n.recipientId === firebaseUser.uid || n.targetOwnerUid === firebaseUser.uid)
        ) {
          updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {});
        }
      });
    }
  };

  // Simulated GPS movement only when real hardware GPS has not locked an accuracy reading
  useEffect(() => {
    const interval = setInterval(() => {
      setBookings((prev) =>
        prev.map((b) => {
          if (b.gpsActive && b.status === 'in_transit' && b.agentGps && !b.agentGps.accuracy) {
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

  // Complete registration & Firestore persistence after classic or Google Auth
  const handleCompleteOnboarding = async (rawProfile: UserProfile) => {
    const activeAuthUser = firebaseUser || auth.currentUser;
    if (activeAuthUser) {
      completingOnboardingUidRef.current = activeAuthUser.uid;
      try {
        await activeAuthUser.getIdToken();

        const isMasterAdmin = Boolean(
          activeAuthUser.email && ADMIN_BOOTSTRAP_EMAILS.has(activeAuthUser.email.toLowerCase())
        );

        // Sécurité : empêche toute auto-attribution du rôle admin ou d'un statut approuvé côté client
        const allowedSelfRole: Role =
          isMasterAdmin && rawProfile.role === 'admin'
            ? 'admin'
            : rawProfile.role === 'manager' || rawProfile.role === 'agent'
            ? rawProfile.role
            : 'client';

        const isManager = allowedSelfRole === 'manager';
        const safeProfile: UserProfile = {
          ...rawProfile,
          uid: activeAuthUser.uid,
          role: allowedSelfRole,
          status: isManager ? 'pending' : 'approved',
          accountStatus: isManager ? 'pending' : 'active',
          rejectionReason: '',
        };

        await setDoc(doc(db, 'users', safeProfile.uid), safeProfile);

        hasAutoRoutedRef.current = true;
        setPendingGoogleUser(null);
        setPendingPartialProfile(null);
        setUserProfile(safeProfile);
        setCachedProfileForUid(safeProfile);
        setPreviewRole(safeProfile.role);
        setShowAuthModal(false);
        setReadNotificationIds(getReadNotificationIds(safeProfile.uid));
        setVerifiedRoleUid(safeProfile.uid);

        const roleLabel =
          safeProfile.role === 'manager'
            ? 'Entreprise / Gérant'
            : safeProfile.role === 'agent'
            ? 'Agent technicien'
            : safeProfile.role === 'admin'
            ? 'Administrateur'
            : 'Client';

        if (safeProfile.role !== 'admin') {
          await publishNotification({
            type: 'new_registration',
            title:
              safeProfile.role === 'manager'
                ? 'Nouvelle inscription Entreprise à valider'
                : `Nouvelle inscription (${roleLabel})`,
            body: safeProfile.companyName
              ? `${safeProfile.companyName} (${safeProfile.displayName}) à ${safeProfile.commune || 'Libreville'} attend validation.`
              : `${safeProfile.displayName} (${roleLabel}) vient de s'inscrire à ${safeProfile.commune || 'Libreville'}.`,
            targetRoles: ['manager', 'admin'],
            relatedId: safeProfile.uid,
            relatedTab: 'admin',
            actorUid: safeProfile.uid,
          });
        }

        if (pendingBooking) {
          const wasFromCart = pendingBookingFromCartRef.current;
          pendingBookingFromCartRef.current = false;
          const scopedBooking = buildScopedBookingPayload(
            pendingBooking,
            safeProfile.uid,
            safeProfile.displayName,
            safeProfile.phone
          );
          setPendingBooking(null);
          setBookings((prev) => [scopedBooking, ...prev]);
          setActiveTab('mes_reservations');
          await persistNewBookingToFirestore(scopedBooking);
          await publishNewBookingNotification(scopedBooking, safeProfile.uid);
          if (wasFromCart) {
            setCartItems([]);
            setCartPromotion(null);
          }
        } else {
          setActiveTab(getDashboardTabForRole(safeProfile.role));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${rawProfile.uid}`);
      } finally {
        completingOnboardingUidRef.current = null;
      }
    }
  };

  const handleSignOut = async () => {
    if (firebaseUser) {
      clearCachedProfileForUid(firebaseUser.uid);
    }
    hasAutoRoutedRef.current = false;
    completingOnboardingUidRef.current = null;
    setVerifiedRoleUid(null);
    setPendingGoogleUser(null);
    setPendingPartialProfile(null);
    await signOut(auth);
    setUserProfile(null);
    setBookings([]);
    setUsers([]);
    setNotifications([]);
    setPreviewRole('client');
    setActiveTab('home');
  };

  const buildScopedBookingPayload = (
    rawBooking: Booking,
    uid: string,
    fallbackName?: string,
    fallbackPhone?: string
  ): Booking => {
    const cleanPhoneRaw = (rawBooking.clientPhone || fallbackPhone || '+241 00 00 00 00').trim();
    const safePhone = (cleanPhoneRaw.length >= 4 ? cleanPhoneRaw : '+241 00 00 00 00').slice(0, 40);
    const safeName = (rawBooking.clientName || fallbackName || 'Client').trim().slice(0, 120) || 'Client';
    const safeCommune = (rawBooking.commune || 'Libreville').trim();
    const safeAddress = (rawBooking.address || 'Libreville').trim();
    const safeServiceName = (rawBooking.serviceName || 'Prestation Shine-x-Sanitize').trim();
    const safeOfferPrice = Math.max(1000, Math.round(rawBooking.clientOfferPrice || 1000));
    const safeFinalPrice = Math.max(1000, Math.round(rawBooking.finalPrice || safeOfferPrice));

    const rawPromo = rawBooking.promoApplied;
    const normalizedPromo =
      rawPromo && typeof rawPromo === 'object'
        ? {
            ...(typeof rawPromo.promotionId === 'string' && rawPromo.promotionId.trim()
              ? { promotionId: rawPromo.promotionId.trim().slice(0, 64) }
              : {}),
            title:
              (typeof rawPromo.title === 'string' ? rawPromo.title.trim() : '').slice(0, 140) ||
              'Offre promotionnelle',
            discountLabel:
              (typeof rawPromo.discountLabel === 'string'
                ? rawPromo.discountLabel.trim()
                : ''
              ).slice(0, 40) || 'Promo',
            discountPercent:
              typeof rawPromo.discountPercent === 'number' &&
              Number.isFinite(rawPromo.discountPercent)
                ? Math.min(100, Math.max(0, rawPromo.discountPercent))
                : null,
            discountAmount: Math.max(0, Math.round(rawPromo.discountAmount || 0)),
            originalPrice: Math.max(1000, Math.round(rawPromo.originalPrice || safeFinalPrice)),
          }
        : undefined;

    const cleanItems = getBookingItems(rawBooking);

    const payload: Booking = {
      ...rawBooking,
      ownerUid: uid,
      userId: uid,
      clientId: uid,
      serviceId: String(rawBooking.serviceId || '').slice(0, 64),
      serviceName: (safeServiceName.length >= 2 ? safeServiceName : 'Service').slice(0, 180),
      serviceCategory: rawBooking.serviceCategory,
      ...(cleanItems.length > 0 ? { items: cleanItems.slice(0, 25) } : {}),
      clientName: safeName,
      clientPhone: safePhone,
      commune: (safeCommune.length >= 2 ? safeCommune : 'Libreville').slice(0, 120),
      address: (safeAddress.length >= 2 ? safeAddress : 'Libreville').slice(0, 240),
      clientOfferPrice: safeOfferPrice,
      ...(normalizedPromo ? { promoApplied: normalizedPromo } : {}),
      finalPrice: safeFinalPrice,
      status: 'pending_negotiation',
      assignedAgents: Array.isArray(rawBooking.assignedAgents)
        ? rawBooking.assignedAgents.slice(0, 10)
        : [],
      assignedAgentIds: Array.isArray(rawBooking.assignedAgentIds)
        ? rawBooking.assignedAgentIds.slice(0, 10)
        : [],
      gpsActive: Boolean(rawBooking.gpsActive),
      clientGpsActive: Boolean(rawBooking.clientGpsActive),
      beforePhotos: Array.isArray(rawBooking.beforePhotos)
        ? rawBooking.beforePhotos.filter((p): p is string => typeof p === 'string' && p.length > 0).slice(0, 5)
        : [],
      afterPhotos: Array.isArray(rawBooking.afterPhotos)
        ? rawBooking.afterPhotos.filter((p): p is string => typeof p === 'string' && p.length > 0).slice(0, 5)
        : [],
      createdAt: String(rawBooking.createdAt || "À l'instant").slice(0, 64),
      updatedAt: new Date().toISOString(),
    };

    if (!normalizedPromo) {
      delete payload.promoApplied;
    }
    if (cleanItems.length === 0) {
      delete payload.items;
    }
    delete payload.services;
    return payload;
  };

  const persistNewBookingToFirestore = async (scopedBooking: Booking) => {
    try {
      await setDoc(doc(db, 'bookings', scopedBooking.id), scopedBooking);
    } catch (error) {
      const code = (error as { code?: string })?.code || '';
      const msg = error instanceof Error ? error.message : String(error || '');
      const isPermDenied =
        code === 'permission-denied' ||
        msg.includes('permission-denied') ||
        msg.includes('Missing or insufficient permissions');

      if (isPermDenied) {
        // Fallback compatibilité si les règles Firestore déployées n'incluent pas encore clientId ou items au top-level
        const compatPayload: Booking = { ...scopedBooking };
        delete compatPayload.clientId;
        delete compatPayload.items;
        delete compatPayload.services;
        await setDoc(doc(db, 'bookings', scopedBooking.id), compatPayload);
        return;
      }
      throw error;
    }
  };

  const publishNewBookingNotification = async (scopedBooking: Booking, actorUid?: string) => {
    const promoSuffix = scopedBooking.promoApplied
      ? ` · Promo ${scopedBooking.promoApplied.discountLabel || scopedBooking.promoApplied.title}`
      : '';
    const body = `${scopedBooking.clientName} · ${scopedBooking.serviceName} à ${scopedBooking.commune} (${scopedBooking.finalPrice.toLocaleString()} XAF${promoSuffix})`.slice(
      0,
      400
    );

    await publishNotification({
      type: 'new_booking',
      title: `Nouvelle commande #${scopedBooking.id}`,
      body,
      targetRoles:
        scopedBooking.assignedAgents.length > 0
          ? ['manager', 'admin', 'agent']
          : ['manager', 'admin'],
      ...(scopedBooking.assignedAgents.length > 0
        ? { targetAgentNames: scopedBooking.assignedAgents }
        : {}),
      relatedId: scopedBooking.id,
      relatedTab: 'suivi_commande',
      ...(actorUid ? { actorUid } : {}),
    });
  };

  // Client Actions
  const handleCreateBooking = async (newBooking: Booking) => {
    const activeAuthUser = auth.currentUser || firebaseUser;
    if (!activeAuthUser || !userProfile) {
      pendingBookingFromCartRef.current = false;
      setPendingBooking(newBooking);
      setSelectedService(null);
      setActivePromotion(null);
      setShowAuthModal(true);
      return;
    }

    if (isAccountBanned) return;

    const scopedBooking = buildScopedBookingPayload(
      newBooking,
      activeAuthUser.uid,
      userProfile.displayName,
      userProfile.phone
    );

    setBookings((prev) => [scopedBooking, ...prev]);
    setSelectedService(null);
    setActivePromotion(null);
    setActiveTab('mes_reservations');

    try {
      await activeAuthUser.getIdToken();
      await persistNewBookingToFirestore(scopedBooking);
      await publishNewBookingNotification(scopedBooking);
    } catch (error) {
      setBookings((prev) => prev.filter((b) => b.id !== scopedBooking.id));
      handleFirestoreError(error, OperationType.CREATE, `bookings/${scopedBooking.id}`);
    }
  };

  const handleAddConfiguredItemToCart = (
    item: CartItem,
    selectedExtras: SupplementalServiceOption[] = []
  ) => {
    setCartSubmitError('');
    const normalizedOpts = [...(item.options || [])].sort().join('|');
    setCartItems((prev) => {
      const existingIdx = prev.findIndex(
        (existing) =>
          existing.serviceId === item.serviceId &&
          (existing.material || '') === (item.material || '') &&
          (existing.condition || '') === (item.condition || '') &&
          (existing.vehicleBrand || '') === (item.vehicleBrand || '') &&
          (existing.vehicleModel || '') === (item.vehicleModel || '') &&
          (existing.vehicleSeats || 0) === (item.vehicleSeats || 0) &&
          [...(existing.options || [])].sort().join('|') === normalizedOpts
      );
      if (existingIdx >= 0) {
        return prev.map((existing, idx) => {
          if (idx !== existingIdx) return existing;
          const nextQty = Math.min(20, (existing.quantity || 1) + (item.quantity || 1));
          return {
            ...existing,
            quantity: nextQty,
            unitPrice: item.unitPrice,
            totalPrice: nextQty * item.unitPrice,
            promotion: item.promotion || existing.promotion,
          };
        });
      }
      return [...prev.slice(0, 24), { ...item, totalPrice: item.unitPrice * (item.quantity || 1) }];
    });
    if (selectedExtras.length > 0) {
      setCartExtras((prev) => {
        const merged = new Map(prev.map((e) => [e.id, e]));
        selectedExtras.forEach((e) => merged.set(e.id, e));
        return Array.from(merged.values());
      });
    }
    if (item.promotion) {
      setCartPromotion((prev) => prev || item.promotion || null);
    }
    setSelectedService(null);
    setActivePromotion(null);
    setCartFeedback(
      selectedExtras.length > 0
        ? `« ${item.serviceName} » et ${selectedExtras.length} supplément${selectedExtras.length > 1 ? 's' : ''} ajoutés au panier.`
        : `« ${item.serviceName} » ajouté au panier.`
    );
  };

  const handleToggleCartExtra = (extra: SupplementalServiceOption) => {
    setCartExtras((prev) =>
      prev.some((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra]
    );
  };

  const openServiceConfigurator = (
    service: ServiceItem,
    intent: 'order' | 'cart' = 'order',
    promoOverride?: Promotion | null
  ) => {
    setConfiguratorIntent(intent);
    if (promoOverride !== undefined) {
      setActivePromotion(promoOverride);
    }
    setSelectedService(service);
  };

  const handleUpdateCartQuantity = (cartItemId: string, nextQuantity: number) => {
    const clamped = Math.max(1, Math.min(20, Math.round(nextQuantity || 1)));
    setCartItems((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId
          ? { ...item, quantity: clamped, totalPrice: clamped * item.unitPrice }
          : item
      )
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
    setCartExtras([]);
    setCartPromotion(null);
    setCartSubmitError('');
  };

  const handleSubmitCartOrder = async (newBooking: Booking) => {
    setCartSubmitError('');
    const activeAuthUser = auth.currentUser || firebaseUser;
    if (!activeAuthUser || !userProfile) {
      pendingBookingFromCartRef.current = true;
      setPendingBooking(newBooking);
      setShowAuthModal(true);
      return;
    }

    if (isAccountBanned) {
      setCartSubmitError('Votre compte est suspendu.');
      return;
    }

    const scopedBooking = buildScopedBookingPayload(
      newBooking,
      activeAuthUser.uid,
      userProfile.displayName,
      userProfile.phone
    );

    setIsSubmittingCartOrder(true);
    try {
      await activeAuthUser.getIdToken();
      await persistNewBookingToFirestore(scopedBooking);
      setBookings((prev) => [scopedBooking, ...prev.filter((b) => b.id !== scopedBooking.id)]);
      await publishNewBookingNotification(scopedBooking);
      handleClearCart();
      setActiveTab('mes_reservations');
    } catch (error) {
      console.error('[handleSubmitCartOrder] Failed to create cart booking:', {
        bookingId: scopedBooking.id,
        error,
      });
      setCartSubmitError(
        formatBookingUpdateError(
          error,
          "Impossible d'enregistrer votre commande groupée dans Firestore."
        )
      );
    } finally {
      setIsSubmittingCartOrder(false);
    }
  };

  // Finalise automatiquement une commande en attente (panier ou simple) après connexion d'un compte existant
  useEffect(() => {
    if (
      !pendingBooking ||
      !firebaseUser ||
      !userProfile ||
      verifiedRoleUid !== firebaseUser.uid ||
      completingOnboardingUidRef.current !== null ||
      isAccountBanned ||
      isCompanyBlocked
    ) {
      return;
    }

    const queued = pendingBooking;
    const wasFromCart = pendingBookingFromCartRef.current;
    pendingBookingFromCartRef.current = false;
    setPendingBooking(null);

    const scopedBooking = buildScopedBookingPayload(
      queued,
      firebaseUser.uid,
      userProfile.displayName,
      userProfile.phone
    );

    if (wasFromCart) setIsSubmittingCartOrder(true);
    firebaseUser
      .getIdToken()
      .then(() => persistNewBookingToFirestore(scopedBooking))
      .then(async () => {
        setBookings((prev) => [scopedBooking, ...prev.filter((b) => b.id !== scopedBooking.id)]);
        await publishNewBookingNotification(scopedBooking, firebaseUser.uid);
        if (wasFromCart) {
          handleClearCart();
        }
        setActiveTab('mes_reservations');
      })
      .catch((error) => {
        console.error('[pendingBooking] Auto-submit after login failed:', error);
        if (wasFromCart) {
          setCartSubmitError(
            formatBookingUpdateError(
              error,
              "Impossible d'enregistrer votre commande après connexion."
            )
          );
        }
      })
      .finally(() => {
        if (wasFromCart) setIsSubmittingCartOrder(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBooking, firebaseUser, userProfile, verifiedRoleUid, isAccountBanned, isCompanyBlocked]);

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

  const handleSubmitReview = async (
    bookingId: string,
    rating: number,
    comment: string
  ): Promise<void> => {
    const activeAuthUser = auth.currentUser || firebaseUser;
    if (!activeAuthUser) {
      throw new Error('Vous devez être connecté pour publier un commentaire.');
    }
    if (isAccountBanned) {
      throw new Error('Votre compte est suspendu.');
    }

    const trimmedComment = comment.trim().slice(0, 800);
    if (!trimmedComment) {
      throw new Error('Veuillez saisir votre commentaire avant de le publier.');
    }

    const normalizedRating = Math.min(5, Math.max(1, Math.round(rating || 5)));
    const nowIso = new Date().toISOString();
    const patch: Partial<Booking> & { updatedAt: string } = {
      rating: normalizedRating,
      clientComment: trimmedComment,
      clientCommentAt: nowIso,
      review: trimmedComment,
      reviewSubmittedAt: nowIso,
      updatedAt: nowIso,
    };

    await activeAuthUser.getIdToken();

    try {
      await updateDoc(doc(db, 'bookings', bookingId), patch);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...patch } : b))
      );
    } catch (error) {
      const code = (error as { code?: string })?.code || '';
      const msg = error instanceof Error ? error.message : String(error || '');
      if (
        code === 'permission-denied' ||
        msg.includes('permission-denied') ||
        msg.includes('Missing or insufficient permissions')
      ) {
        // Fallback compatibilité si les nouvelles règles clientComment n'ont pas encore été publiées
        try {
          const legacyPatch: Partial<Booking> & { updatedAt: string } = {
            rating: normalizedRating,
            review: trimmedComment,
            reviewSubmittedAt: nowIso,
            updatedAt: nowIso,
          };
          await updateDoc(doc(db, 'bookings', bookingId), legacyPatch);
          setBookings((prev) =>
            prev.map((b) => (b.id === bookingId ? { ...b, ...patch } : b))
          );
          return;
        } catch (fallbackErr) {
          console.error('[handleSubmitReview] Firestore legacy updateDoc fallback failed:', {
            bookingId,
            clientUid: activeAuthUser.uid,
            fallbackErr,
          });
        }
      }
      console.error('[handleSubmitReview] Firestore updateDoc failed:', {
        bookingId,
        clientUid: activeAuthUser.uid,
        patchKeys: Object.keys(patch),
        error,
      });
      throw new Error(
        formatBookingUpdateError(
          error,
          "Impossible d'enregistrer votre commentaire dans Firestore.",
          'Autorisation Firestore refusée pour enregistrer ce commentaire. Vérifiez que vous êtes bien le client propriétaire de la commande et que les règles firestore.rules à jour sont publiées dans Firebase.'
        )
      );
    }
  };

  const handleToggleClientGps = (
    bookingId: string,
    coords?: GpsPoint
  ) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;
    const nextState = !target.clientGpsActive;
    persistBookingPatch(bookingId, {
      clientGpsActive: nextState,
      ...(coords ? { clientCoords: coords } : {}),
    });
  };

  // Helpers de résolution des agents sélectionnés & envoi d'alertes dédiées
  const resolveSelectedAgentsData = (
    bookingId: string,
    target: Booking | undefined,
    selectedAgentIds?: string[],
    selectedAgentNames?: string[]
  ) => {
    const activeAgentsList = users.filter(
      (u) => u.role === 'agent' && u.accountStatus === 'active'
    );
    const busyAgentNames = new Set(
      bookings
        .filter((b) => b.id !== bookingId && (b.status === 'in_transit' || b.status === 'in_progress'))
        .flatMap((b) => b.assignedAgents)
    );
    const busyAgentIds = new Set(
      bookings
        .filter((b) => b.id !== bookingId && (b.status === 'in_transit' || b.status === 'in_progress'))
        .flatMap((b) => b.assignedAgentIds || [])
    );

    const candidateIds =
      selectedAgentIds && selectedAgentIds.length > 0
        ? selectedAgentIds
        : target?.assignedAgentIds || [];
    const candidateNames =
      selectedAgentNames && selectedAgentNames.length > 0
        ? selectedAgentNames
        : target?.assignedAgents || [];

    const matchedUsers: UserProfile[] = [];
    const seenUids = new Set<string>();

    candidateIds.forEach((uid) => {
      const found = activeAgentsList.find((u) => u.uid === uid);
      if (found && !seenUids.has(found.uid)) {
        seenUids.add(found.uid);
        matchedUsers.push(found);
      }
    });

    candidateNames.forEach((name) => {
      const normalized = name.trim().toLowerCase();
      const found =
        activeAgentsList.find((u) => u.displayName === name) ||
        activeAgentsList.find((u) => u.displayName.trim().toLowerCase() === normalized);
      if (found && !seenUids.has(found.uid)) {
        seenUids.add(found.uid);
        matchedUsers.push(found);
      }
    });

    if (matchedUsers.length === 0 && candidateIds.length === 0 && candidateNames.length === 0) {
      const fallbackAgent = activeAgentsList.find(
        (u) => !busyAgentIds.has(u.uid) && !busyAgentNames.has(u.displayName)
      );
      if (fallbackAgent) {
        matchedUsers.push(fallbackAgent);
      }
    }

    const assignedAgentIds = Array.from(
      new Set([...candidateIds, ...matchedUsers.map((u) => u.uid)].map((id) => id.trim()).filter(Boolean))
    ).slice(0, 10);

    const assignedAgents = Array.from(
      new Set([...matchedUsers.map((u) => u.displayName), ...candidateNames].map((n) => n.trim()).filter(Boolean))
    ).slice(0, 10);

    const assignedAgentDetails: AssignedAgentInfo[] = matchedUsers.slice(0, 10).map((u) => ({
      uid: u.uid,
      displayName: u.displayName,
      ...(u.phone ? { phone: u.phone } : {}),
      ...(u.commune ? { commune: u.commune } : {}),
    }));

    return {
      assignedAgentIds,
      assignedAgents,
      assignedAgentDetails,
    };
  };

  const notifyAssignedAgents = async (
    bookingId: string,
    target: Booking,
    agentIds: string[],
    agentNames: string[],
    agentDetails: AssignedAgentInfo[]
  ) => {
    const promoNote = target.promoApplied
      ? ` (Promo ${target.promoApplied.discountLabel || ''} appliquée)`
      : '';
    const amountLabel = `${target.finalPrice.toLocaleString()} XAF${promoNote}`;
    const orderMsg = `Nouvelle commande validée #${bookingId} : ${target.serviceName} pour ${target.clientName} à ${target.commune} (${target.address}) — Montant : ${amountLabel}.`;

    const notifiedUids = new Set<string>();
    const detailsByUid = new Map(agentDetails.map((d) => [d.uid, d]));

    for (const uid of agentIds) {
      if (!uid || notifiedUids.has(uid)) continue;
      notifiedUids.add(uid);
      const detail = detailsByUid.get(uid);
      await publishNotification({
        type: 'agent_assigned',
        title: `Nouvelle commande assignée #${bookingId}`,
        body: orderMsg,
        message: orderMsg,
        targetRoles: ['agent'],
        ...(detail?.displayName ? { targetAgentNames: [detail.displayName] } : {}),
        recipientId: uid,
        orderId: bookingId,
        relatedId: bookingId,
        relatedTab: 'agent_space',
        read: false,
      });
    }

    if (notifiedUids.size === 0 && agentNames.length > 0) {
      await publishNotification({
        type: 'agent_assigned',
        title: `Nouvelle commande assignée #${bookingId}`,
        body: orderMsg,
        message: orderMsg,
        targetRoles: ['agent', 'manager', 'admin'],
        targetAgentNames: agentNames,
        orderId: bookingId,
        relatedId: bookingId,
        relatedTab: 'agent_space',
        read: false,
      });
    }
  };

  // Manager / Admin Actions
  const handleValidateOrder = async (
    bookingId: string,
    selectedAgentIds?: string[],
    selectedAgentNames?: string[]
  ) => {
    const activeAuthUser = auth.currentUser || firebaseUser;
    if (activeAuthUser) {
      await activeAuthUser.getIdToken();
    }
    const target = bookings.find((b) => b.id === bookingId);
    const { assignedAgentIds, assignedAgents, assignedAgentDetails } =
      resolveSelectedAgentsData(bookingId, target, selectedAgentIds, selectedAgentNames);

    const updatedAt = new Date().toISOString();
    const patch: Partial<Booking> & { updatedAt: string } = {
      status: 'confirmed',
      assignedAgents,
      assignedAgentIds,
      assignedAgentDetails,
      ...(target ? { finalPrice: target.finalPrice } : {}),
      updatedAt,
    };

    if (activeAuthUser && !isAccountBanned) {
      try {
        await updateDoc(doc(db, 'bookings', bookingId), patch);
      } catch (error) {
        console.error('[handleValidateOrder] Firestore updateDoc failed:', {
          bookingId,
          uid: activeAuthUser.uid,
          role: userProfile?.role,
          patchKeys: Object.keys(patch),
          error,
        });
        throw new Error(
          formatBookingUpdateError(
            error,
            'Impossible de valider cette commande dans Firestore.'
          )
        );
      }
    }

    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, ...patch } : b))
    );

    if (target && (assignedAgentIds.length > 0 || assignedAgents.length > 0)) {
      await notifyAssignedAgents(
        bookingId,
        target,
        assignedAgentIds,
        assignedAgents,
        assignedAgentDetails
      );
    }
  };

  const handleRefuseOrder = async (bookingId: string, reason: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    const trimmedReason =
      reason.trim() || 'Votre commande a été refusée par le gérant.';
    const refusedAt = new Date().toISOString();
    const clientUid = target?.userId || target?.ownerUid || '';

    try {
      await persistBookingPatch(bookingId, {
        status: 'rejected',
        gpsActive: false,
        clientGpsActive: false,
        assignedAgents: [],
        assignedAgentIds: [],
        assignedAgentDetails: [],
        rejectionReason: trimmedReason,
        refusalReason: trimmedReason,
        refusedAt,
        ...(clientUid ? { userId: clientUid } : {}),
      });
    } catch (error) {
      if (target) {
        setBookings((prev) => prev.map((b) => (b.id === bookingId ? target : b)));
      }
      console.error('[handleRefuseOrder] Firestore updateDoc failed:', { bookingId, error });
      throw new Error(
        formatBookingUpdateError(error, 'Impossible de refuser cette commande dans Firestore.')
      );
    }

    if (clientUid) {
      const refusalMessage = `Votre commande #${bookingId} (${target?.serviceName || 'Prestation'}) a été refusée. Motif : ${trimmedReason}`;
      await publishNotification({
        type: 'order_refused',
        title: 'Commande refusée',
        body: refusalMessage,
        message: refusalMessage,
        targetRoles: ['client'],
        targetOwnerUid: clientUid,
        recipientId: clientUid,
        orderId: bookingId,
        relatedId: bookingId,
        relatedTab: 'mes_reservations',
        read: false,
      });
    }
  };

  const handleDeleteOrder = async (bookingId: string) => {
    const activeAuthUser = auth.currentUser || firebaseUser;
    if (!activeAuthUser) {
      throw new Error('Vous devez être connecté pour supprimer une commande.');
    }
    if (isAccountBanned) {
      throw new Error('Votre compte est suspendu.');
    }

    await activeAuthUser.getIdToken();
    const snapshotTarget = bookings.find((b) => b.id === bookingId);
    setBookings((prev) => prev.filter((b) => b.id !== bookingId));

    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
    } catch (error) {
      if (snapshotTarget) {
        setBookings((prev) =>
          prev.some((b) => b.id === bookingId) ? prev : [snapshotTarget, ...prev]
        );
      }
      console.error('[handleDeleteOrder] Firestore deleteDoc failed:', { bookingId, error });
      throw new Error(
        formatBookingUpdateError(
          error,
          'Impossible de supprimer cette commande dans Firestore.'
        )
      );
    }
  };

  const handleUpdatePrice = (bookingId: string, newPrice: number, note: string) => {
    persistBookingPatch(bookingId, {
      managerCounterPrice: newPrice,
      finalPrice: newPrice,
      priceAdjustmentNote: note,
      status: 'counter_offered',
    });
  };

  const handleAssignAgents = async (
    bookingId: string,
    agents: string[],
    agentIds?: string[]
  ) => {
    const activeAuthUser = auth.currentUser || firebaseUser;
    if (!activeAuthUser) {
      throw new Error('Vous devez être connecté pour affecter des agents.');
    }
    if (isAccountBanned) {
      throw new Error('Votre compte est suspendu.');
    }

    await activeAuthUser.getIdToken();

    const target = bookings.find((b) => b.id === bookingId);
    const previousAgentIds = new Set(target?.assignedAgentIds || []);
    const { assignedAgentIds, assignedAgents, assignedAgentDetails } =
      resolveSelectedAgentsData(bookingId, undefined, agentIds, agents);

    const updatedAt = new Date().toISOString();
    const patch: Partial<Booking> & { updatedAt: string } = {
      assignedAgents,
      assignedAgentIds,
      assignedAgentDetails,
      agentGps: target?.agentGps || DEFAULT_GPS_POSITION,
      updatedAt,
    };

    try {
      const ref = doc(db, 'bookings', bookingId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, patch);
      }
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...patch } : b))
      );
    } catch (error) {
      console.error('[handleAssignAgents] Firestore updateDoc failed:', {
        bookingId,
        uid: activeAuthUser.uid,
        role: userProfile?.role,
        patchKeys: Object.keys(patch),
        error,
      });
      throw new Error(
        formatBookingUpdateError(
          error,
          "Impossible d'enregistrer l'affectation des agents dans Firestore."
        )
      );
    }

    const isAlreadyValidated = Boolean(
      target && ['confirmed', 'in_transit', 'in_progress'].includes(target.status)
    );
    const newlyAddedIds = assignedAgentIds.filter((uid) => !previousAgentIds.has(uid));

    if (target && isAlreadyValidated && (newlyAddedIds.length > 0 || assignedAgents.length > 0)) {
      await notifyAssignedAgents(
        bookingId,
        target,
        newlyAddedIds.length > 0 ? newlyAddedIds : assignedAgentIds,
        assignedAgents,
        assignedAgentDetails
      );
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
    if (!firebaseUser || isAccountBanned || isCompanyBlocked) return;
    const now = new Date().toISOString();
    const newPromo: Promotion = {
      ...promoInput,
      id: `promo-${Date.now()}`,
      status: 'active',
      createdByUid: firebaseUser.uid,
      createdAt: now,
    };

    try {
      await setDoc(doc(db, 'promotions', newPromo.id), newPromo);
    } catch (error) {
      console.error('Promotion create failed:', error);
      throw new Error(
        "Impossible de publier cette promotion dans Firestore. Vérifiez que votre compte entreprise est validé et que les règles Firestore sont à jour."
      );
    }

    setPromotions((prev) =>
      prev.some((p) => p.id === newPromo.id) ? prev : [newPromo, ...prev]
    );

    await publishNotification({
      type: 'promo_approved',
      title: `Nouvelle promotion : ${newPromo.discountLabel}`,
      body: `${newPromo.title} (${newPromo.companyName}) — Disponible dès maintenant à Libreville.`,
      targetRoles: ['client', 'agent', 'manager', 'admin'],
      relatedId: newPromo.id,
      relatedTab: 'home',
    });
  };

  const handleUpdatePromotion = async (
    promoId: string,
    updates: {
      title: string;
      description: string;
      discountLabel: string;
      serviceCategory?: string;
      validUntil?: string;
    }
  ) => {
    if (!firebaseUser || isAccountBanned || isCompanyBlocked) return;
    const updatedAt = new Date().toISOString();
    const patch = {
      ...updates,
      status: 'active' as const,
      updatedAt,
    };

    try {
      await updateDoc(doc(db, 'promotions', promoId), patch);
    } catch (error) {
      console.error('Promotion update failed:', error);
      throw new Error(
        "Impossible de modifier cette promotion. Vous ne pouvez modifier que les promotions que vous avez créées."
      );
    }

    setPromotions((prev) =>
      prev.map((p) => (p.id === promoId ? { ...p, ...patch } : p))
    );
  };

  const handleDeletePromotion = async (promoId: string) => {
    if (!firebaseUser || isAccountBanned || isCompanyBlocked) return;

    try {
      await deleteDoc(doc(db, 'promotions', promoId));
    } catch (error) {
      console.error('Promotion delete failed:', error);
      throw new Error(
        "Impossible de supprimer cette promotion. Vous ne pouvez supprimer que vos propres promotions."
      );
    }

    setPromotions((prev) => prev.filter((p) => p.id !== promoId));
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

  // Validation des inscriptions Entreprise / Gérant (Admin uniquement)
  const handleApproveCompany = async (uid: string) => {
    if (!firebaseUser || !isActualAdmin) return;
    const target = users.find((u) => u.uid === uid);
    const updatedAt = new Date().toISOString();
    const patch = {
      status: 'approved' as const,
      accountStatus: 'active' as const,
      rejectionReason: '',
      updatedAt,
    };

    try {
      await updateDoc(doc(db, 'users', uid), patch);
    } catch (error) {
      console.error('Company approval failed:', error);
      throw new Error("Impossible de valider cette entreprise. Vérifiez votre connexion et réessayez.");
    }
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, ...patch } : u)));

    const companyLabel = target?.companyName || target?.displayName || 'Votre entreprise';
    await publishNotification({
      type: 'company_approved',
      title: 'Inscription Entreprise validée',
      body: `Félicitations ! ${companyLabel} a été validée par l'administrateur. Votre espace entreprise est désormais accessible.`,
      targetRoles: ['manager'],
      targetOwnerUid: uid,
      relatedId: uid,
      relatedTab: 'suivi_commande',
    });
  };

  const handleRejectCompany = async (uid: string, reason: string) => {
    if (!firebaseUser || !isActualAdmin) return;
    const motif = reason.trim().slice(0, COMPANY_REJECTION_REASON_MAX);
    if (!motif) {
      throw new Error('Le motif de rejet est obligatoire.');
    }
    const target = users.find((u) => u.uid === uid);
    const updatedAt = new Date().toISOString();
    const patch = {
      status: 'rejected' as const,
      accountStatus: 'rejected' as const,
      rejectionReason: motif,
      updatedAt,
    };

    try {
      await updateDoc(doc(db, 'users', uid), patch);
    } catch (error) {
      console.error('Company rejection failed:', error);
      throw new Error("Impossible d'enregistrer le rejet. Vérifiez votre connexion et réessayez.");
    }
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, ...patch } : u)));

    const companyLabel = target?.companyName || target?.displayName || 'Votre entreprise';
    await publishNotification({
      type: 'company_rejected',
      title: 'Inscription Entreprise refusée',
      body: `L'inscription de ${companyLabel} a été refusée. Motif : ${motif}`,
      targetRoles: ['manager'],
      targetOwnerUid: uid,
      relatedId: uid,
      relatedTab: 'home',
    });
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
  const handleToggleGps = (bookingId: string, initialPoint?: GpsPoint) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;
    const nextGps = !target.gpsActive;
    persistBookingPatch(bookingId, {
      gpsActive: nextGps,
      status: nextGps && target.status === 'confirmed' ? 'in_transit' : target.status,
      agentGps: initialPoint || target.agentGps || DEFAULT_GPS_POSITION,
    });
  };

  const handleUpdateAgentGps = (bookingId: string, point: GpsPoint) => {
    persistBookingPatch(bookingId, {
      agentGps: point,
    });
  };

  const formatBookingUpdateError = (
    error: unknown,
    fallback: string,
    permissionDeniedMessage?: string
  ): string => {
    const code = (error as { code?: string })?.code || '';
    const msg = error instanceof Error ? error.message : String(error || '');
    if (code === 'permission-denied' || msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      return (
        permissionDeniedMessage ||
        "Autorisation Firestore refusée pour modifier cette commande. Vérifiez que votre compte agent actif est bien associé (assignedAgentIds) et que les règles firestore.rules à jour sont publiées dans Firebase."
      );
    }
    if (code === 'not-found' || msg.includes('No document to update')) {
      return 'Commande introuvable dans Firestore (elle a peut-être été supprimée).';
    }
    if (code === 'unavailable' || code === 'deadline-exceeded') {
      return 'Connexion instable ou serveur Firestore indisponible. Réessayez dans un instant.';
    }
    return fallback;
  };

  const verifyAgentBookingContext = async (
    bookingId: string,
    actionLabel: 'démarrer' | 'clôturer'
  ): Promise<{ activeUid: string; booking: Booking | undefined; alreadyCompleted: boolean }> => {
    const activeAuthUser = auth.currentUser || firebaseUser;
    if (!activeAuthUser) {
      const authErr = new Error(`Vous devez être connecté pour ${actionLabel} une intervention.`);
      console.error('[verifyAgentBookingContext] Missing authenticated user', { bookingId });
      throw authErr;
    }

    await activeAuthUser.getIdToken();

    if (isAccountBanned) {
      const banErr = new Error('Votre compte est suspendu.');
      console.error('[verifyAgentBookingContext] Banned user attempted mutation', {
        bookingId,
        uid: activeAuthUser.uid,
      });
      throw banErr;
    }

    if (!isActualAdmin) {
      if (!userProfile || verifiedRoleUid !== activeAuthUser.uid || userProfile.role !== 'agent') {
        throw new Error(
          "Votre session agent n'est pas encore vérifiée. Reconnectez-vous puis réessayez."
        );
      }
      if (userProfile.accountStatus && userProfile.accountStatus !== 'active') {
        throw new Error(
          `Votre compte agent n'est pas actif (statut : ${userProfile.accountStatus}).`
        );
      }
    }

    let resolvedBooking = bookings.find((b) => b.id === bookingId);
    try {
      const snap = await getDoc(doc(db, 'bookings', bookingId));
      if (snap.exists()) {
        resolvedBooking = snap.data() as Booking;
      } else if (!resolvedBooking) {
        throw new Error('Commande introuvable dans Firestore (elle a peut-être été supprimée).');
      }
    } catch (readErr) {
      if (!resolvedBooking) {
        throw new Error(
          formatBookingUpdateError(
            readErr,
            "Impossible de vérifier l'association de votre compte agent à cette commande."
          )
        );
      }
    }

    if (resolvedBooking) {
      if (
        !isActualAdmin &&
        (!Array.isArray(resolvedBooking.assignedAgentIds) ||
          !resolvedBooking.assignedAgentIds.includes(activeAuthUser.uid))
      ) {
        throw new Error(
          "Votre compte agent n'est pas associé à cette commande dans Firestore (assignedAgentIds). Demandez au gérant de vous réaffecter."
        );
      }

      if (actionLabel === 'clôturer' && resolvedBooking.status === 'completed') {
        return { activeUid: activeAuthUser.uid, booking: resolvedBooking, alreadyCompleted: true };
      }

      if (
        !isActualAdmin &&
        !['confirmed', 'in_transit', 'in_progress'].includes(resolvedBooking.status)
      ) {
        throw new Error(
          `Cette commande ne peut pas être modifiée dans son statut actuel (${resolvedBooking.status}).`
        );
      }
    }

    return { activeUid: activeAuthUser.uid, booking: resolvedBooking, alreadyCompleted: false };
  };

  const handleStartPlacement = async (bookingId: string, beforePhotoUrl?: string) => {
    const { activeUid, booking: target } = await verifyAgentBookingContext(bookingId, 'démarrer');
    const nowIso = new Date().toISOString();
    const existingBefore = Array.isArray(target?.beforePhotos)
      ? target.beforePhotos.filter((p): p is string => typeof p === 'string' && p.length > 0)
      : [];
    const cleanBeforeUrl = typeof beforePhotoUrl === 'string' ? beforePhotoUrl.trim() : '';
    const hasNewBeforePhoto = Boolean(cleanBeforeUrl && !existingBefore.includes(cleanBeforeUrl));
    const nextBefore = hasNewBeforePhoto
      ? [...existingBefore, cleanBeforeUrl].slice(-5)
      : existingBefore;

    const patch: Partial<Booking> & { updatedAt: string } = {
      status: 'in_progress',
      startedAt: nowIso,
      updatedAt: nowIso,
      ...(hasNewBeforePhoto ? { beforePhotos: nextBefore } : {}),
    };

    try {
      await updateDoc(doc(db, 'bookings', bookingId), patch);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...patch } : b))
      );
    } catch (error) {
      console.error('[handleStartPlacement] Firestore updateDoc failed:', {
        bookingId,
        agentUid: activeUid,
        role: userProfile?.role,
        assignedAgentIds: target?.assignedAgentIds,
        bookingStatus: target?.status,
        patchKeys: Object.keys(patch),
        error,
      });
      throw new Error(
        formatBookingUpdateError(
          error,
          "Impossible d'enregistrer le début de l'intervention dans Firestore."
        )
      );
    }
  };

  const handleFinishPlacement = async (
    bookingId: string,
    afterPhotoUrl?: string,
    beforePhotoUrl?: string
  ) => {
    const {
      activeUid,
      booking: target,
      alreadyCompleted,
    } = await verifyAgentBookingContext(bookingId, 'clôturer');

    if (alreadyCompleted && target) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...target } : b))
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const existingBefore = Array.isArray(target?.beforePhotos)
      ? target.beforePhotos.filter((p): p is string => typeof p === 'string' && p.length > 0)
      : [];
    const cleanBeforeUrl = typeof beforePhotoUrl === 'string' ? beforePhotoUrl.trim() : '';
    const hasNewBeforePhoto = Boolean(cleanBeforeUrl && !existingBefore.includes(cleanBeforeUrl));
    const nextBefore = hasNewBeforePhoto
      ? [...existingBefore, cleanBeforeUrl].slice(-5)
      : existingBefore;

    const existingAfter = Array.isArray(target?.afterPhotos)
      ? target.afterPhotos.filter((p): p is string => typeof p === 'string' && p.length > 0)
      : [];
    const cleanAfterUrl = typeof afterPhotoUrl === 'string' ? afterPhotoUrl.trim() : '';
    const hasNewAfterPhoto = Boolean(cleanAfterUrl && !existingAfter.includes(cleanAfterUrl));
    const nextAfter = hasNewAfterPhoto
      ? [...existingAfter, cleanAfterUrl].slice(-5)
      : existingAfter;

    const patch: Partial<Booking> & { updatedAt: string } = {
      status: 'completed',
      gpsActive: false,
      ...(!target?.startedAt ? { startedAt: nowIso } : {}),
      completedAt: nowIso,
      updatedAt: nowIso,
      ...(hasNewBeforePhoto ? { beforePhotos: nextBefore } : {}),
      ...(hasNewAfterPhoto ? { afterPhotos: nextAfter } : {}),
    };

    try {
      await updateDoc(doc(db, 'bookings', bookingId), patch);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...patch } : b))
      );
    } catch (error) {
      console.error('[handleFinishPlacement] Firestore updateDoc failed:', {
        bookingId,
        agentUid: activeUid,
        role: userProfile?.role,
        assignedAgentIds: target?.assignedAgentIds,
        bookingStatus: target?.status,
        patchKeys: Object.keys(patch),
        error,
      });
      throw new Error(
        formatBookingUpdateError(
          error,
          "Impossible d'enregistrer la fin de l'intervention dans Firestore."
        )
      );
    }

    let resolvedTarget = target;
    if (!resolvedTarget) {
      try {
        const snap = await getDoc(doc(db, 'bookings', bookingId));
        if (snap.exists()) {
          resolvedTarget = snap.data() as Booking;
        }
      } catch {
        // Fallback to local target
      }
    }

    if (resolvedTarget) {
      const agentLabel =
        userProfile?.displayName ||
        (resolvedTarget.assignedAgents.length > 0
          ? resolvedTarget.assignedAgents.join(', ')
          : "L'agent");

      try {
        await publishNotification({
          type: 'mission_completed',
          title: `Mission terminée · #${bookingId}`,
          body: `${agentLabel} a validé la fin de prestation (${resolvedTarget.serviceName} · ${resolvedTarget.clientName})${hasNewAfterPhoto || nextAfter.length > 0 ? ' et transmis les photos avant/après sur votre tableau de bord.' : '.'}`,
          targetRoles: ['manager', 'admin'],
          orderId: bookingId,
          relatedId: bookingId,
          relatedTab: 'suivi_commande',
          read: false,
        });

        const clientOwnerUid =
          resolvedTarget.ownerUid || resolvedTarget.userId || resolvedTarget.clientId;
        if (clientOwnerUid) {
          const thankYouMsg = `Merci pour votre confiance, ${resolvedTarget.clientName} ! Votre intervention « ${resolvedTarget.serviceName} » (#${bookingId}) est terminée. L'équipe Shine-x-Sanitize Alp Group vous remercie chaleureusement et espère vous revoir très bientôt.`;
          await publishNotification({
            type: 'client_thank_you',
            title: `Merci pour votre confiance !`,
            body: thankYouMsg,
            message: thankYouMsg,
            targetRoles: ['client'],
            targetOwnerUid: clientOwnerUid,
            recipientId: clientOwnerUid,
            orderId: bookingId,
            relatedId: bookingId,
            relatedTab: 'mes_reservations',
            read: false,
          });
        }
      } catch (notifError) {
        console.error('[handleFinishPlacement] Notification publish warning (booking already completed):', {
          bookingId,
          notifError,
        });
      }
    }
  };

  const handleCongratulateAgents = async (bookingId: string) => {
    const activeAuthUser = auth.currentUser || firebaseUser;
    if (!activeAuthUser) {
      throw new Error('Vous devez être connecté pour féliciter les agents.');
    }
    if (isAccountBanned) {
      throw new Error('Votre compte est suspendu.');
    }

    await activeAuthUser.getIdToken();

    let target = bookings.find((b) => b.id === bookingId);
    if (!target) {
      const snap = await getDoc(doc(db, 'bookings', bookingId));
      if (snap.exists()) {
        target = snap.data() as Booking;
      }
    }
    if (!target) {
      throw new Error('Commande introuvable dans Firestore.');
    }
    if (target.agentsCongratulatedAt) {
      return;
    }

    const nowIso = new Date().toISOString();
    const managerLabel = (
      userProfile?.companyName
        ? `${userProfile.displayName} (${userProfile.companyName})`
        : userProfile?.displayName || 'Le gérant'
    ).slice(0, 120);

    const agentIds = Array.from(
      new Set([
        ...(target.assignedAgentIds || []).filter(Boolean),
        ...target.assignedAgents
          .map((name) => {
            const normalized = name.trim().toLowerCase();
            return users.find(
              (u) =>
                u.role === 'agent' &&
                (u.displayName === name || u.displayName.trim().toLowerCase() === normalized)
            )?.uid;
          })
          .filter((uid): uid is string => Boolean(uid)),
      ])
    );
    const agentNames = target.assignedAgents.length > 0 ? target.assignedAgents : undefined;
    const congratsMessage = `Félicitations de la part de ${managerLabel} pour l'accomplissement de la commande #${bookingId} (${target.serviceName} · client ${target.clientName}) ! Merci pour votre professionnalisme et votre engagement.`;

    try {
      if (agentIds.length > 0) {
        for (const uid of agentIds) {
          const detailName =
            target.assignedAgentDetails?.find((d) => d.uid === uid)?.displayName ||
            users.find((u) => u.uid === uid)?.displayName;
          await publishNotification({
            type: 'agent_encouragement',
            title: `Félicitations du gérant · #${bookingId}`,
            body: congratsMessage,
            message: congratsMessage,
            targetRoles: ['agent'],
            ...(detailName
              ? { targetAgentNames: [detailName] }
              : agentNames
              ? { targetAgentNames: agentNames }
              : {}),
            recipientId: uid,
            orderId: bookingId,
            relatedId: bookingId,
            relatedTab: 'agent_space',
            read: false,
            throwOnError: true,
          });
        }
      } else {
        await publishNotification({
          type: 'agent_encouragement',
          title: `Félicitations du gérant · #${bookingId}`,
          body: congratsMessage,
          message: congratsMessage,
          targetRoles: ['agent'],
          ...(agentNames ? { targetAgentNames: agentNames } : {}),
          orderId: bookingId,
          relatedId: bookingId,
          relatedTab: 'agent_space',
          read: false,
          throwOnError: true,
        });
      }
    } catch (error) {
      console.error('[handleCongratulateAgents] Notification creation failed:', {
        bookingId,
        agentIds,
        error,
      });
      throw new Error(
        "L'envoi de la notification d'encouragement dans Firestore a échoué. Vérifiez les règles Firestore et réessayez."
      );
    }

    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        agentsCongratulatedAt: nowIso,
        agentsCongratulatedBy: managerLabel,
        updatedAt: nowIso,
      });
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                agentsCongratulatedAt: nowIso,
                agentsCongratulatedBy: managerLabel,
                updatedAt: nowIso,
              }
            : b
        )
      );
    } catch (error) {
      console.error('[handleCongratulateAgents] Failed to mark booking congratulated:', {
        bookingId,
        managerUid: activeAuthUser.uid,
        error,
      });
      throw new Error(
        formatBookingUpdateError(
          error,
          "La notification a été envoyée, mais l'horodatage de confirmation sur la commande a échoué."
        )
      );
    }
  };

  const handleArchiveBookingPhotos = async (bookingId: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    const archivedAt = new Date().toISOString();

    await persistBookingPatch(bookingId, {
      beforePhotos: [],
      afterPhotos: [],
      photosArchivedAt: archivedAt,
    });

    if (target) {
      const agentTargetList = target.assignedAgents.length > 0 ? target.assignedAgents : undefined;
      const agentTargetIds = (target.assignedAgentIds || []).filter(Boolean);
      const encouragementMsg = `Excellent travail${agentTargetList ? ` ${agentTargetList.join(', ')}` : ''} ! Merci pour votre rigueur sur le terrain (${target.serviceName}), continuez ainsi !`;

      if (agentTargetIds.length > 0) {
        for (const uid of agentTargetIds) {
          await publishNotification({
            type: 'agent_encouragement',
            title: `Bravo pour la mission #${bookingId} !`,
            body: encouragementMsg,
            message: encouragementMsg,
            targetRoles: ['agent'],
            ...(agentTargetList ? { targetAgentNames: agentTargetList } : {}),
            recipientId: uid,
            orderId: bookingId,
            relatedId: bookingId,
            relatedTab: 'agent_space',
            read: false,
          });
        }
      } else {
        await publishNotification({
          type: 'agent_encouragement',
          title: `Bravo pour la mission #${bookingId} !`,
          body: encouragementMsg,
          message: encouragementMsg,
          targetRoles: ['agent'],
          ...(agentTargetList ? { targetAgentNames: agentTargetList } : {}),
          relatedId: bookingId,
          relatedTab: 'agent_space',
        });
      }
    }
  };

  const visibleCatalogServices = services.filter((srv) => {
    if (serviceFilter === 'vehicles') return srv.category === 'Véhicules';
    if (serviceFilter === 'home') return srv.category !== 'Véhicules';
    return true;
  });
  const approvedPromotions = [...promotions]
    .filter((p) => p.status === 'active' || p.status === 'approved')
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));

  const visibleNotifications = (isActualAdmin
    ? notifications.filter((n) => n.targetRoles.includes(currentRole))
    : notifications
  ).filter((n) => isNotificationFresh(n.createdAt));

  // Blocage strict : aucun accès à l'interface ni fallback hors ligne tant qu'Internet réel n'est pas vérifié
  if (networkStatus !== 'online') {
    return (
      <NetworkRequiredGate
        status={networkStatus}
        isChecking={isCheckingNetwork}
        onRetry={retryNetworkCheck}
      />
    );
  }

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

  if (firebaseUser && userProfile && isCompanyBlocked) {
    return (
      <CompanyValidationGate
        profile={userProfile}
        status={companyValidationStatus === 'rejected' ? 'rejected' : 'pending'}
        onSignOut={handleSignOut}
      />
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
              alt="Shine-x-Sanitize"
              className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 border border-slate-200 shrink-0"
              referrerPolicy="no-referrer"
            />
            <span className="text-sm sm:text-base font-extrabold tracking-tight text-emerald-950 truncate">
              Shine-x-Sanitize
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
              onClick={() => setActiveTab('panier')}
              className={`whitespace-nowrap shrink-0 py-1 inline-flex items-center gap-1.5 transition-colors ${
                activeTab === 'panier'
                  ? 'text-emerald-800 font-semibold border-b-2 border-emerald-700'
                  : 'hover:text-slate-900'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Panier</span>
              {cartTotalUnits > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-700 text-white text-[10px] font-bold tabular-nums leading-none">
                  {cartTotalUnits}
                </span>
              )}
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

          {/* Zone 3: Panier / PWA Install / Notification Bell / Auth / Role Switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('panier')}
              aria-label={`Ouvrir le panier (${cartTotalUnits} prestation${cartTotalUnits > 1 ? 's' : ''})`}
              className={`px-2.5 py-2 min-h-[40px] rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'panier'
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Panier</span>
              {cartTotalUnits > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums leading-none ${
                    activeTab === 'panier'
                      ? 'bg-white text-emerald-800'
                      : 'bg-emerald-700 text-white'
                  }`}
                >
                  {cartTotalUnits}
                </span>
              )}
            </button>

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
                {userProfile.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName}
                    className="w-4 h-4 rounded-full object-cover border border-white/40"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{userProfile.displayName.split(' ')[0]}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="px-3.5 py-2 min-h-[40px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{pendingGoogleUser ? 'Finaliser profil' : 'Connexion'}</span>
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
            onClick={() => setActiveTab('panier')}
            className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'panier'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Panier</span>
            {cartTotalUnits > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums leading-none ${
                  activeTab === 'panier'
                    ? 'bg-white text-emerald-800'
                    : 'bg-emerald-700 text-white'
                }`}
              >
                {cartTotalUnits}
              </span>
            )}
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

      {/* ACCOUNT STATUS ALERTS (les entreprises non validées sont bloquées en plein écran) */}
      {isAccountBanned && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-xs text-rose-900 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>
            {`Compte suspendu par l'administrateur : ${userProfile?.banReason || 'Non-respect des règles'}`}
          </span>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        {cartFeedback && activeTab !== 'panier' && (
          <div
            role="status"
            className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{cartFeedback}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCartFeedback('');
                  setActiveTab('panier');
                }}
                className="px-3.5 py-1.5 min-h-[36px] bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Ouvrir le panier ({cartTotalUnits})</span>
              </button>
              <button
                type="button"
                onClick={() => setCartFeedback('')}
                aria-label="Fermer la notification du panier"
                className="p-1 text-emerald-700 hover:text-emerald-950"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ==================== ACCUEIL ==================== */}
        {activeTab === 'home' && (
          <div className="space-y-10">
            {/* Hero Section */}
            <section className="relative rounded-3xl overflow-hidden bg-slate-900 text-white shadow-xl">
              <div className="absolute inset-0">
                <img
                  src="/src/assets/images/hero_shine_alp_1795029308068.jpg"
                  alt="Équipe professionnelle Shine-x-Sanitize à Libreville"
                  className="w-full h-full object-cover opacity-40"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/30" />
              </div>

              <div className="relative z-10 px-6 sm:px-10 py-12 sm:py-16 max-w-2xl space-y-5">
                <div className="flex items-center gap-3">
                  <img
                    src={BRAND_LOGO_URL}
                    alt="Shine-x-Sanitize"
                    className="w-11 h-11 rounded-xl object-contain bg-white p-0.5 border border-white/25 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-xs font-medium text-emerald-300">
                    Shine-x-Sanitize · Grand Libreville
                  </div>
                </div>

                <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight [text-wrap:balance]">
                  Nettoyage professionnel à domicile et en entreprise
                </h1>

                <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-xl">
                  Mobilier et véhicules. Tarifs flexibles, suivi GPS des agents et commandes en temps réel, avec paiement par Airtel Money et Moov Money.
                </p>
              </div>
            </section>

            {/* Quick-Access Vehicle Card (Mes Réservations & GPS, Suivi et Commande et Vélo/Moto/Quad supprimés) */}
            {!isManagerOrAdmin && services.some((s) => s.id === 'srv-5') && (
              <section>
                <button
                  type="button"
                  onClick={() => {
                    const fourWheelSrv = services.find((s) => s.id === 'srv-5');
                    if (fourWheelSrv) openServiceConfigurator(fourWheelSrv, 'order', null);
                  }}
                  className="w-full text-left bg-white hover:border-emerald-700 border border-slate-200 rounded-2xl p-5 shadow-sm transition-colors flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Car className="w-4 h-4 text-emerald-700" />
                      <span>Nettoyage Véhicules à 4 roues</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Nettoyage intérieur complet pour citadine, berline, SUV, pick-up et camion.
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                </button>
              </section>
            )}

            {/* DEDICATED PROMOTIONS SECTION (Live Active Company Announcements) */}
            {approvedPromotions.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Megaphone className="w-5 h-5 text-emerald-700" />
                      <span>Promotions &amp; Offres en Cours</span>
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Offres promotionnelles publiées en direct par nos partenaires {APP_OFFICIAL_NAME}.
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
                            {promo.companyName} · Jusqu&apos;au {promo.validUntil}
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
                          const matchedService = matchServiceForPromotion(promo, services);
                          if (matchedService) {
                            openServiceConfigurator(matchedService, 'order', promo);
                          } else {
                            setActivePromotion(promo);
                            setActiveTab('services');
                          }
                        }}
                        className="self-start px-4 py-2 min-h-[40px] bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                      >
                        <span>Profiter de l&apos;offre</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SERVICES CATALOG ON HOME (SANS PRIX SUR LES CARTES) */}
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Nos Services
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Configurez chaque prestation selon vos besoins et calculez votre devis en temps réel en FCFA.
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
                    Véhicules
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceFilter('home')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      serviceFilter === 'home' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Mobilier &amp; Vitrerie
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleCatalogServices.map((service) => {
                  const isFourWheel = service.id === 'srv-5' || service.vehicleType === '4_wheels';
                  return (
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
                          </div>
                          <h3 className="text-base font-bold text-slate-900">{service.name}</h3>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {service.description}
                          </p>
                          {isFourWheel && (
                            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-[11px] font-medium text-amber-950 flex items-start gap-1.5">
                              <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                              <span>{VEHICLE_4W_INTERIOR_NOTE}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-5 pt-0 space-y-2">
                        <button
                          type="button"
                          onClick={() => openServiceConfigurator(service, 'order', null)}
                          className="w-full py-2.5 min-h-[44px] px-4 bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Configurer &amp; Réserver</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openServiceConfigurator(service, 'cart', null)}
                          className="w-full py-2.5 min-h-[44px] px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <ShoppingCart className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Ajouter au panier</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                  Catalogue des Services — {APP_OFFICIAL_NAME}
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Choisissez la prestation souhaitée, sélectionnez vos éléments et obtenez votre devis instantané en FCFA.
                </p>
              </div>
            </div>

            {activePromotion && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-emerald-950">
                  <Tag className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    Promotion active :{' '}
                    <strong>{parsePromotionDiscount(activePromotion).shortLabel}</strong> ·{' '}
                    {activePromotion.title}. Choisissez un service ci-dessous pour appliquer la remise automatiquement.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePromotion(null)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold"
                >
                  Retirer l&apos;offre
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => {
                const isFourWheel = service.id === 'srv-5' || service.vehicleType === '4_wheels';
                return (
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
                        </div>
                        <h3 className="text-base font-bold text-slate-900">{service.name}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">{service.description}</p>
                        {isFourWheel && (
                          <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-[11px] font-medium text-amber-950 flex items-start gap-1.5">
                            <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                            <span>{VEHICLE_4W_INTERIOR_NOTE}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-5 pt-0 space-y-2">
                      <button
                        type="button"
                        onClick={() => openServiceConfigurator(service, 'order')}
                        className="w-full py-2.5 min-h-[44px] bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
                      >
                        Lancer le Configurateur
                      </button>

                      <button
                        type="button"
                        onClick={() => openServiceConfigurator(service, 'cart')}
                        className="w-full py-2.5 min-h-[44px] px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Ajouter au panier</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== PANIER CLIENT ==================== */}
        {activeTab === 'panier' && (
          <CartView
            items={cartItems}
            selectedExtras={cartExtras}
            catalogServices={services}
            availablePromotions={approvedPromotions}
            selectedCartPromotion={cartPromotion}
            ownerUid={firebaseUser?.uid || ''}
            defaultClientName={userProfile?.displayName || ''}
            defaultClientPhone={userProfile?.phone || '+241 '}
            isSubmitting={isSubmittingCartOrder}
            submitError={cartSubmitError}
            onSelectCartPromotion={setCartPromotion}
            onToggleExtra={handleToggleCartExtra}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveCartItem}
            onClearCart={handleClearCart}
            onOpenCatalog={() => setActiveTab('services')}
            onSubmitCartOrder={handleSubmitCartOrder}
          />
        )}

        {/* ==================== MES RÉSERVATIONS (ISOLATION STRICTE PAR CLIENT) ==================== */}
        {activeTab === 'mes_reservations' && (
          <ClientReservationsView
            bookings={
              firebaseUser && userProfile
                ? bookings.filter(
                    (b) =>
                      b.ownerUid === firebaseUser.uid ||
                      b.userId === firebaseUser.uid ||
                      b.clientId === firebaseUser.uid
                  )
                : []
            }
            refusalNotifications={notifications.filter(
              (n) =>
                n.type === 'order_refused' &&
                (!firebaseUser ||
                  n.recipientId === firebaseUser.uid ||
                  n.targetOwnerUid === firebaseUser.uid)
            )}
            thankYouNotifications={notifications.filter(
              (n) =>
                n.type === 'client_thank_you' &&
                (!firebaseUser ||
                  n.recipientId === firebaseUser.uid ||
                  n.targetOwnerUid === firebaseUser.uid)
            )}
            readNotificationIds={readNotificationIds}
            isAuthenticated={Boolean(firebaseUser && userProfile)}
            onOpenAuth={() => setShowAuthModal(true)}
            onAcceptCounterOffer={handleAcceptCounterOffer}
            onSubmitReview={handleSubmitReview}
            onToggleClientGps={handleToggleClientGps}
            onDismissRefusalNotification={handleMarkNotificationRead}
            onDismissNotification={handleMarkNotificationRead}
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
            currentUserUid={firebaseUser?.uid || ''}
            isAdmin={isActualAdmin}
            onValidateOrder={handleValidateOrder}
            onRefuseOrder={handleRefuseOrder}
            onDeleteOrder={handleDeleteOrder}
            onCongratulateAgents={handleCongratulateAgents}
            onArchivePhotos={handleArchiveBookingPhotos}
            onUpdatePrice={handleUpdatePrice}
            onAssignAgents={handleAssignAgents}
            onUpdateServiceBasePrice={handleUpdateServiceBasePrice}
            onCreatePromotion={handleCreatePromotion}
            onUpdatePromotion={handleUpdatePromotion}
            onDeletePromotion={handleDeletePromotion}
          />
        )}

        {/* ==================== ESPACE AGENT ==================== */}
        {activeTab === 'agent_space' && currentRole === 'agent' && (
          <AgentWorkspaceView
            bookings={bookings}
            agentName={userProfile?.displayName || 'Agent'}
            agentUid={userProfile?.role === 'agent' ? firebaseUser?.uid : undefined}
            isAdminPreview={isActualAdmin}
            notifications={visibleNotifications.filter(
              (n) =>
                isActualAdmin ||
                n.recipientId === firebaseUser?.uid ||
                n.targetRoles.includes('agent')
            )}
            readNotificationIds={readNotificationIds}
            onMarkNotificationRead={handleMarkNotificationRead}
            onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
            onToggleGps={handleToggleGps}
            onUpdateAgentGps={handleUpdateAgentGps}
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
            onApproveCompany={handleApproveCompany}
            onRejectCompany={handleRejectCompany}
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

      {/* SMART SERVICE CONFIGURATOR MODAL */}
      {selectedService && (
        <ServiceConfiguratorModal
          service={selectedService}
          ownerUid={firebaseUser?.uid || ''}
          defaultClientName={userProfile?.displayName || ''}
          defaultClientPhone={userProfile?.phone || '+241 '}
          appliedPromotion={activePromotion}
          initialIntent={configuratorIntent}
          onRemovePromotion={() => setActivePromotion(null)}
          onClose={() => {
            setSelectedService(null);
            setActivePromotion(null);
            setConfiguratorIntent('order');
          }}
          onSubmitBooking={handleCreateBooking}
          onAddToCart={handleAddConfiguredItemToCart}
        />
      )}

      {/* AUTHENTICATION & REGISTRATION MODAL */}
      {showAuthModal && (
        <AuthModal
          initialError={authRedirectError}
          pendingGoogleUser={pendingGoogleUser}
          initialPartialProfile={pendingPartialProfile}
          onBeginGoogleCompletion={(uid) => {
            completingOnboardingUidRef.current = uid;
          }}
          onCancelGoogleOnboarding={handleSignOut}
          onAuthComplete={async (profile) => {
            setAuthRedirectError('');
            await handleCompleteOnboarding(profile);
          }}
          onLoginSuccess={() => {
            setAuthRedirectError('');
            if (auth.currentUser) {
              syncSignedInUserProfile(auth.currentUser).catch(() => {});
            }
          }}
          onClose={() => {
            setAuthRedirectError('');
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
    </div>
  );
}
