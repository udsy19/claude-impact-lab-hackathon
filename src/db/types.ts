/** Row shapes shared by every storage backend. Mirrors 0001_init.sql. */

export type Vibe = "drink" | "snack" | "munch" | "meal";
export type DossierStatus = "fresh" | "stale" | "running" | "failed";

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  cuisine_tags: string[];
  vibe_tags: Vibe[];
  price_tier: number | null;
  osm_id?: string | null;
  website?: string | null;
}

export interface EvidenceRow {
  text: string;
  source: string;
  url?: string | null;
  date?: string | null;
  kind: "review" | "press" | "social" | "news" | "health";
}

/** Either a confident match or an explicit refusal to guess. */
export type Health =
  | { status: "no_confident_match" }
  | {
      status: "matched";
      grade: string | null;
      score: number | null;
      inspected_at: string | null;
      critical_violations: string[];
      match_confidence: number;
      source: string;
      url?: string | null;
    };

export interface DossierRow {
  id: string;
  restaurant_id: string;
  status: DossierStatus;
  verdict: string | null;
  badges: unknown[];
  vitals: unknown;
  patterns: unknown[];
  diner_view: unknown;
  key_reviews: unknown[];
  bright_spots: unknown[];
  social_pulse: unknown;
  health: Health | null;
  evidence: EvidenceRow[];
  sources: string[];
  evidence_count: number;
  generated_at: string | null;
  refresh_after: string | null;
  health_checked_at?: string | null;
  view_count?: number;
}

export interface ShareCard {
  id: string;
  dossier_id: string;
  slug: string;
  og_image: string | null;
  created_at: string;
}

export interface DecisionLog {
  id: string;
  device_id: string;
  constraints: unknown;
  shown: unknown;
  chosen: string | null;
  created_at: string;
}

/**
 * The whole persistence surface. Supabase and the local fallback both satisfy
 * this, so swapping backends is a one-line change in db/index.ts.
 */
export interface Store {
  readonly kind: "supabase" | "local";

  nearbyRestaurants(opts: {
    lat: number;
    lng: number;
    radiusMiles: number;
    vibes?: Vibe[];
    priceTiers?: number[];
    limit?: number;
  }): Promise<Restaurant[]>;

  upsertRestaurants(rows: Omit<Restaurant, "id">[]): Promise<Restaurant[]>;
  restaurantBySlug(slug: string): Promise<Restaurant | null>;
  restaurantById(id: string): Promise<Restaurant | null>;

  dossierFor(restaurantId: string): Promise<DossierRow | null>;
  dossiersFor(restaurantIds: string[]): Promise<Record<string, DossierRow>>;
  saveDossier(d: Partial<DossierRow> & { restaurant_id: string }): Promise<DossierRow>;
  bumpView(restaurantId: string): Promise<void>;

  createShareCard(dossierId: string, ogImage?: string | null): Promise<ShareCard>;
  shareCardBySlug(slug: string): Promise<(ShareCard & { dossier: DossierRow; restaurant: Restaurant }) | null>;

  logDecision(row: Omit<DecisionLog, "id" | "created_at">): Promise<string>;
  markChosen(logId: string, restaurantId: string): Promise<void>;

  claimOwner(restaurantId: string | null, email: string): Promise<void>;
}
