export type ActorCredit = {
  id: number;
  kind: "movie" | "series";
  title: string;
  posterUrl: string | null;
  releaseDate: string | null;
  year: string | null;
  roles: string[];
  popularity: number;
  rating: number | null;
};
export type ActorDetails = {
  id: number;
  name: string;
  originalName: string | null;
  biography: string;
  biographyLanguage: "ru" | "en" | null;
  profileUrl: string | null;
  birthday: string | null;
  deathday: string | null;
  birthplace: string | null;
  credits: ActorCredit[];
};
export const actorCreditKey = (credit: Pick<ActorCredit, "id" | "kind">) =>
  `${credit.kind}:${credit.id}`;
