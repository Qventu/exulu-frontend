/**
 * GraphQL operations + type for the Plan-2 email-inbound platform config.
 * super_admin-only on the backend; the signing key is WRITE-ONLY and never
 * returned (has_signing_key indicates presence). Lives in lib/ because both
 * the workflows feature (not-configured CTA) and the configuration feature
 * (admin surface) consume it.
 */

import { gql } from "@apollo/client";

export interface EmailInboundConfig {
  provider?: string | null;
  inbound_domain?: string | null;
  enabled?: boolean | null;
  last_webhook_at?: string | null;
  webhook_url?: string | null;
  has_signing_key?: boolean | null;
}

const EMAIL_INBOUND_SELECTION = `
  provider
  inbound_domain
  enabled
  last_webhook_at
  webhook_url
  has_signing_key
`;

export const EMAIL_INBOUND_CONFIG = gql`
  query EmailInboundConfig {
    emailInboundConfig {
      ${EMAIL_INBOUND_SELECTION}
    }
  }
`;

export const UPDATE_EMAIL_INBOUND_CONFIG = gql`
  mutation UpdateEmailInboundConfig(
    $provider: String
    $inbound_domain: String
    $enabled: Boolean
    $signing_key: String
  ) {
    updateEmailInboundConfig(
      provider: $provider
      inbound_domain: $inbound_domain
      enabled: $enabled
      signing_key: $signing_key
    ) {
      ${EMAIL_INBOUND_SELECTION}
    }
  }
`;
