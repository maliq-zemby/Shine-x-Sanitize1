import React, { useState } from 'react';
import {
  Ban,
  Building2,
  Check,
  ClipboardCheck,
  Loader2,
  Megaphone,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { AccountStatus, Booking, Promotion, UserProfile } from '../types';
import {
  COMPANY_REJECTION_REASON_MAX,
  COMPANY_REJECTION_REASON_MIN,
  getCompanyValidationStatus,
} from '../utils/companyValidation';
import { LiveGpsMap } from './LiveGpsMap';

interface AdminDashboardViewProps {
  users: UserProfile[];
  bookings: Booking[];
  promotions: Promotion[];
  commissionRate: number;
  onChangeCommissionRate: (rate: number) => void;
  onUpdateUserStatus: (uid: string, status: AccountStatus, reason?: string) => void;
  onApproveCompany: (uid: string) => Promise<void>;
  onRejectCompany: (uid: string, reason: string) => Promise<void>;
  onDeleteUser: (uid: string) => void;
  onPurgePrototypeData: () => Promise<{ users: number; bookings: number; promos: number }>;
  onUpdatePromotionStatus: (promoId: string, status: 'approved' | 'rejected') => void;
  onOpenSuiviCommande: () => void;
}

const ROLE_LABELS: Record<UserProfile['role'], string> = {
  client: 'Client',
  agent: 'Agent',
  manager: 'Entreprise / Gérant',
  admin: 'Administrateur',
};

const STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Actif',
  pending: 'En attente de validation',
  rejected: 'Inscription refusée',
  banned: 'Compte banni',
};

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  users,
  bookings,
  promotions,
  commissionRate,
  onChangeCommissionRate,
  onUpdateUserStatus,
  onApproveCompany,
  onRejectCompany,
  onDeleteUser,
  onPurgePrototypeData,
  onUpdatePromotionStatus,
  onOpenSuiviCommande,
}) => {
  const [adminTab, setAdminTab] = useState<'users' | 'promos' | 'gps'>('users');
  const [userFilter, setUserFilter] = useState<'all' | AccountStatus>('all');
  const [banTargetUid, setBanTargetUid] = useState<string | null>(null);
  const [banReasonInput, setBanReasonInput] = useState(
    'Non-respect des règles ou litiges répétés'
  );
  const [purging, setPurging] = useState(false);
  const [purgeNotice, setPurgeNotice] = useState('');

  // Validation des inscriptions Entreprise / Gérant
  const [busyCompanyUid, setBusyCompanyUid] = useState<string | null>(null);
  const [companyActionError, setCompanyActionError] = useState('');
  const [companyNotice, setCompanyNotice] = useState('');
  const [rejectTarget, setRejectTarget] = useState<UserProfile | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const pendingCompanies = users
    .filter((u) => getCompanyValidationStatus(u) === 'pending')
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  const handleApproveCompany = async (user: UserProfile) => {
    setCompanyActionError('');
    setCompanyNotice('');
    setBusyCompanyUid(user.uid);
    try {
      await onApproveCompany(user.uid);
      setCompanyNotice(`${user.companyName || user.displayName} a été validée et notifiée.`);
    } catch (err) {
      setCompanyActionError(err instanceof Error ? err.message : 'Validation impossible.');
    } finally {
      setBusyCompanyUid(null);
    }
  };

  const openRejectModal = (user: UserProfile) => {
    setRejectTarget(user);
    setRejectReasonInput('');
    setRejectError('');
  };

  const closeRejectModal = () => {
    if (rejectSubmitting) return;
    setRejectTarget(null);
    setRejectReasonInput('');
    setRejectError('');
  };

  const trimmedRejectReason = rejectReasonInput.trim();
  const isRejectReasonValid = trimmedRejectReason.length >= COMPANY_REJECTION_REASON_MIN;

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    if (!isRejectReasonValid) {
      setRejectError(
        `Le motif de rejet est obligatoire (${COMPANY_REJECTION_REASON_MIN} caractères minimum).`
      );
      return;
    }
    setRejectSubmitting(true);
    setRejectError('');
    setCompanyNotice('');
    try {
      await onRejectCompany(rejectTarget.uid, trimmedRejectReason);
      setCompanyNotice(
        `${rejectTarget.companyName || rejectTarget.displayName} a été rejetée. Le motif lui a été transmis.`
      );
      setRejectTarget(null);
      setRejectReasonInput('');
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : 'Rejet impossible.');
    } finally {
      setRejectSubmitting(false);
    }
  };

  const handleRunPurge = async () => {
    setPurging(true);
    setPurgeNotice('');
    try {
      const res = await onPurgePrototypeData();
      setPurgeNotice(
        `Nettoyage terminé : ${res.users} compte(s) fictif(s), ${res.bookings} commande(s) de test et ${res.promos} annonce(s) prototype supprimé(s).`
      );
    } finally {
      setPurging(false);
    }
  };

  const pendingUsersCount = users.filter((u) => u.accountStatus === 'pending').length;
  const pendingPromosCount = promotions.filter((p) => p.status === 'pending').length;
  const bannedCount = users.filter((u) => u.accountStatus === 'banned').length;
  const totalRevenue = bookings
    .filter((b) => b.status !== 'cancelled' && b.status !== 'rejected')
    .reduce((acc, b) => acc + b.finalPrice, 0);
  const platformCommission = Math.round((totalRevenue * commissionRate) / 100);

  const visibleUsers = users.filter((u) =>
    userFilter === 'all' ? true : u.accountStatus === userFilter
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Bureau Administrateur — Shine-x-Sanitize Alp Group
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Gouvernance complète : liste des personnes inscrites, acceptation ou refus des entreprises, bannissement de comptes, validation des promotions et suivi GPS global.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start">
          <button
            type="button"
            onClick={() => setAdminTab('users')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              adminTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Inscrits ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('promos')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              adminTab === 'promos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Promotions ({pendingPromosCount} à valider)
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('gps')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              adminTab === 'gps' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            GPS & Commissions
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-medium">Personnes inscrites</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{users.length}</div>
          <div className="text-[11px] text-amber-700 font-medium">
            {pendingUsersCount} en attente d'approbation
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-medium">Annonces promotionnelles</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {promotions.filter((p) => p.status === 'active' || p.status === 'approved').length} actives
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            {pendingPromosCount > 0 ? `${pendingPromosCount} à vérifier` : 'Publication directe active'}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-medium">Comptes bannis</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{bannedCount}</div>
          <div className="text-[11px] text-slate-500 font-medium">Modération active</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-medium">Commissions ({commissionRate}%)</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {platformCommission.toLocaleString()} XAF
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            Sur {totalRevenue.toLocaleString()} XAF
          </div>
        </div>
      </div>

      {/* DEMANDES D'INSCRIPTION ENTREPRISES (validation obligatoire) */}
      <section
        aria-labelledby="company-requests-title"
        className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 bg-amber-50/70 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2
            id="company-requests-title"
            className="text-lg font-bold text-slate-900 flex items-center gap-2"
          >
            <ClipboardCheck className="w-5 h-5 text-amber-700" />
            <span>Demandes d'inscription Entreprises</span>
          </h2>
          <span className="text-xs font-semibold text-amber-800 tabular-nums">
            {pendingCompanies.length} en attente de validation
          </span>
        </div>

        <div className="p-5 space-y-3">
          {companyNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-3 text-xs font-medium">
              {companyNotice}
            </div>
          )}
          {companyActionError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl px-4 py-3 text-xs font-medium">
              {companyActionError}
            </div>
          )}

          {pendingCompanies.length === 0 ? (
            <div className="text-center text-xs text-slate-500 py-6">
              Aucune demande d'inscription entreprise en attente.
            </div>
          ) : (
            pendingCompanies.map((company) => {
              const isBusy = busyCompanyUid === company.uid;
              return (
                <div
                  key={company.uid}
                  className="border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="truncate">{company.companyName || 'Entreprise sans nom'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{company.displayName}</span>
                      {company.phone && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{company.phone}</span>
                        </>
                      )}
                      {company.commune && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{company.commune}</span>
                        </>
                      )}
                      {company.createdAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            Inscrit le{' '}
                            {new Date(company.createdAt).toLocaleDateString('fr-FR')}
                          </span>
                        </>
                      )}
                    </div>
                    {company.companyDescription && (
                      <p className="text-xs text-slate-600 leading-relaxed pt-1">
                        {company.companyDescription}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleApproveCompany(company)}
                      className="px-4 py-2 min-h-[40px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Valider</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => openRejectModal(company)}
                      className="px-4 py-2 min-h-[40px] bg-rose-50 hover:bg-rose-100 disabled:opacity-60 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Rejeter</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ADMIN TAB 1: REGISTERED USERS & COMPANY GOVERNANCE */}
      {adminTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-emerald-300">
                Assainissement Firestore — Lancement Libreville
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Purgez en un clic tout reliquat de comptes fictifs ou de commandes de test enregistrés en base pendant le prototypage.
              </p>
            </div>
            <button
              type="button"
              disabled={purging}
              onClick={handleRunPurge}
              className="px-4 py-2.5 min-h-[42px] bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{purging ? 'Purge en cours...' : 'Purger les données de test'}</span>
            </button>
          </div>

          {purgeNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-3 text-xs font-medium">
              {purgeNotice}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-700" />
              <span>Liste complète des inscrits & validations</span>
            </h2>

            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              {(['all', 'pending', 'active', 'banned', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setUserFilter(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    userFilter === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {st === 'all'
                    ? 'Tous'
                    : st === 'pending'
                    ? 'En attente'
                    : st === 'active'
                    ? 'Actifs'
                    : st === 'banned'
                    ? 'Bannis'
                    : 'Refusés'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {visibleUsers.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                Aucun compte utilisateur dans cette catégorie. La base est saine et prête pour les inscriptions réelles.
              </div>
            ) : (
              visibleUsers.map((user) => (
              <div
                key={user.uid}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {user.photoURL && (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          className="w-6 h-6 rounded-full object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <span className="font-bold text-slate-900 text-sm">{user.displayName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-emerald-800">
                        {ROLE_LABELS[user.role]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{user.email}</span>
                      {user.phone && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{user.phone}</span>
                        </>
                      )}
                    </div>

                    {user.companyName && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-2 space-y-1">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Entreprise : {user.companyName}</span>
                        </div>
                        {user.companyDescription && (
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {user.companyDescription}
                          </p>
                        )}
                      </div>
                    )}

                    {getCompanyValidationStatus(user) === 'rejected' && user.rejectionReason && (
                      <div className="text-xs text-rose-700 font-medium pt-1">
                        Motif du rejet : {user.rejectionReason}
                      </div>
                    )}

                    {user.accountStatus === 'banned' && user.banReason && (
                      <div className="text-xs text-rose-700 font-medium pt-1">
                        Motif du bannissement : {user.banReason}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold ${
                        user.accountStatus === 'active'
                          ? 'text-emerald-700'
                          : user.accountStatus === 'pending'
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {STATUS_LABELS[user.accountStatus]}
                    </span>

                    {user.role !== 'admin' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {user.accountStatus === 'pending' && (
                          <>
                            <button
                              type="button"
                              disabled={busyCompanyUid === user.uid}
                              onClick={() => handleApproveCompany(user)}
                              className="px-3.5 py-2 min-h-[40px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Valider</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openRejectModal(user)}
                              className="px-3.5 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Rejeter</span>
                            </button>
                          </>
                        )}

                        {user.accountStatus !== 'banned' ? (
                          <button
                            type="button"
                            onClick={() =>
                              setBanTargetUid(banTargetUid === user.uid ? null : user.uid)
                            }
                            className="px-3.5 py-2 min-h-[40px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Bannir</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onUpdateUserStatus(user.uid, 'active')}
                            className="px-3.5 py-2 min-h-[40px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Réactiver le compte</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onDeleteUser(user.uid)}
                          className="px-3 py-2 min-h-[40px] bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                          title="Supprimer définitivement ce compte de Firestore"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {banTargetUid === user.uid && (
                  <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <input
                      type="text"
                      value={banReasonInput}
                      onChange={(e) => setBanReasonInput(e.target.value)}
                      placeholder="Motif du bannissement..."
                      className="flex-1 bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateUserStatus(user.uid, 'banned', banReasonInput);
                        setBanTargetUid(null);
                      }}
                      className="px-4 py-2 min-h-[40px] bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-xl shrink-0"
                    >
                      Confirmer le bannissement
                    </button>
                  </div>
                )}
              </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ADMIN TAB 2: PROMOTIONAL ANNOUNCEMENTS VALIDATION */}
      {adminTab === 'promos' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-emerald-700" />
            <span>Validation des Annonces Promotionnelles</span>
          </h2>
          <p className="text-xs text-slate-600">
            Les annonces publiées par les gérants validés apparaissent immédiatement sur la page d&apos;Accueil. Vous pouvez contrôler ou désactiver une offre si nécessaire.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promotions.map((promo) => {
              const isPublished = promo.status === 'active' || promo.status === 'approved';
              return (
              <div
                key={promo.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-emerald-800">{promo.discountLabel}</span>
                    <span
                      className={`font-semibold ${
                        isPublished
                          ? 'text-emerald-700'
                          : promo.status === 'rejected'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {isPublished
                        ? 'Active (Publiée)'
                        : promo.status === 'rejected'
                        ? 'Désactivée'
                        : 'En attente'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{promo.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{promo.description}</p>
                  <div className="text-[11px] text-slate-500">
                    Entreprise : {promo.companyName} · Catégorie : {promo.serviceCategory}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  {!isPublished && (
                    <button
                      type="button"
                      onClick={() => onUpdatePromotionStatus(promo.id, 'approved')}
                      className="px-4 py-2 min-h-[40px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Réactiver & Publier</span>
                    </button>
                  )}
                  {promo.status !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() => onUpdatePromotionStatus(promo.id, 'rejected')}
                      className="px-4 py-2 min-h-[40px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Désactiver</span>
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ADMIN TAB 3: GLOBAL GPS & COMMISSION SETTINGS */}
      {adminTab === 'gps' && (
        <div className="space-y-6">
          <LiveGpsMap
            bookings={bookings}
            title="Supervision GPS Globale — Clients & Agents en temps réel"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <label htmlFor="comm-rate" className="text-sm font-bold text-slate-900 block">
                Taux de commission plateforme (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="comm-rate"
                  type="number"
                  min={5}
                  max={25}
                  value={commissionRate}
                  onChange={(e) => onChangeCommissionRate(Number(e.target.value) || 10)}
                  className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 tabular-nums"
                />
                <span className="text-xs text-slate-600">
                  Appliqué automatiquement sur chaque prestation validée.
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Contrôle Suivi et Commande</h3>
                  <p className="text-xs text-slate-600">
                    Accédez directement aux commandes pour arbitrer un litige ou modifier un tarif.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenSuiviCommande}
                className="px-4 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl self-start"
              >
                Ouvrir Suivi et Commande
              </button>
            </div>
          </div>
        </div>
      )}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleConfirmReject} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900">
                Rejeter {rejectTarget.companyName || rejectTarget.displayName}
              </h3>
              <button type="button" onClick={closeRejectModal} aria-label="Fermer" className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label htmlFor="reject-reason" className="text-xs font-semibold text-slate-700 block">
              Motif du rejet (obligatoire)
            </label>
            <textarea
              id="reject-reason"
              required
              rows={4}
              maxLength={COMPANY_REJECTION_REASON_MAX}
              value={rejectReasonInput}
              onChange={(e) => setRejectReasonInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            {rejectError && <div className="text-xs text-rose-700 font-medium">{rejectError}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeRejectModal} className="px-4 py-2 bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl">
                Annuler
              </button>
              <button type="submit" disabled={!isRejectReasonValid || rejectSubmitting} className="px-4 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl">
                {rejectSubmitting ? 'Envoi...' : 'Confirmer le rejet'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
