import type { Comment, Dataset, Issue, IssueStatus, Profile } from "../domain/types";
import { createSeed } from "./seed";

/**
 * Fictional demonstration content for dev/design-lab only.
 * No backend calls, fake accounts, or real civic submissions are involved.
 */
export const DEMO_RESIDENT_ID = "local-designlab@civicwatch.invalid";
export const DEMO_RESIDENT_EMAIL = "designlab@civicwatch.invalid";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600000).toISOString();
type AdditionalReport = [
  cityId: "guwahati" | "shillong" | "jorhat" | "silchar",
  categoryId: string,
  title: string,
  description: string,
  address: string,
  lat: number,
  lng: number,
  status: IssueStatus,
  supportCount: number,
];

// Staggered updates, statuses and nearby locations help test every real UI state.
const additional: AdditionalReport[] = [
  ["guwahati", "pothole", "Another crater outside the bus stand", "The asphalt has given way beside the stopping lane. Buses block traffic while navigating around it.", "ABC Bus Stand, GS Road", 26.1675, 91.7504, "reported", 31],
  ["guwahati", "waterlogging", "Drainage is now a seasonal swimming pool", "Rainwater remains by the entrance even on sunny days. Pedestrians must walk in moving traffic.", "Lachit Nagar, Guwahati", 26.1655, 91.7581, "in_progress", 21],
  ["guwahati", "garbage", "Refuse behind the school compound", "Plastic waste and food wrappers are collecting beside the wall. The collection point needs attention.", "Zoo Road Tiniali, Guwahati", 26.1800, 91.7739, "reported", 19],
  ["guwahati", "streetlight", "Dark crossing near the park", "The streetlight has been out for several evenings, leaving the crossing poorly visible.", "Dighalipukhuri, Guwahati", 26.1892, 91.7528, "acknowledged", 13],
  ["guwahati", "blocked-drain", "The drain collects everything except water", "Silt is blocking the opening and runoff is crossing the walkway after each shower.", "RG Baruah Road, Guwahati", 26.1788, 91.7747, "reported", 35],
  ["guwahati", "footpath", "Broken tiles beside the crossing", "A raised tile was a tripping risk. The surface has since been levelled.", "Ganeshguri, Guwahati", 26.1540, 91.7861, "resolved", 18],
  ["guwahati", "traffic-signal", "Crosswalk signal stuck on red", "The pedestrian crossing indicator is unresponsive during peak evening traffic.", "Six Mile, Guwahati", 26.1481, 91.8062, "reported", 29],
  ["guwahati", "park", "Damaged bench near walking path", "One of the benches is missing wooden slats. The path remains accessible.", "Nehru Park, Guwahati", 26.1865, 91.7450, "in_progress", 12],
  ["shillong", "waterlogging", "Standing water outside the shops", "The curbside runoff cannot reach the drain, leaving a wet strip across the pavement.", "Police Bazar, Shillong", 25.5760, 91.8849, "reported", 26],
  ["shillong", "streetlight", "Footpath lighting needs repair", "A section of the walkway becomes poorly lit after dusk.", "Laitumkhrah, Shillong", 25.5766, 91.9036, "acknowledged", 18],
  ["shillong", "open-manhole", "Drain cover missing near the corner", "An uncovered opening beside the road presents a hazard to pedestrians.", "Mawlai, Shillong", 25.6001, 91.8897, "reported", 15],
  ["shillong", "garbage", "Market waste has been cleared", "The accumulation by the stalls was collected after repeated reminders.", "Bara Bazar, Shillong", 25.5844, 91.8754, "resolved", 23],
  ["jorhat", "damaged-road", "Loose road edge beside the market", "The damaged shoulder forces bicycles into the narrow traffic lane.", "Gar Ali, Jorhat", 26.7514, 94.1988, "reported", 27],
  ["jorhat", "water-leak", "Public pipe leaking by the gate", "There has been a steady leak onto the street for two days.", "AT Road, Jorhat", 26.7552, 94.2040, "in_progress", 17],
  ["silchar", "streetlight", "Junction lights still offline", "The north side of the crossing is dark and difficult to navigate at night.", "Tarapur, Silchar", 24.8398, 92.7844, "reported", 22],
  ["silchar", "pothole", "Uneven patch at the bridge approach", "Drivers are slowing suddenly to avoid the broken edge of the approach.", "Central Road, Silchar", 24.8247, 92.7905, "acknowledged", 14],
  ["silchar", "blocked-drain", "Roadside drain finally cleaned", "The debris was removed and water is flowing again after rainfall.", "Meherpur, Silchar", 24.8194, 92.7951, "resolved", 9],
  ["guwahati", "waterlogging", "Anil Nagar drain blocked again", "The channel was cleared last week but new plastic waste has collected at the same junction.", "Anil Nagar, Guwahati", 26.1661, 91.7692, "reported", 44],
];

