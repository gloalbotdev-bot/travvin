/**
 * Per-owner CalendarConnection store (M8).
 */
import { CalendarConnectionStatus, CalendarProvider } from '@prisma/client';
import { decryptSecret, encryptSecret } from './token-crypto.js';
import {
  refreshCalendarAccessToken,
  resolvePrimaryCalendarId,
} from './google-calendar-oauth.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export function createCalendarConnectionStore(prisma) {
  return {
    async find(ownerId, provider = CalendarProvider.google) {
      return prisma.calendarConnection.findUnique({
        where: { ownerId_provider: { ownerId, provider } },
      });
    },

    async upsertFromOAuth(ownerId, { refreshToken, accessToken, scopes }) {
      const { calendarId, accountEmail } = await resolvePrimaryCalendarId(accessToken);
      const refreshTokenEnc = encryptSecret(refreshToken);
      return prisma.calendarConnection.upsert({
        where: {
          ownerId_provider: { ownerId, provider: CalendarProvider.google },
        },
        create: {
          ownerId,
          provider: CalendarProvider.google,
          refreshTokenEnc,
          calendarId,
          accountEmail,
          scopes: scopes || null,
          status: CalendarConnectionStatus.active,
          lastError: null,
        },
        update: {
          refreshTokenEnc,
          calendarId,
          accountEmail,
          scopes: scopes || null,
          status: CalendarConnectionStatus.active,
          lastError: null,
        },
      });
    },

    async revoke(ownerId) {
      const row = await this.find(ownerId);
      if (!row) return null;
      return prisma.calendarConnection.update({
        where: { id: row.id },
        data: {
          status: CalendarConnectionStatus.revoked,
          refreshTokenEnc: encryptSecret('revoked'),
          lastError: null,
        },
      });
    },

    toPublic(row) {
      if (!row) return { connected: false };
      return {
        connected: row.status === CalendarConnectionStatus.active,
        provider: row.provider,
        calendar_id: row.calendarId,
        account_email: row.accountEmail,
        status: row.status,
      };
    },

    /**
     * Resolve Bearer access token for owner's google calendar.
     * Supports env override: GOOGLE_CALENDAR_REFRESH_TOKEN + GOOGLE_CALENDAR_DEV_OWNER_ID
     */
    async getAccessToken(ownerId) {
      const devOwner = process.env.GOOGLE_CALENDAR_DEV_OWNER_ID;
      const devRefresh = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
      if (devOwner && devRefresh && ownerId === devOwner) {
        const tok = await refreshCalendarAccessToken(devRefresh);
        const row = await this.find(ownerId);
        return {
          accessToken: tok.access_token,
          calendarId: row?.calendarId,
          connection: row,
        };
      }

      const row = await this.find(ownerId);
      if (!row || row.status !== CalendarConnectionStatus.active) {
        const err = new Error('Google Calendar not connected for this owner');
        err.status = 400;
        throw err;
      }
      let refreshToken;
      try {
        refreshToken = decryptSecret(row.refreshTokenEnc);
      } catch (e) {
        await prisma.calendarConnection.update({
          where: { id: row.id },
          data: { status: CalendarConnectionStatus.error, lastError: e.message },
        });
        throw e;
      }
      try {
        const tok = await refreshCalendarAccessToken(refreshToken);
        return {
          accessToken: tok.access_token,
          calendarId: row.calendarId,
          connection: row,
        };
      } catch (e) {
        await prisma.calendarConnection.update({
          where: { id: row.id },
          data: {
            status: CalendarConnectionStatus.error,
            lastError: e instanceof Error ? e.message : String(e),
          },
        });
        throw e;
      }
    },
  };
}
