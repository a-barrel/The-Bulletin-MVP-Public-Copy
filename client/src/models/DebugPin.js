class DebugPin {
  constructor({
    id = null,
    type = 'event',
    title = '',
    description = '',
    latitude = null,
    longitude = null,
    proximityRadiusMeters = null,
    startDate = null,
    endDate = null,
    expiresAt = null,
    address = null,
    approximateAddress = null,
    photos = [],
    coverPhoto = null,
    createdAt = null,
    updatedAt = null,
    autoDelete = null
  }) {
    this.id = id ?? null;
    this.type = type;
    this.title = title ?? '';
    this.description = description ?? '';
    this.latitude = latitude !== null && latitude !== undefined ? Number(latitude) : null;
    this.longitude = longitude !== null && longitude !== undefined ? Number(longitude) : null;
    this.proximityRadiusMeters =
      proximityRadiusMeters !== null && proximityRadiusMeters !== undefined
        ? Number(proximityRadiusMeters)
        : null;
    this.startDate = startDate ?? null;
    this.endDate = endDate ?? null;
    this.expiresAt = expiresAt ?? null;
    this.address = address
      ? {
          ...address,
          components: address.components ? { ...address.components } : undefined
        }
      : null;
    this.approximateAddress = approximateAddress ? { ...approximateAddress } : null;
    this.photos = Array.isArray(photos) ? photos.map((photo) => ({ ...photo })) : [];
    this.coverPhoto = coverPhoto ? { ...coverPhoto } : null;
    this.createdAt = createdAt ?? null;
    this.updatedAt = updatedAt ?? null;
    this.autoDelete = autoDelete ?? null;
  }

  static fromApi(payload = {}) {
    const coordinates = payload.coordinates?.coordinates ?? [];
    const [longitude, latitude] = coordinates;

    return new DebugPin({
      id: payload._id ?? payload.id ?? null,
      type: payload.type ?? 'event',
      title: payload.title ?? '',
      description: payload.description ?? '',
      latitude: latitude !== undefined ? Number(latitude) : null,
      longitude: longitude !== undefined ? Number(longitude) : null,
      proximityRadiusMeters: payload.proximityRadiusMeters ?? null,
      startDate: payload.startDate ?? null,
      endDate: payload.endDate ?? null,
      expiresAt: payload.expiresAt ?? null,
      address: payload.address ?? null,
      approximateAddress: payload.approximateAddress ?? null,
      photos: Array.isArray(payload.photos) ? payload.photos : [],
      coverPhoto: payload.coverPhoto ?? null,
      createdAt: payload.createdAt ?? null,
      updatedAt: payload.updatedAt ?? null,
      autoDelete: payload.autoDelete ?? null
    });
  }

  toObject() {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      description: this.description,
      latitude: this.latitude,
      longitude: this.longitude,
      proximityRadiusMeters: this.proximityRadiusMeters,
      startDate: this.startDate,
      endDate: this.endDate,
      expiresAt: this.expiresAt,
      address: this.address ? { ...this.address, components: this.address.components ? { ...this.address.components } : undefined } : null,
      approximateAddress: this.approximateAddress ? { ...this.approximateAddress } : null,
      photos: this.photos.map((photo) => ({ ...photo })),
      coverPhoto: this.coverPhoto ? { ...this.coverPhoto } : null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      autoDelete: this.autoDelete
    };
  }

  toJSON() {
    const coordinates =
      this.longitude !== null && this.latitude !== null
        ? {
            type: 'Point',
            coordinates: [this.longitude, this.latitude]
          }
        : undefined;

    return {
      _id: this.id ?? undefined,
      type: this.type,
      title: this.title,
      description: this.description,
      coordinates,
      proximityRadiusMeters: this.proximityRadiusMeters ?? undefined,
      startDate: this.startDate ?? undefined,
      endDate: this.endDate ?? undefined,
      expiresAt: this.expiresAt ?? undefined,
      address: this.address ?? undefined,
      approximateAddress: this.approximateAddress ?? undefined,
      photos: this.photos.map((photo) => ({ ...photo })),
      coverPhoto: this.coverPhoto ? { ...this.coverPhoto } : undefined,
      createdAt: this.createdAt ?? undefined,
      updatedAt: this.updatedAt ?? undefined,
      autoDelete: this.autoDelete ?? undefined
    };
  }

  toEditable() {
    const toStringOrEmpty = (value) =>
      value === null || value === undefined || Number.isNaN(value) ? '' : String(value);

    return {
      id: this.id ?? '',
      type: this.type,
      title: this.title ?? '',
      description: this.description ?? '',
      latitude: toStringOrEmpty(this.latitude),
      longitude: toStringOrEmpty(this.longitude),
      proximityRadiusMeters: toStringOrEmpty(this.proximityRadiusMeters),
      startDate: this.startDate ?? '',
      endDate: this.endDate ?? '',
      expiresAt: this.expiresAt ?? '',
      addressPrecise: this.address?.precise ?? '',
      addressCity: this.address?.components?.city ?? '',
      addressState: this.address?.components?.state ?? '',
      addressPostalCode: this.address?.components?.postalCode ?? '',
      addressCountry: this.address?.components?.country ?? '',
      approximateCity: this.approximateAddress?.city ?? '',
      approximateState: this.approximateAddress?.state ?? '',
      approximateCountry: this.approximateAddress?.country ?? '',
      approximateFormatted: this.approximateAddress?.formatted ?? ''
    };
  }

  withUpdates(updates = {}) {
    return new DebugPin({
      ...this.toObject(),
      ...updates
    });
  }

  updateFromEditable(editable = {}) {
    const trim = (value) => (typeof value === 'string' ? value.trim() : value);

    const nextTitle = trim(editable.title ?? this.title);
    const nextDescription = trim(editable.description ?? this.description);

    const latitudeRaw = trim(editable.latitude);
    let nextLatitude = this.latitude;
    if (latitudeRaw !== undefined) {
      if (latitudeRaw === '' || latitudeRaw === null) {
        nextLatitude = null;
      } else {
        const parsed = Number.parseFloat(latitudeRaw);
        if (Number.isNaN(parsed)) {
          throw new Error('Latitude must be a valid number.');
        }
        nextLatitude = parsed;
      }
    }

    const longitudeRaw = trim(editable.longitude);
    let nextLongitude = this.longitude;
    if (longitudeRaw !== undefined) {
      if (longitudeRaw === '' || longitudeRaw === null) {
        nextLongitude = null;
      } else {
        const parsed = Number.parseFloat(longitudeRaw);
        if (Number.isNaN(parsed)) {
          throw new Error('Longitude must be a valid number.');
        }
        nextLongitude = parsed;
      }
    }

    const proximityRaw = trim(editable.proximityRadiusMeters);
    let nextProximity = this.proximityRadiusMeters;
    if (proximityRaw !== undefined) {
      if (proximityRaw === '' || proximityRaw === null) {
        nextProximity = null;
      } else {
        const parsed = Number.parseFloat(proximityRaw);
        if (Number.isNaN(parsed)) {
          throw new Error('Proximity radius must be a valid number.');
        }
        nextProximity = parsed;
      }
    }

    const normalizedDate = (value) => {
      const trimmed = trim(value);
      return trimmed ? trimmed : null;
    };

    const nextStartDate = normalizedDate(editable.startDate ?? this.startDate);
    const nextEndDate = normalizedDate(editable.endDate ?? this.endDate);
    const nextExpiresAt = normalizedDate(editable.expiresAt ?? this.expiresAt);

    let nextAddress = this.address;
    if (this.type === 'event') {
      const precise = trim(editable.addressPrecise);
      const city = trim(editable.addressCity);
      const state = trim(editable.addressState);
      const postalCode = trim(editable.addressPostalCode);
      const country = trim(editable.addressCountry);

      const hasAddress = precise || city || state || postalCode || country;
      nextAddress = hasAddress
        ? {
            precise: precise || undefined,
            components:
              city || state || postalCode || country
                ? {
                    line1: precise || undefined,
                    city: city || undefined,
                    state: state || undefined,
                    postalCode: postalCode || undefined,
                    country: country || undefined
                  }
                : undefined
          }
        : null;
    }

    let nextApproximate = this.approximateAddress;
    if (this.type === 'discussion') {
      const approxCity = trim(editable.approximateCity);
      const approxState = trim(editable.approximateState);
      const approxCountry = trim(editable.approximateCountry);
      const approxFormatted = trim(editable.approximateFormatted);
      const hasApprox = approxCity || approxState || approxCountry || approxFormatted;
      nextApproximate = hasApprox
        ? {
            city: approxCity || undefined,
            state: approxState || undefined,
            country: approxCountry || undefined,
            formatted: approxFormatted || undefined
          }
        : null;
    }

    return this.withUpdates({
      title: nextTitle,
      description: nextDescription,
      latitude: nextLatitude,
      longitude: nextLongitude,
      proximityRadiusMeters: nextProximity,
      startDate: nextStartDate,
      endDate: nextEndDate,
      expiresAt: nextExpiresAt,
      address: nextAddress,
      approximateAddress: nextApproximate
    });
  }

  toUpsertPayload() {
    if (this.latitude === null || this.longitude === null) {
      throw new Error('Latitude and longitude are required before saving.');
    }

    const payload = {
      type: this.type,
      title: this.title,
      description: this.description,
      coordinates: {
        latitude: this.latitude,
        longitude: this.longitude
      },
      proximityRadiusMeters: this.proximityRadiusMeters ?? undefined,
      photos: this.photos
        .filter((photo) => Boolean(photo?.url))
        .map((photo) => ({
          url: photo.url,
          width: photo.width,
          height: photo.height,
          mimeType: photo.mimeType,
          description: photo.description
        })),
      coverPhoto: this.coverPhoto?.url
        ? {
            url: this.coverPhoto.url,
            width: this.coverPhoto.width,
            height: this.coverPhoto.height,
            mimeType: this.coverPhoto.mimeType,
            description: this.coverPhoto.description
          }
        : undefined
    };

    if (this.type === 'event') {
      if (!this.startDate || !this.endDate) {
        throw new Error('Events require both start and end dates before saving.');
      }
      payload.startDate = this.startDate ?? undefined;
      payload.endDate = this.endDate ?? undefined;
      if (this.address && this.address.precise) {
        const components = this.address.components ?? {};
        const normalizedComponents = {
          line1: components.line1 ?? undefined,
          line2: components.line2 ?? undefined,
          city: components.city ?? undefined,
          state: components.state ?? undefined,
          postalCode: components.postalCode ?? undefined,
          country: components.country ?? undefined
        };
        const hasComponent = Object.values(normalizedComponents).some((value) => Boolean(value));
        payload.address = {
          precise: this.address.precise,
          components: hasComponent ? normalizedComponents : undefined
        };
      } else {
        payload.address = undefined;
      }
    } else if (this.type === 'discussion') {
      if (!this.expiresAt) {
        throw new Error('Discussions require an expiration date before saving.');
      }
      payload.expiresAt = this.expiresAt ?? undefined;
      payload.autoDelete = this.autoDelete ?? undefined;
      if (this.approximateAddress) {
        const approx = {
          city: this.approximateAddress.city ?? undefined,
          state: this.approximateAddress.state ?? undefined,
          country: this.approximateAddress.country ?? undefined,
          formatted: this.approximateAddress.formatted ?? undefined
        };
        const hasApprox = Object.values(approx).some((value) => Boolean(value));
        payload.approximateAddress = hasApprox ? approx : undefined;
      } else {
        payload.approximateAddress = undefined;
      }
    }

    return payload;
  }
}

export default DebugPin;
