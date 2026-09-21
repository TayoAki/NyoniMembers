/** Facts about the house that several screens quote. Verified against nyonicouture.com, September 2026. */
export const HOUSE = {
  name: "Nyoni Couture",
  website: "https://nyonicouture.com",
  membershipUrl: "https://nyonicouture.com/membership/",
  concierge: {
    email: "info@nyonicouture.com",
    sms: "+19802372331",
    smsDisplay: "(980) 237-2331",
  },
  hours: "Mon–Sat 11am–7pm · Sun 12pm–6pm",
} as const;

export const SHOWROOMS = [
  { id: "charlotte", city: "Charlotte", address: "325 N Graham St, Charlotte, NC 28202" },
  { id: "atlanta", city: "Atlanta", address: "2955 Peachtree Rd, Atlanta, GA 30305" },
  { id: "houston", city: "Houston", address: "2301 Yorktown St Suite 105, Houston, TX 77056" },
] as const;
export type ShowroomId = (typeof SHOWROOMS)[number]["id"];
