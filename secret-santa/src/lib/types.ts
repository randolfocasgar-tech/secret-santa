export type ExchangeStatus = "open" | "drawn";

export type Exchange = {
  id: string;
  organizer_id: string;
  name: string;
  gift_date: string;
  budget: number;
  currency: string;
  rules: string;
  invite_code: string;
  status: ExchangeStatus;
  draw_version: number;
  drawn_at: string | null;
  is_demo: boolean;
  created_at: string;
};

export type Participant = {
  id: string;
  exchange_id: string;
  user_id: string | null;
  display_name: string;
  is_demo: boolean;
  joined_at: string;
};

export type Preferences = {
  wishlist: string;
  likes: string;
  avoid: string;
};

export type Exclusion = {
  id: string;
  exchange_id: string;
  giver_id: string;
  receiver_id: string;
  bidirectional: boolean;
};

export type Profile = Preferences & {
  id: string;
  display_name: string;
};

export type MyExchangeRow = {
  id: string;
  name: string;
  gift_date: string;
  budget: number;
  currency: string;
  status: ExchangeStatus;
  is_demo: boolean;
  is_organizer: boolean;
  is_participant: boolean;
  participant_count: number;
  created_at: string;
};

export type InvitePreview = {
  exchange_id: string;
  name: string;
  gift_date: string;
  budget: number;
  currency: string;
  rules: string;
  organizer_name: string;
  participant_count: number;
  status: ExchangeStatus;
  is_member: boolean;
  is_participant: boolean;
};

export type MyAssignment = Preferences & {
  receiver_name: string;
  draw_version: number;
  revealed_at: string | null;
};