export function createDesignLabSeed(): Dataset {
  const data = createSeed();
  // Make the default demo resident an active reporter so My Reports is useful.
  data.users.push({ id: DEMO_RESIDENT_ID, displayName: "Demo Resident", role: "resident" });
  for (const idx of [0, 4, 9]) data.issues[idx].authorId = DEMO_RESIDENT_ID;
  additional.forEach((r, index) => {
    const [cityId, categoryId, title, description, address, lat, lng, status, supportCount] = r;
    const issue: Issue = {
      id: "design-lab-issue-" + index, cityId, categoryId, title, description,
      address, location: {lat, lng}, status, 
      authorId: index % 3 === 0 ? DEMO_RESIDENT_ID : "seed-user-" + (index % 4),
      organizationId: null,
      confirmationUserIds: Array.from({length: supportCount}, (_, i) => "seed-supporter-" + i),
      attachments: [], createdAt: hoursAgo(index * 3 + 2),
      updatedAt: hoursAgo(index + 1),
    };
    data.issues.push(issue);
  });

  const replyTexts: Array<[string,string,string,string | null]> = [
    ["design-lab-issue-0", "seed-user-1", "The bus stop is especially difficult to approach after the rain. Drivers keep moving across lanes.", null],
    ["design-lab-issue-0", "seed-user-2", "The left side is worse. A temporary sign would help until the road is repaired.", "design-lab-comment-0"],
    ["design-lab-issue-1", "seed-user-0", "It was still flooded this morning. Someone has put a plank down to cross.", null],
    ["design-lab-issue-2", "seed-user-3", "The bins near the entrance are already full before midday.", null],
    ["design-lab-issue-3", "seed-user-1", "I use this crossing every evening. It needs proper lighting.", null],
    ["design-lab-issue-4", "seed-user-2", "The water spreads right across the footpath during heavy showers.", null],
    ["design-lab-issue-6", "seed-user-0", "The countdown display hasn't changed for three days.", null],
    ["design-lab-issue-8", "seed-user-3", "It is difficult to reach the shop entrances without getting wet.", null],
    ["design-lab-issue-9", "seed-user-2", "The dark section is close to the main walking route.", null],
    ["design-lab-issue-12", "seed-user-1", "Two-wheelers are swerving into the other lane at the bend.", null],
    ["design-lab-issue-13", "seed-user-0", "The leak is still visible at noon. Hopefully it gets repaired.", null],
    ["design-lab-issue-14", "seed-user-3", "People are using phone lights to cross here at night.", null],
    ["design-lab-issue-17", "seed-user-1", "The same section has been blocked twice this month.", null],
    ["seed-issue-0", DEMO_RESIDENT_ID, "I passed here again today. The pothole is still impossible to miss.", null],
    ["seed-issue-6", "seed-user-2", "The opening is hard to see after sunset. Please be careful.", null],
    ["seed-other-0", "seed-user-1", "The loose stones are still visible on the market-side lane.", null],
    ["seed-other-5", "seed-user-3", "Collection happened once, but the bins filled again.", null],
  ];
  const comments: Comment[] = replyTexts.map(([issueId, authorId, body, parentId], i) => ({
    id: "design-lab-comment-" + i,
    issueId, authorId, body, parentId,
    attachments: [], createdAt: hoursAgo(i / 2 + .2),
  }));
  data.comments.push(...comments);

  const profiles: Profile[] = [
    { userId: DEMO_RESIDENT_ID, displayName: "Demo Resident", avatarUrl: "", city: "Guwahati", bio: "A fictional CivicWatch resident for testing reports and typography.", website: "" },
    { userId: "seed-user-0", displayName: "Ananya Das", avatarUrl: "", city: "Guwahati", bio: "Walks everywhere, notices every broken pavement.", website: "" },
    { userId: "seed-user-1", displayName: "Rahul Bora", avatarUrl: "", city: "Shillong", bio: "Keeps track of what gets repaired and what gets forgotten.", website: "" },
  ];
  data.profiles = profiles;
  return data;
}
