/**
 * Offline demo data — captured from a REAL pre-index run against the live
 * database, not invented. `?demo=1` seeds these into the local store and stubs
 * the ranking call, so the whole decision flow works with the network off.
 *
 * Regenerate by re-running the query in scripts/ against a populated database.
 */
import type { DossierRow, Restaurant } from "../db/types";

export interface DemoEntry {
  restaurant: Omit<Restaurant, "id">;
  dossier: Partial<DossierRow>;
}

export const DEMO_PLACE = {
  lat: 37.7599,
  lng: -122.4148,
  neighborhood: "The Mission",
  city: "San Francisco",
  label: "The Mission, SF",
};

export const DEMO_ENTRIES: DemoEntry[] = [
  {
    "restaurant": {
      "name": "Acquerello",
      "slug": "acquerello-sf",
      "city": "San Francisco",
      "neighborhood": "Nob Hill",
      "lat": 37.7899,
      "lng": -122.4222,
      "cuisine_tags": [
        "italian"
      ],
      "vibe_tags": [
        "meal"
      ],
      "price_tier": 4
    },
    "dossier": {
      "verdict": "Legendary SF Italian institution with exceptional service and signature pasta but inconsistent desserts and pacing.",
      "badges": [
        {
          "year": null,
          "label": "Two Michelin Stars",
          "domain": "Michelin Guide"
        },
        {
          "year": null,
          "label": "Wine Spectator Award of Excellence",
          "domain": "Wine Spectator"
        }
      ],
      "vitals": {
        "busiest": null,
        "price_tier": "$275/person tasting menu; 4-course a la carte $120",
        "best_time_to_try": "Early seating; one reviewer noted only four other tables sat during their visit",
        "reservation_route": "Tock (pre-pay required)",
        "booking_difficulty": "Reservations available but requires pre-payment via Tock with $100 non-refundable deposit per person"
      },
      "patterns": [
        {
          "title": "Ridged pasta with faux foie gras is universally praised",
          "trend": "stable",
          "sources": [
            "diner reviews"
          ],
          "excerpts": [
            "Ridged pasta with faux 'foie gras' 5/5 - The signature dish and I can see why. Flavor was incredibly intense, like a concentrated umami and caramel flavor bomb.",
            "I would say my absolute fave dish was the ridged pasta with faux foie gras, truffle, and Marsala. This dish is extremely rich however so I would recommend sharing it if you can, but the flavors were so deep and absolutely delicious.",
            "Their pasta with faux foie gras and truffle dish was delicious and stood out.",
            "Seasonal tasting menu was good... Ridged pasta with faux foie gras was amazing."
          ],
          "frequency": "Mentioned positively in 10+ reviews"
        },
        {
          "title": "Service consistently attentive and warm across visits",
          "trend": "stable",
          "sources": [
            "diner reviews"
          ],
          "excerpts": [
            "the kind of attentive service that feels effortless -- always there at just the right moment.",
            "Service was quite attentive as you would expect from a restaurant of this caliber.",
            "Jason, one of our servers, made our night even more enjoyable with his attentiveness and genuine hospitality.",
            "I really appreciated the prompt and lovely service by Vidal and our nice hostess Liz who was attentive and helpful!"
          ],
          "frequency": "Mentioned positively in 10+ reviews"
        },
        {
          "title": "Desserts underwhelm relative to savory courses",
          "trend": "worsening",
          "sources": [
            "diner reviews"
          ],
          "excerpts": [
            "Unfortunately, desserts didn't bring the anticipated home run-- the rhubarb and ginger sorbet was not tangy enough with a way-too-sweet base foam.",
            "I would highly recommend that they upgame their desserts since that's usually what their guests would remember at the end of the day finishing their last bite.",
            "We really loved the first course and dessert, not a huge fan of the main."
          ],
          "frequency": "Mentioned in 3+ reviews"
        },
        {
          "title": "Course pacing inconsistent — rushed then slow",
          "trend": "stable",
          "sources": [
            "diner reviews"
          ],
          "excerpts": [
            "we felt SUPER rushed on the first few courses we got. Like I barely finished my last bite and they were clearing the plate and dumping the next course on the table. What's the rush guys? Then the last few courses were slow. Like really slow.. 15 minutes + between courses.",
            "The service and wine pairing were amazing. Best part of the meal."
          ],
          "frequency": "Mentioned in 2+ reviews"
        },
        {
          "title": "No cocktails — wine only for alcohol",
          "trend": "stable",
          "sources": [
            "diner reviews"
          ],
          "excerpts": [
            "they have NO cocktails. Would have been a better experience to unwind into the experience.",
            "Warning: the alcohol option is most likely wine. I did not see any cocktails available.",
            "The wine list is substantial, with almost two thousand labels in all."
          ],
          "frequency": "Mentioned in 3+ reviews"
        },
        {
          "title": "Cheese course and Italian wine pairings are standout supplements",
          "trend": "stable",
          "sources": [
            "diner reviews"
          ],
          "excerpts": [
            "Hesitant to order their 'unusual' selection of Italian cheeses since I usually prefer mild cheeses, but glad we did. Their cheeses and condiments were amazing.",
            "The Italian wine pairings were equally impressive: each glass distinctive, every match flawless, leaving us with a whole new appreciation for Italy's wines.",
            "We also ordered the spread of unusual Italian cheeses to share and got to try some new cheeses that we rea",
            "the cheese course that Michelin calls a visual masterpiece was added."
          ],
          "frequency": "Mentioned in 4+ reviews"
        }
      ],
      "diner_view": {
        "go_when": "Anniversary, birthday, or special occasion dinner when you want unhurried elegance and world-class Italian cuisine",
        "skip_this": [
          "Bluefin tuna (noted as a miss by multiple diners)",
          "Ribeye (noted as tough and disconnected)",
          "Rhubarb and ginger sorbet (too sweet per reviewers)"
        ],
        "getting_in": "Book via Tock; $100 non-refundable deposit per person required. Dress code enforced. Snag reservations in advance — group size limit appears to be around 6 guests comfortably.",
        "order_this": [
          "Ridged pasta with faux foie gras, truffle, and Marsala",
          "Dry-aged Liberty duck",
          "Black cod",
          "Quail",
          "Italian cheese course with condiments",
          "Supplemental tajarin pasta with white truffles (if in season)",
          "Chef's surprise amuse bouche bites",
          "Dessert cart at the end of the meal"
        ],
        "know_before": [
          "No cocktails — wine only; bring wine lovers or be prepared",
          "The ridged pasta with faux foie gras does not always come included in the wine pairing — a separate $14 pour was charged in one case",
          "Portions are small by design; 9-course tasting menu guests report feeling full but it's a long meal",
          "Cheese course and caviar course are optional add-ons and can be shared — you do not have to order per person",
          "The building was once a small chapel with vaulted ceilings — the atmosphere is calm and timeless",
          "Wine list has nearly 2,000 labels, mostly Italian; sommelier is noted as knowledgeable and helpful with budget"
        ],
        "should_you_go": "Yes, if you want a classic, refined Italian fine-dining experience in SF with exceptional service and a world-class wine program — but calibrate expectations on desserts and know there are no cocktails."
      },
      "key_reviews": [
        {
          "date": null,
          "quote": "I didn't know that an experience this good could be achieved at this price. The dining experience here was excellent at many levels - the service, the decor, and most importantly, the food.",
          "stars": null,
          "source": "diner review",
          "why_chosen": "most_representative"
        },
        {
          "date": null,
          "quote": "we felt SUPER rushed on the first few courses we got. Like I barely finished my last bite and they were clearing the plate and dumping the next course on the table. What's the rush guys? Then the last few courses were slow. Like really slow.. 15 minutes + between courses. Kitchen needs to work on their timing. Oh, and the rib eye meat was tough.",
          "stars": null,
          "source": "diner review",
          "why_chosen": "most_alarming"
        },
        {
          "date": null,
          "quote": "All the food was outstanding and it felt so nice to have such a good Italian meal. Some of our favorites were the scallop, oxtail raviolini (which we preferred to the house special ridged pasta with faux 'foie gras'), and the quail.",
          "stars": null,
          "source": "diner review",
          "why_chosen": "most_promising"
        }
      ],
      "bright_spots": [
        {
          "finding": "Chef's surprise amuse bouche bites consistently delight guests",
          "excerpts": [
            "We started with chef's surprises which were incredibly tasty that I almost got up and danced.",
            "I really like their chef's small surprises bites at the beginning of the meal which included some fresh Dungeness crab cake and a savory Comte financier.",
            "Starting trio of appetizers 5/5 - all light and surprising. Didn't mind the gold leaf, but obviously not necessary. The potato tube with creme and caviar was light, crispy, savory - easily my fav."
          ]
        },
        {
          "finding": "Sommeliers are exceptional — knowledgeable, intuitive, and budget-conscious",
          "excerpts": [
            "the sommelier recommended two beautiful bottles that paired perfectly with the meal. She was knowledgeable, kind, and intuitive an absolute standout.",
            "The young sommelier was excellent, friendly and knowledgable.",
            "The sommelier gave us some wine options that were within our budget. It was a lovely Italian white wine bottle for less than $200."
          ]
        },
        {
          "finding": "Atmosphere in the converted chapel is uniquely serene and elegant",
          "excerpts": [
            "From the moment we stepped into what was once a small chapel, the space felt calm and timeless -- vaulted ceilings, soft light, and the kind of attentive service that feels effortless.",
            "The building's unique architectural features, such as the beautiful wooden arches etched in gold, remain a testament to Morgan's timeless design and add an element of historic grandeur to the dining experience.",
            "It's a sophisticated atmosphere that serves Northern Italian cuisine with white glove service and top shelf quality."
          ]
        },
        {
          "finding": "Thoughtful small details elevate the overall experience",
          "excerpts": [
            "From a lady's handbag stool, to dark linens, to the spacing of courses, to even having a screen INSIDE the washroom to shelter the door from the toilet....it feels like every detail that one can think of (and not think of) has been carefully addressed by the restaurant.",
            "there was even a nice cushioned stool for my purse. Nice touch, so I can access my stuff easily.",
            "The service is immediate right when you enter the door with them taking your coat and taking the time to give you a dark napkin that matches our outfits."
          ]
        }
      ],
      "health": {
        "url": "https://data.sfgov.org/Health-and-Social-Services/Restaurant-Scores-LIVES-Standard/pyih-qa8i",
        "grade": null,
        "score": 100,
        "source": "DataSF · Restaurant Scores (LIVES)",
        "status": "matched",
        "inspected_at": "2018-11-07",
        "match_confidence": 0.88,
        "critical_violations": []
      },
      "sources": [
        "yelp.com",
        "hungryonion.org",
        "kqed.org",
        "andyhayler.com",
        "adventurespassport.com",
        "youtube.com",
        "exploretock.com",
        "wbpstars.com",
        "acquerellosf.com",
        "sf.eater.com",
        "la.eater.com",
        "m.yelp.com"
      ],
      "evidence_count": 40,
      "evidence": [
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Don't typically like foie gras, which is why I didn't order their signature ridged pasta. I tried some of my husband's though, and it ended up being our favorite pasta dish. Kids loved their rabbit mortadella-filled cappelletti too.",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Hesitant to order their \"unusual\" selection of Italian cheeses since I usually prefer mild cheeses, but glad we did. Their cheeses and condiments were amazing.",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "From the moment we stepped into what was once a small chapel, the space felt calm and timeless -- vaulted ceilings, soft light, and the kind of attentive service that feels effortless -- always there at just the right moment.",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "We chose the full tasting menu, and was glad the cheese course that Michelin calls a visual masterpiece was added. The line up of the dishes were my all time favorites. Every single dish was a highlight on it's own.",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "The Italian wine pairings were equally impressive: each glass distinctive, every match flawless, leaving us with a whole new appreciation for Italy's wines.",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "I didn't know that an experience this good could be achieved at this price. The dining experience here was excellent at many levels - the service, the decor, and most importantly, the food. The default menu here is the 4",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Starting trio of appetizers 5/5 - all light and surprising. Didn't mind the gold leaf, but obviously not necessary. The potato tube with creme and caviar was light, crispy, savory - easily my fav. The foie gras cone was also",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Ridged pasta with faux \"foie gras\" 5/5 - The signature dish and I can see why. Flavor was incredibly intense, like a concentrated umami and caramel flavor bomb. Paired well with the truffle",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Bluefin tuna 3/5 - This one was a miss for me. Tuna, while tender, was a bit fishy. The escarole and the potato on the side were excellent tho",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Dry-aged Liberty duck 5/5 - Duck meat was cooked perfectly. Looked like art with a even golden crust. Crispy outside and steak tender on the inside. Duck sausage on the side was interesting, but I prefer regular sausage lol",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Vanilla crème fraîche panna cotta 4/5 - Another work of art. Looks like an egg on a nest. They cut the egg tableside, revealing the apricot \"yolk\". Tastes like chocolate on more chocolate",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "I enjoyed my first visit at Acquerello! The restaurant carries a particular warmth and leads a vintage ambiance. I liked the fresh florals at many corners and the dimmed lights make for a romantic atmosphere.",
          "source": "yelp.com"
        }
      ]
    }
  },
  {
    "restaurant": {
      "name": "Benu",
      "slug": "benu-sf",
      "city": "San Francisco",
      "neighborhood": "SoMa",
      "lat": 37.7855,
      "lng": -122.3993,
      "cuisine_tags": [
        "tasting menu"
      ],
      "vibe_tags": [
        "meal"
      ],
      "price_tier": 4
    },
    "dossier": {
      "verdict": "Benu delivers exceptional three-Michelin-star Korean-French tasting menus with occasional service inconsistencies.",
      "badges": [
        {
          "year": 2014,
          "label": "3 Michelin Stars",
          "domain": "Michelin Guide California 2026"
        },
        {
          "year": 2014,
          "label": "Third Michelin Star Awarded",
          "domain": "Michelin Guide"
        }
      ],
      "vitals": {
        "busiest": null,
        "price_tier": "$310 per person tasting menu, optional beverage pairing $250",
        "best_time_to_try": "Regular service nights; avoid Valentine's Day expectations as they serve standard menu",
        "reservation_route": null,
        "booking_difficulty": "High — reviewer traveled to San Francisco specifically after landing the reservation"
      },
      "patterns": [
        {
          "title": "Elegant but muted flavors across multiple courses",
          "trend": "stable",
          "sources": [
            "multiple tasting menu course reviews"
          ],
          "excerpts": [
            "the flavors were a bit muted but otherwise elegant",
            "I would have preferred a bit more oomph",
            "the chicken broth was quite good, but light in flavor",
            "I wished that this dish had had stronger flavors",
            "again, very elegant, but missing a bit of oomph"
          ],
          "frequency": "Mentioned across 5+ individual dishes"
        },
        {
          "title": "Service generally outstanding with isolated lapses",
          "trend": "stable",
          "sources": [
            "diner review 1",
            "diner review 2",
            "diner review 3"
          ],
          "excerpts": [
            "a rushed plate clearing from a busperson that spilled sauce all over the table without concern not apology",
            "we were asked the same questions by several servers: where we were from, what were our plans for upcoming dinners",
            "The staff's fluster and confusion was felt",
            "Overall, the service was outstanding - present, friendly and incredibly helpful"
          ],
          "frequency": "Multiple reviewers, 3+ incidents noted"
        },
        {
          "title": "Korean-French fusion tasting menu with premium ingredients",
          "trend": "stable",
          "sources": [
            "multiple reviewers"
          ],
          "excerpts": [
            "a fine-dining take on Asian food, with a focus on Korean influences",
            "Chef Corey Lee's food is marked by high-end French-American technique and informed by his Korean-American heritage",
            "merging western techniques with eastern ingredients in the most fascinating and delectable way",
            "a Korean take on blini with caviar. A hot buckwheat pancake incorporating pieces of kimchi came topped with cream and caviar"
          ],
          "frequency": "Consistent across all reviewer visits"
        },
        {
          "title": "Signature XLB soup dumplings evolved due to California law",
          "trend": "stable",
          "sources": [
            "diner review A",
            "video review"
          ],
          "excerpts": [
            "They used to be filled with foie gras, but that ingredient has since become illegal in California",
            "the little dumplings contained a 'supreme soup' made from whole chickens, dried scallops and two kinds of ham",
            "soup made from whole chickens, dried scallops, and two kinds of ham. One from Spain and one from the US. I heard that at one time, the filling"
          ],
          "frequency": "Referenced by 2+ reviewers"
        },
        {
          "title": "Fair pricing and no holiday price gouging",
          "trend": "stable",
          "sources": [
            "Valentine's Day 2018 diner review"
          ],
          "excerpts": [
            "Most restaurants take this day as an opportunity to fleece their guests by increasing their prices while simultaneously decreasing the duration of the meal",
            "Benu didn't do any of that: they served us the regular menu (!) at the regular speed (!!) for the regular price (!!!)",
            "Benu's fair treatment of their guests remains a standout for me"
          ],
          "frequency": "Explicitly noted for Valentine's Day 2018"
        }
      ],
      "diner_view": {
        "go_when": "A regular service night for the full, unhurried tasting experience; Valentine's Day historically offered the standard menu at standard price",
        "skip_this": [
          "Sourdough bread with Sonoma butter and ginseng honey — 'ok, not great'",
          "Beverage pairing if budget-conscious — 'worth the price? Debatable'",
          "BBQed quail if subtle flavors matter — XO sauce 'overpowering' for the bird"
        ],
        "getting_in": "Reservations are difficult to land; one reviewer traveled to San Francisco solely because they secured one. Book well in advance.",
        "order_this": [
          "Soup dumplings (XLB) with supreme soup of whole chickens, dried scallops, and two kinds of ham",
          "White sturgeon caviar with winter melon porridge and smoked onion",
          "Unlaid hen egg with jammy bacon dressing and onion blossoms",
          "Korean buckwheat pancake with kimchi and caviar",
          "1,000-year-old quail egg with cabbage juice and potato potage",
          "Vegetarian dishes — 'often eclipsed their meat-friendly counterparts'"
        ],
        "know_before": [
          "Benu serves only a single tasting menu at $310 per person; optional beverage pairing is $250",
          "Set aside three hours for dinner",
          "The menu is adjusted for returning guests so repeat visits offer different dishes",
          "The dining room has no direct windows and is located away from the street — unusual layout",
          "Vegetarian accommodations are possible but confirm thoroughly in advance — one reviewer experienced a communication breakdown",
          "No wine pairing was offered at one visit; at another, pairing included wines, beer, sake, and a cocktail"
        ],
        "should_you_go": "Yes, if you seek a refined, creative Korean-French tasting experience worth a special journey — expect elegance over boldness."
      },
      "key_reviews": [
        {
          "date": null,
          "quote": "Benu is everything you want a 3-star meal to be. As Michelin describes, it is definitely 'worth a special journey'. I traveled to San Francisco simply because I landed this reservation, and I'm so very glad I did. This meal was completely worth it.",
          "stars": null,
          "source": "diner review",
          "why_chosen": "most_representative"
        },
        {
          "date": null,
          "quote": "a rushed plate clearing from a busperson that spilled sauce all over the table without concern not apology. He then grabbed at my dish though I was not yet finished.",
          "stars": null,
          "source": "diner review",
          "why_chosen": "most_alarming"
        },
        {
          "date": null,
          "quote": "Every single small delicacy was outstanding in flavor and execution and differing in taste and texture; each bite was unique and special in their own way.",
          "stars": null,
          "source": "diner review",
          "why_chosen": "most_promising"
        }
      ],
      "bright_spots": [
        {
          "finding": "Vegetarian dishes matched or surpassed meat courses",
          "excerpts": [
            "The vegetarian dishes often eclipsed their meat-friendly counterparts"
          ]
        },
        {
          "finding": "Returning guests receive adjusted menus and complimentary champagne",
          "excerpts": [
            "Benu serves only a single tasting menu, which gets adjusted on revisits, so that one won't repeat the same dishes",
            "as returning guests, we were offered a complimentary glass of champagne - a nice gesture"
          ]
        },
        {
          "finding": "Chef's Korean-French technique described as mind-blowing and personal",
          "excerpts": [
            "he creates a tasting menu with such creativity and imagination that's also mind blowing and tastes freakin' incredible",
            "the execution on each was jaw-dropping"
          ]
        },
        {
          "finding": "Honest holiday pricing — no Valentine's Day surcharges",
          "excerpts": [
            "they served us the regular menu (!) at the regular speed (!!) for the regular price (!!!)",
            "Benu's fair treatment of their guests remains a standout for me"
          ]
        }
      ],
      "health": {
        "url": "https://data.sfgov.org/Health-and-Social-Services/Restaurant-Scores-LIVES-Standard/pyih-qa8i",
        "grade": null,
        "score": 94,
        "source": "DataSF · Restaurant Scores (LIVES)",
        "status": "matched",
        "inspected_at": "2019-07-10",
        "match_confidence": 0.88,
        "critical_violations": []
      },
      "sources": [
        "yelp.com",
        "eatingreallywell.com",
        "travelsforstars.com",
        "salepepeamore.com",
        "theyayproject.com",
        "instagram.com",
        "forbestravelguide.com",
        "youtube.com",
        "guide.michelin.com",
        "eater.com",
        "sandiego.eater.com",
        "sf.eater.com"
      ],
      "evidence_count": 40,
      "evidence": [
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Functional cookies allow the website to function and enable us to provide enhanced features and personalisation. Analytics cookies allow us to understand how visitors use our site and to measure and optimize the site.",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "These cookies are intended to make advertising more relevant to users and more valuable to advertisers. For example, we may use Cookies to serve you interest-based ads. If you do not allow these cookies, you will experience less targeted advertising,",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "I dined with a vegetarian friend which allowed us to see even more of their incredible skill. The vegetarian dishes often eclipsed their meat-friendly counterparts.",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "The restaurant was strangely unaware that my friend was vegetarian, despite having asked the about their vegetarian options weeks earlier. They had even inquired about my friend's needs in greater detail via our email exchange. I may have missed a",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "It was one of the few service missteps of the evening, the most egregious of which was a rushed plate clearing from a busperson that spilled sauce all over the table without concern not apology. He then grabbed at my",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "A wine pairing is not offered but the sommelier brought some excellent though forgettable wines throughout the meal. I had read some question marks about the desserts but each one was fabulous, flavorful, light and refreshing. And again, the execution",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Benu is everything you want a 3-star meal to be. As Michelin describes, it is definitely \"worth a special journey\". I traveled to San Francisco simply because I landed this reservation, and I'm so very glad I did. This meal",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "I will always fondly remember three-Michelin-starred “Benu” for something that it didn't do. Our last dinner here was on Valentine's Day in 2018. Most restaurants take this day as an opportunity to fleece their guests by increasing their prices while",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "It has been over six years since that memorable visit, so a return trip was long overdue. Benu's location is still the same, in the SOMA district of San Francisco, a block south of the SFMOMA. The layout of the",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Benu serves only a single tasting menu, which gets adjusted on revisits, so that one won’t repeat the same dishes. Speaking of which, as returning guests, we were offered a complimentary glass of champagne - a nice gesture. An optional",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Before opening his own restaurant in downtown San Francisco, the chef had worked at [The French Laundry](/blog/2023/10/19/the-french-laundry-yountville) for a number of years. That explains the French techniques being used, but mainly we experienced a fine-dining take on Asian food, with",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Next, a river eel had been prepared jwipo (jerky) style, and wrapped around a poached eel filet and some radishes. Underneath was a sauce made from eel bones and on top some dried pepper leaf powder. The dish was served",
          "source": "yelp.com"
        }
      ]
    }
  },
  {
    "restaurant": {
      "name": "Californios",
      "slug": "californios-sf",
      "city": "San Francisco",
      "neighborhood": "The Mission",
      "lat": 37.7538,
      "lng": -122.4137,
      "cuisine_tags": [
        "mexican",
        "tasting menu"
      ],
      "vibe_tags": [
        "meal"
      ],
      "price_tier": 4
    },
    "dossier": {
      "verdict": "Two-Michelin-star Mexican tasting menu excels in food but service inconsistency divides diners.",
      "badges": [
        {
          "year": 2026,
          "label": "2 Michelin Stars",
          "domain": "Michelin Guide California"
        }
      ],
      "vitals": {
        "busiest": null,
        "price_tier": "$$$$",
        "best_time_to_try": "inside seating on cooler evenings",
        "reservation_route": "Tock",
        "booking_difficulty": "hard"
      },
      "patterns": [
        {
          "title": "Taco course consistently the standout highlight",
          "trend": "improving",
          "sources": [
            "food blog review",
            "Yelp-style review",
            "detailed course review"
          ],
          "excerpts": [
            "The taco course, and our favorite round of the night, is where Californios really succeeds in taking familiar dishes and making them taste like something we've never had before.",
            "You simply must pace yourself through the 13 courses because the last tacos and the mole are out of this world",
            "The fish itself is the best fried fish I've ever had. The crust has the perfect amount of crunch and give."
          ],
          "frequency": "mentioned across multiple independent visits"
        },
        {
          "title": "Corn and bean dishes anchor the menu throughout",
          "trend": "stable",
          "sources": [
            "tasting notes review 1",
            "editorial review",
            "tasting notes review 1"
          ],
          "excerpts": [
            "The main ingredients here, corn and beans, would return many times throughout our dinner.",
            "a tlacoyo stuffed with cranberry beans and melty Oaxacan queso on repeat forever",
            "a chilapita, a cracker cup made from black masa, filled with a cranberry bean mousse and topped with caviar"
          ],
          "frequency": "multiple courses per meal, across multiple visits"
        },
        {
          "title": "Service quality inconsistent relative to price and stars",
          "trend": "worsening",
          "sources": [
            "disappointed return visitor review",
            "disappointed return visitor review",
            "disappointed return visitor review"
          ],
          "excerpts": [
            "a server did not pull out the table for me to comfortably maneuver into my seat upon arrival nor upon my return to the table after a bathroom break",
            "The tablecloth should not be dirty when I sit down.",
            "Until service matches the food, Californios will remain a 2-star food experience"
          ],
          "frequency": "raised by multiple reviewers"
        },
        {
          "title": "Dietary restrictions receive dedicated printed menus",
          "trend": "stable",
          "sources": [
            "March 2023 visit review"
          ],
          "excerpts": [
            "dietary restrictions not just accommodated but graced with their own printed menus"
          ],
          "frequency": "noted on recent visits"
        },
        {
          "title": "Menu evolves continuously; repeat visits rewarded",
          "trend": "improving",
          "sources": [
            "forum post",
            "forum post",
            "Yelp review"
          ],
          "excerpts": [
            "I go once every several of months or so… the menus always have something new.",
            "I've been eating there since they opened. And to me there has been a clear progression in creativity and enhancement of flavors as their prices increased.",
            "Easily in my top five dining experiences of all time. I've eaten here at least ten times… every single time has been a knock-out."
          ],
          "frequency": "noted by multiple frequent diners"
        },
        {
          "title": "Beverage pairing well-regarded and food-integrated",
          "trend": "stable",
          "sources": [
            "forum post",
            "diner review",
            "March 2023 visit review"
          ],
          "excerpts": [
            "I did the wine/beverage pairing sometime last year and really enjoyed it. Mostly whites but very well thought out and far better interaction with the food than some of the other pairings in town",
            "we had the beverage pairing, and several of the wines served were immediately my new favorites",
            "there was a wine pairing ($197), a non-alcoholic pairing ($97), and two 'dueling' pairs of wines"
          ],
          "frequency": "multiple mentions"
        }
      ],
      "diner_view": {
        "go_when": "Weeknight if possible; sit inside for comfort in cooler months",
        "skip_this": [
          "Banana-leaf-wrapped white corn tamale (mild, unexciting flavor)",
          "Sopa with dungeness crab (crab undetectable, heavy masa dominates)",
          "Lime cotton candy petit four (oddly sour ice cream filling)"
        ],
        "getting_in": "Book via Tock; noted as difficult to secure and some regulars dislike the platform but continue using it.",
        "order_this": [
          "Crispy-skinned grilled squab taco in sourdough tortilla",
          "Tlacoyo stuffed with cranberry beans and melty Oaxacan queso",
          "Fried cod taco with sourdough tortilla",
          "Cara cara orange sorbet over crescenza cheese ice cream",
          "Kampachi dry-aged raw fish preparation",
          "Abalone with carrot juice and kombu"
        ],
        "know_before": [
          "Dinner runs approximately 3–4 hours for 13 courses",
          "Service charges go toward staff health insurance, not gratuity — budget for an additional tip",
          "Condiments like pickled turnips and cucumbers served with tacos are not refilled",
          "Inside seating available; outside patio exists but chilly in cool months",
          "Flash photography may be needed given dim lighting inside"
        ],
        "should_you_go": "Yes, if you want inventive contemporary Mexican tasting menu dining with exceptional tacos and evolving courses — but temper expectations for service polish at this price point."
      },
      "key_reviews": [
        {
          "date": null,
          "quote": "The taco course, and our favorite round of the night, is where Californios really succeeds in taking familiar dishes and making them taste like something we've never had before. You might never have dishes like these again. And that's precisely why a dinner at Californios is one you'll want to soak up every minute of.",
          "stars": null,
          "source": "editorial review",
          "why_chosen": "most_representative"
        },
        {
          "date": null,
          "quote": "Until service matches the food, Californios will remain a 2-star food experience. The tablecloth should not be dirty when I sit down. The service charges are designed to ensure everyone makes a living wage but the service was not up to snuff.",
          "stars": null,
          "source": "disappointed return visitor review",
          "why_chosen": "most_alarming"
        },
        {
          "date": null,
          "quote": "Easily in my top five dining experiences of all time. I've eaten here at least ten times, all the way from back when it was a BARGIN in old location near the 24th street station to their new larger, fancier digs, and every single time has been a knock-out.",
          "stars": null,
          "source": "Yelp review",
          "why_chosen": "most_promising"
        }
      ],
      "bright_spots": [
        {
          "finding": "Fried cod taco with sourdough tortilla called best fried fish ever by multiple diners",
          "excerpts": [
            "The fish itself is the best fried fish I've ever had. The crust has the perfect amount of crunch and give. The cod is perfectly tender. And the sourdough tortilla is the pièce de résistance.",
            "the crispy-skinned grilled squab taco is tucked into a pillowy sourdough tortilla that feels distinctly San Francisco"
          ]
        },
        {
          "finding": "Restaurant uniquely accommodates dietary restrictions with dedicated printed menus",
          "excerpts": [
            "dietary restrictions not just accommodated but graced with their own printed menus"
          ]
        },
        {
          "finding": "Chef Cantú's commitment to traditional Mexican techniques like nixtamalization gives intellectual depth to the menu",
          "excerpts": [
            "the chef wanted to keep traditional Mexican cooking methods alive, such as 'nixtamalization', where corn is treated with an alkaline solution",
            "There was a ton of like, 'This is not Mexican cuisine.' Even from our families, you know, trying to explain a contemporary cuisine to a lot of people is totally foreign because people kind of think that cuisine exists in a cookbook and that it doesn't change."
          ]
        },
        {
          "finding": "Birthday celebrations receive complimentary touches that elevate the experience",
          "excerpts": [
            "Since it was my friend's birthday, we were all given complimentary champagne, and he received an additional treat of a drinking chocolate mix.",
            "Tiny bottles of Mexican and Madagascan vanilla were apropos of the experience, a departing nod to Cantú's Mexican-American roots."
          ]
        }
      ],
      "health": {
        "url": "https://data.sfgov.org/Health-and-Social-Services/Restaurant-Scores-LIVES-Standard/pyih-qa8i",
        "grade": null,
        "score": 98,
        "source": "DataSF · Restaurant Scores (LIVES)",
        "status": "matched",
        "inspected_at": "2019-09-04",
        "match_confidence": 0.88,
        "critical_violations": []
      },
      "sources": [
        "yelp.com",
        "travelsforstars.com",
        "theinfatuation.com",
        "foodtalkcentral.com",
        "christinamueller.com",
        "s3lifestyle.substack.com",
        "guide.michelin.com",
        "apnews.com",
        "californiossf.com",
        "sf.eater.com",
        "eater.com",
        "m.yelp.com"
      ],
      "evidence_count": 40,
      "evidence": [
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Functional cookies allow the website to function and enable us to provide enhanced features and personalisation. Analytics cookies allow us to understand how visitors use our site and to measure and optimize the site.",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "These cookies are intended to make advertising more relevant to users and more valuable to advertisers. For example, we may use Cookies to serve you interest-based ads. If you do not allow these cookies, you will experience less targeted advertising,",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "We last ate at Californios in June 2021 - one of our first in-person restaurant visits after the pandemic. Back then, we had dinner on the outside patio, but this time, on a chilly evening in late March, it was",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Next was a chilapita, a cracker cup made from black masa, filled with a cranberry bean mousse and topped with caviar. The cracker had a light, slightly mealy, crunch. The main flavor here came from the beans, with the caviar",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "“Sopa” was a dish with a base of corn masa that was topped with dungeness crab meat, a mushroom/bean espuma and shaved truffles. The texture here was dominated by the mealy masa, making this dish much heavier than the previous",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Next, we received a series of three tacos, each served as a separate course. They came with a variety of condiments: pickled turnips, pickled cucumbers and key limes. These acidic bites were great additions, especially for the heavier tacos. Sadly,",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Banana-leaf-wrapped white corn tamales were filled with mozzarella cheese, roasted chilis and swiss chard. The dish was topped tableside with a pepita salsa and candied pepitas. The tamale with its mealy corn texture didn't blow me away. It had a",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "On to the pre-dessert. A cara cara orange sorbet was served over a cheese ice cream (made from crescenza) and topped with a white guava sauce. On the side was a warm honey-ginger-lemon tea seasoned with citrus leaves and wheatgrass.",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "The main dessert came in two parts. A warm one: a cinnamon-apple empanada, and a cold one: a rum ice cream with pecans. The empanada was fine, pretty much what one would expect after hearing “cinnamon and apple”, but served",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Four petit fours concluded our dinner. First, what looked like a chocolate taco was filled with a strawberry gelato. A crumbly shell and a nice strawberry flavor **16**. Lime-flavored cotton candy was filled with a tamarind/raspberry ice cream. The cotton",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "At the end of our dinner, I was not entirely sure about what story the meal wanted to tell. Our servers said that the chef wanted to keep traditional Mexican cooking methods alive, such as “nixtamalization”, where corn is treated",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "The taco course, and our favorite round of the night, is where Californios really succeeds in taking familiar dishes and making them taste like something we’ve never had before. For example, the crispy-skinned grilled squab taco is tucked into a",
          "source": "yelp.com"
        }
      ]
    }
  },
  {
    "restaurant": {
      "name": "Che Fico",
      "slug": "che-fico-sf",
      "city": "San Francisco",
      "neighborhood": "NoPa",
      "lat": 37.7761,
      "lng": -122.4383,
      "cuisine_tags": [
        "italian"
      ],
      "vibe_tags": [
        "meal"
      ],
      "price_tier": 3
    },
    "dossier": {
      "verdict": "Stunning, hyped Italian in SF that mostly delivers but overprices every dish.",
      "badges": [
        {
          "year": null,
          "label": "Multiple Interior Design Awards",
          "domain": "design"
        }
      ],
      "vitals": {
        "busiest": "Opening time (5:30 p.m.) draws lineup before doors open",
        "price_tier": "$$$$ ($28-50 mains)",
        "best_time_to_try": "Tuesday evening walk-in, arrive 8 minutes before opening",
        "reservation_route": "Advance reservation required for table; walk-in queue at bar/window/communal table from open",
        "booking_difficulty": "Very high — reservations scarce, 46 walk-in spots at bar/window/communal table"
      },
      "patterns": [
        {
          "title": "Pasta quality is exceptional but flavors can overpower",
          "trend": "stable",
          "sources": [
            "Sonia review",
            "Geoffrey review",
            "SF critic review"
          ],
          "excerpts": [
            "the tortelloni absorbed the flavor and I could barely taste the squash",
            "the squash flavor was a bit overpowering",
            "The chewy, thick thimbles, tossed in goat butter, trumped every other orecchiette I've tried",
            "the pasta blew my mind"
          ],
          "frequency": "Multiple dishes across multiple reviewers"
        },
        {
          "title": "Prices consistently flagged as too high",
          "trend": "stable",
          "sources": [
            "Sonia review",
            "Sonia cont. review",
            "Geoffrey cont. review"
          ],
          "excerpts": [
            "is $30 justifiable for a slightly better version of spaghetti pomodoro? I'd argue no",
            "I'm not sure a pound of cheese could warrant the gnocchi's $50 fee",
            "A $28 bougie pizza here is only $18 at similar-quality Doppio Zero"
          ],
          "frequency": "Multiple reviewers independently raise pricing"
        },
        {
          "title": "Service is attentive and responsive to problems",
          "trend": "stable",
          "sources": [
            "Sonia review",
            "Sonia review",
            "Geoffrey cont. review"
          ],
          "excerpts": [
            "the manager came out to tell us our friend Alyssa's gnocchi had been slightly overcooked, but another batch would be out in five minutes. Sure enough, it came out in three",
            "our waiter was more than happy to answer any questions and was highly knowledgeable",
            "the service is very attentive"
          ],
          "frequency": "Consistent across reviewers"
        },
        {
          "title": "Interior design generates strong reactions and praise",
          "trend": "stable",
          "sources": [
            "SF critic review",
            "Sonia review",
            "SF critic review"
          ],
          "excerpts": [
            "Inside is one of the most stunning, if intentionally photogenic, restaurants in San Francisco",
            "Embroidered cloth napkins, teal tables and comfortable-yet-chic booths made it an upscale yet comfortable setting",
            "it creates a dizzying, almost Escher-like entrance that opens to a space so lovely — and unexpected in this city of lookalikes — that I literally gasped"
          ],
          "frequency": "Every reviewer mentions ambiance"
        },
        {
          "title": "Pizza toppings unbalanced; crust and base praised",
          "trend": "stable",
          "sources": [
            "Geoffrey cont. review",
            "Geoffrey cont. review",
            "Geoffrey cont. review"
          ],
          "excerpts": [
            "the funghi (mushrooms) drowned out the salsiccia (Italian sausage) that drew me to the dish in the first place",
            "It seemed the entire pizza was constructed as a bowl for thinly-sliced cremini mushrooms",
            "the crust, sauce and cheese melted, I think I would've greatly enjoyed a pizza without all the"
          ],
          "frequency": "Primary pizza reviewer experience"
        }
      ],
      "diner_view": {
        "go_when": "Tuesday evening for best walk-in odds; weeknight late dinner (8 p.m.) still lively",
        "skip_this": [
          "Tortelloni de Zucca (balsamic overwhelms squash)",
          "Salsiccia e Funghi pizza (mushrooms overwhelm sausage; chilis may be too spicy)",
          "Gnocchi at $50 unless cheese-forward dishes are your priority"
        ],
        "getting_in": "Reservations in very high demand; arrive 8 minutes before 5:30 p.m. opening to queue for one of 46 walk-in spots at bar, window ledge, or communal table.",
        "order_this": [
          "Focaccia",
          "Spaghetti Pomodoro",
          "Orecchiette with broccoli rabe and fennel sausage",
          "Bigoli nero (squid-ink noodles with octopus, Dungeness crab, littlenecks)",
          "Duck liver chopped with chicken-liver mousse",
          "Olive oil cake with roasted strawberry vinaigrette and malted yogurt gelato",
          "Coriander cocktail"
        ],
        "know_before": [
          "Outdoor seating has blind spots between heaters — request indoor or near a heater",
          "Indoor seating is limited",
          "Menu can be slightly confusing — ask the waiter, they are knowledgeable",
          "Family-style ordering reduces per-person cost significantly",
          "Pasta is marked on menu as house machine-made or hand-made — worth noting when ordering"
        ],
        "should_you_go": "Yes, if you appreciate craft Italian and can stomach premium SF pricing — go for pasta and focaccia, share dishes family-style."
      },
      "key_reviews": [
        {
          "date": "2018",
          "quote": "Rarely does a restaurant with so much hype actually live up to it. But from the first sip of my Coriander to the last scrape of olive oil cake through its puddle of roasted strawberry vinaigrette, I was a believer.",
          "stars": null,
          "source": "SF critic review",
          "why_chosen": "most_representative"
        },
        {
          "date": null,
          "quote": "I'm not sure a pound of cheese could warrant the gnocchi's $50 fee.",
          "stars": null,
          "source": "Sonia review",
          "why_chosen": "most_alarming"
        },
        {
          "date": null,
          "quote": "I have never had such perfectly made focaccia: crunchy crust, melt-in-your-mouth inside, with all the flavors coming alive.",
          "stars": null,
          "source": "Geoffrey review",
          "why_chosen": "most_promising"
        }
      ],
      "bright_spots": [
        {
          "finding": "Focaccia is a standout that exceeds even homemade family benchmarks",
          "excerpts": [
            "I have never had such perfectly made focaccia: crunchy crust, melt-in-your-mouth inside, with all the flavors coming alive"
          ]
        },
        {
          "finding": "Orecchiette and squid-ink pasta are best-in-class in a competitive SF pasta scene",
          "excerpts": [
            "The chewy, thick thimbles, tossed in goat butter, trumped every other orecchiette I've tried",
            "a bowl of delightfully dense squid-ink noodles tangled with octopus and Dungeness crab and littlenecks"
          ]
        },
        {
          "finding": "Liver dish achieves something considered near-impossible for the ingredient",
          "excerpts": [
            "It is creamy and dreamy and something you'd think chopped liver, by its very nature, could never be: pretty"
          ]
        },
        {
          "finding": "Service recovers from kitchen errors proactively and faster than promised",
          "excerpts": [
            "the manager came out to tell us our friend Alyssa's gnocchi had been slightly overcooked, but another batch would be out in five minutes. Sure enough, it came out in three"
          ]
        }
      ],
      "health": {
        "url": "https://data.sfgov.org/Health-and-Social-Services/Restaurant-Scores-LIVES-Standard/pyih-qa8i",
        "grade": null,
        "score": 96,
        "source": "DataSF · Restaurant Scores (LIVES)",
        "status": "matched",
        "inspected_at": "2018-06-13",
        "match_confidence": 0.88,
        "critical_violations": []
      },
      "sources": [
        "yelp.com",
        "menlocoa.org",
        "sf.eater.com",
        "chefico.com",
        "guide.michelin.com",
        "medium.com",
        "instagram.com"
      ],
      "evidence_count": 31,
      "evidence": [
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Functional cookies allow the website to function and enable us to provide enhanced features and personalisation. Analytics cookies allow us to understand how visitors use our site and to measure and optimize the site.",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "These cookies are intended to make advertising more relevant to users and more valuable to advertisers. For example, we may use Cookies to serve you interest-based ads. If you do not allow these cookies, you will experience less targeted advertising,",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Geoffrey: To start with the positives, I want to say that I have had many focaccia breads in my life, including my great-great-grandma-from-the-Italian-hills’ homemade recipe. But I have never had such perfectly made focaccia: crunchy crust, melt-in-your-mouth inside, with all",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Sonia: I ordered the Tortelloni de Zucca, which was excellent for what it was. However, I wished I had read the dish description more closely. I like balsamic fine, but as the base of my pasta, the tortelloni absorbed the",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Geoffrey cont.: I, too, was tempted by Audrey’s Spaghetti Pomodoro, cooked perfectly al dente, and when she couldn’t finish it, I did. I also tried some of Sonia’s tortelloni, as I had thought about ordering it. However, the squash flavor",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Sonia cont: I was intrigued by our guest star, Opinions Editor Alyssa McAdams’ gnocchi which she described as “pillowy soft, like a cloud” and “great for those who like copious amounts of cheese”; however, I’m not sure a pound of",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Geoffrey cont.: For my main dish, fearful of Sonia’s anti-simplicity rampage, I opted to try the Salsiccia e Funghi pizza instead of the standard Margarita. It came as advertised, though the funghi (mushrooms) drowned out the salsiccia (Italian sausage) that",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Sonia: Che Fico reservations are in such high demand we had to go on a Tuesday, and 8 p.m. was the most ideal time with our study schedules. Even late on a weeknight, the outdoor area was both lively and",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Geoffrey: While Sonia was swooning over the fabrics, I was freezing in the blind spot between heaters. Granted, I loved the setting of the restaurant, and no one else was excessively cold, but reader beware: indoor seating is limited.",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Sonia: Possibly a result of a newly-opened restaurant, the service was very personable. Our food came quickly and the only road bump was when the manager came out to tell us our friend Alyssa’s gnocchi had been slightly overcooked, but",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Sonia: There is no denying Che Fico is pricey. The food is good, but is $30 justifiable for a slightly better version of spaghetti pomodoro? I’d argue no. After leaving Che Fico, your stomach will be full, but your wallet",
          "source": "yelp.com"
        },
        {
          "url": null,
          "date": null,
          "kind": "review",
          "text": "Geoffrey: A $28 bougie pizza here is only $18 at similar-quality Doppio Zero (with locations in San Carlos and Mountain View). I’ll have to try their plain Margarita pizza, but I think regardless it could be a little less pricey.",
          "source": "yelp.com"
        }
      ]
    }
  }
];
