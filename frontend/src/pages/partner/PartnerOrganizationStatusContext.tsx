import React, { createContext, useContext } from 'react';

export type PartnerOrganizationStatus = 'ACTIVE' | 'INACTIVE' | '';

const PartnerOrganizationStatusContext = createContext<PartnerOrganizationStatus>('');

export const PartnerOrganizationStatusProvider = PartnerOrganizationStatusContext.Provider;

export function usePartnerOrganizationLocked(): boolean {
  return useContext(PartnerOrganizationStatusContext) === 'INACTIVE';
}
