import { CompanyValidationStatus, UserProfile } from '../types';

/**
 * Statut de validation effectif d'un compte Entreprise / Gérant.
 *
 * Les comptes créés avant l'introduction du champ `status` n'en ont pas :
 * on se rabat alors sur `accountStatus` (actif = déjà validé), exactement comme
 * le fait firestore.rules, pour que l'interface et la sécurité restent alignées.
 * Retourne `null` pour tout compte qui n'est pas une entreprise.
 */
export function getCompanyValidationStatus(
  profile: Pick<UserProfile, 'role' | 'status' | 'accountStatus'> | null | undefined
): CompanyValidationStatus | null {
  if (!profile || profile.role !== 'manager') return null;
  if (profile.status === 'pending' || profile.status === 'approved' || profile.status === 'rejected') {
    return profile.status;
  }
  if (profile.accountStatus === 'pending') return 'pending';
  if (profile.accountStatus === 'rejected') return 'rejected';
  return 'approved';
}

/** Vrai pour une entreprise en attente ou refusée : aucun accès à l'espace entreprise. */
export function isCompanyAccessBlocked(
  profile: Pick<UserProfile, 'role' | 'status' | 'accountStatus'> | null | undefined
): boolean {
  const status = getCompanyValidationStatus(profile);
  return status === 'pending' || status === 'rejected';
}

export const COMPANY_REJECTION_REASON_MIN = 3;
export const COMPANY_REJECTION_REASON_MAX = 300;
