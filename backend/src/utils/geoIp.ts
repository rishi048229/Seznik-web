import { Request } from 'express';

let geoip: any = null;
try {
  geoip = require('geoip-lite');
} catch (e) {
  geoip = null;
}

export const INDIAN_STATE_MAP: Record<string, string> = {
  'MH': 'Maharashtra',
  'DL': 'Delhi NCR',
  'KA': 'Karnataka',
  'TN': 'Tamil Nadu',
  'WB': 'West Bengal',
  'UP': 'Uttar Pradesh',
  'GJ': 'Gujarat',
  'TG': 'Telangana',
  'AP': 'Andhra Pradesh',
  'MP': 'Madhya Pradesh',
  'RJ': 'Rajasthan',
  'PB': 'Punjab',
  'HR': 'Haryana',
  'BR': 'Bihar',
  'JH': 'Jharkhand',
  'OR': 'Odisha',
  'KL': 'Kerala',
  'AS': 'Assam',
  'UT': 'Uttarakhand',
  'HP': 'Himachal Pradesh',
  'GA': 'Goa',
  'CT': 'Chhattisgarh',
  'JK': 'Jammu & Kashmir',
  'CH': 'Chandigarh',
  'TR': 'Tripura',
  'ML': 'Meghalaya',
  'MN': 'Manipur',
  'NL': 'Nagaland',
  'MZ': 'Mizoram',
  'SK': 'Sikkim',
  'AR': 'Arunachal Pradesh',
  'PY': 'Puducherry',
};

export interface ResolvedGeoLocation {
  ip: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Extracts real public IP address from Express Request,
 * accounting for AWS ALB, Nginx, Cloudflare, and proxy headers.
 */
export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim().length > 0) {
    return realIp.trim();
  }

  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim().length > 0) {
    return cfIp.trim();
  }

  const rawIp = req.socket?.remoteAddress || req.ip || '127.0.0.1';
  if (rawIp.startsWith('::ffff:')) {
    return rawIp.replace('::ffff:', '');
  }
  return rawIp;
}

/**
 * Resolves live network device IP to physical City and State using embedded GeoIP database.
 */
export function resolveGeoFromIp(ip: string): ResolvedGeoLocation {
  // Handle local development loopback IPs
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.16.')) {
    return {
      ip,
      city: 'Local Network',
      state: 'Local Dev Node',
      country: 'India',
      countryCode: 'IN',
      latitude: 19.076,
      longitude: 72.8777,
    };
  }

  const lookup = geoip.lookup(ip);
  if (!lookup) {
    return {
      ip,
      city: 'Unknown City',
      state: 'National Network',
      country: 'India',
      countryCode: 'IN',
      latitude: null,
      longitude: null,
    };
  }

  const regionCode = (lookup.region || '').toUpperCase();
  const stateName = INDIAN_STATE_MAP[regionCode] || lookup.region || 'India Region';
  const cityName = lookup.city || 'Regional Center';

  return {
    ip,
    city: cityName,
    state: stateName,
    country: lookup.country === 'IN' ? 'India' : lookup.country,
    countryCode: lookup.country || 'IN',
    latitude: lookup.ll?.[0] ?? null,
    longitude: lookup.ll?.[1] ?? null,
  };
}

export function getGeoFromRequest(req: Request): ResolvedGeoLocation {
  const ip = extractClientIp(req);
  return resolveGeoFromIp(ip);
}
