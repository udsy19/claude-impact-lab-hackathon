/**
 * Synthetic but realistic review dump for a fictional Palo Alto restaurant,
 * formatted the way a real copy-paste out of Google Maps / Yelp looks —
 * reviewer names, star glyphs, relative dates, Useful/Funny/Cool junk,
 * owner responses, inconsistent spacing.
 *
 * ---------------------------------------------------------------------------
 * TEST ORACLE — the planted patterns the analysis must find
 * ---------------------------------------------------------------------------
 * 46 reviews, 2025-03-08 → 2026-08-04, spanning 7 quarterly buckets:
 *   2025-Q1 3 · 2025-Q2 5 · 2025-Q3 5 · 2025-Q4 7
 *   2026-Q1 7 · 2026-Q2 11 · 2026-Q3 8
 *
 * 1. FRIDAY DINNER SERVICE COLLAPSE — trend "new".
 *    6 reviews, ALL dated 2026-05-08 or later (Okafor, Ashworth, Brooks,
 *    McCarthy, Johnson, Adeyemi; Moreau and Kaplan corroborate). They name
 *    Friday explicitly, describe 25–90 minute waits, and several diagnose
 *    understaffing ("two servers for the whole floor").
 *    CONTRAST: Derek Lam (2026-02-18) describes a PACKED FRIDAY that ran
 *    smoothly — the collapse is genuinely new, not always-was. Grace Liu,
 *    Lucas Reyes, Robert Chen and Isabella Ferraro report fine WEEKDAY
 *    service inside the same recent window, so the problem is Friday-specific.
 *
 * 2. CARNITAS TACOS DRY / LUKEWARM / GREASY — trend "stable".
 *    ~16 mentions spread evenly from 2025-03 through 2026-08. A long-running
 *    problem, deliberately NOT correlated with any date.
 *
 * 3. MARISOL PRAISED BY NAME — bright spot.
 *    8 reviews across the whole range (Daniel R., Sam T., Marcus Lin,
 *    Sofia Marchetti, Aisha Rahman, Steph Nguyen, Grace Liu, Jason Whitmore)
 *    for pacing, product knowledge, and remembering regulars.
 *
 * 4. PRICE COMPLAINTS — trend "worsening", clustered recently.
 *    8 reviews, all 2026-04-02 or later, naming figures: $22 for three tacos,
 *    $26 / "Twenty-six dollars" enchilada plate, $24 carnitas plate, $88 and
 *    $94 checks, "20% in a year", and explicit portion shrinkage.
 *
 * 5. RATING DIP TIED TO A DATED EVENT — the most important property here.
 *    Chef Danny Reyes started in APRIL 2026 (that fact comes from the PULSE /
 *    PRESS agents, NOT from the reviews). The reviews only show the symptom:
 *    THREE reviews say the kitchen changed without naming a chef —
 *      Yuki Tanaka   2026-04-23  "something changed in the kitchen"
 *      Gabriela Ontiveros 2026-04-29  "The kitchen feels different"
 *      Meredith Kaplan 2026-07-18  "The kitchen feels different than it did last year"
 *
 *    INTENDED STAR AVERAGES (verify against any parser):
 *      before 2026-04-01 : 27 reviews, star sum 119  → avg 4.41
 *      on/after 2026-04-01: 19 reviews, star sum  59 → avg 3.11
 *      dip = 1.30 stars, aligned to the April 2026 chef change.
 *
 * Every review carries an explicit rating (glyphs, "4/5", "4.0 star rating",
 * "3 stars") so the rating-over-time chart always has data.
 *
 * This doubles as the cached demo fallback if a live paste misbehaves on stage.
 */

export const SAMPLE_RESTAURANT_NAME = "Casa Verde";

export const SAMPLE_CITY = "Palo Alto";

