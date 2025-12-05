import { useCallback } from 'react';
import { createPin } from '../../api';
import { haversineDistanceMeters, metersToMiles, METERS_PER_MILE } from '../../utils/geo';
import { playBadgeSound } from '../../utils/badgeSound';
import { sanitizeNumberField, sanitizeDateField } from '../../utils/pinFormValidation';
import {
  MAX_PIN_DISTANCE_MILES,
  MAX_PIN_DISTANCE_METERS,
  EVENT_MAX_LEAD_TIME_MS,
  DISCUSSION_MAX_DURATION_MS
} from './pinFormConstants';

const EVENT_ATTENDEE_LIMITS = {
  min: 5,
  max: 100,
  defaultValue: 30
};

const DISCUSSION_REPLY_LIMIT_OPTIONS = [50, 75, 100, 150, 200];
const DEFAULT_DISCUSSION_REPLY_LIMIT = 100;

export default function usePinSubmissionWorkflow({
  formState,
  pinType,
  autoDelete,
  viewerCoordinates,
  photoAssets,
  coverPhotoId,
  isOffline,
  canBypassLimits = false,
  announceBadgeEarned,
  clearDraft,
  clearDraftStatus,
  onPinCreated,
  setStatus,
  setIsSubmitting,
  setCreatedPin
}) {
  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setStatus(null);

      if (isOffline) {
        setStatus({ type: 'warning', message: 'You are offline. Connect to publish a pin.' });
        return;
      }

      try {
        const enforceLocationRadius = !canBypassLimits;
        const enforceDateWindows = !canBypassLimits;

        const latitude = sanitizeNumberField(formState.latitude);
        const longitude = sanitizeNumberField(formState.longitude);

        if (latitude === null || latitude < -90 || latitude > 90) {
          throw new Error('Latitude must be between -90 and 90.');
        }
        if (longitude === null || longitude < -180 || longitude > 180) {
          throw new Error('Longitude must be between -180 and 180.');
        }

        if (enforceLocationRadius && !viewerCoordinates) {
          throw new Error(
            'We need your current location to confirm this pin. Enable location services and try again.'
          );
        }
        if (enforceLocationRadius) {
          const distanceMeters = haversineDistanceMeters(viewerCoordinates, {
            latitude,
            longitude
          });
          if (!Number.isFinite(distanceMeters)) {
            throw new Error('Unable to validate the selected location. Please try again.');
          }
          if (distanceMeters > MAX_PIN_DISTANCE_METERS) {
            const miles = metersToMiles(distanceMeters);
            const distanceLabel =
              miles === null ? 'farther than allowed' : `${miles.toFixed(1)} miles away`;
            throw new Error(
              `Pins must be within ${MAX_PIN_DISTANCE_MILES} miles of you. This spot is about ${distanceLabel}.`
            );
          }
        }

        const title = formState.title.trim();
        const description = formState.description.trim();
        if (!title) {
          throw new Error('Title is required.');
        }
        if (!description) {
          throw new Error('Description is required.');
        }

        const proximityMiles = sanitizeNumberField(formState.proximityRadiusMiles);
        if (proximityMiles !== null && proximityMiles <= 0) {
          throw new Error('Proximity radius must be greater than zero.');
        }

        const submissionNow = new Date();
        const eventMaxDate = enforceDateWindows
          ? new Date(submissionNow.getTime() + EVENT_MAX_LEAD_TIME_MS)
          : null;
        const discussionMaxDate = enforceDateWindows
          ? new Date(submissionNow.getTime() + DISCUSSION_MAX_DURATION_MS)
          : null;

        const payload = {
          type: pinType,
          title,
          description,
          coordinates: {
            latitude,
            longitude
          },
          proximityRadiusMeters:
            proximityMiles !== null ? Math.round(proximityMiles * METERS_PER_MILE) : undefined
        };

        if (pinType === 'event') {
          const startDate = sanitizeDateField(formState.startDate, 'Start date', {
            allowPast: canBypassLimits,
            ...(enforceDateWindows
              ? {
                  max: eventMaxDate,
                  maxMessage: 'Events can only be scheduled up to 14 days in advance.'
                }
              : {})
          });
          const endDate = sanitizeDateField(formState.endDate, 'End date', {
            min: startDate,
            minMessage: 'End date must be on or after the start date.',
            allowPast: canBypassLimits,
            ...(enforceDateWindows
              ? {
                  max: eventMaxDate,
                  maxMessage: 'Events can only be scheduled up to 14 days in advance.'
                }
              : {})
          });
          payload.startDate = startDate.toISOString();
          payload.endDate = endDate.toISOString();

          const precise = formState.addressPrecise.trim();
          const city = formState.addressCity.trim();
          const state = formState.addressState.trim();
          const postalCode = formState.addressPostalCode.trim();
          const country = formState.addressCountry.trim();

          if (precise) {
            const components = {
              city: city || undefined,
              state: state || undefined,
              postalCode: postalCode || undefined,
              country: country || undefined
            };

            payload.address = {
              precise,
              components: Object.values(components).some(Boolean) ? components : undefined
            };
          }

          const attendeeLimitValue = sanitizeNumberField(formState.participantLimit);
          const normalizedAttendeeLimit =
            attendeeLimitValue === null ? EVENT_ATTENDEE_LIMITS.defaultValue : attendeeLimitValue;
          if (
            normalizedAttendeeLimit < EVENT_ATTENDEE_LIMITS.min ||
            normalizedAttendeeLimit > EVENT_ATTENDEE_LIMITS.max
          ) {
            throw new Error(
              `Attendee limit must be between ${EVENT_ATTENDEE_LIMITS.min} and ${EVENT_ATTENDEE_LIMITS.max}.`
            );
          }
          payload.participantLimit = normalizedAttendeeLimit;
        } else {
          const expiresAt = sanitizeDateField(formState.expiresAt, 'Expiration date', {
            allowPast: canBypassLimits,
            ...(enforceDateWindows
              ? {
                  max: discussionMaxDate,
                  maxMessage: 'Discussions can only stay active for up to 3 days.'
                }
              : {})
          });
          payload.expiresAt = expiresAt.toISOString();
          payload.autoDelete = autoDelete;

          const approximateAddress = {
            formatted: formState.approxFormatted.trim() || undefined,
            city: formState.approxCity.trim() || undefined,
            state: formState.approxState.trim() || undefined,
            country: formState.approxCountry.trim() || undefined
          };

          if (Object.values(approximateAddress).some(Boolean)) {
            payload.approximateAddress = approximateAddress;
          }

          const replyLimitValue = sanitizeNumberField(formState.replyLimit);
          const normalizedReplyLimit = DISCUSSION_REPLY_LIMIT_OPTIONS.includes(replyLimitValue)
            ? replyLimitValue
            : DEFAULT_DISCUSSION_REPLY_LIMIT;
          payload.replyLimit = normalizedReplyLimit;
        }

        if (photoAssets.length > 0) {
          payload.photos = photoAssets.map((photo) => ({
            url: photo.asset.url,
            width: photo.asset.width,
            height: photo.asset.height,
            mimeType: photo.asset.mimeType,
            description: photo.asset.description
          }));

          const selectedCover =
            photoAssets.find((photo) => photo.id === coverPhotoId) ?? photoAssets[0];
          if (selectedCover) {
            payload.coverPhoto = {
              url: selectedCover.asset.url,
              width: selectedCover.asset.width,
              height: selectedCover.asset.height,
              mimeType: selectedCover.asset.mimeType,
              description: selectedCover.asset.description
            };
          }
        }

        setIsSubmitting(true);
        const result = await createPin(payload);
        setCreatedPin(result);
        if (result?._badgeEarnedId) {
          playBadgeSound();
          announceBadgeEarned(result._badgeEarnedId);
        }
        setStatus({
          type: 'success',
          message: result?._id
            ? `Pin created successfully (ID: ${result._id}).`
            : 'Pin created successfully.'
        });
        clearDraft();
        clearDraftStatus();
        onPinCreated(result);
      } catch (error) {
        setStatus({
          type: 'error',
          message: error?.message || 'Failed to create pin.'
        });
        return;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      announceBadgeEarned,
      autoDelete,
      clearDraft,
      clearDraftStatus,
      coverPhotoId,
      formState,
      isOffline,
      onPinCreated,
      photoAssets,
      pinType,
      canBypassLimits,
      setCreatedPin,
      setIsSubmitting,
      setStatus,
      viewerCoordinates
    ]
  );

  return { handleSubmit };
}