export const SAMPLE_REVIEWS = `
Daniel R.
Local Guide · 88 reviews · 210 photos
★★★★★  Mar 8, 2025
Been coming here since they opened. The al pastor is the best on University Ave, full stop. Marisol remembered our anniversary from last year and brought out a flan with a candle in it. That's not something you can train.
Useful 12   Funny 0   Cool 4

Priya N.
★★★★☆
3/19/2025
Solid neighborhood spot. Salsa flight is genuinely great. Carnitas tacos were a little dry but the al pastor made up for it.
Useful 3   Funny 0   Cool 0

Kevin Oh
5.0 star rating  3/28/2025
Came in on a Tuesday around 7. Seated instantly, food out in maybe twelve minutes. Margaritas are strong and not too sweet. Will be back.

Response from the owner
Thanks Kevin! Tuesdays are our favorite too. — Casa Verde

M. Alvarez
★★★☆☆ · April 9, 2025
The carnitas tacos came out lukewarm and honestly kind of greasy. Everything else was fine. My wife's enchiladas were excellent.
Useful 6   Funny 1   Cool 0

Sam T.
5/5 — Apr 22 2025
Marisol took care of us and she is a total pro. Knew every single item, steered us away from something I would have ordered and been disappointed by. Great instinct.

Jenna W.
★★★★★  May 6, 2025
Birthday dinner for 8 and they handled it beautifully. Everything came out at once and hot. Room is loud but in a good way.
Useful 2

anonymous
4 stars · May 24, 2025
Good food, tight space. Bathroom line is always long. The elote is worth the trip on its own.

Tom Bradshaw
★★☆☆☆
June 11, 2025
Ordered the carnitas tacos on a recommendation and they were dry as sawdust. Tasted like they'd been sitting in a warmer. For $19 I expected better. The chips and salsa were great though.
Useful 14   Funny 2   Cool 1

Rachel Kim · Local Guide
★★★★★  7/2/2025
My go-to for a weeknight dinner. Never had a bad meal. Staff genuinely seem to like working here which you can feel.

D. Osei
3.0 star rating   July 19, 2025
Food was good, service was slow-ish, but it was the Saturday before the Fourth so I'll give them that.

Marcus Lin
★★★★★  Aug 5, 2025
Marisol again. Third time she's served us and every time she nails the pacing — apps land, plates cleared, drinks refilled without being asked. Whoever trained her, keep them.
Useful 8

Hannah B.
★★★★☆ · 8/23/2025
Really good. The mole is a sleeper hit, order it. Skip the carnitas tacos, they were dry both times I've tried them.

Ellie Vasquez
5 stars — Sep 14, 2025
Family dinner with the in-laws and it was flawless. Out in an hour, everyone happy.

Ben
★★★☆☆  October 6, 2025
Fine. Not amazing. Carnitas were tough. Room was freezing near the door.
Useful 4   Funny 0   Cool 0

Sofia Marchetti
★★★★★
Oct 15, 2025
This is a real restaurant, not a Cal Ave tourist trap. The kitchen knows what it's doing. Marisol runs the floor like a conductor.
Useful 9   Cool 3

J. Patel
4/5 · 10/24/2025
Great tacos (get the al pastor, not the carnitas). Fast on a Wednesday. Good value for University Ave.

Nora Whitfield
★★★★★  Nov 2, 2025
Lovely dinner. The margarita program is underrated. Only note is the carnitas came out cold in the middle, which the server fixed immediately no argument.
Useful 5

Chris D.
★★★★★  11/21/2025
Best value on the street. Two of us ate very well for under sixty bucks.

Aisha Rahman
★★★★★ · December 4, 2025
Marisol is the reason we keep coming back. She remembers our kid's name. Food is great but the service is what makes it.
Useful 11   Funny 0   Cool 2

Bianca Ruiz
5 stars   Dec 20, 2025
Holiday party of fourteen and the kitchen crushed it. Every plate landed hot and within five minutes of each other.
Useful 6

Greg Sandoval
3 stars   Jan 7, 2026
Carnitas tacos again disappointed — dry and a bit stringy. I keep hoping. Everything else on the menu is strong.

Lauren Choi
★★★★★  1/16/2026
Took a client here and it went great. Quiet enough to talk at 6pm. Kitchen is quick.

Aaron Feld
★★★★☆
January 29, 2026
Very good. Chips are made in house and you can tell. Service was attentive.
Useful 1

Monica P.
★★★★★ · Feb 6, 2026
We do takeout here almost weekly. Never wrong, never cold, always ready when they say.

Derek Lam
5/5 · February 18, 2026
Friday night and the room was completely full, but we were seated on time and had drinks in five minutes. Whatever their system is, it works. Al pastor and the margarita flight, no notes.
Useful 7   Funny 0   Cool 1

Alina Kowalski
★★★★★  March 3, 2026
The mole is the best thing on the menu and nobody talks about it. Carnitas tacos were dry again, which is the one consistent miss, but everything else was perfect.
Useful 4

Peter Molina
★★★★★  Mar 19, 2026
Weeknight regular. Always fast, always good.

Ravi Subramanian
★★★☆☆  April 2, 2026
Prices have crept up. $22 for three carnitas tacos that were, once again, dry. The al pastor is still worth it but I noticed the plate looked smaller than I remember.
Useful 17   Funny 1   Cool 0

Steph Nguyen
★★★★★  4/8/2026
Marisol! Best server in Palo Alto. She had our drinks on the table before we sat down.

Colin Ward
★★★☆☆
April 16, 2026
Food's still good but it's gotten expensive for what it is. The enchilada plate went from two to what feels like one and a half. Twenty-six dollars is a lot for that.
Useful 9   Funny 0   Cool 1

Yuki Tanaka
3.0 star rating · 4/23/2026
Nice dinner but something changed in the kitchen. The mole was thinner than I remember and the rice was underseasoned. A little pricey now too. Carnitas were dry, ordered the al pastor for my second taco and it was much better.
Useful 12

Gabriela Ontiveros
★★☆☆☆
April 29, 2026
We've eaten here maybe forty times in three years and this was the first genuinely bad meal. The kitchen feels different — the seasoning is off, the carnitas were dry and the al pastor came out overcooked. I don't know what happened but something did.
Useful 26   Funny 0   Cool 3

Hannah Okafor
★★☆☆☆
May 8, 2026
Came in on a Friday at 7:30 and waited 25 minutes just to have someone take our drink order. Food took nearly an hour. The room was packed and clearly understaffed — I counted two servers for the whole floor. Food was good when it finally came but I've never seen it like this here.
Useful 22   Funny 0   Cool 3

Devin Ashworth
★★★☆☆  5/15/2026
Friday night is rough now. Long wait, harried staff, apps and mains arrived at the same time. We've been coming for two years and this is new.
Useful 15

Grace Liu
★★★★★  May 21, 2026
Went on a Tuesday and it was the Casa Verde I know — relaxed, quick, delicious. Marisol was working and everything ran like clockwork.
Useful 7   Cool 2

Nathan Brooks
★★☆☆☆
May 29, 2026
Second Friday in a row where service completely fell apart. Waited 40 minutes for food, then two of the four plates came out cold. The carnitas tacos were dry, which at this point I think is just how they make them. And it was $88 for two people with one round of drinks.
Useful 28   Funny 2   Cool 1

Response from the owner
We're sorry Nathan, we're working on it.

Isabella Ferraro
★★★★☆  6/4/2026
Went early on a Thursday to avoid the crowds and it was great. I'd avoid Friday based on what friends have told me.
Useful 6

Owen McCarthy
★★☆☆☆
June 12, 2026
Friday dinner, 8pm. Nobody greeted us for ten minutes at the host stand. Once seated it was another twenty before a server appeared. This place used to be tight. Food still good, service is not.
Useful 19   Funny 1   Cool 0

Trevor Boyle
3 stars
7/2/2026
Prices are getting hard to justify. $24 for the carnitas plate and it was dry again. I'll still come for the al pastor but I'm coming less.
Useful 13   Funny 0   Cool 2

Amara Johnson
★★☆☆☆  July 5, 2026
Friday night again. Ninety minutes from door to entree. The two servers on the floor were sprinting and apologizing constantly — this is a staffing problem, not a them problem. Felt bad for them honestly.
Useful 31   Funny 0   Cool 5

Jason Whitmore
3 stars · a month ago
Marisol is still fantastic. Came on a Wednesday and it was smooth. Carnitas tacos remain the one miss on an otherwise excellent menu — dry, every single time. Docking a star because two apps and two entrees came to ninety-four dollars.
Useful 8

Lucas Reyes
★★★★★  7/11/2026
Weekday lunch is still the best deal on University. In and out in 35 minutes.

Meredith Kaplan
★★★☆☆
July 18, 2026
Good food, painful Friday service, and prices that have quietly gone up maybe 20% in a year. The kitchen feels different than it did last year too. Two of those three I can live with.
Useful 16   Funny 1   Cool 1

Robert Chen
★★★★☆  2 weeks ago
Tuesday night, no issues at all, food was hot and fast. Whatever is happening on Fridays isn't happening the rest of the week.
Useful 11

Cynthia Adeyemi
★★☆☆☆
July 31, 2026
Friday, 7pm, forty-five minute wait for a table we'd reserved. Then slow service on top of that. I love this place and I'm frustrated writing this.
Useful 24   Funny 0   Cool 2

Tessa Moreau
★★★☆☆  Aug 4, 2026
The al pastor is still one of my favorite things in Palo Alto. But $26 for the plate, and the carnitas tacos my partner ordered were dry and lukewarm. Went on a Friday and waited a long time. Mixed feelings.
Useful 9   Funny 0   Cool 1
`.trim();
